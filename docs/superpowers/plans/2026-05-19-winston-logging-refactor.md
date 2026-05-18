# Winston Logging Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Pino logging with Winston, normalize log levels, and write readable console plus JSON file logs without changing application behavior.

**Architecture:** Keep `src/logger.ts` as the single logging entry point. Rebuild it around one Winston logger with child context support, centralized metadata/error serialization, colorized console output, and JSON file transports. Keep call-site changes minimal and only adjust imports/usages that fail after the backend swap.

**Tech Stack:** TypeScript, Node.js ESM, Winston, Zod config validation, pnpm, Vitest, Biome.

---

## File Structure

- Modify: `package.json` — replace Pino dependencies with Winston.
- Modify: `pnpm-lock.yaml` — update via pnpm after dependency changes.
- Modify: `src/config.ts` — expand `LOG_LEVEL` enum to Winston npm levels.
- Modify: `src/logger.ts` — replace Pino implementation with Winston implementation.
- Modify: `.gitignore` — ignore runtime `logs/` directory.
- Test: `tests/logger.test.ts` — add focused logger behavior tests for level validation, error serialization, and file output format helpers.
- Inspect and modify only if needed: files importing `createChildLogger` or `logger`.

## Important Git Note

The prior design-spec commit unexpectedly included vendor submodule entries that were already staged in the working tree. Before making implementation commits, run `git status --short` and do not stage unrelated vendor or existing user changes. Stage only files touched by this plan.

---

### Task 1: Add Logger Tests Before Migration

**Files:**
- Create: `tests/logger.test.ts`
- Modify: none

- [ ] **Step 1: Write tests for Winston-compatible logger behavior**

Create `tests/logger.test.ts` with this content:

```ts
import { describe, expect, it } from "vitest";
import { formatLogMetadataForTest, serializeLogValueForTest } from "../src/logger";

class TestError extends Error {
  public code = "TEST_CODE";
  public statusCode = 418;

  constructor() {
    super("test failure");
    this.name = "TestError";
  }
}

describe("logger serialization", () => {
  it("serializes Error values with stable fields", () => {
    const serialized = serializeLogValueForTest(new TestError());

    expect(serialized).toMatchObject({
      name: "TestError",
      message: "test failure",
      code: "TEST_CODE",
      statusCode: 418,
    });
    expect(serialized).toHaveProperty("stack");
  });

  it("serializes nested error metadata keys", () => {
    const error = new TestError();

    expect(formatLogMetadataForTest({ error, err: error, reason: error })).toMatchObject({
      error: {
        name: "TestError",
        message: "test failure",
        code: "TEST_CODE",
        statusCode: 418,
      },
      err: {
        name: "TestError",
        message: "test failure",
        code: "TEST_CODE",
        statusCode: 418,
      },
      reason: {
        name: "TestError",
        message: "test failure",
        code: "TEST_CODE",
        statusCode: 418,
      },
    });
  });

  it("preserves plain metadata", () => {
    expect(
      formatLogMetadataForTest({ context: "bot", signal: "SIGINT", count: 2 }),
    ).toEqual({ context: "bot", signal: "SIGINT", count: 2 });
  });
});
```

- [ ] **Step 2: Run test to verify current implementation fails**

Run:

```bash
pnpm vitest run tests/logger.test.ts
```

Expected: FAIL because `formatLogMetadataForTest` and `serializeLogValueForTest` are not exported from `src/logger.ts` yet.

- [ ] **Step 3: Commit failing tests only**

```bash
git add tests/logger.test.ts
git commit -m "test: cover logger metadata serialization"
```

Expected: commit contains only `tests/logger.test.ts`.

---

### Task 2: Update Dependencies and Config Schema

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `src/config.ts`

- [ ] **Step 1: Update package dependencies**

Run:

```bash
pnpm remove pino pino-http pino-pretty
pnpm add winston
```

Expected:

- `package.json` dependencies no longer include `pino` or `pino-http`.
- `package.json` devDependencies no longer include `pino-pretty`.
- `package.json` dependencies include `winston`.
- `pnpm-lock.yaml` updates accordingly.

- [ ] **Step 2: Expand `LOG_LEVEL` validation**

In `src/config.ts`, replace the current `LOG_LEVEL` line:

```ts
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
```

with:

```ts
    LOG_LEVEL: z
      .enum(["error", "warn", "info", "http", "verbose", "debug", "silly"])
      .default("info"),
```

- [ ] **Step 3: Run targeted config tests**

Run:

```bash
pnpm vitest run tests/config.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit dependency and config changes**

```bash
git add package.json pnpm-lock.yaml src/config.ts
git commit -m "chore: switch logging dependency to winston"
```

Expected: commit contains only dependency files and `src/config.ts`.

---

### Task 3: Replace `src/logger.ts` With Winston Implementation

**Files:**
- Modify: `src/logger.ts`

- [ ] **Step 1: Replace logger implementation**

Replace entire `src/logger.ts` with:

```ts
import fs from "node:fs";
import path from "node:path";
import winston from "winston";

