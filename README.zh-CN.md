<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="apps/host/public/brand/nostroma-lockup-dark.svg">
    <img src="apps/host/public/brand/nostroma-lockup-light.svg" alt="Nostroma" width="340">
  </picture>
</p>

<h3 align="center">在你已有的显卡上运行 Qwen3.8-Flash-Next。</h3>
<p align="center">权重需要 37.6 GB 的混合专家模型，为应用和你的编程工具服务。</p>

<p align="center">
  <a href="#模型">模型</a> · <a href="#安装"><b>安装</b></a> ·
  <a href="#硬件">硬件</a> · <a href="#工具">工具</a> ·
  <a href="#帮助">帮助</a>
</p>

<p align="center">
  <a href="https://github.com/earenbaz80/Nostroma/releases/latest"><img src="https://img.shields.io/github/v/release/earenbaz80/Nostroma?label=download&color=0ab887" alt="下载 Nostroma"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/earenbaz80/Nostroma" alt="MIT 许可证"></a>
</p>

<p align="center"><sub><a href="README.md">English</a> · <b>简体中文</b> · <a href="README.ja.md">日本語</a> · <a href="README.de.md">Deutsch</a> · <a href="README.fr.md">Français</a> · <a href="README.es.md">Español</a> · <a href="README.pt-BR.md">Português</a> · <a href="README.pl.md">Polski</a></sub></p>

**免费、开源，由你自己运行。** 在桌面上使用 Nostroma，或搭配你喜欢的编程工具。无需账号。

## 模型

两个模型，一个引擎。两者都是 Qwen；提供方见下方，先 ISTA-DASLab，后 Unsloth。

<details>
<summary><img src="docs/media/models/qwen.svg" width="22" alt="" align="middle"> &nbsp;<b>Qwen3.8-Flash-Next</b></summary>

| 提供方 | 可选项 |
| --- | --- |
| **ISTA-DASLab · 推荐** | Q2\_0, IQ2\_XS, IQ3\_XXS, IQ3\_S。[Coder：IQ1\_M](docs/MODELS.md#coder)，适合写代码。 |
| **Unsloth** | UD-IQ4\_XS, UD-Q4\_K\_XL, UD-Q5\_K\_XL, UD-Q6\_K\_XL, Q8\_0 |
| **Gyro · agentionai** | [Gyro-S, Gyro-M](https://huggingface.co/agentionai/Qwen3.8-Flash-Next-Gyro-GGUF)。占用内存更少，但速度更慢。 |
| **其他选项** | [Swift 1.5](docs/MODELS.md#swift-15), [NVFP4](docs/NVFP4.md), [OrcaRouter](docs/ORCA.md) |

[比较大小、内存需求和兼容性](docs/MODELS.md)。

</details>

<details>
<summary><img src="docs/media/models/qwen.svg" width="22" alt="" align="middle"> &nbsp;<b>Qwen3.6-35B-A3B</b></summary>

**Unsloth:** UD-Q4_K_XL, UD-Q6_K_XL, Q8_0。这些是目前文档中收录的该模型的版本。

[模型指南和兼容性](docs/QWEN36.md)。

</details>

不确定哪个放得下？[为你的电脑选择模型](docs/MODELS.md#pick-by-memory)。

## 安装

### 桌面应用

**[下载适用于 Windows、Linux 的 Nostroma →](https://github.com/earenbaz80/Nostroma/releases/latest)**

安装应用，选择模型，就可以开始聊天。每个系统只有一个安装程序。首次启动时，应用会下载适合你显卡的引擎。[安装程序帮助](docs/INSTALL.md#the-app)。

<sub>文件: `Nostroma-0.2.16-windows-x64-setup.exe` · `Nostroma-0.2.16-linux-x86_64.AppImage`</sub>

### 终端应用

更喜欢终端？安装 Nostroma，然后运行 **`nostroma launch`**。

<details open>
<summary><b>安装命令</b></summary>

**Linux**

```sh
curl -fsSL --connect-timeout 15 --max-time 120 https://github.com/earenbaz80/Nostroma/releases/latest/download/install.sh -o install.sh && sh install.sh
```

**Windows PowerShell**

```powershell
irm -TimeoutSec 120 https://github.com/earenbaz80/Nostroma/releases/latest/download/install.ps1 | iex
```

在 Windows 上，安装后请打开一个新的终端。然后运行：

```sh
nostroma launch
```

按提示下载并启动模型。[终端指南](docs/TERMINAL_LAUNCH.md)。

</details>

[从源码构建](docs/SOURCE_INSTALL.md) · [Docker](docs/DOCKER.md) · [完整安装指南](docs/INSTALL.md)

<a id="what-you-need"></a>

## 硬件

| 支持的硬件 | 指南 |
| --- | --- |
| **NVIDIA GeForce RTX 20 / 30 / 40 / 50 系列** | [NVIDIA 安装](docs/INSTALL.md#what-you-need) |
| **AMD Radeon RX 7700 / 7800 / 7900、RX 9060 / 9070、AI PRO R9700** | [AMD 安装](docs/AMD_HIP.md) |
| **AMD Radeon RX 6800 / 6900 · 实验性** | [RX 6000 安装](docs/AMD_HIP.md#rdna2-gfx1030) |
| **Intel Arc · Linux** | [Intel 安装](docs/INTEL_ARC.md) |
| **AMD Ryzen AI Max · Strix Halo** | [Strix Halo 安装](docs/STRIX_HALO.md) |

<a id="using-it"></a>

## 工具

**Claude Code · Codex CLI · OpenCode · oh-my-pi · pi.dev · Hermes Agent · OpenClaw**，也可以通过兼容 OpenAI 和 Anthropic 的 API 使用更多工具。

运行 **`nostroma connect`**，查看你所用工具的设置方法。[连接指南](docs/TERMINAL_LAUNCH.md#connect-your-apps-nostroma-connect)。

<a id="how-does-it-work"></a>

## 帮助

**出问题时：** [故障排查](docs/TROUBLESHOOTING.md) · [报告问题](https://github.com/earenbaz80/Nostroma/issues/new/choose)

**数字：** [实测速度](docs/DETAILS.md#speed-measured) · [社区基准测试](docs/COMMUNITY_BENCHMARKS.md) · [工作原理](docs/HOW_IT_WORKS.md)

**参与：** [CONTRIBUTING.md](CONTRIBUTING.md) · [致谢和模型许可证](docs/HOW_IT_WORKS.md#credits) · [隐私](docs/SAFETY.md) · [MIT 许可证](LICENSE)

<sub>全部指南：[docs](docs) · 供 AI 工具和自动读取使用：<a href="AGENTS.md">技术参考</a> · <a href="docs/AI_SETUP.md">安装说明</a>。</sub>

<sub>面向 AI 工具和自动阅读器： <a href="AGENTS.md">技术参考</a> · <a href="docs/AI_SETUP.md">安装说明</a></sub>
