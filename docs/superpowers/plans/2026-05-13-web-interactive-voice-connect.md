# Web Interactive Voice Connect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace startup auto-connect with web UI guild/channel selection and make voice connection cleanup/reconnect more stable.

**Architecture:** Add a `VoiceController` module that owns active voice state, connect/disconnect, guild/channel listing, and player binding. `src/index.ts` only logs in and starts webserver after Discord ready. `src/webserver.ts` exposes JSON APIs used by dropdown controls in `public/index.html`. UI rendering uses DOM methods, not raw HTML injection.

**Tech Stack:** TypeScript, discord.js-selfbot-v13, @discordjs/voice, Express, WebSocket, plain browser JavaScript, Bun, Vitest, Biome.

---

## File Structure

- Create `src/voiceController.ts`: active connection state, guild/channel listing, connect/disconnect.
- Modify `src/config.ts`: make `GUILD_ID` and `VOICE_CHANNEL_ID` optional.
- Modify `src/index.ts`: remove auto-connect; start webserver with Discord client and voice controller.
- Modify `src/recorder.ts`: return voice connection from `startRecording`; use configured silence duration; keep bounded reconnect behavior.
- Modify `src/webserver.ts`: add API routes and JSON error handling.
- Modify `public/index.html`: add connection panel and dropdown behavior.
- Modify `tests/config.test.ts`: assert optional guild/channel config.

---

### Task 1: Config Optional Guild/Channel

**Files:**
- Modify: `src/config.ts`
- Modify: `tests/config.test.ts`

- [ ] **Step 1: Update config test**

Add these assertions after `expect(config.NODE_ENV).toBe("test");` in `tests/config.test.ts`:

```ts
expect(config.GUILD_ID).toBeUndefined();
expect(config.VOICE_CHANNEL_ID).toBeUndefined();
```

- [ ] **Step 2: Verify RED**

Run:

```bash
bun run test tests/config.test.ts
```

Expected: FAIL because `GUILD_ID` and `VOICE_CHANNEL_ID` are still required.

- [ ] **Step 3: Make config optional**

In `src/config.ts`, replace:

```ts
VOICE_CHANNEL_ID: z.string().min(1, "VOICE_CHANNEL_ID is required"),
GUILD_ID: z.string().min(1, "GUILD_ID is required"),
```

With:

```ts
VOICE_CHANNEL_ID: z.string().min(1).optional(),
GUILD_ID: z.string().min(1).optional(),
```

- [ ] **Step 4: Verify GREEN**

Run:

```bash
bun run test tests/config.test.ts
```

Expected: PASS.

---

### Task 2: Voice Controller Module

**Files:**
- Create: `src/voiceController.ts`
- Modify: `src/recorder.ts`

- [ ] **Step 1: Create `src/voiceController.ts`**

