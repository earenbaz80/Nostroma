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
FEWEST = {"terminal": 2, "desktop": 2, "tui": 5, "app": 10, "previews": 18}


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


    def test_the_harness_configs_keep_their_provider_and_lose_the_brand(self):
        tool = load()
        # what OpenCode's config carries: the provider is strata, the name a person reads in its picker is not
        config = "{\"defaultProvider\": \"strata\", \"primary\": f\"strata/{t.model}\", \"name\": \"qwen3.8 (Strata)\"}"
        kept = tool.renamed(config, "tui")
        self.assertIn('"defaultProvider": "strata"', kept)
        self.assertIn('strata/{t.model}', kept)
        self.assertIn("qwen3.8 (Nostroma)", kept, "the name the app lists still says the old brand")

    def test_a_page_of_usage_may_not_name_the_old_command(self):
        tool = load()
        for phrase in ("Run `strata launch` first.",
                       "`strata monitor` shows what is serving.",
                       "`strata connect opencode` writes the setup."):
            self.assertTrue(tool.names_old_command(phrase), phrase)
            # the command that follows the name is kept: only the name changes
            self.assertEqual(tool.renamed(phrase, "docs"), phrase.replace("strata ", "nostroma "))
            self.assertEqual(tool.renamed(phrase, "previews"), phrase.replace("strata ", "nostroma "))
        # in a capture the brand rule leaves the lower-case word alone, so this rename is the command rule's own
        self.assertEqual(tool.renamed("Run strata launch now.", "previews"), "Run nostroma launch now.")
        # a path to the launcher is a file name that is really spelled that way, not the command
        for kept in ("bin/strata monitor --url http://127.0.0.1:8080",
                     "~/.local/bin/strata launch",
                     "engine/strata update"):
            self.assertFalse(tool.names_old_command(kept), kept)
            self.assertEqual(tool.renamed(kept, "docs"), kept)
        # and a plain mention of the folder is not a command
        self.assertFalse(tool.names_old_command("the strata folder holds the models"))

    def test_the_check_reports_the_command_in_every_prose_area(self):
        done = subprocess.run([sys.executable, str(TOOL), "--check", "--area", "docs", "--area", "previews"],
                              cwd=str(ROOT), capture_output=True, text=True, timeout=180)
        self.assertEqual(done.returncode, 0, done.stdout + done.stderr)
        self.assertIn("docs: 0 page(s) still saying Strata, 0 naming the command as strata", done.stdout)
        self.assertIn("previews: 0 page(s) still saying Strata, 0 naming the command as strata", done.stdout)
        self.assertIn("pages still naming the command as strata: 0", done.stdout)

    def test_a_version_note_is_checked_for_the_command_and_only_for_it(self):
        tool = load()
        note = ROOT / "docs" / "release-notes-0.2.0.md"
        text = note.read_text(encoding="utf-8")
        self.assertIn(note, tool.pages(tool.AREAS["docs"]), "a note is looked at")
        self.assertFalse(tool.names_old_command(text), "a note may not send a reader to the old command")
        self.assertIn("Strata", text, "while its brand prose is the record of what shipped")
        self.assertEqual(tool.renamed(text, "docs", word=False), text, "nothing left for the command rule to fix")
        self.assertNotEqual(tool.renamed(text, "docs"), text, "the brand rule would rewrite it")

    def test_a_capture_keeps_the_folders_it_prints(self):
        tool = load()
        for kept in ("C:\\Users\\AI-Server\\Documents\\Strata",
                     "│  D:\\Strata-data\\models",
                     "from eddoursul/Strata 8029fa9"):
            self.assertEqual(tool.renamed(kept, "previews"), kept)
        self.assertEqual(tool.renamed("the Strata preview", "previews"), "the Nostroma preview")


if __name__ == "__main__":
    unittest.main()
