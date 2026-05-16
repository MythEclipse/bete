# Media Echo Fix and YouTube Screenshare Design

## Context

Media playback currently uses the same `DiscordPlayer` instance as the browser audio bridge. The browser bridge is started during webserver startup and subscribes the shared player to the active voice connection. Music playback also uses that player. This shared ownership can let the bridge interfere with media playback and contribute to voice audio being reflected back during playback.

The project already includes `@dank074/discord-video-stream`, which supports Discord Go Live video streaming from a direct media URL or readable stream.

## Goals

- Prevent voice audio from being reflected back while music/media playback is active.
- Keep normal music playback behavior for existing `/api/media/queue` users.
- Add a YouTube screenshare path that streams video through Discord Go Live.
- Fail clearly when voice is not connected, another media mode is busy, or screenshare dependencies fail.

## Non-goals

- Replace the existing voice recorder pipeline.
- Disable message or voice monitoring during music playback.
- Build full production UI for screenshare controls in the first implementation.
- Add Discord integration tests that require a live account or server.

## Design

### Audio player ownership

`DiscordPlayer` will track which subsystem owns the active stream: `none`, `browser-bridge`, `music`, or `screen`. A caller may only start playback when the player has no owner or when the caller owns the current stream. This prevents the browser bridge from overwriting music or screen playback.

The browser bridge in `src/webserver.ts` will not start at server boot. It will be created lazily only when browser audio arrives and no media playback is active. When media playback starts, the bridge is stopped or left inactive so it cannot transmit captured audio back into Discord.

Music playback will claim the `music` owner before calling `playStream`. When music finishes or stops, ownership is released and browser audio may resume later if the browser sends new audio.

### Screenshare mode

The media queue endpoint will accept an optional `mode` field. If omitted, mode defaults to `music` to preserve existing API behavior. `mode: "screen"` starts a separate screenshare flow instead of audio-only music playback.

A new `ScreenShareController` will:

1. Verify a voice channel is connected.
2. Reject start if music or browser bridge owns playback, or if another screen stream is active.
3. Resolve a YouTube URL to a direct playable video URL through the existing yt-dlp utilities.
4. Use `@dank074/discord-video-stream` with `prepareStream(...)` and `playStream(..., { type: "go-live" })`.
5. Track active screen state and provide stop behavior.

Screenshare state will be exposed through media state as the active mode so the frontend can distinguish music from screen playback.

### Busy-state rules

- Music cannot start while screen is active.
- Screen cannot start while music is active.
- Browser bridge cannot start while music or screen is active.
- Stop stops the active media mode and releases ownership.

### Error handling

- `VOICE_NOT_CONNECTED`: media or screen requested before joining voice.
- `MEDIA_BUSY`: another active media mode owns playback.
- `SCREEN_STREAM_FAILED`: yt-dlp, stream preparation, or Go Live playback fails.

Errors should surface through existing Express error handling as JSON responses.

## Testing

- Unit test `DiscordPlayer` ownership rules: browser bridge cannot override music; music releases ownership on stop.
- Media controller tests: default mode remains music, screen mode is routed separately, and busy conflicts reject with `MEDIA_BUSY`.
- Route tests: `/api/media/queue` accepts optional `mode` and passes it to the controller.
- Screenshare controller tests mock yt-dlp and `@dank074/discord-video-stream`; no live Discord account is required.

## Rollout

Implement ownership first and verify existing music tests still pass. Then add mode parsing and the screenshare controller behind the same media route. UI changes can follow as a small enhancement after API behavior is stable.