#!/usr/bin/env python3
"""Replace f-strings with no placeholders into plain strings in backend/app.py.

This is conservative: only replaces f/F prefixes when the string contains no
unescaped '{' or '}' characters.
"""
from pathlib import Path
import re

FILE = Path("backend/app.py")


def replace_fstrings(text: str) -> str:
    # patterns for f-strings: f"..." f'...' f"""...""" f'''...'''
    # We'll use regex to find f / F before quotes and ensure no { or } inside.
    def repl(match):
        prefix = match.group(1)
        quote = match.group(2)
        content = match.group(3)
        if "{" in content or "}" in content:
            return match.group(0)
        return prefix.replace("f", "").replace("F", "") + quote + content + quote

    # triple-quoted
    pattern3 = re.compile(r'([fF])("""|\'\'\')(.+?)(\2)', re.DOTALL)
    text = pattern3.sub(lambda m: repl((m.group(1), m.group(2), m.group(3))) if False else (m.group(0)), text)

    # single-line and multi-line single/double quoted
    pattern = re.compile(r'([fF])(["\'])(.*?)(\2)', re.DOTALL)

    def subm(m):
        pref = m.group(1)
        q = m.group(2)
        body = m.group(3)
        if "{" in body or "}" in body:
            return m.group(0)
        return q + body + q

    return pattern.sub(subm, text)


def main():
    txt = FILE.read_text(encoding="utf-8")
    new = replace_fstrings(txt)
    if new != txt:
        FILE.write_text(new, encoding="utf-8")


if __name__ == "__main__":
    main()
