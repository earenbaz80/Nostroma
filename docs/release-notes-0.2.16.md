# Nostroma 0.2.16: every name is Nostroma

These notes describe 0.2.16 before publication. The app and the Terminal are 0.2.16, Control is 0.1.62 and the engine
version is 0.1.62. All 13 Linux/Windows engine packages will be rebuilt at 0.1.62 — the first release since 0.2.14 that rebuilds
engine packages — because the names the engine reads for its own settings changed. The packages, the installers and
the feeds will be built and signed on their own boxes before the release is published.

## What you will notice

- **Every setting is read as `NOSTROMA_<NAME>`.** The previous prefix is no longer read: update launch scripts,
  systemd units, presets and saved command lines before upgrading.
- **The rename is complete.** The binary, packages, data paths, environment variables, C++ namespace and CMake
  options all use Nostroma now; no compatibility alias remains.
- **Nothing else changes.** Defaults, output names, model and pack files, the API and the compile-time switches
  (`NOSTROMA_METAL`, `NOSTROMA_USE_HIP`, …) are untouched. This rename changes names, not behaviour, and no speed or
  quality claim is made for it.
- **A fresh 0.2.16 install will start with Control 0.1.62 on every supported platform**, including Linux ARM64, which was still
  on 0.1.59 before this release. The engine for the card comes from the signed feed on first start.
- **The Windows HIP build script works from a path with spaces.** `tools/hip/build_windows.bat` no longer passes
  `--rocm-path`, which TheRock's SDK rejected there; the tree that carries the rename built and packaged end to end
  with it.

## What stays the same

Models, packs, tuning results, presets and API keys. Saved tuning presets get the usual `engine_changed` recheck
offer (about two minutes); no preset is opened or changed by the update.

## What was measured

All of this ran on the tree that carries the rename, whose engine reports **0.1.61**. No 0.1.62 package has been
built yet.

- The engine's own tests on the Windows CUDA build: 4/4, the arch defaults, the NUMA pool, the pool tasks and KVA,
  plus the parity binaries.
- The C++20 settings probe on MSVC: 6/6. `NOSTROMA_*` is read and the previous prefix is rejected.
- The Windows HIP build of that tree compiles, links, packages, and the engine in the archive reports 0.1.61.
- The Terminal reaches the engine: presets load, and a launch passes the `NOSTROMA_*` value.
- `NOSTROMA_VERIFY_TRACE`, `NOSTROMA_IO_THREADS` and `NOSTROMA_LOGPOS` keep their documented effects.

## What was not measured

- **No 0.1.62 package has been built or tested.** All 13 Linux/Windows packages will be built on their own boxes before publication, and
  the release page will report those results.
- Linux CUDA 12 and 13, Linux HIP, SYCL and Linux ARM64 were not built on the machine that prepared this
  release; none of those backends ran here.
- Inference on AMD, Intel Arc and ARM64, and speed and answer quality: no engine behaviour changed, so
  there is nothing new to measure for the rename.

## Updating

- **Terminal and app:** `nostroma update` will download the engine package for the card. `nostroma components
  rollback` returns to the engine that was installed before.
- **Older scripts:** update them to the `NOSTROMA_*` names; no alias is read any more.
- **Pinned versions:** if a script pins an engine or Control version, move it to engine 0.1.62 and Control 0.1.62 once
  the release exists.

## What the release will contain

- **App and Terminal 0.2.16:** `Nostroma-0.2.16-windows-x64-setup.exe` and `Nostroma-0.2.16-linux-x86_64.AppImage`.
- **Control 0.1.62** for `windows-x86_64`, `linux-x86_64` and `linux-aarch64`.
- **13 engine packages at 0.1.62:** Windows CUDA 13 and 12, Windows HIP `rx9070`/`rdna3`/`rdna2`, Linux CUDA 13 and
  12, Linux HIP `rx9070`/`rx7900`/`rx6000`/`halo`, Linux SYCL and Linux ARM64 CUDA 13.
- **The two DFlash2 drafter packs** are unchanged, and the five frozen `dsv41` engine packages stay at 0.1.59 for
  0.2.13 and earlier clients.
