---
title: Change tracking gets stuck (CHANGE_NOT_FOUND)
---

# Change-tracking state can get stuck — every `CHANGE` operation reports `CHANGE_NOT_FOUND`

**Repro:** Run enough `CHANGE NEW` → (writes) → `COMMIT` → `CHANGE SUBMIT` cycles against the
default graph — reproduced organically during `@turtape/sdk`'s own integration test suite, no
special query needed, just ordinary write traffic over a few minutes. At some point a step starts
failing:
```json
{"error":"CHANGE_NOT_FOUND","error_details":"No error message available.","time":...}
```

**Expected:** Every step of the cycle succeeds, same as any other `CHANGE NEW`/`COMMIT`/
`CHANGE SUBMIT` sequence — confirmed working fine early in a fresh server's life (see
[commit not visible](/turingdb-issues/commit-not-visible)), and `examples/src/clear-graph.ts`'s
sequence is exactly this cycle.

**Actual:** Once triggered, the failure escalates over time rather than staying constant:

1. Initially only `CHANGE SUBMIT` (the merge-into-main step) fails, while `CHANGE NEW`, the writes,
   and `COMMIT` on the *same* change all succeed first.
2. Each failed `CHANGE SUBMIT` leaves the change stuck instead of clearing it — `CHANGE LIST` keeps
   growing with unsubmitted change IDs.
3. As more of these accumulate, the failure creeps earlier in the cycle, until eventually a change
   created moments ago fails immediately on its very first operation.

Once a change is stuck, `CHANGE LIST` still reports its ID, but nothing can reach it — `COMMIT`,
`CHANGE SUBMIT`, even `CHANGE DELETE` on that ID all report `CHANGE_NOT_FOUND`. There's no way found
to clear an individual stuck change; see the workaround below for clearing all of them at once.

**What we ruled out:**
- **Not a client bug.** `examples/src/clear-graph.ts` reuses the exact same `{ change: changeId }`
  context across all four calls; three succeed and only the last fails. A malformed request would
  fail consistently on every call, not selectively on the last one.
- **Not disk/volume state.** `/data/graphs/default/{commits,dataparts,commitlog}` inside the
  container holds only real committed data — no file resembling a "pending changes" ledger. Rolling
  back with `LOAD COMMIT` to the very first commit doesn't clear the stuck changes either, which
  confirms the broken state lives entirely in server process memory, independent of which commit is
  checked out.
- **Not `autoheal` restarting the container.** The healthcheck (`RETURN 1`) never touches the
  change/commit path, so it stays green throughout. Neither container's logs show a crash,
  exception, or restart trigger anywhere near a failure — just routine
  `[info] Dumping graph default` lines.

**Root cause (plausible, not confirmed):** `turing-db/turingdb`'s `ChangeManager` keys its
in-memory pending-changes map by `(const Graph*, ChangeID)` — a raw pointer to the in-memory
`Graph` object, not by graph name (`storage/ChangeManager.h`). If some internal operation (a graph
"dump", the thing logged as `Dumping graph default`, observed firing right around writes) ever
reallocates or reinitializes that `Graph` instance, every change created against the old pointer
becomes permanently unreachable under the new one — a legitimate, silent map miss, matching both
the lack of any logged error and the escalating pattern (each stuck change is dead weight that's
never cleared). Not confirmed with a debugger — the runtime image has none, same limitation noted
in [the `-demon` CPU hang issue](/turingdb-issues/commit-cpu-hang).

**Workaround found — no restart needed:** Running `CREATE GRAPH <any_name>`, even a throwaway,
otherwise-unused graph, resets the stuck state on `default`: `CHANGE LIST` goes back to empty,
change IDs restart from `0`, and a full `CHANGE NEW` → `CREATE` → `COMMIT` → `CHANGE SUBMIT` →
`MATCH` cycle succeeds immediately afterward — without losing any of `default`'s existing commit
history. The only downside: there's no `DROP GRAPH`, so the throwaway graph can't be removed
afterward; it just sits there, empty, forever in `LIST GRAPH`. A full
`docker compose restart turingdb` also works (and was the only known fix before this), but is far
heavier-handed and needs Docker access the `CREATE GRAPH` workaround doesn't.

**Bonus finding while investigating this:** `CREATE GRAPH` did **not** hang on this repo's actual
`docker/db.Dockerfile` image (`pip install turingdb` from PyPI) — it returned in ~39ms. The
existing hang note in [the plan](/plan) was recorded against `turingdbai/turingdb:nightly`
directly, before this project switched to the self-built image; that note is now stale for the
environment this repo actually runs (updated there to point here).

**Confidence:** High on the repro, the escalation pattern, and the workaround — all reproduced
live, repeatedly, against the running container. Low-medium on the root cause: a plausible read of
the source, not confirmed with a debugger. Worth filing upstream with the repro once the `Graph*`
reallocation theory (or a better one) is confirmed; not filed yet.

**Takeaway for `turtape`:** if an integration test (or any long dev session against this server)
starts seeing `CHANGE_NOT_FOUND` on a change it just created, try `CREATE GRAPH <throwaway-name>`
before reaching for a full container restart — much cheaper, and doesn't need Docker access.
