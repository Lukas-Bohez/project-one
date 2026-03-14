#!/usr/bin/env python3
from pathlib import Path
import re

p = Path('backend/app.py')
text = p.read_text()
pattern = re.compile(r"except\s+Exception\s+as\s+([A-Za-z_][A-Za-z0-9_]*)\s*:")

repl_count = 0

def repl(m):
    global repl_count
    var = m.group(1)
    if var.startswith('_'):
        return m.group(0)
    repl_count += 1
    return f"except Exception as _{var}:"

new = pattern.sub(repl, text)
if repl_count > 0:
    p.write_text(new)
print(f"Replaced {repl_count} occurrences in {p}")
