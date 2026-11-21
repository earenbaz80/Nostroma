#!/usr/bin/env python3
"""Compare the flat upload folder with the release manifest's asset list.

    python packaging/check_assets.py <upload folder> [--manifest docs/data/release.json]

`docs/data/release.json` names every asset the release publishes (42 for 0.2.15). This exits 1 when one of them is not
in the folder, or when the folder holds something the manifest does not list, and prints both lists sorted: the upload
is exactly the manifest, or it is not. Nothing is uploaded, downloaded or changed.

A subfolder counts as an extra: GitHub release assets are flat, so a file inside one would be published separately and
would not be in the list.
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "docs" / "data" / "release.json"


def load_manifest(path=MANIFEST):
    """The asset names the release publishes, from its manifest."""
    with open(path, encoding="utf-8") as f:
        document = json.load(f)
    assets = document.get("assets")
    if not isinstance(assets, list) or not assets:
        raise SystemExit("check_assets: %s has no \"assets\" list" % path)
    return list(assets)


def compare(folder, assets):
    """(missing, extra): the manifest names not in `folder`, and the folder's entries not in the manifest."""
    folder = Path(folder)
    if not folder.is_dir():
        raise SystemExit("check_assets: %s is not a folder" % folder)
    wanted = set(assets)
    present = {p.name for p in folder.iterdir()}
    return sorted(wanted - present), sorted(present - wanted)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("folder", type=Path, help="the flat upload folder")
    ap.add_argument("--manifest", type=Path, default=MANIFEST, help="the release manifest (default: %(default)s)")
    a = ap.parse_args(argv)
    assets = load_manifest(a.manifest)
    missing, extra = compare(a.folder, assets)
    for name in missing:
        print("missing: %s" % name)
    for name in extra:
        print("extra: %s" % name)
    if missing or extra:
        print("%s: %d missing, %d extra (the manifest names %d assets)" % (a.folder, len(missing), len(extra), len(assets)))
        return 1
    print("%s: %d assets, exactly the manifest" % (a.folder, len(assets)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
