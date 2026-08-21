# Stage 1: build the turingdb-visualizer frontend bundle (same as upstream)
FROM node:22-slim AS visualizer-builder

RUN apt-get update && apt-get install -y --no-install-recommends \
        git \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /vis
RUN git clone --depth 1 https://github.com/turing-db/turingdb-visualizer.git . \
 && npm install \
 && npm run build

# Stage 2: runtime image
FROM python:3.14-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
    && rm -rf /var/lib/apt/lists/*

# A COMMIT on a trivial ~12-node graph pegs one HTTP worker thread at ~100%
# CPU for minutes, sometimes followed by a malformed (non-JSON) response --
# see docs/turingdb-issues: commit-cpu-hang. Confirmed this is NOT the MLIR
# query-engine rewrite (landed 2026-06-01+): pinning to 1.32, the last
# pre-MLIR release, reproduced the exact same hang. So there's no version to
# roll back to here -- stay on latest (see docker-compose.yml for the
# cpu/mem limits + healthcheck + autoheal this bug makes necessary).
RUN pip install --no-cache-dir turingdb

COPY --from=visualizer-builder /vis/dist /opt/turingdb-visualizer

ENV TURINGDB_VIS_DIR=/opt/turingdb-visualizer
ENV TURINGDB_VIS_PORT=3000
ENV TURINGDB_VIS_URL=http://127.0.0.1:3000

COPY docker/turingdb-entrypoint.sh /usr/local/bin/turingdb-entrypoint.sh
RUN chmod +x /usr/local/bin/turingdb-entrypoint.sh

EXPOSE 6666 8080

# A plain GET / isn't enough: the server has ~10 HTTP worker threads, so one
# request stuck spinning at 100% CPU (see commit-cpu-hang above) doesn't stop
# GET / from being served by a different, unaffected thread -- that check
# would stay "healthy" while the DB is quietly losing workers one hang at a
# time. Run an actual query with a tight timeout instead: -m bounds how long
# curl waits for a free/responsive worker, so this only reports unhealthy
# once the server genuinely can't turn around a trivial request in time.
HEALTHCHECK --interval=30s --timeout=15s --start-period=60s --retries=3 \
    CMD test "$(curl -sS -m 10 -o /dev/null -w '%{http_code}' -X POST \
        'http://localhost:6666/query' --data-raw 'RETURN 1')" = "200"

ENTRYPOINT ["/usr/local/bin/turingdb-entrypoint.sh"]
