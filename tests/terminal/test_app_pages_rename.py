"""The Terminal's and the desktop's pages and screens call the product Nostroma: tools/docs_rename.py --check finds nothing.

The same written list that guards the Markdown pages runs over the HTML pages each app serves and over the screens of
both apps, with the ids, events, keys, paths and asset names those areas keep spelled as they are. A screen that starts
saying "Strata" again in prose fails this test, and so does an area that stops finding pages at all (a moved file would
otherwise pass in silence).
"""
from __future__ import annotations

import importlib.util
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TOOL = ROOT / "tools" / "docs_rename.py"

# Each area, and the fewest files it must still find: a path that moves away passes in silence otherwise.
FEWEST = {"terminal": 2, "desktop": 2, "tui": 4, "app": 10, "previews": 18}


def load():
    spec = importlib.util.spec_from_file_location("docs_rename", TOOL)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class AppPagesRename(unittest.TestCase):
    def test_no_app_page_or_screen_still_says_strata(self):
        args = [sys.executable, str(TOOL), "--check"]
        for area in FEWEST:
            args += ["--area", area]
        done = subprocess.run(args, cwd=str(ROOT), capture_output=True, text=True, timeout=180)
        self.assertEqual(done.returncode, 0, done.stdout + done.stderr)
        self.assertIn("pages still saying Strata: 0", done.stdout)
        for area in FEWEST:                       # it looked at every area, not just one
            self.assertIn(f"{area}: 0 page(s)", done.stdout)

    def test_each_area_still_has_pages_to_check(self):
        tool = load()
        for name, fewest in FEWEST.items():
            found = tool.pages(tool.AREAS[name])
            self.assertGreaterEqual(len(found), fewest, f"{name} area found {len(found)} page(s)")

    def test_prose_is_renamed_and_the_apps_own_names_are_kept(self):
        tool = load()
        for area in FEWEST:
            self.assertEqual(tool.renamed("<title>Strata</title>", area), "<title>Nostroma</title>")
        for area in ("terminal", "desktop"):
            self.assertEqual(tool.renamed("Run `strata launch` first.", area), "Run `nostroma launch` first.")
        for kept in ("<html id=\"strata-app\">",
                     "class=\"strata-panel wide\"",
                     "data-strata-tab=\"monitor\"",
                     "https://github.com/Niko1221/Strata/releases/latest/download/install.sh",
                     "Strata-0.2.15-windows-x64-setup.exe",
                     "strata:src"):
            self.assertEqual(tool.renamed(kept, "terminal"), kept)

    def test_the_command_name_in_a_screen_is_not_the_brand(self):
        tool = load()
        screen = ('window.addEventListener("strata:tasks", load);\n'
                  "const draftKey = `strata.chat-draft.${id}`;\n"
                  'model = cfg.get("model") or "strata"\n')
        self.assertEqual(tool.renamed(screen, "app"), screen)
        self.assertEqual(tool.renamed(screen, "tui"), screen)
        self.assertEqual(tool.renamed("The Strata launch screens stopped.", "tui"),
                         "The Nostroma launch screens stopped.")


    def test_a_capture_keeps_the_folders_it_prints(self):
        tool = load()
        for kept in ("C:\\Users\\AI-Server\\Documents\\Strata",
                     "│  D:\\Strata-data\\models",
                     "from eddoursul/Strata 8029fa9"):
            self.assertEqual(tool.renamed(kept, "previews"), kept)
        self.assertEqual(tool.renamed("the Strata preview", "previews"), "the Nostroma preview")


if __name__ == "__main__":
    unittest.main()
