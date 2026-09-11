# TuringDB TypeScript SDK

A TypeScript/JavaScript client for [TuringDB](https://github.com/turing-db/turingdb)
over the HTTP/JSON protocol. 

## Requirements

- Node.js **18+** (uses the global `fetch`). No runtime dependencies.

## Install

```bash
npm install turingdb
```

## Quick start

```ts
import { TuringDB } from "turingdb";

const db = new TuringDB({ host: "http://localhost:6666", token: "my-token" });

db.setGraph("social");

// Row-oriented: one object per row, keyed by column name.
const rows = await db.queryRows("MATCH (n:Person) RETURN n.name, n.age");
// [{ "n.name": "alice", "n.age": 30 }, ...]

// Column-oriented: the shape the server actually responds with.
const result = await db.query("MATCH (n:Person) RETURN n.name, n.age");
result.columnNames; // ["n.name", "n.age"]
result.columnTypes; // ["String", "Int64"]
result.columns;     // [["alice", ...], [30, ...]]
result.rowCount;    // number of rows
result.execTime;    // server-reported query time
result.totalExecTime; // client-measured round-trip in ms
```

## Configuration

`new TuringDB(options)`:

| Option  | Default                     | Description                                        |
| ------- | --------------------------- | -------------------------------------------------- |
| `host`  | `http://localhost:6666`     | Daemon base URL.                                   |
| `token` | `TURINGDB_AUTH_TOKEN` env   | Bearer token. Pass `""` to explicitly disable auth.|

## Result shape

The server responds column-oriented, and `query()` returns that shape as a
`QueryResult`:

```ts
interface QueryResult {
  columnNames: string[];
  columnTypes: string[];
  columns: (string | number | boolean | null)[][];
  rowCount: number;
  execTime: number | null;
  totalExecTime: number | null;
}
```

`queryRows()` is the row-oriented API: it runs the same query and applies the
exported `convertToRows` helper, which you can also use on any `QueryResult`:

```ts
import { convertToRows } from "turingdb";

const result = await db.query("MATCH (n:Person) RETURN n.name, n.age");
const rows = convertToRows(result); // [{ "n.name": "alice", ... }, ...]
```

Use `queryRaw()` to get the untouched JSON envelope from the server.

## Graphs, changes, and commits

`/query` is the daemon's only endpoint — graph management goes through the
query language (`LIST AVAILABLE GRAPHS`, `LIST GRAPH`, `LOAD GRAPH`,
`CREATE GRAPH`). The listing statements are sent without the current
graph/change/commit selection, so they work regardless of the selected
graph's load state.

```ts
await db.listAvailableGraphs();       // list graphs on disk
await db.listLoadedGraphs();          // list graphs loaded in memory
await db.loadGraph("social");         // loads graph 'social' from disk no-op if already loaded
await db.createGraph("social");       // creates a graph called 'social'
await db.isGraphLoaded();             // checks if current graph is loaded

const changeId = await db.newChange(); // open + select a new change
await db.checkout("main");             // back to main
await db.checkout(changeId, "HEAD");   // select a change
db.setCommit("<commit-hash>");

db.currentGraph;  // current graph name
db.currentChange; // current change (hex) or "main"
db.currentCommit; // current commit or "HEAD"
```

## Errors

All failures — transport errors, non-2xx responses, malformed payloads, and
server-reported query errors — throw a `TuringDBException`.

```ts
import { TuringDBException } from "turingdb";

try {
  await db.query("INVALID CYPHER");
} catch (e) {
  if (e instanceof TuringDBException) {
    console.error(e.message);
  }
}
```

## Escape hatch

Reach the underlying transport client via `.impl`:

```ts
const httpClient = db.impl; // HTTPClient
```

## Build from source

```bash
npm install
npm run build   # emits dist/
```
