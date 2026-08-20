---
title: EXISTS not implemented
---

# `EXISTS` predicate not implemented

**Repro:**
```cypher
RETURN EXISTS { (:Person {name: "Pam"}) } AS exists
```
(the openCypher-standard `EXISTS { pattern }` syntax — the older `EXISTS((pattern))` form doesn't parse at all, `syntax error, unexpected OPAREN, expecting OBRACE`, which is expected since that's not valid openCypher.)

**Expected:** boolean result for whether the pattern matches anything.

**Actual:**
```
ANALYZE_ERROR
Not implemented: EXISTS
```

**Confidence:** likely just an unimplemented feature (not a bug) — the parser accepts the syntax, the analyzer explicitly rejects it as unimplemented. Worth checking `docs.turingdb.ai`'s Cypher CheatSheet for a documented list of supported/unsupported clauses before filing; if `EXISTS` isn't listed as a known gap it's still worth a feature request.
