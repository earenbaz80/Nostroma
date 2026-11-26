"""packaging/sha256sums.py writes the release's SHA256SUMS.txt from the flat upload folder.

What these tests pin:
  * one `<sha256>  <name>` line per regular file, sorted by name, in the format `sha256sum -c` reads;
  * SHA256SUMS.txt is not in its own list, and a second run after a file changed replaces the old line;
  * a subfolder or an empty folder is refused, so a file the release would not cover cannot be skipped quietly;
  * GNU `sha256sum -c` accepts the file.
"""
from __future__ import annotations

import hashlib
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "packaging"))

import sha256sums  # noqa: E402


class Sha256Sums(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp(prefix="sha256sums-"))
        self.addCleanup(shutil.rmtree, self.dir, True)

    def write(self, name, data):
        p = self.dir / name
        p.write_bytes(data)
        return p

    def test_one_sorted_line_per_file_and_none_for_itself(self):
        self.write("b.pack", b"two")
        self.write("a.exe", b"one")
        out, count = sha256sums.write(self.dir)
        self.assertEqual(count, 2)
        self.assertEqual(out, self.dir / "SHA256SUMS.txt")
        want = "%s  a.exe\n%s  b.pack\n" % (hashlib.sha256(b"one").hexdigest(), hashlib.sha256(b"two").hexdigest())
        self.assertEqual(out.read_text(encoding="utf-8"), want)
        self.assertNotIn("SHA256SUMS.txt", want)

    def test_a_second_run_replaces_the_line_of_a_changed_file(self):
        p = self.write("engine.tar.gz", b"old")
        sha256sums.write(self.dir)
        p.write_bytes(b"new")
        out, count = sha256sums.write(self.dir)
        text = out.read_text(encoding="utf-8")
        self.assertEqual(count, 1)
        self.assertEqual(text, "%s  engine.tar.gz\n" % hashlib.sha256(b"new").hexdigest())
        self.assertNotIn(hashlib.sha256(b"old").hexdigest(), text)

    def test_a_subfolder_or_an_empty_folder_is_refused(self):
        (self.dir / "nested").mkdir()
        with self.assertRaises(SystemExit) as cm:
            sha256sums.write(self.dir)
        self.assertIn("flat", str(cm.exception))
        self.assertFalse((self.dir / "SHA256SUMS.txt").exists())
        (self.dir / "nested").rmdir()
        with self.assertRaises(SystemExit) as cm:
            sha256sums.write(self.dir)
        self.assertIn("no files", str(cm.exception))

    @unittest.skipUnless(shutil.which("sha256sum"), "GNU sha256sum is not on this machine")
    def test_sha256sum_check_accepts_the_file(self):
        self.write("Nostroma-0.2.16-linux-x86_64.AppImage", b"app")
        self.write("nostroma-feed.json", b"{}")
        sha256sums.write(self.dir)
        r = subprocess.run(["sha256sum", "-c", "SHA256SUMS.txt"], cwd=self.dir, capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)


if __name__ == "__main__":
    unittest.main()
