<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="apps/host/public/brand/nostroma-lockup-dark.svg">
    <img src="apps/host/public/brand/nostroma-lockup-light.svg" alt="Nostroma" width="340">
  </picture>
</p>

<h3 align="center">IA potente en tu propio ordenador.</h3>
<p align="center">Chatea, programa y trabaja con imágenes, en local.</p>

<p align="center">
  <a href="#modelos">Modelos</a> · <a href="#instalación"><b>Instalación</b></a> ·
  <a href="#hardware">Hardware</a> · <a href="#herramientas">Herramientas</a> ·
  <a href="#ayuda">Ayuda</a> · <a href="#apoya-nostroma">Apoyar</a>
</p>

<p align="center">
  <a href="https://github.com/earenbaz80/Nostroma/releases/latest"><img src="https://img.shields.io/github/v/release/earenbaz80/Nostroma?label=download&color=0ab887" alt="Descargar Nostroma"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/earenbaz80/Nostroma" alt="Licencia MIT"></a>
</p>

<p align="center"><sub><a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.de.md">Deutsch</a> · <a href="README.fr.md">Français</a> · <b>Español</b> · <a href="README.pt-BR.md">Português</a> · <a href="README.pl.md">Polski</a></sub></p>

**Gratis, de código abierto y tuyo para ejecutar.** Usa Nostroma en tu escritorio o con tus herramientas de programación favoritas. No necesitas cuenta.

## Modelos

Recomendamos **primero ISTA-DASLab**, después **Unsloth** y otros proveedores, siempre que haya un modelo compatible que quepa en tu memoria.

<details>
<summary><img src="docs/media/models/qwen.svg" width="22" alt="" align="middle"> &nbsp;<b>Qwen3.8-Flash-Next</b></summary>

