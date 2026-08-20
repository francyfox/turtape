---
title: TuringDB Issues
---

# TuringDB: possible issues

Status: draft, unfiled. Things observed while testing `@turtape/sdk` against a local `turingdbai/turingdb:nightly` instance (via `docker compose up -d`, query API on `localhost:6666`) that look like bugs or undocumented behavior in TuringDB itself, not in `turtape`. Review each page before filing as an issue at [turing-db/turingdb](https://github.com/turing-db/turingdb/issues) — none of these have been reported upstream yet.

Each page: repro, expected vs. actual, and how confident we are it's actually a TuringDB issue rather than us using it wrong.

## Open items

- [`EXISTS` predicate not implemented](/turingdb-issues/exists-not-implemented) — likely just an unimplemented feature, not a bug.
- [Matching an unused label throws instead of returning empty](/turingdb-issues/unknown-label-on-match) — looks like a real deviation from openCypher semantics.
- [Committed data not visible without repeating the change context](/turingdb-issues/commit-not-visible) — low confidence, needs more investigation before filing.

## Environment

- Image: `turingdbai/turingdb:nightly` (see `docker/db.Dockerfile`)
- Started via `docker compose up -d` at repo root
- Queried directly through `@turtape/sdk`'s `queryRaw()` (`packages/sdk`), which just POSTs the Cypher string to the query API at `localhost:6666`
