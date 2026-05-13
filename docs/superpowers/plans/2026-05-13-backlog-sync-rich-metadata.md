# Backlog Sync Rich Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fetch prior Discord messages up to 24 hours on startup, persist rich Discord-client-like metadata, and render rich message content in homepage tabs.

**Architecture:** Add `messageMetadata.ts` for reusable extraction, `backlogSync.ts` for bounded startup history fetch, reuse existing store/uploader. UI reads metadata JSON and renders stickers, embeds, attachments/replies/thread badges.

**Tech Stack:** Bun, TypeScript, discord.js-selfbot-v13, bun:sqlite, Express/WebSocket, vanilla HTML/CSS/JS.

---

### Task 1: Extract rich message metadata

**Files:**
- Create: `src/moderation/messageMetadata.ts`
- Modify: `src/moderation/messageCapture.ts`

- [ ] Create helper functions: `getMessageLocation`, `getStickerMetadata`, `getEmbedMetadata`, `getAttachmentMetadata`, `getMessageMetadata`, `getDisplayContent`.
- [ ] Replace duplicate capture helper logic with imports from `messageMetadata.ts`.
- [ ] Verify: `bun run typecheck`.

### Task 2: Make message inserts idempotent

**Files:**
- Modify: `src/moderation/messageStore.ts`

- [ ] Change message insert to `INSERT OR IGNORE` so backlog sync and live events do not conflict.
- [ ] Change attachment insert to `INSERT OR IGNORE`.
- [ ] Verify: `bun run typecheck && bun run test`.

### Task 3: Add backlog sync

**Files:**
- Create: `src/moderation/backlogSync.ts`
- Modify: `src/index.ts`
- Modify: `src/config.ts`
- Modify: `.env.example`

- [ ] Add config: `BACKLOG_SYNC_HOURS=24`, `BACKLOG_SYNC_BATCH_SIZE=100`.
- [ ] Fetch text/thread channels from monitored guild on ready.
- [ ] For each channel/thread, page `channel.messages.fetch({ limit, before })` until older than cutoff.
- [ ] Store messages with rich metadata and attachments.
- [ ] Start sync after registering live capture; run async and log progress.
- [ ] Verify: `bun run typecheck && bun run test`.

### Task 4: Render richer UI

**Files:**
- Modify: `public/index.html`

- [ ] Render metadata embeds as embed cards.
- [ ] Render attachments as inline previews/links in Text tab.
- [ ] Render reply and thread badges.
- [ ] Keep sticker rendering.
- [ ] Verify static JS syntax by typecheck/tests where applicable.

### Task 5: Final verification

**Files:** all touched files

- [ ] Run `bun run typecheck`.
- [ ] Run `bun run test`.
- [ ] Verify short DB init with `bun -e 'import("./src/muxer-queue.ts").then((m)=>{const db=m.getDatabase(); db.close(); console.log("sqlite ok")})'`.
