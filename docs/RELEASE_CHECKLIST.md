# First release: the checklist

What a first release of `earenbaz80/Nostroma` needs, which file of `packaging/` makes each asset, and the order to build
and publish them. This page is for the person with the release PC and the signing keys. Nothing here builds, signs or
uploads anything by itself.

## Before you start

- **The two private keys**, on the release PC only: `feed-key.json` (ed25519, for the update feed and the engine
  packages) and `tauri-updater.key` (minisign, for the app updater). Their public halves are already in the tree:
  `nostroma_control/update_keys.json` (key id `5d1bc23abbeffd0d`) and `apps/desktop/src-tauri/tauri.conf.json`. No key
  belongs in this repository.
- **The build boxes.** An engine package is built on the system it runs on: Linux x86_64 (CUDA 12 and 13, one HIP
  package per card family, SYCL), Linux aarch64 (DGX Spark), Windows x86_64 (CUDA and HIP) and an Apple Silicon Mac.
  A Control package is built on its target OS too.
- **The previous `nostroma-feed.json`**, if the frozen DeepSeek (`dsv41`) packages are carried into this release. Without
  it, build the feed with `--no-dsv41-carry` and leave those six archives out.
- **The release notes.** `docs/release-notes-<version>.md` does not exist for 0.2.15 yet; the release page needs it.

## What each entry point reads

| Entry point | Files it reads | When one is missing |
| --- | --- | --- |
| `install.sh` | `install-manifest.txt`; the line for `linux-x86_64`, `linux-aarch64` or `macos-arm64`; that Control package; `nostroma-feed.json` and its `.sig` | "this release has no Terminal for <platform>", or the signature check refuses the release |
| `install.ps1` | The same for `windows-x86_64`, unpacked with `Expand-Archive` (a `.zip`) | The same |
| `nostroma update` | `nostroma-feed.json` and its `.sig` (`nostroma-feed-linux-aarch64.json` on Linux ARM64) | A 404, or a feed that does not verify |
| The app | Nothing: its own updater is off in this build (no endpoint and no key in `tauri.conf.json`) | The app never checks |
| `UPDATE.bat`, `update.sh` | Nothing of their own: they run `git pull` and `setup.py --update`, which asks the signed feed for this PC's engine (`engine_from_feed`) | Since 0.2 there are no flat `nostroma-windows-x64.zip` assets; these two need the signed feed |

## The assets

Every name below is flat in the release: GitHub release assets have no folders.

| Asset | Made by | Notes |
| --- | --- | --- |
| `nostroma-feed.json`, `nostroma-feed.json.sig` | `packaging/feed_tool.py build-feed` | The signed feed every client reads |
| `nostroma-feed-linux-aarch64.json`, `.sig` | A second `build-feed` with only the `linux-aarch64` entries | Its own `sequence`, which must never go down |
| `install-manifest.txt` | `build-feed`, from `RELEASE/control/*.entry.json` | One line per Control package: `platform version url sha256 size` |
| `install.sh`, `install.ps1` | Copies of `packaging/install.sh` and `packaging/install.ps1`, unchanged | Their built-in address is the release folder |
| `nostroma-control-<control version>-<platform>.tar.gz` | `apps/desktop/scripts/stage-control.py` stages the folder, `feed_tool.py pack-control` packs it | `--format zip` for `windows-x86_64`; the archive must hold `bin/nostroma`. The folder is the same bundle `packaging/package_terminal.py` writes as `nostroma-terminal-<version>-<platform>.tar.gz`, which is not uploaded |
| `nostroma-engine-<engine version>-<platform>-<backend>[-<variant>].tar.gz` | The build script for the box, then `packaging/package_engine.py`, `feed_tool.py sign-package`, `feed_tool.py pack-engine --url-prefix=` | See the per-platform list below. 0.2.15 builds none: all 14 are the ones v0.2.14 published (`engines_from`), 12 at 0.1.60 and `linux-aarch64` cuda13 and `linux-x86_64` sycl at 0.1.59 |
| `Nostroma-<product version>-windows-x64-setup.exe` (+ `.sig`) | `npx tauri build --bundles nsis --config src-tauri/tauri.update.conf.json`, then `npx tauri signer sign` | No engine inside |
| `Nostroma-<product version>-linux-x86_64.AppImage` (+ `.sig`) | `npx tauri build --bundles appimage --config src-tauri/tauri.update.conf.json`, then `npx tauri signer sign` | No engine inside |
| `Nostroma-<product version>-macos-arm64.dmg` | `npx tauri build --bundles dmg`, then `packaging/mac/sign-and-notarize.sh` | Downloaded by hand; it is not in the feed's app member |
| `Nostroma.app.tar.gz` (+ `.sig`) | `packaging/mac/sign-and-notarize.sh --updater-archive`, then `npx tauri signer sign` | The Mac updater archive; it must hold the signed, notarised app |
| `qwen3.8-flash-next-dflash2.nostroma1.q4_0-selq4.pack` | `tools/dflash2_pack.py --q4_0 --q4_0-selector`, then `feed_tool.py pack-drafter` | 339,694,592 bytes; `--backends metal,cuda,hip` |
| `qwen3.8-flash-next-dflash2.nostroma1.q4_0-bf16sel.pack` | `tools/dflash2_pack.py --q4_0`, then `pack-drafter` | 522,458,112 bytes; `--backends sycl` |
| `nostroma-dsv41-<version>-<platform>-<backend>[-<variant>].tar.gz` | Nothing: `build-feed --carry-dsv41 <previous feed> --carry-dsv41-base <URL of the release that holds them>` | Only for 0.2.13 and earlier clients |
| `SHA256SUMS.txt` | `packaging/sha256sums.py` | Run it last: it lists every file in the folder |

