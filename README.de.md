<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="apps/host/public/brand/nostroma-lockup-dark.svg">
    <img src="apps/host/public/brand/nostroma-lockup-light.svg" alt="Nostroma" width="340">
  </picture>
</p>

<h3 align="center">Qwen3.8-Flash-Next auf einer Grafikkarte, die du schon hast.</h3>
<p align="center">Ein Mixture-of-Experts-Modell, dessen Gewichte 37,6 GB brauchen — für die App und für deine Coding-Tools.</p>

<p align="center">
  <a href="#what-it-is">Was es ist</a> · <a href="#models">Modelle</a> · <a href="#install"><b>Installation</b></a> ·
  <a href="#hardware">Hardware</a> · <a href="#after-it-starts">Nach dem Start</a> · <a href="#help">Hilfe</a>
</p>

<p align="center">
  <a href="https://github.com/earenbaz80/Nostroma/releases/latest"><img src="https://img.shields.io/github/v/release/earenbaz80/Nostroma?label=download&color=0ab887" alt="Nostroma herunterladen"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/earenbaz80/Nostroma" alt="MIT-Lizenz"></a>
</p>

<p align="center"><sub><a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <b>Deutsch</b> · <a href="README.fr.md">Français</a> · <a href="README.es.md">Español</a> · <a href="README.pt-BR.md">Português</a> · <a href="README.pl.md">Polski</a></sub></p>

<a id="what-it-is"></a>

## Was es ist

Nostroma betreibt ein großes Qwen-Modell auf deinem eigenen Computer. Eine Modellfamilie, eine eigens dafür gebaute Engine und drei Wege, sie zu nutzen: die App, das Terminal und eine API. MIT-Lizenz, kein Konto, keine Abrechnung pro Token. Es antwortet auf `127.0.0.1`, solange du nicht mehr verlangst.

| Teil | Was du bekommst |
| --- | --- |
| **Die App** | Ein Fenster mit dem Chat, deinen Dateien und einer Live-Vorschau nebeneinander. Ein Installer pro System, kein Terminal. |
| **Das Terminal** | Der Befehl `nostroma`: er installiert ein Modell, stellt es bereit und überwacht es. Skripte und Agenten nutzen diesen Teil. |
| **Die Engine** | CUDA-, HIP-, SYCL- und Metal-Builds der Modell-Engine und ein Server, der die OpenAI- und die Anthropic-API spricht. |

Das Modell ist ein Mixture of Experts: an einem Token arbeiten nur wenige Experten. Die Engine hält die gerade genutzten Experten im Speicher und liest den Rest von der Platte, deshalb läuft eine Gewichtsmenge von 37,6 GB auf einer Karte. App und Server antworten von derselben Maschine.

<a id="models"></a>

## Modelle

Zwei Modelle, eine Engine. Beide sind Qwen, und das erste ist das, um das es auf dieser Seite geht.

<img src="docs/media/models/qwen.svg" width="22" alt="" align="middle"> &nbsp;**Qwen3.8-Flash-Next** ist das wichtigste. Die Zahlen sind die Gewichte in RAM plus VRAM; lass Speicher für das System und andere Programme frei.

| Größe | RAM + VRAM | Tempo | Qualität |
| --- | ---: | --- | --- |
| Q2_0 | 37.6 GB | am schnellsten | gut |
| IQ2_XS | 39.2 GB | schnell | besser |
| IQ3_XXS | 47.0 GB | langsamer | sehr gut |
| IQ3_S | 54.8 GB | am langsamsten | am besten; in den veröffentlichten Tests gleichauf mit dem vollen Modell |

**Wer die Dateien veröffentlicht.** Zuerst ISTA-DASLab, dann Unsloth, dann die anderen. Bei wenig Speicher kann die Einrichtung eine andere Größe vorschlagen; lies den Plan, bevor du zustimmst.

