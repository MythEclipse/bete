# Media Music Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add audio-only media queue playback so the dashboard can queue, play, skip, and stop music in the currently connected Discord voice channel.

**Architecture:** Add a focused `src/media/` subsystem with pure queue/resolver units, an ffmpeg-backed music player, and a controller that owns playback state. Keep `VoiceController` as the only voice join/leave path; media playback requires an existing voice connection and uses `DiscordPlayer` for Ogg Opus output.

**Tech Stack:** TypeScript, Express, Vitest, Node `child_process`, Node streams, existing `DiscordPlayer`, ffmpeg producing Ogg Opus.

---

## File Structure

- Create `src/media/mediaTypes.ts` — shared media mode, queue item, resolved source, state, and dependency types.
- Create `src/media/mediaQueue.ts` — pure in-memory queue operations.
- Create `src/media/mediaResolver.ts` — resolve and validate HTTP(S) URLs and existing local file paths.
- Create `src/media/musicPlayer.ts` — spawn ffmpeg and pipe Ogg Opus into `DiscordPlayer`.
- Create `src/media/mediaController.ts` — coordinate queue, playback, skip, stop, and state snapshots.
- Create `src/routes/mediaRoutes.ts` — REST endpoints for media status, queue, skip, stop.
- Modify `src/player.ts` — expose a minimal `isConnected()` helper for media preflight.
- Modify `src/webserver.ts` — create `MediaController`, mount media routes, broadcast media state over WebSocket.
- Modify `public/index.html` — add compact Media controls to the voice tab.
- Tests:
  - `tests/media/mediaQueue.test.ts`
  - `tests/media/mediaResolver.test.ts`
  - `tests/media/musicPlayer.test.ts`
  - `tests/media/mediaController.test.ts`
  - `tests/routes/mediaRoutes.test.ts`

---

### Task 1: Media Types and Queue

**Files:**
- Create: `src/media/mediaTypes.ts`
- Create: `src/media/mediaQueue.ts`
- Test: `tests/media/mediaQueue.test.ts`

- [ ] **Step 1: Write the failing queue tests**

Create `tests/media/mediaQueue.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MediaQueue } from "../../src/media/mediaQueue";
import type { ResolvedMediaSource } from "../../src/media/mediaTypes";

function source(overrides: Partial<ResolvedMediaSource> = {}): ResolvedMediaSource {
  return {
    source: "https://example.com/audio.ogg",
    title: "audio.ogg",
    kind: "url",
    ...overrides,
  };
}

describe("MediaQueue", () => {
  it("adds items with stable queue metadata", () => {
    const queue = new MediaQueue(() => "item-1", () => 1700000000000);

    const item = queue.add(source(), "tester");

    expect(item).toMatchObject({
      id: "item-1",
      mode: "music",
      source: "https://example.com/audio.ogg",
      title: "audio.ogg",
      kind: "url",
      requestedBy: "tester",
      addedAt: 1700000000000,
      status: "queued",
    });
    expect(queue.snapshot()).toEqual({ current: null, queue: [item] });
  });

  it("marks the next queued item as playing", () => {
    const queue = new MediaQueue(() => "item-1", () => 1700000000000);
    const item = queue.add(source(), "tester");

    expect(queue.startNext()).toEqual({ ...item, status: "playing" });
    expect(queue.snapshot()).toEqual({
      current: { ...item, status: "playing" },
      queue: [],
    });
  });

  it("removes current item and starts following item", () => {
    let id = 0;
    const queue = new MediaQueue(() => `item-${++id}`, () => 1700000000000);
    queue.add(source({ title: "first" }), "tester");
    queue.add(source({ title: "second" }), "tester");
    queue.startNext();

    queue.completeCurrent();
    const next = queue.startNext();

    expect(next?.title).toBe("second");
    expect(queue.snapshot().queue).toEqual([]);
  });

  it("clears current and queued items", () => {
    const queue = new MediaQueue(() => "item-1", () => 1700000000000);
    queue.add(source(), "tester");
    queue.startNext();

    queue.clear();

    expect(queue.snapshot()).toEqual({ current: null, queue: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm -C /mnt/code/bete vitest run tests/media/mediaQueue.test.ts
```

Expected: FAIL because `src/media/mediaQueue.ts` does not exist.

