# Deprecated Dependency Removal Design

## Goal

Remove deprecated packages from the pnpm lockfile where practical. Prefer maintained replacements or upgrades. If no maintained replacement exists, vendor upstream code as a submodule/workspace and patch dependency metadata there.

## Scope

Current deprecated sources:

- `drizzle-kit` pulls `@esbuild-kit/esm-loader` and `@esbuild-kit/core-utils`.
- `discord.js-selfbot-v13` pulls `otplib@12` plugins.
- `@discordjs/opus` pulls `@discordjs/node-pre-gyp`, which pulls `npmlog`, `are-we-there-yet`, `gauge`, `rimraf@3`, `glob@7`, and `inflight`.
- `@lng2004/node-datachannel` and `better-sqlite3` pull `prebuild-install`.

Existing workspace packages:

- `vendor/discord.js-selfbot-v13`
- `vendor/discord-video-stream`

## Approach

1. Upgrade direct dependencies first and re-check `pnpm why` plus npm deprecation metadata.
2. Patch vendored workspace dependencies when project already owns package source.
3. Replace direct packages only when runtime compatibility is clear.
4. Add submodules only for packages that cannot be replaced or upgraded without keeping deprecated transitive packages.

## Package Plan

### `drizzle-kit`

Try latest compatible `drizzle-kit`. If latest still depends on `@esbuild-kit/*`, keep current version unless project commands fail, because vendoring `drizzle-kit` only to remove dev-only install warnings has high maintenance cost.

### `discord.js-selfbot-v13`

Patch `vendor/discord.js-selfbot-v13` dependency graph to remove `otplib@12` if code is compatible with `otplib@13`. Verify by installing and running typecheck/tests. Keep peer/package name unchanged.

### `@discordjs/opus`

Find maintained Opus alternative compatible with current recorder and `@discordjs/voice`. Prefer removing direct `@discordjs/opus` only if code and tests still pass. If native Opus remains needed and every maintained option drags deprecated install tooling, vendor the smallest dependency owner.

### `prebuild-install` sources

Do not patch native package install chains blindly. For `better-sqlite3`, keep upstream unless latest removes `prebuild-install`. For `@lng2004/node-datachannel`, try latest first through `discord-video-stream`; vendor only if strict lockfile cleanup remains blocked and build still works.

### `discord-video-stream`

Keep as workspace submodule. Patch devDependency `discord.js-selfbot-v13` to use workspace reference so installs do not fetch deprecated registry selfbot.

## Verification

After each dependency change:

1. Run `pnpm install`.
2. Run `pnpm why` for known deprecated package names.
3. Check npm deprecation metadata for remaining lockfile packages.
4. Run `pnpm run typecheck`.
5. Run `pnpm run test`.

## Success Criteria

- Root `package.json` uses workspace paths for vendored packages.
- `pnpm-lock.yaml` has no deprecated packages where maintained replacements exist.
- Any remaining deprecated packages are documented as no-maintained-replacement and owned by a vendored submodule or unavoidable native upstream.
- Typecheck and tests pass.

## Final Audit Result

Deprecated packages removed from active dependency graph:

- `@otplib/plugin-crypto`, `@otplib/plugin-thirty-two`, `@otplib/preset-default` — removed by patching `vendor/discord.js-selfbot-v13` to `otplib@13`.
- `@discordjs/opus` direct dependency — removed from root dependencies.
- `@discordjs/node-pre-gyp`, `npmlog`, `are-we-there-yet`, `gauge`, `rimraf@3`, `glob@7`, `inflight` — removed by eliminating `@discordjs/opus` auto-installed peer path.

Remaining unavoidable deprecated packages:

- `@esbuild-kit/core-utils@3.3.2` via `drizzle-kit@0.31.10`.
- `@esbuild-kit/esm-loader@2.6.5` via `drizzle-kit@0.31.10`.
- `prebuild-install@7.1.3` via `better-sqlite3@12.10.0` and `@lng2004/node-datachannel@0.32.0-20260202`.

Reason these remain:

- `drizzle-kit@0.31.10` is latest stable and still depends on `@esbuild-kit/*`.
- `better-sqlite3@12.10.0` is latest stable and still uses `prebuild-install` for native binary install.
- `@lng2004/node-datachannel@0.32.0-20260202` is latest available and still uses `prebuild-install` for native binary install.

The upstream repositories are vendored as submodules for future patching if strict zero-deprecated lockfile becomes worth maintaining as forks:

- `vendor/drizzle-orm`
- `vendor/better-sqlite3`
- `vendor/node-datachannel`
