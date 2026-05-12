import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";
import {
    EndBehaviorType,
    joinVoiceChannel,
    VoiceConnectionStatus,
    entersState,
    getVoiceConnection,
} from "@discordjs/voice";
import type { VoiceChannel, Client } from "discord.js-selfbot-v13";
import prism from "prism-media";

import { PacketFilter } from "./packetFilter";
import { config } from "./config";
const recordingsDir = process.env.RECORDINGS_DIR ?? "./recordings";

// Pastikan folder recordings ada
if (!fs.existsSync(recordingsDir)) {
    fs.mkdirSync(recordingsDir, { recursive: true });
}

/**
 * Join ke voice channel dan mulai merekam semua user yang bicara.
 */
export async function startRecording(client: Client, channel: VoiceChannel): Promise<void> {
    const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator as any,
        selfDeaf: false,
        selfMute: false,
        debug: true,
    });

    if (config.verbose) {
        console.log(`[recorder] Joining voice channel: #${channel.name}`);
    }

    connection.on('debug', msg => {
        if (config.verbose) {
            console.log(`[voice-debug] ${msg}`);
        }
    });

    connection.on('error', err => {
        console.error(`[voice-error]`, err);
    });

    // Tunggu sampai benar-benar terhubung
    try {
        await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
        if (config.verbose) {
            console.log("[recorder] Connected to voice channel. Recording started.");
        }
    } catch (err) {
        console.error("[recorder] Failed to connect:", err);
        connection.destroy();
        return;
    }

    const receiver = connection.receiver;

    // Dengarkan siapapun yang mulai bicara
    receiver.speaking.on("start", async (userId) => {
        // Coba ambil data user dari cache atau fetch dari API
        const user = client.users.cache.get(userId) || await client.users.fetch(userId).catch(() => null);
        const username = user?.username ?? "Unknown User";
        const avatar = user?.displayAvatarURL({ format: 'png', size: 64 }) ?? "https://cdn.discordapp.com/embed/avatars/0.png";

        // Tampilkan format "nama user [voice activity]"
        console.log(`${username} [voice activity]`);
        
        // Notify webserver
        if ((global as any).updateActiveUser) {
            (global as any).updateActiveUser(userId, { username, avatar, speaking: true });
        }

        // Jangan record kalau sudah ada stream aktif untuk user ini
        if (receiver.subscriptions.has(userId)) return;

        const timestamp = Date.now();
        const userDir = path.join(recordingsDir, userId);
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }
        const filename = path.join(userDir, `${timestamp}.ogg`);
        const jsonFilename = path.join(userDir, `${timestamp}.json`);

        const audioStream = receiver.subscribe(userId, {
            end: {
                behavior: EndBehaviorType.AfterSilence,
                duration: 3000, // 3 seconds — avoids FFmpeg restart overhead between utterances
            },
        });

        try {
            // --- OGG file recording (unchanged) ---
            const packetFilterForOgg = new PacketFilter(8);
            const oggStream = new prism.opus.OggLogicalBitstream({
                opusHead: new prism.opus.OpusHead({ channelCount: 2, sampleRate: 48000 }),
                pageSizeControl: { maxPackets: 10 },
                crc: true,
            });
            const out = fs.createWriteStream(filename);
            audioStream.pipe(packetFilterForOgg).pipe(oggStream).pipe(out);

            // --- Web broadcast: pure JS Opus → PCM, no FFmpeg ---
            // Create a fresh decoder for each user session
            const opusDecoder = new prism.opus.Decoder({ frameSize: 960, channels: 2, rate: 48000 });

            // CRITICAL: Swallow decode errors (DAVE/bad packets) without crashing
            opusDecoder.on('error', () => {});

            // Downsample 48kHz stereo → 24kHz mono (take left channel, every 2nd sample)
            opusDecoder.on('data', (pcm: Buffer) => {
                if (!(global as any).broadcastPcmToWeb) return;
                // Input:  48kHz stereo s16le → 4 bytes per sample-pair
                // Output: 24kHz mono  s16le → 2 bytes per sample
                const outBuf = Buffer.alloc(pcm.length / 4);
                for (let i = 0; i < outBuf.length / 2; i++) {
                    outBuf.writeInt16LE(pcm.readInt16LE(i * 8), i * 2);
                }
                (global as any).broadcastPcmToWeb(outBuf, userId);
            });

            // Feed Opus packets one-by-one; catch per-packet decode errors
            let packetCount = 0;
            audioStream.on('data', (chunk: Buffer) => {
                packetCount++;
                if (packetCount <= 5) {
                    console.log(`[recorder] Pkt #${packetCount} from ${userId}: ${chunk.length}b | 0x${chunk.slice(0,4).toString('hex')}`);
                }
                if (chunk.length < 8) return; // skip tiny control packets
                try {
                    opusDecoder.write(chunk);
                } catch (_) {} // per-packet isolation — don't let one bad packet stop the stream
            });

            audioStream.on('end', () => {
                opusDecoder.end();
                if ((global as any).updateActiveUser) {
                    (global as any).updateActiveUser(userId, { username, avatar, speaking: false });
                }
            });


            out.on('finish', async () => {
                if (config.verbose) {
                    console.log(`[recorder] Saved: ${filename}`);
                }
                const endTime = Date.now();

                const eventMetadata = {
                    userId,
                    username: user?.username ?? "Unknown User",
                    tag: user?.tag ?? "Unknown#0000",
                    startTime: timestamp,
                    endTime,
                    durationMs: endTime - timestamp,
                    filename: path.basename(filename)
                };
                fs.writeFileSync(jsonFilename, JSON.stringify(eventMetadata, null, 2));
                if (config.verbose) {
                    console.log(`[recorder] Saved metadata: ${jsonFilename}`);
                }
            });

            audioStream.on('error', (err) => {
                console.error(`[recorder] Audio Stream error ${userId}:`, err.message);
            });
            packetFilterForOgg.on('error', (err) => {
                console.error(`[recorder] PacketFilter(ogg) error ${userId}:`, err.message);
            });
            out.on('error', (err) => {
                console.error(`[recorder] File write error ${userId}:`, err.message);
            });
        } catch (e) {
            console.error(`[recorder] Failed to create stream for ${userId}:`, e);
        }
    });

    // Handle disconnect yang tidak disengaja
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
        if (config.verbose) {
            console.warn("[recorder] Disconnected from voice channel. Reconnecting...");
        }
        try {
            await Promise.race([
                entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
            ]);
            // Berhasil reconnect
        } catch {
            console.error("[recorder] Could not reconnect. Destroying connection.");
            connection.destroy();
        }
    });

    connection.on(VoiceConnectionStatus.Destroyed, () => {
        if (config.verbose) {
            console.log("[recorder] Voice connection destroyed.");
        }
    });
}

/**
 * Hentikan recording dan disconnect dari voice channel.
 */
export function stopRecording(guildId: string): void {
    const connection = getVoiceConnection(guildId);
    if (connection) {
        connection.destroy();
        if (config.verbose) {
            console.log("[recorder] Recording stopped and disconnected.");
        }
    } else {
        console.warn("[recorder] No active connection to stop.");
    }
}
