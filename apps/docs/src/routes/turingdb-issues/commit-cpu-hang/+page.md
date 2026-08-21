---
title: Without -demon, writes are 500-5000x slower
---

# `turingdb start` without `-demon` makes unrelated HTTP writes take minutes instead of milliseconds

**Repro:** run `turingdb start -i 0.0.0.0 -p 6666 -ui -turing-dir /data` (no `-demon`) in a container with `stdin_open: true` (a plain pipe, not a TTY), then over HTTP: `CHANGE NEW` → `CREATE` (a dozen nodes/edges) → `COMMIT` → `CHANGE SUBMIT`.

**Expected:** each step responds in well under a second, same as any trivial write on a tiny graph.

**Actual:** `CHANGE NEW` and `CREATE` are fast (tens of ms), but `COMMIT` and especially `CHANGE SUBMIT` can take **8-10 minutes**, during which one HTTP worker thread sits at ~100% CPU continuously (confirmed via `/proc/<pid>/task/*/stat`: `state=R`, `wchan=0`, `utime` climbing in lockstep with wall time -- a real busy spin, not a blocked/waiting thread). Sometimes the request eventually returns a non-JSON body instead of the expected result.

**Root cause:** without `-demon`, `StartCmd::execute()` (`tools/turingdb/StartCmd.cpp`) starts the HTTP server *and* an interactive `TuringShell`/`LineNoiseHandle` REPL reading from stdin (`shell->startLoop()`), in addition to the server. `-demon` skips that shell entirely (it forks, waits for a ready ping, and returns -- see `Demonology::demonize()`). In a container, stdin is a plain pipe, not a real terminal -- and having that REPL running against a non-TTY stdin, for reasons not fully diagnosed (no debugger available in the minimal runtime image to get a stack trace of the spinning thread), makes a completely unrelated HTTP worker thread's `COMMIT`/`CHANGE SUBMIT` handling pathologically slow. The two subsystems should have no reason to contend -- this looks like unintended contention on some shared resource/lock, not a documented tradeoff of interactive mode.

**Fix:** add `-demon` to the startup command. Confirmed fix, repeatedly:

| | without `-demon` | with `-demon` |
|---|---|---|
| `CHANGE NEW` → `CREATE` → `COMMIT` → `CHANGE SUBMIT` | 8-10 minutes | ~0.12 seconds |
| worker thread CPU while idle-ish | pegged at ~100% | ~0% |

`docker/turingdb-entrypoint.sh` in this repo now uses `-demon` (and tails the log file to keep the container's PID 1 alive, since `-demon` forks and the invoking process exits once the server reports ready).

**This is very likely NOT specific to our setup.** Upstream's own `run_visualizer.sh` (baked into `turingdbai/turingdb:latest`/`:nightly`) also starts the server without `-demon`:
```sh
exec turingdb start -i 0.0.0.0 -p 6666 -ui
```
So the official Docker images almost certainly hit the same slowdown, unless something else in their base image gives stdin a TTY-like behavior that ours didn't.

**False leads ruled out along the way** (kept for context, since they cost real time):
- **Not an MLIR-rewrite regression.** Pinning to `turingdb==1.32` (the last release before MLIR landed, 2026-05-20) reproduced the identical hang -- same symptom on both sides of the MLIR work, because both test runs were made without `-demon`.
- **Not the SDK's retry logic**, though that surfaced a real, separate bug: retrying an already-slow-but-successful `CHANGE SUBMIT` on transport failure could produce a spurious `CHANGE_NOT_FOUND` (fixed in `@turtape/sdk` by not retrying `COMMIT`/`CHANGE SUBMIT` -- see the SDK's `turingdb-provider` module). That fix is still correct and worth keeping regardless of this finding.
- **Not a server-side "malformed response" bug.** An earlier observation of a response body that looked like the server had echoed the raw Cypher request text back turned out to be a local debug `console.log(cypher)` in `@turtape/sdk` printing to the same stdout stream, interleaved with an unrelated error -- not anything the server sent.

**Confidence:** high on the repro and the fix (`-demon` reliably resolves it, tested repeatedly). Medium on the exact mechanism inside TuringDB -- we could confirm *that* the interactive shell is the trigger and *that* it's a real busy-spin (not I/O wait), but not *why* a REPL thread would contend with an HTTP worker's commit path, since the runtime image has no debugger to pull a stack trace from the spinning thread. Worth filing upstream with this repro; `turing-db/turingdb`'s issue tracker has a history of bugs in the same commit/write-buffer area (#38, #54, #279, #449) but nothing matching this specific symptom as of 2026-08-21.