`build-feed` also writes `RELEASE/app/latest.json`. It is not an asset: the feed carries it as its `app` member, which
`nostroma update --app` reads, and the release does not publish the file.

### Engine packages, one per build box

| Package | Build box and script |
| --- | --- |
| `linux-x86_64` cuda, variant `cuda13` | A Linux box with CUDA 13: `packaging/build_cuda_linux.sh` |
| `linux-x86_64` cuda, variant `cuda12` | The same box with CUDA 12.9: `VARIANT=cuda12 packaging/build_cuda_linux.sh` |
| `linux-x86_64` hip `rx9070`, `rx7900`, `rx6000`, `halo` | `VARIANT=<family> packaging/build_hip_linux.sh` |
| `linux-x86_64` sycl | `packaging/build_sycl_linux.sh` |
| `linux-aarch64` cuda `cuda13` | A DGX Spark or another ARM box: `packaging/build_cuda_linux_aarch64.sh` |
| `macos-arm64` metal | An Apple Silicon Mac: `packaging/mac/build_engine.sh` |
| `windows-x86_64` cuda `cuda13`, `cuda12` | `packaging/build_cuda_windows.py` |
| `windows-x86_64` hip `rdna2`, `rdna3`, `rx9070` | `tools/hip/build_windows.bat`, then `packaging/package_engine.py --backend hip` |

## Order

1. **Engines.** Only when an engine changed; 0.2.15 takes v0.2.14's 14 packages as they are, so this step is a
download of the files, not a build. When one did change, build it on its box, then package and sign the folder:

   ```sh
   python packaging/package_engine.py --src <stage> --backend <backend> --version <engine version> --out <package>
   python packaging/feed_tool.py sign-package <package> --key feed-key.json
   python packaging/feed_tool.py pack-engine <package> --out RELEASE/engine --url-prefix=
   ```

   `--url-prefix=` (not `--url-prefix ""`): PowerShell 5.1 drops an empty argument.

2. **Control.** On each OS, stage the Control folder, then pack it on the release PC and keep the `.entry.json` files
   together:

   ```sh
   python apps/desktop/scripts/stage-control.py            # writes apps/desktop/src-tauri/resources/control
   python packaging/feed_tool.py pack-control apps/desktop/src-tauri/resources/control --version <control version> \
     --platform <platform> --out RELEASE/control --url-prefix=
   ```

   Use `--format zip` for `windows-x86_64`. Every Control package in one feed must carry the same version; this release
   has 0.1.61 on `linux-x86_64`, `macos-arm64` and `windows-x86_64`, and 0.1.59 on `linux-aarch64`.

3. **Installers.** Build each one, sign it on the release PC, and add it to the app JSON:

   ```sh
   npx tauri signer sign -f tauri-updater.key <installer>
   python packaging/feed_tool.py set-app-platform --app-json RELEASE/tauri-latest.json --target <target> --version <product version> --archive <installer> --sig <installer>.sig
   ```

   `tauri.conf.json` names no updater key in this build, so the command checks against `app_minisign_public` from
   `nostroma_control/update_keys.json`; pass `--pubkey` only to check against another key.

   On the Mac, run `packaging/mac/sign-and-notarize.sh --updater-archive` first: notarising changes the bytes, and a
   signature made before that does not verify.

