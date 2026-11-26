<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="apps/host/public/brand/nostroma-lockup-dark.svg">
    <img src="apps/host/public/brand/nostroma-lockup-light.svg" alt="Nostroma" width="340">
  </picture>
</p>

<h3 align="center">Qwen3.8-Flash-Next en una tarjeta gráfica que ya tienes.</h3>
<p align="center">Un modelo de mezcla de expertos cuyos pesos necesitan 37,6 GB, al servicio de la app y de tus herramientas de código.</p>

<p align="center">
  <a href="#what-it-is">Qué es</a> · <a href="#models">Modelos</a> · <a href="#install"><b>Instalación</b></a> ·
  <a href="#hardware">Hardware</a> · <a href="#after-it-starts">Cuando arranca</a> · <a href="#help">Ayuda</a>
</p>

<p align="center">
  <a href="https://github.com/earenbaz80/Nostroma/releases/latest"><img src="https://img.shields.io/github/v/release/earenbaz80/Nostroma?label=download&color=0ab887" alt="Descargar Nostroma"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/earenbaz80/Nostroma" alt="Licencia MIT"></a>
</p>

<p align="center"><sub><a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.de.md">Deutsch</a> · <a href="README.fr.md">Français</a> · <b>Español</b> · <a href="README.pt-BR.md">Português</a> · <a href="README.pl.md">Polski</a></sub></p>

<a id="what-it-is"></a>

## Qué es

Nostroma ejecuta un modelo Qwen grande en tu propio ordenador. Una familia de modelos, un motor hecho para ella y tres formas de usarla: la app, la Terminal y una API. Licencia MIT, sin cuenta y sin factura por token. Responde en `127.0.0.1` salvo que pidas más.

| Parte | Qué obtienes |
| --- | --- |
| **La app** | Una ventana con el chat, tus archivos y una vista previa en vivo, uno al lado del otro. Un instalador por sistema, sin terminal. |
| **La Terminal** | El comando `nostroma`: instala un modelo, lo sirve y lo vigila. Los scripts y los agentes usan esta parte. |
| **El motor** | Compilaciones CUDA, HIP, SYCL y Metal del motor del modelo, y un servidor que habla las API de OpenAI y de Anthropic. |

El modelo es una mezcla de expertos: en cada token trabajan unos pocos expertos. El motor mantiene en memoria los expertos en uso y lee el resto del disco, así que un juego de pesos de 37,6 GB corre en una tarjeta. La app y el servidor responden desde la misma máquina.

<a id="models"></a>

## Modelos

Dos modelos, un motor. Los dos son Qwen, y el primero es el de esta página.

<img src="docs/media/models/qwen.svg" width="22" alt="" align="middle"> &nbsp;**Qwen3.8-Flash-Next** es el principal. Las cifras son los pesos en RAM más VRAM; deja memoria para el sistema y para otros programas.

| Tamaño | RAM + VRAM | Velocidad | Calidad |
| --- | ---: | --- | --- |
| Q2_0 | 37.6 GB | el más rápido | buena |
| IQ2_XS | 39.2 GB | rápido | mejor |
| IQ3_XXS | 47.0 GB | más lento | muy buena |
| IQ3_S | 54.8 GB | el más lento | la mejor; iguala al modelo completo en las pruebas publicadas |

**Quién publica los archivos.** Primero ISTA-DASLab, después Unsloth y después los demás. Con poca memoria, la instalación puede preseleccionar otro tamaño: lee el plan antes de aceptar.

