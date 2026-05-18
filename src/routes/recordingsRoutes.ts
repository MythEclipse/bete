import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { listVoiceRecordings } from "../database/voiceRecordingRepo";
import { AppError } from "../errors";
import { createChildLogger } from "../logger";

const logger = createChildLogger("recordings-routes");

export function createRecordingsRoutes(): Router {
  const router = Router();

  router.get(
    "/recordings",
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const recordings = await listVoiceRecordings(100);
        res.json(recordings);
      } catch (error) {
        logger.error(
          { error: error instanceof Error ? error.message : String(error) },
          "Failed to list recordings",
        );
        next(
          new AppError(
            "DATABASE_ERROR",
            "Failed to retrieve voice recordings",
            500,
          ),
        );
      }
    },
  );

  return router;
}
