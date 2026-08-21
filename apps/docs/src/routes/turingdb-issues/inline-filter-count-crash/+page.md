---
title: Inline filter + count() crash
---

# Inline pattern property filter + `count()` throws an internal engine error

**Repro:**
```cypher
MATCH (z:Zebra {name: "Marty"}) RETURN count(z)
```
```
EXEC_ERROR
Unsupported unary operation on column of type db::ColumnMask; std::string_view = std::basic_string_view<char>
```

**The equivalent `WHERE`-clause form works fine:**
```cypher
MATCH (z:Zebra) WHERE z.name = "Marty" RETURN count(z)
```
returns the expected count. Same semantics, same data — only the filter placement differs.

**What's actually failing:** confirmed by pulling `turing-db/turingdb`'s `main` branch source directly (not just the locally running, months-stale image — see [nightly is stale](/turingdb-issues/nightly-build-disabled)): `storage/columns/ColumnOperatorDispatcher.h` has a generic unary-operation dispatcher with cases for `ColumnVector`, `ColumnConst`, `ColumnSet`, and `ColumnMask` — but whatever code path an inline pattern filter takes when combined with `count()` ends up invoking an operation `ColumnMask` doesn't have a case for, hitting the `default:` branch, which throws `FatalException(fmt::format("Unsupported unary operation on column of type {}", ...))`. This is current on `main` as of 2026-08-20 — not something already fixed since our image was built.

**Confidence:** high that this is a real engine bug, not user error — a raw C++ type name (`db::ColumnMask`, `std::basic_string_view<char>`) leaking into the API's `error_details` is a strong signal this is an unhandled internal case, not an intentional validation error (compare to `ANALYZE_ERROR: Unknown label: X`, which reads like a deliberate, user-facing message).

**Workaround:** use `WHERE` instead of inline pattern property filters when aggregating (`count()`, likely other aggregates too — untested).
