#!/usr/bin/env python3
"""Compare the flat upload folder with the release manifest's asset list.

    python packaging/check_assets.py <upload folder>

`docs/data/release.json` names every asset the release publishes. This exits 1 when one of them is not in the folder, or
when the folder holds something the manifest does not list, and prints both lists sorted: the upload is exactly the
manifest, or it is not. Nothing is uploaded, downloaded or changed.

A subfolder counts as an extra: GitHub release assets are flat, so a file inside one would be published separately and
would not be in the list.
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "docs" / "data" / "release.json"


def assets():
    """The asset names the release publishes, from its manifest."""
    with open(MANIFEST, encoding="utf-8") as f:
        return json.load(f)["assets"]


def compare(folder, names):
    """(missing, extra): the manifest names not in `folder`, and the folder's entries not in the manifest."""
    present = {p.name for p in Path(folder).iterdir()}
    names = set(names)
    return sorted(names - present), sorted(present - names)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("folder", type=Path, help="the flat upload folder")
    a = ap.parse_args(argv)
    if not a.folder.is_dir():
        print("check_assets: %s is not a folder" % a.folder, file=sys.stderr)
        return 2
    names = assets()
    missing, extra = compare(a.folder, names)
    for name in missing:
        print("missing: %s" % name)
    for name in extra:
        print("extra: %s" % name)
    if missing or extra:
        print("%s: %d missing, %d extra (the manifest names %d assets)" % (a.folder, len(missing), len(extra), len(names)))
        return 1
    print("%s: %d assets, exactly the manifest" % (a.folder, len(names)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
