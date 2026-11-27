<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="apps/host/public/brand/nostroma-lockup-dark.svg">
    <img src="apps/host/public/brand/nostroma-lockup-light.svg" alt="Nostroma" width="340">
  </picture>
</p>

<h3 align="center">Qwen3.8-Flash-Next em uma placa de vídeo que você já tem.</h3>
<p align="center">Um modelo de mistura de especialistas cujos pesos precisam de 37,6 GB, a serviço do app e das suas ferramentas de código.</p>

<p align="center">
  <a href="#what-it-is">O que é</a> · <a href="#models">Modelos</a> · <a href="#install"><b>Instalação</b></a> ·
  <a href="#hardware">Hardware</a> · <a href="#after-it-starts">Depois de iniciar</a> · <a href="#help">Ajuda</a>
</p>

<p align="center">
  <a href="https://github.com/earenbaz80/Nostroma/releases/latest"><img src="https://img.shields.io/github/v/release/earenbaz80/Nostroma?label=download&color=0ab887" alt="Baixar o Nostroma"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/earenbaz80/Nostroma" alt="Licença MIT"></a>
</p>

<p align="center"><sub><a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.de.md">Deutsch</a> · <a href="README.fr.md">Français</a> · <a href="README.es.md">Español</a> · <b>Português</b> · <a href="README.pl.md">Polski</a></sub></p>

<a id="what-it-is"></a>

## O que é

O Nostroma roda um modelo Qwen grande no seu próprio computador. Uma família de modelos, um motor feito para ela e três formas de usar: o app, o Terminal e uma API. Licença MIT, sem conta e sem cobrança por token. Ele responde em `127.0.0.1` a menos que você peça mais.

| Parte | O que você recebe |
| --- | --- |
| **O app** | Uma janela com o chat, seus arquivos e uma prévia ao vivo lado a lado. Um instalador por sistema, sem terminal. |
| **O Terminal** | O comando `nostroma`: instala um modelo, serve e acompanha. Scripts e agentes usam esta parte. |
| **O motor** | Compilações CUDA, HIP, SYCL e Metal do motor do modelo, e um servidor que fala as APIs da OpenAI e da Anthropic. |

O modelo é uma mistura de especialistas: só alguns especialistas trabalham em cada token. O motor mantém na memória os especialistas em uso e lê o resto do disco, então um conjunto de pesos de 37,6 GB roda em uma placa. O app e o servidor respondem da mesma máquina.

<a id="models"></a>

## Modelos

Dois modelos, um motor. Os dois são Qwen, e o primeiro é o assunto desta página.

<img src="docs/media/models/qwen.svg" width="22" alt="" align="middle"> &nbsp;**Qwen3.8-Flash-Next** é o principal. Os números são os pesos em RAM mais VRAM; deixe memória para o sistema e para outros programas.

| Tamanho | RAM + VRAM | Velocidade | Qualidade |
| --- | ---: | --- | --- |
| Q2_0 | 37.6 GB | o mais rápido | boa |
| IQ2_XS | 39.2 GB | rápido | melhor |
| IQ3_XXS | 47.0 GB | mais lento | muito boa |
| IQ3_S | 54.8 GB | o mais lento | a melhor; iguala o modelo completo nos testes publicados |

**Quem publica os arquivos.** Primeiro a ISTA-DASLab, depois a Unsloth e depois os outros. Com pouca memória, a instalação pode pré-selecionar outro tamanho: leia o plano antes de aceitar.

