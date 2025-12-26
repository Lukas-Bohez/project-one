#!/usr/bin/env bash
set -euo pipefail

# Rebuild ConvertTheSpire.zip from the Extension-Converter folder
# Usage:
#   ./scripts/update_convert_zip.sh                # use repo paths
#   ./scripts/update_convert_zip.sh /path/to/src /path/to/downloads/out.zip


# Resolve directories relative to the script location (works when invoked from anywhere)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DEFAULT_SRC="$ROOT_DIR/Extension-Converter"
DEFAULT_OUT_DIR="$ROOT_DIR/frontend/downloads"
DEFAULT_OUT="$DEFAULT_OUT_DIR/ConvertTheSpire.zip"

SRC_DIR="${1:-$DEFAULT_SRC}"
OUT_PATH="${2:-$DEFAULT_OUT}"

echo "Source: $SRC_DIR"
echo "Output: $OUT_PATH"

if [ ! -d "$SRC_DIR" ]; then
  echo "Source directory does not exist: $SRC_DIR" >&2
  exit 2
fi


OUT_DIR=$(dirname "$OUT_PATH")
mkdir -p "$OUT_DIR"

TMP_BASE="$OUT_DIR/ConvertTheSpire"

# Remove any existing zip at the exact path
if [ -f "$OUT_PATH" ]; then
  echo "Removing existing $OUT_PATH"
  rm -f "$OUT_PATH"
fi

echo "Creating zip archive..."
python3 - <<PY
import shutil, os, sys
src = os.path.abspath("$SRC_DIR")
out_dir = os.path.abspath("$OUT_DIR")
out_base = os.path.join(out_dir, 'ConvertTheSpire')
if os.path.exists(out_base + '.zip'):
    os.remove(out_base + '.zip')
shutil.make_archive(out_base, 'zip', src)
print('Created:', out_base + '.zip')
PY

# If the created zip is not at the requested OUT_PATH, move it
CREATED_ZIP="$OUT_DIR/ConvertTheSpire.zip"
if [ -f "$CREATED_ZIP" ]; then
  if [ "$OUT_PATH" != "$CREATED_ZIP" ]; then
    mv -f "$CREATED_ZIP" "$OUT_PATH"
    echo "Success: $OUT_PATH"
  else
    echo "Success: $CREATED_ZIP"
  fi
else
  echo "Failed to create zip" >&2
  exit 1
fi

echo "Done."
