# One-Port WebSocket Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve Express HTTP endpoints, static frontend, and WebSocket traffic on one `WEBSERVER_PORT` using WebSocket path `/ws`.

**Architecture:** `src/webserver.ts` should create one `http.Server` from the Express app, attach `WebSocketServer` to that same server with `path: "/ws"`, and remove `port + 1`. `public/index.html` should connect to `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws` so dev, production, and reverse proxy setups use the same host and port.

**Tech Stack:** TypeScript, Express, Node HTTP server, `ws`, Bun scripts, Biome, TypeScript compiler.

---

## File Structure

- Modify `src/webserver.ts`: change WebSocket server construction and logs from separate port to shared HTTP server path `/ws`.
- Modify `public/index.html`: change browser WebSocket URL from hardcoded `:3001` to same-origin `/ws`.
- No new files required.

---

### Task 1: Attach WebSocket to Existing HTTP Server

**Files:**
- Modify: `src/webserver.ts`

- [ ] **Step 1: Update WebSocket server creation**

Replace this code in `src/webserver.ts`:

```ts
const wsPort = port + 1;
const wss = new WebSocketServer({ port: wsPort, host: "0.0.0.0" });
wsLogger.info({ wsPort }, "WebSocket server listening");
```

With:

```ts
const wsPath = "/ws";
const wss = new WebSocketServer({ server, path: wsPath });
wsLogger.info({ port, wsPath }, "WebSocket server listening");
```

- [ ] **Step 2: Update connection log**

Replace this code in `src/webserver.ts`:

```ts
wsLogger.info({ wsPort }, "New WebSocket connection");
```

With:

```ts
wsLogger.info({ port, wsPath }, "New WebSocket connection");
```

- [ ] **Step 3: Run typecheck**

Run:

```bash
bun run typecheck
```

Expected: command exits `0`.

---

### Task 2: Update Browser WebSocket URL

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Replace hardcoded WebSocket port**

Replace this code in `public/index.html`:

```js
socket = new WebSocket(`ws://${window.location.hostname}:3001`);
```

With:

```js
const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
socket = new WebSocket(`${wsProtocol}//${window.location.host}/ws`);
```

- [ ] **Step 2: Run lint and build**

Run:

```bash
bun run lint && bun run build
```

Expected: both commands exit `0`.

---

### Task 3: Verify One-Port Behavior

**Files:**
- Verify: `src/webserver.ts`
- Verify: `public/index.html`

- [ ] **Step 1: Start dev server**

Run:

```bash
bun run dev
```

Expected logs include Express web interface on configured port and WebSocket server listening with `{ port: 3000, wsPath: "/ws" }`.

- [ ] **Step 2: Browser smoke test**

Open:

```text
http://localhost:3000
```

Expected: page loads and browser WebSocket connects to:

```text
ws://localhost:3000/ws
```

- [ ] **Step 3: Endpoint smoke test**

Run:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/metrics
```

Expected: `/health` returns JSON and `/metrics` returns Prometheus text.

---

## Self-Review

- Spec coverage: Covers one-port HTTP/WebSocket server, `/ws` path, frontend URL update, and verification.
- Placeholder scan: No TBD/TODO placeholders.
- Type consistency: Uses `wsPath` in both server creation and logs; frontend connects to `/ws`.
