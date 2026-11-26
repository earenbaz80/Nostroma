"""One command: `nostroma`.

The launchers hand over to nostroma.py, so the program cannot see which link was used; they pass the name they were
called by in NOSTROMA_PROG. Nothing here is a second program: it is the same one, presenting under the name it was typed as.
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from nostroma_cli import cli  # noqa: E402


def _install(home: Path, **settings: str) -> subprocess.CompletedProcess:
    """Run install.sh with that HOME and a feed that refuses the connection, so nothing is downloaded: enough to see
    whether the names on the PATH were accepted or refused."""
    return subprocess.run(["sh", str(ROOT / "packaging" / "install.sh")], capture_output=True, text=True, timeout=120,
                          env={**os.environ, "HOME": str(home), "NOSTROMA_FEED": "http://127.0.0.1:1",
                               "XDG_DATA_HOME": "", "NOSTROMA_NO_ACQUIRE": "", **settings})


def _env(**names: str):
    """The environment with NOSTROMA_PROG set to `names` and nothing else of it, so a stray export cannot answer."""
    clean = {k: v for k, v in os.environ.items() if k != "NOSTROMA_PROG"}
    clean.update(names)
    return mock.patch.dict(os.environ, clean, clear=True)


class TheNameItWasTypedAs(unittest.TestCase):
    def test_the_launcher_says_which_name_it_was(self):
        with _env(NOSTROMA_PROG="nostroma"):
            self.assertEqual(cli.prog(), "nostroma")

    def test_a_name_nobody_knows_is_nostroma(self):
        for argv0 in ("/usr/bin/python3", str(ROOT / "nostroma.py"), ""):
            with _env(), mock.patch.object(sys, "argv", [argv0]):
                self.assertEqual(cli.prog(), "nostroma", argv0)

    def test_a_launcher_given_directly_still_names_itself(self):
        with _env(), mock.patch.object(sys, "argv", ["/somewhere/bin/nostroma"]):
            self.assertEqual(cli.prog(), "nostroma")

    def test_the_usage_line_carries_the_name(self):
        with _env(NOSTROMA_PROG="nostroma"):
            self.assertTrue(cli.parser().format_usage().startswith("usage: nostroma"))


class TheLaunchers(unittest.TestCase):
    def test_the_posix_launcher(self):
        text = (ROOT / "bin" / "nostroma").read_text(encoding="utf-8")
        self.assertIn('prog=$(basename -- "$0")', text)
        self.assertIn('export NOSTROMA_PROG', text)
        self.assertNotIn('echo "nostroma:', text, "a message still names the old name, whatever it was typed as")

    def test_the_windows_launchers(self):
        cmd = (ROOT / "bin" / "nostroma.cmd").read_text(encoding="utf-8")
        self.assertIn('set "PROG=%~n0"', cmd)
        self.assertIn('set "NOSTROMA_PROG=%PROG%"', cmd)
        self.assertNotIn("echo nostroma:", cmd)
        ps1 = (ROOT / "bin" / "nostroma.ps1").read_text(encoding="utf-8")
        self.assertIn("$MyInvocation.MyCommand.Name", ps1)
        self.assertIn("$env:NOSTROMA_PROG = $prog", ps1)
        self.assertNotIn('"nostroma: ', ps1)

    def test_no_message_that_cannot_expand_names_the_program(self):
        # a quoted heredoc ('MSG') is literal: a $prog written inside one would print as $prog
        quoted = None
        for number, line in enumerate((ROOT / "bin" / "nostroma").read_text(encoding="utf-8").splitlines(), 1):
            if quoted:
                if line == quoted:
                    quoted = None
                else:
                    self.assertNotIn("$prog", line, f"line {number} sits in a heredoc that does not expand")
            elif (found := re.search(r"<<'([A-Za-z_]+)'", line)):
                quoted = found.group(1)

    def test_a_person_with_no_python_reads_their_own_name(self):
        # the one message that cannot be checked by reading: run the launcher through a link called nostroma
        with tempfile.TemporaryDirectory() as tmp:
            link = Path(tmp) / "nostroma"
            link.symlink_to(ROOT / "bin" / "nostroma")
            r = subprocess.run([str(link)], capture_output=True, text=True,
                               env={**os.environ, "NOSTROMA_PYTHON": str(Path(tmp) / "no-python-here")}, timeout=60)
        self.assertEqual(r.returncode, 5, r.stdout + r.stderr)
        self.assertIn("nostroma: no usable Python found.", r.stderr, r.stderr)
        self.assertNotIn("$prog", r.stderr)


class TheInstallers(unittest.TestCase):
    def test_the_command_goes_on_the_path(self):
        sh = (ROOT / "packaging" / "install.sh").read_text(encoding="utf-8")
        self.assertEqual(sh.count('check_name "$BIN_DIR/nostroma"'), 1)
        self.assertEqual(sh.count('ln -sf "$DATA_DIR/terminal/current/bin/nostroma" "$BIN_DIR/nostroma"'), 1)
        self.assertIn("${NOSTROMA_FEED:-https://github.com/earenbaz80/Nostroma/releases/latest/download}", sh)
        self.assertNotIn("the old name", sh)
        ps1 = (ROOT / "packaging" / "install.ps1").read_text(encoding="utf-8")
        self.assertIn("$env:NOSTROMA_NO_PATH", ps1)
        self.assertIn("$env:NOSTROMA_FEED", ps1)
        self.assertIn(r"bin\nostroma.cmd", ps1)
        self.assertNotIn("@('nostroma', 'nostroma')", ps1)

    def test_a_name_someone_else_owns_is_not_replaced(self):
        # a plain file called nostroma in the bin folder is its owner's; the install stops instead of overwriting it,
        # and it stops before downloading, so nothing of the release is on disk when it says nothing was changed
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            (home / ".local" / "bin").mkdir(parents=True)
            (home / ".local" / "bin" / "nostroma").write_text("someone else's command\n")
            r = subprocess.run(["sh", str(ROOT / "packaging" / "install.sh")], capture_output=True, text=True, timeout=120,
                               env={**os.environ, "HOME": str(home), "NOSTROMA_FEED": "http://127.0.0.1:1",
                                    "XDG_DATA_HOME": "", "NOSTROMA_NO_ACQUIRE": ""})
            self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
            self.assertIn("nostroma already exists and is not a link this installer made", r.stderr, r.stderr)
            self.assertFalse((home / ".local" / "share" / "nostroma").exists(), "the install downloaded before refusing")
            self.assertEqual((home / ".local" / "bin" / "nostroma").read_text(), "someone else's command\n")

    def test_an_old_link_stays_ours_however_the_data_folder_is_spelled_or_moved(self):
        # the install that made the link may have used another spelling of the same folder, or a data folder the user
        # has since left behind: either way the name is the installer's to replace, not someone's file
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            data = home / "share" / "nostroma"
            (data / "terminal" / "9.9.9" / "bin").mkdir(parents=True)
            (data / "terminal" / "9.9.9" / "bin" / "nostroma").write_text("#!/bin/sh\n", encoding="utf-8")
            (data / "terminal" / "current").symlink_to(data / "terminal" / "9.9.9")
            (home / "reached-through-a-link").symlink_to(data)
            old = home / "old-data" / "terminal" / "0.2.14" / "bin"
            old.mkdir(parents=True)
            (old / "nostroma").write_text("#!/bin/sh\n", encoding="utf-8")
            (home / ".local" / "bin").mkdir(parents=True)
            name = home / ".local" / "bin" / "nostroma"
            for spelling in (home / "reached-through-a-link" / "terminal" / "current" / "bin" / "nostroma",
                             old / "nostroma"):
                with self.subTest(spelling=str(spelling)):
                    name.unlink(missing_ok=True)
                    name.symlink_to(spelling)
                    r = _install(home, NOSTROMA_DATA_DIR=str(data))
                    # a refusal would name that path; accepted, the run goes on and stops at the feed
                    self.assertNotIn(".local/bin/nostroma", r.stderr, r.stderr)
        # and a link to anything else is refused, including a terminal of another kind one folder over
        for foreign in ("/usr/bin/python3", "other-app/terminal/tools/bin/nostroma"):
            with tempfile.TemporaryDirectory() as tmp, self.subTest(foreign=foreign):
                home = Path(tmp)
                target = home / foreign if not foreign.startswith("/") else Path(foreign)
                if not foreign.startswith("/"):
                    target.parent.mkdir(parents=True)
                    target.write_text("#!/bin/sh\n", encoding="utf-8")
                name = home / ".local" / "bin" / "nostroma"
                name.parent.mkdir(parents=True)
                name.symlink_to(target)
                r = _install(home)
                self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
                self.assertIn(f".local/bin/nostroma is a link to {target}", r.stderr, r.stderr)

    def test_the_windows_archive_carries_the_launchers(self):
        # a Windows PATH lists files, and the installer puts no link of its own there
        text = (ROOT / "packaging" / "package_terminal.py").read_text(encoding="utf-8")
        self.assertIn('launchers = ["nostroma.cmd", "nostroma.ps1"]', text)
