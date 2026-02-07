#!/usr/bin/env bash
set -euo pipefail

PORT=57891

if lsof -i :${PORT} >/dev/null 2>&1; then
  echo "Port ${PORT} is already in use."
  exit 1
fi

node server.js &
SERVER_PID=$!

sleep 0.6
open "http://localhost:${PORT}"

echo "Started server (PID ${SERVER_PID}) on http://localhost:${PORT}"
