<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="apps/host/public/brand/nostroma-lockup-dark.svg">
    <img src="apps/host/public/brand/nostroma-lockup-light.svg" alt="Nostroma" width="340">
  </picture>
</p>

<h3 align="center">在你已有的显卡上运行 Qwen3.8-Flash-Next。</h3>
<p align="center">混合专家模型，权重需要 37.6 GB，为应用和你的编程工具服务。</p>

<p align="center">
  <a href="#what-it-is">简介</a> · <a href="#models">模型</a> · <a href="#install"><b>安装</b></a> ·
  <a href="#hardware">硬件</a> · <a href="#after-it-starts">启动之后</a> · <a href="#help">帮助</a>
</p>

<p align="center">
  <a href="https://github.com/earenbaz80/Nostroma/releases/latest"><img src="https://img.shields.io/github/v/release/earenbaz80/Nostroma?label=download&color=0ab887" alt="下载 Nostroma"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/earenbaz80/Nostroma" alt="MIT 许可证"></a>
</p>

<p align="center"><sub><a href="README.md">English</a> · <b>简体中文</b> · <a href="README.ja.md">日本語</a> · <a href="README.de.md">Deutsch</a> · <a href="README.fr.md">Français</a> · <a href="README.es.md">Español</a> · <a href="README.pt-BR.md">Português</a> · <a href="README.pl.md">Polski</a></sub></p>

<a id="what-it-is"></a>

## 简介

Nostroma 在你自己的电脑上运行一个大 Qwen 模型。一个模型家族、一个为它打造的引擎，三种用法：应用、终端和 API。MIT 许可，无需账号，没有按 token 计费。除非你要求更多，它只在 `127.0.0.1` 上应答。

| 组成 | 你能得到什么 |
| --- | --- |
| **应用** | 一个窗口，聊天、你的文件和实时预览并排。每个系统一个安装包，不用终端。 |
| **终端** | `nostroma` 命令：安装模型、提供服务并监控它。脚本和智能体用这一部分。 |
| **引擎** | 模型引擎的 CUDA、HIP、SYCL 和 Metal 版本，以及支持 OpenAI 与 Anthropic API 的服务器。 |

模型是混合专家：每个 token 只有少数专家参与计算。引擎把正在用的专家留在内存里，其余从磁盘读取，所以需要 37.6 GB 的权重能跑在一张卡上。应用和服务器在同一台机器上应答。

<a id="models"></a>

## 模型

两个模型，一个引擎。两者都是 Qwen，本页主要讲第一个。

<img src="docs/media/models/qwen.svg" width="22" alt="" align="middle"> &nbsp;**Qwen3.8-Flash-Next** 是主要的那个。表中的数字是内存加显存中的权重；给系统和其它程序留出内存。

| 大小 | 内存 + 显存 | 速度 | 质量 |
| --- | ---: | --- | --- |
| Q2_0 | 37.6 GB | 最快 | 好 |
| IQ2_XS | 39.2 GB | 快 | 更好 |
| IQ3_XXS | 47.0 GB | 较慢 | 很好 |
| IQ3_S | 54.8 GB | 最慢 | 最好；在公开测试中与完整模型持平 |

**谁发布这些文件。** 先是 ISTA-DASLab，然后 Unsloth，再是其他。内存很少时安装程序可能预选另一个大小，同意之前先读计划。

