---
title: HISTORY syntax mismatch
---

# `HISTORY` keyword doesn't parse — use `CALL db.history()` instead

**Repro:** the bare `HISTORY` statement shown in the official docs (`docs.turingdb.ai/graph_dev/time_travelling`, `docs.turingdb.ai/concepts/commits`):
```cypher
HISTORY
```

**Expected (per docs):** a table of commits for the current graph, e.g.
```
+-----------------------+
| Commit: 701edb        |
+-----------------------+
| Commit: be9643 (HEAD) |
|   - 2,588,826 nodes   |
|   - 10,042,846 edges  |
+-----------------------+
```

**Actual:**
```
PARSE_ERROR
syntax error, unexpected ID
```
Fails identically with lowercase `history`. Confirmed this isn't a general version-control-commands problem — `CHANGE LIST` in the same session, same graph, works fine.

**Working syntax:** the procedure-call form does work:
```cypher
CALL db.history()
```
```json
{
  "header": { "column_names": ["commit", "nodeCount", "edgeCount", "partCount"], "column_types": ["String", "UInt64", "UInt64", "UInt64"] },
  "data": [[["c702a1e7b6679292(HEAD)", "1d1c41d584a038ab", "dbccb7ac78671c9b", "ba36a4e9005aab7c", "662ccc596cc002a4"], [0,12,0,1,0], [0,11,0,0,0], [0,1,0,1,0]]],
  "time": 0.079862
}
```
Structurally different from the docs' example output too: it's a normal columnar result (`commit`, `nodeCount`, `edgeCount`, `partCount` per row) rather than the free-text table the docs show — the docs' example output looks like it's from a different (REPL/CLI) client that formats `CALL db.history()`'s rows for display, not a literal server response shape.

**Confidence:** this looks like a docs bug (wrong/outdated command syntax in examples), not a missing engine feature — the underlying capability exists and works, just not spelled the way the docs say. Low priority to file upstream, but worth a quick issue since it'll trip up anyone following the docs literally, same as we just did.

**Not a version-drift artifact:** checked whether our locally running image (stale by months — see [nightly is stale](/turingdb-issues/nightly-build-disabled)) simply predates `db.history()` being added. It doesn't: `procedures/HistoryProcedure.cpp` was already in the repo by 2026-05-01, before our local build (2026-05-06/06-05). The docs' bare `HISTORY` example appears to have been wrong from the start, not a regression.

**Takeaway for `turtape`:** version-control introspection procedures follow the `CALL db.*()` convention (`db.labels()`, `db.history()`) rather than bare keywords — worth checking `CALL db.*()` first when a documented bare-keyword command doesn't parse.
