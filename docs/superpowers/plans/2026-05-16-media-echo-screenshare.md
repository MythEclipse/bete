# Media Echo Fix and YouTube Screenshare Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent media playback echo by making audio player ownership explicit, then add a YouTube Go Live screenshare path through the existing media API.

**Architecture:** `DiscordPlayer` becomes the ownership gate for the shared Discord voice audio player. Music playback claims `music`, browser bridge claims `browser-bridge`, and screenshare uses a new `ScreenShareController` with `@dank074/discord-video-stream` while coordinating busy state through `MediaController`.

**Tech Stack:** TypeScript, Vitest, Express, `@discordjs/voice`, `prism-media`, `yt-dlp`, `@dank074/discord-video-stream`.

---

## File Structure

- Modify `src/player.ts`: add player owner types and claim/release behavior while preserving pause/unpause/status APIs.
- Modify `src/media/mediaTypes.ts`: add `MediaMode`, queue mode options, screen controller interfaces, and owner-aware `DiscordAudioPlayer` methods.
- Modify `src/media/musicPlayer.ts`: claim `music` ownership before starting ffmpeg output and release ownership on stop or normal close.
- Modify `src/webserver.ts`: lazily start browser bridge and make it claim `browser-bridge` only when no media owner is active.
- Modify `src/media/mediaQueue.ts`: accept a mode argument instead of hardcoding `music`.
- Modify `src/media/mediaController.ts`: route `mode: "screen"` to the new screen controller and enforce busy-state rules.
- Modify `src/routes/mediaRoutes.ts`: parse optional `mode` from POST body and pass it to controller.
- Modify `src/media/ytdlp.ts`: add `getDirectVideoUrl` for screenshare-friendly direct media URLs.
- Create `src/media/screenShareController.ts`: encapsulate Go Live lifecycle and dependency injection for tests.
- Create `tests/player.test.ts`: test ownership behavior.
- Modify `tests/media/musicPlayer.test.ts`: update mocks for ownership methods and verify release behavior.
- Modify `tests/media/mediaController.test.ts`: cover mode routing and busy conflicts.
- Modify `tests/routes/mediaRoutes.test.ts`: cover mode body parsing.
- Modify `tests/media/ytdlp.test.ts`: cover direct video URL command.
- Create `tests/media/screenShareController.test.ts`: test screenshare lifecycle with mocked dependencies.

---

### Task 1: Add DiscordPlayer Ownership

**Files:**
- Modify: `src/player.ts`
- Modify: `src/media/mediaTypes.ts`
- Create: `tests/player.test.ts`

- [ ] **Step 1: Write the failing ownership tests**

Create `tests/player.test.ts`:

```ts
import { PassThrough } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

const audioPlayer = {
  on: vi.fn(),
  play: vi.fn(),
  pause: vi.fn(),
  unpause: vi.fn(() => true),
  stop: vi.fn(),
  state: { status: "idle" },
};

vi.mock("@discordjs/voice", () => ({
  AudioPlayerStatus: { Idle: "idle", Playing: "playing" },
  StreamType: { OggOpus: "ogg/opus" },
  createAudioPlayer: vi.fn(() => audioPlayer),
  createAudioResource: vi.fn((stream, options) => ({ stream, options })),
}));

describe("DiscordPlayer ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    audioPlayer.state.status = "idle";
  });

  it("prevents browser bridge from overriding music playback", async () => {
    const { DiscordPlayer } = await import("../src/player");
    const player = new DiscordPlayer();

    player.playStream(new PassThrough(), "music");

    expect(() => player.playStream(new PassThrough(), "browser-bridge")).toThrow(
      "Discord audio player is owned by music",
    );
    expect(audioPlayer.play).toHaveBeenCalledTimes(1);
    expect(player.getOwner()).toBe("music");
  });

  it("allows the current owner to replace its own stream", async () => {
    const { DiscordPlayer } = await import("../src/player");
    const player = new DiscordPlayer();

    player.playStream(new PassThrough(), "browser-bridge");
    player.playStream(new PassThrough(), "browser-bridge");

    expect(audioPlayer.play).toHaveBeenCalledTimes(2);
    expect(player.getOwner()).toBe("browser-bridge");
  });

  it("releases ownership when the owner stops playback", async () => {
    const { DiscordPlayer } = await import("../src/player");
    const player = new DiscordPlayer();

    player.playStream(new PassThrough(), "music");
    player.stop("music");

    expect(audioPlayer.stop).toHaveBeenCalledTimes(1);
    expect(player.getOwner()).toBe("none");
  });

  it("ignores stop calls from non-owners", async () => {
    const { DiscordPlayer } = await import("../src/player");
    const player = new DiscordPlayer();

    player.playStream(new PassThrough(), "music");
    player.stop("browser-bridge");

    expect(audioPlayer.stop).not.toHaveBeenCalled();
    expect(player.getOwner()).toBe("music");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm exec vitest run tests/player.test.ts
```

