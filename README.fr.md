<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="apps/host/public/brand/nostroma-lockup-dark.svg">
    <img src="apps/host/public/brand/nostroma-lockup-light.svg" alt="Nostroma" width="340">
  </picture>
</p>

<h3 align="center">Qwen3.8-Flash-Next sur une carte graphique que vous possédez déjà.</h3>
<p align="center">Un modèle à mélange d'experts dont les poids demandent 37,6 Go, au service de l'app et de vos outils de code.</p>

<p align="center">
  <a href="#what-it-is">Présentation</a> · <a href="#models">Modèles</a> · <a href="#install"><b>Installation</b></a> ·
  <a href="#hardware">Matériel</a> · <a href="#after-it-starts">Après le démarrage</a> · <a href="#help">Aide</a>
</p>

<p align="center">
  <a href="https://github.com/earenbaz80/Nostroma/releases/latest"><img src="https://img.shields.io/github/v/release/earenbaz80/Nostroma?label=download&color=0ab887" alt="Télécharger Nostroma"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/earenbaz80/Nostroma" alt="Licence MIT"></a>
</p>

<p align="center"><sub><a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.de.md">Deutsch</a> · <b>Français</b> · <a href="README.es.md">Español</a> · <a href="README.pt-BR.md">Português</a> · <a href="README.pl.md">Polski</a></sub></p>

<a id="what-it-is"></a>

## Présentation

Nostroma fait tourner un grand modèle Qwen sur votre propre ordinateur. Une famille de modèles, un moteur écrit pour elle, et trois façons de l'utiliser : l'app, le Terminal et une API. Licence MIT, sans compte, sans facturation au token. Il répond sur `127.0.0.1` tant que vous ne demandez pas plus.

| Partie | Ce que vous obtenez |
| --- | --- |
| **L'app** | Une fenêtre avec la discussion, vos fichiers et un aperçu en direct côte à côte. Un installateur par système, sans terminal. |
| **Le Terminal** | La commande `nostroma` : elle installe un modèle, le sert et le surveille. Les scripts et les agents utilisent cette partie. |
| **Le moteur** | Les builds CUDA, HIP, SYCL et Metal du moteur du modèle, et un serveur qui parle les API OpenAI et Anthropic. |

Le modèle est un mélange d'experts : seuls quelques experts travaillent sur un token. Le moteur garde en mémoire les experts en usage et lit le reste sur le disque, donc un jeu de poids de 37,6 Go tient sur une carte. L'app et le serveur répondent depuis la même machine.

<a id="models"></a>

## Modèles

Deux modèles, un seul moteur. Tous deux sont Qwen, et le premier est celui dont parle cette page.

<img src="docs/media/models/qwen.svg" width="22" alt="" align="middle"> &nbsp;**Qwen3.8-Flash-Next** est le principal. Les chiffres sont les poids en RAM plus VRAM ; laissez de la mémoire au système et aux autres programmes.

| Taille | RAM + VRAM | Vitesse | Qualité |
| --- | ---: | --- | --- |
| Q2_0 | 37.6 GB | le plus rapide | bonne |
| IQ2_XS | 39.2 GB | rapide | meilleure |
| IQ3_XXS | 47.0 GB | plus lent | très bonne |
| IQ3_S | 54.8 GB | le plus lent | la meilleure ; égale au modèle complet sur les tests publiés |

**Qui publie les fichiers.** D'abord ISTA-DASLab, puis Unsloth, puis les autres. Avec peu de mémoire, l'installation peut présélectionner une autre taille : lisez le plan avant d'accepter.

