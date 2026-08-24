<p align="center">
  <a href="https://github.com/francyfox/turtape">
    <img src="apps/docs/static/logo.svg" alt="turtape" width="180" />
  </a>
</p>

<h1 align="center">turtape</h1>

<p align="center">Bun/Node.js SDK, CLI, and query layer for <a href="https://turingdb.ai">TuringDB</a>.</p>

<p align="center">
  <a href="https://github.com/francyfox/turtape/actions/workflows/deploy-docs.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/francyfox/turtape/deploy-docs.yml?branch=main&style=for-the-badge&label=docs" alt="Docs deploy status" />
  </a>
  <a href="https://github.com/francyfox/turtape/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/francyfox/turtape?style=for-the-badge" alt="License: MIT" />
  </a>
  <a href="https://github.com/francyfox/turtape/stargazers">
    <img src="https://img.shields.io/github/stars/francyfox/turtape?style=for-the-badge" alt="GitHub stars" />
  </a>
  <img src="https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=fbf0df" alt="Bun" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Turborepo-EF4444?style=for-the-badge&logo=turborepo&logoColor=white" alt="Turborepo" />
  <img src="https://img.shields.io/badge/status-work%20in%20progress-yellow?style=for-the-badge" alt="Status: work in progress" />
</p>

## Table of contents

- [What is this?](#what-is-this)
- [Monorepo layout](#monorepo-layout)
- [Getting started](#getting-started)
- [Development](#development)
- [License](#license)

## What is this?

`turtape` is a toolkit for [TuringDB](https://turingdb.ai), an in-memory columnar graph
database with an OpenCypher-subset query language:

- **`@turtape/sdk`** — a runtime-agnostic client (plain `fetch`, zero dependencies — works the same on
  Bun and Node.js) that talks to a TuringDB daemon over its HTTP/JSON protocol.
- **A CLI**, a query builder or ORM for OpenCypher, and schema migrations, all still to come.

TuringDB connects as a *provider* behind a common interface (mirroring drizzle-kit's dialect/driver
split) rather than being hardcoded through the stack — see the plan below for the reasoning.

Full scope, sequencing, and the confirmed HTTP wire protocol live in **[the plan](apps/docs/src/routes/plan/+page.md)**
— read it before touching `packages/sdk`.

## Monorepo layout

| Path                             | What                                                                                   |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| `apps/docs`                      | The documentation site ([SveltePress](https://sveltepress.site)) — deployed to GitHub Pages via `.github/workflows/deploy-docs.yml` on push to `main`/`master`. |
| `packages/sdk`                   | `@turtape/sdk` — the TuringDB client.                                                   |
| `docker/`, `docker-compose.yml`  | A local TuringDB instance for development and tests.                                    |

See [`PROJECT_STRUCTURE.md`](docs/PROJECT_STRUCTURE.md) for a deeper look, including `packages/sdk`'s
internal module layout (`core` / `http-client` / `plugin` / `turingdb-provider`) and how its
opt-in `.use()` plugin mechanism works.

## Getting started

```sh
bun install
docker compose up -d   # local TuringDB — query API on :6666, visualizer on :8080
bun run dev
```

## Development

Run from the repo root (orchestrated across workspaces by [Turborepo](https://turborepo.dev)):

```sh
bun run build              # build all apps/packages
bun run test               # run unit + integration tests across all packages
bun run test:unit          # unit tests only (mocked, no Docker needed)
bun run test:integration   # integration tests only — requires `docker compose up -d`
bun run check-types        # type-check, no emit
bun run lint          # lint the whole repo (Biome)
bun run format        # format the whole repo (Biome)
bun run size          # check package size against its size-limit budget
```

See [`CLAUDE.md`](CLAUDE.md) for the fuller architecture/commands reference.

## License

[MIT](LICENSE)
