"""0.2.3 RC stress test, #4 (H03): a Terminal that cannot hand over to a newer Control is told so instead of being told "updated"."""

import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import nostroma_cli
from nostroma_cli import handover

ROOT = Path(__file__).resolve().parents[2]


class OldLauncherIsToldTheTruth(unittest.TestCase):
    """The Terminals before 0.2.1.3 have no hand-over. Their updater test-starts the staged Control with `--version`, with
    NOSTROMA_NO_ACQUIRE=1 and without NOSTROMA_HANDOVER: this Control refuses that start in one plain sentence."""

    def staged_tree(self, parent=".s"):
        base = Path(self.enterContext(tempfile.TemporaryDirectory(prefix="nostroma-stage-"))) / parent / "ab12"
        base.mkdir(parents=True)
        shutil.copy2(ROOT / "nostroma.py", base / "nostroma.py")
        for package in ("nostroma_cli", "nostroma_control"):
            shutil.copytree(ROOT / package, base / package, ignore=shutil.ignore_patterns("__pycache__"))
        return base

    def run_version(self, tree, **env):
        base = {k: v for k, v in os.environ.items() if not k.startswith("NOSTROMA_")}
        return subprocess.run([sys.executable, str(tree / "nostroma.py"), "--version"], capture_output=True, text=True, cwd=str(tree),
                              env={**base, "PYTHONNOUSERSITE": "1", **env})

    def test_an_old_updaters_test_start_is_refused_with_one_plain_sentence(self):
        done = self.run_version(self.staged_tree(), NOSTROMA_NO_ACQUIRE="1")
        self.assertEqual(done.returncode, handover.OLD_LAUNCHER_EXIT)
        self.assertEqual(done.stdout.strip(), handover.OLD_LAUNCHER_TEXT)
        self.assertLessEqual(len(handover.OLD_LAUNCHER_TEXT), 120, "the old updater shows only the first 120 characters")
        self.assertNotIn("'", handover.OLD_LAUNCHER_TEXT)

    def test_the_current_updaters_test_start_and_a_normal_start_are_not_touched(self):
        tree = self.staged_tree()
        for env in ({"NOSTROMA_NO_ACQUIRE": "1", "NOSTROMA_HANDOVER": "1"}, {}):
            done = self.run_version(tree, **env)
            self.assertEqual(done.returncode, 0, done.stderr)
            self.assertTrue(done.stdout.startswith("nostroma %s (build " % nostroma_cli.PRODUCT_VERSION), done.stdout)   # (0.2.13.1 after the Control-only hotfix)
        elsewhere = self.staged_tree(parent="terminal")                       # not the updater's staging folder
        self.assertEqual(self.run_version(elsewhere, NOSTROMA_NO_ACQUIRE="1").returncode, 0)

    def test_only_a_bare_version_start_is_refused(self):
        tree = self.staged_tree()
        self.assertIsNone(handover.refuse_old_updater(["status"], {"NOSTROMA_NO_ACQUIRE": "1"}, tree))
        self.assertEqual(handover.refuse_old_updater(["--version"], {"NOSTROMA_NO_ACQUIRE": "1"}, tree), handover.OLD_LAUNCHER_EXIT)


if __name__ == "__main__":
    unittest.main()
