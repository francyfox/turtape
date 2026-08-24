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

`turtape` is a toolkit for graph databases — CLI, SDK, and a query layer.

**Supported DB:** [TuringDB](https://turingdb.ai), an in-memory columnar graph database with an
OpenCypher-subset query language. **`@turtape/sdk`** is a runtime-agnostic client (plain `fetch`,
zero dependencies — works the same on Bun and Node.js) that talks to a TuringDB daemon over its
HTTP/JSON protocol.

## Quick start

```sh
bun install
docker compose up -d   # local TuringDB — query API on :6666, visualizer on :8080
bun run dev
```

## Docs

Full documentation lives at **[francyfox.github.io/turtape](https://francyfox.github.io/turtape/)**:

- **[Development](https://francyfox.github.io/turtape/development)** — commands, monorepo layout, running tests
- **[Project Structure](https://francyfox.github.io/turtape/project-structure)** — `packages/sdk`'s internal module layout and plugin system
- **[Plan](https://francyfox.github.io/turtape/plan)** — full scope, sequencing, the confirmed TuringDB wire protocol
- **[TuringDB Issues](https://francyfox.github.io/turtape/turingdb-issues)** — confirmed bugs/quirks found while building against TuringDB

See [`CLAUDE.md`](CLAUDE.md) for the fuller architecture/commands reference.

## License

[MIT](LICENSE)
