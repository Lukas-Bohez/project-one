#!/usr/bin/env python3
import re, glob
changed = []
for path in glob.glob("frontend/**/*.html", recursive=True):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            s = f.read()
    except Exception:
        continue
    def repl(m):
        tag = m.group(0)
        if re.search(r"\brel\s*=", tag, flags=re.I):
            return tag
        if tag.endswith('/>'):
            return tag[:-2] + ' rel="noopener noreferrer"/>'
        else:
            return tag[:-1] + ' rel="noopener noreferrer">'
    new = re.sub(r'<a\b[^>]*\btarget\s*=\s*("|\')_blank\1[^>]*>', repl, s, flags=re.I|re.S)
    if new != s:
        with open(path + '.bak', 'w', encoding='utf-8') as b:
            b.write(s)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new)
        changed.append(path)
if changed:
    print('UPDATED_FILES:')
    for p in changed:
        print(p)
else:
    print('NO_UPDATES')