Expected: FAIL with TypeScript/runtime errors because `playStream` does not accept an owner and `getOwner` does not exist.

- [ ] **Step 3: Add owner types**

Modify `src/media/mediaTypes.ts`:

```ts
import type { Readable } from "node:stream";

export type MediaMode = "music" | "screen";
export type DiscordPlayerOwner = "none" | "browser-bridge" | MediaMode;
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

export interface QueueMediaOptions {
  mode?: MediaMode;
  requestedBy?: string;
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

export interface DiscordAudioPlayer {
  getOwner(): DiscordPlayerOwner;
  isConnected(): boolean;
  playStream(stream: Readable, owner: DiscordPlayerOwner): void;
  pause(owner?: DiscordPlayerOwner): void;
  unpause(owner?: DiscordPlayerOwner): boolean;
  stop(owner?: DiscordPlayerOwner): void;
}
```

- [ ] **Step 4: Implement ownership in DiscordPlayer**

Replace `src/player.ts` with:

```ts
import { Readable } from "node:stream";
import {
  AudioPlayer,
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  StreamType,
  VoiceConnection,
} from "@discordjs/voice";
import type { DiscordPlayerOwner } from "./media/mediaTypes";

export class DiscordPlayer {
  private player: AudioPlayer;
  private connection: VoiceConnection | null = null;
  private owner: DiscordPlayerOwner = "none";

  constructor() {
    this.player = createAudioPlayer();

    this.player.on(AudioPlayerStatus.Playing, () => {
      console.log("[player] Audio player is now playing!");
    });

    this.player.on("error", (error) => {
      console.error(`[player] Error: ${error.message}`);
      this.owner = "none";
    });
  }

  public setConnection(connection: VoiceConnection) {
    this.connection = connection;
    this.connection.subscribe(this.player);
  }

  public getOwner(): DiscordPlayerOwner {
    return this.owner;
  }

  public isConnected(): boolean {
    return this.connection !== null;
  }

  public playStream(stream: Readable, owner: DiscordPlayerOwner) {
    if (owner === "none") {
      throw new Error("Discord audio player owner is required");
    }
    this.assertOwnerAvailable(owner);
    console.log("[player] Starting new audio stream...");

    const resource = createAudioResource(stream, {
      inputType: StreamType.OggOpus,
    });

    this.owner = owner;
    this.player.play(resource);
    this.connection?.subscribe(this.player);
  }

  public getStatus(): AudioPlayerStatus {
    return this.player.state.status;
  }

  public pause(owner?: DiscordPlayerOwner) {
    if (!this.canControl(owner)) return;
    this.player.pause(true);
  }

  public unpause(owner?: DiscordPlayerOwner): boolean {
    if (!this.canControl(owner)) return false;
    return this.player.unpause();
  }

  public stop(owner?: DiscordPlayerOwner) {
    if (!this.canControl(owner)) return;
    this.player.stop();
    this.owner = "none";
  }

  private assertOwnerAvailable(owner: DiscordPlayerOwner): void {
    if (this.owner !== "none" && this.owner !== owner) {
      throw new Error(`Discord audio player is owned by ${this.owner}`);
    }
  }

  private canControl(owner?: DiscordPlayerOwner): boolean {
    return !owner || this.owner === "none" || this.owner === owner;
  }
}

export const discordPlayer = new DiscordPlayer();
```

- [ ] **Step 5: Run ownership tests**

Run:

```bash
pnpm exec vitest run tests/player.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

Run:

```bash
git add src/player.ts src/media/mediaTypes.ts tests/player.test.ts
git commit -m "feat: add discord player ownership"
```

---

### Task 2: Make Music Playback Claim Ownership

**Files:**
- Modify: `src/media/musicPlayer.ts`
- Modify: `tests/media/musicPlayer.test.ts`

- [ ] **Step 1: Update failing music player tests**

In `tests/media/musicPlayer.test.ts`, update all fake `DiscordAudioPlayer` objects to include `getOwner`, owner-aware methods, and assertions:

```ts
const discordPlayer: DiscordAudioPlayer = {
  getOwner: () => "none",
  isConnected: () => true,
  playStream: vi.fn(),
  pause: vi.fn(),
  unpause: vi.fn(() => true),
  stop: vi.fn(),
};
```

Change the first test assertion to:

```ts
expect(discordPlayer.playStream).toHaveBeenCalledWith(proc.stdout, "music");
```

Change the stop assertion to:

```ts
expect(discordPlayer.stop).toHaveBeenCalledWith("music");
```

Add this test before the closing `});`:

```ts
it("releases music ownership when ffmpeg exits normally", async () => {
  const proc = new FakeProcess();
  const discordPlayer: DiscordAudioPlayer = {
    getOwner: () => "none",
    isConnected: () => true,
    playStream: vi.fn(),
    pause: vi.fn(),
    unpause: vi.fn(() => true),
    stop: vi.fn(),
  };
  const player = createMusicPlayer({
    spawn: vi.fn(() => proc),
    discordPlayer,
  });

  const playback = player.play({
    source: "/tmp/song.ogg",
    title: "song.ogg",
    kind: "local",
  });
  proc.emit("close", 0);
  await playback.done;

  expect(discordPlayer.stop).toHaveBeenCalledWith("music");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm exec vitest run tests/media/musicPlayer.test.ts
```

Expected: FAIL because `createMusicPlayer` still calls `playStream(proc.stdout)` and does not release ownership on normal close.

- [ ] **Step 3: Update music player ownership**

Modify `src/media/musicPlayer.ts` so the `play` body uses owner-aware methods:

```ts
play(source: ResolvedMediaSource): MusicPlayback {
  if (!audioPlayer.isConnected()) {
    throw new Error("Discord audio player is not connected");
  }

  const proc = spawn("ffmpeg", buildFfmpegArgs(source.source), {
    stdio: ["ignore", "pipe", "pipe"],
  }) as unknown as ChildProcessWithoutNullStreams;
  proc.stderr.resume();

  audioPlayer.playStream(proc.stdout, "music");

  let stopped = false;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    audioPlayer.stop("music");
  };

  const done = new Promise<void>((resolve, reject) => {
    proc.on("error", (error) => {
      release();
      reject(error);
    });
    proc.stdout.on("error", (error) => {
      release();
      reject(error);
    });
    proc.on("close", (code) => {
      release();
      if (code === 0 || stopped) {
        resolve();
        return;
      }
      reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });

  return {
    done,
    stop() {
      if (stopped) return;
      stopped = true;
      proc.kill("SIGTERM");
      release();
    },
  };
},
```

- [ ] **Step 4: Run music player tests**

Run:

```bash
pnpm exec vitest run tests/media/musicPlayer.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

Run:

```bash
git add src/media/musicPlayer.ts tests/media/musicPlayer.test.ts
git commit -m "fix: claim music playback ownership"
```

---

### Task 3: Make Browser Audio Bridge Lazy and Owner-Aware

**Files:**
- Modify: `src/webserver.ts:282-412`

- [ ] **Step 1: Update bridge start/control logic**

In `src/webserver.ts`, remove the eager call:

```ts
startBrowserAudioBridge();
```

Replace `startBrowserAudioBridge` and `ensureBrowserAudioBridge` with:

```ts
function startBrowserAudioBridge(): void {
  opusEncoder = new prism.opus.Encoder({
    rate: RATE,
    channels: CHANNELS,
    frameSize: FRAME_SIZE,
  });
  const oggBitstream = new prism.opus.OggLogicalBitstream({
    opusHead: new prism.opus.OpusHead({
      channelCount: CHANNELS,
      sampleRate: RATE,
    }),
    pageSizeControl: { maxPackets: 1 },
    crc: true,
  });
  opusEncoder.on("error", () => {});
  opusEncoder.pipe(oggBitstream);
  opusEncoder.write(Buffer.alloc(BYTES_PER_FRAME, 0));
  discordPlayer.playStream(oggBitstream, "browser-bridge");
  discordPlayer.pause("browser-bridge");
  bridgePlayerPaused = true;
}

function ensureBrowserAudioBridge(): boolean {
  const owner = discordPlayer.getOwner();
  if (owner !== "none" && owner !== "browser-bridge") return false;
  if (owner === "none" || discordPlayer.getStatus() === AudioPlayerStatus.Idle) {
    startBrowserAudioBridge();
  }
  return true;
}
```

In the 20ms interval, replace:

```ts
ensureBrowserAudioBridge();
if (bridgePlayerPaused) {
  const unpaused = discordPlayer.unpause();
```

with:

```ts
if (!ensureBrowserAudioBridge()) {
  pcmBuffer = Buffer.alloc(0);
  return;
}
if (bridgePlayerPaused) {
  const unpaused = discordPlayer.unpause("browser-bridge");
```

Replace:

```ts
discordPlayer.pause();
```

with:

```ts
discordPlayer.pause("browser-bridge");
```

- [ ] **Step 2: Run typecheck**

Run:

```bash
pnpm run typecheck
```

Expected: PASS. If it fails because `opusEncoder` may be used before assignment, change its declaration to `let opusEncoder: prism.opus.Encoder | null = null;` and write with `opusEncoder?.write(frame)` guarded by `if (!opusEncoder) return;`.

- [ ] **Step 3: Commit Task 3**

Run:

```bash
git add src/webserver.ts
git commit -m "fix: isolate browser audio bridge ownership"
```

---

### Task 4: Add Media Mode Parsing and Queue Support

**Files:**
- Modify: `src/media/mediaQueue.ts`
- Modify: `src/media/mediaController.ts`
- Modify: `src/routes/mediaRoutes.ts`
- Modify: `tests/media/mediaController.test.ts`
- Modify: `tests/routes/mediaRoutes.test.ts`

- [ ] **Step 1: Write failing route test for mode**

In `tests/routes/mediaRoutes.test.ts`, change the existing queue assertion to default mode:

```ts
expect(controller.queue).toHaveBeenCalledWith("https://example.com/song.mp3", {
  mode: "music",
});
```

Add this test:

```ts
it("queues a screen source", async () => {
  const state = { playing: true, activeMode: "screen" as const, current: null, queue: [] };
  const controller = {
    getState: vi.fn(),
    queue: vi.fn(async () => state),
    skip: vi.fn(),
    stop: vi.fn(),
  };
  const handler = getHandler(
    createMediaRoutes(controller),
    "/media/queue",
    "post",
  );
  const json = vi.fn();

  await handler?.(
    { body: { source: "https://youtu.be/video", mode: "screen" } } as Request,
    { json } as unknown as Response,
    vi.fn(),
  );

  expect(controller.queue).toHaveBeenCalledWith("https://youtu.be/video", {
    mode: "screen",
  });
  expect(json).toHaveBeenCalledWith(state);
});
```

- [ ] **Step 2: Run route test to verify it fails**

Run:

```bash
pnpm exec vitest run tests/routes/mediaRoutes.test.ts
```

Expected: FAIL because route does not pass mode/options.

- [ ] **Step 3: Update media route parsing**

Replace `MediaRouteController` and queue handler in `src/routes/mediaRoutes.ts` with:

```ts
export type MediaRouteController = Pick<
  MediaController,
  "getState" | "queue" | "skip" | "stop"
>;

type MediaQueueBody = {
  source?: string;
  mode?: "music" | "screen";
};
```

```ts
router.post("/media/queue", async (req, res, next) => {
  try {
    const { source, mode = "music" } = req.body as MediaQueueBody;
    if (!source) {
      throw new AppError(
        "Media source is required",
        "MISSING_MEDIA_SOURCE",
        400,
      );
    }
    if (mode !== "music" && mode !== "screen") {
      throw new AppError("Media mode is invalid", "INVALID_MEDIA_MODE", 400);
    }
    res.json(await controller.queue(source, { mode }));
  } catch (error) {
    next(error);
  }
});
```

- [ ] **Step 4: Update MediaQueue mode support**

Replace `add` in `src/media/mediaQueue.ts` with:

```ts
add(
  source: ResolvedMediaSource,
  mode: MediaQueueItem["mode"] = "music",
  requestedBy = "dashboard",
): MediaQueueItem {
  const item: MediaQueueItem = {
    id: this.createId(),
    mode,
    requestedBy,
    addedAt: this.now(),
    status: "queued",
    ...source,
  };
  this.items.push(item);
  return { ...item };
}
```

- [ ] **Step 5: Update MediaController state and queue signature**

In `src/media/mediaController.ts`, import `QueueMediaOptions` and update `getState` and `queue`:

```ts
import type {
  MediaState,
  MusicPlayback,
  MusicPlayer,
  QueueMediaOptions,
  ResolvedMediaSource,
} from "./mediaTypes";
```

```ts
getState(): MediaState {
  const snapshot = this.queueStore.snapshot();
  return {
    playing: snapshot.current?.status === "playing",
    activeMode: snapshot.current?.mode ?? null,
    ...snapshot,
  };
}

async queue(
  source: string,
  options: QueueMediaOptions = {},
): Promise<MediaState> {
  const mode = options.mode ?? "music";
  this.assertCanStart();
  const resolved = await (
    this.dependencies.resolveMediaSource ?? resolveMediaSource
  )(source);
  this.queueStore.add(resolved, mode, options.requestedBy);
  this.startNextIfIdle();
  return this.emitState();
}
```

- [ ] **Step 6: Update affected media controller expectations**

In `tests/media/mediaController.test.ts`, update state equality in the stop test to:

```ts
expect(state).toEqual({
  playing: false,
  activeMode: null,
  current: null,
  queue: [],
});
```

No other expectations need full state equality.

- [ ] **Step 7: Run route and media controller tests**

Run:

```bash
pnpm exec vitest run tests/routes/mediaRoutes.test.ts tests/media/mediaController.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Task 4**

Run:

```bash
git add src/media/mediaQueue.ts src/media/mediaController.ts src/routes/mediaRoutes.ts tests/media/mediaController.test.ts tests/routes/mediaRoutes.test.ts
git commit -m "feat: add media mode routing"
```

---

### Task 5: Add yt-dlp Direct Video URL Support

**Files:**
- Modify: `src/media/ytdlp.ts`
- Modify: `tests/media/ytdlp.test.ts`

- [ ] **Step 1: Write failing yt-dlp test**

In `tests/media/ytdlp.test.ts`, add:

```ts
it("gets a direct video URL", async () => {
  const spawn = createSpawn("https://cdn.example.com/video.mp4\n");
  const ytdlp = createYtDlp({ spawn });

  const result = await ytdlp.getDirectVideoUrl("https://youtu.be/video");

  expect(result).toBe("https://cdn.example.com/video.mp4");
  expect(spawn).toHaveBeenCalledWith(
    "yt-dlp",
    [
      "https://youtu.be/video",
      "--get-url",
      "--format",
      "bestvideo[protocol^=http]+bestaudio[protocol^=http]/best[protocol^=http]/best",
      "--no-playlist",
      "--no-warnings",
      "--quiet",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm exec vitest run tests/media/ytdlp.test.ts
```

Expected: FAIL because `getDirectVideoUrl` does not exist.

- [ ] **Step 3: Add direct video method**

In `src/media/ytdlp.ts`, update `YtDlpClient`:

```ts
export interface YtDlpClient {
  getMetadata(url: string): Promise<YtDlpMetadata>;
  getDirectAudioUrl(url: string): Promise<string>;
  getDirectVideoUrl(url: string): Promise<string>;
}
```

Add this method after `getDirectAudioUrl`:

```ts
async getDirectVideoUrl(url: string): Promise<string> {
  const value = await runYtDlp(spawn, [
    url,
    "--get-url",
    "--format",
    "bestvideo[protocol^=http]+bestaudio[protocol^=http]/best[protocol^=http]/best",
    "--no-playlist",
    "--no-warnings",
    "--quiet",
  ]);
  return value.trim().split("\n")[0] || url;
},
```

- [ ] **Step 4: Run yt-dlp tests**

Run:

```bash
pnpm exec vitest run tests/media/ytdlp.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 5**

Run:

```bash
git add src/media/ytdlp.ts tests/media/ytdlp.test.ts
git commit -m "feat: resolve direct video urls"
```

---

### Task 6: Add ScreenShareController

**Files:**
- Create: `src/media/screenShareController.ts`
- Create: `tests/media/screenShareController.test.ts`

- [ ] **Step 1: Write failing screenshare controller tests**

Create `tests/media/screenShareController.test.ts`:

```ts
import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { AppError } from "../../src/errors";
import { createScreenShareController } from "../../src/media/screenShareController";

function createDependencies() {
  const output = new PassThrough();
  return {
    getVoiceStatus: vi.fn(() => ({
      connected: true,
      activeGuildId: "guild-1",
      activeChannelId: "channel-1",
    })),
    getPlayerOwner: vi.fn(() => "none" as const),
    getDirectVideoUrl: vi.fn(async () => "https://cdn.example.com/video.mp4"),
    prepareStream: vi.fn(() => ({ command: { on: vi.fn(), kill: vi.fn() }, output })),
    playStream: vi.fn(async () => undefined),
    streamer: { id: "streamer" },
  };
}

describe("createScreenShareController", () => {
  it("starts a YouTube Go Live stream", async () => {
    const dependencies = createDependencies();
    const controller = createScreenShareController(dependencies);

    const playback = await controller.start("https://youtu.be/video");

    expect(dependencies.getDirectVideoUrl).toHaveBeenCalledWith(
      "https://youtu.be/video",
    );
    expect(dependencies.prepareStream).toHaveBeenCalledWith(
      "https://cdn.example.com/video.mp4",
      expect.objectContaining({ includeAudio: true }),
    );
    expect(dependencies.playStream).toHaveBeenCalledWith(
      dependencies.prepareStream.mock.results[0].value.output,
      dependencies.streamer,
      { type: "go-live" },
    );
    expect(controller.isActive()).toBe(true);
    playback.stop();
    expect(controller.isActive()).toBe(false);
  });

  it("rejects when voice is not connected", async () => {
    const dependencies = createDependencies();
    dependencies.getVoiceStatus.mockReturnValue({
      connected: false,
      activeGuildId: null,
      activeChannelId: null,
    });
    const controller = createScreenShareController(dependencies);

    await expect(controller.start("https://youtu.be/video")).rejects.toMatchObject({
      code: "VOICE_NOT_CONNECTED",
      statusCode: 409,
    } satisfies Partial<AppError>);
  });

  it("rejects when music owns the shared player", async () => {
    const dependencies = createDependencies();
    dependencies.getPlayerOwner.mockReturnValue("music");
    const controller = createScreenShareController(dependencies);

    await expect(controller.start("https://youtu.be/video")).rejects.toMatchObject({
      code: "MEDIA_BUSY",
      statusCode: 409,
    } satisfies Partial<AppError>);
  });

  it("wraps stream startup failures", async () => {
    const dependencies = createDependencies();
    dependencies.playStream.mockRejectedValue(new Error("go live failed"));
    const controller = createScreenShareController(dependencies);

    await expect(controller.start("https://youtu.be/video")).rejects.toMatchObject({
      code: "SCREEN_STREAM_FAILED",
      statusCode: 500,
    } satisfies Partial<AppError>);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm exec vitest run tests/media/screenShareController.test.ts
```

Expected: FAIL because `src/media/screenShareController.ts` does not exist.

- [ ] **Step 3: Implement ScreenShareController**

Create `src/media/screenShareController.ts`:

```ts
import {
  Encoders,
  playStream as defaultPlayStream,
  prepareStream as defaultPrepareStream,
  Utils,
} from "@dank074/discord-video-stream";
import { AppError } from "../errors";
import { discordPlayer } from "../player";
import type {
  DiscordPlayerOwner,
  ScreenSharePlayback,
} from "./mediaTypes";
import { createYtDlp } from "./ytdlp";

export interface ScreenShareVoiceStatus {
  connected: boolean;
  activeGuildId: string | null;
  activeChannelId: string | null;
}

export interface ScreenShareControllerDependencies {
  getVoiceStatus: () => ScreenShareVoiceStatus;
  getPlayerOwner?: () => DiscordPlayerOwner;
  getDirectVideoUrl?: (source: string) => Promise<string>;
  prepareStream?: typeof defaultPrepareStream;
  playStream?: typeof defaultPlayStream;
  streamer: unknown;
}

export function createScreenShareController(
  dependencies: ScreenShareControllerDependencies,
) {
  let active: ScreenSharePlayback | null = null;
  const ytdlp = createYtDlp();
  const getPlayerOwner =
    dependencies.getPlayerOwner ?? (() => discordPlayer.getOwner());
  const getDirectVideoUrl =
    dependencies.getDirectVideoUrl ?? ((source) => ytdlp.getDirectVideoUrl(source));
  const prepareStream = dependencies.prepareStream ?? defaultPrepareStream;
  const playStream = dependencies.playStream ?? defaultPlayStream;

  return {
    isActive(): boolean {
      return active !== null;
    },

    async start(source: string): Promise<ScreenSharePlayback> {
      const status = dependencies.getVoiceStatus();
      if (!status.connected || !status.activeGuildId || !status.activeChannelId) {
        throw new AppError(
          "Connect to a voice channel before sharing screen",
          "VOICE_NOT_CONNECTED",
          409,
        );
      }

      if (active || getPlayerOwner() !== "none") {
        throw new AppError("Another media mode is active", "MEDIA_BUSY", 409);
      }

      try {
        const directUrl = await getDirectVideoUrl(source);
        const { command, output } = prepareStream(directUrl, {
          encoder: Encoders.software({
            x264: { preset: "superfast" },
          }),
          height: 720,
          fps: 30,
          bitrateVideo: 2500,
          bitrateVideoMax: 4000,
          includeAudio: true,
          videoCodec: Utils.normalizeVideoCodec("H264"),
        });

        let stopped = false;
        const done = playStream(output, dependencies.streamer, {
          type: "go-live",
        }).finally(() => {
          active = null;
        });

        active = {
          done,
          stop() {
            if (stopped) return;
            stopped = true;
            command.kill?.("SIGTERM");
            active = null;
          },
        };
        return active;
      } catch (error) {
        active = null;
        throw new AppError(
          error instanceof Error ? error.message : "Screen stream failed",
          "SCREEN_STREAM_FAILED",
          500,
        );
      }
    },
  };
}
```

- [ ] **Step 4: Run screenshare controller tests**

Run:

```bash
pnpm exec vitest run tests/media/screenShareController.test.ts
```

Expected: PASS. If TypeScript rejects the `streamer: unknown` type, replace it with `streamer: Parameters<typeof defaultPlayStream>[1]` and cast the fake streamer in the test with `as Parameters<typeof playStream>[1]`.

- [ ] **Step 5: Commit Task 6**

Run:

```bash
git add src/media/screenShareController.ts tests/media/screenShareController.test.ts
git commit -m "feat: add youtube screenshare controller"
```

---

### Task 7: Wire Screen Mode into MediaController and Webserver

**Files:**
- Modify: `src/media/mediaController.ts`
- Modify: `src/webserver.ts`
- Modify: `tests/media/mediaController.test.ts`

- [ ] **Step 1: Write failing MediaController screen tests**

In `tests/media/mediaController.test.ts`, update imports:

```ts
import type {
  MusicPlayback,
  MusicPlayer,
  ResolvedMediaSource,
  ScreenShareController,
} from "../../src/media/mediaTypes";
```

Add tests before `emits state changes`:

```ts
it("starts screen share mode without resolving music source", async () => {
  const screenPlayback = deferred();
  const screenController: ScreenShareController = {
    isActive: vi.fn(() => false),
    start: vi.fn(async () => ({ done: screenPlayback.promise, stop: vi.fn() })),
  };
  const resolveMediaSource = vi.fn(async (input) => source(input));
  const controller = new MediaController({
    isVoiceConnected: () => true,
    isBrowserStreaming: () => false,
    resolveMediaSource,
    musicPlayer: { play: vi.fn() },
    screenController,
  });

  const state = await controller.queue("https://youtu.be/video", { mode: "screen" });

  expect(screenController.start).toHaveBeenCalledWith("https://youtu.be/video");
  expect(resolveMediaSource).not.toHaveBeenCalled();
  expect(state).toMatchObject({ playing: true, activeMode: "screen" });
});

it("rejects music while screen share is active", async () => {
  const screenController: ScreenShareController = {
    isActive: vi.fn(() => true),
    start: vi.fn(),
  };
  const controller = new MediaController({
    isVoiceConnected: () => true,
    isBrowserStreaming: () => false,
    resolveMediaSource: async (input) => source(input),
    musicPlayer: { play: vi.fn() },
    screenController,
  });

  await expect(controller.queue("https://example.com/song.mp3")).rejects.toMatchObject({
    code: "MEDIA_BUSY",
    statusCode: 409,
  } satisfies Partial<AppError>);
});
```

- [ ] **Step 2: Run controller tests to verify failure**

Run:

```bash
pnpm exec vitest run tests/media/mediaController.test.ts
```

Expected: FAIL because `screenController` dependency and screen mode are not implemented.

- [ ] **Step 3: Add screen dependency and state to MediaController**

In `src/media/mediaController.ts`, update imports:

```ts
import type {
  MediaMode,
  MediaState,
  MusicPlayback,
  MusicPlayer,
  QueueMediaOptions,
  ResolvedMediaSource,
  ScreenShareController,
  ScreenSharePlayback,
} from "./mediaTypes";
```

Update dependencies:

```ts
export interface MediaControllerDependencies {
  isVoiceConnected?: () => boolean;
  isBrowserStreaming?: () => boolean;
  resolveMediaSource?: (source: string) => Promise<ResolvedMediaSource>;
  musicPlayer?: MusicPlayer;
  screenController?: ScreenShareController;
  onStateChange?: (state: MediaState) => void;
}
```

Add properties:

```ts
private screenPlayback: ScreenSharePlayback | null = null;
private activeMode: MediaMode | null = null;
```

Update `getState`:

```ts
getState(): MediaState {
  const snapshot = this.queueStore.snapshot();
  return {
    playing: this.activeMode === "screen" || snapshot.current?.status === "playing",
    activeMode: this.activeMode ?? snapshot.current?.mode ?? null,
    ...snapshot,
  };
}
```

Replace `queue` with:

```ts
async queue(
  source: string,
  options: QueueMediaOptions = {},
): Promise<MediaState> {
  const mode = options.mode ?? "music";
  if (mode === "screen") {
    return this.startScreen(source);
  }

  this.assertCanStartMusic();
  const resolved = await (
    this.dependencies.resolveMediaSource ?? resolveMediaSource
  )(source);
  this.queueStore.add(resolved, mode, options.requestedBy);
  this.startNextIfIdle();
  return this.emitState();
}
```

Rename `assertCanStart` to `assertCanStartMusic` and add screen busy check:

```ts
private assertCanStartMusic(): void {
  const isVoiceConnected =
    this.dependencies.isVoiceConnected ?? (() => discordPlayer.isConnected());
  if (!isVoiceConnected()) {
    throw new AppError(
      "Connect to a voice channel before playing media",
      "VOICE_NOT_CONNECTED",
      409,
    );
  }

  if (this.screenPlayback || this.dependencies.screenController?.isActive()) {
    throw new AppError("Another media mode is active", "MEDIA_BUSY", 409);
  }

  if (this.dependencies.isBrowserStreaming?.()) {
    throw new AppError(
      "Stop browser microphone streaming before playing media",
      "BROWSER_STREAM_ACTIVE",
      409,
    );
  }
}
```

Add `startScreen`:

```ts
private async startScreen(source: string): Promise<MediaState> {
  if (this.playback || this.queueStore.snapshot().current) {
    throw new AppError("Another media mode is active", "MEDIA_BUSY", 409);
  }
  const screenController = this.dependencies.screenController;
  if (!screenController) {
    throw new AppError("Screen sharing is unavailable", "SCREEN_UNAVAILABLE", 500);
  }

  this.activeMode = "screen";
  try {
    this.screenPlayback = await screenController.start(source);
  } catch (error) {
    this.activeMode = null;
    throw error;
  }

  this.screenPlayback.done.then(
    () => this.finishScreen(),
    () => this.finishScreen(),
  );
  return this.emitState();
}

private finishScreen(): void {
  this.screenPlayback = null;
  if (this.activeMode === "screen") {
    this.activeMode = null;
  }
  this.emitState();
}
```

Update `stop` to stop screen too:

```ts
async stop(): Promise<MediaState> {
  this.playbackToken++;
  this.playback?.stop();
  this.playback = null;
  this.screenPlayback?.stop();
  this.screenPlayback = null;
  this.activeMode = null;
  this.queueStore.clear();
  return this.emitState();
}
```

- [ ] **Step 4: Wire controller in webserver**

In `src/webserver.ts`, add imports:

```ts
import { Streamer } from "@dank074/discord-video-stream";
import { createScreenShareController } from "./media/screenShareController";
```

Before `const mediaController = new MediaController({`, add:

```ts
const streamer = new Streamer(_client);
const screenController = createScreenShareController({
  getVoiceStatus: () => voiceController.getStatus(),
  streamer,
});
```

Update MediaController dependencies:

```ts
const mediaController = new MediaController({
  isVoiceConnected: () => voiceController.getStatus().connected,
  isBrowserStreaming: () => sharedUIState.isStreaming,
  screenController,
  onStateChange: (state) => broadcaster.mediaState(state),
});
```

- [ ] **Step 5: Run controller tests and typecheck**

Run:

```bash
pnpm exec vitest run tests/media/mediaController.test.ts
pnpm run typecheck
```

Expected: both PASS.

- [ ] **Step 6: Commit Task 7**

Run:

```bash
git add src/media/mediaController.ts src/webserver.ts tests/media/mediaController.test.ts
git commit -m "feat: wire screen mode into media controller"
```

---

### Task 8: Final Verification

**Files:**
- All changed implementation and test files.

- [ ] **Step 1: Run focused media tests**

Run:

```bash
pnpm exec vitest run tests/player.test.ts tests/media/musicPlayer.test.ts tests/media/mediaController.test.ts tests/routes/mediaRoutes.test.ts tests/media/ytdlp.test.ts tests/media/screenShareController.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run:

```bash
pnpm run test
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```bash
pnpm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Run lint**

Run:

```bash
pnpm run lint
```

Expected: PASS.

- [ ] **Step 5: Check git status**

Run:

```bash
git status --short
```

Expected: clean or only intentional uncommitted planning/spec files if the user requested no commits.

- [ ] **Step 6: Report result**

Report exact verification commands and outcomes. Do not claim completion unless all commands above pass.
