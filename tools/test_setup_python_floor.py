"""Tests for the Python floor setup.py declares: an interpreter older than 3.10 has to be refused, the refusal has to
come before any module of the project is imported, and 3.10 itself has to pass. The refusal branch cannot run on the
interpreter that executes the suite, so each case fakes `sys.version_info` in a child process.

    python -m unittest tools.test_setup_python_floor
"""
from __future__ import annotations

import subprocess
import sys
import textwrap
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SETUP = ROOT / "setup.py"
MESSAGE = "needs Python 3.10 or newer"


def run_with(version, fake_project=False):
    """Runs setup.py's module body in a child whose `sys.version_info` is `version`. `run_name` stays off "__main__",
    so the body (imports and the guard) runs and the installer never starts.

    With `fake_project`, `nostroma_control` is replaced by a module that fails on any attribute, so a project import
    that happens before the guard shows up as its own error instead of passing unnoticed.
    """
    # CPython's sys.version_info is a named tuple, so the fake has to be one too: the guard compares it with a tuple
    # and the message reads .major and .minor.
    lines = [
        "import collections, runpy, sys, types",
        'VERSION_INFO = collections.namedtuple("version_info", "major minor micro releaselevel serial")',
        f"sys.version_info = VERSION_INFO(*{tuple(version)!r})",
    ]
    if fake_project:
        lines += [
            'fake = types.ModuleType("nostroma_control")',
            "def _refuse(name):",
            '    raise AssertionError("a project module was imported before the floor guard ran: " + name)',
            "fake.__getattr__ = _refuse",
            'sys.modules["nostroma_control"] = fake',
        ]
    # `python setup.py` puts the script's folder on sys.path; `-c` does not on every distribution (an embeddable
    # CPython reads sys.path from its ._pth file), so the child does it explicitly.
    lines.append(f"sys.path.insert(0, {str(ROOT)!r})")
    lines.append(f"runpy.run_path({str(SETUP)!r}, run_name='guard')")
    code = textwrap.dedent("\n".join(lines))
    return subprocess.run([sys.executable, "-c", code], cwd=ROOT,
                          capture_output=True, text=True, timeout=180)


class PythonFloor(unittest.TestCase):
    def test_39_is_refused(self):
        out = run_with((3, 9, 18, "final", 0))
        self.assertNotEqual(out.returncode, 0, "3.9 was not refused")
        self.assertIn(MESSAGE, out.stderr)
        # a clean refusal: SystemExit's message, not a traceback from code that ran too far
        self.assertNotIn("Traceback", out.stderr)

    def test_refusal_comes_before_the_project_imports(self):
        out = run_with((3, 8, 10, "final", 0), fake_project=True)
        self.assertNotEqual(out.returncode, 0)
        self.assertIn(MESSAGE, out.stderr)
        self.assertNotIn("imported before the floor guard", out.stderr)

    def test_310_passes(self):
        out = run_with((3, 10, 0, "final", 0))
        self.assertEqual(out.returncode, 0, out.stderr[-1200:])
        self.assertNotIn(MESSAGE, out.stderr)


if __name__ == "__main__":
    unittest.main()
