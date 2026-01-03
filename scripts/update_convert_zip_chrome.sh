#!/usr/bin/env bash
set -euo pipefail

# Rebuild ConvertTheSpire-Chrome.zip from the Extension-Converter folder
# Deletes old zip and creates new one

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

SRC_DIR="$ROOT_DIR/Extension-Converter"
OUT_FILE="$ROOT_DIR/frontend/downloads/ConvertTheSpire-Chrome.zip"

echo "=== Convert the Spire Chrome Extension Build ==="
echo "Source: $SRC_DIR"
echo "Output: $OUT_FILE"
echo ""

# DELETE the old zip file
if [ -f "$OUT_FILE" ]; then
  echo "DELETING old zip: $OUT_FILE"
  rm -f "$OUT_FILE"
  echo "✓ Deleted"
fi

# Create downloads directory if it doesn't exist
mkdir -p "$(dirname "$OUT_FILE")"

# Create the zip file
echo "Creating new zip archive..."
cd "$SRC_DIR"
zip -r "$OUT_FILE" . -x "*.git*" -x "*__pycache__*" -x "*.DS_Store" > /dev/null

echo "✓ Successfully created ConvertTheSpire-Chrome.zip"
ls -lh "$OUT_FILE"
echo ""
echo "Done!"
