---
title: nightly Docker tag is stale
---

# `turingdbai/turingdb:nightly` hasn't rebuilt in months — its CI workflow is disabled

**What we expected:** [`turing-db/turingdb#229`](https://github.com/turing-db/turingdb/pull/229) ("Create Nightly Docker Image", merged 2026-01-16) added a GitHub Actions workflow (`.github/workflows/ci_docker.yaml`, "Docker Nightly Build") on a `0 2 * * *` cron — every night at 02:00 UTC — that builds and pushes `turingdbai/turingdb:nightly`.

**What's actually happening:**
- Docker Hub shows `nightly` last pushed **2026-05-07**.
- The workflow's run history shows it kept firing on schedule through **2026-06-07 to 2026-06-11**, but every one of those runs ended `failure` or `cancelled` — none produced a new image.
- The workflow's current state on GitHub is **`disabled_manually`** — someone turned it off rather than fixing it, so it isn't even attempting to run anymore.

Net effect: `turingdbai/turingdb:nightly` is frozen at commit `977b3693b483f42a496773fee3617d68a7762c51` (2026-05-06), currently **820 commits behind `main`** (~3.5 months), despite the name implying it tracks `main` daily.

**`latest` isn't much better** — see [Docker images: latest breaks the old Dockerfile](/turingdb-issues/latest-image-breaking-changes) — it's fresher (pushed 2026-06-05, commit `106d59f9`) but still ~2.5 months behind `main`, and appears to be published by a separate, unrelated path (possibly the release workflow triggered by `v*` tags) rather than nightly's cron.

**Confidence:** high — this is directly observable from the GitHub Actions API (workflow state, run conclusions) and Docker Hub's tag metadata, not inference from behavior.

**Practical takeaway for `turtape`:** don't assume `nightly` (or even `latest`) reflects current `main` behavior. Several of the other issues on this page were re-verified by pulling `main`'s source directly (`git compare`, raw file greps) rather than trusting the locally running image's behavior, precisely because of this gap.
