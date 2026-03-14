#!/usr/bin/env python3
import re
from pathlib import Path

p = Path('backend/app.py')
text = p.read_text()
lines = text.splitlines()
seen = set()
out = []
import_re = re.compile(r"^\s*(import\s+.+|from\s+\S+\s+import\s+.+)$")
changed = False
for line in lines:
    m = import_re.match(line)
    if m:
        key = m.group(1).strip()
        # normalize spacing
        key_norm = re.sub(r"\s+", " ", key)
        if key_norm in seen:
            changed = True
            # skip duplicate import
            continue
        seen.add(key_norm)
        out.append(line)
    else:
        out.append(line)

if changed:
    backup = p.with_suffix('.imports.bak')
    p.write_text('\n'.join(out) + '\n')
    print('removed duplicate imports in', p)
else:
    print('no duplicate imports found')
