<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="apps/host/public/brand/nostroma-lockup-dark.svg">
    <img src="apps/host/public/brand/nostroma-lockup-light.svg" alt="Nostroma" width="340">
  </picture>
</p>

<h3 align="center">Qwen3.8-Flash-Next on one graphics card you already own.</h3>
<p align="center">A mixture-of-experts model whose weights need 37.6 GB, served to the app and to your coding tools.</p>

<p align="center">
  <a href="#what-it-is">What it is</a> · <a href="#models">Models</a> · <a href="#install"><b>Install</b></a> ·
  <a href="#hardware">Hardware</a> · <a href="#after-it-starts">After it starts</a> · <a href="#help">Help</a>
</p>

<p align="center">
  <a href="https://github.com/earenbaz80/Nostroma/releases/latest"><img src="https://img.shields.io/github/v/release/earenbaz80/Nostroma?label=download&color=0ab887" alt="Download Nostroma"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/earenbaz80/Nostroma" alt="MIT license"></a>
</p>

<p align="center"><sub><b>English</b> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.de.md">Deutsch</a> · <a href="README.fr.md">Français</a> · <a href="README.es.md">Español</a> · <a href="README.pt-BR.md">Português</a> · <a href="README.pl.md">Polski</a></sub></p>

## What it is

Nostroma runs a large Qwen model on your own computer. One model family, one engine built for it, and three ways to use
it: the app, the Terminal and an API. MIT licensed, no account, no per-token bill. It answers on `127.0.0.1` unless you
ask for more.

| Part | What you get |
| --- | --- |
| **The app** | A window with the chat, your files and a live preview side by side. One installer per system, no terminal. |
| **The Terminal** | The `nostroma` command: it installs a model, serves it and watches it. Scripts and agents use this part. |
| **The engine** | CUDA, HIP, SYCL and Metal builds of the model engine, and a server that speaks the OpenAI and Anthropic APIs. |

The model is a mixture of experts: only a few experts work on any one token. The engine keeps the experts in use in memory
and reads the rest from disk, so a set of weights that needs 37.6 GB runs on one card. The app and the server answer from
the same machine.

## Models

Two models, one engine. Both are Qwen, and the first is the one this page is about.

<img src="docs/media/models/qwen.svg" width="22" alt="" align="middle"> &nbsp;**Qwen3.8-Flash-Next** is the main one. The
figures are the weights in RAM plus VRAM; leave memory for the system and for other programs.

| Size | RAM + VRAM | Speed | Quality |
| --- | ---: | --- | --- |
| Q2_0 | 37.6 GB | fastest | good |
| IQ2_XS | 39.2 GB | fast | better |
| IQ3_XXS | 47.0 GB | slower | great |
| IQ3_S | 54.8 GB | slowest | best; matches the full model on the published tests |

**Who publishes the files.** ISTA-DASLab first, then Unsloth, then the others. Setup can preselect another size at a low
memory tier, so read the plan before you agree to it.

