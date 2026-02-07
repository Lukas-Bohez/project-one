#!/bin/bash

# Backward-compatible shim. Prefer scripts/ops/test-seo-accessibility.sh
exec "$(dirname "$0")/scripts/ops/test-seo-accessibility.sh" "$@"
