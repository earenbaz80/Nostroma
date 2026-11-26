#!/bin/sh
# `nostroma` inside the container: the Terminal, with the address and the API key of the
# server this container runs, so that `docker exec <name> nostroma monitor --once`, `nostroma status` and `nostroma connect
# opencode` work without typing either.
# A key or address you set yourself (NOSTROMA_API_KEY, NOSTROMA_URL, --url) always wins.
KEY_FILE="${NOSTROMA_KEY_FILE:-/data/state/api-key}"
if [ -z "${NOSTROMA_API_KEY:-}" ] && [ -r "$KEY_FILE" ]; then
  NOSTROMA_API_KEY=$(cat "$KEY_FILE"); export NOSTROMA_API_KEY
fi
NOSTROMA_URL="${NOSTROMA_URL:-http://127.0.0.1:${PORT:-8080}}"; export NOSTROMA_URL
exec /opt/nostroma/terminal/bin/nostroma "$@"
