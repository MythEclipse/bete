import type { Router } from "express";
import express from "express";
import { AppError } from "../errors.js";
import {
  createMessageReview,
  createModerationAction,
  getMessageReview,
  getModerationAction,
  listMessageReviews,
  listModerationActions,
  updateMessageReview,
  updateModerationAction,
} from "../moderation/messageStore.js";
import type {
  MessageReview,
  ModerationAction,
  ReviewStatus,
} from "../moderation/types.js";

function parseLimit(value?: string): number {
  return Math.max(1, Math.min(value ? parseInt(value) : 50, 100));
}

function parseStatuses(value?: string): string[] | undefined {
  if (!value) return undefined;
  return value.split(",").filter((s) => s.length > 0);
}

export function createReviewRoutes(): Router {
  const router = express.Router();

  // Message Reviews
  // ===============

  // GET /api/reviews - List message reviews
  router.get("/reviews", async (req, res, next) => {
    try {
      const { guildId, channelId, status, cursor, limit } = req.query as {
        guildId?: string;
        channelId?: string;
        status?: string;
        cursor?: string;
        limit?: string;
      };

      const result = await listMessageReviews({
        guildId,
        channelId,
        status: parseStatuses(status),
        cursor,
        limit: parseLimit(limit),
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  // GET /api/reviews/:id - Get a specific review
  router.get("/reviews/:id", async (req, res, next) => {
    try {
      const review = await getMessageReview(req.params.id);
      if (!review) {
        throw new AppError("Review not found", "REVIEW_NOT_FOUND", 404);
      }
      res.json(review);
    } catch (error) {
      next(error);
    }
  });

  // POST /api/reviews - Create a new review
  router.post("/reviews", async (req, res, next) => {
    try {
      const { message_id, guild_id, channel_id, reviewer_id, status, notes } =
        req.body as {
          message_id: string;
          guild_id: string;
          channel_id: string;
          reviewer_id?: string;
          status?: ReviewStatus;
          notes?: string;
        };

      if (!message_id || !guild_id || !channel_id) {
        throw new AppError(
          "message_id, guild_id, and channel_id are required",
          "MISSING_REVIEW_FIELDS",
          400,
        );
      }

      const review = await createMessageReview({
        message_id,
        guild_id,
        channel_id,
        reviewer_id: reviewer_id || null,
        status: status || "pending",
        notes: notes || null,
        reviewed_at: null,
      });

      res.status(201).json(review);
    } catch (error) {
      next(error);
    }
  });

  // PATCH /api/reviews/:id - Update a review
  router.patch("/reviews/:id", async (req, res, next) => {
    try {
      const { status, notes, reviewer_id } = req.body as {
        status?: ReviewStatus;
        notes?: string;
        reviewer_id?: string;
      };

      const updates: Partial<MessageReview> = {};
      if (status) updates.status = status;
      if (notes !== undefined) updates.notes = notes;
      if (reviewer_id !== undefined) updates.reviewer_id = reviewer_id;
      if (status && status !== "pending") {
        updates.reviewed_at = Date.now();
      }

      const review = await updateMessageReview(req.params.id, updates);
      if (!review) {
        throw new AppError("Review not found", "REVIEW_NOT_FOUND", 404);
      }

      res.json(review);
    } catch (error) {
      next(error);
    }
  });

  // Moderation Actions
  // ==================

  // GET /api/actions - List moderation actions
  router.get("/actions", async (req, res, next) => {
    try {
      const { guildId, status, cursor, limit } = req.query as {
        guildId?: string;
        status?: string;
        cursor?: string;
        limit?: string;
      };

      const result = await listModerationActions({
        guildId,
        status: parseStatuses(status),
        cursor,
        limit: parseLimit(limit),
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  // GET /api/actions/:id - Get a specific action
  router.get("/actions/:id", async (req, res, next) => {
    try {
      const action = await getModerationAction(req.params.id);
      if (!action) {
        throw new AppError("Action not found", "ACTION_NOT_FOUND", 404);
      }
      res.json(action);
    } catch (error) {
      next(error);
    }
  });

  // POST /api/actions - Create a new moderation action
  router.post("/actions", async (req, res, next) => {
    try {
      const {
        message_id,
        user_id,
        guild_id,
        action_type,
        reason,
        executed_by,
      } = req.body as {
        message_id?: string;
        user_id?: string;
        guild_id: string;
        action_type: string;
        reason?: string;
        executed_by?: string;
      };

      if (!guild_id || !action_type) {
        throw new AppError(
          "guild_id and action_type are required",
          "MISSING_ACTION_FIELDS",
          400,
        );
      }

      const validTypes = [
        "delete_message",
        "mute_user",
        "warn_user",
        "kick_user",
        "ban_user",
      ];
      if (!validTypes.includes(action_type)) {
        throw new AppError(
          `Invalid action_type. Must be one of: ${validTypes.join(", ")}`,
          "INVALID_ACTION_TYPE",
          400,
        );
      }

      const action = await createModerationAction({
        message_id: message_id || null,
        user_id: user_id || null,
        guild_id,
        action_type: action_type as any,
        reason: reason || null,
        executed_by: executed_by || null,
        status: "pending",
        error: null,
        executed_at: null,
      });

      res.status(201).json(action);
    } catch (error) {
      next(error);
    }
  });

  // PATCH /api/actions/:id - Update an action
  router.patch("/actions/:id", async (req, res, next) => {
    try {
      const { status, error, executed_by } = req.body as {
        status?: "pending" | "executed" | "failed";
        error?: string;
        executed_by?: string;
      };

      const updates: Partial<ModerationAction> = {};
      if (status) {
        updates.status = status;
        if (status === "executed") {
          updates.executed_at = Date.now();
        }
      }
      if (error !== undefined) updates.error = error;
      if (executed_by !== undefined) updates.executed_by = executed_by;

      const action = await updateModerationAction(req.params.id, updates);
      if (!action) {
        throw new AppError("Action not found", "ACTION_NOT_FOUND", 404);
      }

      res.json(action);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
