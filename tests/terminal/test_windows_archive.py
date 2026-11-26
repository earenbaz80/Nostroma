"""The Windows archive carries the Nostroma launchers.

`packaging/package_terminal.py` copies `nostroma.cmd` and `nostroma.ps1` into the archive: a Windows PATH lists files,
so both have to be there for `nostroma` to be found. This builds the archive for real (the layout build, `--skip-deps`,
so nothing is downloaded: a small fake stands in for the pinned interpreter) and looks inside it.
"""

from __future__ import annotations

import contextlib
import io
import subprocess
import sys
import tarfile
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "packaging"))

import package_terminal as pt  # noqa: E402

TARGET = "windows-x86_64"
VERSION = "9.9.9"
STEM = f"nostroma-terminal-{VERSION}-{TARGET}"


def _fake_interpreter(where: Path) -> Path:
    """A tar.gz shaped like the pinned one (the build only asks that the interpreter path exists)."""
    archive = where / "python.tar.gz"
    data = b"not an interpreter: the layout build does not run it\n"
    with tarfile.open(archive, "w:gz") as tf:
        info = tarfile.TarInfo(pt.PYTHON_PINS[TARGET]["python"])
        info.size, info.mode = len(data), 0o755
        info.mtime = 1_700_000_000      # a zip refuses a member stamped before 1980, which a default TarInfo is
        tf.addfile(info, io.BytesIO(data))
    return archive


class WindowsArchive(unittest.TestCase):
    def test_bin_carries_the_launchers(self):
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp)
            out = work / "out"
            argv = ["package_terminal.py", "--out", str(out), "--target", TARGET, "--skip-deps",
                    "--no-installer", "--version", VERSION, "--commit", "ab" * 20]
            silent = contextlib.redirect_stdout(io.StringIO())
            with mock.patch.object(pt, "fetch_python", return_value=_fake_interpreter(work)), \
                    mock.patch.object(pt, "run_probe", return_value=subprocess.CompletedProcess([], 0, "ok", "")), \
                    mock.patch.object(sys, "argv", argv), silent:
                self.assertEqual(pt.main(), 0)
            archive = out / f"{STEM}.zip"
            self.assertTrue(archive.is_file(), sorted(p.name for p in out.iterdir()))

            with zipfile.ZipFile(archive) as zf:
                names = set(zf.namelist())
                launchers = sorted(Path(name).name for name in names
                                   if name.startswith(f"{STEM}/bin/") and name.endswith((".cmd", ".ps1")))
                self.assertEqual(launchers, ["nostroma.cmd", "nostroma.ps1"])


if __name__ == "__main__":
    unittest.main()
