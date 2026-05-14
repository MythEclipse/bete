# Selfbot Workspace Submodule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the npm `discord.js-selfbot-v13` dependency with a custom git submodule consumed through pnpm workspace resolution.

**Architecture:** The vendored selfbot library lives at `vendor/discord.js-selfbot-v13` as a git submodule. The root package depends on it with `workspace:*`, and `pnpm-workspace.yaml` includes both the root package and the vendored package while preserving the existing `onlyBuiltDependencies` settings.

**Tech Stack:** Git submodules, pnpm workspaces, TypeScript, existing Node.js package scripts.

---

## File Structure

- Create: `.gitmodules` if missing; otherwise modify it to include `vendor/discord.js-selfbot-v13`.
- Create: `vendor/discord.js-selfbot-v13` via `git submodule add`; do not create files in this directory manually.
- Modify: `pnpm-workspace.yaml` to add `packages` while preserving `onlyBuiltDependencies`.
- Modify: `package.json` dependency `discord.js-selfbot-v13` from `^3.7.1` to `workspace:*`.
- Modify: `pnpm-lock.yaml` by running pnpm, not by hand.

### Task 1: Add the selfbot repository as a submodule

**Files:**
- Create/Modify: `.gitmodules`
- Create: `vendor/discord.js-selfbot-v13`

- [ ] **Step 1: Confirm there is no existing submodule path**

Run:

```bash
git submodule status --recursive || true
test ! -e vendor/discord.js-selfbot-v13
```

Expected: either no existing submodule output, or output that does not include `vendor/discord.js-selfbot-v13`; the `test` command exits successfully.

- [ ] **Step 2: Add the upstream repository as a submodule**

Run:

```bash
git submodule add https://github.com/aiko-chan-ai/discord.js-selfbot-v13.git vendor/discord.js-selfbot-v13
```

Expected: git clones the repository into `vendor/discord.js-selfbot-v13` and creates or updates `.gitmodules`.

- [ ] **Step 3: Change the submodule remote to the internal SSH repository**

Run:

```bash
git -C vendor/discord.js-selfbot-v13 remote set-url origin ssh://git@43.134.105.109:22222/exceed/discord.js-selfbot.git
git config -f .gitmodules submodule.vendor/discord.js-selfbot-v13.url ssh://git@43.134.105.109:22222/exceed/discord.js-selfbot.git
git submodule sync vendor/discord.js-selfbot-v13
```

Expected: both the submodule checkout and `.gitmodules` use `ssh://git@43.134.105.109:22222/exceed/discord.js-selfbot.git`.

- [ ] **Step 4: Verify submodule metadata**

Run:

```bash
git -C vendor/discord.js-selfbot-v13 remote get-url origin
git config -f .gitmodules --get submodule.vendor/discord.js-selfbot-v13.path
git config -f .gitmodules --get submodule.vendor/discord.js-selfbot-v13.url
```

Expected output:

```text
ssh://git@43.134.105.109:22222/exceed/discord.js-selfbot.git
vendor/discord.js-selfbot-v13
ssh://git@43.134.105.109:22222/exceed/discord.js-selfbot.git
```

### Task 2: Configure pnpm workspace resolution

**Files:**
- Modify: `pnpm-workspace.yaml`
- Modify: `package.json`

- [ ] **Step 1: Update pnpm workspace file**

Edit `pnpm-workspace.yaml` to exactly:

```yaml
packages:
  - .
  - vendor/discord.js-selfbot-v13

onlyBuiltDependencies:
  - '@discordjs/opus'
  - better-sqlite3
  - esbuild
```

Expected: the existing `onlyBuiltDependencies` entries remain unchanged, and workspace packages now include root plus the vendored selfbot package.

- [ ] **Step 2: Update root dependency**

Edit `package.json` so the dependencies block contains:

```json
"discord.js-selfbot-v13": "workspace:*"
```

Expected: only the `discord.js-selfbot-v13` version source changes; the rest of `package.json` remains unchanged.

