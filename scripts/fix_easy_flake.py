#!/usr/bin/env python3
import re
from pathlib import Path

report = Path('flake_report_backend.txt')
if not report.exists():
    print('No flake report found at flake_report_backend.txt')
    raise SystemExit(1)

entries = []
for line in report.read_text().splitlines():
    m = re.match(r"\./?(?P<file>[^:]+):(?P<line>\d+):(?P<col>\d+):\s+(?P<code>\w+)\s+(?P<msg>.*)", line)
    if m:
        entries.append(m.groupdict())

changes = {}
for e in entries:
    code = e['code']
    path = e['file']
    ln = int(e['line']) - 1
    msg = e['msg']
    p = Path(path)
    if not p.exists():
        continue
    lines = p.read_text().splitlines()
    if ln < 0 or ln >= len(lines):
        continue
    orig = lines[ln]
    new = orig
    if code == 'E722':
        # replace bare except with except Exception as e
        # handle 'except:' and 'except:  # comment' and 'except :'
        new = re.sub(r"^\s*except\s*:\s*(#.*)?$", lambda m: m.group(0).replace('except:', 'except Exception as e:'), orig)
        # generic replace 'except:' anywhere
        if new == orig:
            new = orig.replace('except:', 'except Exception as e:')
    elif code == 'F541':
        # remove leading f/F from string literals that don't contain '{'
        def fix_fstring(m):
            s = m.group(0)
            quote = s[1]
            content = s[2:-1]
            if '{' in content:
                return s
            return quote + content + quote
        # handle f"..." and f'...'
        new = re.sub(r"\bf([\'\"])(.*?)[\'\"]", lambda m: fix_fstring(m), orig)
    elif code == 'F841':
        # extract var name from message like "local variable 'client_ip' is assigned to but never used"
        mvar = re.search(r"local variable '(?P<var>[^']+)' is assigned", msg)
        if mvar:
            var = mvar.group('var')
            # only change left-hand side before '=' on this line
            if '=' in orig:
                lhs, rhs = orig.split('=', 1)
                # replace var name occurrences on lhs with _var
                pattern = r"\b" + re.escape(var) + r"\b"
                new_lhs = re.sub(pattern, '_' + var, lhs, count=1)
                new = new_lhs + '=' + rhs
    if new != orig:
        lines[ln] = new
        changes.setdefault(path, lines)

# apply changes
for path, new_lines in changes.items():
    Path(path).write_text('\n'.join(new_lines) + '\n')
    print(f'Patched {path} ({len(new_lines)} lines)')

print('Done applying easy fixes.')
