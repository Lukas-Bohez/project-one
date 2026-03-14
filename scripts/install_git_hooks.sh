#!/usr/bin/env bash
set -euo pipefail

# Installs the repo-local git hooks from .githooks into .git/hooks
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HOOK_SRC="$ROOT_DIR/.githooks/pre-commit"
HOOK_DST="$ROOT_DIR/.git/hooks/pre-commit"

if [ ! -f "$HOOK_SRC" ]; then
  echo "No hook found at $HOOK_SRC" >&2
  exit 1
fi

mkdir -p "$ROOT_DIR/.git/hooks"
cp "$HOOK_SRC" "$HOOK_DST"
chmod +x "$HOOK_DST"
echo "Installed pre-commit hook to .git/hooks/pre-commit"
