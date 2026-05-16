import type { Readable } from "node:stream";

export type MediaMode = "music" | "screen";
export type MediaSourceKind =
  | "url"
  | "local"
  | "youtube"
  | "spotify"
  | "search";
export type MediaQueueItemStatus = "queued" | "playing" | "failed";

export interface ResolvedMediaSource {
  source: string;
  title: string;
  kind: MediaSourceKind;
}

export interface MediaQueueItem extends ResolvedMediaSource {
  id: string;
  mode: MediaMode;
  requestedBy: string;
  addedAt: number;
  status: MediaQueueItemStatus;
}

export interface MediaState {
  playing: boolean;
  activeMode: MediaMode | null;
  current: MediaQueueItem | null;
  queue: MediaQueueItem[];
}

export interface QueueMediaOptions {
  mode?: MediaMode;
  requestedBy?: string;
}

export interface MusicPlayback {
  done: Promise<void>;
  stop(): void;
}

export interface MusicPlayer {
  play(source: ResolvedMediaSource): MusicPlayback;
}

export interface ScreenSharePlayback {
  done: Promise<void>;
  stop(): void;
}

export interface ScreenShareController {
  isActive(): boolean;
  start(source: string): Promise<ScreenSharePlayback>;
}

export type DiscordPlayerOwner = "none" | "browser-bridge" | "music" | "screen";

export interface DiscordAudioPlayer {
  getOwner(): DiscordPlayerOwner;
  isConnected(): boolean;
  playStream(stream: Readable, owner: DiscordPlayerOwner): void;
  pause(owner?: DiscordPlayerOwner): void;
  unpause(owner?: DiscordPlayerOwner): boolean;
  stop(owner?: DiscordPlayerOwner): void;
}
