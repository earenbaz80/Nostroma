<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="apps/host/public/brand/nostroma-lockup-dark.svg">
    <img src="apps/host/public/brand/nostroma-lockup-light.svg" alt="Nostroma" width="340">
  </picture>
</p>

<h3 align="center">Qwen3.8-Flash-Next na jednej karcie graficznej, którą już masz.</h3>
<p align="center">Model mieszaniny ekspertów, którego wagi potrzebują 37,6 GB — dla aplikacji i Twoich narzędzi do kodu.</p>

<p align="center">
  <a href="#modele">Modele</a> · <a href="#instalacja"><b>Instalacja</b></a> ·
  <a href="#sprzęt">Sprzęt</a> · <a href="#narzędzia">Narzędzia</a> ·
  <a href="#pomoc">Pomoc</a>
</p>

<p align="center">
  <a href="https://github.com/earenbaz80/Nostroma/releases/latest"><img src="https://img.shields.io/github/v/release/earenbaz80/Nostroma?label=download&color=0ab887" alt="Pobierz Nostromę"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/earenbaz80/Nostroma" alt="Licencja MIT"></a>
</p>

<p align="center"><sub><a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.de.md">Deutsch</a> · <a href="README.fr.md">Français</a> · <a href="README.es.md">Español</a> · <a href="README.pt-BR.md">Português</a> · <b>Polski</b></sub></p>

**Bezpłatna, z otwartym kodem źródłowym i do uruchomienia u siebie.** Używaj Straty na swoim komputerze albo razem z ulubionymi narzędziami do programowania. Konto nie jest potrzebne.

## Modele

Dwa modele, jeden silnik. Oba to Qwen; dostawcy są poniżej — najpierw ISTA-DASLab, potem Unsloth.

<details>
<summary><img src="docs/media/models/qwen.svg" width="22" alt="" align="middle"> &nbsp;<b>Qwen3.8-Flash-Next</b></summary>

| Dostawca | Do wyboru |
| --- | --- |
| **ISTA-DASLab · polecany** | Q2\_0, IQ2\_XS, IQ3\_XXS, IQ3\_S. [Coder: IQ1\_M](docs/MODELS.md#coder) do programowania. |
| **Unsloth** | UD-IQ4\_XS, UD-Q4\_K\_XL, UD-Q5\_K\_XL, UD-Q6\_K\_XL, Q8\_0 |
| **Gyro · agentionai** | [Gyro-S, Gyro-M](https://huggingface.co/agentionai/Qwen3.8-Flash-Next-Gyro-GGUF). Zużywa mniej pamięci, ale działa wolniej. |
| **Inne opcje** | [Swift 1.5](docs/MODELS.md#swift-15), [NVFP4](docs/NVFP4.md), [OrcaRouter](docs/ORCA.md) |

[Porównaj rozmiary, wymagania pamięciowe i zgodność](docs/MODELS.md).

</details>

<details>
<summary><img src="docs/media/models/qwen.svg" width="22" alt="" align="middle"> &nbsp;<b>Qwen3.6-35B-A3B</b></summary>

**Unsloth:** UD-Q4_K_XL, UD-Q6_K_XL, Q8_0. To obecnie udokumentowane pakiety dla tego modelu.

[Przewodnik po modelu i zgodność](docs/QWEN36.md).

</details>

Nie wiesz, co się zmieści? [Wybierz model do swojego komputera](docs/MODELS.md#pick-by-memory).

## Instalacja

### Aplikacja na komputer

**[Pobierz Nostromę dla Windows, Linuxa →](https://github.com/earenbaz80/Nostroma/releases/latest)**

Zainstaluj aplikację, wybierz model i zacznij rozmawiać. Dla każdego systemu jest jeden instalator. Przy pierwszym
uruchomieniu aplikacja pobiera silnik dla twojej karty graficznej. [Pomoc z instalatorem](docs/INSTALL.md#the-app).

<sub>Pliki: `Nostroma-0.2.16-windows-x64-setup.exe` · `Nostroma-0.2.16-linux-x86_64.AppImage`</sub>

### Aplikacja Terminal

Wolisz terminal? Zainstaluj Nostromę, a potem uruchom **`nostroma launch`**.

<details open>
<summary><b>Polecenia instalacji</b></summary>

**Linux**

```sh
curl -fsSL --connect-timeout 15 --max-time 120 https://github.com/earenbaz80/Nostroma/releases/latest/download/install.sh -o install.sh && sh install.sh
```

**Windows PowerShell**

```powershell
irm -TimeoutSec 120 https://github.com/earenbaz80/Nostroma/releases/latest/download/install.ps1 | iex
```

W Windows otwórz potem nowe okno terminala. Następnie:

```sh
nostroma launch
```

Postępuj zgodnie z podpowiedziami, aby pobrać i uruchomić model. [Przewodnik po Terminalu](docs/TERMINAL_LAUNCH.md).

</details>

[Budowanie ze źródeł](docs/SOURCE_INSTALL.md) · [Docker](docs/DOCKER.md) · [Pełny przewodnik instalacji](docs/INSTALL.md)

<a id="what-you-need"></a>

## Sprzęt

| Obsługiwany sprzęt | Przewodnik |
| --- | --- |
| **NVIDIA GeForce RTX serii 20 / 30 / 40 / 50** | [Konfiguracja NVIDIA](docs/INSTALL.md#what-you-need) |
| **AMD Radeon RX 7700 / 7800 / 7900, RX 9060 / 9070, AI PRO R9700** | [Konfiguracja AMD](docs/AMD_HIP.md) |
| **AMD Radeon RX 6800 / 6900 · eksperymentalnie** | [Konfiguracja RX 6000](docs/AMD_HIP.md#rdna2-gfx1030) |
| **Intel Arc · Linux** | [Konfiguracja Intel](docs/INTEL_ARC.md) |
| **AMD Ryzen AI Max · Strix Halo** | [Konfiguracja Strix Halo](docs/STRIX_HALO.md) |

<a id="using-it"></a>

## Narzędzia

**Claude Code · Codex CLI · OpenCode · oh-my-pi · pi.dev · Hermes Agent · OpenClaw** i inne — przez API zgodne z OpenAI i Anthropic.

Uruchom **`nostroma connect`**, aby zobaczyć instrukcję konfiguracji dla swojego narzędzia. [Przewodnik po połączeniach](docs/TERMINAL_LAUNCH.md#connect-your-apps-nostroma-connect).

<a id="how-does-it-work"></a>

## Pomoc

**Coś nie działa:** [Rozwiązywanie problemów](docs/TROUBLESHOOTING.md) · [Zgłoś błąd](https://github.com/earenbaz80/Nostroma/issues/new/choose)

**Liczby:** [zmierzona szybkość](docs/DETAILS.md#speed-measured) · [testy społeczności](docs/COMMUNITY_BENCHMARKS.md) · [jak to działa](docs/HOW_IT_WORKS.md)

**Współtworzenie:** [CONTRIBUTING.md](CONTRIBUTING.md) · [podziękowania i licencje modeli](docs/HOW_IT_WORKS.md#credits) · [prywatność](docs/SAFETY.md) · [licencja MIT](LICENSE)

<sub>Wszystkie przewodniki: [docs](docs) · Dla narzędzi AI i czytników automatycznych: <a href="AGENTS.md">dokumentacja techniczna</a> · <a href="docs/AI_SETUP.md">instrukcja instalacji</a>.</sub>

<sub>Dla narzędzi AI i automatycznych czytników: <a href="AGENTS.md">dokumentacja techniczna</a> · <a href="docs/AI_SETUP.md">instrukcja instalacji</a>.</sub>
