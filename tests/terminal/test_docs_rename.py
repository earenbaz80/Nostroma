"""The pages call the product Nostroma: tools/docs_rename.py --check must have nothing to report.

The tool is also the written list of names that are not ours to rename (the upstream repository and its downloads,
the published asset names, the file names of this checkout), so it runs here instead of waiting for someone to remember
it. A page that starts saying "Strata" again fails this test.
"""
from __future__ import annotations

import argparse
import importlib.util
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TOOL = ROOT / "tools" / "docs_rename.py"


def load():
    spec = importlib.util.spec_from_file_location("docs_rename", TOOL)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class DocsRename(unittest.TestCase):
    def test_no_current_page_still_says_strata(self):
        done = subprocess.run([sys.executable, str(TOOL), "--check"], cwd=str(ROOT),
                              capture_output=True, text=True, timeout=180)
        self.assertEqual(done.returncode, 0, done.stdout + done.stderr)
        self.assertIn("pages still saying Strata: 0", done.stdout)     # it looked, and found nothing to rewrite

    def test_the_word_is_renamed_and_the_names_that_are_not_ours_are_kept(self):
        tool = load()
        self.assertEqual(tool.renamed("Start Strata and run `strata launch`."), "Start Nostroma and run `nostroma launch`.")
        for kept in ("https://github.com/earenbaz80/Nostroma/releases/latest/download/install.sh",
                     "Strata-0.2.15-windows-x64-setup.exe",
                     "third_party/strata-ggml",
                     "tools/strata_bench.py",
                     "docker build -t strata:src ."):
            self.assertEqual(tool.renamed(kept), kept)

    def test_the_engine_binary_keeps_its_name_and_its_own_flags(self):
        """The engine is also called strata: serve.server's --engine takes strata|mock, and a flag after the word is the binary's."""
        tool = load()
        for kept in ("serve/server.py --engine strata --config strata-orca.json --port 8080",
                     "`strata --pack <pack dir> --native <model>.gguf`",
                     "`strata --batch 8`"):          # not in any list: the rule reads the shape, not the flags
            self.assertEqual(tool.renamed(kept), kept)

    def test_the_command_rule_knows_every_subcommand_the_cli_has(self):
        """One list, checked: a subcommand added to the CLI and not to the tool would let a page say `strata <it>`."""
        from nostroma_cli import cli

        tool = load()
        subs = next(action for action in cli.parser()._actions if isinstance(action, argparse._SubParsersAction))
        self.assertEqual(set(tool.SUBCOMMANDS.split("|")), set(subs.choices))


    def test_the_snapshot_drivers_and_goldens_are_checked_for_the_old_command(self):
        """tests/snapshot writes the command into its drivers and its golden files: an old `strata launch` or
        `strata setup` there fails here, while a path or an engine log prefix is still not the command."""
        tool = load()
        files = {p.relative_to(ROOT).as_posix(): p for p in tool.pages(tool.AREAS["snapshot"])}
        self.assertIn("tests/snapshot/driver.py", files)
        self.assertIn("tests/snapshot/setup_driver.py", files)
        self.assertTrue(any(name.startswith("tests/snapshot/golden/") and name.endswith(".json") for name in files),
                        "the golden files are covered too")
        for name, path in files.items():
            self.assertFalse(tool.names_old_command(path.read_text(encoding="utf-8")), name)
        self.assertTrue(tool.names_old_command('"command": "strata launch --model IQ3_S --yes --no-tui"'))
        self.assertTrue(tool.names_old_command('command = f"strata setup --family qwen --yes"'))
        self.assertFalse(tool.names_old_command('"strata serve: prefill: copy stream"'))      # an engine log prefix
        self.assertFalse(tool.names_old_command("tests/snapshot/bin/strata monitor"))          # a path to the launcher


if __name__ == "__main__":
    unittest.main()
