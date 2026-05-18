# Winston Logging Refactor Design

## Goal

Refactor project logging from Pino to Winston and clean up logging-related dependencies without changing application behavior.

## Scope

- Replace `pino` and `pino-pretty` with `winston`.
- Remove `pino-http` if no code still uses it.
- Keep logging access centralized in `src/logger.ts`.
- Preserve current exported logger API shape where practical: `logger` and `createChildLogger(context)`.
- Normalize log output and levels across the codebase.
- Avoid unrelated feature work or broad refactors.

## Logging Architecture

`src/logger.ts` remains the only logging entry point. It will create one Winston logger with npm levels:

- `error`
- `warn`
- `info`
- `http`
- `verbose`
- `debug`
- `silly`

`LOG_LEVEL` validation will be updated to accept these Winston standard levels. Default behavior stays environment-aware: development can log more detail, production stays concise.

## Outputs

Winston will write to:

1. Console
   - Pretty, colorized, timestamped output.
   - Includes logger context, message, and metadata.
2. `logs/app.log`
   - JSON format.
   - Includes all logs at configured level and above.
3. `logs/error.log`
   - JSON format.
   - Includes error-level logs only.

The logger should create the `logs/` directory at runtime if needed. `logs/` should be ignored by git.

## Metadata and Error Handling

Existing log calls mostly remain valid. `src/logger.ts` will format metadata centrally so individual call sites do not need custom serialization.

Handled metadata shapes:

- `{ error: err }`
- `{ err }`
- `{ reason }`
- extra plain objects used by existing log calls

Errors should serialize with message, stack, name, code, statusCode, and any relevant enumerable fields. Non-error metadata should pass through without lossy conversion.

## Code Changes

Expected files:

- `package.json` and lockfile: add `winston`, remove Pino packages that become unused.
- `src/logger.ts`: rewrite from Pino to Winston.
- `src/config.ts`: expand `LOG_LEVEL` schema.
- `.gitignore`: ignore `logs/` if missing.
- Logger call sites: update only if TypeScript or Winston format compatibility requires it.

Known logger consumers include:

- `src/index.ts`
- `src/webserver.ts`
- `src/middleware.ts`
- `src/voiceController.ts`
- `src/media/mediaController.ts`
- `src/media/screenShareController.ts`
- `src/moderation/broadcaster.ts`
- `src/moderation/messageCapture.ts`
- `src/streaming/transcoder.ts`

Additional consumers should be found by grep during implementation.

## Dependency Cleanup

Remove packages only after confirming no imports remain:

- `pino`
- `pino-pretty`
- `pino-http`

Do not remove unrelated dependencies in this pass.

## Testing and Verification

Run:

- `pnpm install` or equivalent lockfile update after dependency changes.
- `pnpm run typecheck`
- `pnpm run test`
- `pnpm run lint`

Also verify log behavior with a short runtime command or startup check:

- console output is readable and includes context.
- `logs/app.log` is created.
- `logs/error.log` is created when an error log occurs.

## Success Criteria

- No Pino imports remain.
- Winston is the only logging backend.
- Existing application logging calls compile.
- Log levels are consistent and configurable via `LOG_LEVEL`.
- Console and file logging both work.
- Tests, typecheck, and lint pass.
