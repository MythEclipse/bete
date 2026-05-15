# Media Music Phase 1 Design

## Goal

Add a first media playback phase focused on play music: users can queue, play, skip, and stop audio sources from the dashboard while preserving the existing Discord voice recorder, browser microphone transmit, and moderation capture flows.

## Scope

Phase 1 implements audio-only playback and queue control. Share screen/video streaming is intentionally reserved for phase 2, but the controller shape should leave room for a later `screen` mode using the already vendored `@dank074/discord-video-stream` APIs seen in `MythEclipse/StreamBot`.

## Recommended Architecture

Create a small media subsystem under `src/media/`:

- `mediaTypes.ts` defines `MediaMode`, `MediaQueueItem`, `MediaState`, and request/response types.
- `mediaQueue.ts` owns in-memory queue operations: add, current, next, remove current, clear, snapshot.
- `mediaResolver.ts` resolves initial supported sources. Phase 1 should support direct HTTP(S) URLs and local file paths. YouTube/search can be added later because it requires adding or wrapping yt-dlp behavior.
- `musicPlayer.ts` converts a media source to Ogg Opus using ffmpeg and feeds the existing `discordPlayer.playStream()`.
- `mediaController.ts` coordinates queue state, voice connection assumptions, play/skip/stop, and WebSocket broadcast state.

The existing `VoiceController` remains the owner of joining/leaving voice channels. Phase 1 does not create a second voice connection path. Music playback requires the bot to already be connected through the existing voice UI or `/api/connect`; otherwise the media route returns `409 VOICE_NOT_CONNECTED`.

## Data Flow

1. Browser submits a source to `/api/media/queue` with `{ source }`.
2. `mediaResolver` validates and resolves the source into `{ source, title, kind }`.
3. `mediaQueue` appends a `MediaQueueItem`.
4. If no item is playing, `mediaController` starts playback of the current queue item.
5. `musicPlayer` spawns ffmpeg and outputs Ogg Opus to `discordPlayer.playStream()`.
6. When playback finishes, the controller removes the completed item and starts the next item.
7. State changes broadcast over the existing moderation broadcaster as a JSON WebSocket event, or via a small media broadcaster wrapper if that keeps types cleaner.

## API Design

Add `src/routes/mediaRoutes.ts` mounted under `/api`:

- `GET /api/media/status` returns `{ playing, current, queue }`.
- `POST /api/media/queue` accepts `{ source: string }`, queues it, and returns the updated state.
- `POST /api/media/skip` skips current item and starts the next if present.
- `POST /api/media/stop` stops playback and clears the queue.

All routes should use `AppError` for boundary validation. Empty source returns `400 MISSING_MEDIA_SOURCE`. No voice connection returns `409 VOICE_NOT_CONNECTED`.

## Dashboard Design

Add a compact Media card to the existing voice tab for phase 1:

- Source input: URL or local path.
- Buttons: Queue/Play, Skip, Stop.
- Current item label and queue list.

Do not add a separate full media tab yet. The voice tab already owns voice channel selection and connection state, so colocating music controls there reduces user confusion.

## Playback Details

Use ffmpeg directly or the existing `src/audio/ffmpegProcess.ts` helper if it already fits. The target stream should be Ogg Opus because `DiscordPlayer.playStream()` currently expects `StreamType.OggOpus`.

Recommended ffmpeg output shape:

- Input: local file or HTTP(S) URL.
- Output format: `ogg`.
- Audio codec: `libopus`.
- Sample rate: `48000`.
- Channels: `2`.

The controller owns an `AbortController` or child process handle so skip/stop can terminate ffmpeg. Stop must also call `discordPlayer.stop()` so the audio player releases the current resource.

## Concurrency Rules

- Only one media item plays at a time.
- Browser microphone transmit and music playback both use `discordPlayer`; phase 1 should disable music start while `isStreaming` is true, or stop browser transmit before playback. Prefer returning `409 BROWSER_STREAM_ACTIVE` to avoid surprising the user.
- Voice recording can continue while music plays because recording uses the receiver pipeline and music uses the player pipeline.
- Skip is serialized: concurrent skip calls should return the same resulting state or reject with `409 MEDIA_SKIP_IN_PROGRESS`.

## Error Handling

- Unsupported source format: `400 UNSUPPORTED_MEDIA_SOURCE`.
- ffmpeg spawn failure: current item becomes failed, playback advances to the next queued item if present.
- ffmpeg runtime failure: log stderr summary, mark item failed, advance queue.
- Stop is idempotent: stopping while idle returns current idle state.

## Tests

Unit tests should cover:

- Queue add/next/remove/clear behavior.
- Resolver accepts HTTP(S) URLs and existing local paths, rejects empty/unsupported input.
- Controller rejects playback when voice is not connected.
- Controller starts next item after completion.
- Skip aborts current playback and advances queue.
- Routes validate payloads and call controller methods.

Manual verification should cover:

- Connect to a voice channel, queue a short audio URL or local file, hear playback in Discord.
- Queue two items, confirm automatic advance.
- Skip moves to the next item.
- Stop clears playback and queue.
- Existing voice recording and text moderation still work after media playback.

## Phase 2 Compatibility

Phase 2 can add `MediaMode = "screen"` and a `screenSharePlayer.ts` using StreamBot's pattern:

- `new Streamer(client)`
- `streamer.joinVoice(guildId, channelId)` only if phase 2 decides to own its own connection path
- `prepareStream(source, videoOptions, signal)`
- `playStream(output, streamer, { type: "go-live" }, signal)`

Phase 1 should not instantiate `Streamer`; it should only reserve type and controller seams so adding screen share later does not rewrite queue/status APIs.