const isDev = process.env.NODE_ENV !== "production";
const logLevel = process.env.LOG_LEVEL || (isDev ? "debug" : "info");
const logsDir = path.resolve(process.cwd(), "logs");

fs.mkdirSync(logsDir, { recursive: true });

type LogMetadata = Record<string, unknown>;

type SerializedError = {
  name: string;
  message: string;
  stack?: string;
  code?: unknown;
  statusCode?: unknown;
} & Record<string, unknown>;

const serializeError = (error: Error): SerializedError => {
  const serialized: SerializedError = {
    name: error.name,
    message: error.message,
  };

  if (error.stack) {
    serialized.stack = error.stack;
  }

  const errorWithFields = error as Error & {
    code?: unknown;
    statusCode?: unknown;
    [key: string]: unknown;
  };

  if (errorWithFields.code !== undefined) {
    serialized.code = errorWithFields.code;
  }

  if (errorWithFields.statusCode !== undefined) {
    serialized.statusCode = errorWithFields.statusCode;
  }

  for (const [key, value] of Object.entries(errorWithFields)) {
    if (serialized[key] === undefined) {
      serialized[key] = value;
    }
  }

  return serialized;
};

const serializeLogValue = (value: unknown): unknown => {
  if (value instanceof Error) {
    return serializeError(value);
  }

  if (Array.isArray(value)) {
    return value.map(serializeLogValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        serializeLogValue(nestedValue),
      ]),
    );
  }

  return value;
};

const formatLogMetadata = (metadata: LogMetadata): LogMetadata => {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [key, serializeLogValue(value)]),
  );
};

const metadataFormat = winston.format((info) => {
  const { level, message, timestamp, ...metadata } = info;
  return {
    level,
    message,
    timestamp,
    ...formatLogMetadata(metadata),
  };
});

const consoleFormat = winston.format.printf((info) => {
  const { level, message, timestamp, context, ...metadata } = info;
  const contextLabel = context ? ` [${String(context)}]` : "";
  const metadataText = Object.keys(metadata).length
    ? ` ${JSON.stringify(metadata)}`
    : "";

  return `${timestamp} ${level}${contextLabel}: ${message}${metadataText}`;
});

export const logger = winston.createLogger({
  level: logLevel,
  levels: winston.config.npm.levels,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    metadataFormat(),
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        metadataFormat(),
        consoleFormat,
      ),
    }),
    new winston.transports.File({
      filename: path.join(logsDir, "app.log"),
      format: winston.format.json(),
    }),
    new winston.transports.File({
      filename: path.join(logsDir, "error.log"),
      level: "error",
      format: winston.format.json(),
    }),
  ],
});

export const createChildLogger = (context: string) => {
  return logger.child({ context });
};

export const serializeLogValueForTest = serializeLogValue;
export const formatLogMetadataForTest = formatLogMetadata;
```

- [ ] **Step 2: Run logger tests**

Run:

```bash
pnpm vitest run tests/logger.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run TypeScript check**

Run:

```bash
pnpm run typecheck
```

Expected: either PASS or type errors only from logger call sites needing Winston-compatible adjustments.

- [ ] **Step 4: Commit Winston logger implementation**

If typecheck passes:

```bash
git add src/logger.ts
git commit -m "refactor: replace pino logger with winston"
```

Expected: commit contains only `src/logger.ts`.

If typecheck fails in logger call sites, do not commit yet. Continue to Task 4, then commit `src/logger.ts` together with required call-site fixes.

---

### Task 4: Fix Logger Call Sites Only If Needed

**Files:**
- Inspect: `src/**/*.ts`
- Modify only files with TypeScript errors from Task 3.

- [ ] **Step 1: Find logger imports and usages**

Run:

```bash
grep -rn "createChildLogger\|from \"./logger\"\|from \"../logger\"\|logger\.\|log\." src --include="*.ts"
```

Expected: list of logger imports and method calls.

- [ ] **Step 2: Fix pino-style calls if TypeScript requires it**

Use this mapping only where needed:

Before:

```ts
logger.info({ signal }, "Graceful shutdown initiated");
```

After:

```ts
logger.info("Graceful shutdown initiated", { signal });
```

Before:

```ts
logger.error({ error }, "Failed to initialize app");
```

After:

```ts
logger.error("Failed to initialize app", { error });
```

Before:

```ts
logger.warn({ error }, "Backlog sync failed");
```

After:

```ts
logger.warn("Backlog sync failed", { error });
```

Plain string calls remain unchanged:

```ts
logger.info("Creating Discord client");
logger.debug("Queue empty, no playback started");
```

- [ ] **Step 3: Re-run TypeScript check**

Run:

