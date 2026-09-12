# DSH 语音输入插件包

这是 DSH 语音输入插件的源码目录。普通用户请从仓库首页开始，下载稳定版并运行根目录的 `install.ps1`，无需手动复制这里的文件。

## 当前版本

- 对外版本：**1.2.0**
- 内部实现：**v64**
- 状态：npm 正式版 1.2.0
- 插件 ID：动态调试版 `vmic-1`；静态安装包 `dsh-plugin-voice-input`

## 用户功能

- 实时听写与整段录音
- 实时识别收尾预留：点停止后 1~2 秒内的迟到结果仍会上屏（期间开启新会话则照整段识别作废）
- 浏览器内置 ASR
- 本地 Whisper 多语言识别
- 本地 FunASR 中文识别
- OpenAI 兼容与豆包云 ASR
- AI 精修、聊天语境和标点优化
- 模型按需下载及保存目录选择
- 设置跨浏览器持久化
- 中文 / English 界面切换

## 普通用户安装

请查看仓库根目录的 `README.md`。Windows、macOS 和 Linux 使用同一条安装命令：

```bash
npx @deepseek-ai/dsh plugin --profile web add dsh-plugin-voice-input
```

安装完成后重启 DSH，输入栏右侧出现 **🎤** 和 **⚙** 即可使用。首次选择本地引擎时，界面会征求确认并安装本地运行组件；模型继续按需下载。

## 文件说明

| 文件 | 用途 |
|---|---|
| `client.js` | 输入栏界面、录音和交互逻辑 |
| `host.js` | 识别调度与插件 RPC |
| `requirements.txt` | 本地识别依赖 |
| `setup.ps1` / `setup.sh` | Python 环境安装 |
| `DISTRIBUTION.md` | 高级安装、跨平台部署和维护说明 |

## 高级维护

自定义模型目录、镜像、环境变量、macOS/Linux 部署、手动注册以及故障排查，请阅读 [DISTRIBUTION.md](DISTRIBUTION.md)。这些步骤不是普通 Windows 安装的必选项。

## 隐私

- 本地 Whisper/FunASR 的音频不离开本机。
- 浏览器识别和云 ASR 会把音频交给相应服务处理。
- AI 精修会发送识别文字及用户选择附带的聊天语境。
- API Key 明文保存在用户本机，不得写入分发包或提交到 GitHub。

## 版本记录

完整历史请查看仓库根目录的 `CHANGELOG.md`。README 只保留当前状态，避免安装说明被内部迭代记录淹没。