| Provider | Choices |
| --- | --- |
| **ISTA-DASLab · recommended** | Q2_0, IQ2_XS, IQ3_XXS, IQ3_S. [Coder: IQ1_M](docs/MODELS.md#coder), around 32 GB, for code. |
| **Unsloth** | UD-IQ4_XS, UD-Q4_K_XL, UD-Q5_K_XL, UD-Q6_K_XL, Q8_0; 72 to 136 GB for all experts in RAM. |
| **Gyro · agentionai** | [Gyro-S, Gyro-M](https://huggingface.co/agentionai/Qwen3.8-Flash-Next-Gyro-GGUF). Uses less memory and is slower. |
| **Other options** | [Swift 1.5](docs/MODELS.md#swift-15), [NVFP4](docs/NVFP4.md), [OrcaRouter](docs/ORCA.md) |

[Compare sizes, memory needs and compatibility](docs/MODELS.md) · [Choose by memory](docs/MODELS.md#pick-by-memory)

<img src="docs/media/models/qwen.svg" width="22" alt="" align="middle"> &nbsp;**Qwen3.6-35B-A3B** comes as Unsloth's
UD-Q4_K_XL, UD-Q6_K_XL and Q8_0, the documented packs for this model. [Model guide](docs/QWEN36.md).

## Install

### Desktop app

**[Download Nostroma for Windows or Linux →](https://github.com/earenbaz80/Nostroma/releases/latest)**

<sub>`Nostroma-0.2.16-windows-x64-setup.exe` · `Nostroma-0.2.16-linux-x86_64.AppImage`</sub>

Install the app, choose a model, start chatting. The installer carries no engine: on first start the app downloads the one
for your graphics card. [Help with the installer](docs/INSTALL.md#the-app)

### Terminal app

Prefer a terminal? Install Nostroma, then run **`nostroma launch`**. **`nostroma launch --plan`** prints what it would do
and changes nothing.

**Linux**

```sh
curl -fsSL --connect-timeout 15 --max-time 120 https://github.com/earenbaz80/Nostroma/releases/latest/download/install.sh -o install.sh && sh install.sh
```

**Windows PowerShell** (then open a new terminal)

```powershell
irm -TimeoutSec 120 https://github.com/earenbaz80/Nostroma/releases/latest/download/install.ps1 | iex
```

```sh
nostroma launch
```

Follow the prompts to download and start a model. With **`--yes --no-tui`** it asks nothing, starts the server, prints the
address and returns. [Terminal guide](docs/TERMINAL_LAUNCH.md)

[Build from source](docs/SOURCE_INSTALL.md) · [Docker](docs/DOCKER.md) · [Full install guide](docs/INSTALL.md)

<a id="what-you-need"></a>

## Hardware

The installer downloads the engine for the card it finds. Each guide says what that backend needs.

| Supported hardware | Guide |
| --- | --- |
| **NVIDIA GeForce RTX 20 / 30 / 40 / 50 series** | [NVIDIA setup](docs/INSTALL.md#what-you-need) |
| **AMD Radeon RX 7700 / 7800 / 7900, RX 9060 / 9070, AI PRO R9700** | [AMD setup](docs/AMD_HIP.md) |
| **AMD Radeon RX 6800 / 6900 · experimental** | [RX 6000 setup](docs/AMD_HIP.md#rdna2-gfx1030) |
| **Intel Arc · Linux** | [Intel setup](docs/INTEL_ARC.md) |
| **AMD Ryzen AI Max · Strix Halo** | [Strix Halo setup](docs/STRIX_HALO.md) |
| **NVIDIA DGX Spark · Linux** | [DGX Spark setup](docs/DGX_SPARK_LINUX.md) |

## After it starts

The server answers on `http://127.0.0.1:8080/v1` with the OpenAI and Anthropic APIs, so a program you already use can
point at it with any API key.

- **`nostroma launch --status`** says what is serving now.
- **`nostroma launch --stop`** stops what `launch` started.
- **`nostroma launch --show-key`** prints the API key, when one was made.
- **`nostroma launch --vision on`** lets the model read pictures, on the graphics card or on the CPU.

<a id="using-it"></a>

## Tools

**Claude Code · Codex CLI · OpenCode · oh-my-pi · pi.dev · Hermes Agent · OpenClaw**, and any other program that speaks the
OpenAI or Anthropic API.

Run **`nostroma connect`** to see the setup for your tool. **`nostroma connect <app> --check`** sends one prompt and one
tool call the way that app does. [Connection guide](docs/TERMINAL_LAUNCH.md#connect-your-apps-nostroma-connect)

<a id="how-does-it-work"></a>

## Help

**Something does not work:** [Troubleshooting](docs/TROUBLESHOOTING.md) · [Report a bug](https://github.com/earenbaz80/Nostroma/issues/new/choose)

**The numbers:** [measured speed](docs/DETAILS.md#speed-measured) · [community benchmarks](docs/COMMUNITY_BENCHMARKS.md) · [how it works](docs/HOW_IT_WORKS.md)

**Taking part:** [CONTRIBUTING.md](CONTRIBUTING.md) · [credits and model licenses](docs/HOW_IT_WORKS.md#credits) · [privacy](docs/SAFETY.md) · [MIT license](LICENSE)

<sub>All guides: [docs](docs) · For AI tools and automated readers: <a href="AGENTS.md">technical reference</a> · <a href="docs/AI_SETUP.md">setup instructions</a>.</sub>
