import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import path from "path";
import prism from "prism-media";
import { discordPlayer } from "./player";

const activeUsers = new Map<string, { username: string, avatar: string, speaking: boolean }>();
let wsClients = new Set<any>();

// --- Upsampling: 24kHz mono s16le → 48kHz stereo s16le (pure JS, no FFmpeg) ---
// Each input sample is duplicated into 2 stereo pairs to double the sample rate.
function upsample24kMonoTo48kStereo(mono24k: Buffer): Buffer {
    const out = Buffer.alloc(mono24k.length * 4); // 2x rate * 2ch = 4x bytes
    for (let i = 0; i < mono24k.length / 2; i++) {
        const s = mono24k.readInt16LE(i * 2);
        out.writeInt16LE(s, i * 8);      // t=0 L
        out.writeInt16LE(s, i * 8 + 2);  // t=0 R
        out.writeInt16LE(s, i * 8 + 4);  // t=1 L  (duplicate for 2x rate)
        out.writeInt16LE(s, i * 8 + 6);  // t=1 R
    }
    return out;
}

export function startWebserver(port: number = 3000) {
    const app = express();
    const server = http.createServer(app);

    const wsPort = port + 1;
    const wss = new WebSocketServer({ port: wsPort, host: "0.0.0.0" });
    console.log(`[webserver] WebSocket server listening on ws://0.0.0.0:${wsPort}`);

    app.use(express.static(path.join(__dirname, "../public")));

    // --- Inbound: Discord PCM → tagged chunks → browser (set in recorder.ts) ---
    (global as any).broadcastPcmToWeb = (chunk: Buffer, userId: string) => {
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            hash = ((hash << 5) - hash) + userId.charCodeAt(i);
            hash |= 0;
        }
        const header = Buffer.alloc(4);
        header.writeInt32LE(hash, 0);
        const packet = Buffer.concat([header, chunk]);
        wsClients.forEach(client => {
            if (client.readyState === 1) client.send(packet);
        });
    };

    (global as any).updateActiveUser = (userId: string, data: { username: string, avatar: string, speaking: boolean }) => {
        activeUsers.set(userId, data);
        broadcastUserState();
    };

    function broadcastUserState() {
        const payload = JSON.stringify({
            type: "user_state",
            users: Array.from(activeUsers.entries()).map(([id, data]) => ({ id, ...data }))
        });
        wsClients.forEach(client => {
            if (client.readyState === 1) client.send(payload);
        });
    }

    // --- Outbound: browser PCM (24kHz mono) → Opus → Discord, NO FFmpeg ---
    const RATE = 48000;
    const CHANNELS = 2;
    const FRAME_SIZE = 960;                        // 20ms @ 48kHz
    const BYTES_PER_FRAME = FRAME_SIZE * CHANNELS * 2; // 3840 bytes

    const opusEncoder = new prism.opus.Encoder({ rate: RATE, channels: CHANNELS, frameSize: FRAME_SIZE });
    const oggBitstream = new prism.opus.OggLogicalBitstream({
        opusHead: new prism.opus.OpusHead({ channelCount: CHANNELS, sampleRate: RATE }),
        pageSizeControl: { maxPackets: 10 },
        crc: true,
    });
    opusEncoder.on('error', () => {});

    opusEncoder.pipe(oggBitstream);
    // Prime the encoder immediately so OGG headers are emitted before player reads
    opusEncoder.write(Buffer.alloc(BYTES_PER_FRAME, 0));
    discordPlayer.playStream(oggBitstream);

    let pcmBuffer = Buffer.alloc(0);
    let lastBrowserAudioTime = 0;
    const SILENCE_FRAME = Buffer.alloc(BYTES_PER_FRAME, 0);

    // Keep encoder alive with silence when browser isn't sending
    setInterval(() => {
        if (Date.now() - lastBrowserAudioTime > 40) {
            opusEncoder.write(SILENCE_FRAME);
        }
    }, 20);

    wss.on("connection", (ws) => {
        console.log("[webserver] New WebSocket connection on port " + wsPort);
        wsClients.add(ws);

        ws.send(JSON.stringify({
            type: "user_state",
            users: Array.from(activeUsers.entries()).map(([id, data]) => ({ id, ...data }))
        }));

        ws.on("message", (data: any) => {
            if (!Buffer.isBuffer(data)) return;
            lastBrowserAudioTime = Date.now();

            // Upsample browser 24kHz mono → 48kHz stereo
            const upsampled = upsample24kMonoTo48kStereo(data);
            pcmBuffer = Buffer.concat([pcmBuffer, upsampled]);

            // Encode complete Opus frames
            while (pcmBuffer.length >= BYTES_PER_FRAME) {
                const frame = pcmBuffer.slice(0, BYTES_PER_FRAME);
                pcmBuffer = pcmBuffer.slice(BYTES_PER_FRAME);
                opusEncoder.write(frame);
            }
        });

        ws.on("close", () => { wsClients.delete(ws); });
        ws.on("error", () => { wsClients.delete(ws); });
    });

    server.listen(port, "0.0.0.0", () => {
        console.log(`[webserver] Web interface listening on http://0.0.0.0:${port}`);
    });
}
