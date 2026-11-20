# Nostroma media and video guide

For people and AI tools creating an article, overview or video. Last reviewed: 7 November 2026, for Nostroma 0.2.15.
Use [AI_REFERENCE.md](AI_REFERENCE.md) for product facts and [README.md](../README.md) for the public introduction.

## Short description

Nostroma runs supported AI models on your own computer. Use its desktop app to chat and work with code and images,
use its terminal app, or connect a coding tool. One installer per system (Windows, Linux, Mac). Nostroma's code is free and open source under the MIT license.

Suggested opening: **“Run powerful AI on your own computer. Chat, code and work with images, locally.”**

## A short video outline

1. **Show the desktop app.** A chat and a visible result explain the product quickly.
2. **Show the choice of interfaces.** The desktop app for a visual workspace; the terminal app for keyboard-driven use.
3. **Show the two model families.** Qwen3.8-Flash-Next and Qwen3.6-35B-A3B.
   Explain the [availability limits](AI_REFERENCE.md#model-families).
4. **Choose a model for the machine.** Prefer ISTA-DASLab, then Unsloth, Gyro and other providers where compatible.
   Gyro is a memory-saving option, currently slower. State the model, quantization and hardware used in any live demo.
5. **Connect a familiar tool.** Examples include Claude Code, Codex CLI, OpenCode, oh-my-pi, pi.dev and Hermes Agent.
   Show a real successful connection if demonstrating one.
6. **Close with the two useful links.** [Download Nostroma](https://github.com/Niko1221/Strata/releases/latest)
   and [support development](https://buymeacoffee.com/strataengine).

This is an outline, not evidence that any particular model, workflow or benchmark was tested for the video.

## Existing assets

Use the existing assets with accurate captions. These screenshots demonstrate the interfaces; they do not
establish a current default model or universal performance.

| Asset | File | Suggested caption / context |
| --- | --- | --- |
| Logo, light background | [strata-lockup-light.svg](../apps/host/public/brand/strata-lockup-light.svg) | Nostroma |
| Logo, dark background | [strata-lockup-dark.svg](../apps/host/public/brand/strata-lockup-dark.svg) | Nostroma |
| Desktop app | [app-chat.png](media/app-chat.png) | Chat, files and a live preview in one window. The capture shows a Gyro model; do not relabel it as an ISTA run. |
| Terminal app | [terminal-monitor.png](media/terminal-monitor.png) | Model activity and hardware use. The capture shows a Gyro-S session; its live counters are not a standardized benchmark. |
| Coding demo thumbnail | [pagoda-preview.webp](media/pagoda-preview.webp) | A voxel garden generated locally. |
| Coding demo video | [Pagoda.mp4](https://github.com/Niko1221/Strata/releases/download/v0.1.10/Pagoda.mp4) | Existing 49-second demo, documented with an RTX 5070, IQ3_S and 128K context. Keep it separate from the GUI and TUI screenshots. |
| Engine explanation | [how-it-works.svg](media/how-it-works.svg), [guess-and-check.svg](media/guess-and-check.svg) | Illustrations of the documented Flash-Next engine path, not proof that every model uses the same path. |
| Logo, high contrast | [strata-lockup-high-contrast.svg](../apps/host/public/brand/strata-lockup-high-contrast.svg) | Nostroma, for low-vision use on the light background. |
| Logo in context, light | [lockup-in-context-light.png](media/lockup-in-context-light.png) | The lockup on the light theme's own background. |
| Logo in context, dark | [lockup-in-context-dark.png](media/lockup-in-context-dark.png) | The lockup on the dark theme's own background. |

## Regenerating the lockups

The lockups in `apps/host/public/brand` carry the wordmark as outlines, so a font change does not
reach them. `apps/host/scripts/prepare-brand-lockups.py` draws them from
`apps/host/public/fonts/Exo2-Variable.woff2`. Regenerate rather than edit.

- `python3 apps/host/scripts/prepare-brand-lockups.py` rewrites the light, dark and high-contrast
  SVGs and prints the contrast of each theme against the app's own background.
- `--check` writes nothing: it compares the files on disk with what the script would draw and exits 1
  if any differs. It names the fontTools release the committed files were drawn with (`4.68.0`) next
  to the one that is running, because the way fontTools formats path numbers can change between
  releases.
- `--weights 400,700` draws every theme at each weight (`strata-lockup-light-400.svg` and so on;
  weight 700 keeps the plain file name). `--themes` picks themes, and `--update-manifest` refreshes
  the hashes and the method text in `source-manifest.json`. It also drops a lockup row whose file is
  gone, or whose name no longer matches a theme the script knows, and prints each one it drops.
- `--png` writes `strata-lockup-*.png` and `--preview` writes the in-context pictures above. PNG
  bytes depend on the Pillow build, so they are convenience exports and `--check` ignores them.
- `npm run brand:png-vs-svg` in `apps/host` renders each committed SVG in the local Chromium and
  diffs it against its PNG, so a picture that stopped matching its SVG fails here. It prints a skip
  line and exits 0 when no browser is installed, and takes `--max-channel` and `--max-share` to tune
  the tolerance. The `Brand lockups` job runs it as well, with the Chromium that Playwright installs
  on the runner.
- `--ink-left` is a trial offset for the wordmark. It needs `--out DIR`, so a trial never overwrites
  the committed files.

To change the word, edit `WORD` in the script, run it, run `--check`, then `--update-manifest`, and
commit the SVGs together with the script. The `Brand lockups` GitHub job runs `--check` on every
change to the brand folder, with fontTools pinned to `4.68.0`, so a stale SVG fails there too.

The script needs fontTools and Brotli, because the face ships as WOFF2. Pillow is needed only for
`--png` and `--preview`.

## Accuracy rules

- Use actual footage or label illustrations. Do not invent a successful install, generated answer or speed reading.
- Keep the provider preference distinct from measured performance. The maintainer's collaboration with ISTA-DASLab
  explains the recommendation order; it does not prove a benchmark result.
- Do not promise “any PC,” “every model,” or identical results across GPUs. Follow the model and hardware guides.
- For speed comparisons, use a source report with hardware, model, quantization, engine version and workload.
  Keep reasoning tokens, decode speed, prompt speed and time to first answer distinct.
- Local inference, internet downloads and connected tools are separate. Refer to [SAFETY.md](SAFETY.md) for privacy claims.
- Nostroma's MIT license does not replace the licenses of model weights, dependencies or other creators' work.
  Use the [credits and licensing guide](HOW_IT_WORKS.md#credits).

## Links and contact

- Project: [Niko1221/Strata](https://github.com/Niko1221/Strata)
- Downloads: [Releases](https://github.com/Niko1221/Strata/releases/latest)
- Support: [Buy Me a Coffee](https://buymeacoffee.com/strataengine)
- Sponsorships, hardware partnerships and collaborations: [niko.veit@outlook.com](mailto:niko.veit@outlook.com)
