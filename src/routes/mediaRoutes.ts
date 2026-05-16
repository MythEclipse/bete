import type { Router } from "express";
import express from "express";
import { AppError } from "../errors";
import type { MediaController } from "../media/mediaController";
import type { MediaMode } from "../media/mediaTypes";

export type MediaRouteController = Pick<
  MediaController,
  "getState" | "queue" | "skip" | "stop"
>;

export function createMediaRoutes(controller: MediaRouteController): Router {
  const router = express.Router();

  router.get("/media/status", (_req, res, next) => {
    try {
      res.json(controller.getState());
    } catch (error) {
      next(error);
    }
  });

  router.post("/media/queue", async (req, res, next) => {
    try {
      const { source, mode = "music" } = req.body as {
        source?: string;
        mode?: MediaMode;
      };
      if (!source) {
        throw new AppError(
          "Media source is required",
          "MISSING_MEDIA_SOURCE",
          400,
        );
      }
      if (mode !== "music" && mode !== "screen") {
        throw new AppError("Invalid media mode", "INVALID_MEDIA_MODE", 400);
      }
      res.json(await controller.queue(source, { mode }));
    } catch (error) {
      next(error);
    }
  });

  router.post("/media/skip", async (_req, res, next) => {
    try {
      res.json(await controller.skip());
    } catch (error) {
      next(error);
    }
  });

  router.post("/media/stop", async (_req, res, next) => {
    try {
      res.json(await controller.stop());
    } catch (error) {
      next(error);
    }
  });

  return router;
}
