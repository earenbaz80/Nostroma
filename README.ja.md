<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="apps/host/public/brand/nostroma-lockup-dark.svg">
    <img src="apps/host/public/brand/nostroma-lockup-light.svg" alt="Nostroma" width="340">
  </picture>
</p>

<h3 align="center">手持ちのグラフィックカード1枚で動く Qwen3.8-Flash-Next。</h3>
<p align="center">重みに 37.6 GB を必要とする Mixture-of-Experts モデルを、アプリとコーディングツールに。</p>

<p align="center">
  <a href="#what-it-is">概要</a> · <a href="#models">モデル</a> · <a href="#install"><b>インストール</b></a> ·
  <a href="#hardware">ハードウェア</a> · <a href="#after-it-starts">起動後</a> · <a href="#help">ヘルプ</a>
</p>

<p align="center">
  <a href="https://github.com/earenbaz80/Nostroma/releases/latest"><img src="https://img.shields.io/github/v/release/earenbaz80/Nostroma?label=download&color=0ab887" alt="Nostroma をダウンロード"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/earenbaz80/Nostroma" alt="MIT ライセンス"></a>
</p>

<p align="center"><sub><a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <b>日本語</b> · <a href="README.de.md">Deutsch</a> · <a href="README.fr.md">Français</a> · <a href="README.es.md">Español</a> · <a href="README.pt-BR.md">Português</a> · <a href="README.pl.md">Polski</a></sub></p>

<a id="what-it-is"></a>

## 概要

Nostroma は大きな Qwen モデルを自分のパソコンで動かします。1つのモデルファミリー、そのために作られた1つのエンジン、そして3つの使い方：アプリ、ターミナル、API。MIT ライセンス、アカウント不要、トークン課金なし。より広く公開しない限り `127.0.0.1` で応答します。

| 構成 | 得られるもの |
| --- | --- |
| **アプリ** | チャット、ファイル、ライブプレビューを1つのウィンドウに並べた画面。OS ごとにインストーラー1つ、ターミナル不要。 |
| **ターミナル** | `nostroma` コマンド：モデルを導入し、提供し、監視します。スクリプトとエージェントはこちらを使います。 |
| **エンジン** | モデルエンジンの CUDA・HIP・SYCL・Metal ビルドと、OpenAI と Anthropic の API を話すサーバー。 |

モデルは Mixture-of-Experts です。1つのトークンに関わる専門家はごく一部です。エンジンは使用中の専門家をメモリに置き、残りはディスクから読むので、37.6 GB の重みがカード1枚で動きます。アプリとサーバーは同じマシンから応答します。

<a id="models"></a>

## モデル

モデルは2つ、エンジンは1つ。どちらも Qwen で、このページの主役は1つ目です。

<img src="docs/media/models/qwen.svg" width="22" alt="" align="middle"> &nbsp;**Qwen3.8-Flash-Next** が主役です。表の数値はメモリと VRAM に載る重みです。システムと他のプログラム用にメモリを残してください。

| サイズ | メモリ + VRAM | 速度 | 品質 |
| --- | ---: | --- | --- |
| Q2_0 | 37.6 GB | 最速 | 良い |
| IQ2_XS | 39.2 GB | 速い | より良い |
| IQ3_XXS | 47.0 GB | 遅め | とても良い |
| IQ3_S | 54.8 GB | 最も遅い | 最良。公開テストではフルモデルと同等 |

**ファイルの提供元。** まず ISTA-DASLab、次に Unsloth、その次にその他。メモリが少ないとセットアップが別のサイズを勧めることがあるので、同意する前に計画を読んでください。