| Proveedor | Opciones |
| --- | --- |
| **ISTA-DASLab · recomendado** | Q2_0, IQ2_XS, IQ3_XXS, IQ3_S. [Coder: IQ1_M](docs/MODELS.md#coder), unos 32 GB, para código. |
| **Unsloth** | UD-IQ4_XS, UD-Q4_K_XL, UD-Q5_K_XL, UD-Q6_K_XL, Q8_0; de 72 a 136 GB con todos los expertos en RAM. |
| **Gyro · agentionai** | [Gyro-S, Gyro-M](https://huggingface.co/agentionai/Qwen3.8-Flash-Next-Gyro-GGUF). Usa menos memoria y es más lento. |
| **Otras opciones** | [Swift 1.5](docs/MODELS.md#swift-15), [NVFP4](docs/NVFP4.md), [OrcaRouter](docs/ORCA.md) |

[Comparar tamaños, memoria y compatibilidad](docs/MODELS.md) · [Elegir por memoria](docs/MODELS.md#pick-by-memory)

<img src="docs/media/models/qwen.svg" width="22" alt="" align="middle"> &nbsp;**Qwen3.6-35B-A3B** llega como UD-Q4_K_XL, UD-Q6_K_XL y Q8_0 de Unsloth, los paquetes documentados para este modelo. [Guía del modelo](docs/QWEN36.md).

<a id="install"></a>

## Instalación

### Aplicación de escritorio

**[Descargar Nostroma para Windows o Linux →](https://github.com/earenbaz80/Nostroma/releases/latest)**

<sub>`Nostroma-0.2.16-windows-x64-setup.exe` · `Nostroma-0.2.16-linux-x86_64.AppImage`</sub>

Instala la app, elige un modelo y empieza a chatear. El instalador no trae motor: en el primer arranque la app descarga el de tu tarjeta gráfica. [Ayuda con el instalador](docs/INSTALL.md#the-app)

### Aplicación de Terminal

¿Prefieres una terminal? Instala Nostroma y ejecuta **`nostroma launch`**. **`nostroma launch --plan`** muestra lo que haría y no cambia nada.

**Linux**

```sh
curl -fsSL --connect-timeout 15 --max-time 120 https://github.com/earenbaz80/Nostroma/releases/latest/download/install.sh -o install.sh && sh install.sh
```

**Windows PowerShell (después abre una terminal nueva)**

```powershell
irm -TimeoutSec 120 https://github.com/earenbaz80/Nostroma/releases/latest/download/install.ps1 | iex
```

```sh
nostroma launch
```

Sigue las indicaciones para descargar y arrancar un modelo. Con **`--yes --no-tui`** no pregunta nada, arranca el servidor, imprime la dirección y vuelve. [Guía de la Terminal](docs/TERMINAL_LAUNCH.md)

[Compilar desde el código](docs/SOURCE_INSTALL.md) · [Docker](docs/DOCKER.md) · [Guía de instalación completa](docs/INSTALL.md)

<a id="what-you-need"></a>
<a id="hardware"></a>

## Hardware

El instalador descarga el motor de la tarjeta que encuentra. Cada guía dice qué necesita ese backend.

| Hardware compatible | Guía |
| --- | --- |
| **NVIDIA GeForce RTX serie 20 / 30 / 40 / 50** | [Instalación NVIDIA](docs/INSTALL.md#what-you-need) |
| **AMD Radeon RX 7700 / 7800 / 7900, RX 9060 / 9070, AI PRO R9700** | [Instalación AMD](docs/AMD_HIP.md) |
| **AMD Radeon RX 6800 / 6900 · experimental** | [Instalación RX 6000](docs/AMD_HIP.md#rdna2-gfx1030) |
| **Intel Arc · Linux** | [Instalación Intel](docs/INTEL_ARC.md) |
| **AMD Ryzen AI Max · Strix Halo** | [Instalación Strix Halo](docs/STRIX_HALO.md) |
| **NVIDIA DGX Spark · Linux** | [Instalación DGX Spark](docs/DGX_SPARK_LINUX.md) |

<a id="after-it-starts"></a>

## Cuando arranca

El servidor responde en `http://127.0.0.1:8080/v1` con las API de OpenAI y de Anthropic, así que un programa que ya usas puede apuntar ahí con cualquier clave de API.

- **`nostroma launch --status`** dice qué está sirviendo ahora.
- **`nostroma launch --stop`** detiene lo que arrancó `launch`.
- **`nostroma launch --show-key`** imprime la clave de API, si se creó una.
- **`nostroma launch --vision on`** deja que el modelo lea imágenes, en la tarjeta gráfica o en la CPU.

<a id="using-it"></a>

## Herramientas

**Claude Code · Codex CLI · OpenCode · oh-my-pi · pi.dev · Hermes Agent · OpenClaw**, y cualquier otro programa que hable la API de OpenAI o de Anthropic.

Ejecuta **`nostroma connect`** para ver la configuración de tu herramienta. **`nostroma connect <app> --check`** envía un prompt y una llamada de herramienta tal como lo hace esa app. [Guía de conexión](docs/TERMINAL_LAUNCH.md#connect-your-apps-nostroma-connect)

<a id="how-does-it-work"></a>
<a id="help"></a>

## Ayuda

**Algo no funciona:** [Solución de problemas](docs/TROUBLESHOOTING.md) · [Informar de un error](https://github.com/earenbaz80/Nostroma/issues/new/choose)

**Los números:** [velocidad medida](docs/DETAILS.md#speed-measured) · [benchmarks de la comunidad](docs/COMMUNITY_BENCHMARKS.md) · [cómo funciona](docs/HOW_IT_WORKS.md)

**Participar:** [CONTRIBUTING.md](CONTRIBUTING.md) · [créditos y licencias de los modelos](docs/HOW_IT_WORKS.md#credits) · [privacidad](docs/SAFETY.md) · [licencia MIT](LICENSE)

<sub>Todas las guías: [docs](docs) · Para herramientas de IA y lectores automáticos: <a href="AGENTS.md">referencia técnica</a> · <a href="docs/AI_SETUP.md">instrucciones de instalación</a>.</sub>
