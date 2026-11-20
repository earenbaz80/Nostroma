#!/usr/bin/env python3
"""Check that the pages call the product Nostroma, or rewrite the ones that still say Strata.

The word is renamed only where it stands on its own, so the names that are not ours keep their
spelling without being listed one by one: upstream URLs and release downloads, the asset names in
docs/data/release.json and the file names of this checkout (strata.py, the engine binary,
third_party/strata-*, tools/strata_*.py) are all glued to a path, a dot, a colon or a hyphen.

    python tools/docs_rename.py --check    # list the pages that still say Strata (exit 1 if any)
    python tools/docs_rename.py --write    # rewrite them

Historical pages are left alone: history/, bench/ results, data/ notices and docs/release-notes-*
record what was published and measured under the old name.
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

SKIP = ("history/", "bench/", "data/", "docs/release-notes")

# The one name that is the word on its own: the local image tag the root Dockerfile and
# docker/compose use (test_docker_files.py counts it in DOCKER.md).
KEEP = [r"strata:src[a-z0-9-]*"]

# The word glued to the old name by a path, a dot or a hyphen is not renamed, so the few
# user-facing paths that do change with the product name are written out here first.
BEFORE = [
    (r"~/.strata\b", "~/.nostroma"),
    (r"~/.config/strata\b", "~/.config/nostroma"),
    (r"XDG_DATA_HOME/strata/", "XDG_DATA_HOME/nostroma/"),
    (r"\bStrata-data\b", "Nostroma-data"),
    (r"\bDocuments/Strata\b", "Documents/Nostroma"),
    (r"\bnon-Strata\b", "non-Nostroma"),
    (r"brand/strata-(lockup|mark)", r"brand/nostroma-\1"),
    (r'"model": "strata/strata"', '"model": "nostroma/nostroma"'),  # the agent config sample, both halves
    (r"(?<=\S)-strata\b", "-nostroma"),  # anchors, which follow the headings that lost the word
]

WORD = re.compile(r"(?<![\w./~:@-])Strata(?![\w.-])|(?<![\w./~:@-])strata(?![\w.-])")


def renamed(text: str) -> str:
    for pattern, replacement in BEFORE:
        text = re.sub(pattern, replacement, text)
    kept: list[str] = []

    def hold(match: re.Match[str]) -> str:
        kept.append(match.group(0))
        return f"\x00{len(kept) - 1}\x00"

    for pattern in KEEP:
        text = re.sub(pattern, hold, text)
    text = WORD.sub(lambda m: "Nostroma" if m.group(0)[0] == "S" else "nostroma", text)
    return re.sub(r"\x00(\d+)\x00", lambda m: kept[int(m.group(1))], text)


def pages() -> list[Path]:
    out = subprocess.run(["git", "ls-files", "*.md"], cwd=ROOT, capture_output=True, text=True, check=True)
    return [ROOT / name for name in sorted(out.stdout.split()) if not name.startswith(SKIP)]


def main(argv: list[str]) -> int:
    if len(argv) != 2 or argv[1] not in ("--check", "--write"):
        print("usage: tools/docs_rename.py (--check | --write)", file=sys.stderr)
        return 2
    stale = []
    for page in pages():
        text = page.read_text(encoding="utf-8")
        new = renamed(text)
        if new == text:
            continue
        stale.append(page.relative_to(ROOT).as_posix())
        if argv[1] == "--write":
            page.write_text(new, encoding="utf-8")
    if argv[1] == "--write":
        print(f"rewritten: {len(stale)} page(s)")
        return 0
    print("\n".join(stale))
    print(f"pages still saying Strata: {len(stale)}")
    return 1 if stale else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
