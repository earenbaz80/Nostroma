"""The release manifest (docs/data/release.json) and the pages that quote it."""
import copy
import os
import re
import sys
import unittest
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import release_manifest as rm  # noqa: E402


TABLE = "## The assets"
ROW_PART = re.compile(r"(\[-<[^>]+>\]|<[^>]+>|\.tar\.gz\Z)")


def table_rows(text):
    """The first cell of each row in the checklist's asset table (``## The assets``)."""
    _, _, section = text.partition(TABLE)
    if not section:
        raise AssertionError("docs/RELEASE_CHECKLIST.md has no %r heading" % TABLE)
    return [line.split("|")[1].strip() for line in section.split("\n#", 1)[0].splitlines() if line.startswith("| `")]


def row_names(cell):
    """The asset names a table row stands for: a token starting with ``.`` (``.sig``) continues the name before it."""
    names = []
    for token in re.findall(r"`([^`]+)`", cell):
        names.append(names[-1] + token if token.startswith(".") else token)
    return names


def name_regex(name):
    """An asset name as a regex: ``<...>`` is one segment, ``[-<...>]`` an optional one, and a ``.tar.gz`` name also
    matches ``.zip`` (the Windows Control package is a zip)."""
    pattern = ""
    for part in ROW_PART.split(name):
        if part.startswith("[-<"):
            pattern += r"(?:-[^/]+)?"
        elif part.startswith("<"):
            pattern += r"[^/]+"
        elif part == ".tar.gz":
            pattern += r"\.(?:tar\.gz|zip)"
        elif part:
            pattern += re.escape(part)
    return re.compile(pattern)


def table_problems(rows, assets):
    """What the table and the manifest disagree on: assets with no name, and names the manifest does not have."""
    patterns = [(name, name_regex(name)) for row in rows for name in row_names(row)]
    missing = sorted(a for a in assets if not any(p.fullmatch(a) for _, p in patterns))
    extra = [name for name, p in patterns if not any(p.fullmatch(a) for a in assets)]
    return missing, extra


class ReleaseDocs(unittest.TestCase):
    """The checklist's asset table and the notes describe the manifest's assets; latest.json is not one of them."""

    def setUp(self):
        self.manifest = rm.load()
        self.checklist = Path(rm.ROOT, "docs", "RELEASE_CHECKLIST.md").read_text(encoding="utf-8")
        self.notes = Path(rm.ROOT, "docs", "release-notes-0.2.15.md").read_text(encoding="utf-8")

    def test_the_asset_table_lists_exactly_the_manifest(self):
        missing, extra = table_problems(table_rows(self.checklist), self.manifest["assets"])
        self.assertEqual(missing, [], "the checklist's asset table does not list: " + ", ".join(missing))
        self.assertEqual(extra, [], "the checklist's asset table lists what the manifest does not: " + ", ".join(extra))

    def test_latest_json_is_not_an_asset(self):
        self.assertNotIn("latest.json", self.manifest["assets"])
        self.assertFalse([row for row in table_rows(self.checklist) if "latest.json" in row],
                         "the checklist's asset table lists latest.json again")
        downloads = self.notes.split("## Downloads", 1)[1]
        for paragraph in downloads.split("\n\n"):
            if "latest.json" in paragraph:
                self.assertRegex(paragraph, "does not publish|not published|not an asset",
                                 "the notes list latest.json among the downloads")


