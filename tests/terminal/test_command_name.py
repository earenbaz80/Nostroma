"""One command, two names: `nostroma`, and the `strata` it was called before.

The launchers hand over to strata.py, so the program cannot see which link was used; they pass the name they were
called by in NOSTROMA_PROG, the installers put both names on the PATH, and the Windows archive carries both. Nothing
here is a second program: it is the same one, presenting under the name it was typed as.
"""

from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from nostroma_cli import cli  # noqa: E402


def _env(**names: str):
    """The environment with NOSTROMA_PROG set to `names` and nothing else of it, so a stray export cannot answer."""
    clean = {k: v for k, v in os.environ.items() if k != "NOSTROMA_PROG"}
    clean.update(names)
    return mock.patch.dict(os.environ, clean, clear=True)


class TheNameItWasTypedAs(unittest.TestCase):
    def test_the_launcher_says_which_name_it_was(self):
        for name in ("nostroma", "strata"):
            with _env(NOSTROMA_PROG=name):
                self.assertEqual(cli.prog(), name)

    def test_a_name_nobody_knows_is_nostroma(self):
        for argv0 in ("/usr/bin/python3", str(ROOT / "strata.py"), ""):
            with _env(), mock.patch.object(sys, "argv", [argv0]):
                self.assertEqual(cli.prog(), "nostroma", argv0)

    def test_a_launcher_given_directly_still_names_itself(self):
        with _env(), mock.patch.object(sys, "argv", ["/somewhere/bin/strata"]):
            self.assertEqual(cli.prog(), "strata")

    def test_the_usage_line_carries_the_name(self):
        for name in ("nostroma", "strata"):
            with _env(NOSTROMA_PROG=name):
                self.assertTrue(cli.parser().format_usage().startswith(f"usage: {name}"), name)


class TheLaunchers(unittest.TestCase):
    def test_the_posix_launcher(self):
        text = (ROOT / "bin" / "strata").read_text(encoding="utf-8")
        self.assertIn('prog=$(basename -- "$0")', text)
        self.assertIn('export NOSTROMA_PROG', text)
        self.assertNotIn('echo "strata:', text, "a message still names the old name, whatever it was typed as")

    def test_the_windows_launchers(self):
        cmd = (ROOT / "bin" / "strata.cmd").read_text(encoding="utf-8")
        self.assertIn('set "PROG=%~n0"', cmd)
        self.assertIn('set "NOSTROMA_PROG=%PROG%"', cmd)
        self.assertNotIn("echo strata:", cmd)
        ps1 = (ROOT / "bin" / "strata.ps1").read_text(encoding="utf-8")
        self.assertIn("$MyInvocation.MyCommand.Name", ps1)
        self.assertIn("$env:NOSTROMA_PROG = $prog", ps1)
        self.assertNotIn('"strata: ', ps1)


class TheInstallers(unittest.TestCase):
    def test_both_names_go_on_the_path(self):
        sh = (ROOT / "packaging" / "install.sh").read_text(encoding="utf-8")
        self.assertIn('put_on_path "$BIN_DIR/nostroma"', sh)
        self.assertIn('put_on_path "$BIN_DIR/strata"', sh)
        self.assertIn("${NOSTROMA_FEED:-${STRATA_FEED:-", sh)          # the new setting wins, the old one still works
        self.assertIn("the old name, 'strata', still works", sh)
        ps1 = (ROOT / "packaging" / "install.ps1").read_text(encoding="utf-8")
        self.assertIn("@('strata', 'nostroma')", ps1)
        self.assertIn("$env:NOSTROMA_NO_PATH", ps1)
        self.assertIn("$env:NOSTROMA_FEED", ps1)
        self.assertIn(r"bin\nostroma.cmd", ps1)                   # an older archive gets the second name too

    def test_a_name_someone_else_owns_is_not_replaced(self):
        # a plain file called nostroma in the bin folder is its owner's; the install stops instead of overwriting it
        sh = (ROOT / "packaging" / "install.sh").read_text(encoding="utf-8")
        self.assertIn("is not a link this installer made", sh)

    def test_the_windows_archive_carries_both_names(self):
        # a Windows PATH lists files, and the installer puts no link of its own there
        text = (ROOT / "packaging" / "package_terminal.py").read_text(encoding="utf-8")
        self.assertIn('launcher.replace("strata", "nostroma")', text)
