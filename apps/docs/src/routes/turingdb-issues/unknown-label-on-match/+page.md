---
title: Unknown label on MATCH
---

# Matching an unused label throws instead of returning empty

**Repro:** against a fresh/empty graph (or one where the label `Person` has never been created):
```cypher
MATCH (p:Person {name: "Pam"}) RETURN count(p) > 0 AS exists
```

**Expected:** `false` / `0` — this is standard openCypher semantics (Neo4j, Memgraph, etc. all return an empty result set for a `MATCH` against a label with no matching nodes, whether or not the label has ever existed).

**Actual:**
```
ANALYZE_ERROR
Unknown label: Person
```
This happens purely because the label has never been used in the graph — it's an analysis-time schema check, not a runtime "no rows" result. Confirmed via `CALL db.labels()` returning an empty list on the same fresh graph.

**Confidence:** looks like a real deviation from openCypher semantics, not user error — but could be intentional given TuringDB's schema-aware design. Worth asking upstream directly whether this is by design (e.g. "labels must be declared/used once before being queryable") or a bug.

**Workaround used in `examples/`:** catch `ANALYZE_ERROR` with an `Unknown label` message and treat it as `false`, rather than a blanket try/catch. See `examples/src/sdk.ts`. Longer-term, this is a better fit for the planned schema-aware query builder/ORM (see the [Plan](/plan)) — an `exists()` helper there can safely map "unknown label" to `false` because it owns the declared schema and the call's intent is explicit, unlike raw `queryRaw()`.
