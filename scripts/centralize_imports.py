#!/usr/bin/env python3
"""Collect top-level imports in backend/app.py, deduplicate them, and move them to the file header.

This script only touches imports that start at column 0 (module-level imports).
It avoids indented imports (e.g., inside try/except or functions).
"""
from __future__ import annotations

from pathlib import Path
import re


FILE = Path("backend/app.py")


def is_import_line(line: str) -> bool:
    return bool(re.match(r"^(import\s+|from\s+\S+\s+import\s+)", line))


def main() -> None:
    text = FILE.read_text(encoding="utf-8")
    lines = text.splitlines(True)

    # Identify top section end (first non-empty non-comment non-import)
    header_end = 0
    for i, ln in enumerate(lines):
        stripped = ln.strip()
        if stripped == "" or stripped.startswith("#"):
            header_end = i + 1
            continue
        if is_import_line(ln):
            header_end = i + 1
            continue
        break

    # Collect module-level imports (lines starting at column 0)
    imports = []
    new_lines = []
    for ln in lines:
        if ln.startswith(("import ", "from ")) and is_import_line(ln):
            imports.append(ln.rstrip("\n"))
        else:
            new_lines.append(ln)

    # Deduplicate while preserving order
    seen = set()
    deduped = []
    for imp in imports:
        if imp not in seen:
            deduped.append(imp)
            seen.add(imp)

    # Reconstruct file: keep first header chunk (up to header_end), then insert deduped imports
    header_chunk = lines[:header_end]
    remainder = [ln for ln in new_lines if ln not in header_chunk]

    # Build new content
    out_lines = []
    out_lines.extend(header_chunk)

    # Ensure separation
    if not header_chunk or (header_chunk and not header_chunk[-1].endswith("\n")):
        out_lines.append("\n")

    for imp in deduped:
        out_lines.append(imp + "\n")

    out_lines.append("\n")
    out_lines.extend(remainder)

    FILE.write_text("".join(out_lines), encoding="utf-8")


if __name__ == "__main__":
    main()
