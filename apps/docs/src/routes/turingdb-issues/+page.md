---
title: TuringDB Issues
---

# TuringDB: possible issues

Status: draft, unfiled. Things observed while testing `@turtape/sdk` against a local TuringDB instance (via `docker compose up -d`, query API on `localhost:6666`) that look like bugs, stale docs, or packaging problems in TuringDB itself, not in `turtape`. Review each page before filing as an issue at [turing-db/turingdb](https://github.com/turing-db/turingdb/issues) — none of these have been reported upstream yet.

Each page: repro, expected vs. actual, and how confident we are it's actually a TuringDB issue rather than us using it wrong.

## Open items

- [`EXISTS` predicate not implemented](/turingdb-issues/exists-not-implemented) — likely just an unimplemented feature, not a bug. Confirmed still true on current `main`.
- [Matching an unused label throws instead of returning empty](/turingdb-issues/unknown-label-on-match) — looks like a real deviation from openCypher semantics.
- [`HISTORY` keyword doesn't parse — use `CALL db.history()` instead](/turingdb-issues/history-syntax-mismatch) — docs show a bare `HISTORY` keyword that doesn't parse; not a version-drift artifact, looks wrong from the start.
- [Inline pattern filter + `count()` crashes](/turingdb-issues/inline-filter-count-crash) — internal `ColumnMask` dispatch error leaks a raw C++ type name; `WHERE` works fine as a substitute. Confirmed still present on current `main`.

## Resolved (kept for reference)

- [Commit not visible](/turingdb-issues/commit-not-visible) — not a bug: `COMMIT` alone doesn't merge into main, `CHANGE SUBMIT` does. Also notes that `CHANGE SUBMIT` can respond very slowly.

## Docker image / CI / packaging, not the engine itself

- [`nightly` Docker tag is stale](/turingdb-issues/nightly-build-disabled) — its build workflow has been `disabled_manually` since ~June 2026, after several days of failing runs; the image is frozen ~3.5 months / 820 commits behind `main`.
- [`latest` image breaks a Dockerfile written for `nightly`](/turingdb-issues/latest-image-breaking-changes) — `ENTRYPOINT` now ignores `CMD` entirely, runs as a non-root user, and exits immediately if stdin is closed. Fixed in this repo's `docker/db.Dockerfile` and `docker-compose.yml`.
- [CLI reports version "1.0"](/turingdb-issues/cli-version-hardcoded) — the `turingdb` binary shipped in the PyPI wheel has a hardcoded `"1.0"` version literal in its C++ source, disconnected from the real release version (`1.36`, correctly tracked on PyPI/GitHub via git tags).

## Environment

- Image: `turingdbai/turingdb:latest` (see `docker/db.Dockerfile`) — switched from `:nightly`, which turned out to be the more stale of the two tags (see above).
- Started via `docker compose up -d` at repo root
- Queried directly through `@turtape/sdk`'s `queryRaw()` (`packages/sdk`), which just POSTs the Cypher string to the query API at `localhost:6666`
- Cross-checked several findings against `turing-db/turingdb`'s `main` branch source directly (not just the locally running image), given how stale both Docker tags turned out to be
