// Configuration for the bot
export interface AppConfig {
  verbose: boolean;
  recordingsDir: string;
  recordingSegmentMs: number;
  decoderRotateMs: number;
  decoderCooldownMs: number;
}

export function parseBoolean(
  value: string | undefined,
  fallback: boolean,
): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

export function parsePositiveNumber(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    verbose: parseBoolean(env.VERBOSE, false),
    recordingsDir: env.RECORDINGS_DIR ?? "./recordings",
    recordingSegmentMs: parsePositiveNumber(env.RECORDING_SEGMENT_MS, 5_000),
    decoderRotateMs: parsePositiveNumber(env.DECODER_ROTATE_MS, 5_000),
    decoderCooldownMs: 30_000,
  };
}

export const config = loadConfig();
