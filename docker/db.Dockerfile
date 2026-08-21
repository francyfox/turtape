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

RUN pip install --no-cache-dir turingdb

COPY --from=visualizer-builder /vis/dist /opt/turingdb-visualizer

ENV TURINGDB_VIS_DIR=/opt/turingdb-visualizer
ENV TURINGDB_VIS_PORT=3000
ENV TURINGDB_VIS_URL=http://127.0.0.1:3000

COPY docker/turingdb-entrypoint.sh /usr/local/bin/turingdb-entrypoint.sh
RUN chmod +x /usr/local/bin/turingdb-entrypoint.sh

EXPOSE 6666 8080

# No -f: turingdb has no 2xx health route, every GET (even unknown paths) answers
# 405. A completed HTTP response is proof enough that the server is up.
HEALTHCHECK --interval=30s --timeout=20s --start-period=60s --retries=5 \
    CMD curl -sS -o /dev/null "http://localhost:6666/" || exit 1

ENTRYPOINT ["/usr/local/bin/turingdb-entrypoint.sh"]
