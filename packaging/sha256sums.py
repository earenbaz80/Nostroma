#!/usr/bin/env python3
"""Write the release's SHA256SUMS.txt from the flat upload folder.

    python packaging/sha256sums.py RELEASE

Every regular file directly in the folder is listed as `<sha256>  <name>`, one per line, sorted by name: the format
`sha256sum -c SHA256SUMS.txt` reads, so a download can be checked on any Linux box. `SHA256SUMS.txt` itself is left out
of its own list, and the file is rewritten from scratch each time.

A subfolder is an error: the upload folder is flat (GitHub release assets have no folders), so a file inside one would
be published as a separate asset and would not be covered by the sums.
"""
import argparse
import hashlib
import sys
from pathlib import Path

NAME = "SHA256SUMS.txt"
BLOCK = 1 << 20


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(BLOCK), b""):
            h.update(block)
    return h.hexdigest()


def sums(folder):
    """The lines of the file for `folder`: `<sha256>  <name>` per regular file, sorted by name."""
    folder = Path(folder)
    if not folder.is_dir():
        raise SystemExit("sha256sums: %s is not a folder" % folder)
    names = sorted(p.name for p in folder.iterdir() if p.name != NAME)
    if not names:
        raise SystemExit("sha256sums: %s holds no files" % folder)
    lines = []
    for name in names:
        path = folder / name
        if not path.is_file():
            raise SystemExit("sha256sums: %s is not a regular file; the upload folder is flat" % path)
        lines.append("%s  %s" % (sha256(path), name))
    return lines


def write(folder):
    folder = Path(folder)
    lines = sums(folder)
    out = folder / NAME
    out.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
    return out, len(lines)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("folder", type=Path, help="the flat upload folder")
    a = ap.parse_args(argv)
    out, count = write(a.folder)
    print("%s: %d files" % (out, count))
    return 0


if __name__ == "__main__":
    sys.exit(main())
