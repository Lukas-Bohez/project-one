#!/bin/bash

# Backward-compatible shim. Prefer scripts/ops/restart-websocket-server.sh
exec "$(dirname "$0")/scripts/ops/restart-websocket-server.sh" "$@"
