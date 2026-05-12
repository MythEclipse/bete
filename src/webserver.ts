import express from "express";
import { WebSocketServer } from "ws";
import http from "http";
import path from "path";
import { PassThrough } from "stream";
import { discordPlayer } from "./player";

export function startWebserver(port: number = 3000) {
    const app = express();
    const server = http.createServer(app);
    const wss = new WebSocketServer({ server });

    const listeners = new Set<express.Response>();
    let headerChunks: Buffer[] = [];

    app.use(express.static(path.join(__dirname, "../public")));

    // Endpoint for receiving (listening) audio from Discord
    app.get("/listen", (req, res) => {
        res.setHeader("Content-Type", "audio/ogg");
        
        // Send cached headers so the browser can decode the stream
        headerChunks.forEach(chunk => res.write(chunk));
        
        listeners.add(res);
        console.log(`[webserver] New listener connected. Total: ${listeners.size}`);

        req.on("close", () => {
            listeners.delete(res);
            console.log(`[webserver] Listener disconnected. Total: ${listeners.size}`);
        });
    });

    // Function to broadcast audio chunks to all listeners
    (global as any).broadcastToWeb = (chunk: Buffer) => {
        // Store the first two chunks as headers (OpusHead and OpusTags)
        if (headerChunks.length < 2) {
            headerChunks.push(chunk);
        }
        listeners.forEach(res => res.write(chunk));
    };

    wss.on("connection", (ws) => {
        console.log("[webserver] New WebSocket connection");

        const audioStream = new PassThrough();
        discordPlayer.playStream(audioStream);

        ws.on("message", (data: Buffer) => {
            // Write incoming audio chunks to the stream
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
