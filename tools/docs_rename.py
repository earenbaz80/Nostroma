#!/usr/bin/env python3
"""Check that the pages call the product Nostroma, or rewrite the ones that still say Strata.

The word is renamed only where it stands on its own, so the names that are not ours keep their
spelling without being listed one by one: upstream URLs and release downloads, the asset names in
docs/data/release.json and the file names of this checkout (strata.py, the engine binary,
third_party/strata-*, tools/strata_*.py) are all glued to a path, a dot, a colon or a hyphen.

Six areas, each with the names that are its own to keep (an area's words are prose, so the word
is renamed there; its paths, ids and asset names are protected):

    docs       the Markdown pages
    terminal   the pages the Terminal serves (serve/web/*.html)
    desktop    the desktop app's window and its example pages (apps/host/index.html, public/**/*.html)
    tui        the Terminal's screens (nostroma_cli/launch/app.py, screens.py, monitor.py, monitor_ext.py)
    app        the desktop app's screens (apps/host/src/screens/*.tsx)
    previews   the text captures of the Terminal's screens (docs/terminal-previews/*.txt)

The last two are code: there the word is checked in one case only. "Strata" is the brand and is
renamed; "strata" is the command and the identifiers around it (the event `strata:tasks`, the
draft key `strata.chat-draft.…`, the model name the screen falls back to) and is left alone.

    python tools/docs_rename.py --check                         # every area (exit 1 if any says Strata)
    python tools/docs_rename.py --check --area terminal          # one area
    python tools/docs_rename.py --write --area docs --area tui

A page of usage also fails when it tells someone to type the command by its old name: `strata serve`,
`strata status`, `strata doctor` or any other subcommand. That is its own rule, not the brand's, because a capture
or a sentence can carry the lower-case word where the word rule leaves it alone, and because the fix is a different
one: the command is `nostroma`, whatever the brand on the page says. A path to the launcher is not the command and
is not reported (`bin/strata monitor` in a source checkout names a file that is really called that), and neither is
a log prefix the engine prints (`strata serve: …`).

The version notes are checked for the command and for the command only: their prose still calls the product
Strata because that is what shipped, and that record stands, but a note may not send a reader to `strata serve` or
`strata update` either. history/, bench/ results and data/ notices are left alone entirely.
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

SKIP = ("history/", "bench/", "data/")

# Pages whose brand prose is the record of what shipped, and where only the command's name is checked: the version notes.
COMMAND_ONLY = ("docs/release-notes",)

# The word itself: on its own, not glued to a letter, a path, a dot or a hyphen. Pages are prose, so
# both cases are the product; in screens the lower-case word is the command and stays.
WORD = re.compile(r"(?<![\w./~:@-])Strata(?![\w.-])|(?<![\w./~:@-])strata(?![\w.-])")
BRAND = re.compile(r"(?<![\w./~:@-])Strata(?![\w.-])")

# The command as a person would be told to type it: every subcommand the CLI has, so a page cannot send a reader to
# `strata serve` or `strata update` either. The lookbehind is the same one the word rule uses, so a path
# (`bin/strata monitor`, `~/.local/bin/strata launch`) is a file name and is left alone, and only prose is reported;
# the lookahead holds off a colon, so an engine log line (`strata serve: …`) keeps the name the engine prints.
SUBCOMMANDS = ("serve|profile|repair-access|doctor|components|update|models|drafting|split-engine|engine|install|"
               "runtime|ops|bench|timeskip|tune|presets|launch|connect|status|monitor|logs|connection|config|code")
COMMAND = re.compile(r"(?<![\w./~:@\\-])strata(?=[ \t]+(?:" + SUBCOMMANDS + r")(?![\w:]))")


class Area:
    """One set of pages, and the names in them that are not ours to rename."""

    def __init__(self, paths, skip=(), before=(), keep=(), word=WORD, command=False, command_only=()):
        self.paths = paths            # git pathspecs
        # Prose read by a person following it: the old name of the command is renamed and reported there too.
        self.command = command
        # Path prefixes where only that command rule applies: the brand in them is what shipped.
        self.command_only = command_only
        self.skip = skip              # path prefixes left alone
        # Rewrites that run before the word, for what a plain word rule cannot place (a path that
        # does change with the product name, an anchor that follows a renamed heading).
        self.before = before
        # Patterns held aside: the names that are ours to keep (paths, ids, asset names).
        self.keep = keep
        # What counts as the word here: both cases in prose, only the brand in code.
        self.word = word


DOCS_BEFORE = (
    (r"~/.strata\b", "~/.nostroma"),
    (r"~/.config/strata\b", "~/.config/nostroma"),
    (r"XDG_DATA_HOME/strata/", "XDG_DATA_HOME/nostroma/"),
    (r"\bStrata-data\b", "Nostroma-data"),
    (r"\bDocuments/Strata\b", "Documents/Nostroma"),
    (r"\bnon-Strata\b", "non-Nostroma"),
    (r"brand/strata-(lockup|mark)", r"brand/nostroma-\1"),
    (r'"model": "strata/strata"', '"model": "nostroma/nostroma"'),  # the agent config sample, both halves
    (r"(?<=\S)-strata\b", "-nostroma"),  # anchors, which follow the headings that lost the word
)

# The word glued to the old name by a path, a dot or a hyphen never reaches the word rule, so only
# the few names that must survive spelled as they are need saying here. Pages add their own ids.
KEEP = (
    r"Niko1221/Strata",           # the upstream repository and its downloads
    r"eddoursul/Strata",
    r"Strata-0[\w.]*",            # published asset names (Strata-0.2.15-windows-x64-setup.exe)
    r"Strata\.[A-Za-z]{2,4}\b",   # Strata.AppImage, Strata.dmg
    r"strata:src[\w-]*",          # the local image tag the root Dockerfile and docker/compose use
    r"\bstrata\.py\b",            # the program's file name
    r"\b(?:tools|tests|third_party)/strata[-_][\w.-]*",
)

# The engine binary is also called strata, and it is not this command: serve.server's --engine takes strata|mock, and the
# engine's own flags (--families, --geometry, --serve, --pack, the benchmark ones) belong to it. Prose about the engine keeps
# its spelling, in the value and before those flags.
ENGINE_KEEP = (
    r"(?<=--engine )strata\b",
    r"(?<!\w)strata(?= --(?:families|geometry|serve|pack|native|native-dense-gguf|ple-gguf|mtp|expert-profile|"
    r"expert-cache|prefill|spec|tokens-file|max-new|device|shards|version|help)\b)",
)

AREAS: dict[str, Area] = {
    "docs": Area(paths=("*.md",), skip=SKIP, before=DOCS_BEFORE, keep=KEEP + ENGINE_KEEP, command=True,
                 command_only=COMMAND_ONLY),
    # The Terminal's local dashboard: its copy is prose, its ids and classes are its own.
    "terminal": Area(paths=("serve/web/*.html",),
                     keep=KEEP + (r"\bstrata-[\w-]+\b", r"\bdata-strata[\w-]*")),
    # The desktop app's window and the example pages it can show.
    "desktop": Area(paths=("apps/host/index.html", "apps/host/public/**/*.html"),
                    keep=KEEP + (r"\bstrata-[\w-]+\b", r"\bdata-strata[\w-]*")),
    # The Terminal's screens: the launch steps, the monitor and the connect view, and the harness file whose model
    # names the coding apps list (OpenCode's, Claude Code's, the rest). Its provider is called strata and stays so.
    "tui": Area(paths=("nostroma_cli/launch/app.py", "nostroma_cli/launch/screens.py",
                       "nostroma_cli/launch/monitor_ext.py", "nostroma_cli/monitor.py",
                       "nostroma_cli/launch/harness.py"),
                keep=KEEP + (r"\bstrata[a-z_]*\b", r'"strata"', r"'strata'", r"\bstrata/[\w.{}-]*"), word=BRAND),
    # The desktop app's screens: chat, models, serving, settings and the rest.
    "app": Area(paths=("apps/host/src/screens/*.tsx",),
                keep=KEEP + (r"\bstrata\.[\w.-]+", r"\bstrata:[\w:-]+", r"\bstrata-[\w-]+\b"), word=BRAND),
    # The text captures of the Terminal's screens, written by tests/terminal/launch_previews.py. Their prose is the
    # screen's own, but the folders they print are this product's real ones and keep their spelling.
    "previews": Area(paths=("docs/terminal-previews/*.txt",),
                     keep=KEEP + (r"Documents[\\/]Strata", r"\bStrata-data\b", r"(?<=[\\/])Strata\b",
                                  r"[A-Za-z]:(?:[\\/][^\s│]*)+[\\/]?Strata[^\s│]*"),
                     word=BRAND, command=True),
}


def names_old_command(text: str) -> bool:
    """Whether this page tells someone to type the command by the name it had before."""
    return COMMAND.search(text) is not None


def renamed(text: str, area: str | Area = "docs", word: bool = True) -> str:
    """The page as it should read. `word=False` leaves the brand alone and fixes only the command's name (a version
    note, whose prose is the record of what shipped)."""
    where = AREAS[area] if isinstance(area, str) else area
    if word:
        for pattern, replacement in where.before:
            text = re.sub(pattern, replacement, text)
    if where.command:
        text = COMMAND.sub("nostroma", text)
    if not word:
        return text
    kept: list[str] = []

    def hold(match: re.Match[str]) -> str:
        kept.append(match.group(0))
        return f"\x00{len(kept) - 1}\x00"

    for pattern in where.keep:
        text = re.sub(pattern, hold, text)
    text = where.word.sub(lambda m: "Nostroma" if m.group(0)[0] == "S" else "nostroma", text)
    return re.sub(r"\x00(\d+)\x00", lambda m: kept[int(m.group(1))], text)


def pages(area: Area) -> list[Path]:
    out = subprocess.run(["git", "ls-files", "-z", *area.paths], cwd=ROOT,
                         capture_output=True, text=True, check=True)
    names = sorted(name for name in out.stdout.split("\0") if name)
    return [ROOT / name for name in names if not name.startswith(area.skip)]


def main(argv: list[str]) -> int:
    usage = f"usage: tools/docs_rename.py (--check | --write) [--area {'|'.join(AREAS)}]"
    write = "--write" in argv
    chosen: list[str] = []
    rest = argv[1:]
    while rest:
        arg = rest.pop(0)
        if arg in ("--check", "--write"):
            continue
        if arg in ("--area", "--areas") and rest:
            value = rest.pop(0)
            chosen.extend([value] if arg == "--area" else value.split(","))
            continue
        print(usage, file=sys.stderr)
        return 2
    if write == ("--check" in argv):          # neither, or both
        print(usage, file=sys.stderr)
        return 2
    unknown = [name for name in chosen if name not in AREAS]
    if unknown:
        print(f"tools/docs_rename.py: unknown area(s) {', '.join(unknown)}; known: {', '.join(AREAS)}", file=sys.stderr)
        return 2

    stale: list[str] = []
    commands: list[str] = []
    total = named = 0
    for name in chosen or list(AREAS):
        area = AREAS[name]
        found = naming = 0
        for page in pages(area):
            text = page.read_text(encoding="utf-8")
            relative = page.relative_to(ROOT).as_posix()
            only_command = any(relative.startswith(prefix) for prefix in area.command_only)
            if area.command and names_old_command(text):
                naming += 1
                commands.append(relative)
            new = renamed(text, area, word=not only_command)
            if new == text:
                continue
            found += 1
            stale.append(page.relative_to(ROOT).as_posix())
            if write:
                page.write_text(new, encoding="utf-8")
        if not write:
            note = f", {naming} naming the command as strata" if area.command else ""
            print(f"{name}: {found} page(s) still saying Strata{note}")
        total += found
        named += naming
    if write:
        print(f"rewritten: {total} page(s)")
        return 0
    for page in stale:
        print(f"  {page}")
    print(f"pages still saying Strata: {total}")
    for page in commands:
        print(f"  {page} names the command as strata <subcommand>")
    print(f"pages still naming the command as strata: {named}")
    return 1 if total or named else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
