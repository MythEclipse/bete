# Split Text Voice Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate text moderation guild/channel selection from voice recording guild/channel selection in config, backend state, and dashboard UI.

**Architecture:** Add explicit text and voice config keys while keeping legacy `MONITOR_GUILD_ID` and `GUILD_ID` as fallbacks. Split shared UI state into `selectedTextGuild`/`selectedTextChannel` and `selectedVoiceGuild`/`selectedVoiceChannel`, with backward-compatible migration from old persisted `selectedGuild`. Update capture/backlog to use text-specific settings and voice routes to update only voice-specific state.

**Tech Stack:** TypeScript, Zod config, Express routes, Discord selfbot client, Vitest, static dashboard JavaScript.

---

## File Structure

- Modify `src/config.ts`: add `TEXT_GUILD_ID`, `TEXT_CHANNEL_ID`, `VOICE_GUILD_ID`; derive effective text/voice IDs with legacy fallbacks.
- Modify `.env.example`: document split text/voice configuration.
- Modify `src/moderation/messageCapture.ts`: filter live capture by effective text guild and optional text channel.
- Modify `src/moderation/backlogSync.ts`: use effective text guild and optional text channel for readiness/on-demand sync.
- Modify `src/webserver.ts`: change `SharedUIState` to split text/voice guild fields and migrate old persisted state.
- Modify `src/routes/uiStateRoutes.ts`: update shared UI state type.
- Modify `src/routes/voiceRoutes.ts`: patch `selectedVoiceGuild` only on connect/disconnect.
- Modify `public/index.html`: add separate voice guild select and text guild select behavior.
- Tests: `tests/config.test.ts`, `tests/moderation/messageCapture.test.ts`, and a new UI state route/unit test if needed.

## Task 1: Split Config Defaults

**Files:**
- Modify: `src/config.ts`
- Modify: `.env.example`
- Test: `tests/config.test.ts`

- [ ] **Step 1: Write failing config tests**

Add tests to `tests/config.test.ts`:

```ts
  it("derives split text and voice guild defaults from legacy config", async () => {
    process.env = {
      ...originalEnv,
      DISCORD_TOKEN: "token",
      MONITOR_GUILD_ID: "legacy-text-guild",
      GUILD_ID: "legacy-voice-guild",
      VOICE_CHANNEL_ID: "voice-channel",
      NODE_ENV: "test",
    };

    const { loadConfig } = await import("../src/config");
    const config = loadConfig(process.env);

    expect(config.TEXT_GUILD_ID).toBeUndefined();
    expect(config.EFFECTIVE_TEXT_GUILD_ID).toBe("legacy-text-guild");
    expect(config.EFFECTIVE_VOICE_GUILD_ID).toBe("legacy-voice-guild");
    expect(config.VOICE_CHANNEL_ID).toBe("voice-channel");
  });

  it("uses explicit split text and voice config before legacy values", async () => {
    process.env = {
      ...originalEnv,
      DISCORD_TOKEN: "token",
      MONITOR_GUILD_ID: "legacy-text-guild",
      GUILD_ID: "legacy-voice-guild",
      TEXT_GUILD_ID: "text-guild",
      TEXT_CHANNEL_ID: "text-channel",
      VOICE_GUILD_ID: "voice-guild",
      VOICE_CHANNEL_ID: "voice-channel",
      NODE_ENV: "test",
    };

    const { loadConfig } = await import("../src/config");
    const config = loadConfig(process.env);

    expect(config.EFFECTIVE_TEXT_GUILD_ID).toBe("text-guild");
    expect(config.TEXT_CHANNEL_ID).toBe("text-channel");
    expect(config.EFFECTIVE_VOICE_GUILD_ID).toBe("voice-guild");
  });
```

- [ ] **Step 2: Run config tests red**

Run: `pnpm exec vitest run tests/config.test.ts`

Expected: FAIL because `EFFECTIVE_TEXT_GUILD_ID` and `EFFECTIVE_VOICE_GUILD_ID` do not exist.

- [ ] **Step 3: Add split config fields and derived values**

In `src/config.ts`, add schema fields near legacy guild config:

