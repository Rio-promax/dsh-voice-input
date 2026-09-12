# DSH Voice Input Plugin

English | [简体中文](README.md)

Speak directly into the DSH composer and turn your voice into text. The plugin supports realtime dictation, batch recording, local offline recognition, and optional AI polishing.

Current stable version: **v1.2.0**

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/Rio-promax/dsh-voice-input" alt="License" height="20"></a>
  <a href="https://github.com/Rio-promax/dsh-voice-input/releases"><img src="https://img.shields.io/github/v/release/Rio-promax/dsh-voice-input" alt="Release" height="20"></a>
</p>

## Preview

<table>
  <tr>
    <td width="64%" align="center" valign="middle">
      <img src="https://github.com/user-attachments/assets/ddeb6159-99e4-431c-ad92-39883d4bf74b" alt="DSH voice input main interface" width="720"><br><br>
      <img src="https://github.com/user-attachments/assets/5054898e-3b1d-456f-9492-9922029e7de0" alt="DSH voice input toolbar" width="430">
    </td>
    <td width="36%" align="center" valign="middle">
      <img src="https://github.com/user-attachments/assets/944a0104-24d1-4ccf-9406-badf9344f962" alt="DSH voice input settings panel" width="340">
    </td>
  </tr>
</table>

## What It Can Do

- **Realtime dictation:** Recognizes speech as you talk and inserts text into the composer after a pause.
- **Batch recording:** Records a longer passage first, then transcribes it in one go.
- **Local Chinese recognition:** FunASR is optimized for Chinese, keeps audio on your computer, and has no API fees.
- **Multilingual recognition:** Local Whisper supports Chinese, English, and many other languages.
- **Browser recognition:** Works without downloading a model; availability depends on your browser and network.
- **Cloud recognition:** Supports OpenAI-compatible endpoints and services such as Doubao.
- **AI polishing:** Corrects homophones, punctuation, and conversational phrasing, with optional awareness of the current chat context.
- **Chinese and English UI:** Switch the settings panel between 中文 and English.
- **Automatic settings storage:** Your engine, model, and common options remain available after restarting DSH or switching browsers.

## Installation

Windows, macOS, and Linux use the same command:

```bash
npx @deepseek-ai/dsh plugin --profile web add dsh-plugin-voice-input
```

Restart DSH after installation:

```bash
npx @deepseek-ai/dsh web
```

Installation is successful when the **🎤** and **⚙** buttons appear beside the composer. Browser recognition requires no model download. The first time you select local Whisper or FunASR, the plugin asks for confirmation before installing the local runtime and selected model.

Source archives and previous versions remain available on the [Releases page](https://github.com/Rio-promax/dsh-voice-input/releases).

## How to Use

1. Click **🎤** beside the composer to start recording.
2. Speak normally. In realtime mode, each segment is inserted after a pause.
3. Click **🎤** again to stop recording.
4. Click **⚙** to change the recognition engine, model, language, batch mode, or AI polishing.

### Which Engine Should a Beginner Choose?

| What you need | Recommended option |
|---|---|
| Try it immediately without configuration | Browser ASR |
| Better, more private Chinese recognition | Local FunASR |
| Recognition in multiple languages | Local Whisper |
| A cloud service with your own API configuration | Cloud ASR |

Local models must be downloaded the first time they are used. Download time depends on your network; recognition can run offline afterward.

## Frequently Asked Questions

### The microphone button is missing

Fully exit the old DSH process, then run `npx @deepseek-ai/dsh web` again. If the button is still missing, repeat the installation command once.

### The browser says microphone permission is unavailable

Click the site-permissions icon beside the address bar, allow microphone access for the current page, and refresh. Windows or macOS must also allow the browser to use the microphone.

If macOS does not show a permission prompt, open **System Settings → Privacy & Security → Microphone**, allow the browser you are using, and reopen it.

### A local model downloads slowly or fails

Check your network connection, then retry from **Settings → Local Model Management**. Browser and cloud recognition do not depend on local models and can be used as temporary alternatives.

### I want a custom directory, mirror, or manual deployment

These are advanced options. See the [advanced installation and maintenance guide](voice-input-plugin/DISTRIBUTION.md). Regular users do not need environment variables or manual DSH configuration changes.

## Privacy

- With local Whisper or FunASR, recordings are processed on your computer and are not uploaded to a cloud service.
- With browser recognition or cloud ASR, audio is processed by the relevant browser vendor or service provider.
- When AI polishing is enabled, recognized text and any chat context you choose to include are sent to the configured AI service.
- API keys are stored on your computer. Do not expose them in screenshots, issues, or logs.

## Known Limitations

- Browser recognition depends on the browser and network and may be unavailable on some networks.
- A local model takes time to download and initialize on first use; later runs are much faster.
- Batch recordings are limited to 10 minutes.

## System Support

Windows, macOS, and Linux all support the same one-line npm installation. Local recognition requires Python 3.9 or later.

## License

[MIT](LICENSE)
