#!/bin/sh
set -e

# Mirrors upstream's run_visualizer.sh (turing-db/turingdb: run_visualizer.sh),
# but adds -turing-dir so data lands on the mounted volume instead of the
# container's writable layer, and runs as root since a freshly mounted
# volume's mount point is created root:root (see docs: latest-image-breaking-changes).
serve -s "$TURINGDB_VIS_DIR" -l "tcp://127.0.0.1:$TURINGDB_VIS_PORT" >/var/log/turingdb-visualizer.log 2>&1 &

# turingdb exits immediately if stdin is closed (no -demon flag) -- compose
# sets stdin_open: true to keep this alive.
exec turingdb start -i 0.0.0.0 -p 6666 -ui -ui-port 8080 -turing-dir /data