```ts
TEXT_GUILD_ID: z.string().min(1).optional(),
TEXT_CHANNEL_ID: z.string().min(1).optional(),
VOICE_GUILD_ID: z.string().min(1).optional(),
```

Change `loadConfig` to parse then return derived values:

```ts
const parsed = configSchema.parse(env);
return {
  ...parsed,
  EFFECTIVE_TEXT_GUILD_ID: parsed.TEXT_GUILD_ID ?? parsed.MONITOR_GUILD_ID,
  EFFECTIVE_VOICE_GUILD_ID: parsed.VOICE_GUILD_ID ?? parsed.GUILD_ID,
};
```

Update `AppConfig` to include derived fields:

```ts
export type AppConfig = z.infer<typeof configSchema> & {
  EFFECTIVE_TEXT_GUILD_ID?: string;
  EFFECTIVE_VOICE_GUILD_ID?: string;
};
```

- [ ] **Step 4: Update `.env.example`**

Document:

```env
# Text moderation capture target. Falls back to MONITOR_GUILD_ID for compatibility.
TEXT_GUILD_ID=
TEXT_CHANNEL_ID=

# Voice recording default target. Falls back to GUILD_ID for compatibility.
VOICE_GUILD_ID=
VOICE_CHANNEL_ID=
```

Keep existing legacy keys with notes rather than deleting them.

- [ ] **Step 5: Run config tests green**

Run: `pnpm exec vitest run tests/config.test.ts`

Expected: PASS.

## Task 2: Apply Text Capture Guild/Channel Filtering

**Files:**
- Modify: `src/moderation/messageCapture.ts`
- Modify: `src/moderation/backlogSync.ts`
- Test: `tests/moderation/messageCapture.test.ts`

- [ ] **Step 1: Write failing channel filter test**

In `tests/moderation/messageCapture.test.ts`, mock config before importing `captureMessage` if needed or add a new test file `tests/moderation/messageCaptureFilter.test.ts` that imports a new exported helper.

Preferred helper test: create `tests/moderation/messageCaptureFilter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { shouldCaptureMessageLocation } from "../../src/moderation/messageCapture";

describe("shouldCaptureMessageLocation", () => {
  it("matches only configured text guild and optional channel", () => {
    expect(
      shouldCaptureMessageLocation(
        { guildId: "guild-1", channelId: "channel-1" },
        { guildId: "guild-1", channelId: "channel-1" },
      ),
    ).toBe(true);

    expect(
      shouldCaptureMessageLocation(
        { guildId: "guild-1", channelId: "channel-2" },
        { guildId: "guild-1", channelId: "channel-1" },
      ),
    ).toBe(false);

    expect(
      shouldCaptureMessageLocation(
        { guildId: "guild-2", channelId: "channel-1" },
        { guildId: "guild-1", channelId: "channel-1" },
      ),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run filter test red**

Run: `pnpm exec vitest run tests/moderation/messageCaptureFilter.test.ts`

Expected: FAIL because `shouldCaptureMessageLocation` does not exist.

- [ ] **Step 3: Add capture filter helper**

In `src/moderation/messageCapture.ts`, export:

```ts
export interface TextCaptureTarget {
  guildId?: string;
  channelId?: string;
}

export interface MessageLocationInput {
  guildId?: string | null;
  channelId?: string | null;
}

export function shouldCaptureMessageLocation(
  message: MessageLocationInput,
  target: TextCaptureTarget,
): boolean {
  if (!message.guildId || message.guildId !== target.guildId) return false;
  if (target.channelId && message.channelId !== target.channelId) return false;
  return true;
}
```

Replace event checks:

```ts
if (
  !shouldCaptureMessageLocation(message, {
    guildId: config.EFFECTIVE_TEXT_GUILD_ID,
    channelId: config.TEXT_CHANNEL_ID,
  })
)
  return;
