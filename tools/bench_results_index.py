#!/usr/bin/env python3
"""Index page for bench/results/:  bench/results/README.md

    python tools/bench_results_index.py            write the index
    python tools/bench_results_index.py --check    fail when the index is out of date (a new result folder must be listed)

One row per result folder: its date (from the folder name), its own title (the first heading of its README or of its first
Markdown file), and how many files it holds.  The results themselves stay where they are.  Standard library only.
"""
import argparse
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import doc_pages  # noqa: E402

ROOT = doc_pages.ROOT
RESULTS = os.path.join(ROOT, "bench", "results")
OUT = os.path.join(RESULTS, "README.md")


def title_of(folder):
    names = sorted(n for n in os.listdir(folder) if n.lower().endswith(".md"))
    names.sort(key=lambda n: (n.lower() != "readme.md", n))
    for name in names:
        try:
            with open(os.path.join(folder, name), encoding="utf-8", errors="replace") as f:
                for line in f:
                    m = re.match(r"^#{1,3}\s+(.*\S)", line)
                    if m:
                        t = re.sub(r"[`*]", "", m.group(1)).replace("|", "/")
                        return t if len(t) <= 150 else t[:147].rstrip() + "..."
        except OSError:
            pass
    return "(no Markdown page)"


def count_files(folder):
    return sum(len(files) for _, _, files in os.walk(folder))


def tracked():
    """The files git tracks under bench/results, relative to it; None when git is not there (a tarball).

    A run writes its logs beside the results and .gitignore keeps them out of the repository, so walking the folder
    counts files that a clean checkout does not have: the index then differs between the machine that ran the
    benchmark and CI, and --check fails on a page nobody changed. The repository is the list that matters.
    """
    try:
        out = subprocess.run(["git", "-C", ROOT, "ls-files", "-z", "--", "bench/results"],
                             stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, check=True).stdout
    except (OSError, subprocess.SubprocessError):
        return None
    prefix = "bench/results/"
    names = set()
    for raw in out.split(b"\0"):
        if raw:
            path = raw.decode("utf-8", "surrogateescape")
            if path.startswith(prefix):
                names.add(path[len(prefix):])
    return names


def build():
    names = tracked()
    if names is None:                              # no git: fall back to what is on disk
        entries = sorted(e for e in os.listdir(RESULTS) if e != "README.md")
        dirs = {e for e in entries if os.path.isdir(os.path.join(RESULTS, e))}
        loose = [e for e in entries if e not in dirs]
        counts = {f: count_files(os.path.join(RESULTS, f)) for f in dirs}
        total = sum(counts.values()) + len(loose)
    else:
        names.discard("README.md")
        dirs = {n.split("/", 1)[0] for n in names if "/" in n}
        loose = sorted(n for n in names if "/" not in n)
        counts = {f: sum(1 for n in names if n.startswith(f + "/")) for f in dirs}
        total = len(names)
    folders = sorted(dirs)
    lines = ["# Benchmark results", "",
             "Raw results and short reports from measurement runs, one folder per run, named by date. They stay here as they were written: each states",
             "the Nostroma version, hardware and method of its own day, and none is a statement about a later release. Current numbers are in the",
             "[docs](../../docs/README.md) and the [README](../../README.md); how to measure is in [BENCHMARK_PROTOCOL.md](../../docs/BENCHMARK_PROTOCOL.md).",
             "", "This page is built by `python tools/bench_results_index.py` (`--check` fails when a folder is missing from it). "
             "%d folders and %d loose files, %d files in all." % (len(folders), len(loose), total), ""]
    month = None
    for f in folders:
        m = re.match(r"^(\d{4}-\d{2})-(\d{2})", f)
        key = m.group(1) if m else "undated"
        if key != month:
            month = key
            lines += ["", "## " + key, "", "| Folder | What | Files |", "| --- | --- | ---: |"]
        lines.append("| [%s](%s/) | %s | %d |" % (f, f, title_of(os.path.join(RESULTS, f)), counts[f]))
    if loose:
        lines += ["", "## Loose files", "", "| File |", "| --- |"] + ["| [%s](%s) |" % (n, n) for n in loose]
    return "\n".join(lines) + "\n"


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args(argv)
    want = build()
    if args.check:
        have = open(OUT, encoding="utf-8", newline="").read().replace("\r\n", "\n") if os.path.exists(OUT) else ""
        if have != want:
            print("FAIL bench/results/README.md is out of date (run python tools/bench_results_index.py)")
            return 1
        print("bench results index: ok")
        return 0
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(want)
    print("wrote %s" % OUT)
    return 0


if __name__ == "__main__":
    sys.exit(main())
