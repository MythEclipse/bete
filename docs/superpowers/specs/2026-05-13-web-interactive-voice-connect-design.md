# Web Interactive Voice Connect Design

## Goal

Replace startup auto-connect with web-driven guild and voice channel selection.

## Current Behavior

The bot reads `GUILD_ID` and `VOICE_CHANNEL_ID` from config on startup. When Discord client emits `ready`, `src/index.ts` immediately fetches that guild/channel, joins the voice channel, starts recording, connects the player, then starts the webserver.

## New Behavior

The bot should login to Discord and start the webserver immediately. The web UI should let the user select a guild and voice channel from dropdowns, then connect or disconnect without restarting the bot.

## API

Add HTTP endpoints in `src/webserver.ts`, backed by the Discord client passed from `src/index.ts`.

- `GET /api/status`
  - returns `{ ready, connected, activeGuildId, activeChannelId, activeChannelName }`
- `GET /api/guilds`
  - returns guilds available in `client.guilds.cache`
  - shape: `{ id, name }[]`
- `GET /api/guilds/:guildId/voice-channels`
  - fetches guild by id
  - returns voice channels only
  - shape: `{ id, name }[]`
- `POST /api/connect`
  - body: `{ guildId, channelId }`
  - stops existing recording/connection if connected
  - validates guild exists and channel is `GUILD_VOICE`
  - calls `startRecording(client, channel)`
  - updates active connection state
  - calls `discordPlayer.setConnection(getVoiceConnection(guildId))`
- `POST /api/disconnect`
  - stops current recording if connected
  - clears active connection state
  - pauses player

## Config

`DISCORD_TOKEN` remains required. `GUILD_ID` and `VOICE_CHANNEL_ID` become optional because selection happens in the web UI.

## Frontend

Update `public/index.html` with a small connection panel above current audio controls:

- Guild dropdown
- Channel dropdown
- Join Channel button
- Disconnect button
- Connection status text

Flow:

1. On page load, fetch `/api/status` and `/api/guilds`.
2. When guild changes, fetch `/api/guilds/:guildId/voice-channels`.
3. Join button sends selected guild/channel to `/api/connect`.
4. Disconnect button sends `/api/disconnect`.
5. Existing transmit/listen WebSocket behavior remains unchanged.

## Error Handling

API returns `400` for missing ids or invalid channel type, `404` for missing guild/channel, and `409` if Discord client is not ready. Frontend shows error text in the connection panel.

## Testing

Run:

```bash
bun run test
bun run typecheck
bun run lint
bun run build
```

Manual browser smoke test:

1. Start bot.
2. Open web UI.
3. Confirm guild dropdown loads.
4. Select guild, confirm voice channel dropdown loads.
5. Click Join Channel, confirm status changes and bot joins voice.
6. Click Disconnect, confirm bot leaves voice.

## Self-Review

- No placeholders.
- Scope is focused on web-driven voice connect only.
- Existing WebSocket audio path remains unchanged.
- Config change matches interactive selection requirement.
