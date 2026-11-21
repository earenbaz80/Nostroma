"""packaging/check_assets.py compares the flat upload folder with docs/data/release.json.

What these tests pin:
  * the manifest names 42 distinct assets, and a folder holding exactly those passes;
  * a missing asset is named and the run fails;
  * a file or a subfolder the manifest does not name is an extra, and the run fails;
  * a manifest without an "assets" list is refused rather than read as "nothing expected".
"""
from __future__ import annotations

import contextlib
import io
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "packaging"))

import check_assets  # noqa: E402


class CheckAssets(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp(prefix="check-assets-"))
        self.addCleanup(shutil.rmtree, self.dir, True)

    def manifest(self, assets):
        path = self.dir / "release.json"
        path.write_text(json.dumps({"assets": assets}), encoding="utf-8")
        return path

    def upload(self, names):
        folder = self.dir / "upload"
        folder.mkdir(exist_ok=True)
        for name in names:
            (folder / name).write_bytes(b"x")
        return folder

    def run_main(self, *argv):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            rc = check_assets.main([str(a) for a in argv])
        return rc, out.getvalue()

    def test_the_release_manifest_names_42_distinct_assets(self):
        assets = check_assets.load_manifest()
        self.assertEqual(len(assets), 42)
        self.assertEqual(len(set(assets)), 42, "the manifest lists a name twice")

    def test_a_folder_holding_exactly_the_manifest_passes(self):
        names = ["Nostroma-0.2.15-macos-arm64.dmg", "SHA256SUMS.txt", "strata-feed.json"]
        folder = self.upload(names)
        self.assertEqual(check_assets.compare(folder, names), ([], []))
        rc, out = self.run_main(folder, "--manifest", self.manifest(names))
        self.assertEqual(rc, 0)
        self.assertIn("3 assets, exactly the manifest", out)

    def test_a_missing_asset_is_named_and_fails(self):
        names = ["a.tar.gz", "b.tar.gz"]
        folder = self.upload(names[:1])
        rc, out = self.run_main(folder, "--manifest", self.manifest(names))
        self.assertEqual(rc, 1)
        self.assertIn("missing: b.tar.gz", out)
        self.assertIn("1 missing, 0 extra", out)

    def test_an_extra_file_or_subfolder_is_named_and_fails(self):
        names = ["a.tar.gz"]
        folder = self.upload(names)
        (folder / "stray.txt").write_bytes(b"x")
        (folder / "nested").mkdir()
        missing, extra = check_assets.compare(folder, names)
        self.assertEqual(missing, [])
        self.assertEqual(extra, ["nested", "stray.txt"])
        rc, out = self.run_main(folder, "--manifest", self.manifest(names))
        self.assertEqual(rc, 1)
        self.assertIn("extra: stray.txt", out)

    def test_a_manifest_without_assets_is_refused(self):
        path = self.dir / "release.json"
        path.write_text(json.dumps({"tag": "v0.2.15"}), encoding="utf-8")
        with self.assertRaises(SystemExit) as cm:
            check_assets.load_manifest(path)
        self.assertIn("assets", str(cm.exception))


if __name__ == "__main__":
    unittest.main()
