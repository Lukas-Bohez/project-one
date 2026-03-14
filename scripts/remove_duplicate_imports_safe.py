#!/usr/bin/env python3
"""Comment out duplicate module-level imports in backend/app.py.

This is conservative: it comments out later duplicate imports rather than moving them.
It handles single-line `import X` and `from X import Y` as well as parenthesized
multi-line `from X import (` blocks.
"""
from pathlib import Path
import re

FILE = Path("backend/app.py")


def main():
    text = FILE.read_text(encoding="utf-8")
    lines = text.splitlines(True)
    out_lines = []
    seen = set()
    i = 0
    while i < len(lines):
        ln = lines[i]
        if not ln.startswith(("import ", "from ")):
            out_lines.append(ln)
            i += 1
            continue

        # Multi-line from X import ( ... )
        m = re.match(r"^from\s+([A-Za-z0-9_.]+)\s+import\s*\(\s*$", ln)
        if m:
            module = m.group(1)
            block = [ln]
            j = i + 1
            closed = False
            while j < len(lines):
                block.append(lines[j])
                if lines[j].strip().endswith(")"):
                    closed = True
                    break
                j += 1
            if module in seen:
                out_lines.append("# Duplicate import commented out by script\n")
                out_lines.extend(["# " + l for l in block])
            else:
                seen.add(module)
                out_lines.extend(block)
            i = j + 1 if closed else j
            continue

        # Single-line from X import Y or import X
        m2 = re.match(r"^(from|import)\s+([A-Za-z0-9_.]+)", ln)
        if m2:
            module = m2.group(2)
            if module in seen:
                out_lines.append("# Duplicate import commented out by script\n")
                out_lines.append("# " + ln)
            else:
                seen.add(module)
                out_lines.append(ln)
            i += 1
            continue

        out_lines.append(ln)
        i += 1

    FILE.write_text("".join(out_lines), encoding="utf-8")


if __name__ == "__main__":
    main()
