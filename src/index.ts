import "./mock-crc";
import "libsodium-wrappers";
import "@snazzah/davey";
import "dotenv/config";
import { Client } from "discord.js-selfbot-v13";
import { config } from "./config";
import { createChildLogger } from "./logger";
import { discordPlayer } from "./player";
import { VoiceController } from "./voiceController";
import { startWebserver } from "./webserver";

const logger = createChildLogger("bot");

const token = config.DISCORD_TOKEN;

// Inisialisasi selfbot client
const client = new Client();
const voiceController = new VoiceController(client);

// Track shutdown state
let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) {
    logger.warn(`Already shutting down, ignoring ${signal}`);
    return;
  }

  isShuttingDown = true;
  logger.info({ signal }, "Graceful shutdown initiated");

  try {
    // Step 1: Stop voice connection
    logger.info("Stopping voice connection...");
    await voiceController.disconnect();

    // Step 2: Pause player
    logger.info("Pausing player...");
    discordPlayer.pause();

    // Step 3: Destroy client
    logger.info("Destroying Discord client...");
    try {
      client.destroy();
    } catch (err) {
      logger.warn({ error: err }, "Error destroying client");
    }

    logger.info("Graceful shutdown completed");
    process.exit(0);
  } catch (err) {
    logger.error({ error: err }, "Error during graceful shutdown");
    process.exit(1);
  }
}

client.on("ready", async () => {
  logger.info({ user: client.user?.tag }, "Bot logged in");
  startWebserver(config.WEBSERVER_PORT, client, voiceController);
});

client.on("error", (err) => {
  logger.error({ error: err }, "Client error");
});

// Graceful shutdown handlers
process.on("SIGINT", () => {
  gracefulShutdown("SIGINT");
});

process.on("SIGTERM", () => {
  gracefulShutdown("SIGTERM");
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  logger.error({ error: err }, "Uncaught exception");
  gracefulShutdown("uncaughtException");
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  logger.error({ reason, promise }, "Unhandled rejection");
  gracefulShutdown("unhandledRejection");
});

client.login(token);