- [ ] **Step 3: Verify the submodule package name**

Run:

```bash
node -e "const p=require('./vendor/discord.js-selfbot-v13/package.json'); if (p.name !== 'discord.js-selfbot-v13') { throw new Error('unexpected package name: '+p.name) } console.log(p.name)"
```

Expected output:

```text
discord.js-selfbot-v13
```

### Task 3: Refresh dependency lockfile and install links

**Files:**
- Modify: `pnpm-lock.yaml`
- Modify: `node_modules` locally, not committed

- [ ] **Step 1: Refresh pnpm install state**

Run:

```bash
pnpm install
```

Expected: pnpm completes successfully and updates `pnpm-lock.yaml` so `discord.js-selfbot-v13` resolves from `link:vendor/discord.js-selfbot-v13` or equivalent workspace link notation.

- [ ] **Step 2: Verify pnpm resolves the workspace package**

Run:

```bash
pnpm list discord.js-selfbot-v13 --depth 0
```

Expected: output shows `discord.js-selfbot-v13` as a linked workspace dependency rather than the npm registry version.

- [ ] **Step 3: Inspect the lockfile entry**

Run:

```bash
grep -n "discord.js-selfbot-v13" pnpm-lock.yaml | head -20
```

Expected: the root importer entry for `discord.js-selfbot-v13` references `specifier: workspace:*` and a workspace/link version.

### Task 4: Validate root project compatibility

**Files:**
- Read-only validation for TypeScript project files.

- [ ] **Step 1: Run TypeScript validation**

Run:

```bash
pnpm run typecheck
```

Expected: command exits successfully.

- [ ] **Step 2: If typecheck fails because the submodule package is unbuilt, build the submodule**

Run only if Step 1 fails with missing compiled files or missing package entrypoint errors from `vendor/discord.js-selfbot-v13`:

```bash
pnpm --filter discord.js-selfbot-v13 install
npnpm --filter discord.js-selfbot-v13 run build
pnpm run typecheck
```

Expected: submodule package builds successfully and root typecheck passes.

If the package has no `build` script, inspect `vendor/discord.js-selfbot-v13/package.json` scripts and use the package's documented compile script, then rerun `pnpm run typecheck`.

- [ ] **Step 3: Run lint if typecheck passes**

Run:

```bash
pnpm run lint
```

Expected: command exits successfully or reports only pre-existing issues unrelated to `.gitmodules`, `package.json`, `pnpm-workspace.yaml`, or `pnpm-lock.yaml`.

### Task 5: Review git diff and prepare handoff

**Files:**
- Review: `.gitmodules`
- Review: `package.json`
- Review: `pnpm-workspace.yaml`
- Review: `pnpm-lock.yaml`
- Review: `vendor/discord.js-selfbot-v13` gitlink

- [ ] **Step 1: Review changed files**

Run:

```bash
git status --short
git diff -- .gitmodules package.json pnpm-workspace.yaml pnpm-lock.yaml
git diff --submodule
```

Expected: changes are limited to the design spec, plan, submodule metadata/gitlink, pnpm workspace config, root dependency, and lockfile. Existing unrelated `README.md` modifications remain untouched.

- [ ] **Step 2: Summarize validation evidence**

Record these command outcomes in the final response:

```text
pnpm install: PASS or FAIL with error summary
pnpm run typecheck: PASS or FAIL with error summary
pnpm run lint: PASS, FAIL with error summary, or NOT RUN with reason
```

- [ ] **Step 3: Do not commit unless explicitly asked**

No commit command should run unless the user explicitly asks for a commit. If the user asks, use the repository commit workflow and stage only relevant files.

## Self-Review

- Spec coverage: the plan covers submodule creation, remote replacement, workspace config, dependency rewrite, lockfile refresh, and validation.
- Placeholder scan: no TBD/TODO placeholders remain.
- Type consistency: package path, dependency name, and remote URL are consistent across tasks.
