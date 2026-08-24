# Project structure

This is a deeper look at the repo layout than the [README](../README.md)'s summary table, focused on
`packages/sdk` — the one package with real internal structure today. See
[`apps/docs/src/routes/plan/+page.md`](../apps/docs/src/routes/plan/+page.md) for the roadmap (CLI,
query builder, migrations) and [`CLAUDE.md`](../CLAUDE.md) for commands and conventions.

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
packages/sdk/src/
├── index.ts                     Public entry point — everything re-exported from @turtape/sdk
├── modules/
│   ├── core/                    Provider-agnostic SDK surface
│   │   ├── types.ts             TurtapeProvider / TurtapeConfig / QueryContext / QueryResponse
│   │   ├── errors.ts            TurtapeError
│   │   ├── service.ts           createTurtapeService — wires a provider to queryRaw()/reconnect()
│   │   └── index.ts             TurtapeSdk(config) entry point
│   │
│   ├── plugin/                  The plugin abstraction itself, and generic ready-made plugins
│   │   ├── index.ts             Plugin, NextFn, HttpRequestOptions, compose()
│   │   ├── plugin.retry.ts      withRetry() backoff loop + retryPlugin()
│   │   └── plugin.logger.ts     LogRecord (JSON) + logger(record).format().tty()
│   │
│   ├── http-client/             Generic fetch + JSON-parsing transport
│   │   └── index.ts             createHttpClient() — .use(plugin) chain, no business logic
│   │
│   └── turingdb-provider/       The concrete TuringDB implementation
│       ├── index.ts             TuringDBProvider() — query()/reconnect(), also .use()-chainable
│       ├── retry-plugin.ts      turingDBRetryPlugin — retryPlugin pre-configured for TuringDB
│       ├── log-plugin.ts        turingDBLogPlugin — Cypher-verb-aware logging plugin
│       └── status.ts            TuringDBErrorCode — the closed set of server error codes
│
└── utils/
    └── test-support.ts          Shared bun:test helpers (mockFetch, captureRejection, ...)
```

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
  `turingDBRetryPlugin` exempts non-idempotent writes (`COMMIT`, `CHANGE SUBMIT`) from retry, and
  `turingDBLogPlugin` extracts the Cypher verb, checks TuringDB's HTTP-200-with-`error` response
  shape, and builds a `LogRecord` per query — then hands it to a caller-supplied handler.

### Nothing is attached automatically

`TuringDBProvider()` ships with no retry and no logging by default — a caller opts into exactly the
plugins it needs:

```ts
import { TuringDBProvider, turingDBLogPlugin, turingDBRetryPlugin, TurtapeSdk } from "@turtape/sdk";

const sdk = TurtapeSdk({
  provider: TuringDBProvider({ host, token })
    .use(turingDBLogPlugin())    // attach before retry to log once per query, not per attempt
    .use(turingDBRetryPlugin()),
});
```

A plugin that's never imported never ends up in the bundle — this is what keeps `@turtape/sdk` inside
its `size-limit` budget (10 kB, currently ~3 kB brotli) as more plugins are added.

### Logging is JSON-first

`turingDBLogPlugin(handler)` builds a plain, JSON-serializable `LogRecord` for every query and hands
it to `handler` — the default just renders it to the terminal, but a handler can do anything with the
record. Fields: `time`, `level`, `tag`, `verb`, `durationMs` (client-measured, end-to-end),
`serverMs`/`networkMs` (from the response's own `time` field, split out so a reader doesn't have to
subtract), `graph`/`change`/`commit` (the query's context, when set), `errorKind`
(`"application"` — fix the query — vs `"transport"` — safe to consider retrying — only set on
`level: "error"`), and `detail?`.

```ts
// default: logger(record).tty() — a colored one-liner on stdout
.use(turingDBLogPlugin())

// custom terminal formatting, full control (no template syntax)
.use(turingDBLogPlugin((record, logger) =>
  logger(record)
    .format((r) => `${r.time} [${r.tag}] ${r.verb} ${r.durationMs}ms`)
    .tty()
));

// or skip .tty() entirely — the record is already JSON, ship it wherever
.use(turingDBLogPlugin((record) => appendFile("turtape.log", JSON.stringify(record) + "\n")));
```
