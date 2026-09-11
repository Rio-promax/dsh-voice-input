# DSH 语音输入插件

在 DSH 输入框里直接说话，自动变成文字。支持实时听写、整段录音、本地离线识别和 AI 精修。

当前稳定版：**v1.1**

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/Rio-promax/dsh-voice-input" alt="License" height="20"></a>
  <a href="https://github.com/Rio-promax/dsh-voice-input/releases"><img src="https://img.shields.io/github/v/release/Rio-promax/dsh-voice-input" alt="Release" height="20"></a>
</p>

## 体验预览

<table>
  <tr>
    <td width="64%" align="center" valign="middle">
      <img src="https://github.com/user-attachments/assets/ddeb6159-99e4-431c-ad92-39883d4bf74b" alt="DSH 语音输入主界面" width="720"><br><br>
      <img src="https://github.com/user-attachments/assets/5054898e-3b1d-456f-9492-9922029e7de0" alt="DSH 语音输入工具栏" width="430">
    </td>
    <td width="36%" align="center" valign="middle">
      <img src="https://github.com/user-attachments/assets/944a0104-24d1-4ccf-9406-badf9344f962" alt="DSH 语音输入设置面板" width="340">
    </td>
  </tr>
</table>

## 它能做什么

- **实时听写**：边说边识别，停顿后文字自动进入输入框。
- **整段录音**：说完后一次识别，适合较长的口述内容。
- **中文本地识别**：FunASR 更适合中文，音频不离开电脑，也不产生 API 费用。
- **多语言识别**：本地 Whisper 支持中文、英文等多种语言。
- **浏览器识别**：无需下载模型，打开就能使用；可用性取决于浏览器和网络。
- **云端识别**：支持 OpenAI 兼容接口和豆包等服务，可按自己的需要配置。
- **AI 精修**：自动修正同音字、标点和口语表达，还可以参考当前聊天语境。
- **中英文界面**：设置面板可在中文和 English 之间切换。
- **设置自动保存**：引擎、模型和常用开关会保存在本机，重启或更换浏览器后仍可使用。

## 下载

### 推荐：下载稳定版