class ReleaseManifest(unittest.TestCase):
    def test_current_pages_agree_with_the_manifest(self):
        problems = rm.check(rm.load())
        self.assertEqual(problems, [], "\n".join(problems))

    def test_old_installer_names_are_found_and_rewritten(self):
        m = rm.load()
        old = "run `Nostroma-0.2.9-windows-x64-setup.exe` or Nostroma-0.2.9-linux-x86_64.AppImage.sig"
        self.assertEqual(len(rm.INSTALLER_RE.findall(old)), 2)
        fixed = rm.INSTALLER_RE.sub(lambda x: x.group(0).replace(x.group(1), m["product_version"], 1), old)
        self.assertNotIn("0.2.9", fixed)
        self.assertIn("Nostroma-%s-linux-x86_64.AppImage.sig" % m["product_version"], fixed)

    def test_version_lines_are_rewritten_and_a_second_pass_changes_nothing(self):
        m = rm.load()
        page, regex, keys = [r for r in rm.LINES if r[0] == "AGENTS.md"][0]
        text = "Version 0.2.5, engine 0.1.50. The public model families"
        once = rm.rewrite(text, regex, keys, m)
        self.assertEqual(once, "Version %s, engine %s. The public model families" % (m["product_version"], m["engine_version"]))
        self.assertEqual(rm.rewrite(once, regex, keys, m), once)

    def test_a_drifting_manifest_is_reported(self):
        m = copy.deepcopy(rm.load())
        m["product_version"] = "0.2.99"
        m["tag"] = "v0.2.99"
        m.pop("terminal_version", None)                             # the Terminal then has to say the product version
        problems = "\n".join(rm.check(m))
        self.assertIn("nostroma_cli/__init__.py says", problems)
        self.assertIn("asset list has no Nostroma-0.2.99-windows-x64-setup.exe", problems)

    def test_a_control_only_hotfix_is_allowed_and_a_drifting_control_is_not(self):
        """0.2.13.1: the Terminal and Control are one hotfix part ahead of the app and the engines; nothing else may differ.
        Written so it holds for a release with a hotfix part (0.2.13.1) and without one (0.2.14)."""
        m = rm.load()
        self.assertEqual(rm.check(m), [])
        wrong = copy.deepcopy(m)
        wrong["control_version"] = m["engine_version"] + ".9"       # the manifest names a Control hotfix the source does not have
        problems = "\n".join(rm.check(wrong))
        self.assertIn("CMakeLists.txt (Control) says", problems)
        wrong = copy.deepcopy(m)
        wrong["engine_version"] = "0.1.58"                          # engines two builds behind Control: not a hotfix
        self.assertIn("CMakeLists.txt (engine) says", "\n".join(rm.check(wrong)))
        wrong = copy.deepcopy(m)
        wrong["terminal_version"] = m["product_version"] + ".9"     # the manifest names a Terminal the source does not say
        terminal = rm.code_versions()["nostroma_cli/__init__.py"][0]
        self.assertIn("nostroma_cli/__init__.py says %s" % terminal, "\n".join(rm.check(wrong)))

    def test_a_release_that_carries_its_engines_names_where_they_come_from(self):
        """0.2.15: Control 0.1.61 and the 0.1.60 engines of v0.2.14 (no engine built). Without "engines_from" Control may not be ahead of
        the engines; with it, the engines at engine_version must be packages the release offers."""
        m = copy.deepcopy(rm.load())
        m["engines_from"] = "v0.2.14"
        m["control_version"], m["engine_version"] = "0.1.61", "0.1.60"
        cmake = {"CMakeLists.txt (engine)": ("0.1.61", "engine_version"), "CMakeLists.txt (Control)": ("0.1.61", "control_version")}
        real = rm.code_versions
        try:
            rm.code_versions = lambda: {**real(), **cmake}
            self.assertNotIn("CMakeLists.txt (engine) says", "\n".join(rm.check(m)))
            no_from = copy.deepcopy(m)
            no_from.pop("engines_from")
            self.assertIn("CMakeLists.txt (engine) says", "\n".join(rm.check(no_from)))
            gone = copy.deepcopy(m)
            gone["engine_version"] = "0.1.58"                       # no 0.1.58 engine package in the asset list
            self.assertIn("CMakeLists.txt (engine) says", "\n".join(rm.check(gone)))
        finally:
            rm.code_versions = real

    def test_installer_names_in_the_manifest_asset_list(self):
        m = rm.load()
        for name in rm.expand(m):
            self.assertIn(name, m["assets"])


if __name__ == "__main__":
    unittest.main()
