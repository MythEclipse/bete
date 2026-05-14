# Selfbot Workspace Submodule Design

## Goal

Replace the npm-resolved `discord.js-selfbot-v13` dependency with a custom repository checked into this project as a git submodule and consumed through pnpm workspace resolution.

## Approach

Use `vendor/discord.js-selfbot-v13` as the submodule path. Initialize it from `https://github.com/aiko-chan-ai/discord.js-selfbot-v13.git`, then change the submodule repository `origin` remote to `ssh://git@43.134.105.109:22222/exceed/discord.js-selfbot.git`.

Configure pnpm workspaces so the root project and the vendored package are both workspace packages. Change the root dependency from the npm version range to `workspace:*`, forcing pnpm to resolve `discord.js-selfbot-v13` from the submodule package.

## Files to Change

- `.gitmodules`: track the new submodule path and URL.
- `pnpm-workspace.yaml`: include the root package and `vendor/discord.js-selfbot-v13`.
- `package.json`: change `discord.js-selfbot-v13` to `workspace:*`.
- `pnpm-lock.yaml`: refresh dependency resolution after the workspace change.

## Validation

After the submodule and dependency changes, run `pnpm install` to update the workspace lockfile and links, then run `pnpm run typecheck` to confirm the app still resolves the selfbot package.

If the vendored package requires a build step before TypeScript can resolve it, use that package's own scripts and rerun root validation.