| Proveedor | Opciones |
| --- | --- |
| **ISTA-DASLab · recomendado** | Q2\_0, IQ2\_XS, IQ3\_XXS, IQ3\_S. [Coder: IQ1\_M](docs/MODELS.md#coder) para programar. |
| **Unsloth** | UD-IQ4\_XS, UD-Q4\_K\_XL, UD-Q5\_K\_XL, UD-Q6\_K\_XL, Q8\_0 |
| **Gyro · agentionai** | [Gyro-S, Gyro-M](https://huggingface.co/agentionai/Qwen3.8-Flash-Next-Gyro-GGUF). Usa menos memoria, pero es más lento. |
| **Otras opciones** | [Swift 1.5](docs/MODELS.md#swift-15), [NVFP4](docs/NVFP4.md), [OrcaRouter](docs/ORCA.md) |

[Compara tamaños, necesidades de memoria y compatibilidad](docs/MODELS.md).

</details>

<details>
<summary><img src="docs/media/models/qwen.svg" width="22" alt="" align="middle"> &nbsp;<b>Qwen3.6-35B-A3B</b></summary>

**Unsloth:** UD-Q4_K_XL, UD-Q6_K_XL, Q8_0. Son los paquetes documentados actualmente para este modelo.

[Guía del modelo y compatibilidad](docs/QWEN36.md).

</details>

<a id="the-other-sizes"></a>

¿No sabes qué cabe? [Elige un modelo para tu ordenador](docs/MODELS.md#pick-by-memory).

## Instalación

<a id="option-a-the-nostroma-app"></a>

### Aplicación de escritorio

**[Descargar Nostroma para Windows, Linux o Mac →](https://github.com/earenbaz80/Nostroma/releases/latest)**

Instala la aplicación, elige un modelo y empieza a chatear. Hay un instalador por sistema. En el primer arranque, la aplicación descarga el motor para tu tarjeta gráfica. [Ayuda con el instalador](docs/INSTALL.md#the-app).

<sub>Archivos: `Strata-0.2.15-windows-x64-setup.exe` · `Strata-0.2.15-linux-x86_64.AppImage` · `Strata-0.2.15-macos-arm64.dmg`</sub>

<p align="center">
  <img src="docs/media/app-chat.png" width="900" alt="Aplicación de escritorio de Nostroma con un chat y una vista previa del código en vivo, una junto a otra">
  <br><sub>Chat, archivos y vista previa en vivo en una sola ventana.</sub>
</p>

<a id="option-b-the-terminal-one-line"></a>

### Aplicación de Terminal

¿Prefieres la terminal? Instala Nostroma y ejecuta **`nostroma launch`**.

<details open>
<summary><b>Comandos de instalación</b></summary>

**Linux / Mac**

```sh
curl -fsSL --connect-timeout 15 --max-time 120 https://github.com/earenbaz80/Nostroma/releases/latest/download/install.sh -o install.sh && sh install.sh
```

**Windows PowerShell**

```powershell
irm -TimeoutSec 120 https://github.com/earenbaz80/Nostroma/releases/latest/download/install.ps1 | iex
```

En Windows, abre una terminal nueva después. Luego:

```sh
nostroma launch
```

Sigue las indicaciones para descargar e iniciar un modelo. [Guía del Terminal](docs/TERMINAL_LAUNCH.md).

</details>

<p align="center">
  <img src="docs/media/terminal-monitor.png" width="900" alt="Aplicación de Terminal de Nostroma con la actividad del modelo, la velocidad, la memoria y las peticiones recientes">
  <br><sub>Observa tu modelo y tu hardware mientras se ejecuta.</sub>
</p>

<a id="build-from-source"></a>

[Compilar desde el código fuente](docs/SOURCE_INSTALL.md) · [Docker](docs/DOCKER.md) · [Guía de instalación completa](docs/INSTALL.md)

<a id="what-you-need"></a>

## Hardware

| Hardware compatible | Guía |
| --- | --- |
| **NVIDIA GeForce RTX 20 / 30 / 40 / 50** | [Instalación en NVIDIA](docs/INSTALL.md#what-you-need) |
| **AMD Radeon RX 7700 / 7800 / 7900, RX 9060 / 9070, AI PRO R9700** | [Instalación en AMD](docs/AMD_HIP.md) |
| **AMD Radeon RX 6800 / 6900 · experimental** | [Instalación en RX 6000](docs/AMD_HIP.md#rdna2-gfx1030) |
| **Intel Arc · Linux** | [Instalación en Intel](docs/INTEL_ARC.md) |
| **Apple Silicon · M1 o posterior** | [Instalación en Mac](docs/MAC.md) |
| **AMD Ryzen AI Max · Strix Halo** | [Instalación en Strix Halo](docs/STRIX_HALO.md) |

<a id="using-it"></a>

## Herramientas

**Claude Code · Codex CLI · OpenCode · oh-my-pi · pi.dev · Hermes Agent · OpenClaw**, y más, mediante las API compatibles con OpenAI y Anthropic.

Ejecuta **`nostroma connect`** para ver las instrucciones de tu herramienta. [Guía de conexión](docs/TERMINAL_LAUNCH.md#connect-your-apps-nostroma-connect).

<a id="guides"></a>
<a id="how-fast-is-it"></a>
<a id="how-does-it-work"></a>
<a id="something-went-wrong"></a>

## Ayuda

[Todas las guías](docs) · [Solución de problemas](docs/TROUBLESHOOTING.md) · [Informar de un error](https://github.com/earenbaz80/Nostroma/issues/new/choose) ·
[Benchmarks](docs/COMMUNITY_BENCHMARKS.md) · [Cómo funciona](docs/HOW_IT_WORKS.md) · [Contribuir](CONTRIBUTING.md)

## Apoya Nostroma

### Apoyos fieles

Gracias a todas las personas que apoyan Nostroma.

<!-- supporters:start (one line per public supporter, newest last; copy a line and change the GitHub name in all four places) -->
<a href="https://github.com/ryan4yin"><img src="https://github.com/ryan4yin.png?size=96" width="48" height="48" alt="ryan4yin" title="ryan4yin"></a>
<a href="https://github.com/themactep"><img src="https://github.com/themactep.png?size=96" width="48" height="48" alt="themactep" title="themactep"></a>
<a href="https://github.com/macintog"><img src="https://github.com/macintog.png?size=96" width="48" height="48" alt="macintog" title="macintog"></a>
<a href="https://github.com/bisonbet"><img src="https://github.com/bisonbet.png?size=96" width="48" height="48" alt="bisonbet" title="bisonbet"></a>
<a href="https://github.com/vizv"><img src="https://github.com/vizv.png?size=96" width="48" height="48" alt="vizv" title="vizv"></a>
<a href="https://github.com/kod88vn"><img src="https://github.com/kod88vn.png?size=96" width="48" height="48" alt="kod88vn" title="kod88vn"></a>
<a href="https://github.com/seoulworker"><img src="https://github.com/seoulworker.png?size=96" width="48" height="48" alt="seoulworker" title="seoulworker"></a>
<a href="https://github.com/jackyini"><img src="https://github.com/jackyini.png?size=96" width="48" height="48" alt="jackyini" title="jackyini"></a>
<a href="https://github.com/router0mail"><img src="https://github.com/router0mail.png?size=96" width="48" height="48" alt="router0mail" title="router0mail"></a>
<!-- supporters:end -->

[Licencia MIT](LICENSE) · [Créditos y licencias de los modelos](docs/HOW_IT_WORKS.md#credits) · [Privacidad](docs/SAFETY.md)

<a id="option-c-let-your-ai-set-it-up"></a>

<sub>Para herramientas de IA y lectores automáticos: <a href="AGENTS.md">referencia técnica</a> · <a href="docs/AI_SETUP.md">instrucciones de instalación</a>.</sub>