```bash
pnpm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit call-site fixes**

```bash
git add src/logger.ts src/index.ts src/webserver.ts src/middleware.ts src/voiceController.ts src/media/mediaController.ts src/media/screenShareController.ts src/moderation/broadcaster.ts src/moderation/messageCapture.ts src/streaming/transcoder.ts
git commit -m "refactor: normalize logger call sites for winston"
```

Expected: commit stages only files actually changed. If some listed files are unchanged, `git add` is harmless.

---

### Task 5: Ignore Runtime Log Files

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Check whether `logs/` is already ignored**

Run:

```bash
grep -n "^logs/$" .gitignore || true
```

Expected: either one matching line or no output.

- [ ] **Step 2: Add `logs/` if missing**

If no output from Step 1, append:

```gitignore
logs/
```

- [ ] **Step 3: Verify ignore rule**

Run:

```bash
git check-ignore logs/app.log
```

Expected output:

```text
logs/app.log
```

- [ ] **Step 4: Commit ignore rule**

```bash
git add .gitignore
git commit -m "chore: ignore runtime log files"
```

Expected: commit contains only `.gitignore`. If `.gitignore` already ignored `logs/`, skip this commit.

---

### Task 6: Verify No Pino Usage Remains

**Files:**
- Inspect: repository source and package files

- [ ] **Step 1: Search for Pino imports/usages**

Run:

```bash
grep -rn "pino\|pino-http\|pino-pretty" src package.json pnpm-lock.yaml --exclude-dir=node_modules || true
```

Expected: no output. If output appears only in old comments/docs outside runtime files, remove or update those comments/docs if they are part of the changed scope.

- [ ] **Step 2: Search for Winston dependency**

Run:

```bash
grep -n '"winston"' package.json
```

Expected output contains one `winston` dependency line.

- [ ] **Step 3: Run focused tests**

Run:

```bash
pnpm vitest run tests/logger.test.ts tests/config.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit cleanup if any files changed**

```bash
git status --short
git add <only-files-changed-by-this-task>
git commit -m "chore: remove remaining pino references"
```

Expected: commit only if Step 1 required changes.

---

### Task 7: Runtime Log Output Verification

**Files:**
- No source changes expected

- [ ] **Step 1: Run one-shot logger command**

Run:

```bash
node --import tsx -e 'import { logger } from "./src/logger.ts"; logger.info("logger smoke info", { context: "smoke", value: 1 }); logger.error("logger smoke error", { error: new Error("smoke failure") }); await new Promise((resolve) => setTimeout(resolve, 250));'
```

Expected:

- Console shows readable timestamped logs.
- Info line includes `smoke` context metadata.
- Error line includes serialized error metadata.

- [ ] **Step 2: Verify app log file exists and contains JSON**

Run:

```bash
test -s logs/app.log && node -e 'const fs = require("fs"); const line = fs.readFileSync("logs/app.log", "utf8").trim().split("\n").at(-1); const parsed = JSON.parse(line); if (!parsed.level || !parsed.message) process.exit(1); console.log(parsed.level + ":" + parsed.message);'
```

Expected output includes:

```text
error:logger smoke error
```

- [ ] **Step 3: Verify error log file exists and contains error JSON**

Run:

```bash
test -s logs/error.log && node -e 'const fs = require("fs"); const line = fs.readFileSync("logs/error.log", "utf8").trim().split("\n").at(-1); const parsed = JSON.parse(line); if (parsed.level !== "error") process.exit(1); console.log(parsed.level + ":" + parsed.message);'
```

Expected output:

```text
error:logger smoke error
```

---

### Task 8: Full Validation

**Files:**
- No source changes expected unless validation reveals issues.

- [ ] **Step 1: Run typecheck**

Run:

```bash
pnpm run typecheck
```

Expected: PASS.

- [ ] **Step 2: Run test suite**

Run:

```bash
pnpm run test
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
pnpm run lint
```

Expected: PASS.

- [ ] **Step 4: Inspect final git status**

Run:

```bash
git status --short
```

Expected: no uncommitted changes from this plan except ignored `logs/` files. Existing unrelated user changes may still appear; do not stage them.

- [ ] **Step 5: Final commit if validation fixes were needed**

If validation required fixes:

```bash
git add <only-files-changed-by-validation-fixes>
git commit -m "fix: stabilize winston logging migration"
```

Expected: commit contains only validation fixes.

---

## Self-Review Notes

- Spec coverage: dependency swap, `LOG_LEVEL`, centralized logger, console/file output, error serialization, Pino removal, and validation all have tasks.
- Placeholder scan: no TBD/TODO/fill-in placeholders remain; `<only-files-changed-by-this-task>` and similar are explicit safety instructions to avoid staging unrelated user changes.
- Type consistency: test helper names match `src/logger.ts` exports; Winston npm levels match `src/config.ts`; file names match spec.
