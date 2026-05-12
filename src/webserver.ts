import express from "express";
import { WebSocketServer } from "ws";
import http from "http";
import path from "path";
import { PassThrough } from "stream";
import { discordPlayer } from "./player";
import prism from "prism-media";

export function startWebserver(port: number = 3000) {
    const app = express();
    const server = http.createServer(app);
    const wss = new WebSocketServer({ server });

    const listeners = new Set<express.Response>();
    let headerChunks: Buffer[] = [];
    
    // Create a single, continuous Ogg stream for all web listeners
    const oggStream = new prism.opus.OggLogicalBitstream({
        opusHead: new prism.opus.OpusHead({
            channelCount: 2,
            sampleRate: 48000,
        }),
        pageSizeControl: {
            maxPackets: 10,
        },
    });

    // Forward Ogg pages to all connected web listeners
    oggStream.on("data", (chunk) => {
        // Cache the first 2 chunks (headers)
        if (headerChunks.length < 2) {
            headerChunks.push(chunk);
        }
        listeners.forEach(res => res.write(chunk));
    });

    // Prime the stream with a silent packet to generate headers immediately
    // Silent Opus packet (1 frame, 20ms)
    const silentPacket = Buffer.from([0xf8, 0xff, 0xfe]);
    oggStream.write(silentPacket);

    app.use(express.static(path.join(__dirname, "../public")));

    // Endpoint for receiving (listening) audio from Discord
    app.get("/listen", (req, res) => {
        res.setHeader("Content-Type", "audio/ogg");
        res.setHeader("Transfer-Encoding", "chunked");
        res.setHeader("Connection", "keep-alive");
        
        // Send cached headers immediately so the browser recognizes the stream
        headerChunks.forEach(chunk => res.write(chunk));
        
        listeners.add(res);
        console.log(`[webserver] New listener connected. Total: ${listeners.size}`);

        req.on("close", () => {
            listeners.delete(res);
            console.log(`[webserver] Listener disconnected. Total: ${listeners.size}`);
        });
    });

    // Function to broadcast raw Opus packets from Discord to the shared Ogg stream
    (global as any).broadcastOpusToWeb = (chunk: Buffer) => {
        oggStream.write(chunk);
    };

    wss.on("connection", (ws) => {
        console.log("[webserver] New WebSocket connection");

        const audioStream = new PassThrough();
        discordPlayer.playStream(audioStream);

        ws.on("message", (data: Buffer) => {
            // console.log(`[webserver] Received chunk: ${data.length} bytes`);
            audioStream.write(data);
        });

        ws.on("close", () => {
            console.log("[webserver] WebSocket connection closed");
            audioStream.end();
        });

        ws.on("error", (err) => {
            console.error("[webserver] WebSocket error:", err);
            audioStream.end();
        });
    });

    server.listen(port, () => {
        console.log(`[webserver] Server listening on http://localhost:${port}`);
    });
}
