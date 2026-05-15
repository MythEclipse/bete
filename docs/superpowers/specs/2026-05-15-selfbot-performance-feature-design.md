# Selfbot Performance and Feature Optimization Design

## Goal

Improve `vendor/discord.js-selfbot-v13` and the app's Discord client setup for lower memory use, more stable REST behavior, lower voice hot-path allocation, and better observability while preserving the existing public API used by the bot.

## Scope

This is an aggressive optimization pass. It includes app-level client configuration plus internal vendor patches in REST, voice, and gateway queue handling. Changes must remain compatible with existing imports from `discord.js-selfbot-v13` and the current moderation/voice flows.

## App Runtime Configuration

`src/index.ts` will instantiate `Client` with explicit low-memory options instead of using `new Client()` defaults. Message cache will be reduced or disabled because captured messages are persisted to the database. Sweepers will remove old message/thread cache entries. REST retry/timeouts will remain conservative to avoid bursty backlog sync behavior.

## Vendor REST Improvements

`src/rest/APIRequest.js` currently uses a module-level Undici dispatcher and rebuilds expensive headers per request. The dispatcher will become per REST manager/client so proxy or client-specific settings cannot leak across clients. The `x-super-properties` header will be cached and reused while client properties remain unchanged. `RequestHandler` will add exponential backoff with jitter for network aborts and 5xx retries.

## Vendor Voice Improvements

`PacketHandler` will clean all speaking timeouts during stream destruction. Voice stream cleanup will clear audio and video stream maps reliably. RTP/decrypt hot-path allocation will be reduced where possible without changing emitted packet payloads or stream API behavior.

## Vendor Gateway Queue Improvements

`WebSocketShard` will replace repeated `Array.shift()` dequeue with a cursor-backed queue to avoid O(n) work under high gateway send volume. `send(data, important)` behavior will remain compatible, including priority insertion.

## Observability

Vendor internals will emit or debug useful operational data where it does not create noisy logs by default: REST retry/backoff attempts, voice stream cleanup counts, and gateway queue size/rate-limit state. The app can wire these later if needed.

## Error Handling

REST retry backoff must not bypass existing rate limit handling. Captcha and MFA retry paths keep their current behavior. Voice cleanup must ignore already-closed streams and never throw during disconnect. Gateway queue changes must clear queued state on destroy exactly as before.

## Testing

Run `pnpm run lint`, `pnpm run typecheck`, and `pnpm run test`. If runtime Discord login/voice testing cannot be performed in this environment, report that limitation explicitly and identify the manual test path: login, message capture, backlog sync, voice connect, voice record, disconnect/reconnect.
