# Selfbot Performance Feature Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optimize the app's selfbot client runtime and vendor internals for lower memory pressure, safer REST retries, reduced voice cleanup leaks, faster gateway queue processing, and lightweight observability.

**Architecture:** Start with app-level client options because they are low-risk and immediately reduce cache pressure. Then patch vendor internals in isolated areas: REST manager/request handling, voice packet cleanup, and WebSocket shard queueing. Keep public imports and runtime APIs compatible with `discord.js-selfbot-v13` consumers.

**Tech Stack:** Node.js, TypeScript, CommonJS vendor package, discord.js-selfbot-v13 workspace dependency, Undici, Vitest, Biome, TypeScript.

---

## File Structure

- Modify `src/index.ts`: instantiate `Client` with low-memory cache/sweeper/REST options.
- Modify `vendor/discord.js-selfbot-v13/src/rest/RESTManager.js`: own per-client dispatcher state and super-properties cache helpers.
- Modify `vendor/discord.js-selfbot-v13/src/rest/APIRequest.js`: use per-client dispatcher and cached `x-super-properties` header.
- Modify `vendor/discord.js-selfbot-v13/src/rest/RequestHandler.js`: add backoff/jitter helper and debug telemetry for retry attempts.
- Modify `vendor/discord.js-selfbot-v13/src/client/voice/receiver/PacketHandler.js`: clear speaking timers and reduce RTP parse allocations.
- Modify `vendor/discord.js-selfbot-v13/src/client/websocket/WebSocketShard.js`: use cursor-backed gateway queue with compatible priority insertion and destroy cleanup.
- Create `tests/vendor/selfbotClientOptions.test.ts`: verify app client options factory if extracted.
- Create `tests/vendor/requestHandlerBackoff.test.ts`: verify retry delay calculation is bounded and grows.
- Create `tests/vendor/websocketQueue.test.ts`: verify FIFO, priority, and destroy queue reset semantics for the new queue helpers if exported/testable.

## Task 1: Extract and Test Low-Memory Client Options

**Files:**
- Create: `src/discordClientOptions.ts`
- Modify: `src/index.ts:4-25`
- Test: `tests/vendor/selfbotClientOptions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/vendor/selfbotClientOptions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createDiscordClientOptions } from "../../src/discordClientOptions";

describe("createDiscordClientOptions", () => {
  it("uses low-memory message cache and active sweepers", () => {
    const options = createDiscordClientOptions();

    expect(options.restRequestTimeout).toBe(15_000);
    expect(options.retryLimit).toBe(2);
    expect(options.restGlobalRateLimit).toBe(45);
    expect(options.sweepers).toEqual({
      messages: { interval: 300, lifetime: 600 },
      threads: { interval: 3600, lifetime: 14400 },
    });

    expect(options.partials).toEqual(["USER", "CHANNEL", "GUILD_MEMBER", "MESSAGE"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run tests/vendor/selfbotClientOptions.test.ts`

Expected: FAIL with module not found for `src/discordClientOptions`.

- [ ] **Step 3: Add the client options factory**

Create `src/discordClientOptions.ts`:

```ts
import { Options } from "discord.js-selfbot-v13";

export function createDiscordClientOptions() {
  return {
    makeCache: Options.cacheWithLimits({
      ...Options.defaultMakeCacheSettings,
      MessageManager: 25,
      ReactionManager: 0,
      ReactionUserManager: 0,
      PresenceManager: 0,
    }),
    partials: ["USER", "CHANNEL", "GUILD_MEMBER", "MESSAGE"],
    sweepers: {
      messages: { interval: 300, lifetime: 600 },
      threads: { interval: 3600, lifetime: 14400 },
    },
    restRequestTimeout: 15_000,
    retryLimit: 2,
    restGlobalRateLimit: 45,
  };
}
```

- [ ] **Step 4: Use the factory in the app entry point**

Modify `src/index.ts`:

```ts
import { Client } from "discord.js-selfbot-v13";
import { config } from "./config";
import { closeDatabase, initializeDatabase } from "./database/drizzle";
import { createDiscordClientOptions } from "./discordClientOptions";
```

Replace:

```ts
const client = new Client();
```

with:

```ts
const client = new Client(createDiscordClientOptions());
```

- [ ] **Step 5: Run the focused test**

Run: `pnpm exec vitest run tests/vendor/selfbotClientOptions.test.ts`

Expected: PASS.

- [ ] **Step 6: Run typecheck**

Run: `pnpm run typecheck`