| Anbieter | Auswahl |
| --- | --- |
| **ISTA-DASLab · empfohlen** | Q2_0, IQ2_XS, IQ3_XXS, IQ3_S. [Coder: IQ1_M](docs/MODELS.md#coder), rund 32 GB, zum Programmieren. |
| **Unsloth** | UD-IQ4_XS, UD-Q4_K_XL, UD-Q5_K_XL, UD-Q6_K_XL, Q8_0; 72 bis 136 GB, wenn alle Experten im RAM liegen. |
| **Gyro · agentionai** | [Gyro-S, Gyro-M](https://huggingface.co/agentionai/Qwen3.8-Flash-Next-Gyro-GGUF). Braucht weniger Speicher und ist langsamer. |
| **Weitere Optionen** | [Swift 1.5](docs/MODELS.md#swift-15), [NVFP4](docs/NVFP4.md), [OrcaRouter](docs/ORCA.md) |

[Größen, Speicherbedarf und Kompatibilität vergleichen](docs/MODELS.md) · [Nach Speicher wählen](docs/MODELS.md#pick-by-memory)

<img src="docs/media/models/qwen.svg" width="22" alt="" align="middle"> &nbsp;**Qwen3.6-35B-A3B** gibt es als UD-Q4_K_XL, UD-Q6_K_XL und Q8_0 von Unsloth, die dokumentierten Pakete für dieses Modell. [Modell-Leitfaden](docs/QWEN36.md).

<a id="install"></a>

## Installation

### Desktop-App

**[Nostroma für Windows oder Linux herunterladen →](https://github.com/earenbaz80/Nostroma/releases/latest)**

<sub>`Nostroma-0.2.16-windows-x64-setup.exe` · `Nostroma-0.2.16-linux-x86_64.AppImage`</sub>

Installiere die App, wähle ein Modell und leg mit dem Chat los. Der Installer bringt keine Engine mit: beim ersten Start lädt die App die passende für deine Grafikkarte. [Hilfe zum Installer](docs/INSTALL.md#the-app)

<p align="center">
  <img src="docs/media/app-chat.png" width="900" alt="Die Nostroma-App nach der Installation: links die Chatliste, in der Mitte eine neue Unterhaltung mit ihren ersten Schritten, unten das Eingabefeld">
  <br><sub>Die App beim ersten Start, bevor ein Modell gewählt ist.</sub>
</p>

### Terminal-App

Lieber ein Terminal? Installiere Nostroma und führe **`nostroma launch`** aus. **`nostroma launch --plan`** zeigt, was es tun würde, und ändert nichts.

**Linux**

```sh
curl -fsSL --connect-timeout 15 --max-time 120 https://github.com/earenbaz80/Nostroma/releases/latest/download/install.sh -o install.sh && sh install.sh
```

**Windows PowerShell (danach ein neues Terminal öffnen)**

```powershell
irm -TimeoutSec 120 https://github.com/earenbaz80/Nostroma/releases/latest/download/install.ps1 | iex
```

```sh
nostroma launch
```

Folge den Hinweisen, um ein Modell herunterzuladen und zu starten. Mit **`--yes --no-tui`** fragt es nichts, startet den Server, druckt die Adresse und kehrt zurück. [Terminal-Leitfaden](docs/TERMINAL_LAUNCH.md)

[Aus dem Quellcode bauen](docs/SOURCE_INSTALL.md) · [Docker](docs/DOCKER.md) · [Vollständige Installationsanleitung](docs/INSTALL.md)

<a id="what-you-need"></a>
<a id="hardware"></a>

## Hardware

Der Installer lädt die Engine für die Karte, die er findet. Jeder Leitfaden sagt, was dieser Backend braucht.

| Unterstützte Hardware | Leitfaden |
| --- | --- |
| **NVIDIA GeForce RTX 20 / 30 / 40 / 50 Serie** | [NVIDIA-Setup](docs/INSTALL.md#what-you-need) |
| **AMD Radeon RX 7700 / 7800 / 7900, RX 9060 / 9070, AI PRO R9700** | [AMD-Setup](docs/AMD_HIP.md) |
| **AMD Radeon RX 6800 / 6900 · experimentell** | [RX-6000-Setup](docs/AMD_HIP.md#rdna2-gfx1030) |
| **Intel Arc · Linux** | [Intel-Setup](docs/INTEL_ARC.md) |
| **AMD Ryzen AI Max · Strix Halo** | [Strix-Halo-Setup](docs/STRIX_HALO.md) |
| **NVIDIA DGX Spark · Linux** | [DGX-Spark-Setup](docs/DGX_SPARK_LINUX.md) |

<a id="after-it-starts"></a>

## Nach dem Start

Der Server antwortet auf `http://127.0.0.1:8080/v1` mit der OpenAI- und der Anthropic-API; ein Programm, das du schon nutzt, kann mit beliebigem API-Schlüssel darauf zeigen.

- **`nostroma launch --status`** sagt, was gerade dient.
- **`nostroma launch --stop`** stoppt, was `launch` gestartet hat.
- **`nostroma launch --show-key`** druckt den API-Schlüssel, wenn einer erzeugt wurde.
- **`nostroma launch --vision on`** lässt das Modell Bilder lesen, auf der Grafikkarte oder auf der CPU.

<a id="using-it"></a>

## Tools

**Claude Code · Codex CLI · OpenCode · oh-my-pi · pi.dev · Hermes Agent · OpenClaw** und jedes andere Programm, das die OpenAI- oder die Anthropic-API spricht.

Führe **`nostroma connect`** aus, um die Einrichtung für dein Tool zu sehen. **`nostroma connect <app> --check`** schickt einen Prompt und einen Tool-Aufruf so, wie diese App es tut. [Verbindungsleitfaden](docs/TERMINAL_LAUNCH.md#connect-your-apps-nostroma-connect)

<a id="how-does-it-work"></a>
<a id="help"></a>

## Hilfe

**Etwas funktioniert nicht:** [Fehlerbehebung](docs/TROUBLESHOOTING.md) · [Fehler melden](https://github.com/earenbaz80/Nostroma/issues/new/choose)

**Die Zahlen:** [gemessene Geschwindigkeit](docs/DETAILS.md#speed-measured) · [Community-Benchmarks](docs/COMMUNITY_BENCHMARKS.md) · [wie es funktioniert](docs/HOW_IT_WORKS.md)

**Mitmachen:** [CONTRIBUTING.md](CONTRIBUTING.md) · [Danksagungen und Modelllizenzen](docs/HOW_IT_WORKS.md#credits) · [Datenschutz](docs/SAFETY.md) · [MIT-Lizenz](LICENSE)

<sub>Alle Anleitungen: [docs](docs) · Für KI-Werkzeuge und automatisierte Leser: <a href="AGENTS.md">technische Referenz</a> · <a href="docs/AI_SETUP.md">Einrichtung</a>.</sub>