- [ ] **Step 3: Create media types**

Create `src/media/mediaTypes.ts`:

```ts
import type { Readable } from "node:stream";

export type MediaMode = "music" | "screen";
export type MediaSourceKind = "url" | "local";
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

export interface DiscordAudioPlayer {
  isConnected(): boolean;
  playStream(stream: Readable): void;
  stop(): void;
}
```

- [ ] **Step 4: Implement queue**

Create `src/media/mediaQueue.ts`:

```ts
import type {
  MediaQueueItem,
  MediaState,
  ResolvedMediaSource,
} from "./mediaTypes";

export class MediaQueue {
  private current: MediaQueueItem | null = null;
  private readonly items: MediaQueueItem[] = [];

  constructor(
    private readonly createId = () => crypto.randomUUID(),
    private readonly now = () => Date.now(),
  ) {}

  add(source: ResolvedMediaSource, requestedBy = "dashboard"): MediaQueueItem {
    const item: MediaQueueItem = {
      id: this.createId(),
      mode: "music",
      requestedBy,
      addedAt: this.now(),
      status: "queued",
      ...source,
    };
    this.items.push(item);
    return { ...item };
  }

  startNext(): MediaQueueItem | null {
    if (this.current) return { ...this.current };
    const next = this.items.shift();
    if (!next) return null;
    this.current = { ...next, status: "playing" };
    return { ...this.current };
  }

  completeCurrent(): void {
    this.current = null;
  }

  failCurrent(): void {
    if (this.current) {
      this.current = { ...this.current, status: "failed" };
    }
    this.current = null;
  }

  clear(): void {
    this.current = null;
    this.items.length = 0;
  }

  snapshot(): Pick<MediaState, "current" | "queue"> {
    return {
      current: this.current ? { ...this.current } : null,
      queue: this.items.map((item) => ({ ...item })),
    };
  }
}
```

- [ ] **Step 5: Run queue test to verify it passes**

Run:

```bash
pnpm -C /mnt/code/bete vitest run tests/media/mediaQueue.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit task 1**

```bash
git -C /mnt/code/bete add src/media/mediaTypes.ts src/media/mediaQueue.ts tests/media/mediaQueue.test.ts
git -C /mnt/code/bete commit -m "feat: add media queue foundation"
```

---

### Task 2: Media Resolver

**Files:**
- Create: `src/media/mediaResolver.ts`
- Test: `tests/media/mediaResolver.test.ts`

- [ ] **Step 1: Write failing resolver tests**

Create `tests/media/mediaResolver.test.ts`:

```ts
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AppError } from "../../src/errors";
import { resolveMediaSource } from "../../src/media/mediaResolver";