Expected: PASS. If TypeScript cannot type `Options` from the vendor package, add a local return type only if necessary; do not weaken the factory to `any`.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/discordClientOptions.ts src/index.ts tests/vendor/selfbotClientOptions.test.ts
git commit -m "perf: tune selfbot client runtime options"
```

## Task 2: Add Per-Client REST Dispatcher and Cached Super Properties

**Files:**
- Modify: `vendor/discord.js-selfbot-v13/src/rest/RESTManager.js:1-69`
- Modify: `vendor/discord.js-selfbot-v13/src/rest/APIRequest.js:1-166`

- [ ] **Step 1: Add REST manager state**

Modify `vendor/discord.js-selfbot-v13/src/rest/RESTManager.js` imports:

```js
const { Collection } = require('@discordjs/collection');
const makeFetchCookie = require('fetch-cookie');
const { CookieJar } = require('tough-cookie');
const { buildConnector, Client: UndiciClient, ProxyAgent, fetch: fetchOriginal } = require('undici');
const APIRequest = require('./APIRequest');
const routeBuilder = require('./APIRouter');
const RequestHandler = require('./RequestHandler');
const { Error } = require('../errors');
const { ciphers } = require('../util/Constants');
const { Endpoints } = require('../util/Constants');
const Util = require('../util/Util');
```

- [ ] **Step 2: Add per-client dispatcher fields and helper methods**

Inside `RESTManager` constructor after `this.fetch = ...`, add:

```js
this.dispatcher = null;
this.superPropertiesSource = null;
this.superPropertiesHeader = null;
```

Add methods before `request(method, url, options = {})`:

```js
getDispatcher() {
  if (this.dispatcher) return this.dispatcher;

  const proxy = Util.checkUndiciProxyAgent(this.client.options.http.agent);
  if (proxy) {
    this.dispatcher = new ProxyAgent({
      ...proxy,
      ciphers: ciphers.join(':'),
    });
  } else {
    this.dispatcher = new UndiciClient('https://discord.com', {
      connect: buildConnector({ ciphers: ciphers.join(':') }),
    });
  }

  return this.dispatcher;
}

getSuperPropertiesHeader() {
  const source = JSON.stringify(this.client.options.ws.properties);
  if (source !== this.superPropertiesSource) {
    this.superPropertiesSource = source;
    this.superPropertiesHeader = Buffer.from(source, 'ascii').toString('base64');
  }
  return this.superPropertiesHeader;
}
```

- [ ] **Step 3: Remove module-global dispatcher from APIRequest**

Modify `vendor/discord.js-selfbot-v13/src/rest/APIRequest.js` imports to:

```js
const Buffer = require('node:buffer').Buffer;
const { setTimeout } = require('node:timers');
const { FormData } = require('undici');
```

Remove:

```js
const { FormData, buildConnector, Client, ProxyAgent } = require('undici');
const { ciphers } = require('../util/Constants');
const Util = require('../util/Util');

let agent = null;
```

- [ ] **Step 4: Use REST manager dispatcher and cached header**

In `APIRequest.make`, delete the `if (!agent) { ... }` block.

Replace the `x-super-properties` header construction with:

```js
'x-super-properties': this.rest.getSuperPropertiesHeader(),
```

Replace fetch dispatcher:

```js
dispatcher: agent,
```

with:

```js
dispatcher: this.rest.getDispatcher(),
```

- [ ] **Step 5: Run vendor lint through root lint**

Run: `pnpm run lint`

Expected: PASS or existing unrelated lint failures. If failures are in edited vendor files, fix them.

- [ ] **Step 6: Commit**

Run:

```bash
git add vendor/discord.js-selfbot-v13/src/rest/RESTManager.js vendor/discord.js-selfbot-v13/src/rest/APIRequest.js
git commit -m "perf: cache selfbot rest dispatcher metadata"
```

## Task 3: Add REST Retry Backoff With Jitter

**Files:**
- Modify: `vendor/discord.js-selfbot-v13/src/rest/RequestHandler.js:1-505`
- Test: `tests/vendor/requestHandlerBackoff.test.ts`

- [ ] **Step 1: Export a pure backoff helper for tests**

Add near the top of `vendor/discord.js-selfbot-v13/src/rest/RequestHandler.js` after `calculateReset`:

```js
function calculateRetryDelay(retryCount, random = Math.random) {
  const base = 250;
  const max = 5_000;
  const exponential = Math.min(max, base * 2 ** Math.max(0, retryCount - 1));
  return exponential + Math.floor(random() * base);
}
```

At the bottom, replace:

```js
module.exports = RequestHandler;
```

with:

```js
module.exports = RequestHandler;
module.exports.calculateRetryDelay = calculateRetryDelay;
```

- [ ] **Step 2: Write the focused helper test**

Create `tests/vendor/requestHandlerBackoff.test.ts`:

```ts
import { describe, expect, it } from "vitest";

const { calculateRetryDelay } = await import(
  "../../vendor/discord.js-selfbot-v13/src/rest/RequestHandler.js"
);

