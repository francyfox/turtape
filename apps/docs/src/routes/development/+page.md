---
title: Development
---

# Development

Turborepo monorepo, package manager is [Bun](https://bun.sh). See
[Project Structure](/project-structure) for how `packages/sdk` is laid out internally.

## Getting started

```sh
bun install
docker compose up -d   # local TuringDB — query API on :6666, visualizer on :8080
bun run dev
```

## Commands

Run from the repo root (orchestrated across workspaces by [Turborepo](https://turborepo.dev)):

| Command | What |
| --- | --- |
| `bun run build` | Build all apps/packages |
| `bun run test` | Run unit + integration tests across all packages |
| `bun run test:unit` | Unit tests only (mocked, no Docker needed) |
| `bun run test:integration` | Integration tests only — requires `docker compose up -d` |
| `bun run check-types` | Type-check, no emit |
| `bun run lint` | Lint the whole repo ([Biome](https://biomejs.dev)) |
| `bun run format` | Format the whole repo (Biome) |
| `bun run size` | Check `packages/sdk`'s bundle against its `size-limit` budget |

## Monorepo layout

| Path | What |
| --- | --- |
| `apps/docs` | This documentation site ([SveltePress](https://sveltepress.site)) — deployed to GitHub Pages via `.github/workflows/deploy-docs.yml` on push to `main`/`master`. |
| `packages/sdk` | `@turtape/sdk` — the TuringDB client. |
| `examples/` | Standalone scripts exercising `@turtape/sdk`. |
| `docker/`, `docker-compose.yml` | A local TuringDB instance for development and tests. |

See [Project Structure](/project-structure) for a deeper look, including `packages/sdk`'s internal
module layout and how its opt-in `.use()` plugin mechanism works.

For the fuller architecture/commands reference — written for AI coding agents working in this repo,
but useful background for humans too — see
[`CLAUDE.md`](https://github.com/francyfox/turtape/blob/master/CLAUDE.md) on GitHub.
