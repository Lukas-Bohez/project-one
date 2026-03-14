#!/usr/bin/env python3
"""Safely collect module-level import blocks and move them to the top of backend/app.py.

This handles single-line imports and parenthesized multi-line `from X import (` blocks.
It preserves the original order and deduplicates exact import blocks.
It ignores indented imports (keeps imports inside functions/try blocks).
"""
from pathlib import Path
import re

FILE = Path("backend/app.py")


def is_module_level(line: str) -> bool:
    return line.startswith("import ") or line.startswith("from ")


def collect_import_blocks(lines):
    blocks = []
    ranges = []
    i = 0
    while i < len(lines):
        ln = lines[i]
        if not ln.startswith(("import ", "from ")):
            i += 1
            continue

        # Skip indented imports
        if ln[:len(ln) - len(ln.lstrip())]:
            i += 1
            continue

        # Multi-line from X import (
        m = re.match(r"^from\s+[A-Za-z0-9_.]+\s+import\s*\(\s*$", ln)
        if m:
            start = i
            block = [ln.rstrip('\n')]
            j = i + 1
            while j < len(lines):
                block.append(lines[j].rstrip('\n'))
                if lines[j].strip().endswith(")"):
                    break
                j += 1
            end = j
            blocks.append(("\n".join(block), start, end))
            ranges.append((start, end))
            i = end + 1
            continue

        # Single-line import
        blocks.append((ln.rstrip('\n'), i, i))
        ranges.append((i, i))
        i += 1

    return blocks, ranges


def main():
    text = FILE.read_text(encoding="utf-8")
    lines = text.splitlines(True)

    # Find header end: first non-import, non-comment, non-blank
    header_end = 0
    for idx, ln in enumerate(lines):
        s = ln.strip()
        if s == "" or s.startswith("#") or is_module_level(ln):
            header_end = idx + 1
            continue
        break

    blocks, ranges = collect_import_blocks(lines)

    if not blocks:
        return

    # Deduplicate while preserving order
    seen = set()
    deduped = []
    for blk, a, b in blocks:
        if blk not in seen:
            deduped.append(blk)
            seen.add(blk)

    # Remove original blocks by marking lines to keep
    to_remove = set()
    for start, end in ranges:
        for k in range(start, end + 1):
            to_remove.add(k)

    remaining = [ln for idx, ln in enumerate(lines) if idx not in to_remove]

    # Insert deduped imports after header_end (which may have shifted due to removals)
    # Compute new header_end position (count lines from original that were kept up to header_end)
    new_header_end = 0
    for idx in range(0, header_end):
        if idx not in to_remove:
            new_header_end += 1

    out = []
    out.extend(remaining[:new_header_end])
    # Ensure a blank line before inserted imports
    if out and not out[-1].endswith("\n"):
        out[-1] = out[-1] + "\n"

    for blk in deduped:
        out.append(blk + "\n")

    out.append("\n")
    out.extend(remaining[new_header_end:])

    FILE.write_text("".join(out), encoding="utf-8")


if __name__ == "__main__":
    main()