| 提供元 | 選択肢 |
| --- | --- |
| **ISTA-DASLab · 推奨** | Q2_0、IQ2_XS、IQ3_XXS、IQ3_S。[Coder: IQ1_M](docs/MODELS.md#coder)、約 32 GB、コード向け。 |
| **Unsloth** | UD-IQ4_XS、UD-Q4_K_XL、UD-Q5_K_XL、UD-Q6_K_XL、Q8_0。すべての専門家をメモリに載せるには 72〜136 GB。 |
| **Gyro · agentionai** | [Gyro-S、Gyro-M](https://huggingface.co/agentionai/Qwen3.8-Flash-Next-Gyro-GGUF)。メモリは少なくて済みますが遅くなります。 |
| **その他の選択肢** | [Swift 1.5](docs/MODELS.md#swift-15)、[NVFP4](docs/NVFP4.md)、[OrcaRouter](docs/ORCA.md) |

[サイズ・必要メモリ・互換性を比較](docs/MODELS.md) · [メモリから選ぶ](docs/MODELS.md#pick-by-memory)

<img src="docs/media/models/qwen.svg" width="22" alt="" align="middle"> &nbsp;**Qwen3.6-35B-A3B** は Unsloth の UD-Q4_K_XL、UD-Q6_K_XL、Q8_0 で提供されます。このモデルの文書化されたパックです。[モデルガイド](docs/QWEN36.md)。

<a id="install"></a>

## インストール

### デスクトップアプリ

**[Windows または Linux 版 Nostroma をダウンロード →](https://github.com/earenbaz80/Nostroma/releases/latest)**

<sub>`Nostroma-0.2.16-windows-x64-setup.exe` · `Nostroma-0.2.16-linux-x86_64.AppImage`</sub>

アプリを入れてモデルを選べば、すぐにチャットできます。インストーラーにエンジンは入っていません。初回起動時に、グラフィックカードに合うエンジンをダウンロードします。 [インストーラーのヘルプ](docs/INSTALL.md#the-app)

### ターミナルアプリ

ターミナルのほうが好みですか。Nostroma を入れて **`nostroma launch`** を実行します。**`nostroma launch --plan`** は何をするかだけを表示し、何も変更しません。

**Linux**

```sh
curl -fsSL --connect-timeout 15 --max-time 120 https://github.com/earenbaz80/Nostroma/releases/latest/download/install.sh -o install.sh && sh install.sh
```

**Windows PowerShell（その後、新しいターミナルを開く）**

```powershell
irm -TimeoutSec 120 https://github.com/earenbaz80/Nostroma/releases/latest/download/install.ps1 | iex
```

```sh
nostroma launch
```

案内に従ってモデルをダウンロードし、起動します。**`--yes --no-tui`** を付けると何も尋ねず、サーバーを起動してアドレスを表示し、戻ります。 [ターミナルガイド](docs/TERMINAL_LAUNCH.md)

[ソースからビルド](docs/SOURCE_INSTALL.md) · [Docker](docs/DOCKER.md) · [インストールの詳細](docs/INSTALL.md)

<a id="what-you-need"></a>
<a id="hardware"></a>

## ハードウェア

インストーラーは見つけたカード用のエンジンをダウンロードします。必要なものは各ガイドに書かれています。

| 対応ハードウェア | ガイド |
| --- | --- |
| **NVIDIA GeForce RTX 20 / 30 / 40 / 50 シリーズ** | [NVIDIA の設定](docs/INSTALL.md#what-you-need) |
| **AMD Radeon RX 7700 / 7800 / 7900、RX 9060 / 9070、AI PRO R9700** | [AMD の設定](docs/AMD_HIP.md) |
| **AMD Radeon RX 6800 / 6900 · 実験的** | [RX 6000 の設定](docs/AMD_HIP.md#rdna2-gfx1030) |
| **Intel Arc · Linux** | [Intel の設定](docs/INTEL_ARC.md) |
| **AMD Ryzen AI Max · Strix Halo** | [Strix Halo の設定](docs/STRIX_HALO.md) |
| **NVIDIA DGX Spark · Linux** | [DGX Spark の設定](docs/DGX_SPARK_LINUX.md) |

<a id="after-it-starts"></a>

## 起動後

サーバーは `http://127.0.0.1:8080/v1` で OpenAI と Anthropic の API に応答します。普段使っているプログラムを、任意の API キーでここに向けられます。

- **`nostroma launch --status`** はいま何が動いているかを表示します。
- **`nostroma launch --stop`** は `launch` が起動したものを止めます。
- **`nostroma launch --show-key`** は API キーがあれば表示します。
- **`nostroma launch --vision on`** は画像を読ませます。グラフィックカードでも CPU でも動きます。

<a id="using-it"></a>

## ツール

**Claude Code · Codex CLI · OpenCode · oh-my-pi · pi.dev · Hermes Agent · OpenClaw**、および OpenAI または Anthropic の API を話す任意のプログラム。

**`nostroma connect`** を実行すると、使うツールの設定が表示されます。**`nostroma connect <app> --check`** はそのアプリと同じやり方でプロンプト1つとツール呼び出し1つを送ります。 [接続ガイド](docs/TERMINAL_LAUNCH.md#connect-your-apps-nostroma-connect)

<a id="how-does-it-work"></a>
<a id="help"></a>

## ヘルプ

**うまく動かないとき:** [トラブルシューティング](docs/TROUBLESHOOTING.md) · [不具合を報告](https://github.com/earenbaz80/Nostroma/issues/new/choose)

**数値について:** [実測の速度](docs/DETAILS.md#speed-measured) · [コミュニティのベンチマーク](docs/COMMUNITY_BENCHMARKS.md) · [仕組み](docs/HOW_IT_WORKS.md)

**参加する:** [CONTRIBUTING.md](CONTRIBUTING.md) · [クレジットとモデルのライセンス](docs/HOW_IT_WORKS.md#credits) · [プライバシー](docs/SAFETY.md) · [MIT ライセンス](LICENSE)

<sub>すべてのガイド：[docs](docs) · AI ツールと自動読み取り向け：<a href="AGENTS.md">技術リファレンス</a> · <a href="docs/AI_SETUP.md">セットアップ手順</a>。</sub>
