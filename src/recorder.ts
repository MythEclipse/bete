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
        selfMute: true,
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
        if (config.verbose) {
            // console.log(`[recorder-debug] Speaking 'start' event triggered for userId: ${userId}. Subscriptions has? ${receiver.subscriptions.has(userId)}`);
        }

        // Jangan record kalau sudah ada stream aktif untuk user ini
        if (receiver.subscriptions.has(userId)) return;

        // Coba ambil data user dari cache atau fetch dari API
        const user = client.users.cache.get(userId) || await client.users.fetch(userId).catch(() => null);
        const username = user?.username ?? "Unknown User";

        // Tampilkan format "nama user [voice activity]"
        console.log(`${username} [voice activity]`);

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
                duration: 1000, // Stop 1 detik setelah user diam
            },
        });

        try {
            const packetFilter = new PacketFilter(10);
            // Mock node-crc to provide pure JS implementation and bypass native build issues
            const CRC_TABLE = new Uint32Array(256);
            for (let i = 0; i < 256; i++) {
                let r = i << 24;
                for (let j = 0; j < 8; j++) {
                    r = (r & 0x80000000) !== 0 ? ((r << 1) ^ 0x04c11db7) : (r << 1);
                }
                CRC_TABLE[i] = (r >>> 0);
            }

            const Module = require('module');
            const originalRequire = Module.prototype.require;
            Module.prototype.require = function (id: string) {
                if (id === 'node-crc') {
                    return {
                        crc: function (width: number, reflectIn: boolean, poly: number, init: number, refOut: boolean, xorOut: number, unk1: number, unk2: number, buffer: Buffer) {
                            let crc = 0;
                            for (let i = 0; i < buffer.length; i++) {
                                crc = ((crc << 8) >>> 0) ^ CRC_TABLE[((crc >>> 24) ^ buffer[i]) & 0xff];
                                crc >>>= 0;
                            }
                            const result = Buffer.alloc(4);
                            result.writeUInt32BE(crc, 0);
                            return result;
                        }
                    };
                }
                return originalRequire.apply(this, arguments);
            };

            const oggStream = new prism.opus.OggLogicalBitstream({
                opusHead: new prism.opus.OpusHead({
                    channelCount: 2,
                    sampleRate: 48000,
                }),
                pageSizeControl: {
                    maxPackets: 10,
                },
                crc: true, // Use our mock node-crc
            });
            const out = fs.createWriteStream(filename);

            // Pipe: audioStream -> packetFilter -> oggStream -> out
            audioStream.pipe(packetFilter).pipe(oggStream).pipe(out);

            // Also forward to web listeners
            oggStream.on('data', (chunk) => {
                if ((global as any).broadcastToWeb) {
                    (global as any).broadcastToWeb(chunk);
                }
            });

            if (config.verbose) {
                console.log(`[recorder] Recording user ${userId} → ${filename}`);
            }

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

            audioStream.on('data', (chunk) => {
                if (config.verbose) {
                    console.log(`[recorder-debug] Received audio packet from ${userId}, size: ${chunk.length} bytes`);
                }
            });

            packetFilter.on('error', (err) => {
                console.error(`[recorder] Packet Filter error ${userId}:`, err.message);
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
