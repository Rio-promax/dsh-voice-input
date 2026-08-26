# DSH 语音输入插件

浏览器语音输入：**实时 / 整段**两种模式，**四种识别引擎**（浏览器内置 ASR / 本地 whisper / FunASR 中文 / 云 ASR），可选 AI 精修（DeepSeek）。本地引擎完全离线免费。

## 📥 下载地址

| 方式 | 地址 |
|---|---|
| **git clone** | `git clone https://github.com/Rio-promax/dsh-voice-input.git` |
| **Release 压缩包** | [https://github.com/Rio-promax/dsh-voice-input/releases](https://github.com/Rio-promax/dsh-voice-input/releases)（下载最新版 `Source code (zip)` 或发布的附件包） |

下载后进入仓库根目录，按下方「快速开始」安装。

## 快速开始（三步，下载即用）

```powershell
# 1. 下载本仓库（git clone 或 Release zip）后，进入仓库根目录
#    可选：国内网络给 pip 加镜像 -Mirror https://pypi.tuna.tsinghua.edu.cn/simple

# 2. 一键安装：复制插件到 dsh + 注册组合 + 安装 Python 依赖（自动）
pwsh -File install.ps1
#    其他参数：-DshRoot C:\Users\你\.dsh（DSH 配置目录不在默认位置时）
#             -SkipPython（已有环境时跳过依赖安装）

# 3. 重启 dsh
npx @deepseek-ai/dsh web
```

重启后输入栏右侧出现 **🎤 ⚙ 按钮** 即安装成功。

> 若 🎤 不出现，检查：① dsh 会话工作区是否为本仓库根目录（或已设置 `DSH_VOICE_ROOT` 指向本仓库）；② `profiles\web\cordis.patch.yml` 是否含 `dsh-plugin-voice-input` 注册行；③ 浏览器控制台有无报错。

> Linux / macOS 用户：见 `voice-input-plugin\DISTRIBUTION.md`（setup.sh + 手动部署）。

## 一键安装器做了什么（install.ps1）

1. 复制插件包 → `<DSH>\profiles\node_modules\dsh-plugin-voice-input`（host.js→`lib\index.js`、client.js→`lib\client.js`）
2. 幂等注册组合行到 `cordis.patch.yml`（自动备份，不覆盖其他插件）
3. 调用 `setup.ps1`：创建 `.venv` + 安装 Python 依赖（faster-whisper + FunASR-ONNX，无 torch）+ 可选预下载模型

## 环境要求

**运行环境**
- DSH 主程序（Node.js，随 dsh 安装）
- 浏览器：Chrome / Edge（可用「浏览器内置 ASR」）、Firefox / Safari（自动走本地听写）；需 **HTTPS 或 localhost** 才能录音

**Python 环境（识别后端）**
- Python 3.9+（`setup.ps1` / `setup.sh` 自动创建 `.venv` 并安装依赖，无需手动装）

**硬件**
- 建议双核 CPU + ≥4GB 内存（本地模型常驻约 1-1.6GB）
- 磁盘：whisper 模型 0.1-3GB（按型号）、FunASR 约 0.9GB（首次下载）

**网络（首次使用）**
- 首次安装需联网：安装依赖 + 下载模型
- 国内默认走镜像源；**海外用户**如下载慢/失败：whisper 设 `DSH_HF_ENDPOINT=https://huggingface.co`、FunASR 设 `MODELSCOPE_ENDPOINT`
- 完全离线环境无法使用本地引擎（云 ASR 不受影响，但需自备 API Key）

**可选（云服务，按需配置）**
- AI 精修：DeepSeek API Key
- 云 ASR：OpenAI 兼容端点 / 豆包 API Key

## 目录结构

```
install.ps1                  # 一键安装器（复制+注册+依赖）
voice-input-plugin\          # 插件包（client/host + setup.ps1/setup.sh + 详细文档）
.voice-asr\transcribe.py     # ASR 调度器（多后端）
```

## 限制与合规

隐私（云后端会外发音频/文本、Key 存浏览器）、HTTPS 要求、资源门槛、组件许可清单
→ 详见 `voice-input-plugin\DISTRIBUTION.md`