4. **Drafters.** Convert the pinned Hugging Face file, then pack it:

   ```sh
   python tools/dflash2_pack.py <model.safetensors> <config.json> <name>.pack --q4_0 --q4_0-selector
   python packaging/feed_tool.py pack-drafter <name>.pack --out RELEASE/drafters --version 1 --backends metal,cuda,hip --url-prefix=
   ```

   The second file uses `--q4_0` alone and `--backends sycl`.

5. **Feed.** Say what happens to the frozen DeepSeek member, then build:

   ```sh
   python packaging/feed_tool.py build-feed --out RELEASE --sequence <N> --key feed-key.json \
     --engine RELEASE/engine --control RELEASE/control --app-json RELEASE/tauri-latest.json \
     --drafters RELEASE/drafters \
     --carry-dsv41 <previous nostroma-feed.json> --carry-dsv41-base https://github.com/earenbaz80/Nostroma/releases/download/<tag>/
   ```

   Use `--no-dsv41-carry` instead when those packages are not carried. `build-feed` writes the feed, its signature,
   `install-manifest.txt` and `app/latest.json`.

6. **Feed for Linux ARM64.** A second `build-feed` with only the `linux-aarch64` engine and Control entries, its own
   `sequence`, and the output renamed to `nostroma-feed-linux-aarch64.json` (plus its `.sig`). Every release publishes
   both files until every client skips platforms it does not know.

7. **Verify.** Before uploading anything:

   ```sh
   python packaging/feed_tool.py verify-feed RELEASE --pub feed-key.pub.json
   python tools/release_manifest.py --check
   ```

   `verify-feed` reads the feed the way a client does: signature, channel, expiry, sequence, and that Control keeps every
   model entry. It exits 3 when Control would drop one.

8. **Assemble and upload.** Copy `packaging/install.sh` and `packaging/install.ps1` into the folder, add every archive,
   installer, `.sig`, both feeds and `install-manifest.txt` — leave `RELEASE/app/latest.json` out — then check the folder
   against the manifest and write the sums:

   ```sh
   python packaging/check_assets.py <upload folder>
   python packaging/sha256sums.py <upload folder>
   ```

   Create the release as a draft, upload the files, then download them again and check them with
   `sha256sum -c SHA256SUMS.txt`.

9. **Publish as Latest.** The feed and its signature go last, then the release is published as **Latest**, not as a
   pre-release: `releases/latest/download` does not see a pre-release, so the installers, `nostroma update` and the app
   updater would get a 404. After publishing, open each address once:

   ```sh
   https://github.com/earenbaz80/Nostroma/releases/latest/download/install.sh
   https://github.com/earenbaz80/Nostroma/releases/latest/download/install.ps1
   https://github.com/earenbaz80/Nostroma/releases/latest/download/nostroma-feed.json
   ```

## What this tree does not have

- **The private keys.** Only the public halves are committed. Without `feed-key.json` and `tauri-updater.key` nothing
  can be signed.
- **The binaries.** The engine packages, the Control packages, the installers and the two drafter files are built on
  their own systems, and none of them is in the repository.
- **The previous feed** for `--carry-dsv41`, and the six `dsv41` archives it names.
- **A Control package for `linux-aarch64` at the current Control version.** The manifest lists 0.1.59 for that platform
  while the others are 0.1.61, and one feed may not mix Control versions. Build it on ARM or publish the old one only in
  the ARM64 feed.
- **The release-notes page** for this version.
- **The assembly and upload scripts** that `packaging/make_model_release.py` names (`check_sums_rc1.py`,
  `check_feeds_rc1.py`, `phaseA-tests/rel0211/…`). Nothing in this tree uploads an asset.

## Names

`apps/desktop/src-tauri/tauri.conf.json` has `"productName": "Nostroma"`, so `tauri build` writes
`Nostroma-<version>-…` and `Nostroma.app.tar.gz`. The release manifest (`docs/data/release.json`) and the pages that
quote it use those names; `python tools/release_manifest.py --check` fails when a current page names an installer that
is not in the asset list.
