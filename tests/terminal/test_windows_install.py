"""The Windows installer, run for real: it installs both names and each one says its own.

It needs Windows, so it skips everywhere else; `.github/workflows/windows-install.yml` runs it on
windows-latest on every change to the installer, the launchers or the Terminal. Everything else here is like the POSIX
test in test_launch_install.py: a terminal archive built from this checkout, a test-signed feed served over loopback,
and the installer from that feed. The bundled interpreter is replaced by NOSTROMA_PYTHON, so nothing is downloaded and no
package has to be installed: the launcher, `nostroma.py` and the CLI run on the standard library alone.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
import threading
import unittest
import zipfile
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "packaging"))

import make_local_feed as mlf  # noqa: E402

VERSION = "9.9.9"
STEM = f"nostroma-terminal-{VERSION}-windows-x86_64"


def _terminal_zip(where: Path) -> Path:
    """A windows-x86_64 terminal archive: this checkout, the two Windows launchers, and a stand-in for the bundled
    interpreter (its presence is what makes the feed call the package windows-x86_64; NOSTROMA_PYTHON replaces it)."""
    top = where / STEM
    top.mkdir(parents=True)
    for name in ("nostroma.py", "nostroma_cli", "nostroma_control", "serve"):
        src = ROOT / name
        if src.is_dir():
            shutil.copytree(src, top / name, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
        else:
            shutil.copy2(src, top / name)
    (top / "bin").mkdir()
    for launcher in ("nostroma.cmd", "nostroma.ps1"):
        shutil.copy2(ROOT / "bin" / launcher, top / "bin" / launcher)
    (top / "python").mkdir()
    (top / "python" / "python.exe").write_bytes(b"the bundled interpreter is replaced by NOSTROMA_PYTHON here\n")
    (top / "VERSION").write_text(VERSION + "\n", encoding="utf-8")
    archive = where / f"{STEM}.zip"
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in sorted(top.rglob("*")):
            if path.is_file():
                zf.write(path, f"{top.name}/{path.relative_to(top).as_posix()}")
    return archive


def _powershell(script: str, env: dict[str, str] | None = None) -> subprocess.CompletedProcess:
    return subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
                          capture_output=True, text=True, env=env, timeout=180)


def _user_path() -> str:
    done = _powershell("[Environment]::GetEnvironmentVariable('Path','User')")
    return done.stdout.strip()


def _set_user_path(value: str) -> None:
    """Put the PATH back as it was; through a file, because the value can hold a quote."""
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as handle:
        handle.write(value)
        name = handle.name
    try:
        _powershell("[Environment]::SetEnvironmentVariable('Path', (Get-Content -Raw -LiteralPath "
                    f"'{name}').Trim(), 'User')")
    finally:
        Path(name).unlink(missing_ok=True)


@unittest.skipUnless(sys.platform == "win32", "runs install.ps1, which needs Windows")
class WindowsInstaller(unittest.TestCase):
    def test_both_names_are_on_the_path_and_say_their_own_name(self):
        with tempfile.TemporaryDirectory(prefix="nostroma-install-") as tmp:
            work = Path(tmp)
            archive = _terminal_zip(work)
            feed = work / "feed"
            handler = partial(SimpleHTTPRequestHandler, directory=str(work))
            handler.log_message = lambda *a, **k: None                    # type: ignore[attr-defined]
            server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
            threading.Thread(target=server.serve_forever, daemon=True).start()
            url = f"http://127.0.0.1:{server.server_address[1]}/feed"
            before = _user_path()
            try:
                self.assertEqual(mlf.main(["--out", str(feed), "--terminal", str(archive),
                                           "--keys", str(work / "keys"), "--url", url]), 0)
                self.assertIn("windows-x86_64", (feed / "install-manifest.txt").read_text(encoding="utf-8"))
                data = work / "data"
                env = {**os.environ, "NOSTROMA_FEED": url, "NOSTROMA_DATA_DIR": str(data),
                       "NOSTROMA_INSTALL_TEST_TRUST": "1", "NOSTROMA_PYTHON": sys.executable,
                       "PATH": os.environ["PATH"]}
                for stale in ("NOSTROMA_FEED", "NOSTROMA_DATA_DIR", "NOSTROMA_NO_PATH", "NOSTROMA_NO_PATH",
                              "NOSTROMA_UPDATE_TRUSTED_KEYS", "PYTHONPATH"):
                    env.pop(stale, None)
                done = subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass",
                                       "-File", str(feed / "install.ps1")],
                                      capture_output=True, text=True, env=env, timeout=600)
                self.assertEqual(done.returncode, 0, done.stdout + done.stderr)
                self.assertIn("Installed. Run: nostroma launch", done.stdout)
                self.assertIn("the old name, 'nostroma', still works", done.stdout)

                # both names, in the folder the installer put on the PATH, byte for byte the same launcher
                bin_dir = data / "terminal" / "current" / "bin"
                nostroma, nostroma = bin_dir / "nostroma.cmd", bin_dir / "nostroma.cmd"
                for name, path in (("nostroma", nostroma), ("nostroma", nostroma)):
                    self.assertTrue(path.is_file(), f"{name}.cmd is missing from {bin_dir}")
                self.assertEqual(nostroma.read_bytes(), nostroma.read_bytes())
                self.assertIn(str(bin_dir).lower(), _user_path().lower(), "the installer did not put bin on the PATH")

                # and each one, typed by its own name, says that name in its usage line
                for name in ("nostroma", "nostroma"):
                    ran = subprocess.run(["cmd", "/c", f'"{bin_dir / f"{name}.cmd"}" --help'],
                                         capture_output=True, text=True, env=env, timeout=180)
                    self.assertEqual(ran.returncode, 0, ran.stdout + ran.stderr)
                    self.assertIn(f"usage: {name}", ran.stdout, name)
            finally:
                _set_user_path(before)                                     # leave this PC's PATH as it was
                server.shutdown()


if __name__ == "__main__":
    unittest.main()
