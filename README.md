# DSH 语音输入插件

[English](README.en.md) | 简体中文

在 DSH 输入框里直接说话，自动变成文字。支持实时听写、整段录音、本地离线识别和 AI 精修。

当前稳定版：**v1.2.0**

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/Rio-promax/dsh-voice-input" alt="License" height="20"></a>
  <a href="https://github.com/Rio-promax/dsh-voice-input/releases"><img src="https://img.shields.io/github/v/release/Rio-promax/dsh-voice-input" alt="Release" height="20"></a>
</p>

## 功能

- **实时听写**：边说边识别，停顿后文字自动进入输入框。
- **整段录音**：说完后一次识别，适合较长的口述内容。
- **本地离线识别**：提供多种本地模型下载，FunASR 更适合中文，本地 Whisper 支持中文、英文等多种语言。
- **浏览器识别**：无需下载模型，打开就能使用；可用性取决于浏览器和网络。
- **云端识别**：支持 OpenAI 兼容接口和豆包等服务，可按自己的需要配置。
- **AI 精修**：多种AI接口，自定义promote，自动修正同音字、标点和口语表达，还可以参考当前聊天语境，大幅度提高生成质量。
- **设置自动保存**：引擎、模型和常用开关会保存在本机，重启或更换浏览器后仍可使用。
  
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


## 安装


```bash
npx @deepseek-ai/dsh plugin --profile web add dsh-plugin-voice-input
```

安装完成后重启 DSH：

```bash
npx @deepseek-ai/dsh web
```

输入框右侧出现 **🎤** 和 **⚙**，就表示安装成功。浏览器识别无需下载模型；第一次选择本地 Whisper 或 FunASR 时，插件会先征求确认，再安装本地运行组件和所选模型。

源码与历史版本仍可在 [Releases 页面](https://github.com/Rio-promax/dsh-voice-input/releases) 下载。

如果麦克风按钮未成功显示，请完全退出旧的 DSH 进程，再重新运行 `npx @deepseek-ai/dsh web`。如果仍未出现，可以重新运行一次安装命令。

## 怎么使用

1. 点击输入框右侧的 **🎤** 开始录音。
2. 正常说话；实时模式会在停顿后逐段上屏。
3. 再次点击 **🎤** 停止录音。
4. 点击 **⚙** 可以切换识别引擎、模型、语言、整段模式和 AI 精修。

### 新手怎么选引擎

| 你的需求 | 推荐选择 | 
|---|---|
| 不想配置，先试试看 | 浏览器（推荐谷歌、Edge）内置 ASR |
| 主要说中文，希望更准、更私密 | 本地 FunASR |
| 需要识别多种语言 | 本地 Whisper |
| 愿意配置 API，希望使用云服务 | 云 ASR |

本地模型首次使用需要下载，具体时间取决于网络速度。下载完成后可以离线识别。

## 产品限制
- 浏览器内置识别受浏览器和网络影响，部分浏览器无asr功能，因此谷歌、Edge浏览器最佳
- 切换到本地模型后，系统进行加载，首次识别需等待一段时间加载（一般为20s-40s），之后会恢复正常。
- 整段录音最长 10 分钟。

## 隐私说明

- 使用本地 Whisper 或 FunASR 时，录音在本机处理，不会上传到云端。
- 使用浏览器识别或云 ASR 时，音频会由相应的浏览器或服务商处理。
- 开启 AI 精修后，识别文字及你选择附带的聊天语境会发送给所配置的 AI 服务。
- API Key 保存在你的电脑上。请勿在截图、Issue 或日志中公开自己的 Key。

## 系统支持

Windows、macOS 和 Linux 均支持 npm 一行安装；本地识别需要 Python 3.9 或更高版本。

## License

[MIT](LICENSE)

---

<details>
<summary>English quick start</summary>

This plugin adds voice input to the DSH composer. It supports realtime dictation, batch recording, local Whisper/FunASR, cloud ASR, and optional AI polishing.

Windows, macOS, and Linux use the same installation command:

```bash
npx @deepseek-ai/dsh plugin --profile web add dsh-plugin-voice-input
```

Restart DSH with `npx @deepseek-ai/dsh web`. Installation is complete when the **🎤** and **⚙** buttons appear beside the composer.

Local components and models are installed only after you select a local engine and confirm the prompt. See the [full English guide](README.en.md) or the [advanced installation and maintenance guide](voice-input-plugin/DISTRIBUTION.md).

</details>