describe("resolveMediaSource", () => {
  it("accepts http URLs", async () => {
    await expect(resolveMediaSource("https://example.com/music.mp3")).resolves.toEqual({
      source: "https://example.com/music.mp3",
      title: "music.mp3",
      kind: "url",
    });
  });

  it("accepts existing local files", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "media-resolver-"));
    const file = path.join(dir, "song.ogg");
    writeFileSync(file, "audio");

    await expect(resolveMediaSource(file)).resolves.toEqual({
      source: file,
      title: "song.ogg",
      kind: "local",
    });
  });

  it("rejects empty sources", async () => {
    await expect(resolveMediaSource("   ")).rejects.toMatchObject({
      code: "MISSING_MEDIA_SOURCE",
      statusCode: 400,
    } satisfies Partial<AppError>);
  });

  it("rejects unsupported sources", async () => {
    await expect(resolveMediaSource("not a url or file")).rejects.toMatchObject({
      code: "UNSUPPORTED_MEDIA_SOURCE",
      statusCode: 400,
    } satisfies Partial<AppError>);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm -C /mnt/code/bete vitest run tests/media/mediaResolver.test.ts
```

Expected: FAIL because `src/media/mediaResolver.ts` does not exist.

- [ ] **Step 3: Implement resolver**

Create `src/media/mediaResolver.ts`:

```ts
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { AppError } from "../errors";
import type { ResolvedMediaSource } from "./mediaTypes";

export async function resolveMediaSource(
  input: string,
): Promise<ResolvedMediaSource> {
  const source = input.trim();
  if (!source) {
    throw new AppError("Media source is required", "MISSING_MEDIA_SOURCE", 400);
  }

  if (source.startsWith("http://") || source.startsWith("https://")) {
    return {
      source,
      title: titleFromUrl(source),
      kind: "url",
    };
  }

  if (existsSync(source) && statSync(source).isFile()) {
    return {
      source,
      title: path.basename(source),
      kind: "local",
    };
  }

  throw new AppError(
    "Media source must be an HTTP(S) URL or existing local file",
    "UNSUPPORTED_MEDIA_SOURCE",
    400,
  );
}

function titleFromUrl(source: string): string {
  const url = new URL(source);
  const filename = decodeURIComponent(url.pathname.split("/").pop() || "");
  return filename || url.hostname;
}
```

- [ ] **Step 4: Run resolver test to verify it passes**

Run:

```bash
pnpm -C /mnt/code/bete vitest run tests/media/mediaResolver.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit task 2**

```bash
git -C /mnt/code/bete add src/media/mediaResolver.ts tests/media/mediaResolver.test.ts
git -C /mnt/code/bete commit -m "feat: resolve media music sources"
```

---

### Task 3: Music Player and DiscordPlayer Connection State

**Files:**
- Modify: `src/player.ts:11-55`
- Create: `src/media/musicPlayer.ts`
- Test: `tests/media/musicPlayer.test.ts`

- [ ] **Step 1: Write failing music player tests**

Create `tests/media/musicPlayer.test.ts`:

```ts
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { createMusicPlayer } from "../../src/media/musicPlayer";
import type { DiscordAudioPlayer } from "../../src/media/mediaTypes";

class FakeProcess extends EventEmitter {
  stdout = new PassThrough();
  stderr = new PassThrough();
  killed = false;
  kill = vi.fn(() => {
    this.killed = true;
    this.emit("close", 0);
    return true;
  });
}

describe("createMusicPlayer", () => {
  it("spawns ffmpeg as Ogg Opus and passes stdout to Discord", async () => {
    const proc = new FakeProcess();
    const spawn = vi.fn(() => proc);
    const discordPlayer: DiscordAudioPlayer = {
      isConnected: () => true,
      playStream: vi.fn(),
      stop: vi.fn(),
    };
    const player = createMusicPlayer({ spawn, discordPlayer });

    const playback = player.play({
      source: "https://example.com/song.mp3",
      title: "song.mp3",
      kind: "url",
    });
    proc.emit("close", 0);
    await playback.done;

    expect(spawn).toHaveBeenCalledWith("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "warning",
      "-i",
      "https://example.com/song.mp3",
      "-vn",
      "-acodec",
      "libopus",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-f",
      "ogg",
      "pipe:1",
    ], { stdio: ["ignore", "pipe", "pipe"] });
    expect(discordPlayer.playStream).toHaveBeenCalledWith(proc.stdout);
  });

  it("kills ffmpeg and stops Discord playback", () => {
    const proc = new FakeProcess();
    const discordPlayer: DiscordAudioPlayer = {
      isConnected: () => true,
      playStream: vi.fn(),
      stop: vi.fn(),
    };
    const player = createMusicPlayer({ spawn: vi.fn(() => proc), discordPlayer });

    const playback = player.play({ source: "/tmp/song.ogg", title: "song.ogg", kind: "local" });
    playback.stop();

    expect(proc.kill).toHaveBeenCalledWith("SIGTERM");
    expect(discordPlayer.stop).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm -C /mnt/code/bete vitest run tests/media/musicPlayer.test.ts
```

Expected: FAIL because `src/media/musicPlayer.ts` does not exist.

- [ ] **Step 3: Add connection helper to DiscordPlayer**

Modify `src/player.ts` by adding this method after `setConnection()`:

```ts
  public isConnected(): boolean {
    return this.connection !== null;
  }
```

- [ ] **Step 4: Implement music player**

Create `src/media/musicPlayer.ts`:

```ts
import { spawn as nodeSpawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { discordPlayer } from "../player";
import type {
  DiscordAudioPlayer,
  MusicPlayback,
  MusicPlayer,
  ResolvedMediaSource,
} from "./mediaTypes";

export interface MusicPlayerDependencies {
  spawn?: typeof nodeSpawn;
  discordPlayer?: DiscordAudioPlayer;
}

export function createMusicPlayer(
  dependencies: MusicPlayerDependencies = {},
): MusicPlayer {
  const spawn = dependencies.spawn ?? nodeSpawn;
  const audioPlayer = dependencies.discordPlayer ?? discordPlayer;

  return {
    play(source: ResolvedMediaSource): MusicPlayback {
      const proc = spawn("ffmpeg", buildFfmpegArgs(source.source), {
        stdio: ["ignore", "pipe", "pipe"],
      }) as ChildProcessWithoutNullStreams;

      audioPlayer.playStream(proc.stdout);

      const done = new Promise<void>((resolve, reject) => {
        proc.on("error", reject);
        proc.on("close", (code) => {
          if (code === 0) {
            resolve();
            return;
          }
          reject(new Error(`ffmpeg exited with code ${code}`));
        });
      });

      return {
        done,
        stop() {
          proc.kill("SIGTERM");
          audioPlayer.stop();
        },
      };
    },
  };
}

export function buildFfmpegArgs(source: string): string[] {
  return [
    "-hide_banner",
    "-loglevel",
    "warning",
    "-i",
    source,
    "-vn",
    "-acodec",
    "libopus",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-f",
    "ogg",
    "pipe:1",
  ];
}
```

- [ ] **Step 5: Run music player test to verify it passes**

Run:

```bash
pnpm -C /mnt/code/bete vitest run tests/media/musicPlayer.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit task 3**

```bash
git -C /mnt/code/bete add src/player.ts src/media/musicPlayer.ts tests/media/musicPlayer.test.ts
git -C /mnt/code/bete commit -m "feat: add ffmpeg music player"
```

---

### Task 4: Media Controller

**Files:**
- Create: `src/media/mediaController.ts`
- Test: `tests/media/mediaController.test.ts`

- [ ] **Step 1: Write failing controller tests**

Create `tests/media/mediaController.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { AppError } from "../../src/errors";
import { MediaController } from "../../src/media/mediaController";
import type { MusicPlayback, MusicPlayer, ResolvedMediaSource } from "../../src/media/mediaTypes";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function source(input: string): ResolvedMediaSource {
  return { source: input, title: input.split("/").pop() || input, kind: "url" };
}

describe("MediaController", () => {
  it("rejects queue playback when voice is not connected", async () => {
    const controller = new MediaController({
      isVoiceConnected: () => false,
      isBrowserStreaming: () => false,
      resolveMediaSource: async () => source("https://example.com/song.mp3"),
      musicPlayer: { play: vi.fn() },
    });

    await expect(controller.queue("https://example.com/song.mp3")).rejects.toMatchObject({
      code: "VOICE_NOT_CONNECTED",
      statusCode: 409,
    } satisfies Partial<AppError>);
  });

  it("queues and starts the first item", async () => {
    const done = deferred();
    const playback: MusicPlayback = { done: done.promise, stop: vi.fn() };
    const musicPlayer: MusicPlayer = { play: vi.fn(() => playback) };
    const controller = new MediaController({
      isVoiceConnected: () => true,
      isBrowserStreaming: () => false,
      resolveMediaSource: async () => source("https://example.com/song.mp3"),
      musicPlayer,
    });

    const state = await controller.queue("https://example.com/song.mp3");

    expect(state.playing).toBe(true);
    expect(state.current?.title).toBe("song.mp3");
    expect(musicPlayer.play).toHaveBeenCalledWith(state.current);
  });

  it("advances to the next item when playback finishes", async () => {
    const first = deferred();
    const second = deferred();
    const musicPlayer: MusicPlayer = {
      play: vi
        .fn()
        .mockReturnValueOnce({ done: first.promise, stop: vi.fn() })
        .mockReturnValueOnce({ done: second.promise, stop: vi.fn() }),
    };
    const controller = new MediaController({
      isVoiceConnected: () => true,
      isBrowserStreaming: () => false,
      resolveMediaSource: async (input) => source(input),
      musicPlayer,
    });

    await controller.queue("https://example.com/first.mp3");
    await controller.queue("https://example.com/second.mp3");
    first.resolve();
    await new Promise((resolve) => setImmediate(resolve));

    expect(controller.getState().current?.title).toBe("second.mp3");
  });

  it("stops current playback and clears the queue", async () => {
    const stop = vi.fn();
    const controller = new MediaController({
      isVoiceConnected: () => true,
      isBrowserStreaming: () => false,
      resolveMediaSource: async (input) => source(input),
      musicPlayer: { play: vi.fn(() => ({ done: new Promise(() => {}), stop })) },
    });
    await controller.queue("https://example.com/song.mp3");

    const state = await controller.stop();

    expect(stop).toHaveBeenCalled();
    expect(state).toEqual({ playing: false, current: null, queue: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm -C /mnt/code/bete vitest run tests/media/mediaController.test.ts
```

Expected: FAIL because `src/media/mediaController.ts` does not exist.

- [ ] **Step 3: Implement controller**

Create `src/media/mediaController.ts`:

```ts
import { AppError } from "../errors";
import { discordPlayer } from "../player";
import { MediaQueue } from "./mediaQueue";
import { resolveMediaSource } from "./mediaResolver";
import { createMusicPlayer } from "./musicPlayer";
import type {
  MediaState,
  MusicPlayback,
  MusicPlayer,
  ResolvedMediaSource,
} from "./mediaTypes";

export interface MediaControllerDependencies {
  isVoiceConnected?: () => boolean;
  isBrowserStreaming?: () => boolean;
  resolveMediaSource?: (source: string) => Promise<ResolvedMediaSource>;
  musicPlayer?: MusicPlayer;
  onStateChange?: (state: MediaState) => void;
}

export class MediaController {
  private readonly queueStore = new MediaQueue();
  private playback: MusicPlayback | null = null;
  private skipInProgress = false;

  constructor(private readonly dependencies: MediaControllerDependencies = {}) {}

  getState(): MediaState {
    const snapshot = this.queueStore.snapshot();
    return {
      playing: snapshot.current?.status === "playing",
      ...snapshot,
    };
  }

  async queue(source: string): Promise<MediaState> {
    this.assertCanStart();
    const resolved = await (this.dependencies.resolveMediaSource ?? resolveMediaSource)(
      source,
    );
    this.queueStore.add(resolved);
    this.startNextIfIdle();
    return this.emitState();
  }

  async skip(): Promise<MediaState> {
    if (this.skipInProgress) {
      throw new AppError("Skip already in progress", "MEDIA_SKIP_IN_PROGRESS", 409);
    }

    this.skipInProgress = true;
    try {
      this.playback?.stop();
      this.playback = null;
      this.queueStore.completeCurrent();
      this.startNextIfIdle();
      return this.emitState();
    } finally {
      this.skipInProgress = false;
    }
  }

  async stop(): Promise<MediaState> {
    this.playback?.stop();
    this.playback = null;
    this.queueStore.clear();
    return this.emitState();
  }

  private assertCanStart(): void {
    const isVoiceConnected = this.dependencies.isVoiceConnected ??
      (() => discordPlayer.isConnected());
    if (!isVoiceConnected()) {
      throw new AppError(
        "Connect to a voice channel before playing media",
        "VOICE_NOT_CONNECTED",
        409,
      );
    }

    if (this.dependencies.isBrowserStreaming?.()) {
      throw new AppError(
        "Stop browser microphone streaming before playing media",
        "BROWSER_STREAM_ACTIVE",
        409,
      );
    }
  }

  private startNextIfIdle(): void {
    if (this.playback) return;
    const item = this.queueStore.startNext();
    if (!item) return;

    const player = this.dependencies.musicPlayer ?? createMusicPlayer();
    this.playback = player.play(item);
    this.playback.done.then(
      () => this.finishCurrent(false),
      () => this.finishCurrent(true),
    );
  }

  private finishCurrent(failed: boolean): void {
    this.playback = null;
    if (failed) {
      this.queueStore.failCurrent();
    } else {
      this.queueStore.completeCurrent();
    }
    this.startNextIfIdle();
    this.emitState();
  }

  private emitState(): MediaState {
    const state = this.getState();
    this.dependencies.onStateChange?.(state);
    return state;
  }
}
```

- [ ] **Step 4: Run controller tests to verify they pass**

Run:

```bash
pnpm -C /mnt/code/bete vitest run tests/media/mediaController.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit task 4**

```bash
git -C /mnt/code/bete add src/media/mediaController.ts tests/media/mediaController.test.ts
git -C /mnt/code/bete commit -m "feat: coordinate media playback state"
```

---

### Task 5: Media Routes

**Files:**
- Create: `src/routes/mediaRoutes.ts`
- Test: `tests/routes/mediaRoutes.test.ts`

- [ ] **Step 1: Write failing route tests**

Create `tests/routes/mediaRoutes.test.ts`:

```ts
import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { createMediaRoutes } from "../../src/routes/mediaRoutes";

function getHandler(router: ReturnType<typeof createMediaRoutes>, path: string, method: string) {
  const layer = router.stack.find((item) => item.route?.path === path);
  return layer?.route?.stack.find((item) => item.method === method)?.handle;
}

describe("createMediaRoutes", () => {
  it("returns media status", async () => {
    const controller = {
      getState: vi.fn(() => ({ playing: false, current: null, queue: [] })),
      queue: vi.fn(),
      skip: vi.fn(),
      stop: vi.fn(),
    };
    const handler = getHandler(createMediaRoutes(controller), "/media/status", "get");
    const json = vi.fn();

    await handler?.({} as Request, { json } as unknown as Response, vi.fn());

    expect(json).toHaveBeenCalledWith({ playing: false, current: null, queue: [] });
  });

  it("queues a source", async () => {
    const state = { playing: true, current: null, queue: [] };
    const controller = {
      getState: vi.fn(),
      queue: vi.fn(async () => state),
      skip: vi.fn(),
      stop: vi.fn(),
    };
    const handler = getHandler(createMediaRoutes(controller), "/media/queue", "post");
    const json = vi.fn();

    await handler?.(
      { body: { source: "https://example.com/song.mp3" } } as Request,
      { json } as unknown as Response,
      vi.fn(),
    );

    expect(controller.queue).toHaveBeenCalledWith("https://example.com/song.mp3");
    expect(json).toHaveBeenCalledWith(state);
  });

  it("passes missing source errors to Express", async () => {
    const controller = {
      getState: vi.fn(),
      queue: vi.fn(),
      skip: vi.fn(),
      stop: vi.fn(),
    };
    const handler = getHandler(createMediaRoutes(controller), "/media/queue", "post");
    const next = vi.fn();

    await handler?.(
      { body: {} } as Request,
      { json: vi.fn() } as unknown as Response,
      next,
    );

    expect(next.mock.calls[0][0]).toMatchObject({
      code: "MISSING_MEDIA_SOURCE",
      statusCode: 400,
    });
  });
});
```

- [ ] **Step 2: Run route test to verify it fails**

Run:

```bash
pnpm -C /mnt/code/bete vitest run tests/routes/mediaRoutes.test.ts
```

Expected: FAIL because `src/routes/mediaRoutes.ts` does not exist.

- [ ] **Step 3: Implement media routes**

Create `src/routes/mediaRoutes.ts`:

```ts
import type { Router } from "express";
import express from "express";
import { AppError } from "../errors";
import type { MediaController } from "../media/mediaController";

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
      const { source } = req.body as { source?: string };
      if (!source) {
        throw new AppError("Media source is required", "MISSING_MEDIA_SOURCE", 400);
      }
      res.json(await controller.queue(source));
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
```

- [ ] **Step 4: Run route test to verify it passes**

Run:

```bash
pnpm -C /mnt/code/bete vitest run tests/routes/mediaRoutes.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit task 5**

```bash
git -C /mnt/code/bete add src/routes/mediaRoutes.ts tests/routes/mediaRoutes.test.ts
git -C /mnt/code/bete commit -m "feat: expose media playback routes"
```

---

### Task 6: Webserver Wiring and WebSocket State

**Files:**
- Modify: `src/webserver.ts:12-236`
- Test: `tests/routes/mediaRoutes.test.ts` or new `tests/media/mediaController.test.ts` assertion if needed

- [ ] **Step 1: Add media state broadcast test to controller tests**

Append to `tests/media/mediaController.test.ts`:

```ts
  it("emits state changes", async () => {
    const onStateChange = vi.fn();
    const controller = new MediaController({
      isVoiceConnected: () => true,
      isBrowserStreaming: () => false,
      resolveMediaSource: async (input) => source(input),
      musicPlayer: { play: vi.fn(() => ({ done: new Promise(() => {}), stop: vi.fn() })) },
      onStateChange,
    });

    await controller.queue("https://example.com/song.mp3");

    expect(onStateChange).toHaveBeenCalledWith(
      expect.objectContaining({ playing: true }),
    );
  });
```

- [ ] **Step 2: Run test to verify behavior passes before wiring**

Run:

```bash
pnpm -C /mnt/code/bete vitest run tests/media/mediaController.test.ts
```

Expected: PASS if Task 4 already emits state; if it fails, fix `emitState()` before webserver wiring.

- [ ] **Step 3: Wire media controller into webserver**

Modify `src/webserver.ts` imports:

```ts
import { MediaController } from "./media/mediaController";
import { createMediaRoutes } from "./routes/mediaRoutes";
```

After broadcaster creation at line 160, add:

```ts
  const mediaController = new MediaController({
    isVoiceConnected: () => voiceController.getStatus().connected,
    isBrowserStreaming: () => sharedUIState.isStreaming,
    onStateChange: (state) => broadcaster.sendJson?.({
      type: "media_state",
      state,
      timestamp: Date.now(),
    }),
  });
```

If `ModerationBroadcaster` does not expose `sendJson`, add a typed method in `src/moderation/broadcaster.ts` instead:

```ts
mediaState(state: MediaState): void;
```

and implement it with the same broadcast pattern used for `uiState`.

Mount routes after `createSyncRoutes(_client)`:

```ts
  app.use("/api", createMediaRoutes(mediaController));
```

Inside the WebSocket connection setup after sending `ui_state`, send current media state:

```ts
    ws.send(JSON.stringify({ type: "media_state", state: mediaController.getState() }));
```

- [ ] **Step 4: Run typecheck**

Run:

```bash
pnpm -C /mnt/code/bete run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit task 6**

```bash
git -C /mnt/code/bete add src/webserver.ts src/moderation/broadcaster.ts src/moderation/types.ts tests/media/mediaController.test.ts
git -C /mnt/code/bete commit -m "feat: wire media playback into webserver"
```

Only include `src/moderation/broadcaster.ts` and `src/moderation/types.ts` if the broadcaster method was required.

---

### Task 7: Dashboard Media Controls

**Files:**
- Modify: `public/index.html:32-164`

- [ ] **Step 1: Add static Media card markup**

In `public/index.html`, inside `<div class="voice-layout">` after the Live Audio card, add:

```html
        <div class="content-card">
          <div class="card-title"><h2>Media</h2><span class="mini" id="mediaStatus">Idle</span></div>
          <div class="field-group"><label for="mediaSourceInput">Music URL / file path</label><input id="mediaSourceInput" type="text" placeholder="https://example.com/song.mp3"></div>
          <div class="button-row"><button id="queueMediaBtn" class="btn btn-primary">Queue / Play</button><button id="skipMediaBtn" class="btn btn-success">Skip</button><button id="stopMediaBtn" class="btn btn-danger">Stop</button></div>
          <div id="mediaQueueList" class="feed"><div class="empty">No media queued</div></div>
        </div>
```

- [ ] **Step 2: Add media state and element references**

In the `state` object add:

```js
      media: { playing: false, current: null, queue: [] },
```

In the `el` object add references:

```js
mediaSourceInput: document.getElementById('mediaSourceInput'), mediaStatus: document.getElementById('mediaStatus'), queueMediaBtn: document.getElementById('queueMediaBtn'), skipMediaBtn: document.getElementById('skipMediaBtn'), stopMediaBtn: document.getElementById('stopMediaBtn'), mediaQueueList: document.getElementById('mediaQueueList')
```

- [ ] **Step 3: Handle media WebSocket events**

In `handleJsonEvent(raw)`, add:

```js
if (message.type === 'media_state') { state.media = message.state; renderMedia(); }
```

- [ ] **Step 4: Add media functions**

Before event listener registration, add:

```js
    async function fetchMediaStatus() { state.media = await apiRequest('/api/media/status'); renderMedia(); }
    async function queueMedia() { const source = el.mediaSourceInput.value.trim(); if (!source) return showError('Enter a music URL or local file path'); state.media = await apiRequest('/api/media/queue', { method: 'POST', body: JSON.stringify({ source }) }); el.mediaSourceInput.value = ''; renderMedia(); }
    async function skipMedia() { state.media = await apiRequest('/api/media/skip', { method: 'POST' }); renderMedia(); }
    async function stopMedia() { state.media = await apiRequest('/api/media/stop', { method: 'POST' }); renderMedia(); }
    function renderMedia() { el.mediaQueueList.replaceChildren(); const current = state.media.current; el.mediaStatus.textContent = current ? `Playing ${current.title}` : 'Idle'; if (current) { const item = document.createElement('div'); item.className = 'event-card'; item.textContent = `Now: ${current.title}`; el.mediaQueueList.appendChild(item); } for (const queued of state.media.queue || []) { const item = document.createElement('div'); item.className = 'event-card'; item.textContent = queued.title; el.mediaQueueList.appendChild(item); } if (!current && (!state.media.queue || state.media.queue.length === 0)) appendEmpty(el.mediaQueueList, 'No media queued'); }
```

- [ ] **Step 5: Add media event listeners and init fetch**

Add listeners:

```js
    el.queueMediaBtn.addEventListener('click', () => queueMedia().catch((error) => showError(error.message)));
    el.skipMediaBtn.addEventListener('click', () => skipMedia().catch((error) => showError(error.message)));
    el.stopMediaBtn.addEventListener('click', () => stopMedia().catch((error) => showError(error.message)));
```

Change init chain from:

```js
apiRequest('/api/ui-state').then(applyServerState).then(() => loadGuilds()).then(refreshStatus).catch((error) => showError(error.message));
```

to:

```js
apiRequest('/api/ui-state').then(applyServerState).then(() => loadGuilds()).then(refreshStatus).then(fetchMediaStatus).catch((error) => showError(error.message));
```

- [ ] **Step 6: Run lint**

Run:

```bash
pnpm -C /mnt/code/bete run lint
```

Expected: PASS.

- [ ] **Step 7: Commit task 7**

```bash
git -C /mnt/code/bete add public/index.html
git -C /mnt/code/bete commit -m "feat: add dashboard media controls"
```

---

### Task 8: Full Verification

**Files:**
- No new files unless tests reveal a defect.

- [ ] **Step 1: Run full tests**

```bash
pnpm -C /mnt/code/bete run test
```

Expected: all tests pass.

- [ ] **Step 2: Run typecheck**

```bash
pnpm -C /mnt/code/bete run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run lint**

```bash
pnpm -C /mnt/code/bete run lint
```

Expected: PASS.

- [ ] **Step 4: Manual UI verification**

Run the app with a real Discord token/environment:

```bash
pnpm -C /mnt/code/bete run dev
```

Manual checks:

1. Open `http://localhost:3000/`.
2. Connect to a voice channel from the Voice card.
3. Queue a short local audio file path or direct HTTP(S) audio URL.
4. Confirm audio plays in Discord.
5. Queue a second item and confirm it advances.
6. Click Skip and confirm current playback stops.
7. Click Stop and confirm queue clears.
8. Confirm browser microphone transmit returns `BROWSER_STREAM_ACTIVE` if active during media queue.

- [ ] **Step 5: Commit any verification fixes**

If fixes were required:

```bash
git -C /mnt/code/bete add <changed-files>
git -C /mnt/code/bete commit -m "fix: stabilize media music playback"
```

If no fixes were required, do not create an empty commit.

---

## Self-Review

Spec coverage:

- Queue foundation: Task 1.
- Source resolution: Task 2.
- ffmpeg Ogg Opus playback: Task 3.
- Voice-connected preflight, browser stream conflict, skip/stop/advance: Task 4.
- REST API: Task 5.
- WebSocket state and webserver integration: Task 6.
- Dashboard controls: Task 7.
- Full and manual verification: Task 8.
- Phase 2 compatibility: `MediaMode` includes `screen`, but no `Streamer` is instantiated in phase 1.

Placeholder scan: no `TBD`, incomplete steps, or unspecified tests remain.

Type consistency: `MediaState`, `MediaQueueItem`, `ResolvedMediaSource`, `MusicPlayer`, and route/controller method names are consistent across tasks.