```

Use the same helper for `messageUpdate` and `messageDelete`.

- [ ] **Step 4: Update backlog sync config**

In `src/moderation/backlogSync.ts`, replace readiness checks with `config.EFFECTIVE_TEXT_GUILD_ID` and log names with `TEXT_GUILD_ID`. If `config.TEXT_CHANNEL_ID` is present in `syncBacklogMessages`, verify the channel exists and call `syncSelectedChannelBacklog(client, guild.id, config.TEXT_CHANNEL_ID)` instead of only logging readiness.

- [ ] **Step 5: Run focused moderation tests**

Run: `pnpm exec vitest run tests/moderation/messageCapture.test.ts tests/moderation/messageCaptureFilter.test.ts`

Expected: PASS.

## Task 3: Split Shared UI State

**Files:**
- Modify: `src/webserver.ts`
- Modify: `src/routes/uiStateRoutes.ts`
- Modify: `src/routes/voiceRoutes.ts`
- Test: create `tests/routes/uiStateRoutes.test.ts` if no existing route test fits.

- [ ] **Step 1: Write state migration test**

Create `tests/routes/uiStateRoutes.test.ts` with a pure helper import if extracted. Add helper in Task 3 implementation.

```ts
import { describe, expect, it } from "vitest";
import { normalizeSharedUIState } from "../../src/webserver";

describe("normalizeSharedUIState", () => {
  it("migrates legacy selectedGuild into split text and voice guilds", () => {
    expect(
      normalizeSharedUIState({
        selectedGuild: "legacy-guild",
        selectedVoiceChannel: "voice-channel",
        selectedTextChannel: "text-channel",
      }),
    ).toMatchObject({
      selectedVoiceGuild: "legacy-guild",
      selectedVoiceChannel: "voice-channel",
      selectedTextGuild: "legacy-guild",
      selectedTextChannel: "text-channel",
    });
  });
});
```

- [ ] **Step 2: Run state test red**

Run: `pnpm exec vitest run tests/routes/uiStateRoutes.test.ts`

Expected: FAIL because `normalizeSharedUIState` does not exist/export.

- [ ] **Step 3: Update shared state types**

In `src/routes/uiStateRoutes.ts` and `src/webserver.ts`, replace `selectedGuild` with:

```ts
selectedVoiceGuild: string;
selectedVoiceChannel: string;
selectedTextGuild: string;
selectedTextChannel: string;
```

Keep request patch compatibility by allowing `selectedGuild?: string` in the normalization helper input.

- [ ] **Step 4: Add normalizer and use it after persistence load**

In `src/webserver.ts`, export:

```ts
export function normalizeSharedUIState(value: Partial<SharedUIState> & { selectedGuild?: string }): SharedUIState {
  const legacyGuild = value.selectedGuild ?? "";
  return {
    selectedVoiceGuild: value.selectedVoiceGuild ?? legacyGuild,
    selectedVoiceChannel: value.selectedVoiceChannel ?? "",
    selectedTextGuild: value.selectedTextGuild ?? legacyGuild,
    selectedTextChannel: value.selectedTextChannel ?? "",
    activeTab: value.activeTab === "text" ? "text" : "voice",
    isListening: value.isListening ?? false,
    isStreaming: value.isStreaming ?? false,
  };
}
```

Use it in `initializeSharedUIState()`:

```ts
sharedUIState = normalizeSharedUIState(
  await getPersistedValue("web-ui-state", defaultSharedUIState),
);
```

Update `patchSharedUIState` to accept `selectedVoiceGuild`, `selectedVoiceChannel`, `selectedTextGuild`, `selectedTextChannel`; if legacy `selectedGuild` arrives, set both guild fields.

- [ ] **Step 5: Update voice route patches**

In `src/routes/voiceRoutes.ts`, connect patch becomes:

```ts
selectedVoiceGuild: guildId,
selectedVoiceChannel: channelId,
```

Disconnect clears only:

```ts
selectedVoiceGuild: "",
selectedVoiceChannel: "",
```

Do not clear text guild/channel on voice disconnect.

- [ ] **Step 6: Run state tests**

Run: `pnpm exec vitest run tests/routes/uiStateRoutes.test.ts`

Expected: PASS.

## Task 4: Update Static Dashboard Selection

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Replace state fields**

Change JS state fields:

```js
selectedVoiceGuild: '',
selectedVoiceChannel: '',
selectedTextGuild: '',
selectedTextChannel: '',
```

Remove direct reliance on `selectedGuild` except migration when applying server state.

- [ ] **Step 2: Add separate DOM selectors**

In the UI markup, provide separate select elements for voice guild and text guild. Use IDs:

```html
<select id="voiceGuildSelect"></select>
<select id="channelSelect"></select>
<select id="textGuildSelect"></select>
<select id="channelFilter"></select>
```

Update the `el` map to use `voiceGuildSelect` and `textGuildSelect`.

- [ ] **Step 3: Split channel loading functions**

Replace `loadChannels(guildId)` with:

```js
async function loadVoiceChannels(guildId) {
  if (!guildId) return renderOptions(el.channelSelect, [], 'Select voice channel');
  const voiceChannels = await apiRequest(`/api/guilds/${guildId}/voice-channels`);
  renderOptions(el.channelSelect, voiceChannels, 'Select voice channel');
  if (state.selectedVoiceChannel) el.channelSelect.value = state.selectedVoiceChannel;
}