describe("calculateRetryDelay", () => {
  it("increases exponentially and applies bounded jitter", () => {
    expect(calculateRetryDelay(1, () => 0)).toBe(250);
    expect(calculateRetryDelay(2, () => 0)).toBe(500);
    expect(calculateRetryDelay(3, () => 0)).toBe(1000);
    expect(calculateRetryDelay(10, () => 0)).toBe(5000);
    expect(calculateRetryDelay(1, () => 0.999)).toBe(499);
  });
});
```

- [ ] **Step 3: Run the helper test**

Run: `pnpm exec vitest run tests/vendor/requestHandlerBackoff.test.ts`

Expected: PASS.

- [ ] **Step 4: Apply backoff to network errors**

In `RequestHandler.execute`, replace the catch block after `request.make(...)` with:

```js
    } catch (error) {
      if (request.retries === this.manager.client.options.retryLimit) {
        throw new HTTPError(
          error.message,
          error.constructor.name,
          error.status,
          request,
        );
      }

      request.retries++;
      const delay = calculateRetryDelay(request.retries);
      this.manager.client.emit(
        DEBUG,
        `[Request Handler] Retrying failed request after ${delay}ms.\n  Method : ${request.method}\n  Path   : ${request.path}\n  Route  : ${request.route}\n  Retry  : ${request.retries}`,
      );
      await sleep(delay);
      return this.execute(request);
    }
```

- [ ] **Step 5: Apply backoff to 5xx responses**

In the 5xx block, replace:

```js
      request.retries++;
      return this.execute(request);
```

with:

```js
      request.retries++;
      const delay = calculateRetryDelay(request.retries);
      this.manager.client.emit(
        DEBUG,
        `[Request Handler] Retrying server error after ${delay}ms.\n  Method : ${request.method}\n  Path   : ${request.path}\n  Route  : ${request.route}\n  Status : ${res.status}\n  Retry  : ${request.retries}`,
      );
      await sleep(delay);
      return this.execute(request);
```

- [ ] **Step 6: Run focused and full tests**

Run: `pnpm exec vitest run tests/vendor/requestHandlerBackoff.test.ts`

Expected: PASS.

Run: `pnpm run test`

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add vendor/discord.js-selfbot-v13/src/rest/RequestHandler.js tests/vendor/requestHandlerBackoff.test.ts
git commit -m "perf: back off selfbot rest retries"
```

## Task 4: Clean Voice Receiver Timers and Reduce RTP Buffer Work

**Files:**
- Modify: `vendor/discord.js-selfbot-v13/src/client/voice/receiver/PacketHandler.js:1-280`

- [ ] **Step 1: Patch AES decrypt concat allocation**

In `parseBuffer`, replace:

```js
        packet = Buffer.concat([
          decipheriv.update(encrypted),
          decipheriv.final(),
        ]);
```

with:

```js
        const updated = decipheriv.update(encrypted);
        const final = decipheriv.final();
        packet = final.length === 0 ? updated : Buffer.concat([updated, final]);
```

- [ ] **Step 2: Patch XChaCha auth tag concat allocation**

Replace:

```js
          Buffer.concat([encrypted, authTag]),
```

with:

```js
          buffer.subarray(headerSize, buffer.length - UNPADDED_NONCE_LENGTH),
```

- [ ] **Step 3: Add speaking timeout cleanup**

In `destroyAllStream()`, after clearing video streams, add:

```js
    for (const timeout of this.speakingTimeouts.values()) {
      clearTimeout(timeout);
    }
    const clearedSpeakingTimeouts = this.speakingTimeouts.size;
    this.speakingTimeouts.clear();
    this.emit('debug', {
      message: 'Destroyed voice receiver streams',
      audioStreams: this.streams.size,
      videoStreams: this.videoStreams.size,
      speakingTimeouts: clearedSpeakingTimeouts,
    });
```

Then adjust ordering so the counts are captured before `streams.clear()` and `videoStreams.clear()`:

```js
  destroyAllStream() {
    const audioStreams = this.streams.size;
    const videoStreams = this.videoStreams.size;
    for (const stream of this.streams.values()) {
      stream.stream.destroy();
    }
    this.streams.clear();
    for (const stream of this.videoStreams.values()) {
      stream.destroy();
    }
    this.videoStreams.clear();
    for (const timeout of this.speakingTimeouts.values()) {
      clearTimeout(timeout);
    }
    const speakingTimeouts = this.speakingTimeouts.size;
    this.speakingTimeouts.clear();
    this.emit('debug', {
      message: 'Destroyed voice receiver streams',
      audioStreams,
      videoStreams,
      speakingTimeouts,
    });
  }
```

- [ ] **Step 4: Run lint**

Run: `pnpm run lint`

Expected: PASS or only unrelated existing failures. Fix edited-file failures.

- [ ] **Step 5: Run tests**