```ts
import { getVoiceConnection, type VoiceConnection } from "@discordjs/voice";
import type { Client, Guild, VoiceChannel } from "discord.js-selfbot-v13";
import { AppError } from "./errors";
import { createChildLogger } from "./logger";
import { discordPlayer } from "./player";
import { startRecording, stopRecording } from "./recorder";

const logger = createChildLogger("voice-controller");

export interface VoiceStatus {
  ready: boolean;
  connected: boolean;
  activeGuildId: string | null;
  activeChannelId: string | null;
  activeChannelName: string | null;
}

export interface GuildSummary {
  id: string;
  name: string;
}

export interface VoiceChannelSummary {
  id: string;
  name: string;
}

export class VoiceController {
  private activeGuildId: string | null = null;
  private activeChannelId: string | null = null;
  private activeChannelName: string | null = null;
  private connecting = false;

  constructor(private readonly client: Client) {}

  getStatus(): VoiceStatus {
    const connection = this.activeGuildId
      ? getVoiceConnection(this.activeGuildId)
      : undefined;
    return {
      ready: this.client.isReady(),
      connected: Boolean(connection),
      activeGuildId: this.activeGuildId,
      activeChannelId: this.activeChannelId,
      activeChannelName: this.activeChannelName,
    };
  }

  listGuilds(): GuildSummary[] {
    return this.client.guilds.cache
      .map((guild) => ({ id: guild.id, name: guild.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async listVoiceChannels(guildId: string): Promise<VoiceChannelSummary[]> {
    const guild = this.getGuild(guildId);
    await guild.channels.fetch().catch(() => null);
    return guild.channels.cache
      .filter((channel) => channel.type === "GUILD_VOICE")
      .map((channel) => ({ id: channel.id, name: channel.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async connect(guildId: string, channelId: string): Promise<VoiceStatus> {
    if (!this.client.isReady()) {
      throw new AppError("Discord client is not ready", "CLIENT_NOT_READY", 409);
    }
    if (this.connecting) {
      throw new AppError("Voice connection is already in progress", "CONNECT_IN_PROGRESS", 409);
    }

    this.connecting = true;
    try {
      await this.disconnect();
      const guild = this.getGuild(guildId);
      const channel =
        guild.channels.cache.get(channelId) ??
        (await guild.channels.fetch(channelId).catch(() => null));

      if (!channel) {
        throw new AppError("Voice channel not found", "VOICE_CHANNEL_NOT_FOUND", 404);
      }
      if (channel.type !== "GUILD_VOICE") {
        throw new AppError("Selected channel is not a voice channel", "INVALID_CHANNEL_TYPE", 400);
      }

      const connection = await startRecording(this.client, channel as VoiceChannel);
      if (!connection) {
        throw new AppError("Failed to connect to voice channel", "VOICE_CONNECT_FAILED", 500);
      }

      discordPlayer.setConnection(connection as VoiceConnection);
      this.activeGuildId = guildId;
      this.activeChannelId = channelId;
      this.activeChannelName = channel.name;
      logger.info({ guildId, channelId, channelName: channel.name }, "Voice connected");
      return this.getStatus();
    } finally {
      this.connecting = false;
    }
  }

  async disconnect(): Promise<VoiceStatus> {
    if (this.activeGuildId) {
      stopRecording(this.activeGuildId);
    }
    discordPlayer.pause();
    this.activeGuildId = null;
    this.activeChannelId = null;
    this.activeChannelName = null;
    return this.getStatus();
  }

  private getGuild(guildId: string): Guild {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) {
      throw new AppError("Guild not found", "GUILD_NOT_FOUND", 404);
    }
    return guild;
  }
}
```

- [ ] **Step 2: Update recorder return type**

In `src/recorder.ts`, import `type VoiceConnection` from `@discordjs/voice`, change `startRecording` return type to `Promise<VoiceConnection | null>`, return `null` on connect failure, and return `connection` as final line of the function.

- [ ] **Step 3: Use configured silence duration**

In `src/recorder.ts`, replace hardcoded `duration: 3000` in `receiver.subscribe` with:

```ts
duration: config.AUDIO_STREAM_SILENCE_DURATION_MS,
```

- [ ] **Step 4: Run typecheck**

Run:

```bash
bun run typecheck
```

Expected: PASS after later call sites updated.

---

### Task 3: Startup Without Auto-Join

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Refactor startup**

Update `src/index.ts` so it:

```ts
import { VoiceController } from "./voiceController";

const client = new Client();
const voiceController = new VoiceController(client);
```

Remove `voiceChannelId`, `guildId`, auto guild fetch, auto channel fetch, `startRecording`, and `getVoiceConnection` setup from `client.on("ready")`.

Set ready handler to:

```ts
client.on("ready", async () => {
  logger.info({ user: client.user?.tag }, "Bot logged in");
  startWebserver(config.WEBSERVER_PORT, client, voiceController);
});
```

- [ ] **Step 2: Refactor shutdown**

