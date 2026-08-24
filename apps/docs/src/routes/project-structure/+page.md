---
title: Project Structure
---

# Project structure

This is a deeper look than [Development](/development)'s monorepo layout table, focused on
`packages/sdk` — the one package with real internal structure today. See [the plan](/plan) for the
roadmap (CLI, query builder, migrations) and
[`CLAUDE.md`](https://github.com/francyfox/turtape/blob/master/CLAUDE.md) for commands and
conventions.

```
turtape/
├── apps/
│   └── docs/                    SveltePress documentation site, deployed to GitHub Pages
├── packages/
│   └── sdk/                     @turtape/sdk — the TuringDB client (see below)
├── examples/                    Standalone scripts exercising @turtape/sdk
├── docker/, docker-compose.yml  Local TuringDB instance for development and tests
└── docs/agents/                 Agent-facing skill docs (issue tracker, triage labels, domain modeling)
```

## `packages/sdk`

```
packages/sdk/
├── bunfig.integration.toml   Coverage off for `test:integration` -- see below
└── src/
    ├── index.ts               Public entry point -- everything re-exported from @turtape/sdk
    ├── modules/
    │   ├── core/               Provider-agnostic SDK surface: TurtapeSdk, TurtapeProvider, TurtapeError
    │   ├── plugin/             The plugin abstraction (Plugin, compose(), .use()) + generic
    │   │                       ready-made plugins: retry-with-backoff, a JSON-first logger
    │   ├── http-client/        Generic fetch + JSON-parsing transport, no business logic
    │   └── turingdb-provider/  The concrete TuringDB implementation + its TuringDB-flavored plugins
    └── utils/                  Shared test helpers -- mocking for *.unit.test.ts, a reachability
                                 probe for *.integration.test.ts
```

Each module's `*.unit.test.ts` and `*.integration.test.ts` files live next to the source file they
test, not in a separate test directory — see the section below.

### Module boundaries

- **`core`** only knows about the `TurtapeProvider` interface, never TuringDB specifics. This is the
  drizzle-kit-style dialect/driver split described in the plan doc.
- **`http-client`** is transport plumbing shared by any HTTP-based provider: it opens the request,
  parses JSON, and throws on a non-2xx response — nothing else. Anything beyond that (retries,
  logging, auth refresh, protocol-specific error shapes) is attached with `.use()`, not built in.
- **`plugin`** owns the `.use()` chaining mechanism (`Plugin`, `compose()`) plus building blocks that
  are generic across any HTTP client, not specific to TuringDB: retry-with-backoff, and a JSON-first
  logging primitive (`LogRecord` + `logger(record)`). It lives in its own module (not nested under
  `http-client`) because the plugin abstraction isn't owned by the transport layer — it's reusable
  infrastructure.
- **`turingdb-provider`** wraps those generic building blocks with TuringDB-specific policy:
  `retryPlugin` exempts non-idempotent writes (`COMMIT`, `CHANGE SUBMIT`) from retry, and
  `loggerPlugin` extracts the Cypher verb, checks TuringDB's HTTP-200-with-`error` response
  shape, and builds a `LogRecord` per query — then hands it to a caller-supplied handler.

### Plugins attach on `TurtapeSdk`, not on a specific provider

`use(plugin: Plugin): TurtapeProvider` is part of the base `TurtapeProvider` interface (`core/types.ts`)
— every provider implements it, so `TurtapeSdk(...).use(...)` works regardless of which provider is
behind it; it just forwards to `config.provider.use(...)`. `TuringDBProvider()` also exposes its own
`.use()` (so it still works standalone, without the `TurtapeSdk` wrapper), but the intended,
provider-agnostic way to attach a plugin is through the SDK:

```ts
import { TuringDBProvider, loggerPlugin, retryPlugin, TurtapeSdk } from "@turtape/sdk";

const sdk = TurtapeSdk({ provider: TuringDBProvider({ host, token }) })
  .use(loggerPlugin())    // attach before retry to log once per query, not per attempt
  .use(retryPlugin());
```

Nothing is attached by default, and a plugin that's never imported never ends up in the bundle — this
is what keeps `@turtape/sdk` inside its `size-limit` budget (10 kB, currently ~4 kB brotli) as more
plugins are added.

### Logging is JSON-first

`loggerPlugin(handler)` builds a plain, JSON-serializable `LogRecord` for every query and hands
it to `handler` — the default just renders it to the terminal, but a handler can do anything with the
record. Fields: `time`, `level`, `tag`, `verb`, `durationMs` (client-measured, end-to-end),
`serverMs`/`networkMs` (from the response's own `time` field, split out so a reader doesn't have to
subtract), `graph`/`change`/`commit` (the query's context, when set), `errorKind`
(`"application"` — fix the query — vs `"transport"` — safe to consider retrying — only set on
`level: "error"`), and `detail?`.

```ts
// default: logger(record).tty() — a colored one-liner on stdout
.use(loggerPlugin())

// custom terminal formatting, full control (no template syntax)
.use(loggerPlugin((record, logger) =>
  logger(record)
    .format((r) => `${r.time} [${r.tag}] ${r.verb} ${r.durationMs}ms`)
    .tty()
));

// or skip .tty() entirely — the record is already JSON, ship it wherever
.use(loggerPlugin((record) => appendFile("turtape.log", JSON.stringify(record) + "\n")));
```

### `*.unit.test.ts` vs `*.integration.test.ts`

Both live next to the module they test and both match `bun test`'s default file discovery (either
suffix ends in `.test.ts`), so `bun run test` runs all of them together. `bun run test:unit` /
`bun run test:integration` filter to one or the other by matching the suffix in the file path.

- **`*.unit.test.ts`** mocks `fetch` (`@/utils/test-support.ts`) — fast, hermetic, no external state,
  no Docker needed.
- **`*.integration.test.ts`** runs against a **live** TuringDB and exercises the real wire protocol:
  the full `CHANGE NEW` → `CREATE` → `COMMIT` → `CHANGE SUBMIT` write cycle, a real `PARSE_ERROR`
  response shape, a real HTTP 405, and confirming `body.time` (→ `serverMs`) is genuinely present and
  sane end to end -- it's what confirmed `body.time` is milliseconds, not seconds, a fact the mocked
  unit tests can't establish on their own since they supply that value themselves. Each suite probes
  reachability first (`@/utils/integration-support.ts`) and *skips* (not fails) with a clear message
  if nothing answers on `TURINGDB_HOST`. If a change starts failing with `CHANGE_NOT_FOUND` mid-run,
  see [the change-tracking issue](/turingdb-issues/change-not-found).

**`--isolate` is required whenever both suffixes run in the same `bun test` process** (i.e. in
`bun run test`, and in `packages/sdk/package.json`'s `test`/`test:unit`/`test:integration` scripts).
Without it, a unit test's mocked `globalThis.fetch` can leak into an integration test that runs right
after it in the same process -- confirmed directly: the 405 integration test above intermittently
received a mocked `{ ok: true }` body instead of hitting the real server until `--isolate` (fresh
global object per test file) was added.
