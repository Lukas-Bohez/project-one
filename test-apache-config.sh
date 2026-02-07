#!/bin/bash

# Backward-compatible shim. Prefer scripts/ops/test-apache-config.sh
exec "$(dirname "$0")/scripts/ops/test-apache-config.sh" "$@"
