# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Keep this file up to date.** Whenever a change affects anything described here — new/removed apps or packages, new commands, changed architecture — update this file in the same change. Stale docs here are worse than no docs.

## Project state

Turborepo monorepo, package manager is Bun (`devEngines.packageManager` in `package.json`), consistent with the default Bun guidance below.

- `apps/docs` — SveltePress documentation site (VitePress-equivalent for SvelteKit). Will host docs for the TuringDB SDK/CLI once they exist; Sveltia CMS integration for content editing is planned but not wired up yet. Deployed to GitHub Pages via `.github/workflows/deploy-docs.yml` on push to `main`/`master`. **Requires a one-time manual step**: repo Settings → Pages → Source → "GitHub Actions" (the `configure-pages` step 404s with "Get Pages site failed" until this is set — it can't enable Pages itself). Static output uses `@sveltejs/adapter-static`; `BASE_PATH` (set only in CI) prefixes routes for GitHub Pages' project-site subpath — leave it unset locally.
- `packages/sdk` (`@turtape/sdk`) — see below, in progress.

The original `create-turbo` scaffold packages (`packages/ui`, `packages/eslint-config`, `packages/typescript-config`) have been removed — there's no shared `@repo/*` config layer anymore. Lint/format is centralized at the repo root via Biome (see Commands); each package's `tsconfig.json` is currently standalone (no shared base to extend).

**In progress:** building `@turtape/sdk` (Bun/Node.js client for TuringDB, from scratch — not a fork of the upstream `turingdb-typescript-sdk`, though that repo's README documents the confirmed wire protocol and is worth reading), an `apps/playground` sandbox for exercising it, `@turtape/cli` via [Bunli](https://bunli.dev), a query builder or ORM for OpenCypher (undecided which), and schema migrations. None of these exist yet. Full plan lives at `apps/docs/src/routes/plan/+page.md` (rendered on the docs site at `/plan`) — read it before touching any of this. There's no separate internal-docs folder anymore; planning docs live inside `apps/docs` as regular pages.

## Commands

Run from the repo root (Turborepo orchestrates tasks across all workspaces via `turbo`):

- `bun install` — install dependencies
- `bun run build` — build all apps/packages (`turbo run build`)
- `bun run dev` — run all apps/packages in dev mode (`turbo run dev`)
- `bun run check-types` — type-check all apps/packages, no emit (`turbo run check-types`)
- `bun run test` — run all tests (unit + integration) across all apps/packages (`turbo run test`; a package only runs if it has its own `test` script — `packages/sdk` does, `bun test --isolate`)
- `bun run test:unit` — unit tests only, mocked `fetch`, no Docker needed (`turbo run test:unit`; `packages/sdk` runs `bun test --isolate .unit.test`)
- `bun run test:integration` — integration tests only, against a **live** local TuringDB (`turbo run test:integration`; `packages/sdk` runs `bun --config=bunfig.integration.toml test --isolate .integration.test`). Requires `docker compose up -d` first — each suite probes reachability and skips (not fails) with a clear message if nothing's listening on `:6666`. Coverage is disabled for this run (`bunfig.integration.toml`) since it only exercises the subset of code the integration scenarios touch, not the whole package.
- Naming convention in `packages/sdk`: `*.unit.test.ts` (mocked, alongside the module) and `*.integration.test.ts` (real server, alongside the module) — both match `bun test`'s default discovery, so `bun run test` runs both together. `--isolate` (fresh global object per test file) is required whenever unit and integration files run in the same process — otherwise a unit test's mocked `globalThis.fetch` can leak into an integration test running right after it.
- `bun run lint` — lint the whole repo with Biome (`biome lint .`) — **not** turbo-orchestrated per package; Biome runs across the monorepo in one pass
- `bun run format` — format the whole repo with Biome (`biome format --write .`)
- `bun run size` — check `packages/sdk`'s built bundle against its `size-limit` budget (10 kB; currently ~1 kB brotli)

Scope build/dev/check-types/test to a single workspace with `--filter`, e.g. `bun run build --filter=@turtape/sdk`. Lint/format don't take `--filter` — run Biome directly with a path if you need to scope it (e.g. `bunx biome lint packages/sdk`).

**Linting/formatting is Biome, not ESLint/Prettier** — config at root `biome.json`, no per-package config. Static asset directories (`**/static/**`) are excluded from linting (there's no reason to a11y-lint a vendored SVG icon). Biome does **not** format Markdown (unlike the Prettier setup it replaced) — `README.md`, `CLAUDE.md`, and `.md` files under `apps/docs` aren't covered by `bun run format`.

**Local TuringDB for tests:** `docker compose up -d` starts a local TuringDB instance (`docker-compose.yml` builds `docker/db.Dockerfile`) — query API on `localhost:6666`, visualizer UI on `localhost:8080`. This is what `@turtape/sdk`/`@turtape/cli` tests run against; no cloud/hosted instance involved.

## Architecture

Turborepo monorepo with workspaces defined in root `package.json` (`apps/*`, `packages/*`) and task pipelines defined in `turbo.json`:

- `build` depends on `^build` (upstream packages build first).
- `check-types` depends on `^check-types`; `test` depends on `^build` (so a package's dependencies are built before its tests run).
- `dev` is uncached and persistent.
- There's no turbo `lint` task — lint is Biome running the whole repo directly (see Commands), not per-package.

No shared internal config packages exist anymore (the `@repo/*` scaffold packages were removed). When adding a new workspace package or app: write its own `tsconfig.json` (nothing to extend yet), add `build`/`check-types`/`test`/`dev` scripts as applicable so `turbo` picks them up, and rely on the root `biome.json` for lint/format — don't add a per-package lint script or config.

## Agent skills

### Issue tracker

Issues live as GitHub issues in `francyfox/turtape`, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Standard five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), label strings equal to role names. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root (neither exists yet — created lazily by `/domain-modeling`). See `docs/agents/domain.md`.
