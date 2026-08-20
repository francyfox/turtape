---
title: Commit not visible
---

# Committed data not visible without repeating the change context

**Repro:**
```cypher
CHANGE NEW
-- returns e.g. changeID = 1
```
then, with `context: { change: "1" }`:
```cypher
CREATE (pam:Person {name: "Pam"})
```
(succeeds), then:
```cypher
COMMIT
```
(also succeeds, empty response) — then querying **without** a `change`/`commit` context:
```cypher
MATCH (p:Person {name: "Pam"}) RETURN count(p) > 0 AS exists
```

**Expected:** after `COMMIT`, the created node should be visible on the graph's default/main line, the same way a committed change is expected to merge.

**Actual:** still `ANALYZE_ERROR: Unknown label: Person` — as if the commit never merged into the graph queried by default.

**Confidence:** low — this is the least-verified finding. We didn't find a documented way to merge/submit a change (tried `CHANGE SUBMIT 1`, `SUBMIT CHANGE 1`, `MERGE CHANGE 1` — all `PARSE_ERROR`), and querying with `context: { change: "1" }` explicitly also failed differently (`EXEC_ERROR: Unsupported unary operation on column of type db::ColumnMask`). Very possible we're missing a step in the intended `newChange()` → `checkout()` → run → `COMMIT` cycle (see the [Plan](/plan)'s Architecture section) rather than TuringDB actually losing the commit. Needs more investigation before filing — start with `docs.turingdb.ai`'s versioning/changes docs.
