# Nostroma 0.2.15: the first release under the new name

The app and the Terminal are 0.2.15. Control is 0.1.61. No engine was rebuilt: the 12 engine packages at 0.1.60
and the two at 0.1.59 (Linux ARM64 CUDA and Linux SYCL) are the ones v0.2.14 published, and the six frozen
DeepSeek (`dsv41`) packages are carried as they were.

## What you will notice

- **The product is called Nostroma.** The window and page titles, the tray, the About row, the quit dialog, the
  installer, the app bundle, the macOS menu, the Terminal's header, the guides and the eight READMEs. The
  repository is now `earenbaz80/Nostroma`, and the sponsorship links and their contact address are gone.
- **The command is `nostroma`, and `nostroma` still works.** The installer puts both names on the PATH — two links
  on Linux and macOS, two launchers on Windows — and each one says the name it was called by. A name that
  already exists and is not a link the installer made is left alone, and the install stops instead of
  overwriting it.
- **Your settings and data keep their place.** The host reads `NOSTROMA_*` first and still honours every
  `NOSTROMA_*` variable as the fallback, so a launch script or a preset you already have keeps working. The
  Python packages are now `nostroma_cli` and `nostroma_control`; `nostroma.py` still runs the program, and it is
  still the file the Control archive ships.
- **The app moves an existing install.** A `~/.nostroma` folder, a `Documents/Nostroma/Models` library and a
  `Documents/Nostroma/Workspace` are renamed to the new names with their contents, and the app identifies itself as
  `ai.nostroma.desktop`. When a folder cannot be moved (another volume, no permission) it is read where it is.
  The Terminal offers `Documents/Nostroma` first and still counts `Documents/Nostroma`, so models an older install
  put there are found.
- **A new look: amber phosphor.** Square corners, amber accents and one typeface across the app (Korean and
  Chinese still come from the system fonts), in both themes; text keeps WCAG AA contrast. The tab icon and the
  header mark are a new N monogram on an amber tile, and the header sets the rest of the name beside it, so the
  mark and the wordmark read as one: **N** + *ostroma*. The Windows `.ico` and the macOS `.icns` could not be
  regenerated on the machine where this was drawn, so the installed app's own icon still carries the old drawing;
  the window, the tab and the header do not.
- **Artifact previews no longer reach the internet.** A preview now uses the same document builder and content
  policy as the Time-skip comparison: `default-src 'none'` and `connect-src 'none'`, so a generated page cannot
  fetch, beacon or load a script. When a preview needs a file from the internet, the app says so instead.
- **The app no longer checks for its own updates.** The updater pointed at another product's `latest.json` and
  public key, so "Check for updates" could have installed a different program over this one. The app row is off
  in this build: no endpoint, no key, and the shell refuses to install an app update. Control and the engines
  keep updating through the signed feed, from the app and from `nostroma update`.
- **The Terminal header reads NOSTROMA**, in the launch screens and in the monitor, and the 18 text captures in
  `docs/terminal-previews` were regenerated from the running screens. Two runs now write byte-identical files.

## What stays the same

- The model files, the engine packages and the signed feed. No engine package was rebuilt for 0.2.15: the engine
  sources changed only in comments and messages, and its targets, `NOSTROMA_*` macros and output names are
  untouched, so a PC that already has its engine downloads nothing new.
- `nostroma launch`, its flags and the run presets; `nostroma` as the second name of the command.
- The `NOSTROMA_*` variables, `~/.nostroma`, `Documents/Nostroma` and `nostroma.py`, for installs and scripts made
  before the rename.

## Packaging and the release

- The installers and the Mac updater archive are named after the product: `Nostroma-0.2.15-windows-x64-setup.exe`,
  `Nostroma-0.2.15-linux-x86_64.AppImage`, `Nostroma-0.2.15-macos-arm64.dmg` and `Nostroma.app.tar.gz`. The
  release manifest, `AGENTS.md`, the READMEs and the guides quote those names.
- `SHA256SUMS.txt` is written by `packaging/sha256sums.py` from the flat upload folder, and
  `packaging/check_assets.py` fails when the folder and the manifest's 41 assets disagree.
- `docs/RELEASE_CHECKLIST.md` is the runbook: every asset, the script that builds it, and the order up to
  publishing as Latest.
- The release guards now fail on an old name instead of accepting it: the page check rewrites
  `Nostroma-<version>-<platform>-…` and `Nostroma.app`, and the tests pin that.

## What we did not test

- Any engine speed or quality: no engine was built for this release, so there are no new engine numbers.
- The Mac build, its signing and notarisation: they run on the owner's Mac after this tree is tagged.
- The packaged app's own update flow: the app row is off in this build, so there is none to run.
- A Rust build on this machine (no `cargo` here); the Rust changes were checked by reading and by the host's
  tests, not by compiling the shell.

## Updating

- **App:** this build has no in-app updater. Download the installer for your system from the release page and
  install it over the old app; the app's data and models are moved on first start. `nostroma update --app`
  downloads and verifies that installer for you (SHA-256 from the signed feed and its minisign signature) and
  leaves it in `.updates/app`; running it is still the platform installer's job.
- **Terminal:** run `nostroma update`. It fetches Control 0.1.61 and keeps the previous Control package, so
  `nostroma components rollback` can return to it. The engine is unchanged, so no engine is downloaded.
- **Older installs:** `nostroma` and the `NOSTROMA_*` variables keep working, so a script that has not been touched
  still starts the same server.

## Downloads

Three installers (Windows, Linux AppImage, Mac dmg) and the Mac updater archive `Nostroma.app.tar.gz`; Control
0.1.61 for Linux x86_64, macOS arm64 and Windows (zip), and 0.1.59 for Linux ARM64; the 12 engine packages at
0.1.60 and the two at 0.1.59; the two DFlash2 drafter files; the six frozen DeepSeek packages; both feeds
(`nostroma-feed.json` and `nostroma-feed-linux-aarch64.json`) with their signatures; `install.sh`, `install.ps1`,
`install-manifest.txt` and `SHA256SUMS.txt`.

The release does not publish `latest.json`: this build's app has no update row to read it, and `nostroma update
--app` reads the signed feed, which carries the same app installer.
