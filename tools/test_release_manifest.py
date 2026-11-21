"""The release manifest (docs/data/release.json) and the pages that quote it."""
import copy
import os
import re
import sys
import unittest
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import release_manifest as rm  # noqa: E402


ASSET_TABLE = "## The assets"
ARCHIVE = re.compile(r"\.(?:tar\.gz|zip)\Z")


def asset_rows(text):
    """The first cell of each row in the checklist's asset table (``## The assets``)."""
    lines = text.splitlines()
    start = next((i for i, line in enumerate(lines) if line.strip() == ASSET_TABLE), None)
    if start is None:
        raise AssertionError("docs/RELEASE_CHECKLIST.md has no %r heading" % ASSET_TABLE)
    rows = []
    for line in lines[start + 1:]:
        if line.startswith("#"):
            break
        if line.startswith("| `"):
            rows.append(line.split("|")[1].strip())
    return rows


def asset_patterns(text):
    """The file names a table row stands for: ``<...>`` is one segment, ``.sig`` repeats the name before it."""
    patterns = []
    for cell in asset_rows(text):
        for token in re.findall(r"`([^`]+)`", cell):
            patterns.append(patterns[-1] + token if token.startswith(".") else token)
    return patterns


def name_regex(pattern):
    parts = re.split(r"(\[-<[^>]+>\]|<[^>]+>)", pattern)
    out = []
    for part in parts:
        if part.startswith("[-<"):
            out.append(r"(?:-[^/]+)?")
        elif part.startswith("<"):
            out.append(r"[^/]+")
        else:
            out.append(re.escape(part))
    return re.compile("".join(out) + r"\Z")


def matches(pattern, asset):
    """A row matches a name; the control archive is ``.zip`` on Windows and ``.tar.gz`` elsewhere."""
    if name_regex(pattern).match(asset):
        return True
    if ARCHIVE.search(pattern) and ARCHIVE.search(asset):
        return name_regex(ARCHIVE.sub("", pattern)).match(ARCHIVE.sub("", asset)) is not None
    return False


def table_problems(patterns, assets):
    missing = sorted(a for a in assets if not any(matches(p, a) for p in patterns))
    extra = [p for p in patterns if not any(matches(p, a) for a in assets)]
    return missing, extra


class ReleaseDocs(unittest.TestCase):
    """The checklist's asset table and the notes describe the manifest's assets; latest.json is not one of them."""

    def setUp(self):
        self.manifest = rm.load()
        self.checklist = Path(rm.ROOT, "docs", "RELEASE_CHECKLIST.md").read_text(encoding="utf-8")
        self.notes = Path(rm.ROOT, "docs", "release-notes-0.2.15.md").read_text(encoding="utf-8")

    def test_the_asset_table_lists_exactly_the_manifest(self):
        missing, extra = table_problems(asset_patterns(self.checklist), self.manifest["assets"])
        self.assertEqual(missing, [], "the checklist's asset table does not list: " + ", ".join(missing))
        self.assertEqual(extra, [], "the checklist's asset table lists what the manifest does not: " + ", ".join(extra))

    def test_latest_json_is_not_an_asset(self):
        self.assertNotIn("latest.json", self.manifest["assets"])
        self.assertEqual([r for r in asset_rows(self.checklist) if "latest.json" in r], [],
                         "the checklist's asset table lists latest.json again")
        downloads = self.notes.split("## Downloads", 1)[1].split("\n## ", 1)[0]
        for paragraph in re.split(r"\n\s*\n", downloads):
            if "latest.json" in paragraph:
                self.assertRegex(paragraph, r"does not publish|not an asset|not published",
                                 "the notes list latest.json among the downloads")

    def test_a_table_that_drifts_is_reported(self):
        table = "## The assets\n\n| Asset | Made by | Notes |\n| --- | --- | --- |\n| `a.tar.gz` | x | y |\n"
        self.assertEqual(table_problems(asset_patterns(table), ["a.tar.gz", "b.tar.gz"])[0], ["b.tar.gz"])
        self.assertEqual(table_problems(asset_patterns(table), ["b.tar.gz"])[1], ["a.tar.gz"])
        self.assertEqual(asset_rows(table + "| `latest.json` | `build-feed` | z |\n"), ["`a.tar.gz`", "`latest.json`"])


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
