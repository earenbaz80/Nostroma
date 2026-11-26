# Audit roadmap

What the repository audit still has open, item by item, with the command that proves each one. This page exists so
nobody has to ask "what is pending?" — the answer is here, and re-running one command updates it.

The audit has two parts. **The security scan** is `tools/audit_pending.py`: four groups of checks (the app updater and
`CVE-2026-95625`, the Dockerfiles, the host's binds and Origin and API keys, and archive extraction). **The UI
campaign** is a separate list of interface requirements from October 2026, kept in
[apps/host/docs/BACKLOG.md](../apps/host/docs/BACKLOG.md). They are tracked apart because they fail differently.

## Refresh it

```sh
python tools/audit_pending.py                  # the scan; exit 1 when any check is FALLA
python tools/audit_pending.py --selftest       # the scan's own test; 12/14 on Windows today, see T3
python tools/audit_pending.py --json audit.json  # the same rows, to compare two runs
```

The scan's own test, `--selftest`, builds a fake project and checks the verdicts. On this Windows machine it reports
**12 of 14** today: two sub-checks look for `devimg/Dockerfile` and `docker/Dockerfile` while the scan prints the
Windows separators (`devimg\Dockerfile`). The scan itself is fine there; the test is not (item T3).

`--json` is the way to compare two runs. Worktrees of git checked out inside the repository (`.worktree-0161` and the
like) are skipped now, so the rows are no longer doubled (T1).

## State on 26 November 2026

> **Measured on:** a Windows machine, Python 3.15.2, this checkout with `tools/audit_pending.py` as changed on
> 26 November 2026, no GPU and no network install involved. The extraction rows also measured the interpreter, not
> the app.

**26 checks: 22 OK, 0 FALLA, 2 AVISO, 2 INFO. Exit code 0.** The two avisos are the SYCL toolboxes that declare why
they run as root (A4) — by design, so the row stays visible; the informational ones are the WebSocket row (no
`WebSocketServer` in the host) and the Python floor, and both are declared in A5.

What is already fine, so it is not re-litigated: `tauri-plugin-updater` 2.14.0 is outside the affected range
(2.0.0–2.12.0), `minisign-verify` 0.3.0 rejects non-canonical signatures, update endpoints are HTTPS-only, the
published images drop privileges (`USER ${APP_UID}:${APP_GID}` in the root and `docker/` Dockerfiles) and pin their
bases by digest, all 54 listeners name a host, CORS has no wildcard, the `Host` header is validated
(`apps/host/server/index.mjs:27`) and API keys are compared with `timingSafeEqual`. No tar extraction is unprotected:
12 pass `filter=` and 2 more are covered by an `extraction_filter` assignment or the `hasattr` guard (A2).

## The items

Status values: **open** (nobody has started), **decision** (needs a choice before code), **tool** (the fix belongs in
`tools/audit_pending.py`, not in the product), **done** (with the date).

| Id | Severity | Item | Status |
| --- | --- | --- | --- |
| A1 | high | The update mitigation `requireSignedVersion` was not configured, and no config file carried the updater block at all | config done 26 Nov 2026; app feed still off |
| A2 | high (signal) | The one FALLA is two `extractall()` calls in vendored code inside the bundled Python | done 26 Nov 2026 |
| A3 | high (signal) | "Manual member loops" reports the project's own path checks as suspicious | done 26 Nov 2026 |
| A4 | medium | Two development Dockerfiles pull their base image without a digest | done 26 Nov 2026 |
| A5 | low | The Python floor is not declared anywhere | open |
| T1 | medium | The scan reads worktrees inside the checkout and duplicates rows | done 26 Nov 2026 |
| T2 | medium | The scan reads only the first `tauri.conf.json` it finds | tool |
| T3 | low | The scan's self-test fails on Windows on path separators | tool |
| B1 | — | The UI backlog is a second, larger list | see its page |

### A1 — `requireSignedVersion` (high, config done, feed still off)

The flag closes a downgrade: the update endpoint's response is fetched over TLS but is not itself signed, so without
it a crafted response pairs a higher version with the URL and signature of an older, genuinely signed build.
`tauri-plugin-updater` 2.14.0 has it (default `false`) and reads the key as **`requireSignedVersion`**: the config
struct deserialises with `rename_all = "camelCase"` and the alias `require-signed-version`. The scan looked for
`require_signed_version`, which the plugin never reads, so that row could not pass however the file was written.

**Where the two values come from (measured 26 November 2026).** No config file ever carried a `plugins.updater`
block: the release build is `tauri build --config src-tauri/tauri.update.conf.json`, and that overlay only removes
`bundle.resources."resources/engine-bundle"`. So the shipped binary had no pubkey and no endpoint, and
`src/updater.rs` supplies the endpoint at runtime from `NOSTROMA_UPDATE_APP_ENDPOINT` (loopback or https) — with
`APP_UPDATES_OFF` returning "off" when it is unset. The pubkey existed only in `nostroma_control/update_keys.json`
as `app_minisign_public`, which `packaging/feed_tool.py:_default_app_pubkey()` reads as a fallback.

**Done 26 November 2026:** `tauri.conf.json` names `plugins.updater.pubkey` (the `app_minisign_public` value) and
`requireSignedVersion: true`, and deliberately names **no endpoints** — 0.2.15 removed the app feed because the old
endpoint was another product's `latest.json`. With no endpoint, `app.updater()` has nothing to check and the
`APP_UPDATES_OFF` gate is unchanged; with our key named, an endpoint set by hand can only serve artifacts signed by
Nostroma. The scan reads the camelCase key now, and `tests/terminal/test_release_config.py` asserts both the flag and
that no endpoint appears.

**Still missing before the app can update itself again** (a product decision, not a config edit):

1. A published endpoint. `build-feed` writes `RELEASE/app/latest.json`, and `docs/RELEASE_CHECKLIST.md` says it is
   not an asset, so there is no URL to name in `endpoints`.
2. Version-carrying signatures. `requireSignedVersion` rejects a signature whose trusted comment has no version, and
   `tauri signer sign` only records one with `--app-version` (the CLI warns when it is omitted). The flag exists from
   tauri-cli 2.12.0; this repo pins `@tauri-apps/cli` 2.12.3. Every installer users can still update from must be
   re-signed with `--app-version <version>` and its `.sig` replaced in the feed.

- Verify: `python tools/audit_pending.py` row 1 reads OK; `python -m pytest tests/terminal/test_release_config.py
  tests/terminal/test_update_feed.py`.

### A2 — the FALLA is vendored code (high as a signal, tool)

Both files the scan flags ship inside the app's bundled Python 3.12
(`apps/desktop/src-tauri/resources/control/python/`, `python312.dll`):

- `pip/_vendor/distlib/util.py:1307` is **safe and misread**: the file assigns `archive.extraction_filter` before
  calling `extractall(dest_dir)` with no argument. The scan only looks at the call's arguments.
- `pygments/lexers/_php_builtins.py:3304` is a **maintainer script** that downloads the PHP manual to regenerate a
  table, and falls back to a bare `extractall()` only when the interpreter has no `filter`.

The dynamic rows ("dyn: …") measured Python 3.15, which refuses traversal by default. The **shipped** runtime is
3.12, where that default does not exist, so those rows do not clear the app.

- Done when: the scan recognises an `extraction_filter` assignment (and the project's `safe_extract`) and the audit
  exits 0, or the bundled `site-packages` is excluded with the reason recorded in the tool.
- Verify: `python tools/audit_pending.py` exit 0; `python tools/audit_pending.py --selftest` no worse than the 12/14
  in T3.
- **Done 26 November 2026.** The scan now counts a tar call as protected when the object has `extraction_filter`
  assigned before the call (distlib) or when the `hasattr(..., 'extraction_filter')` guard sits within the seven lines
  above it (pygments' fallback). The row reads "0 tar sin filter: ninguna".

### A3 — the member loops are the validation (high as a signal, tool)

`nostroma_control/components.py:299`, `:318`, `:355` and `apps/desktop/scripts/stage-control.py:64` walk
`getmembers()` / `namelist()` **to check** that each member resolves inside the destination before extracting. The
scan flags any such loop. Same fix as A2: teach it the pattern, or accept the row with a recorded reason.

- **Done 26 November 2026.** A member loop is reported only when it writes to disk *and* does not check each name —
  either through a helper whose name says so (`_check_member_within`, `is_within_directory`) or inline with
  `resolve()` plus a containment test. A loop that only classifies members, and any loop in a test file, is not a
  manual extraction. The row lists 6 loops that validate and none that do not.

### A4 — two development images without a digest (medium, done)

`sycl/tools/Dockerfile:10` and `sycl/tools/Dockerfile.unitrace:8`. Both are interactive toolboxes that are not
published, and both declare why they keep root with `# audit: root-ok — …`; the root exception is not the item. The
digest is: without `@sha256:` the same tag can pull different bits tomorrow.

- Done when: both `FROM` lines carry a digest (`FROM image@sha256:…`), including the `ARG`-driven one.
- Verify: `python tools/audit_pending.py` rows 2, both reading OK.
- **Done 26 November 2026.** The dev image starts from
  `ghcr.io/snailium/llama.cpp-sycl-intel-b70/llama-sycl-b70:stable@sha256:f040fa36…a598ce`, the digest the tag
  resolved to that day, read from the registry's manifest index (a multi-arch index, so each machine still gets its
  platform's manifest; `docker buildx imagetools inspect <ref>` prints it again). `Dockerfile.unitrace` cannot cite the
  `nostroma-sycl-dev` tag — a locally built image has no registry digest to write — so it takes the same pinned base
  through `ARG SYCL_BASE` and repeats the dev image's `RUN`, which leaves the profiling image's content unchanged.
  Both digest rows read OK; the two rows still shown are the declared root, and they stay on purpose.

### A5 — no declared Python floor (low, open)

Neither `setup.py` (`python_requires`) nor `pyproject.toml` (`requires-python`) declares one, while the app bundles
3.12 and this machine runs 3.15. This is an INFO row, not a failure.

- Done when: the floor is declared once and the audit row prints it.
- Verify: `python tools/audit_pending.py` row 4, "mínimo de Python".

### T1 — worktrees inside the checkout (medium, tool)

`.worktree-0161` is a registered worktree (`git worktree list`), so every Dockerfile, config and source file it
holds is scanned a second time. It inflated this run from 27 rows to 33 and made the `require_signed_version` row
name the copy instead of the working tree.

- Done when: `.worktree*` (or every directory listed by `git worktree list` except the root) is skipped, with a
  self-test case that a worktree inside the fixture is ignored.
- Verify: `python tools/audit_pending.py` says 26 rows on this checkout.
- **Done 26 November 2026.** `walk()` prunes any child directory whose `.git` is a file, which is what a linked
  worktree (and a submodule) has. The run went from 33 rows to 25, and every evidence path is the working tree's. The
  worktree itself was removed the same day — it had no uncommitted or untracked files, its only ignored entries were
  `__pycache__` folders, and its commit `7ace127d` is already in `nostroma-env-names` — so `git worktree list` now
  prints one line. The guard stays for the next worktree.

### T2 — only the first `tauri.conf.json` is read (medium, tool)

`check_updater` takes `confs[0]` from a walk, so with four configs in `apps/desktop/src-tauri/` the verdict depends on
walk order. The updater settings, if they move, will live in `tauri.release.conf.json` or `tauri.update.conf.json`.

- Done when: every config under `src-tauri/` is read and the row names the file that decides the value.

### T3 — the self-test assumes POSIX paths (low, tool)

`--selftest` reports 12 of 14 on Windows. The two that fail are the Dockerfile sub-checks: they search the row details
for `devimg/Dockerfile` and `docker/Dockerfile`, and `rel()` in the tool prints `devimg\Dockerfile` there, so the
development-image row and the unpinned `ARG BASE=ubuntu` are never found. The scan's verdicts for the real repository
are unaffected.

- Done when: the self-test compares separators portably (normalise with `os.sep` or replace `\\` with `/`) and prints
  **14/14 on Windows**.
- Verify: `python tools/audit_pending.py --selftest` exit 0.

## Second track: the UI backlog

[apps/host/docs/BACKLOG.md](../apps/host/docs/BACKLOG.md) holds the interface requirements from the October 2026
campaign that were not done or not shown to be done: **11 open** and **18 to check**, plus the note that **80 of that
campaign's 177 findings** stayed "optional, not scheduled" (all low priority, ids in
[history/apps/host/audit-fixes/FINDING-STATUS.md](../history/apps/host/audit-fixes/FINDING-STATUS.md)). Those counts
are from that page, not from this scan; it is the page to edit when one of them closes.

## Keeping this page true

1. Re-run the scan before changing a status. A row is only **done** when the command prints OK for it.
2. Update the "State on" date and the checkout hash in the same edit as the table.
3. One line per item. If an item needs a design decision, write the decision in the item and leave it **decision**.
4. Do not add an item without the command that shows it. Static reading is marked as such, like `tauri.conf.json`
   above.
