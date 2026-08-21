---
title: latest image breaks the old Dockerfile
---

# `turingdbai/turingdb:latest` silently breaks a Dockerfile written for `nightly`

Not a TuringDB engine bug — a Docker image packaging change between `nightly` (commit `977b3693`, 2026-05-07) and `latest` (commit `106d59f9`, 2026-06-05) that broke our `docker/db.Dockerfile` without any error message pointing at the cause. Documented here because it cost real debugging time and would hit anyone else switching tags.

## What changed

**1. `ENTRYPOINT` now ignores `CMD` entirely.** `latest`'s `ENTRYPOINT` is `/usr/local/bin/run_visualizer.sh`, a fixed shell script that never reads `"$@"` — it always runs its own hardcoded `turingdb start -i 0.0.0.0 -p 6666 -ui`, regardless of what `CMD` says. Our old Dockerfile's `CMD ["sh", "-c", "tail -f /dev/null | turingdb -i 0.0.0.0 -ui -ui-port 8080 -turing-dir /data"]` was silently passed as an ignored argument — the flag we actually cared about, `-turing-dir /data`, never took effect. Data was written to `/home/ubuntu/.turing` inside the container's writable layer instead of the mounted volume, so it wouldn't survive a container recreation.

**2. Runs as a non-root user (`ubuntu`, uid 1000) instead of root.** A freshly mounted Docker volume gets its mount point created as `root:root`, so once you *do* regain control of `-turing-dir` and point it at the volume, the non-root process gets `Permission denied` creating `graphs/`/`data/`/etc. inside it.

**3. Exits immediately (exit 0) if stdin is closed.** Independent of the two issues above: run the image under `docker run -d` (which closes stdin by default) and it logs `TuringDB started`, `Server listening`, then immediately `Terminating Visualizer` / `Terminating server` and exits cleanly. `docker run -d -i` (or Compose's `stdin_open: true`) keeps it alive. Not something `nightly`'s Dockerfile needed to worry about, since its `tail -f /dev/null | turingdb ...` pipe happened to keep stdin open as a side effect.

## Fix applied in this repo

`docker/db.Dockerfile`:
```dockerfile
ENTRYPOINT []
USER root
CMD ["turingdb", "start", "-i", "0.0.0.0", "-ui", "-ui-port", "8080", "-turing-dir", "/data"]
```

`docker-compose.yml`:
```yaml
services:
  turingdb:
    stdin_open: true
```

**Confidence:** high for what's observed (reproduced directly with `docker run`, isolating each cause). Whether this is an intentional hardening change (non-root user) that just isn't documented, or an accidental regression in the entrypoint script, we don't know — worth asking upstream, since the `ENTRYPOINT` swallowing `CMD` silently (no warning, no error) is the kind of thing that's easy to miss until you notice data isn't persisting.