In `gracefulShutdown`, replace guild-specific stop/destroy logic with:

```ts
logger.info("Stopping voice connection...");
await voiceController.disconnect();
```

Keep player pause and client destroy.

---

### Task 4: Webserver Voice APIs

**Files:**
- Modify: `src/webserver.ts`

- [ ] **Step 1: Update signature and imports**

Add imports:

```ts
import type { Client } from "discord.js-selfbot-v13";
import { AppError } from "./errors";
import type { VoiceController } from "./voiceController";
```

Change function signature:

```ts
export function startWebserver(
  port: number = 3000,
  _client: Client,
  voiceController: VoiceController,
) {
```

- [ ] **Step 2: Enable JSON**

Add after pino HTTP middleware:

```ts
app.use(express.json());
```

- [ ] **Step 3: Add API routes**

Add after `/metrics`:

```ts
app.get("/api/status", (_req, res) => {
  res.json(voiceController.getStatus());
});

app.get("/api/guilds", (_req, res) => {
  res.json(voiceController.listGuilds());
});

app.get("/api/guilds/:guildId/voice-channels", async (req, res, next) => {
  try {
    res.json(await voiceController.listVoiceChannels(req.params.guildId));
  } catch (error) {
    next(error);
  }
});

app.post("/api/connect", async (req, res, next) => {
  try {
    const { guildId, channelId } = req.body as { guildId?: string; channelId?: string };
    if (!guildId || !channelId) {
      throw new AppError("guildId and channelId are required", "MISSING_CONNECT_FIELDS", 400);
    }
    res.json(await voiceController.connect(guildId, channelId));
  } catch (error) {
    next(error);
  }
});

app.post("/api/disconnect", async (_req, res, next) => {
  try {
    res.json(await voiceController.disconnect());
  } catch (error) {
    next(error);
  }
});
```

- [ ] **Step 4: Add API error handler before `server.listen`**

```ts
app.use(
  (
    error: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.code, message: error.message });
      return;
    }
    wsLogger.error({ error }, "Unhandled webserver error");
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "Internal server error" });
  },
);
```

---

### Task 5: Frontend Dropdown UI

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Add connection panel markup**

Add a panel above transmit/listen controls with selects `guildSelect`, `channelSelect`, buttons `joinVoiceBtn`, `disconnectVoiceBtn`, and text `voiceStatusText`.

- [ ] **Step 2: Add DOM-safe JS**

Add helpers that use `document.createElement`, `textContent`, and `appendChild` for dropdown options. Do not use raw `innerHTML` with guild/channel names.

Use this safe select renderer:

```js
function renderSelect(select, items, placeholder) {
    select.replaceChildren();
    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = placeholder;
    select.appendChild(placeholderOption);
    for (const item of items) {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.name;
        select.appendChild(option);
    }
}
```

- [ ] **Step 3: Wire API calls**

Use `/api/guilds`, `/api/guilds/:guildId/voice-channels`, `/api/connect`, `/api/disconnect`, and `/api/status` to populate and update UI.

---

### Task 6: Verification

**Files:**
- Verify all modified files.

- [ ] **Step 1: Automated verification**

Run:

```bash
bun run test && bun run typecheck && bun run lint && bun run build
```

Expected: PASS.

- [ ] **Step 2: Manual smoke test**

Run:

```bash
bun run dev
```

Open `http://localhost:3000`. Confirm guild dropdown loads, channels load after guild selection, Join connects, Disconnect leaves, and mic/listen still work after joining.

---

## Self-Review

- Spec coverage: Covers optional config, no startup auto-connect, dropdown guild/channel UI, API endpoints, connect/disconnect, and safer cleanup.
- Placeholder scan: No TBD/TODO placeholders.
- Type consistency: `VoiceController` method names match API routes and frontend calls.
- Security: Dropdown rendering uses DOM methods instead of raw HTML for remote guild/channel names.