async function loadTextChannels(guildId) {
  if (!guildId) return renderOptions(el.channelFilter, [], 'Select channel');
  const watchChannels = await apiRequest(`/api/guilds/${guildId}/channels`);
  renderOptions(el.channelFilter, watchChannels, 'Select channel');
  if (state.selectedTextChannel) el.channelFilter.value = state.selectedTextChannel;
  apiRequest(`/api/guilds/${guildId}/threads`)
    .then((threads) => {
      appendOptions(el.channelFilter, threads);
      if (state.selectedTextChannel) el.channelFilter.value = state.selectedTextChannel;
    })
    .catch((error) => showError(`Thread discovery failed: ${error.message}`));
}
```

- [ ] **Step 4: Split state application**

In `applyServerState`, compute:

```js
const nextVoiceGuild = next.selectedVoiceGuild || next.selectedGuild || '';
const nextTextGuild = next.selectedTextGuild || next.selectedGuild || '';
const voiceGuildChanged = nextVoiceGuild !== state.selectedVoiceGuild;
const textGuildChanged = nextTextGuild !== state.selectedTextGuild;
```

Load voice channels only when voice guild changes; load text channels only when text guild changes. Backlog sync uses `state.selectedTextGuild`.

- [ ] **Step 5: Split event listeners**

Use:

```js
el.voiceGuildSelect.addEventListener('change', () => postUIState({ selectedVoiceGuild: el.voiceGuildSelect.value, selectedVoiceChannel: '' }).catch((error) => showError(error.message)));
el.textGuildSelect.addEventListener('change', () => postUIState({ selectedTextGuild: el.textGuildSelect.value, selectedTextChannel: '' }).catch((error) => showError(error.message)));
el.channelSelect.addEventListener('change', () => postUIState({ selectedVoiceChannel: el.channelSelect.value }).catch((error) => showError(error.message)));
el.channelFilter.addEventListener('change', () => { const selectedTextChannel = el.channelFilter.value; const url = new URL(location.href); if (selectedTextChannel) url.searchParams.set('channel', selectedTextChannel); else url.searchParams.delete('channel'); if (el.textGuildSelect.value) url.searchParams.set('guild', el.textGuildSelect.value); history.replaceState({}, '', url); postUIState({ selectedTextChannel }).catch((error) => showError(error.message)); });
```

- [ ] **Step 6: Manual UI verification**

Run: `pnpm run build`

Expected: PASS. Then start the app if credentials are available and verify selecting voice guild does not reset text guild/channel and selecting text guild does not reset voice guild/channel.

## Task 5: Final Verification

**Files:**
- No planned edits unless verification fails.

- [ ] **Step 1: Run lint**

Run: `pnpm run lint`

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run: `pnpm run typecheck`

Expected: PASS.

- [ ] **Step 3: Run tests**

Run: `pnpm run test`

Expected: PASS.

- [ ] **Step 4: Run build**

Run: `pnpm run build`

Expected: PASS.

- [ ] **Step 5: Inspect status**

Run: `git status --short`

Expected: only intended files changed.

## Self-Review

- Spec coverage: config split is Task 1; capture/backlog filtering is Task 2; backend UI state split is Task 3; dashboard split is Task 4; verification is Task 5.
- Placeholder scan: no TBD/TODO/fill-in steps remain.
- Type consistency: split fields use `selectedVoiceGuild`, `selectedVoiceChannel`, `selectedTextGuild`, `selectedTextChannel` consistently.
