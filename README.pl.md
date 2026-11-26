<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="apps/host/public/brand/nostroma-lockup-dark.svg">
    <img src="apps/host/public/brand/nostroma-lockup-light.svg" alt="Nostroma" width="340">
  </picture>
</p>

<h3 align="center">Qwen3.8-Flash-Next na jednej karcie graficznej, którą już masz.</h3>
<p align="center">Model mieszaniny ekspertów, którego wagi potrzebują 37,6 GB — dla aplikacji i Twoich narzędzi do kodu.</p>

<p align="center">
  <a href="#what-it-is">Co to jest</a> · <a href="#models">Modele</a> · <a href="#install"><b>Instalacja</b></a> ·
  <a href="#hardware">Sprzęt</a> · <a href="#after-it-starts">Po starcie</a> · <a href="#help">Pomoc</a>
</p>

<p align="center">
  <a href="https://github.com/earenbaz80/Nostroma/releases/latest"><img src="https://img.shields.io/github/v/release/earenbaz80/Nostroma?label=download&color=0ab887" alt="Pobierz Nostromę"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/earenbaz80/Nostroma" alt="Licencja MIT"></a>
</p>

<p align="center"><sub><a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.de.md">Deutsch</a> · <a href="README.fr.md">Français</a> · <a href="README.es.md">Español</a> · <a href="README.pt-BR.md">Português</a> · <b>Polski</b></sub></p>

<a id="what-it-is"></a>

## Co to jest

Nostroma uruchamia duży model Qwen na Twoim własnym komputerze. Jedna rodzina modeli, jeden silnik napisany dla niej i trzy sposoby użycia: aplikacja, Terminal i API. Licencja MIT, bez konta i bez opłat za token. Odpowiada na `127.0.0.1`, dopóki nie poprosisz o więcej.

| Część | Co dostajesz |
| --- | --- |
| **Aplikacja** | Jedno okno z czatem, Twoimi plikami i podglądem na żywo obok siebie. Jeden instalator na system, bez terminala. |
| **Terminal** | Polecenie `nostroma`: instaluje model, udostępnia go i pilnuje. Skrypty i agenci korzystają z tej części. |
| **Silnik** | Wersje CUDA, HIP, SYCL i Metal silnika modelu oraz serwer mówiący API OpenAI i Anthropic. |

Model to mieszanina ekspertów: nad jednym tokenem pracuje tylko kilku ekspertów. Silnik trzyma używanych ekspertów w pamięci, a resztę czyta z dysku, więc zestaw wag potrzebujący 37,6 GB działa na jednej karcie. Aplikacja i serwer odpowiadają z tej samej maszyny.

<a id="models"></a>

## Modele

Dwa modele, jeden silnik. Oba to Qwen, a pierwszy jest bohaterem tej strony.

<img src="docs/media/models/qwen.svg" width="22" alt="" align="middle"> &nbsp;**Qwen3.8-Flash-Next** jest głównym modelem. Liczby to wagi w RAM plus VRAM; zostaw pamięć dla systemu i innych programów.

| Rozmiar | RAM + VRAM | Szybkość | Jakość |
| --- | ---: | --- | --- |
| Q2_0 | 37.6 GB | najszybszy | dobra |
| IQ2_XS | 39.2 GB | szybki | lepsza |
| IQ3_XXS | 47.0 GB | wolniejszy | bardzo dobra |
| IQ3_S | 54.8 GB | najwolniejszy | najlepsza; dorównuje pełnemu modelowi w opublikowanych testach |

**Kto publikuje pliki.** Najpierw ISTA-DASLab, potem Unsloth, potem pozostali. Przy małej pamięci instalacja może zaproponować inny rozmiar, więc przeczytaj plan, zanim się zgodzisz.