| Provedor | Opções |
| --- | --- |
| **ISTA-DASLab · recomendado** | Q2_0, IQ2_XS, IQ3_XXS, IQ3_S. [Coder: IQ1_M](docs/MODELS.md#coder), cerca de 32 GB, para código. |
| **Unsloth** | UD-IQ4_XS, UD-Q4_K_XL, UD-Q5_K_XL, UD-Q6_K_XL, Q8_0; de 72 a 136 GB com todos os especialistas em RAM. |
| **Gyro · agentionai** | [Gyro-S, Gyro-M](https://huggingface.co/agentionai/Qwen3.8-Flash-Next-Gyro-GGUF). Usa menos memória e é mais lento. |
| **Outras opções** | [Swift 1.5](docs/MODELS.md#swift-15), [NVFP4](docs/NVFP4.md), [OrcaRouter](docs/ORCA.md) |

[Comparar tamanhos, memória e compatibilidade](docs/MODELS.md) · [Escolher pela memória](docs/MODELS.md#pick-by-memory)

<img src="docs/media/models/qwen.svg" width="22" alt="" align="middle"> &nbsp;**Qwen3.6-35B-A3B** vem como UD-Q4_K_XL, UD-Q6_K_XL e Q8_0 da Unsloth, os pacotes documentados para este modelo. [Guia do modelo](docs/QWEN36.md).

<a id="install"></a>

## Instalação

### Aplicativo de desktop

**[Baixar o Nostroma para Windows ou Linux →](https://github.com/earenbaz80/Nostroma/releases/latest)**

<sub>`Nostroma-0.2.16-windows-x64-setup.exe` · `Nostroma-0.2.16-linux-x86_64.AppImage`</sub>

Instale o app, escolha um modelo e comece a conversar. O instalador não traz motor: no primeiro início o app baixa o da sua placa de vídeo. [Ajuda com o instalador](docs/INSTALL.md#the-app)

### Aplicativo de Terminal

Prefere um terminal? Instale o Nostroma e rode **`nostroma launch`**. **`nostroma launch --plan`** mostra o que ele faria e não muda nada.

**Linux**

```sh
curl -fsSL --connect-timeout 15 --max-time 120 https://github.com/earenbaz80/Nostroma/releases/latest/download/install.sh -o install.sh && sh install.sh
```

**Windows PowerShell (depois abra um terminal novo)**

```powershell
irm -TimeoutSec 120 https://github.com/earenbaz80/Nostroma/releases/latest/download/install.ps1 | iex
```

```sh
nostroma launch
```

Siga as instruções para baixar e iniciar um modelo. Com **`--yes --no-tui`** ele não pergunta nada, inicia o servidor, imprime o endereço e retorna. [Guia do Terminal](docs/TERMINAL_LAUNCH.md)

[Compilar do código-fonte](docs/SOURCE_INSTALL.md) · [Docker](docs/DOCKER.md) · [Guia de instalação completo](docs/INSTALL.md)

<a id="what-you-need"></a>
<a id="hardware"></a>

## Hardware

O instalador baixa o motor da placa que encontrar. Cada guia diz o que aquele backend precisa.

| Hardware suportado | Guia |
| --- | --- |
| **NVIDIA GeForce RTX série 20 / 30 / 40 / 50** | [Instalação NVIDIA](docs/INSTALL.md#what-you-need) |
| **AMD Radeon RX 7700 / 7800 / 7900, RX 9060 / 9070, AI PRO R9700** | [Instalação AMD](docs/AMD_HIP.md) |
| **AMD Radeon RX 6800 / 6900 · experimental** | [Instalação RX 6000](docs/AMD_HIP.md#rdna2-gfx1030) |
| **Intel Arc · Linux** | [Instalação Intel](docs/INTEL_ARC.md) |
| **AMD Ryzen AI Max · Strix Halo** | [Instalação Strix Halo](docs/STRIX_HALO.md) |
| **NVIDIA DGX Spark · Linux** | [Instalação DGX Spark](docs/DGX_SPARK_LINUX.md) |

<a id="after-it-starts"></a>

## Depois de iniciar

O servidor responde em `http://127.0.0.1:8080/v1` com as APIs da OpenAI e da Anthropic, então um programa que você já usa pode apontar para lá com qualquer chave de API.

- **`nostroma launch --status`** diz o que está servindo agora.
- **`nostroma launch --stop`** para o que o `launch` iniciou.
- **`nostroma launch --show-key`** imprime a chave de API, quando uma foi criada.
- **`nostroma launch --vision on`** deixa o modelo ler imagens, na placa de vídeo ou na CPU.

<a id="using-it"></a>

## Ferramentas

**Claude Code · Codex CLI · OpenCode · oh-my-pi · pi.dev · Hermes Agent · OpenClaw**, e qualquer outro programa que fale a API da OpenAI ou da Anthropic.

Rode **`nostroma connect`** para ver a configuração da sua ferramenta. **`nostroma connect <app> --check`** envia um prompt e uma chamada de ferramenta do jeito que aquele app faz. [Guia de conexão](docs/TERMINAL_LAUNCH.md#connect-your-apps-nostroma-connect)

<a id="how-does-it-work"></a>
<a id="help"></a>

## Ajuda

**Algo não funciona:** [Solução de problemas](docs/TROUBLESHOOTING.md) · [Relatar um bug](https://github.com/earenbaz80/Nostroma/issues/new/choose)

**Os números:** [velocidade medida](docs/DETAILS.md#speed-measured) · [benchmarks da comunidade](docs/COMMUNITY_BENCHMARKS.md) · [como funciona](docs/HOW_IT_WORKS.md)

**Participar:** [CONTRIBUTING.md](CONTRIBUTING.md) · [créditos e licenças dos modelos](docs/HOW_IT_WORKS.md#credits) · [privacidade](docs/SAFETY.md) · [licença MIT](LICENSE)

<sub>Todos os guias: [docs](docs) · Para ferramentas de IA e leitores automáticos: <a href="AGENTS.md">referência técnica</a> · <a href="docs/AI_SETUP.md">instruções de instalação</a>.</sub>
