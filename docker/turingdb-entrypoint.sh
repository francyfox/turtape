#!/bin/sh
set -e

# Mirrors upstream's run_visualizer.sh (turing-db/turingdb: run_visualizer.sh),
# but adds -turing-dir so data lands on the mounted volume instead of the
# container's writable layer, and runs as root since a freshly mounted
# volume's mount point is created root:root (see docs: latest-image-breaking-changes).
# Serves the visualizer's static build with Python's stdlib http.server instead
# of `npm i -g serve`, so the image doesn't need a Node.js runtime at all
# (turingdb-visualizer has no client-side router, so no SPA-fallback is needed).
python3 -m http.server "$TURINGDB_VIS_PORT" --bind 127.0.0.1 --directory "$TURINGDB_VIS_DIR" >/var/log/turingdb-visualizer.log 2>&1 &

# EXPERIMENT: -demon avoids the interactive LineNoise shell entirely (it
# forks, waits for the server to report ready, and returns) instead of
# running `TuringShell::startLoop()` reading stdin in a loop. Testing whether
# that shell -- which expects a real TTY and gets a plain open pipe from
# `stdin_open: true` instead -- is what was pegging a worker thread at 100%
# CPU on COMMIT (see docs/turingdb-issues: commit-cpu-hang).
turingdb start -i 0.0.0.0 -p 6666 -ui -ui-port 8080 -turing-dir /data -demon
exec tail -F /data/logs/turingdb.log
