---
title: Plan
---

# Plan: turtape SDK, CLI, and query layer

Status: draft. Update this doc whenever scope, API surface, or phase status changes — keep it in sync with reality rather than letting it drift.

## Goal

`turtape` is a **from-scratch** Bun/Node.js toolkit for [TuringDB](https://turingdb.ai) (an in-memory columnar graph database with an OpenCypher-subset query language and git-style versioning):

1. `packages/sdk` — the transport-level client.
2. `apps/playground` — a sandbox app for interactively exercising the SDK.
3. `packages/cli` — a CLI on top of it, built with [Bunli](https://bunli.dev).
4. A query builder or ORM for OpenCypher (naming/scope TBD — see below).
5. Schema migrations.

The docs site already exists at `apps/docs` (SveltePress).

## Architecture: provider model + API style

Two design decisions that shape every phase below:

**TuringDB is a provider, not a hardcoded backend.** Modeled on drizzle-kit's dialect/driver split: the query builder/ORM (Phase 4) shouldn't talk to TuringDB directly — it takes a `provider` in its config and talks to it through a common interface, the same way `drizzle({ connection, ... })` is dialect-agnostic at the config layer. `packages/sdk` already reflects this split (scaffolded, in progress): `src/modules/core` holds the provider-agnostic `TurtapeSdk(config)` entry point and `TurtapeConfig { host, token, provider }`, `src/modules/turingdb-provider` holds the TuringDB-specific implementation. Only one provider ships for the foreseeable future — a graph-database-specific toolkit isn't likely to grow a second backend soon — so this is about keeping a clean interface boundary between "core" and "turingdb-provider" (already split in the scaffold), **not** about building a generic plugin registry/loader. One interface, one implementation, on purpose.

**API style splits by layer, don't apply one style everywhere:**
- The **query builder/ORM (Phase 4)** is where ElysiaJS's style earns its keep: chained calls that refine the TypeScript return type as they go (`.match().where().return()` narrowing the result row type through generics), the same trick Elysia uses for route/context types and that Kysely/Drizzle's query builders already do for SQL. This is the layer the user means by "Elysia style."
- The **raw SDK (`@turtape/sdk`, Phase 1)** is closer to a driver — like `pg`/`postgres.js`, which Drizzle wraps rather than reimplements — plain async methods (`query()`, `checkout()`, `newChange()`), not fluent generic chaining. There's no per-call type to progressively refine at this layer, so forcing Elysia-style chaining onto connection/versioning calls wouldn't buy anything.
- **CLI + migrations (Phase 3/5)** follow drizzle-kit's implementation model directly: a `turtape.config.ts` declaring the provider + connection + schema location, then command verbs operating against it — `turtape generate` / `turtape push` / `turtape migrate` / `turtape studio`.

`turtape studio` (drizzle-kit's Studio, reimplemented for graphs) resolves Phase 2's open question about the playground's shape: a schema-aware, local browser tool launched from the CLI, not a separate hand-built app. See Phase 2 below — `apps/playground` may end up being this CLI command instead of its own app, but that can't be decided until Phase 4's schema DSL exists to make it schema-aware.

## Prior art: reference, not a fork

There's already a small upstream TypeScript SDK: [`turing-db/turingdb-typescript-sdk`](https://github.com/turing-db/turingdb-typescript-sdk) (MIT, published to npm as `turingdb`, `0.1.0`, single-commit/early-stage). **We are not forking or vendoring it** — `packages/sdk` is written from scratch, under our own design. It's still valuable as a reference for two things:

- It already solved the wire-protocol discovery problem — see below, no need to redo that legwork.
- Its method surface is a sanity check for what a "minimal SDK" needs to cover, not a spec to copy.

It has **zero runtime dependencies**, touches only `fetch` + `AbortSignal` (both native in Bun) — confirms this SDK is realistically buildable as pure Web-API code with no Node-only or Bun-only primitives required.

### Confirmed wire protocol

From upstream's source (method/auth shape) plus a direct sanity check against the local `docker compose` instance (raw envelope shape — see below), so this is now verified against a real server, not just upstream's README:

- Single endpoint: `POST /query` on the daemon (default `http://localhost:6666`). Body is the **raw Cypher text**, not a JSON-wrapped `{query: ...}` payload (tried that against the live server — it errors trying to parse the JSON braces as Cypher). All graph management goes through the query language itself — confirmed working: `LIST GRAPH` (lists loaded graphs; upstream's README says `LIST AVAILABLE GRAPHS`/`LIST GRAPH` but only `LIST GRAPH` parses — `LIST GRAPHS`, `LIST LOADED GRAPHS`, `LIST AVAILABLE GRAPH` all reject with `PARSE_ERROR`, so the exact grammar needs mapping one statement at a time in Phase 1, not assumed from the README).
- Auth: `Authorization: Bearer <token>` per upstream — token from constructor option or `TURINGDB_AUTH_TOKEN` env var; pass `""` to explicitly disable. Not yet exercised against the live server (no token configured in `docker-compose.yml` yet).
- Current graph/change/commit selection is sent as query params on each request per upstream; listing statements omit them.
- **Raw response envelope (confirmed live)**, e.g. `POST /query` with body `LIST GRAPH`:
  ```json
  {"header":{"column_names":["graphName"],"column_types":["String"]},"data":[[["default"]]],"time":1.755369}
  ```
  So the wire shape is `header.column_names` / `header.column_types` (snake_case) + `data` (array of chunks, each chunk an array of columns, each column an array of cell values) + `time` (server exec time). Upstream's `columnNames`/`columnTypes`/`columns`/`execTime`/`totalExecTime` naming is the *parsed* client-side shape, not what's on the wire — don't copy those field names assuming they're the envelope.
- Errors: confirmed shape is `{"error": "PARSE_ERROR", "error_details": "...", "time": ...}` with **HTTP 200**, not a non-2xx status — so error detection has to check the body's `error` field, not just `response.ok`. Whether other error classes (auth failure, runtime query errors) also come back as 200 with an `error` field, or use real HTTP status codes, isn't confirmed yet.
- **Stale, re-tested 2026-08-24 — no longer reproduces:** graph creation (`CREATE GRAPH x`) was previously confirmed to hang indefinitely against the `turingdbai/turingdb:nightly` build (`977b3693b483f42a496773fee3617d68a7762c51`, 07-05-2026). Re-tested directly against this repo's actual environment — the self-built `docker/db.Dockerfile` image (`pip install turingdb` from PyPI), not the official `nightly` tag — and it returned successfully in ~39ms, no hang. Whether that's a version fix or specific to the official image's build isn't confirmed, but graph creation is safe to rely on against this repo's own Docker setup. While re-testing this, found a real, still-open issue instead — see [change tracking gets stuck](/turingdb-issues/change-not-found).
- **Upstream's actual transport, read directly from `src/httpClient.ts`** (worth knowing since we're writing our own, not forking): plain `fetch`, no lower-level transport, **no retry logic at all** — every failure (network or app-level) throws immediately. Per-call optional timeout via `AbortSignal.timeout(timeoutMs)`, not a constructor-level default. Error handling checks `!response.ok` first (extracting a structured message if the body parses as JSON) and separately checks `"error" in json` for the 200-with-error case we confirmed — i.e. upstream defensively covers both shapes, matching what we did independently. `newChange()` issues `CHANGE NEW` and reads a `changeID` column; `checkout()` to a specific commit issues `LOAD COMMIT '<commit>'` before pinning it as a param. `reconnect()` is a documented no-op (fresh connection per request already) kept only for interface parity with a hypothetical non-HTTP transport — we've mirrored that on `TurtapeProvider`.

`docker compose up -d` (root `docker-compose.yml`, building `docker/db.Dockerfile`) brings up the local instance used for the checks above and for all future SDK tests — query API on `6666`, visualizer UI on `8080`.

## Runtime constraint

The SDK must work under **both Bun and Node.js**. Implementation sticks to platform-neutral Web APIs (`fetch`, `AbortSignal`, `URL`) — no `Bun.serve`, `bun:sqlite`, etc. in the shipped package (those are fine for our own tooling, not for a library meant to also run on plain Node). Build/dev workflow uses Bun (`bun install`, `bun test`, `bun build`) per repo convention; only the shipped code itself needs to stay runtime-agnostic.

**Confirmed blocker: port `6666` (TuringDB's own documented default) is unreachable via `fetch` on Node.js.** Node's native `fetch` (undici) enforces the WHATWG Fetch spec's "bad port" blocklist, which includes the IRC port range `6665`–`6669` (and `6697`) — `fetch("http://localhost:6666/...")` throws `TypeError: fetch failed` with `cause: "bad port"`, unconditionally, with no public opt-out. Verified directly: identical request against the same live server succeeds on Bun, fails on Node, purely because of the port number. This isn't specific to our code — any `fetch`-based client hits it. `packages/sdk/src/modules/turingdb-provider` and `docker-compose.yml` both currently default to `6666`; **decide before Phase 1 goes further** whether to (a) remap the local dev instance's host-facing port to something outside the blocked range (e.g. `16666`, confirmed unblocked) and change the SDK's default host to match, accepting divergence from TuringDB's own "default port 6666" convention, or (b) keep `6666` as the default and require every Node consumer to explicitly override `host` — worse default ergonomics, but stays aligned with upstream. No implementation should assume `fetch` to port 6666 works on Node.

## Package layout & naming

Project is `turtape` — workspace packages use the `@turtape/*` scope (these are meant to be published, so scoped to the project rather than an internal-only `@repo/*`-style scope):

- `packages/sdk` → `@turtape/sdk` — **scaffolded, in progress.** `src/modules/core` (provider-agnostic entry: `TurtapeSdk(config)`, `TurtapeConfig`) + `src/modules/turingdb-provider` (TuringDB-specific implementation, currently empty) per the provider split above.
- `apps/playground` — not published, private (like `apps/docs`); may end up superseded by `turtape studio` (see Phase 2/Architecture)
- `packages/cli` → `@turtape/cli`, bin name `turtape`
- query builder/ORM → name TBD, see Phase 4
- migrations → name TBD, see Phase 5, likely folded into the CLI (`turtape migrate ...`) rather than its own package at first

There's no shared `@repo/*` config layer to extend (those scaffold packages were removed) — each package gets its own standalone `tsconfig.json` and relies on the root `biome.json` for lint/format (no per-package lint config or script). Each gets `build` / `check-types` / `test` scripts wired into `turbo.json` as applicable, matching the pattern already set up for `packages/sdk`.

## Phase 1 — Minimal SDK (`@turtape/sdk`)

Goal: the smallest surface that can connect, manage graphs, run queries, and drive the change/commit/submit cycle — written fresh, informed by (not copied from) upstream's confirmed protocol.

- Client construction: `TurtapeSdk({ host, token, provider })` (per the provider model above — matches the current scaffold's `TurtapeConfig`), not a TuringDB-specific constructor
- Connectivity: `tryReach()`, `reconnect()`
- Graph management: `createGraph()`, `listAvailableGraphs()`, `listLoadedGraphs()`, `loadGraph()`, `getGraph()`/`setGraph()`, `isGraphLoaded()`
- Querying: `query()` (column-oriented, matches server shape), `queryRows()` (row-oriented convenience), `queryRaw()` (untouched envelope)
- Versioning: `newChange()`, `checkout()`, `setChange()`/`setCommit()`, `currentGraph`/`currentChange`/`currentCommit`
- One exception type for all SDK/server failures

Tests run against the `docker compose` local instance (see above), on both Bun and Node, to confirm the "works on both runtimes" claim rather than assuming it.

Explicitly **out of scope for Phase 1**: `native` binary backend, `embedded` in-process mode, vector search, graph algorithms. Extend once this surface is verified end-to-end against a real server on both Bun and Node.

## Phase 2 — Playground (`apps/playground`)

A sandbox app for interactively exercising `@turtape/sdk` against the local `docker compose` TuringDB instance during development — write a few lines, run it, see real results, without writing a formal test or waiting on the CLI/ORM to exist. Lowest-effort way to validate new SDK methods as Phase 1 lands, so it should come right after (or alongside) the SDK, before investing in the CLI.

Shape, in order of what's decided:
- **Now (Phase 2, dev-only scratch app)** — minimal SvelteKit (or a plain Bun script folder) wired to the local Docker instance, not deployed anywhere, purely for iteration speed while `@turtape/sdk` is still taking shape.
- **Later (Phase 4/5, `turtape studio`)** — per the Architecture section above, once the query builder/ORM has a schema DSL, the real long-term playground is a `turtape studio` CLI command (drizzle-kit Studio-style: schema-aware, browses live data through the configured provider) in `packages/cli`, not a hand-built app. `apps/playground` may get superseded by this rather than growing into it — revisit once Phase 4 lands instead of investing further in the app.
- **Not planned yet:** a public-facing in-browser playground embedded in `apps/docs` for site visitors. Bigger scope (hosted demo instance, query sandboxing) — only worth it if `turtape studio` turns out not to cover the "let people try it from the docs" need.

## Phase 3 — CLI (`@turtape/cli`, Bunli)

A thin CLI over the SDK for local workflows: connect to a server, run ad-hoc Cypher queries, manage graphs, inspect changes/commits. Scaffolded with `bunli create`, commands via `@bunli/core`. Command list drafted once Phase 1 is stable, so the CLI stays a thin wrapper rather than duplicating SDK logic. This is also where migration commands land later (Phase 5).

## Phase 4 — Query builder or ORM for OpenCypher

Open decision, not yet made: a **query builder** (typed Cypher construction, e.g. `match("n:Person").where(...).return(...)`, no schema modeling) vs. a full **ORM** (schema-defined node/relationship models, typed reads/writes, relationship traversal helpers). An ORM is a strict superset of effort — it needs a schema DSL that a query builder doesn't. Worth deciding based on how much of the app-facing API should be schema-aware vs. how fast we need something usable. This phase blocks Phase 5's richer form (see below).

## Phase 5 — Schema migrations

Agreed this is worth having, but it splits into two tiers that don't have to land together:

1. **Migration runner (cheap, ships right after Phase 1)** — numbered/timestamped Cypher scripts applied through the SDK's native `newChange()` → `checkout()` → run script → `COMMIT` → `CHANGE SUBMIT` cycle, with an applied-migrations ledger (as a node/label in the graph itself, or a tracked file). This needs nothing from Phase 4 — it's a thin CLI feature (`turtape migrate up/down/status`) once the SDK's versioning methods exist. TuringDB's native changeset model is a genuinely good fit here: each migration is naturally an atomic, isolated change, which is a nicer story than migrations bolted onto most RDBMS.
2. **Schema-diff-generated migrations (richer, depends on Phase 4)** — auto-generating migration scripts from the difference between two versions of a declared schema (à la Prisma Migrate / Drizzle Kit), which only makes sense once the query builder/ORM defines a schema DSL to diff against. Since TuringDB graphs are schema-optional (labels/properties aren't fixed by the engine), what's actually being diffed and migrated here is mostly **indexes, constraints, and property-shape changes** (renames, backfills) rather than table structure — worth keeping that framing so Phase 5.2 doesn't get designed like a relational migration tool.

Recommendation: build 5.1 early and ship it standalone — it's valuable on its own and doesn't block on the ORM decision. Treat 5.2 as a Phase 4 follow-on, not a Phase 1 dependency.

## Docs integration (ongoing, not a single final phase)

`apps/docs` (SveltePress) gets content incrementally as each phase lands — "Getting Started" after Phase 1, CLI reference after Phase 3, query builder/ORM guide after Phase 4, migrations guide after Phase 5 — using real, tested code samples run against a local TuringDB instance, not hand-typed. Sveltia CMS wiring (discussed separately) is independent of this and can land in parallel.

## Sequencing

1. `packages/sdk` (`@turtape/sdk`) — connectivity, graph management, query, versioning; verified against a real server on both Bun and Node
2. `apps/playground` — dev-only sandbox for exercising the SDK as it grows
3. `packages/cli` (`@turtape/cli`, Bunli) — thin wrapper over the SDK
4. Migration runner (5.1) as a CLI feature, using the SDK's versioning methods
5. Decide query builder vs. ORM (Phase 4), build it
6. Schema-diff migrations (5.2), building on Phase 4's schema DSL
7. `apps/docs` content, incrementally alongside each phase above
