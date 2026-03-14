#!/usr/bin/env python3
"""Replace bare except: with except Exception as e: in backend/app.py.

This is conservative and only replaces lines that are exactly a bare except
possibly with whitespace and a trailing comment.
"""
from pathlib import Path
import re

FILE = Path("backend/app.py")


def main():
    lines = FILE.read_text(encoding="utf-8").splitlines(True)
    out = []
    for ln in lines:
        m = re.match(r"^(\s*)except\s*:(\s*(#.*)?)$", ln)
        if m:
            indent = m.group(1)
            comment = " " + m.group(2) if m.group(2) else ""
            out.append(f"{indent}except Exception as e:{comment}\n")
        else:
            out.append(ln)
    FILE.write_text("".join(out), encoding="utf-8")


if __name__ == "__main__":
    main()