前往 [Releases 页面](https://github.com/Rio-promax/dsh-voice-input/releases)，下载最新版本的 ZIP 压缩包。

稳定版经过版本整理，更适合普通用户长期使用。下载完成后请先**完整解压**，不要直接在压缩包内运行安装脚本。

### 想体验最新改动

也可以下载 [main 分支 ZIP](https://github.com/Rio-promax/dsh-voice-input/archive/refs/heads/main.zip)，但其中可能包含尚未发布的改动。

## Windows 安装

开始前只需确认两件事：

- DSH 至少成功启动过一次。
- 电脑已安装 Python 3.9 或更高版本。

然后按下面三步操作：

1. 完整解压下载的 ZIP。
2. 在解压后的文件夹中打开 PowerShell，运行：

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\install.ps1
   ```

3. 看到“安装完成”后，重新启动 DSH：

   ```powershell
   npx @deepseek-ai/dsh web
   ```

输入框右侧出现 **🎤** 和 **⚙**，就表示安装成功。

安装脚本会自动复制并注册插件，同时准备本地识别需要的 Python 环境。它默认不会预先下载大模型，因此首次安装更轻；当你在设置中选择本地模型并点击下载时，模型只需下载一次，以后会直接复用。

## macOS 安装

开始前请确认 DSH 至少成功启动过一次，并且电脑已安装 Python 3.9 或更高版本。

1. 从 [Releases 页面](https://github.com/Rio-promax/dsh-voice-input/releases) 下载最新稳定版并完整解压。
2. 打开“终端”，输入 `cd `（末尾留一个空格），把解压后的文件夹拖进终端窗口，然后按回车。
3. 运行下面的命令，准备本地识别环境：

   ```bash
   bash ./voice-input-plugin/setup.sh
   ```

4. 按照[苹果电脑插件安装步骤](voice-input-plugin/DISTRIBUTION.md#三-b安装步骤linux--macos)完成插件复制与注册。
5. 启动 DSH：

   ```bash
   npx @deepseek-ai/dsh web
   ```

首次点击麦克风时，macOS 会询问是否允许浏览器使用麦克风，请选择“允许”。输入框右侧出现 **🎤** 和 **⚙**，就表示安装成功。

> macOS 当前还没有和 Windows 相同的一键安装脚本，因此第 4 步需要粘贴一次部署命令。后续正常使用不需要重复安装。

## 怎么使用

1. 点击输入框右侧的 **🎤** 开始录音。
2. 正常说话；实时模式会在停顿后逐段上屏。
3. 再次点击 **🎤** 停止录音。
4. 点击 **⚙** 可以切换识别引擎、模型、语言、整段模式和 AI 精修。

### 新手怎么选引擎

| 你的需求 | 推荐选择 |
|---|---|
| 不想配置，先试试看 | 浏览器内置 ASR |
| 主要说中文，希望更准、更私密 | 本地 FunASR |
| 需要识别多种语言 | 本地 Whisper |
| 愿意配置 API，希望使用云服务 | 云 ASR |

本地模型首次使用需要下载，具体时间取决于网络速度。下载完成后可以离线识别。

## 常见问题

### 没有看到麦克风按钮

请完全退出旧的 DSH 进程，再重新运行 `npx @deepseek-ai/dsh web`。如果仍未出现，可以重新运行一次安装命令。

### 浏览器提示没有麦克风权限

点击地址栏左侧的网站权限图标，允许当前页面使用麦克风，然后刷新页面。Windows 或 macOS 也需要允许浏览器访问麦克风。

macOS 如果没有出现授权窗口，请打开“系统设置 → 隐私与安全性 → 麦克风”，允许正在使用的浏览器访问麦克风，然后重新打开浏览器。

### 本地模型下载很慢或失败

先确认网络连接，再在“设置 → 本地模型管理”中重新下载。浏览器识别和云端识别不依赖本地模型，可作为临时替代。

### 想自定义目录、镜像或手动部署

这些属于高级用法，请查看 [高级安装与维护说明](voice-input-plugin/DISTRIBUTION.md)。普通用户不需要设置环境变量，也不需要手动编辑 DSH 配置文件。

## 隐私说明

- 使用本地 Whisper 或 FunASR 时，录音在本机处理，不会上传到云端。
- 使用浏览器识别或云 ASR 时，音频会由相应的浏览器或服务商处理。
- 开启 AI 精修后，识别文字及你选择附带的聊天语境会发送给所配置的 AI 服务。
- API Key 保存在你的电脑上。请勿在截图、Issue 或日志中公开自己的 Key。

## 已知限制

- 浏览器内置识别受浏览器和网络影响，国内网络下可能不可用。
- 本地模型首次下载和首次启动会等待一段时间，之后会明显更快。
- 整段录音最长 10 分钟。

## 系统支持

Windows 提供一键安装脚本。macOS 和 Linux 也可以使用，但目前需要额外的命令行操作，详见[高级安装与维护说明](voice-input-plugin/DISTRIBUTION.md)。

## License

[MIT](LICENSE)

---

<details>
<summary>English quick start</summary>

This plugin adds voice input to the DSH composer. It supports realtime dictation, batch recording, local Whisper/FunASR, cloud ASR, and optional AI polishing.

For the most reliable download, get the latest ZIP from [GitHub Releases](https://github.com/Rio-promax/dsh-voice-input/releases), extract it completely, and run the following command from the extracted folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

Restart DSH with `npx @deepseek-ai/dsh web`. Installation is complete when the **🎤** and **⚙** buttons appear beside the composer.

Local models are downloaded only when you choose them. See the [advanced installation and maintenance guide](voice-input-plugin/DISTRIBUTION.md) for custom paths, mirrors, macOS/Linux setup, or manual deployment.

</details>
