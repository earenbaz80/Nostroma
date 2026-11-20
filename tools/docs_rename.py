#!/usr/bin/env python3
"""Rename the product in the docs and READMEs, keeping the upstream names that must not change.

The pages are about Nostroma now, but a few things still carry the old name because they are
not ours to rename: the upstream repository and its release downloads, the published asset file
names in docs/data/release.json, the tool, plugin and directory names of this checkout, and the
engine binary. Those are protected below, and every page is only touched where the word stands
on its own.

    python tools/docs_rename.py --check    # list the pages that still say the old name
    python tools/docs_rename.py --write    # rewrite them

Historical pages (history/, bench/ results, data/ notices, CHANGELOG) are left alone: they
record what was published and measured under the old name.
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Paths that are records of the past, not current documentation.
SKIP_DIRS = ("history/", "bench/", "data/", "docs/release-notes")

# Written into the pages before the word is renamed, so that a user-facing path that changes with
# the product name is not frozen by the "word on its own" rule.
EXPLICIT = [
    (r"~/.strata\b", "~/.nostroma"),
    (r"~/.config/strata\b", "~/.config/nostroma"),
    (r"XDG_DATA_HOME/strata/", "XDG_DATA_HOME/nostroma/"),
    (r"\bStrata-data\b", "Nostroma-data"),
    (r"\bDocuments/Strata\b", "Documents/Nostroma"),
    (r"\bnon-Strata\b", "non-Nostroma"),
    (r"brand/strata-(lockup|mark)", r"brand/nostroma-\1"),
    # Anchors and ids written by hand in the pages, which follow the headings they belong to.
    (r"-strata-connect\b", "-nostroma-connect"),
    (r"-strata-app\b", "-nostroma-app"),
    (r"(?<=\S)-strata\b", "-nostroma"),
    (r"#manage-strata-", "#manage-nostroma-"),
]

# Kept exactly as they are. Each line is a regular expression, and the first match wins, so the
# longer forms come first.
WHITELIST = [
    # Upstream repository, its releases, downloads, badges, issues and the donation page.
    r"https?://[^\s)>\`]*[Ss]trata[^\s)>\`]*",
    r"[A-Za-z0-9_-]+/[Ss]trata\b",
    r"ghcr\.io/niko1221/strata[^\s)>\`]*",
    r"strata:src[a-z0-9-]*",  # the local image tag the root Dockerfile and the compose files use
    # Published release assets: docs/data/release.json is the list, and
    # tools/release_manifest.py --check fails if a page disagrees with it.
    r"Strata-\d[^\s)>\`]*",
    r"Strata\.app[^\s)>\`]*",
    r"Strata-Paper\.pdf",
    r"strata-(?:control|engine|dsv41|q4-lite|feed|windows|ui-handover|orca|gyro|ud)[^\s)>\`]*",
    r"[A-Za-z0-9.-]*\.strata1\.[A-Za-z0-9.-]+",
    # Artifacts and paths of this checkout that still carry the old name.
    r"strata\.py",
    r"strata\.exe",
    r"strata-vision[^\s)>\`]*",
    r"strata-device[^\s)>\`]*",
    r"strata-monitor\.pyz",
    r"third_party/strata-[a-z0-9-]+",
    r"tools/strata_[a-z_]+\.py",
    r"plugins/strata-[a-z-]+\.mjs",
    r"strata-sycl\.sh",
    r"strata_mmq|strata_kq|libstrata[^\s)>\`]*",
    r"strata_(?:bench|status|start|stop|prefix|logs|models|install|commit|benchmark|rejected_tool_calls)\b",
    r"strata-[a-z0-9][a-z0-9.-]*",
    r"[A-Za-z0-9_]+strata[A-Za-z0-9_]*|strata[A-Za-z0-9_]+",  # glued to letters or underscores
]

# The word on its own: not glued to a path separator, a dot, a hyphen, a colon or a tilde.
STANDALONE = re.compile(r"(?<![\w.\-/~:@])Strata(?![\w.-])|(?<![\w.\-/~:@])strata(?![\w.-])")


def pages() -> list[Path]:
    out = subprocess.run(
        ["git", "ls-files", "*.md"], cwd=ROOT, capture_output=True, text=True, check=True
    ).stdout.split("\n")
    keep = []
    for name in out:
        name = name.strip()
        if not name or name.startswith(SKIP_DIRS) or name.startswith("CHANGELOG"):
            continue
        keep.append(ROOT / name)
    return keep


def protect(text: str) -> tuple[str, list[str]]:
    kept: list[str] = []

    def hold(match: re.Match[str]) -> str:
        kept.append(match.group(0))
        return f"\x00{len(kept) - 1}\x00"

    for pattern in WHITELIST:
        text = re.sub(pattern, hold, text)
    return text, kept


def restore(text: str, kept: list[str]) -> str:
    def give(match: re.Match[str]) -> str:
        return kept[int(match.group(1))]

    return re.sub(r"\x00(\d+)\x00", give, text)


def renamed(text: str) -> str:
    for pattern, replacement in EXPLICIT:
        text = re.sub(pattern, replacement, text)
    text, kept = protect(text)
    text = STANDALONE.sub(lambda m: "Nostroma" if m.group(0)[0] == "S" else "nostroma", text)
    return restore(text, kept)


def main(argv: list[str]) -> int:
    if len(argv) != 2 or argv[1] not in ("--check", "--write"):
        print(__doc__.strip().splitlines()[0], file=sys.stderr)
        print("usage: docs_rename.py (--check | --write)", file=sys.stderr)
        return 2
    write = argv[1] == "--write"
    stale = []
    for page in pages():
        text = page.read_text(encoding="utf-8")
        new = renamed(text)
        if new == text:
            continue
        stale.append(page.relative_to(ROOT).as_posix())
        if write:
            page.write_text(new, encoding="utf-8")
    if write:
        print("rewritten: %d page(s)" % len(stale) if stale else "nothing to rewrite")
        return 0
    for name in stale:
        print(name)
    print("pages still saying the old name: %d" % len(stale))
    return 1 if stale else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
