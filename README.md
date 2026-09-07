# DSH 语音输入插件

在 DSH 输入栏直接语音输入文字：支持实时听写和整段录音，识别引擎可选浏览器内置 ASR、本地 whisper、FunASR 或云服务，识别后还可以使用 AI 精修。

当前实现：v62（设置跨浏览器持久化、模型目录可选、模型按需下载、安装/部署入口统一）。

[![License](https://img.shields.io/github/license/Rio-promax/dsh-voice-input)](LICENSE)
[![Release](https://img.shields.io/github/v/release/Rio-promax/dsh-voice-input)](https://github.com/Rio-promax/dsh-voice-input/releases)

## 功能

- **实时听写**：边说边识别，停顿自动切句。
- **整段模式**：录完再识别，适合长段口述。
- **多种识别引擎**：浏览器内置 ASR、本地 whisper、FunASR 中文本地识别、OpenAI 兼容云 ASR 和豆包云 ASR。
- **AI 精修**：可配置 AI 后台修正同音字、标点，并参考最近聊天语境。
- **本地离线**：本地引擎无需 API 费用，模型按需下载。

## 位置预览

<img width="1562" height="190" alt="DSH 语音输入工具栏" src="https://github.com/user-attachments/assets/ee8b6673-806b-4b24-a6de-42ff3d46aa6d" />

## 安装前提

- **DSH**：先在本机安装 DSH，并确认 npx @deepseek-ai/dsh web 可以正常启动。
- **Python**：Python 3.9 或更高版本；推荐 3.10–3.12，并加入 PATH。
- **Node.js**：DSH 使用 Node.js、npm 和 npx。
- **浏览器**：Chrome/Edge 支持浏览器内置 ASR；任意支持 getUserMedia 的浏览器都可以使用录音和本地引擎。
- **资源**：建议双核 CPU 和至少 4GB 内存。本地模型常驻约 1–1.6GB 内存；首次下载需要数百 MB 到约 1GB 以上空间。
- **录音权限**：浏览器录音需要 HTTPS 或 localhost；macOS 首次录音还需要在系统设置中允许浏览器访问麦克风。

> 本 README 只把安装流程分为 Windows 和 macOS。Linux 可以使用 macOS 的 POSIX 脚本和部署命令。

## 下载

### 推荐：Git 克隆

~~~bash
git clone https://github.com/Rio-promax/dsh-voice-input.git
cd dsh-voice-input
~~~

### ZIP 下载

- [下载当前 main 分支 ZIP](https://github.com/Rio-promax/dsh-voice-input/archive/refs/heads/main.zip)
- [下载稳定 Release](https://github.com/Rio-promax/dsh-voice-input/releases)

下载 ZIP 后，请先完整解压，再进入同时包含 install.ps1、.voice-asr 和 voice-input-plugin 的仓库根目录。

## Windows 安装

### 1. 检查环境

在 PowerShell 中运行：

~~~powershell
node --version
npx --version
python --version
~~~

如果 python 不存在，请从 [python.org](https://www.python.org/downloads/) 安装 Python 3.9+，安装时勾选 **Add Python to PATH**。

### 2. 停止 DSH 并进入仓库根目录

先退出正在运行的 DSH 实例，再打开 PowerShell，进入仓库根目录：

~~~powershell
Set-Location -LiteralPath 'C:\path\to\dsh-voice-input'
~~~

### 3. 执行安装脚本

按下回车执行下面的命令后，install.ps1 会**立即在当前 PowerShell 窗口前台同步运行**；它不会等 DSH 启动，也不需要双击脚本。请保持窗口打开，直到看到“安装完成”。

~~~powershell
pwsh -ExecutionPolicy Bypass -File .\install.ps1
~~~

如果系统没有 pwsh，使用 Windows PowerShell 5.1：

~~~powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
~~~

-ExecutionPolicy Bypass 只对本次启动的 PowerShell 生效，不会永久修改系统执行策略。

### 4. install.ps1 会完成什么

脚本按以下顺序执行；看到每一行 ==> 就能知道当前进度：

1. **定位 DSH 配置**：优先使用 -DshRoot，其次使用 DSH_HOME，最后使用默认目录 %USERPROFILE%\.dsh。
2. **复制插件**：把插件真实复制到 <DSH>\profiles\node_modules\dsh-plugin-voice-input，不会使用 junction。
3. **注册组合**：创建或增量更新 profiles\web\cordis.patch.yml；已有内容会保留，必要时自动生成 .bak-* 备份。
4. **安装 Python 环境**：调用 voice-input-plugin\setup.ps1，创建 .venv、安装依赖；默认不下载大模型，模型在设置面板中按需下载。
5. **输出重启提示**：脚本完成后才启动 DSH；安装脚本本身不会启动 DSH。

### 5. 常用参数

~~~powershell
# DSH 不在默认目录时，显式指定 DSH 根目录
pwsh -ExecutionPolicy Bypass -File .\install.ps1 -DshRoot 'C:\path\to\.dsh'

# 使用国内 PyPI 镜像
pwsh -ExecutionPolicy Bypass -File .\install.ps1 -Mirror 'https://pypi.tuna.tsinghua.edu.cn/simple'

# 先完成插件注册和 Python 依赖安装（模型默认不下载）
pwsh -ExecutionPolicy Bypass -File .\install.ps1 -SkipModels

# 明确预下载模型，并指定模型目录（可选）
pwsh -ExecutionPolicy Bypass -File .\install.ps1 -WithModels -ModelRoot 'E:\DSH\models'

# 只需要浏览器内置 ASR 时，可跳过 Python；本地 whisper/FunASR 将不可用
pwsh -ExecutionPolicy Bypass -File .\install.ps1 -SkipPython
~~~

模型下载是按需的：打开「设置 → 本地模型管理」可指定目录并下载 Whisper/FunASR；也可用 -WithModels 预下载。如果使用 -SkipPython，之后要手动运行 voice-input-plugin\setup.ps1 才能启用本地引擎。

### 6. 启动 DSH

推荐从仓库根目录启动 DSH，让插件自动使用该目录下的 .voice-asr 和 .venv：

~~~powershell
Set-Location -LiteralPath 'C:\path\to\dsh-voice-input'
npx @deepseek-ai/dsh web
~~~

如果必须从其他目录启动，请在启动前设置语音组件根目录；setx 只对新开的终端生效：

~~~powershell
setx DSH_VOICE_ROOT 'C:\path\to\dsh-voice-input'
~~~

执行 setx 后请关闭当前终端，重新打开 PowerShell，再启动 DSH。重启后，输入栏右侧应出现 🎤 和 ⚙。

### 7. Windows 常见问题

- **找不到 profiles**：使用 -DshRoot 指向实际的 .dsh 目录，或设置 DSH_HOME。
- **没有图标**：确认 DSH 已完全退出后再启动；端口被旧实例占用时，先在旧终端按 Ctrl+C。
- **本地识别失败**：检查 .venv 是否创建成功；网络受限时重新运行并加 -Mirror。
- **模型下载慢**：国内可使用上面的 PyPI 镜像；海外可在启动 DSH 前设置 DSH_HF_ENDPOINT=https://huggingface.co。

## macOS 安装

### 1. 检查环境

打开 Terminal，运行：

~~~bash
node --version
npx --version
python3 --version
~~~

如果没有 python3，可从 [python.org](https://www.python.org/downloads/) 安装，或使用 Homebrew：

~~~bash
brew install python
~~~

Python 必须是 3.9+。Intel Mac 和 Apple Silicon Mac 使用同一套安装流程。

### 2. 下载并进入仓库

可以使用上面的 Git 克隆或 ZIP 下载链接。解压后进入仓库根目录：

~~~bash
cd /path/to/dsh-voice-input
~~~

### 3. 安装 Python 依赖和本地模型

先停止正在运行的 DSH，再执行：

~~~bash
bash ./voice-input-plugin/setup.sh
~~~

这条命令会**立即在当前 Terminal 前台同步执行**：创建 .venv、安装依赖；默认不下载大模型。模型可在设置面板中按需选择目录并下载。不要关闭 Terminal；看到“安装完成”后才继续下一步。

网络受限时可指定镜像，或跳过模型预下载：

~~~bash
# 使用国内 PyPI 镜像
bash ./voice-input-plugin/setup.sh -m https://pypi.tuna.tsinghua.edu.cn/simple

# 模型默认按需下载；也可显式跳过预下载（兼容旧参数）
bash ./voice-input-plugin/setup.sh --skip-models

# 明确预下载，并把模型放到指定目录
bash ./voice-input-plugin/setup.sh --with-models --model-root /mnt/dsh-models
~~~

### 4. 自动部署插件

macOS 没有 Windows 的 install.ps1。下面的代码可以直接从仓库根目录粘贴到 Terminal 执行：它会复制插件、创建或增量更新 cordis.patch.yml，并在修改已有文件前创建备份；不需要手动创建临时文件，也不需要把文件“挪到前台”。

~~~bash
set -euo pipefail

ROOT="$PWD"
PKG="$ROOT/voice-input-plugin"
DSH_ROOT="${DSH_HOME:-$HOME/.dsh}"
PROFILES="$DSH_ROOT/profiles"
DST="$PROFILES/node_modules/dsh-plugin-voice-input"
PATCH="$PROFILES/web/cordis.patch.yml"

if [ ! -f "$PKG/package.json" ]; then
  echo "错误：请从仓库根目录运行这段代码。"
  exit 1
fi

if [ ! -d "$PROFILES" ]; then
  echo "错误：找不到 DSH profiles：$PROFILES"
  echo "请设置 DSH_HOME，或把 DSH_ROOT 改成实际的 .dsh 路径。"
  exit 1
fi

mkdir -p "$DST/lib" "$(dirname "$PATCH")"
cp "$PKG/package.json" "$DST/package.json"
cp "$PKG/host.js" "$DST/lib/index.js"
cp "$PKG/client.js" "$DST/lib/client.js"
echo "插件已复制：$DST"

patch_block() {
  cat <<'YAML'
# Voice input plugin (installed by the macOS installation steps).
- insert:
    - id: voice-input
      name: 'dsh-plugin-voice-input'
YAML
}

if [ -f "$PATCH" ]; then
  if grep -q 'dsh-plugin-voice-input' "$PATCH"; then
    echo "组合已注册：$PATCH"
  else
    BACKUP="$PATCH.bak.$(date +%Y%m%d-%H%M%S)"
    cp "$PATCH" "$BACKUP"
    COMPACT="$(tr -d '[:space:]' < "$PATCH")"
    if [ -z "$COMPACT" ] || [ "$COMPACT" = "[]" ]; then
      patch_block > "$PATCH"
    else
      printf '\n' >> "$PATCH"
      patch_block >> "$PATCH"
    fi
    echo "组合已注册：$PATCH"
    echo "原文件备份：$BACKUP"
  fi
else
  patch_block > "$PATCH"
  echo "组合已创建：$PATCH"
fi

echo "部署完成"
~~~

如果 DSH 使用的不是默认 ~/.dsh，先设置环境变量再粘贴上面的代码：

~~~bash
export DSH_HOME="$HOME/path/to/.dsh"
~~~

### 5. 启动 DSH

建议在同一个 Terminal 中显式指定语音组件根目录，然后启动 DSH；这样无论当前 DSH 工作区如何设置，都能找到 .voice-asr 和 .venv：

~~~bash
export DSH_VOICE_ROOT="$PWD"
npx @deepseek-ai/dsh web
~~~

如果使用了 export DSH_HOME=...，它也会继续作用于当前 Terminal。重启后，输入栏右侧应出现 🎤 和 ⚙。

### 6. macOS 常见问题

- **麦克风不可用**：打开“系统设置 → 隐私与安全性 → 麦克风”，允许当前浏览器访问麦克风，然后重启浏览器。
- **找不到 profiles**：确认 DSH_HOME 指向包含 profiles 的 .dsh 目录。
- **没有图标**：确认部署代码已输出“部署完成”，停止旧 DSH 进程后再运行 npx @deepseek-ai/dsh web。
- **本地模型下载失败**：检查网络和磁盘空间；可重新运行 setup.sh，脚本会复用已有缓存。

## 麦克风权限与授权教程

### 先说结论

插件可以由代码发起权限申请，但不能替用户绕过浏览器或操作系统的安全确认。用户点击 🎤 时，插件会调用 `navigator.mediaDevices.getUserMedia({ audio: true })`：

1. 浏览器允许后，插件才能获得麦克风音频流。
2. macOS 还可能第一次向浏览器显示系统级授权弹窗。
3. 如果用户之前已经允许过，通常不会再次弹窗。
4. 如果用户之前拒绝过、换了浏览器或访问地址、权限被系统关闭，才需要按下面的教程重新授权。

所以你之前操作时没有看到弹窗是正常的：很可能当前浏览器和 DSH 地址已经获得过授权。正常情况下，不需要在安装前提前手动授权；第一次点击 🎤 时按提示允许即可。即使调用 Permissions API，也只能读取权限状态，不能替用户授予权限。

### 正常授权流程

1. 使用 `npx @deepseek-ai/dsh web` 启动 DSH，并在浏览器打开 DSH 页面。
2. 确认页面地址是 HTTPS 或 localhost；普通的远程 HTTP 页面会被浏览器阻止录音。
3. 第一次点击 🎤。
4. 浏览器弹出“允许使用麦克风”时，选择“允许”；如果出现选择设备的下拉框，选择实际使用的麦克风。
5. macOS 如果再次弹出系统授权窗口，选择“允许”。
6. 回到 DSH，再点击 🎤 开始录音。

### Windows 系统权限

如果 Windows 阻止了浏览器访问麦克风：

- Windows 11：打开“开始 → 设置 → 隐私和安全性 → 麦克风”。
- 打开“麦克风访问”和“允许应用访问你的麦克风”。
- 继续打开“允许桌面应用访问你的麦克风”，因为 Chrome、Edge、Firefox 通常属于桌面应用。
- Windows 10 的路径是“设置 → 隐私 → 麦克风”，打开“允许应用访问你的麦克风”。

详见 [Microsoft：打开 Windows 麦克风应用权限](https://support.microsoft.com/en-us/windows/privacy/turn-on-app-permissions-for-your-microphone-in-windows)。

### 浏览器网站权限

如果没有弹窗，或者之前误点了“阻止”，在当前 DSH 页面按下面步骤恢复：

- **Chrome**：点击地址栏左侧的锁形图标或权限图标，将“麦克风”改为“允许”，然后刷新页面。也可以打开 chrome://settings/content/microphone，在“不允许使用麦克风”中找到 DSH 地址并改为允许。
- **Edge**：点击地址栏左侧的锁形图标或权限图标，将“麦克风”改为“允许”，或打开 edge://settings/content/microphone 检查 DSH 地址。
- **Firefox**：点击地址栏左侧的权限图标，在“使用麦克风”中选择“允许”，然后刷新页面。

Chrome 的完整说明见 [Google Chrome：使用摄像头和麦克风](https://support.google.com/chrome/answer/2693767)，Firefox 的说明见 [Mozilla：管理网站的摄像头和麦克风权限](https://support.mozilla.org/en-US/kb/how-manage-your-camera-and-microphone-permissions)。

### macOS 系统权限

如果 macOS 阻止了浏览器：

1. 打开“苹果菜单 → 系统设置 → 隐私与安全性 → 麦克风”。
2. 打开正在使用的浏览器（Chrome、Edge、Firefox 或 Safari）。
3. 回到浏览器，刷新 DSH 页面，再次点击 🎤。
4. Safari 还可以在“Safari → 设置 → 网站 → 麦克风”中，把当前 DSH 网站设置为“允许”。

如果浏览器没有出现在 macOS 的麦克风列表中，先回到 DSH 页面点击一次 🎤 触发权限申请，再检查系统设置。详见 [Apple：控制 Mac 的麦克风访问权限](https://support.apple.com/en-gb/guide/mac-help/mchla1b1e1fe/mac)。

### 根据界面提示排查

- **麦克风权限未授予**：按上面的浏览器网站权限步骤设置为“允许”；macOS 还要打开系统设置中的浏览器权限。
- **当前页面不是 HTTPS/localhost**：改用 localhost 启动，或为远程 DSH 配置 HTTPS。
- **未找到麦克风设备**：检查系统声音输入设备、耳机或摄像头是否已连接。
- **麦克风被占用**：关闭 Zoom、Teams、录音软件或其他正在使用麦克风的程序后重试。

## 使用

- 点击 🎤 开始录音，再点击一次停止。
- 打开 ⚙ 设置识别引擎、模型、语言、标点、AI 精修、语境和整段模式。
- 在“本地模型管理”中查看和下载模型；绿点表示模型已下载。
- 浏览器内置 ASR 最轻量；本地 whisper 支持多语言；FunASR 更适合中文。

## 环境变量

| 变量 | 默认值 | 作用 |
|---|---|---|
| DSH_VOICE_ROOT | DSH 会话工作区 | 语音组件根目录，需包含 .voice-asr 和 .venv。 |
| DSH_VOICE_PYTHON | 根目录下的 .venv Python | 指定 Python 解释器。 |
| DSH_HOME | Windows %USERPROFILE%\.dsh；macOS ~/.dsh | 指定 DSH 配置根目录。 |
| DSH_HF_ENDPOINT | https://hf-mirror.com | Hugging Face 下载源；海外可设置为 https://huggingface.co。 |
| DSH_VOICE_DATA_ROOT | DSH_HOME/voice-input 或用户目录 .dsh/voice-input | 跨浏览器设置文件 `.voice-prefs.json`。 |
| DSH_MODEL_ROOT | 未设置时使用模型目录默认值 | 可选的模型缓存根目录；设置面板中的目录优先。 |
| HF_HOME | 模型目录下的 .hf | whisper 模型缓存（Host 按设置目录注入）。 |
| MODELSCOPE_CACHE | 模型目录下的 .modelscope | FunASR 模型缓存（Host 按设置目录注入）。 |
| DSH_ASR_API_KEY / DSH_ASR_BASE_URL | — | OpenAI 兼容云 ASR。 |
| DSH_DEEPSEEK_API_KEY | — | AI 精修。 |
| DSH_VOLC_APPID / DSH_VOLC_ACCESS_TOKEN | — | 豆包云 ASR。 |

## 隐私与限制

- 本地识别（whisper/FunASR）不会把音频发送到云端；云 ASR 和 AI 精修会把对应音频或文本发送给服务商。
- API Key 保存在本机 Host 数据目录的 `.voice-prefs.json` 中，localStorage 只作离线缓存；分发时不要内置任何 Key。
- 选择本地引擎后可在「本地模型管理」中指定目录并按需下载，期间会显示预热或下载提示。
- FunASR 主要面向普通话；whisper 支持多语言；整段模式单次录音上限为 10 分钟。
- 组件许可清单见 [voice-input-plugin/DISTRIBUTION.md](voice-input-plugin/DISTRIBUTION.md)。

## 许可

MIT。

---

# DSH Voice Input Plugin

Add voice input directly to the DSH input bar. The plugin supports realtime dictation and batch recording, with browser ASR, local whisper, FunASR, or cloud ASR backends. Transcripts can optionally be polished by AI.

[![License](https://img.shields.io/github/license/Rio-promax/dsh-voice-input)](LICENSE)
[![Release](https://img.shields.io/github/v/release/Rio-promax/dsh-voice-input)](https://github.com/Rio-promax/dsh-voice-input/releases)

## Features

- **Realtime dictation**: Speak naturally and receive text as you go; pauses split utterances automatically.
- **Batch mode**: Record first and transcribe once, useful for longer monologues.
- **Multiple ASR backends**: Browser ASR, local whisper, local FunASR for Chinese, OpenAI-compatible cloud ASR, and Doubao cloud ASR.
- **AI polishing**: Optionally fix homophones and punctuation using recent chat context.
- **Offline local inference**: Local backends work offline after their models are downloaded and do not incur API charges.

## Prerequisites

- **DSH**: Install DSH locally and make sure npx @deepseek-ai/dsh web starts successfully.
- **Python**: Python 3.9 or newer; 3.10–3.12 is recommended and Python must be on PATH.
- **Node.js**: DSH requires Node.js, npm, and npx.
- **Browser**: Chrome/Edge support browser ASR; any browser supporting getUserMedia can use recording and local backends.
- **Resources**: At least a dual-core CPU and 4GB RAM are recommended. Local models use roughly 1–1.6GB RAM and may require hundreds of MB to more than 1GB for the first download.
- **Recording permission**: Browser recording requires HTTPS or localhost; on macOS, also grant the browser microphone permission in System Settings.

> This README presents separate Windows and macOS installation paths. Linux can use the same POSIX scripts and deployment commands as macOS.

## Download

### Recommended: clone with Git

~~~bash
git clone https://github.com/Rio-promax/dsh-voice-input.git
cd dsh-voice-input
~~~

### Download as ZIP

- [Download the current main ZIP](https://github.com/Rio-promax/dsh-voice-input/archive/refs/heads/main.zip)
- [Download a stable Release](https://github.com/Rio-promax/dsh-voice-input/releases)

After downloading the ZIP, extract it completely and enter the repository root containing install.ps1, .voice-asr, and voice-input-plugin.

## Windows installation

### 1. Check the environment

Run the following in PowerShell:

~~~powershell
node --version
npx --version
python --version
~~~

If python is not found, install Python 3.9+ from [python.org](https://www.python.org/downloads/) and select **Add Python to PATH** during installation.

### 2. Stop DSH and enter the repository root

Quit any running DSH instance first. Then open PowerShell and enter the repository root:

~~~powershell
Set-Location -LiteralPath 'C:\path\to\dsh-voice-input'
~~~

### 3. Run the installer

As soon as you press Enter, install.ps1 runs **synchronously in the foreground of the current PowerShell window**. It does not wait for DSH to start, and you do not need to double-click the file. Keep the window open until “安装完成” (installation complete) is printed.

~~~powershell
pwsh -ExecutionPolicy Bypass -File .\install.ps1
~~~

If pwsh is not installed, use Windows PowerShell 5.1:

~~~powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
~~~

-ExecutionPolicy Bypass applies only to this PowerShell process and does not permanently change the system execution policy.

### 4. What install.ps1 does

The script runs the following steps in order; each ==> line shows the current progress:

1. **Locate DSH config**: It uses -DshRoot first, then DSH_HOME, then %USERPROFILE%\.dsh.
2. **Copy the plugin**: It copies the plugin to <DSH>\profiles\node_modules\dsh-plugin-voice-input and does not use a junction.
3. **Register the bundle**: It creates or incrementally updates profiles\web\cordis.patch.yml, preserving existing entries and creating a .bak-* backup when needed.
4. **Install the Python environment**: It calls voice-input-plugin\setup.ps1 to create .venv and install dependencies; large models are not downloaded by default.
5. **Print the restart prompt**: Start DSH only after the script finishes; the installer itself does not start DSH.

### 5. Common options

~~~powershell
# Explicitly set the DSH root when it is not in the default location
pwsh -ExecutionPolicy Bypass -File .\install.ps1 -DshRoot 'C:\path\to\.dsh'

# Use a mainland-China PyPI mirror
pwsh -ExecutionPolicy Bypass -File .\install.ps1 -Mirror 'https://pypi.tuna.tsinghua.edu.cn/simple'

# Register the plugin and install Python dependencies (models are not downloaded by default)
pwsh -ExecutionPolicy Bypass -File .\install.ps1 -SkipModels

# Explicitly pre-download models to a chosen directory (optional)
pwsh -ExecutionPolicy Bypass -File .\install.ps1 -WithModels -ModelRoot 'E:\DSH\models'

# Skip Python only if browser ASR is sufficient; local whisper/FunASR will be unavailable
pwsh -ExecutionPolicy Bypass -File .\install.ps1 -SkipPython
~~~

Model downloads are on demand: open Settings → Local Model Management to choose a directory and download Whisper/FunASR, or use -WithModels. With -SkipPython, run voice-input-plugin\setup.ps1 later to enable local backends.

### 6. Start DSH

The recommended approach is to start DSH from the repository root so the plugin can use the local .voice-asr and .venv directories:

~~~powershell
Set-Location -LiteralPath 'C:\path\to\dsh-voice-input'
npx @deepseek-ai/dsh web
~~~

If you must start DSH from another directory, set the voice-component root first. setx affects newly opened terminals only:

~~~powershell
setx DSH_VOICE_ROOT 'C:\path\to\dsh-voice-input'
~~~

After running setx, close and reopen PowerShell before starting DSH. After the restart, 🎤 and ⚙ should appear on the right side of the input bar.

### 7. Windows troubleshooting

- **Profiles directory not found**: Use -DshRoot or DSH_HOME to point to the actual .dsh directory.
- **No icons**: Make sure the old DSH process is stopped; press Ctrl+C in its old terminal if the port is still occupied.
- **Local ASR fails**: Check whether .venv was created; on restricted networks, rerun with -Mirror.
- **Model download is slow**: Use the PyPI mirror above in mainland China; outside China, set DSH_HF_ENDPOINT=https://huggingface.co before starting DSH.

## macOS Installation

### 1. Check the environment

Open Terminal and run:

~~~bash
node --version
npx --version
python3 --version
~~~

If python3 is not available, install Python from [python.org](https://www.python.org/downloads/) or use Homebrew:

~~~bash
brew install python
~~~

Python must be 3.9+. Intel Macs and Apple Silicon Macs use the same installation flow.

### 2. Download and enter the repository

Use the Git clone or ZIP links above. After extracting the archive, enter the repository root:

~~~bash
cd /path/to/dsh-voice-input
~~~

### 3. Install Python dependencies and local models

Stop any running DSH instance first, then run:

~~~bash
bash ./voice-input-plugin/setup.sh
~~~

This command **runs immediately and synchronously in the foreground of the current Terminal**. It creates .venv and installs dependencies; large models are not downloaded by default. Choose a directory in Local Model Management and download on demand. Keep Terminal open and continue only after “安装完成” (installation complete) appears.

On restricted networks, use a mirror or skip model pre-download:

~~~bash
# Use a mainland-China PyPI mirror
bash ./voice-input-plugin/setup.sh -m https://pypi.tuna.tsinghua.edu.cn/simple

# Models are on demand; this compatibility flag explicitly skips pre-download
bash ./voice-input-plugin/setup.sh --skip-models

# Explicitly pre-download to a chosen directory (optional)
bash ./voice-input-plugin/setup.sh --with-models --model-root /mnt/dsh-models
~~~

### 4. Deploy the plugin automatically

macOS does not have the Windows install.ps1. Paste the following block into Terminal from the repository root. It copies the plugin, creates or incrementally updates cordis.patch.yml, and backs up an existing patch before changing it. No temporary file needs to be created or moved manually.

~~~bash
set -euo pipefail

ROOT="$PWD"
PKG="$ROOT/voice-input-plugin"
DSH_ROOT="${DSH_HOME:-$HOME/.dsh}"
PROFILES="$DSH_ROOT/profiles"
DST="$PROFILES/node_modules/dsh-plugin-voice-input"
PATCH="$PROFILES/web/cordis.patch.yml"

if [ ! -f "$PKG/package.json" ]; then
  echo "Error: run this block from the repository root."
  exit 1
fi

if [ ! -d "$PROFILES" ]; then
  echo "Error: DSH profiles not found: $PROFILES"
  echo "Set DSH_HOME or change DSH_ROOT to the actual .dsh path."
  exit 1
fi

mkdir -p "$DST/lib" "$(dirname "$PATCH")"
cp "$PKG/package.json" "$DST/package.json"
cp "$PKG/host.js" "$DST/lib/index.js"
cp "$PKG/client.js" "$DST/lib/client.js"
echo "Plugin copied: $DST"

patch_block() {
  cat <<'YAML'
# Voice input plugin (installed by the macOS installation steps).
- insert:
    - id: voice-input
      name: 'dsh-plugin-voice-input'
YAML
}

if [ -f "$PATCH" ]; then
  if grep -q 'dsh-plugin-voice-input' "$PATCH"; then
    echo "Bundle already registered: $PATCH"
  else
    BACKUP="$PATCH.bak.$(date +%Y%m%d-%H%M%S)"
    cp "$PATCH" "$BACKUP"
    COMPACT="$(tr -d '[:space:]' < "$PATCH")"
    if [ -z "$COMPACT" ] || [ "$COMPACT" = "[]" ]; then
      patch_block > "$PATCH"
    else
      printf '\n' >> "$PATCH"
      patch_block >> "$PATCH"
    fi
    echo "Bundle registered: $PATCH"
    echo "Backup: $BACKUP"
  fi
else
  patch_block > "$PATCH"
  echo "Bundle created: $PATCH"
fi

echo "Deployment complete"
~~~

If DSH uses a location other than the default ~/.dsh, set the environment variable before pasting the block:

~~~bash
export DSH_HOME="$HOME/path/to/.dsh"
~~~

### 5. Start DSH

In the same Terminal, explicitly set the voice-component root before starting DSH. This works regardless of the DSH workspace:

~~~bash
export DSH_VOICE_ROOT="$PWD"
npx @deepseek-ai/dsh web
~~~

If you set export DSH_HOME=..., it also remains active in the current Terminal. After the restart, 🎤 and ⚙ should appear on the right side of the input bar.

### 6. macOS troubleshooting

- **Microphone unavailable**: Open System Settings → Privacy & Security → Microphone, allow the browser, then restart the browser.
- **Profiles directory not found**: Make sure DSH_HOME points to the .dsh directory containing profiles.
- **No icons**: Confirm that Deployment complete was printed, stop the old DSH process, and run npx @deepseek-ai/dsh web again.
- **Local model download fails**: Check network access and disk space; rerun setup.sh, which reuses existing caches.

## Microphone permissions and authorization guide

### The short answer

The plugin can request microphone access from code, but it cannot bypass the browser or operating system's security confirmation. When the user clicks 🎤, the plugin calls `navigator.mediaDevices.getUserMedia({ audio: true })`:

1. The browser must allow the request before the plugin receives an audio stream.
2. On macOS, the first request may also trigger a system-level permission dialog for the browser.
3. If permission was already granted, no dialog normally appears again.
4. Manual steps are needed only after a previous denial, when using a different browser or address, or when system privacy settings were turned off.

Therefore, it is normal that you did not see a dialog during your own test. The current browser and DSH address probably already had permission. Users do not normally need to pre-authorize the microphone before installation; they can click 🎤 for the first time and choose Allow when prompted. Even the Permissions API can only read the permission state; it cannot grant permission on the user's behalf.

### Normal authorization flow

1. Start DSH with `npx @deepseek-ai/dsh web` and open the DSH page in a browser.
2. Make sure the page uses HTTPS or localhost; a regular remote HTTP page cannot record audio.
3. Click 🎤 for the first time.
4. When the browser asks to use the microphone, choose Allow and select the intended device if a device menu appears.
5. If macOS shows a system permission dialog, choose Allow.
6. Return to DSH and click 🎤 again to start recording.

### Windows system permission

If Windows blocks the browser from using the microphone:

- Windows 11: open Start → Settings → Privacy & security → Microphone.
- Turn on Microphone access and Let apps access your microphone.
- Also turn on Let desktop apps access your microphone because Chrome, Edge, and Firefox are normally desktop apps.
- On Windows 10, open Settings → Privacy → Microphone and turn on Allow apps to access your microphone.

See [Microsoft: Turn on app permissions for your microphone in Windows](https://support.microsoft.com/en-us/windows/privacy/turn-on-app-permissions-for-your-microphone-in-windows).

### Browser site permission

If no dialog appears, or the user previously clicked Block, restore permission while viewing the DSH page:

- **Chrome**: click the lock or permissions icon to the left of the address bar, set Microphone to Allow, and reload the page. You can also open chrome://settings/content/microphone and change the DSH address from Not allowed to Allow.
- **Edge**: click the lock or permissions icon to the left of the address bar and set Microphone to Allow, or open edge://settings/content/microphone and check the DSH address.
- **Firefox**: click the permissions icon to the left of the address bar, set Use the Microphone to Allow, and reload the page.

See [Google Chrome: Use your camera and microphone](https://support.google.com/chrome/answer/2693767) and [Mozilla: Manage camera and microphone permissions](https://support.mozilla.org/en-US/kb/how-manage-your-camera-and-microphone-permissions).

### macOS system permission

If macOS blocks the browser:

1. Open Apple menu → System Settings → Privacy & Security → Microphone.
2. Enable the browser in use: Chrome, Edge, Firefox, or Safari.
3. Return to the browser, reload the DSH page, and click 🎤 again.
4. In Safari, you can also open Safari → Settings → Websites → Microphone and set the current DSH site to Allow.

If the browser is not listed in the macOS microphone panel, click 🎤 once in DSH to trigger the request, then check System Settings again. See [Apple: Control access to the microphone on Mac](https://support.apple.com/en-gb/guide/mac-help/mchla1b1e1fe/mac).

### Match the UI message to the fix

- **Microphone permission not granted**: set the browser site permission to Allow; on macOS, also enable the browser in System Settings.
- **This page is not HTTPS/localhost**: use localhost or configure HTTPS for a remote DSH deployment.
- **No microphone device found**: check the system input device, headset, or camera connection.
- **Microphone is in use**: close Zoom, Teams, recording software, or another application currently using the microphone.

## Usage

- Click 🎤 to start recording and click it again to stop.
- Use ⚙ to configure the backend, model, language, punctuation, AI polishing, context, and batch mode.
- Use Local Model Management to view or download models; a green dot means the model is ready.
- Browser ASR is the lightest option; local whisper supports more languages; FunASR is optimized for Chinese.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| DSH_VOICE_ROOT | DSH workspace | Root containing .voice-asr and .venv. |
| DSH_VOICE_PYTHON | Python inside the root .venv | Override the Python interpreter. |
| DSH_HOME | Windows %USERPROFILE%\.dsh; macOS ~/.dsh | Set the DSH config root. |
| DSH_HF_ENDPOINT | https://hf-mirror.com | Hugging Face endpoint; outside mainland China, set it to https://huggingface.co. |
| DSH_VOICE_DATA_ROOT | DSH_HOME/voice-input or ~/.dsh/voice-input | Cross-browser `.voice-prefs.json` directory. |
| DSH_MODEL_ROOT | Default model directory when unset | Optional model-cache root; the directory chosen in Settings takes priority. |
| HF_HOME | .hf inside the selected model directory | whisper model cache (injected by Host). |
| MODELSCOPE_CACHE | .modelscope inside the selected model directory | FunASR model cache (injected by Host). |
| DSH_ASR_API_KEY / DSH_ASR_BASE_URL | — | OpenAI-compatible cloud ASR. |
| DSH_DEEPSEEK_API_KEY | — | AI polishing. |
| DSH_VOLC_APPID / DSH_VOLC_ACCESS_TOKEN | — | Doubao cloud ASR. |

## Privacy and limitations

- Local whisper/FunASR keep audio on the machine; cloud ASR and AI polishing send the relevant audio or text to their providers.
- API keys are stored in the local Host data directory's `.voice-prefs.json`; localStorage is only an offline cache. Never bundle a key when distributing the plugin.
- Local models are downloaded on demand to the directory chosen in Local Model Management and show warm-up/download status.
- FunASR is primarily for Mandarin; whisper supports multiple languages; batch recordings are limited to 10 minutes.
- See [voice-input-plugin/DISTRIBUTION.md](voice-input-plugin/DISTRIBUTION.md) for the component license list.

## License

MIT.