| Fournisseur | Choix |
| --- | --- |
| **ISTA-DASLab · recommandé** | Q2_0, IQ2_XS, IQ3_XXS, IQ3_S. [Coder : IQ1_M](docs/MODELS.md#coder), environ 32 Go, pour le code. |
| **Unsloth** | UD-IQ4_XS, UD-Q4_K_XL, UD-Q5_K_XL, UD-Q6_K_XL, Q8_0 ; 72 à 136 Go avec tous les experts en RAM. |
| **Gyro · agentionai** | [Gyro-S, Gyro-M](https://huggingface.co/agentionai/Qwen3.8-Flash-Next-Gyro-GGUF). Moins de mémoire, plus lent. |
| **Autres options** | [Swift 1.5](docs/MODELS.md#swift-15), [NVFP4](docs/NVFP4.md), [OrcaRouter](docs/ORCA.md) |

[Comparer tailles, mémoire et compatibilité](docs/MODELS.md) · [Choisir selon la mémoire](docs/MODELS.md#pick-by-memory)

<img src="docs/media/models/qwen.svg" width="22" alt="" align="middle"> &nbsp;**Qwen3.6-35B-A3B** existe en UD-Q4_K_XL, UD-Q6_K_XL et Q8_0 chez Unsloth, les packs documentés pour ce modèle. [Guide du modèle](docs/QWEN36.md).

<a id="install"></a>

## Installation

### Application de bureau

**[Télécharger Nostroma pour Windows ou Linux →](https://github.com/earenbaz80/Nostroma/releases/latest)**

<sub>`Nostroma-0.2.16-windows-x64-setup.exe` · `Nostroma-0.2.16-linux-x86_64.AppImage`</sub>

Installez l'app, choisissez un modèle, discutez. L'installateur n'embarque pas de moteur : au premier démarrage, l'app télécharge celui de votre carte graphique. [Aide pour l'installateur](docs/INSTALL.md#the-app)

### Application Terminal

Vous préférez un terminal ? Installez Nostroma, puis lancez **`nostroma launch`**. **`nostroma launch --plan`** affiche ce qu'il ferait et ne change rien.

**Linux**

```sh
curl -fsSL --connect-timeout 15 --max-time 120 https://github.com/earenbaz80/Nostroma/releases/latest/download/install.sh -o install.sh && sh install.sh
```

**Windows PowerShell (puis ouvrez un nouveau terminal)**

```powershell
irm -TimeoutSec 120 https://github.com/earenbaz80/Nostroma/releases/latest/download/install.ps1 | iex
```

```sh
nostroma launch
```

Suivez les invites pour télécharger et démarrer un modèle. Avec **`--yes --no-tui`**, il ne demande rien, démarre le serveur, affiche l'adresse et rend la main. [Guide du Terminal](docs/TERMINAL_LAUNCH.md)

[Compiler depuis les sources](docs/SOURCE_INSTALL.md) · [Docker](docs/DOCKER.md) · [Guide d'installation complet](docs/INSTALL.md)

<a id="what-you-need"></a>
<a id="hardware"></a>

## Matériel

L'installateur télécharge le moteur de la carte qu'il trouve. Chaque guide dit ce que ce backend demande.

| Matériel pris en charge | Guide |
| --- | --- |
| **NVIDIA GeForce RTX série 20 / 30 / 40 / 50** | [Installation NVIDIA](docs/INSTALL.md#what-you-need) |
| **AMD Radeon RX 7700 / 7800 / 7900, RX 9060 / 9070, AI PRO R9700** | [Installation AMD](docs/AMD_HIP.md) |
| **AMD Radeon RX 6800 / 6900 · expérimental** | [Installation RX 6000](docs/AMD_HIP.md#rdna2-gfx1030) |
| **Intel Arc · Linux** | [Installation Intel](docs/INTEL_ARC.md) |
| **AMD Ryzen AI Max · Strix Halo** | [Installation Strix Halo](docs/STRIX_HALO.md) |
| **NVIDIA DGX Spark · Linux** | [Installation DGX Spark](docs/DGX_SPARK_LINUX.md) |

<a id="after-it-starts"></a>

## Après le démarrage

Le serveur répond sur `http://127.0.0.1:8080/v1` avec les API OpenAI et Anthropic : un programme que vous utilisez déjà peut pointer dessus avec n'importe quelle clé d'API.

- **`nostroma launch --status`** dit ce qui sert en ce moment.
- **`nostroma launch --stop`** arrête ce que `launch` a démarré.
- **`nostroma launch --show-key`** affiche la clé d'API, si une a été créée.
- **`nostroma launch --vision on`** laisse le modèle lire des images, sur la carte graphique ou sur le CPU.

<a id="using-it"></a>

## Outils

**Claude Code · Codex CLI · OpenCode · oh-my-pi · pi.dev · Hermes Agent · OpenClaw**, et tout autre programme qui parle l'API OpenAI ou Anthropic.

Lancez **`nostroma connect`** pour voir la configuration de votre outil. **`nostroma connect <app> --check`** envoie une invite et un appel d'outil comme le fait cette app. [Guide de connexion](docs/TERMINAL_LAUNCH.md#connect-your-apps-nostroma-connect)

<a id="how-does-it-work"></a>
<a id="help"></a>

## Aide

**Quelque chose ne marche pas :** [Dépannage](docs/TROUBLESHOOTING.md) · [Signaler un bogue](https://github.com/earenbaz80/Nostroma/issues/new/choose)

**Les chiffres :** [vitesse mesurée](docs/DETAILS.md#speed-measured) · [benchmarks de la communauté](docs/COMMUNITY_BENCHMARKS.md) · [comment ça marche](docs/HOW_IT_WORKS.md)

**Participer :** [CONTRIBUTING.md](CONTRIBUTING.md) · [crédits et licences des modèles](docs/HOW_IT_WORKS.md#credits) · [confidentialité](docs/SAFETY.md) · [licence MIT](LICENSE)

<sub>Tous les guides : [docs](docs) · Pour les outils d'IA et les lecteurs automatiques : <a href="AGENTS.md">référence technique</a> · <a href="docs/AI_SETUP.md">instructions d'installation</a>.</sub>
