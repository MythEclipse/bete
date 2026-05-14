import type { Client } from "discord.js-selfbot-v13";
import type { Router } from "express";
import express from "express";
import { AppError } from "../errors";
import { createChildLogger } from "../logger";
import { syncSelectedChannelBacklog } from "../moderation/backlogSync";

const logger = createChildLogger("sync-routes");

export function createSyncRoutes(client: Client): Router {
  const router = express.Router();

  // POST /api/backlog-sync - Sync message backlog for a channel
  router.post("/backlog-sync", async (req, res, next) => {
    try {
      const { guildId, channelId } = req.body as {
        guildId?: string;
        channelId?: string;
      };

      if (!guildId || !channelId) {
        throw new AppError(
          "guildId and channelId are required",
          "MISSING_BACKLOG_PARAMS",
          400,
        );
      }

      logger.info({ guildId, channelId }, "Starting backlog sync");

      const count = await syncSelectedChannelBacklog(
        client,
        guildId,
        channelId,
      );

      logger.info(
        { guildId, channelId, messagesSync: count },
        "Backlog sync complete",
      );

      res.json({
        success: true,
        channelId,
        messagesSync: count,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
