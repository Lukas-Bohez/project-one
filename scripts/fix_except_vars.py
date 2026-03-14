#!/usr/bin/env python3
import re
from pathlib import Path

p = Path('backend/app.py')
text = p.read_text()
lines = text.splitlines()
changed = False
out = []
N = len(lines)
i = 0
while i < N:
    line = lines[i]
    m = re.match(r"(\s*)except\s+Exception\s+as\s+_([A-Za-z0-9_]+)\s*:\s*$", line)
    if m:
        indent, name = m.group(1), m.group(2)
        # replace header
        out.append(f"{indent}except Exception as e:")
        changed = True
        # process next up to 80 lines to replace bare 'name' with 'e'
        j = i + 1
        limit = min(N, j + 80)
        while j < limit:
            nxt = lines[j]
            # stop if block likely ended (line with same or less indent and not continued)
            if re.match(r"^\s*$", nxt):
                out.append(nxt)
                j += 1
                continue
            # compute indent of nxt
            nxt_indent = re.match(r"(\s*)", nxt).group(1)
            if len(nxt_indent) <= len(indent) and not nxt.strip().startswith(('#', 'elif', 'else', 'except', 'finally', 'return')):
                # block likely ended
                break
            # replace bare name occurrences with e
            replaced = re.sub(rf"\b{name}\b", 'e', nxt)
            out.append(replaced)
            changed = changed or (replaced != nxt)
            j += 1
        # move i to j
        i = j
        continue
    else:
        out.append(line)
        i += 1

if changed:
    backup = p.with_suffix('.py.bak')
    p.write_text('\n'.join(out) + '\n')
    print('updated', p)
else:
    print('no changes')

# Second pass: remove unused exception variables (except Exception as NAME -> except Exception:)
text = p.read_text()
lines = text.splitlines()
out = []
N = len(lines)
i = 0
modified2 = False
while i < N:
    line = lines[i]
    m = re.match(r"(\s*)except\s+Exception\s+as\s+([A-Za-z0-9_]+)\s*:\s*$", line)
    if m:
        indent, name = m.group(1), m.group(2)
        # scan block for usage of 'name'
        j = i + 1
        used = False
        while j < N:
            nxt = lines[j]
            # stop if block likely ended
            nxt_indent = re.match(r"(\s*)", nxt).group(1)
            if len(nxt_indent) <= len(indent) and nxt.strip() != '' and not nxt.strip().startswith(('elif', 'else', 'except', 'finally')):
                break
            if re.search(rf"\b{name}\b", nxt):
                used = True
                break
            j += 1

        if not used:
            out.append(f"{indent}except Exception:")
            modified2 = True
            i += 1
            continue
    out.append(line)
    i += 1

if modified2:
    p.write_text('\n'.join(out) + '\n')
    print('removed unused exception vars in', p)
