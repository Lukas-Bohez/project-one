#!/usr/bin/env python3
"""Safely normalize exception handler variable names in backend/app.py.

Rules applied:
- If an except declares `as _name` and `_name` is never used in the except block, remove the `as _name` (use bare except).
- If an except has no name but the block references `e`, add `as e` to the except.
- If an except uses a private name (starts with `_`) but the block references `e`, change to `as e`.

This operates only on module text and uses indentation to determine block scope.
"""
from pathlib import Path
import re


FILE = Path("backend/app.py")


def collect_block(lines, start_idx):
    # lines: list of strings
    header = lines[start_idx]
    m = re.match(r"^(\s*)except\b.*:\s*$", header)
    if not m:
        return [], start_idx
    indent = len(m.group(1))
    block = []
    i = start_idx + 1
    while i < len(lines):
        ln = lines[i]
        if ln.strip() == "":
            block.append(ln)
            i += 1
            continue
        cur_indent = len(ln) - len(ln.lstrip(" "))
        if cur_indent <= indent:
            break
        block.append(ln)
        i += 1
    return block, i


def name_used_in_block(name, block_lines):
    if not name:
        return False
    pattern = r"\b" + re.escape(name) + r"\b"
    for ln in block_lines:
        if re.search(pattern, ln):
            return True
    return False


def process(lines):
    out = []
    i = 0
    while i < len(lines):
        ln = lines[i]
        m = re.match(r"^(\s*)except\s+Exception(?:\s+as\s+([A-Za-z_][A-Za-z0-9_]*))?\s*:\s*$", ln)
        if not m:
            out.append(ln)
            i += 1
            continue

        indent = m.group(1)
        name = m.group(2)
        block, next_i = collect_block(lines, i)

        # Decide action
        if name:
            if name.startswith("_"):
                # If 'e' is used in block, prefer 'e'
                if name_used_in_block("e", block):
                    new_header = f"{indent}except Exception as e:\n"
                elif not name_used_in_block(name, block):
                    # unused private name: remove it
                    new_header = f"{indent}except Exception:\n"
                else:
                    new_header = ln
            else:
                new_header = ln
        else:
            # no name; if 'e' used, add as e
            if name_used_in_block("e", block):
                new_header = f"{indent}except Exception as e:\n"
            else:
                new_header = ln

        out.append(new_header)
        out.extend(block)
        i = next_i

    return out


def main():
    text = FILE.read_text(encoding="utf-8")
    lines = text.splitlines(True)
    new_lines = process(lines)
    FILE.write_text("".join(new_lines), encoding="utf-8")


if __name__ == "__main__":
    main()
