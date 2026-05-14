import type { Router } from "express";
import express from "express";
import { AppError } from "../errors";
import { createChildLogger } from "../logger";
import {
  getAttachmentsByChannel,
  getMessageById,
  getMessagesByChannel,
  listMessages,
  listReviewMessages,
} from "../moderation/messageStore";
import type { MessageQuery } from "../moderation/types";

const logger = createChildLogger("message-routes");

export function createMessageRoutes(): Router {
  const router = express.Router();

  // GET /api/messages - List messages by channel (backward compatible)
  // Query params: channel (required), type (text|image), limit, offset
  // Also supports new params: channelId, status, cursor, limit
  router.get("/messages", async (req, res, next) => {
    try {
      const {
        channel,
        channelId,
        type,
        limit = "50",
        offset = "0",
        status,
        cursor,
      } = req.query as {
        channel?: string;
        channelId?: string;
        type?: string;
        limit?: string;
        offset?: string;
        status?: string;
        cursor?: string;
      };

      // Support both 'channel' (legacy) and 'channelId' (new)
      const targetChannel = channelId || channel;

      if (!targetChannel) {
        throw new AppError(
          "channel or channelId query parameter is required",
          "MISSING_CHANNEL",
          400,
        );
      }

      const limitNum = Math.min(parseInt(limit) || 50, 100);
      const offsetNum = parseInt(offset) || 0;

      if (type === "image") {
        const attachments = await getAttachmentsByChannel(
          targetChannel,
          limitNum,
          offsetNum,
        );
        res.json({
          type: "image",
          data: attachments,
          count: attachments.length,
        });
      } else {
        const messages = await getMessagesByChannel(
          targetChannel,
          limitNum,
          offsetNum,
        );
        res.json({
          type: "text",
          data: messages,
          count: messages.length,
        });
      }
    } catch (error) {
      next(error);
    }
  });

  // GET /api/messages/:id - Get a specific message
  router.get("/messages/:id", async (req, res, next) => {
    try {
      const { id } = req.params;

      if (!id) {
        throw new AppError("Message ID is required", "MISSING_MESSAGE_ID", 400);
      }

      const message = await getMessageById(id);

      if (!message) {
        throw new AppError("Message not found", "MESSAGE_NOT_FOUND", 404);
      }

      res.json(message);
    } catch (error) {
      next(error);
    }
  });

  // GET /api/review - List messages flagged for review
  // Query params: guildId, channelId, threadId, userId, cursor, limit
  router.get("/review", async (req, res, next) => {
    try {
      const {
        guildId,
        channelId,
        threadId,
        userId,
        cursor,
        limit = "50",
      } = req.query as {
        guildId?: string;
        channelId?: string;
        threadId?: string;
        userId?: string;
        cursor?: string;
        limit?: string;
      };

      const limitNum = Math.min(parseInt(limit) || 50, 100);

      const query: Omit<MessageQuery, "status"> = {
        guildId,
        channelId,
        threadId,
        userId,
        cursor,
        limit: limitNum,
      };

      const result = await listReviewMessages(query);

      res.json({
        data: result.data,
        nextCursor: result.nextCursor,
        count: result.data.length,
      });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/attachments - List attachments by channel
  // Query params: channel (required), limit, offset
  router.get("/attachments", async (req, res, next) => {
    try {
      const {
        channel,
        limit = "50",
        offset = "0",
      } = req.query as {
        channel?: string;
        limit?: string;
        offset?: string;
      };

      if (!channel) {
        throw new AppError(
          "channel query parameter is required",
          "MISSING_CHANNEL",
          400,
        );
      }

      const limitNum = Math.min(parseInt(limit) || 50, 100);
      const offsetNum = parseInt(offset) || 0;

      const attachments = await getAttachmentsByChannel(
        channel,
        limitNum,
        offsetNum,
      );

      res.json({
        data: attachments,
        count: attachments.length,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
