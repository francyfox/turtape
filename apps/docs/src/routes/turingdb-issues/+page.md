---
title: TuringDB Issues
---

# TuringDB: possible issues

Status: draft, unfiled. Things observed while testing `@turtape/sdk` against a local TuringDB instance (via `docker compose up -d`, query API on `localhost:6666`) that look like bugs, stale docs, or packaging problems in TuringDB itself, not in `turtape`. Review each page before filing as an issue at [turing-db/turingdb](https://github.com/turing-db/turingdb/issues) — none of these have been reported upstream yet.

Each page: repro, expected vs. actual, and how confident we are it's actually a TuringDB issue rather than us using it wrong.

## Open items

- [`EXISTS` predicate not implemented](/turingdb-issues/exists-not-implemented) — likely just an unimplemented feature, not a bug. Confirmed still true on `v1.37` (2026-08-24 release; `PARSE_ERROR: Not implemented: EXISTS`).
- [Matching an unused label throws instead of returning empty](/turingdb-issues/unknown-label-on-match) — looks like a real deviation from openCypher semantics. Confirmed still present on `v1.37` despite that release's MLIR label/edge-type constraint work (`ANALYZE_ERROR: Unknown label: X` on a fresh graph, unchanged).
- [`HISTORY` keyword doesn't parse — use `CALL db.history()` instead](/turingdb-issues/history-syntax-mismatch) — docs show a bare `HISTORY` keyword that doesn't parse; not a version-drift artifact, looks wrong from the start. Confirmed still present on `v1.37`.
- [Without `-demon`, writes are 500-5000x slower](/turingdb-issues/commit-cpu-hang) — running `turingdb start` without `-demon` (as upstream's own `run_visualizer.sh` does) turns an 0.1s `COMMIT`/`CHANGE SUBMIT` into 8-10 minutes, pegging one HTTP worker thread at ~100% CPU. Root cause not fully diagnosed (no debugger in the runtime image), but the fix (`-demon`) is confirmed and repeatable.
- [Change tracking gets stuck (`CHANGE_NOT_FOUND`)](/turingdb-issues/change-not-found) — after enough write traffic, `CHANGE SUBMIT` (then eventually every `CHANGE` operation) starts failing on changes that were just created, with no error logged anywhere. Root cause not confirmed, but a workaround is: `CREATE GRAPH <throwaway-name>` resets the stuck state without a container restart. Not re-tested against `v1.37` — reproducing needs sustained write traffic, not a single query.

## Resolved (kept for reference)

- [Inline pattern filter + `count()` crashes](/turingdb-issues/inline-filter-count-crash) — **fixed in `v1.37`** (2026-08-24). Internal `ColumnMask` dispatch error used to leak a raw C++ type name; confirmed fixed by direct repro against the upgraded local image (`MATCH (z:Zebra {name: "Marty"}) RETURN count(z)` now returns the count instead of `EXEC_ERROR`). Likely landed as a side effect of that release's MLIR aggregate/codegen work, not a targeted fix.
- [Commit not visible](/turingdb-issues/commit-not-visible) — not a bug: `COMMIT` alone doesn't merge into main, `CHANGE SUBMIT` does. Originally also noted `CHANGE SUBMIT` responding very slowly; that turned out to be [the `-demon` issue below](/turingdb-issues/commit-cpu-hang), not inherent to the operation.

## Docker image / CI / packaging, not the engine itself

- [`nightly` Docker tag is stale](/turingdb-issues/nightly-build-disabled) — its build workflow has been `disabled_manually` since ~June 2026, after several days of failing runs; the image is frozen ~3.5 months / 820 commits behind `main`.
- [`latest` image breaks a Dockerfile written for `nightly`](/turingdb-issues/latest-image-breaking-changes) — `ENTRYPOINT` now ignores `CMD` entirely, runs as a non-root user, and exits immediately if stdin is closed. Fixed in this repo's `docker/db.Dockerfile` and `docker-compose.yml`.
- [CLI reports version "1.0"](/turingdb-issues/cli-version-hardcoded) — the `turingdb` binary shipped in the PyPI wheel has a hardcoded `"1.0"` version literal in its C++ source, disconnected from the real release version (`1.37`, correctly tracked on PyPI/GitHub via git tags). Confirmed still present on `v1.37`.

## Environment

- Image: self-built (`docker/db.Dockerfile`) — `pip install turingdb` from PyPI on a `python:3.14-slim` base, not `turingdbai/turingdb:latest`/`:nightly`. Both official tags turned out to lag `main` by months (see below), and `latest`'s own `ENTRYPOINT` breaks a Dockerfile written for `nightly` — see the two entries below for details. The self-built image also runs `turingdb start -demon` (see `commit-cpu-hang` above), which the official images' `run_visualizer.sh` does not.
- Started via `docker compose up -d` at repo root
- Queried directly through `@turtape/sdk`'s `queryRaw()` (`packages/sdk`), which just POSTs the Cypher string to the query API at `localhost:6666`
- Cross-checked several findings against `turing-db/turingdb`'s `main` branch source directly (not just the locally running image), given how stale both Docker tags turned out to be
