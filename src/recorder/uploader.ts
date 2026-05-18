import fs from "node:fs";
import path from "node:path";
import {
  insertVoiceRecording,
  updateVoiceRecordingAsFailed,
  updateVoiceRecordingAsUploaded,
} from "../database/voiceRecordingRepo";
import { createChildLogger } from "../logger";
import { retryWithBackoff } from "../retry";

const logger = createChildLogger("recording-uploader");

export interface UploadResponse {
  download_url: string;
  public_id: string;
  file_name: string;
  size_bytes: number;
}

/**
 * Uploads a recorded segment OGG file to external server and registers in database
 */
export async function uploadRecordingSegment(input: {
  id: string;
  oggPath: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  guildId: string | null;
  channelId: string | null;
  channelName: string | null;
}): Promise<void> {
  const {
    id,
    oggPath,
    userId,
    username,
    avatarUrl,
    guildId,
    channelId,
    channelName,
  } = input;
  const fileName = path.basename(oggPath);

  try {
    // 1. Get file size and insert initial pending state to DB
    const stats = fs.statSync(oggPath);
    await insertVoiceRecording({
      id,
      user_id: userId,
      username,
      avatar_url: avatarUrl,
      guild_id: guildId,
      channel_id: channelId,
      channel_name: channelName,
      filename: fileName,
      size_bytes: stats.size,
      upload_status: "pending",
      created_at: Date.now(),
    });

    // 2. Perform async upload with retry logic
    const downloadUrl = await retryWithBackoff(
      async () => {
        const fileBuffer = fs.readFileSync(oggPath);
        const fileBlob = new Blob([fileBuffer], { type: "audio/ogg" });
        const formData = new FormData();
        formData.append("file", fileBlob, fileName);
        formData.append("fileName", fileName);

        const res = await fetch("https://upload.asepharyana.tech/api/upload", {
          method: "POST",
          headers: {
            accept: "application/json",
          },
          body: formData,
        });

        if (!res.ok) {
          throw new Error(`Upload failed: Status ${res.status}`);
        }

        const data = (await res.json()) as UploadResponse;
        if (!data.download_url) {
          throw new Error("Missing download_url in response");
        }

        return data.download_url;
      },
      {
        retries: 3,
        minTimeout: 1000,
        maxTimeout: 5000,
        logger,
      },
    );

    // 3. Update DB to uploaded state
    await updateVoiceRecordingAsUploaded(id, downloadUrl, Date.now());
    logger.info({ id, downloadUrl }, "Recording segment uploaded successfully");

    // 4. Broadcast via WebSocket if broadcaster exists globally
    const broadcaster = (globalThis as any).moderationBroadcaster;
    if (broadcaster) {
      const payload = JSON.stringify({
        type: "voice_recording_uploaded",
        data: {
          id,
          user_id: userId,
          username,
          avatar_url: avatarUrl,
          guild_id: guildId,
          channel_id: channelId,
          channel_name: channelName,
          filename: fileName,
          size_bytes: stats.size,
          download_url: downloadUrl,
          upload_status: "uploaded",
          created_at: Date.now(),
          uploaded_at: Date.now(),
        },
        timestamp: Date.now(),
      });

      broadcaster.getClients().forEach((client: any) => {
        if (client.readyState === 1) {
          try {
            client.send(payload);
          } catch (err) {
            logger.warn(
              { err },
              "Failed to send recording upload event to client",
            );
          }
        }
      });
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error({ id, error: errorMsg }, "Failed to upload voice recording");
    await updateVoiceRecordingAsFailed(id, errorMsg).catch((err) => {
      logger.error({ id, err }, "Failed to write failure state to DB");
    });
  }
}
