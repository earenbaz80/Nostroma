"""packaging/check_assets.py compares the flat upload folder with docs/data/release.json.

What these tests pin:
  * a folder holding exactly the manifest's assets passes;
  * a missing asset is named and the run fails;
  * a file or a subfolder the manifest does not name is an extra, and the run fails.
"""
from __future__ import annotations

import contextlib
import io
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
        self.names = check_assets.assets()
        self.upload = self.dir / "upload"
        self.upload.mkdir()
        for name in self.names:
            (self.upload / name).write_bytes(b"x")

    def run_main(self):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            rc = check_assets.main([str(self.upload)])
        return rc, out.getvalue()

    def test_the_release_folder_passes(self):
        rc, out = self.run_main()
        self.assertEqual(rc, 0)
        self.assertIn("%d assets, exactly the manifest" % len(self.names), out)

    def test_a_missing_asset_is_named_and_fails(self):
        (self.upload / self.names[0]).unlink()
        rc, out = self.run_main()
        self.assertEqual(rc, 1)
        self.assertIn("missing: %s" % self.names[0], out)
        self.assertIn("1 missing, 0 extra", out)

    def test_an_extra_file_or_subfolder_is_named_and_fails(self):
        (self.upload / "stray.txt").write_bytes(b"x")
        (self.upload / "nested").mkdir()
        self.assertEqual(check_assets.compare(self.upload, self.names), ([], ["nested", "stray.txt"]))
        rc, out = self.run_main()
        self.assertEqual(rc, 1)
        self.assertIn("extra: stray.txt", out)
        self.assertIn("0 missing, 2 extra", out)


if __name__ == "__main__":
    unittest.main()
