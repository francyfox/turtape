FROM turingdbai/turingdb:nightly

EXPOSE 6666 8080

# No -f: turingdb has no 2xx health route, every GET (even unknown paths) answers
# 405. A completed HTTP response is proof enough that the server is up.
HEALTHCHECK --interval=30s --timeout=20s --start-period=60s --retries=5 \
    CMD curl -sS -o /dev/null "http://localhost:6666/" || exit 1

CMD ["sh", "-c", "tail -f /dev/null | turingdb -i 0.0.0.0 -ui -ui-port 8080 -turing-dir /data"]