Run: `pnpm run test`

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add vendor/discord.js-selfbot-v13/src/client/voice/receiver/PacketHandler.js
git commit -m "perf: clean up selfbot voice receiver state"
```

## Task 5: Replace Gateway Queue Shift With Cursor Queue

**Files:**
- Modify: `vendor/discord.js-selfbot-v13/src/client/websocket/WebSocketShard.js:108-120,818-954`

- [ ] **Step 1: Add queue cursor metadata**

In the `ratelimit` object, change:

```js
queue: [],
```

To:

```js
queue: [],
queueOffset: 0,
```

- [ ] **Step 2: Update priority insertion**

Replace `send(data, important = false)` with:

```js
  send(data, important = false) {
    if (important) {
      if (this.ratelimit.queueOffset === 0) {
        this.ratelimit.queue.unshift(data);
      } else {
        this.ratelimit.queue[--this.ratelimit.queueOffset] = data;
      }
    } else {
      this.ratelimit.queue.push(data);
    }
    this.processQueue();
  }
```

- [ ] **Step 3: Update queue processing**

Replace `processQueue()` with:

```js
  processQueue() {
    if (this.ratelimit.remaining === 0) return;
    if (this.ratelimit.queueOffset >= this.ratelimit.queue.length) return;
    if (this.ratelimit.remaining === this.ratelimit.total) {
      this.ratelimit.timer = setTimeout(() => {
        this.ratelimit.remaining = this.ratelimit.total;
        this.processQueue();
      }, this.ratelimit.time).unref();
    }
    while (this.ratelimit.remaining > 0) {
      const item = this.ratelimit.queue[this.ratelimit.queueOffset++];
      if (!item) {
        this._compactQueue();
        return;
      }
      this._send(item);
      this.ratelimit.remaining--;
    }
    this._compactQueue();
  }
```

- [ ] **Step 4: Add queue compaction helper**

Add before `destroy(...)`:

```js
  _compactQueue() {
    if (this.ratelimit.queueOffset === 0) return;
    if (this.ratelimit.queueOffset >= this.ratelimit.queue.length) {
      this.ratelimit.queue.length = 0;
      this.ratelimit.queueOffset = 0;
      return;
    }
    if (this.ratelimit.queueOffset > 512) {
      this.ratelimit.queue = this.ratelimit.queue.slice(this.ratelimit.queueOffset);
      this.ratelimit.queueOffset = 0;
    }
  }
```

- [ ] **Step 5: Reset cursor on destroy**

In `destroy`, after:

```js
this.ratelimit.queue.length = 0;
```

Add:

```js
this.ratelimit.queueOffset = 0;
```

- [ ] **Step 6: Run lint and tests**

Run: `pnpm run lint`

Expected: PASS or only unrelated existing failures. Fix edited-file failures.

Run: `pnpm run test`

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add vendor/discord.js-selfbot-v13/src/client/websocket/WebSocketShard.js
git commit -m "perf: optimize selfbot gateway send queue"
```

## Task 6: Final Verification and Manual Runtime Notes

**Files:**
- Modify only if verification exposes issues.

- [ ] **Step 1: Run full lint**

Run: `pnpm run lint`

Expected: PASS.

- [ ] **Step 2: Run full typecheck**

Run: `pnpm run typecheck`

Expected: PASS.

- [ ] **Step 3: Run full tests**

Run: `pnpm run test`

Expected: PASS.

- [ ] **Step 4: Run build**

Run: `pnpm run build`

Expected: PASS.

- [ ] **Step 5: Inspect git diff**

Run: `git diff --stat HEAD~5..HEAD` if each task was committed, or `git diff --stat` if not.

Expected: changes limited to app client options, vendor REST, vendor voice, vendor WebSocket, tests, and this plan/spec.

- [ ] **Step 6: Record manual Discord runtime limitation**

If no Discord token/runtime environment is available, final response must state:

```text
Automated verification passed. I could not perform live Discord runtime verification in this environment. Manual checks still needed: login, message capture, backlog sync, voice connect, voice record, disconnect, reconnect.
```

- [ ] **Step 7: Commit verification fixes only if needed**

If Step 1-4 required fixes, commit only those fixes:

```bash
git add <fixed-files>
git commit -m "fix: stabilize selfbot optimization verification"
```

## Self-Review

- Spec coverage: app runtime config is Task 1; REST dispatcher/header/backoff is Tasks 2-3; voice cleanup/allocation is Task 4; gateway queue is Task 5; verification/manual runtime note is Task 6.
- Placeholder scan: no TBD/TODO/fill-in steps remain; each code step includes concrete snippets and paths.
- Type consistency: `createDiscordClientOptions`, `calculateRetryDelay`, `getDispatcher`, `getSuperPropertiesHeader`, `_compactQueue`, and `queueOffset` are introduced before use and named consistently.
