"""Move the engine's runtime settings from NOSTROMA_* to NOSTROMA_*, keeping the old name as the fallback.

Every setting the engine reads at run time was read as ``std::getenv("NOSTROMA_<SETTING>")``. The product is Nostroma, so
the name to write is ``NOSTROMA_<SETTING>``, and ``include/nostroma/env.hpp`` reads the old one when the new one is not
set. This script does the two mechanical steps and nothing else:

  * ``std::getenv("NOSTROMA_X")``  ->  ``nostroma::env("NOSTROMA_X")``
  * adds ``#include "nostroma/env.hpp"`` to a file it changed, when the include is not already there

Compile-time switches (``#ifdef NOSTROMA_METAL``, ``NOSTROMA_USE_HIP``, ...) are left alone: the build defines them, so
they have no runtime fallback.

    python tools/rename_env_names.py --check     # scan only; exit 1 while a read is left to rename
    python tools/rename_env_names.py --dry-run   # print what would change
    python tools/rename_env_names.py             # change the files
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

#: Where the engine's sources live. `include/` is here for the inline readers in headers.
DIRECTORIES = ("src", "include", "metal", "sycl")
#: The extensions the engine compiles. `.metal` is the shading language and cannot include a C++ header, but it has no
#: std::getenv either, so it is only scanned.
SUFFIXES = {".cpp", ".cc", ".cu", ".cuh", ".h", ".hpp", ".mm", ".metal"}

READ_RE = re.compile(r'std::getenv\s*\(\s*"(NOSTROMA_[A-Z0-9_]+)"\s*\)')
#: Two helpers take the setting's name and read it themselves (`src/core/verify.cpp`, `src/program/generate.cpp`). Their
#: bodies go through nostroma::env, so only the name they are handed has to change.
WRAPPED_RE = re.compile(r'((?:env_on|pipe_dbg_env)\s*\(\s*)"(NOSTROMA_[A-Z0-9_]+)"')
INCLUDE_LINE = '#include "nostroma/env.hpp"'
INCLUDE_RE = re.compile(r'^\s*#\s*include\b')


def sources() -> list[Path]:
    out: list[Path] = []
    for directory in DIRECTORIES:
        base = ROOT / directory
        if not base.is_dir():
            continue
        for path in sorted(base.rglob("*")):
            if path.suffix in SUFFIXES and path.is_file():
                out.append(path)
    return out


def rewrite(text: str) -> tuple[str, int]:
    """`text` with every runtime NOSTROMA_ read renamed, and the count of reads that changed."""
    changed = 0

    def one(match: re.Match[str]) -> str:
        nonlocal changed
        changed += 1
        return 'nostroma::env("NOSTROMA_%s")' % match.group(1)[len("NOSTROMA_"):]

    def wrapped(match: re.Match[str]) -> str:
        nonlocal changed
        changed += 1
        return '%s"NOSTROMA_%s"' % (match.group(1), match.group(2)[len("NOSTROMA_"):])

    text = READ_RE.sub(one, text)
    return WRAPPED_RE.sub(wrapped, text), changed


def with_include(text: str) -> str:
    """`text` with the header included, right after the first include line, unless it is already there."""
    if INCLUDE_LINE in text:
        return text
    lines = text.splitlines(keepends=True)
    for index, line in enumerate(lines):
        if INCLUDE_RE.match(line):
            lines.insert(index + 1, INCLUDE_LINE + "\n")
            return "".join(lines)
    return INCLUDE_LINE + "\n" + text


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true", help="report reads still named NOSTROMA_; change nothing")
    parser.add_argument("--dry-run", action="store_true", help="print the files that would change; change nothing")
    args = parser.parse_args(argv)

    if args.check:
        left = []
        for path in sources():
            text = path.read_text(encoding="utf-8", errors="replace")
            count = len(READ_RE.findall(text)) + len(WRAPPED_RE.findall(text))
            if count:
                left.append((path, count))
        if not left:
            print("no runtime NOSTROMA_ read is left")
            return 0
        for path, count in left:
            print("%s: %d" % (path.relative_to(ROOT), count))
        print("%d file(s), %d read(s) still named NOSTROMA_" % (len(left), sum(count for _, count in left)))
        return 1

    files = 0
    reads = 0
    for path in sources():
        original = path.read_text(encoding="utf-8", errors="surrogateescape")
        text, count = rewrite(original)
        if not count:
            continue
        files += 1
        reads += count
        if args.dry_run:
            print("%s: %d" % (path.relative_to(ROOT), count))
            continue
        path.write_text(with_include(text), encoding="utf-8", errors="surrogateescape")

    verb = "would change" if args.dry_run else "changed"
    print("%s %d file(s), %d read(s)" % (verb, files, reads))
    return 0


if __name__ == "__main__":
    sys.exit(main())
