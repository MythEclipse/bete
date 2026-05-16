# Internal Streamer Replacement Design

## Summary
Replace the external `@dank074/discord-video-stream` dependency with an internal streaming module that uses `discord.js-selfbot-v13` private APIs to deliver the same screen share behavior (video + audio) with identical UI/API surface.

## Goals
- Maintain feature parity for screen share (video + audio, 720p @ 30fps, bitrate 2500/4000, H264, audio on).
- Keep existing UI and API contracts unchanged (`/api/media/queue` with `mode: "screen"`).
- Remove `@dank074/discord-video-stream` from dependencies and delete `vendor/Discord-video-stream`.
- Ensure clean lifecycle handling (start/stop, cleanup, error reporting).

## Non-Goals
- Rewriting WebRTC/RTP stack from scratch.
- Changing media queue behavior or UI layout.
- Adding new screen share modes or settings.

## Architecture Overview
Introduce a new internal module under `src/streaming/` that encapsulates:
- Voice/session management using private `discord.js-selfbot-v13` APIs.
- FFmpeg preparation for H264 + Opus (AnnexB video + Opus audio).
- Stream playback into the internal dispatcher.

`screenShareController` will depend on this module instead of `@dank074/discord-video-stream`.

## Components

### 1) Streaming Session Module (`src/streaming/`)
Proposed exports:
- `createStreamSession(client)`
  - Joins or reuses voice connection for video streaming.
  - Exposes a `session` object with `startVideo()`, `stopVideo()`, and `sendStream(stream)` hooks.
- `prepareFfmpegStream(source, opts)`
  - Spawns ffmpeg with the same parameters used today.
  - Returns `{ command, output }` (output is a Readable stream).
- `playPreparedStream(output, session)`
  - Pipes the prepared stream into the internal dispatcher.
  - Returns a promise that resolves when playback completes.

### 2) Screen Share Controller (`src/media/screenShareController.ts`)
- Replace Streamer/prepareStream/playStream with internal module usage.
- Keep the public API identical (`start(source)` returning `ScreenSharePlayback`).

### 3) Web Server Wiring (`src/webserver.ts`)
- Remove `Streamer` instantiation and dependencies.
- Pass only `getVoiceStatus` and new streaming module dependencies into `createScreenShareController`.

## Data Flow
1. User queues screen share via `/api/media/queue` with `mode: "screen"`.
2. `MediaController` calls `screenShareController.start(source)`.
3. `screenShareController` resolves URL, calls `prepareFfmpegStream`.
4. `createStreamSession` ensures voice connection and dispatcher ready.
5. `playPreparedStream` sends output to Discord.
6. On completion or stop, cleanup runs and state updates propagate.

## Error Handling
- Voice not connected: throw `VOICE_NOT_CONNECTED`.
- FFmpeg spawn/exit failure: throw `SCREEN_STREAM_FAILED`.
- Dispatcher error: stop stream, cleanup, log error, set state idle.

## Lifecycle Rules
- `start()` always stops any active stream first.
- `stop()` kills ffmpeg, stops dispatcher, and resets internal state.
- Completion resolves `done` promise and triggers cleanup.

## Testing Strategy
- Unit tests for `screenShareController`:
  - Calls to `prepareFfmpegStream` and `playPreparedStream` on `start()`.
  - Ensures `stop()` kills ffmpeg and ends session.
- Unit tests for `streaming` module:
  - Session initialization and cleanup logic with mocked private APIs.

## Migration Steps
1. Implement `src/streaming/` module.
2. Update `screenShareController` to use internal module.
3. Remove `@dank074/discord-video-stream` imports and wiring.
4. Delete `vendor/Discord-video-stream` directory.
5. Update `package.json` dependencies.
6. Update tests.

## Risks
- Private `discord.js-selfbot-v13` APIs may change.
- Harder debugging if internal dispatcher behavior differs.

## Rollback Plan
- Revert to previous commit that restores `@dank074/discord-video-stream` and the vendor directory.
