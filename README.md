<p align="center">
  <img src="apps/docs/static/logo.svg" alt="turtape" width="180" />
</p>

<h1 align="center">turtape</h1>

<p align="center">Bun/Node.js SDK, CLI, and query layer for <a href="https://turingdb.ai">TuringDB</a>.</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue?style=for-the-badge" alt="License: MIT" />
  <img src="https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=fbf0df" alt="Bun" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Turborepo-EF4444?style=for-the-badge&logo=turborepo&logoColor=white" alt="Turborepo" />
  <img src="https://img.shields.io/badge/status-work%20in%20progress-yellow?style=for-the-badge" alt="Status: work in progress" />
</p>

## What is this?

`turtape` is a from-scratch toolkit for [TuringDB](https://turingdb.ai), an in-memory columnar graph
database with an OpenCypher-subset query language and git-style versioning:

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
| `apps/docs`                      | The documentation site ([SveltePress](https://sveltepress.site)) — deploys to Vercel.   |
| `packages/sdk`                   | `@turtape/sdk` — the TuringDB client.                                                   |
| `docker/`, `docker-compose.yml`  | A local TuringDB instance for development and tests.                                    |

## Getting started

```sh
bun install
docker compose up -d   # local TuringDB — query API on :6666, visualizer on :8080
bun run dev
```

## Development

Run from the repo root (orchestrated across workspaces by [Turborepo](https://turborepo.dev)):

```sh
bun run build         # build all apps/packages
bun run test          # run tests (with coverage) across all packages
bun run check-types   # type-check, no emit
bun run lint          # lint the whole repo (Biome)
bun run format        # format the whole repo (Biome)
bun run size          # check package size against its size-limit budget
```

See [`CLAUDE.md`](CLAUDE.md) for the fuller architecture/commands reference.

## License

[MIT](LICENSE)