| Dostawca | Wybór |
| --- | --- |
| **ISTA-DASLab · polecany** | Q2_0, IQ2_XS, IQ3_XXS, IQ3_S. [Coder: IQ1_M](docs/MODELS.md#coder), około 32 GB, do kodu. |
| **Unsloth** | UD-IQ4_XS, UD-Q4_K_XL, UD-Q5_K_XL, UD-Q6_K_XL, Q8_0; od 72 do 136 GB, gdy wszyscy eksperci są w RAM. |
| **Gyro · agentionai** | [Gyro-S, Gyro-M](https://huggingface.co/agentionai/Qwen3.8-Flash-Next-Gyro-GGUF). Mniej pamięci, ale wolniej. |
| **Inne opcje** | [Swift 1.5](docs/MODELS.md#swift-15), [NVFP4](docs/NVFP4.md), [OrcaRouter](docs/ORCA.md) |

[Porównaj rozmiary, pamięć i zgodność](docs/MODELS.md) · [Wybierz według pamięci](docs/MODELS.md#pick-by-memory)

<img src="docs/media/models/qwen.svg" width="22" alt="" align="middle"> &nbsp;**Qwen3.6-35B-A3B** jest dostępny jako UD-Q4_K_XL, UD-Q6_K_XL i Q8_0 od Unsloth — to udokumentowane paczki dla tego modelu. [Przewodnik po modelu](docs/QWEN36.md).

<a id="install"></a>

## Instalacja

### Aplikacja desktopowa

**[Pobierz Nostromę dla Windows lub Linux →](https://github.com/earenbaz80/Nostroma/releases/latest)**

<sub>`Nostroma-0.2.16-windows-x64-setup.exe` · `Nostroma-0.2.16-linux-x86_64.AppImage`</sub>

Zainstaluj aplikację, wybierz model i zacznij rozmawiać. Instalator nie zawiera silnika: przy pierwszym starcie aplikacja pobiera ten dla Twojej karty graficznej. [Pomoc z instalatorem](docs/INSTALL.md#the-app)

### Aplikacja terminalowa

Wolisz terminal? Zainstaluj Nostromę i uruchom **`nostroma launch`**. **`nostroma launch --plan`** pokazuje, co by zrobił, i niczego nie zmienia.

**Linux**

```sh
curl -fsSL --connect-timeout 15 --max-time 120 https://github.com/earenbaz80/Nostroma/releases/latest/download/install.sh -o install.sh && sh install.sh
```

**Windows PowerShell (potem otwórz nowy terminal)**

```powershell
irm -TimeoutSec 120 https://github.com/earenbaz80/Nostroma/releases/latest/download/install.ps1 | iex
```

```sh
nostroma launch
```

Postępuj według podpowiedzi, aby pobrać i uruchomić model. Z **`--yes --no-tui`** nic nie pyta, uruchamia serwer, wypisuje adres i wraca. [Przewodnik po terminalu](docs/TERMINAL_LAUNCH.md)

[Zbuduj ze źródeł](docs/SOURCE_INSTALL.md) · [Docker](docs/DOCKER.md) · [Pełny przewodnik instalacji](docs/INSTALL.md)

<a id="what-you-need"></a>
<a id="hardware"></a>

## Sprzęt

Instalator pobiera silnik dla karty, którą znajdzie. Każdy przewodnik mówi, czego potrzebuje dany backend.

| Obsługiwany sprzęt | Przewodnik |
| --- | --- |
| **NVIDIA GeForce RTX seria 20 / 30 / 40 / 50** | [Konfiguracja NVIDIA](docs/INSTALL.md#what-you-need) |
| **AMD Radeon RX 7700 / 7800 / 7900, RX 9060 / 9070, AI PRO R9700** | [Konfiguracja AMD](docs/AMD_HIP.md) |
| **AMD Radeon RX 6800 / 6900 · eksperymentalnie** | [Konfiguracja RX 6000](docs/AMD_HIP.md#rdna2-gfx1030) |
| **Intel Arc · Linux** | [Konfiguracja Intel](docs/INTEL_ARC.md) |
| **AMD Ryzen AI Max · Strix Halo** | [Konfiguracja Strix Halo](docs/STRIX_HALO.md) |
| **NVIDIA DGX Spark · Linux** | [Konfiguracja DGX Spark](docs/DGX_SPARK_LINUX.md) |

<a id="after-it-starts"></a>

## Po starcie

Serwer odpowiada na `http://127.0.0.1:8080/v1` przez API OpenAI i Anthropic, więc program, którego już używasz, może wskazać na niego z dowolnym kluczem API.

- **`nostroma launch --status`** mówi, co teraz obsługuje żądania.
- **`nostroma launch --stop`** zatrzymuje to, co uruchomił `launch`.
- **`nostroma launch --show-key`** wypisuje klucz API, jeśli został utworzony.
- **`nostroma launch --vision on`** pozwala modelowi czytać obrazy, na karcie graficznej lub na CPU.

<a id="using-it"></a>

## Narzędzia

**Claude Code · Codex CLI · OpenCode · oh-my-pi · pi.dev · Hermes Agent · OpenClaw** oraz każdy inny program mówiący API OpenAI lub Anthropic.

Uruchom **`nostroma connect`**, aby zobaczyć konfigurację dla swojego narzędzia. **`nostroma connect <app> --check`** wysyła jeden prompt i jedno wywołanie narzędzia tak, jak robi to dana aplikacja. [Przewodnik po połączeniu](docs/TERMINAL_LAUNCH.md#connect-your-apps-nostroma-connect)

<a id="how-does-it-work"></a>
<a id="help"></a>

## Pomoc

**Coś nie działa:** [Rozwiązywanie problemów](docs/TROUBLESHOOTING.md) · [Zgłoś błąd](https://github.com/earenbaz80/Nostroma/issues/new/choose)

**Liczby:** [zmierzona szybkość](docs/DETAILS.md#speed-measured) · [testy społeczności](docs/COMMUNITY_BENCHMARKS.md) · [jak to działa](docs/HOW_IT_WORKS.md)

**Współtworzenie:** [CONTRIBUTING.md](CONTRIBUTING.md) · [podziękowania i licencje modeli](docs/HOW_IT_WORKS.md#credits) · [prywatność](docs/SAFETY.md) · [licencja MIT](LICENSE)

<sub>Wszystkie przewodniki: [docs](docs) · Dla narzędzi AI i czytników automatycznych: <a href="AGENTS.md">dokumentacja techniczna</a> · <a href="docs/AI_SETUP.md">instrukcja instalacji</a>.</sub>
