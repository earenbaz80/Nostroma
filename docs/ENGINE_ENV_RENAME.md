# The engine's settings are named NOSTROMA_ now

The product is Nostroma, so a setting is written `NOSTROMA_<SETTING>`. Every one of them used to be
`STRATA_<SETTING>`, and a launch script, a preset, an installer or a benchmark command made before the rename still
sets that one. This branch moves the engine's **reads** to the new name and keeps the old one as the fallback.

**This branch has not been compiled.** The machine it was prepared on has no compiler and no graphics card. Nothing
below is a claim that it builds or runs; the list at the end is what a machine with the cards has to do first.

## What changed

- `include/strata/env.hpp` is new: `strata::env("NOSTROMA_X")` reads `NOSTROMA_X` and, when that is not set, reads
  `STRATA_X`. The new name wins when both are set, which is the order the Terminal (`nostroma_control/envnames.py`)
  and the app (`apps/host/server/env-compat.mjs`) already use.
- 1,886 runtime reads in 196 files now go through it: `std::getenv("STRATA_X")` became
  `strata::env("NOSTROMA_X")` in `src/`, `include/`, `sycl/` and `metal/`. `tools/rename_env_names.py --check`
  reports none left, and it is the script that made the change, so the branch can be reviewed or re-run.
- Two helpers took the setting's name as an argument and read it themselves. Their bodies now go through
  `strata::env`, and their 65 call sites pass the new name: `env_on` in `src/core/verify.cpp` and `pipe_dbg_env` in
  `src/program/generate.cpp`.

## What did not change, on purpose

- **Compile-time switches** (`STRATA_METAL`, `STRATA_USE_HIP`, `STRATA_QUANT_X86`, the `STRATA_*_AVAILABLE` macros):
  564 guards. The build defines them, so they have no runtime fallback and renaming them would only move a name from
  the build scripts into the sources.
- **Messages and log lines** that name a setting, and the engine tests that assert those strings
  (`arch_defaults_test`, `numa_pool_test`, `pool_tasks_test`, `kva_test`, the parity binaries). Renaming them changes
  what people see and what the tests match, which is a separate change with its own evidence.
- **Writes** (`setenv`, `_putenv_s` in the parity and benchmark binaries): they still set the old name, and the reader
  falls back to it, so they keep working. Moving them is part of the messages change above.
- **The settings register's keys.** `tools/settings_register.py` now finds both prefixes and stores the setting under
  its old `STRATA_` name, so `data/settings-register.json`, `docs/SETTINGS.md` and the app's settings screen do not
  move in the same change as the sources. `python tools/settings_register.py --check` exits 0 on this branch.

## What was checked here

- `python tools/rename_env_names.py --check`: no runtime `STRATA_` read is left.
- Every one of the 196 files that call `strata::env` includes `strata/env.hpp`, and no include landed inside a
  namespace.
- `python tools/settings_register.py --check`: exit 0, so every setting the engine reads is still in the register and
  none was lost or invented.
- `python tools/settings_register.py --docs` changes exactly one line, and it is a drift that was already there before
  this branch: `STRATA_PREFILL_BORROW` goes from `text` to `on / off`. Nothing else in the page moves, so the rename
  did not shift a single setting name or description.

## What the desktop has to verify before an engine is published

In this order. Anything not run has to be reported as not run.

1. **It compiles, every backend.** CUDA (`packaging/build_cuda_linux.sh`, and the Windows build), HIP
   (`packaging/build_hip_linux.sh`, gfx906 / gfx1030 / gfx1103 / gfx1201), SYCL (`packaging/build_sycl_linux.sh`) and
   Metal (`metal/`, macOS). The header is included by all four, so a missing include or a C++ standard too old for
   `thread_local` shows up here.
2. **The engine's own tests pass**, especially the ones that read settings: `src/core/arch_defaults_test`,
   `src/kernels/cpu/numa_pool_test`, `src/kernels/cpu/pool_tasks_test`, `src/prefill/kva_test`, and the parity
   binaries (`qsa_topk_active_parity`, `native_expert_parity`, `hc_persist_parity`, `fused_gr_bench`).
3. **The default path is unchanged.** A launch that sets no variable at all, same model, same flags: the plan, the
   log lines and the speed match the previous engine. The rename must not change a single default.
4. **The new name works.** Pick one flag (`NOSTROMA_VERIFY_TRACE=1`), one number (`NOSTROMA_IO_THREADS`) and one
   path (`NOSTROMA_PIPELINE_TRACE`), set each alone, and confirm the effect the old name had.
5. **The old name still works.** The same three as `STRATA_*`, alone, with the new name unset: same effect.
6. **The new name wins.** Set both with different values and confirm the engine follows `NOSTROMA_*`.
7. **The Terminal and the app still reach it.** `nostroma launch` with a preset that sets `STRATA_*`, and with one
   that sets `NOSTROMA_*`; both must land on the engine.
8. **Windows.** The engine reads through `getenv` only, but the Windows build is the one with `_putenv_s` and a
   different C runtime, so run the same checks there.
9. **The packages and the feed.** Rebuild the engine packages, bump their version, and say in the release note that
   the settings are named `NOSTROMA_*` now and `STRATA_*` still works. Every user downloads a new engine, which the
   0.2.15 notes avoided on purpose ("the engine's targets, `STRATA_*` macros and output names are untouched"), so
   this is a decision to make, not a side effect to discover.
