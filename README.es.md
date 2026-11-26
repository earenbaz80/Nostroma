<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="apps/host/public/brand/nostroma-lockup-dark.svg">
    <img src="apps/host/public/brand/nostroma-lockup-light.svg" alt="Nostroma" width="340">
  </picture>
</p>

<h3 align="center">Qwen3.8-Flash-Next en una tarjeta gráfica que ya tienes.</h3>
<p align="center">Un modelo de mezcla de expertos cuyos pesos necesitan 37,6 GB, al servicio de la app y de tus herramientas de código.</p>

<p align="center">
  <a href="#modelos">Modelos</a> · <a href="#instalación"><b>Instalación</b></a> ·
  <a href="#hardware">Hardware</a> · <a href="#herramientas">Herramientas</a> ·
  <a href="#ayuda">Ayuda</a>
</p>

<p align="center">
  <a href="https://github.com/earenbaz80/Nostroma/releases/latest"><img src="https://img.shields.io/github/v/release/earenbaz80/Nostroma?label=download&color=0ab887" alt="Descargar Nostroma"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/earenbaz80/Nostroma" alt="Licencia MIT"></a>
</p>

<p align="center"><sub><a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.de.md">Deutsch</a> · <a href="README.fr.md">Français</a> · <b>Español</b> · <a href="README.pt-BR.md">Português</a> · <a href="README.pl.md">Polski</a></sub></p>

**Gratis, de código abierto y tuyo para ejecutar.** Usa Nostroma en tu escritorio o con tus herramientas de programación favoritas. No necesitas cuenta.

## Modelos

Dos modelos, un motor. Los dos son Qwen; abajo están los proveedores, primero ISTA-DASLab, después Unsloth.

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

¿No sabes qué cabe? [Elige un modelo para tu ordenador](docs/MODELS.md#pick-by-memory).

## Instalación

### Aplicación de escritorio

**[Descargar Nostroma para Windows o Linux →](https://github.com/earenbaz80/Nostroma/releases/latest)**

Instala la aplicación, elige un modelo y empieza a chatear. Hay un instalador por sistema. En el primer arranque, la aplicación descarga el motor para tu tarjeta gráfica. [Ayuda con el instalador](docs/INSTALL.md#the-app).

<sub>Archivos: `Nostroma-0.2.16-windows-x64-setup.exe` · `Nostroma-0.2.16-linux-x86_64.AppImage`</sub>

### Aplicación de Terminal

¿Prefieres la terminal? Instala Nostroma y ejecuta **`nostroma launch`**.

<details open>
<summary><b>Comandos de instalación</b></summary>

**Linux**

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

[Compilar desde el código fuente](docs/SOURCE_INSTALL.md) · [Docker](docs/DOCKER.md) · [Guía de instalación completa](docs/INSTALL.md)

<a id="what-you-need"></a>

## Hardware

| Hardware compatible | Guía |
| --- | --- |
| **NVIDIA GeForce RTX 20 / 30 / 40 / 50** | [Instalación en NVIDIA](docs/INSTALL.md#what-you-need) |
| **AMD Radeon RX 7700 / 7800 / 7900, RX 9060 / 9070, AI PRO R9700** | [Instalación en AMD](docs/AMD_HIP.md) |
| **AMD Radeon RX 6800 / 6900 · experimental** | [Instalación en RX 6000](docs/AMD_HIP.md#rdna2-gfx1030) |
| **Intel Arc · Linux** | [Instalación en Intel](docs/INTEL_ARC.md) |
| **AMD Ryzen AI Max · Strix Halo** | [Instalación en Strix Halo](docs/STRIX_HALO.md) |

<a id="using-it"></a>

## Herramientas

**Claude Code · Codex CLI · OpenCode · oh-my-pi · pi.dev · Hermes Agent · OpenClaw**, y más, mediante las API compatibles con OpenAI y Anthropic.

Ejecuta **`nostroma connect`** para ver las instrucciones de tu herramienta. [Guía de conexión](docs/TERMINAL_LAUNCH.md#connect-your-apps-nostroma-connect).

<a id="how-does-it-work"></a>

## Ayuda

**Algo no funciona:** [Solución de problemas](docs/TROUBLESHOOTING.md) · [Informar de un error](https://github.com/earenbaz80/Nostroma/issues/new/choose)

**Los números:** [velocidad medida](docs/DETAILS.md#speed-measured) · [benchmarks de la comunidad](docs/COMMUNITY_BENCHMARKS.md) · [cómo funciona](docs/HOW_IT_WORKS.md)

**Participar:** [CONTRIBUTING.md](CONTRIBUTING.md) · [créditos y licencias de los modelos](docs/HOW_IT_WORKS.md#credits) · [privacidad](docs/SAFETY.md) · [licencia MIT](LICENSE)

<sub>Todas las guías: [docs](docs) · Para herramientas de IA y lectores automáticos: <a href="AGENTS.md">referencia técnica</a> · <a href="docs/AI_SETUP.md">instrucciones de instalación</a>.</sub>

<sub>Para herramientas de IA y lectores automáticos: <a href="AGENTS.md">referencia técnica</a> · <a href="docs/AI_SETUP.md">instrucciones de instalación</a>.</sub>
