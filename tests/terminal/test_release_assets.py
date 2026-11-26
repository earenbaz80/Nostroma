"""The release asset list names exactly what the packaging rules produce.

Every generated name comes from the same function the release uses: package_engine.package_folder_name for the folder,
feed_tool.engine_archive_name / control_archive_name for the archives, feedmod for the feed files, drafting for the
drafters and release_manifest for the installers. The 13 Linux/Windows engine variants are the canonical release matrix.
"""
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / "packaging"), str(ROOT / "tools")]

import feed_tool  # noqa: E402
import package_engine  # noqa: E402
import release_manifest  # noqa: E402
from nostroma_control import drafting, feed as feedmod  # noqa: E402
from tests.terminal.test_release_matrix import RELEASE  # noqa: E402

MANIFEST = ROOT / "docs" / "data" / "release.json"

#: The three Linux/Windows Control packages of this release and the format install.sh / install.ps1 need.
CONTROL_PACKAGES = (
    ("windows-x86_64", "zip"),
    ("linux-x86_64", "tar.gz"),
    ("linux-aarch64", "tar.gz"),
)

#: Carried frozen from the DeepSeek release (0.2.13 and earlier clients); no recipe builds them for this release.
CARRIED_DSV41 = (
    "nostroma-dsv41-0.1.59-linux-aarch64-cuda-cuda13.tar.gz",
    "nostroma-dsv41-0.1.59-linux-x86_64-cuda-cuda13.tar.gz",
    "nostroma-dsv41-0.1.59-linux-x86_64-hip-rx9070.tar.gz",
    "nostroma-dsv41-0.1.59-windows-x86_64-cuda-cuda13.tar.gz",
    "nostroma-dsv41-0.1.59-windows-x86_64-hip-rdna3.tar.gz",
)

#: The Linux/Windows installers tauri signer signs.
SIGNED_INSTALLERS = ("windows-x64-setup.exe", "linux-x86_64.AppImage")


def expected_assets(release: dict) -> set[str]:
    engines = {
        feed_tool.engine_archive_name(
            package_engine.package_folder_name(release["engine_version"], package["platform"],
                                               package["backend"], package["variant"]))
        for package in RELEASE
    }
    controls = {
        feed_tool.control_archive_name(release["control_version"], platform, fmt)
        for platform, fmt in CONTROL_PACKAGES
    }
    installers = {name.format(v=release["product_version"]) for name in release_manifest.INSTALLER_NAMES}
    app = set(installers) | {
        name + ".sig" for name in installers if name.endswith(SIGNED_INSTALLERS)
    }
    feeds = (feedmod.FEED_NAME, feedmod.AARCH64_FEED_NAME)
    helpers = {
        "SHA256SUMS.txt", "install-manifest.txt", "install.sh", "install.ps1",
        *feeds, *(name + ".sig" for name in feeds),
        drafting.TUNED_NAME, drafting.TUNED_BF16_NAME,
    }
    return engines | controls | app | helpers | set(CARRIED_DSV41)


class ReleaseAssets(unittest.TestCase):
    def setUp(self):
        self.release = json.loads(MANIFEST.read_text(encoding="utf-8"))
        self.assets = self.release["assets"]

    def test_the_matrix_holds_the_thirteen_linux_windows_engine_variants_once_each(self):
        combos = [(package["platform"], package["backend"], package["variant"]) for package in RELEASE]
        self.assertEqual(len(combos), 13)
        self.assertEqual(len(set(combos)), 13)

    def test_the_asset_list_is_exactly_what_the_rules_produce(self):
        expected = expected_assets(self.release)
        assets = set(self.assets)
        self.assertEqual(sorted(assets - expected), [], "assets no recipe produces")
        self.assertEqual(sorted(expected - assets), [], "assets the release is missing")

    def test_no_name_is_listed_twice(self):
        duplicates = sorted({name for name in self.assets if self.assets.count(name) > 1})
        self.assertEqual(duplicates, [])

    def test_every_name_is_a_flat_release_asset(self):
        self.assertEqual([name for name in self.assets if "/" in name or "\\" in name], [])

    def test_macos_is_not_packaged(self):
        mac = [name for name in self.assets if "macos" in name.lower() or name.endswith(".dmg")
               or name.startswith("Nostroma.app")]
        self.assertEqual(mac, [])
        for installer in release_manifest.INSTALLER_NAMES:
            name = installer.format(v=self.release["product_version"])
            if name.endswith(SIGNED_INSTALLERS):
                self.assertIn(name + ".sig", self.assets, name)

    def test_every_signature_has_the_file_it_signs(self):
        for name in self.assets:
            if name.endswith(".sig"):
                self.assertIn(name[:-4], self.assets, name)


if __name__ == "__main__":
    unittest.main()
