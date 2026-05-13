# React SSR Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace static client-rendered homepage with React server-side rendering while keeping live WebSocket/voice behavior as progressive enhancement.

**Architecture:** Express `GET /` builds dashboard data, renders React component to HTML with `react-dom/server`, injects bootstrap JSON for client script. CSS/JS move to static assets; React owns initial markup only, lightweight browser JS handles tab switching, voice bridge, WebSocket updates, and async thread discovery.

**Tech Stack:** React, ReactDOM server, Bun, Express, TypeScript, vanilla browser JS for progressive enhancement.

---

### Task 1: Add React dependencies

**Files:**
- Modify: `package.json`
- Modify: `bun.lockb`

- [ ] Run `bun add react react-dom`.
- [ ] Run `bun add -d @types/react @types/react-dom`.
- [ ] Verify `bun run typecheck`.

### Task 2: Extract dashboard assets

**Files:**
- Create: `public/dashboard.css`
- Create: `public/dashboard.js`
- Modify: `public/index.html`

- [ ] Move current `<style>` content to `dashboard.css`.
- [ ] Move current `<script>` content to `dashboard.js`.
- [ ] Keep client behavior independent from static HTML.

### Task 3: Create React SSR renderer

**Files:**
- Create: `src/web/dashboardPage.tsx`

- [ ] Create `DashboardPage` React component accepting: guilds, voiceChannels, watchChannels, selectedChannel, messages, status.
- [ ] Render same Voice/Text layout as current homepage.
- [ ] Render message cards server-side from DB metadata.
- [ ] Export `renderDashboardPage(props)` returning full HTML with CSS/JS links and bootstrap JSON.

### Task 4: Wire Express SSR route

**Files:**
- Modify: `src/webserver.ts`

- [ ] Add `GET /` before static middleware fallback or before static index handling.
- [ ] Build props from `voiceController` and `getMessagesByChannel`.
- [ ] Respect query `?guild=<id>&channel=<id>`.
- [ ] Render HTML with `renderDashboardPage`.

### Task 5: Verify

**Files:** all touched files

- [ ] Run `bun run typecheck`.
- [ ] Run `bun run test`.
- [ ] Run short SSR import smoke if possible.
