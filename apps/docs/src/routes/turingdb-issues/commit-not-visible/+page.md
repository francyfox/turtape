---
title: Commit not visible (resolved)
---

# Committed data not visible without repeating the change context — resolved, not a bug

**Original symptom:** `CHANGE NEW` → `CREATE ...` (with `context: { change }`) → `COMMIT` (with `context: { change }`) — then querying the graph **without** a `change`/`commit` context still gave `ANALYZE_ERROR: Unknown label: X`, as if the commit never reached the graph's default/main line.

**Resolution: `COMMIT` alone doesn't merge a change into main — `CHANGE SUBMIT` does.** Confirmed against the docs' own example workflow (`docs.turingdb.ai/pythonsdk/reference`):
```python
client.query("COMMIT")
client.query("CHANGE SUBMIT")
client.checkout()  # back to main
```
Adding `CHANGE SUBMIT` (same `context: { change }`) after `COMMIT` fixed it — the data became visible in the default graph both via `queryRaw()` and visually in the web visualizer (`localhost:8080`) afterward.

**Update:** the "`CHANGE SUBMIT` can take minutes" gotcha below was *not* an inherent property of the operation — see [without `-demon`, writes are 500-5000x slower](/turingdb-issues/commit-cpu-hang). Running `turingdb start` without `-demon` (interactive shell reading a non-TTY stdin) made this same write cycle take 8-10 minutes; with `-demon` it's ~0.12s. Left the original note below for context, but don't take "give it a generous timeout" as the fix — fix the startup flags instead.

**One real gotcha that remains (see update above):** `CHANGE SUBMIT` can take a very long time to respond — one of our test runs took over 2 minutes and the client-side request effectively hung/timed out. The operation had actually completed successfully server-side (confirmed after the fact — the data was there), so this looks like a slow-response issue rather than a real failure. Give it a generous timeout rather than treating a hang as an error.

**Takeaway for `turtape`:** the full write cycle is `CHANGE NEW` → (writes, with `context: { change }`) → `COMMIT` (same context) → `CHANGE SUBMIT` (same context) — all four steps required to get data into the graph everyone else queries by default. `examples/src/sdk.ts` demonstrates this end-to-end.