| 提供方 | 可选 |
| --- | --- |
| **ISTA-DASLab · 推荐** | Q2_0、IQ2_XS、IQ3_XXS、IQ3_S。[代码版：IQ1_M](docs/MODELS.md#coder)，约 32 GB，用于写代码。 |
| **Unsloth** | UD-IQ4_XS、UD-Q4_K_XL、UD-Q5_K_XL、UD-Q6_K_XL、Q8_0；所有专家都放进内存需要 72 至 136 GB。 |
| **Gyro · agentionai** | [Gyro-S、Gyro-M](https://huggingface.co/agentionai/Qwen3.8-Flash-Next-Gyro-GGUF)。占用内存更少，但更慢。 |
| **其他选项** | [Swift 1.5](docs/MODELS.md#swift-15)、[NVFP4](docs/NVFP4.md)、[OrcaRouter](docs/ORCA.md) |

[比较大小、内存需求和兼容性](docs/MODELS.md) · [按内存选择](docs/MODELS.md#pick-by-memory)

<img src="docs/media/models/qwen.svg" width="22" alt="" align="middle"> &nbsp;**Qwen3.6-35B-A3B** 提供 Unsloth 的 UD-Q4_K_XL、UD-Q6_K_XL 和 Q8_0，这是该模型有文档的包。[模型指南](docs/QWEN36.md)。

<a id="install"></a>

## 安装

### 桌面应用

**[下载 Windows 或 Linux 版 Nostroma →](https://github.com/earenbaz80/Nostroma/releases/latest)**

<sub>`Nostroma-0.2.16-windows-x64-setup.exe` · `Nostroma-0.2.16-linux-x86_64.AppImage`</sub>

安装应用、选择模型、开始聊天。安装包不含引擎：首次启动时应用会下载适合你显卡的引擎。 [安装帮助](docs/INSTALL.md#the-app)

### 终端应用

更喜欢终端？安装 Nostroma，然后运行 **`nostroma launch`**。**`nostroma launch --plan`** 只打印它将做什么，不做任何更改。

**Linux**

```sh
curl -fsSL --connect-timeout 15 --max-time 120 https://github.com/earenbaz80/Nostroma/releases/latest/download/install.sh -o install.sh && sh install.sh
```

**Windows PowerShell（然后打开新的终端）**

```powershell
irm -TimeoutSec 120 https://github.com/earenbaz80/Nostroma/releases/latest/download/install.ps1 | iex
```

```sh
nostroma launch
```

按提示下载并启动模型。加上 **`--yes --no-tui`** 时它不问任何问题，启动服务器、打印地址后返回。 [终端指南](docs/TERMINAL_LAUNCH.md)

[从源码构建](docs/SOURCE_INSTALL.md) · [Docker](docs/DOCKER.md) · [完整安装指南](docs/INSTALL.md)

<a id="what-you-need"></a>
<a id="hardware"></a>

## 硬件

安装程序会为它找到的显卡下载引擎。每份指南说明该后端需要什么。

| 支持的硬件 | 指南 |
| --- | --- |
| **NVIDIA GeForce RTX 20 / 30 / 40 / 50 系列** | [NVIDIA 设置](docs/INSTALL.md#what-you-need) |
| **AMD Radeon RX 7700 / 7800 / 7900、RX 9060 / 9070、AI PRO R9700** | [AMD 设置](docs/AMD_HIP.md) |
| **AMD Radeon RX 6800 / 6900 · 实验性** | [RX 6000 设置](docs/AMD_HIP.md#rdna2-gfx1030) |
| **Intel Arc · Linux** | [Intel 设置](docs/INTEL_ARC.md) |
| **AMD Ryzen AI Max · Strix Halo** | [Strix Halo 设置](docs/STRIX_HALO.md) |
| **NVIDIA DGX Spark · Linux** | [DGX Spark 设置](docs/DGX_SPARK_LINUX.md) |

<a id="after-it-starts"></a>

## 启动之后

服务器在 `http://127.0.0.1:8080/v1` 上以 OpenAI 和 Anthropic API 应答，你已在用的程序填任意 API key 就能连上。

- **`nostroma launch --status`** 显示当前在提供什么。
- **`nostroma launch --stop`** 停止 `launch` 启动的东西。
- **`nostroma launch --show-key`** 打印 API key（如果生成过）。
- **`nostroma launch --vision on`** 让模型读图，在显卡或 CPU 上。

<a id="using-it"></a>

## 工具

**Claude Code · Codex CLI · OpenCode · oh-my-pi · pi.dev · Hermes Agent · OpenClaw**，以及任何支持 OpenAI 或 Anthropic API 的程序。

运行 **`nostroma connect`** 查看你的工具的设置。**`nostroma connect <app> --check`** 按该应用的方式发一条提示和一次工具调用。 [连接指南](docs/TERMINAL_LAUNCH.md#connect-your-apps-nostroma-connect)

<a id="how-does-it-work"></a>
<a id="help"></a>

## 帮助

**出问题时：** [故障排查](docs/TROUBLESHOOTING.md) · [报告问题](https://github.com/earenbaz80/Nostroma/issues/new/choose)

**数字：** [实测速度](docs/DETAILS.md#speed-measured) · [社区基准测试](docs/COMMUNITY_BENCHMARKS.md) · [工作原理](docs/HOW_IT_WORKS.md)

**参与：** [CONTRIBUTING.md](CONTRIBUTING.md) · [致谢和模型许可证](docs/HOW_IT_WORKS.md#credits) · [隐私](docs/SAFETY.md) · [MIT 许可证](LICENSE)

<sub>全部指南：[docs](docs) · 供 AI 工具和自动读取使用：<a href="AGENTS.md">技术参考</a> · <a href="docs/AI_SETUP.md">安装说明</a>。</sub>
