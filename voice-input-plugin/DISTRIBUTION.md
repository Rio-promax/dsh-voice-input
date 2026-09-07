# 语音输入插件 · 分发与部署说明（面向其他使用者/集成方）

本文档说明如何把本插件交付给**其他机器/其他用户**使用，以及必须告知的限制与合规事项。

---

## 一、组件构成

| 组件 | 路径 | 说明 |
|---|---|---|
| 插件包 | `voice-input-plugin\`（npm 包 `dsh-plugin-voice-input`） | Host/Client 半区 + 部署脚本 |
| ASR 调度器 | `.voice-asr\transcribe.py` | 多后端调度（faster-whisper / FunASR / OpenAI 兼容 / 豆包 / DeepSeek 精修） |
| Python 依赖 | `requirements.txt` | faster-whisper + httpx + FunASR ONNX（onnxruntime，**无 torch**） |
| 安装/部署脚本 | `install.ps1`（Windows 一键安装）/ `setup.ps1`（仅 Python 依赖） | 注册插件、创建 venv、安装依赖；模型可选预下载 |
| 模型缓存 | `<模型目录>\.hf`（whisper）、`<模型目录>\.modelscope`（FunASR） | 模型按需下载，目录可在设置中选择，**不随包分发** |

## 二、安装前提（使用者侧）

- Python 3.9+（建议 3.10-3.12），安装时加入 PATH
- Node.js `22.19+` 或 `24+`，并确保 `npm`/`npx` 可用
- 先运行一次 `npx @deepseek-ai/dsh web --no-open` 初始化 DSH web profile，启动后按 Ctrl+C 停止
- 浏览器：Chrome/Edge（实时识别）或任意支持 `getUserMedia` 的浏览器（听写/整段/FunASR）
- 资源：建议双核 CPU + ≥4GB 内存；模型常驻约 1GB 内存
- 首次运行需联网下载模型（whisper ~0.1-3GB 可选；FunASR paraformer ~450MB + VAD ~30MB，可选标点模型 ~450MB）

## 三、安装步骤（Windows）

```powershell
# 1. 克隆/复制整个仓库，并从仓库根目录执行
# 2. 一键安装插件、注册组合并安装 Python 依赖（默认不下载模型）
pwsh -ExecutionPolicy Bypass -File .\install.ps1 -Mirror https://pypi.tuna.tsinghua.edu.cn/simple
#    -WithModels       明确预下载 FunASR ASR + VAD 模型
#    -ModelRoot E:\DSH\models  把预下载模型放到指定目录
#    -SkipModels       跳过模型预下载（默认行为）
# 3. 如需浏览器内置 ASR，可用 -SkipPython 跳过 Python 依赖
# 4. 重启 DSH
npx @deepseek-ai/dsh web
```

## 三-b、安装步骤（Linux / macOS）

功能全平台可用（浏览器录音 / 本地 whisper / FunASR / 云后端均无平台限制；
Host 路径已按 POSIX 自适应）。`setup.ps1` 与 `install.ps1` 为 Windows 专用，
Linux/macOS 使用 `setup.sh` + 手动部署：

```bash
# 1. 安装依赖（可选 -m 指定 pip 镜像）
bash voice-input-plugin/setup.sh -m https://pypi.tuna.tsinghua.edu.cn/simple
#    --skip-models  兼容旧参数，跳过模型预下载（模型在设置中按需下载）

# 2. 手动部署插件到 dsh profiles（Linux/macOS 无 install.ps1）
mkdir -p ~/.dsh/profiles/node_modules/dsh-plugin-voice-input/lib
cp voice-input-plugin/package.json ~/.dsh/profiles/node_modules/dsh-plugin-voice-input/
cp voice-input-plugin/host.js    ~/.dsh/profiles/node_modules/dsh-plugin-voice-input/lib/index.js
cp voice-input-plugin/client.js  ~/.dsh/profiles/node_modules/dsh-plugin-voice-input/lib/client.js

# 3. 注册组合：编辑 ~/.dsh/profiles/web/cordis.patch.yml（保留原有内容，追加）：
#    - insert:
#        - id: voice-input
#          name: 'dsh-plugin-voice-input'

# 4. 重启 dsh
npx @deepseek-ai/dsh web
```

macOS 首次录音需在「系统设置 → 隐私与安全性 → 麦克风」授权浏览器；
Linux 需 PulseAudio/PipeWire 正常工作。

## 四、可配置环境变量（可移植化的关键）

| 变量 | 默认 | 说明 |
|---|---|---|
| `DSH_VOICE_ROOT` | 会话工作区 → 当前进程目录 | 语音组件根目录（含 `.voice-asr`、`.venv`） |
| `DSH_VOICE_PYTHON` | `<root>\.venv\Scripts\python.exe`（Windows）/ `bin/python` | 指定 Python 解释器 |
| `DSH_VOICE_DATA_ROOT` | `DSH_HOME\voice-input` 或用户目录 `.dsh\voice-input` | 跨浏览器设置文件 `.voice-prefs.json` 的目录 |
| `DSH_MODEL_ROOT` | `<root>` | 预留的模型根目录环境变量；UI/安装参数优先 |
| `DSH_HF_ENDPOINT` | `https://hf-mirror.com` | HuggingFace 镜像；海外用户设 `https://huggingface.co` |
| `HF_HOME` | `<模型目录>\.hf` | whisper 模型缓存（Host 会按 UI 目录注入） |
| `MODELSCOPE_CACHE` | `<模型目录>\.modelscope` | FunASR 模型缓存（Host 会按 UI 目录注入） |
| `DSH_ASR_API_KEY` / `DSH_ASR_BASE_URL` | — | OpenAI 兼容云 ASR |
| `DSH_DEEPSEEK_API_KEY` | — | AI 精修（DeepSeek） |
| `DSH_VOLC_APPID` / `DSH_VOLC_ACCESS_TOKEN` | — | 豆包（火山引擎） |

> 兼容性：不再包含任何个人机器的硬编码路径。新部署请通过 `DSH_VOICE_ROOT` 或 DSH 当前工作区解析；若找不到 `.voice-asr\transcribe.py`，界面会显示可读的本地环境错误。

## 五、必须告知使用者的限制与提示（文档/README 文案）

1. **隐私与数据流向**
   - 本地识别（faster-whisper / FunASR）：音频**不出本机**。
   - 云 ASR（OpenAI 兼容 / 豆包）与 AI 精修（DeepSeek）：会把音频/文本发送给对应第三方服务。
   - API Key 明文存储在本机 Host 数据目录 `.voice-prefs.json`（`DSH_VOICE_DATA_ROOT` 可指定），localStorage 只作离线缓存；仅保存在使用者自己机器上，**分发方不得内置任何 Key**。
2. **HTTPS 要求**：浏览器录音（getUserMedia）仅在 **HTTPS 或 localhost** 下可用；远程部署必须配置 HTTPS，否则麦克风按钮不可用（界面会提示）。
3. **按需下载**：安装本体与 Python 依赖不会自动下载大模型；在「设置 → 本地模型管理」中选择目录后点击「下载」，或显式运行 `setup.ps1 -WithModels`。首次识别前可能需要等待模型下载/预热（数百 MB 至数 GB）。
4. **资源占用**：本地模型常驻内存约 1GB（FunASR）~1.5GB（whisper medium 以上）；整段模式单次识别数分钟音频时 CPU 占用持续数秒至数分钟。
5. **功能边界**：FunASR 仅普通话；whisper 多语言；整段模式录音上限 10 分钟；云 ASR 一句话识别有服务商自身限制。
6. **许可合规（可商用，但需保留署名/许可声明）**：

| 组件 | 许可 |
|---|---|
| faster-whisper（[SYSTRAN](https://github.com/SYSTRAN/faster-whisper)） | MIT |
| ctranslate2 | MIT |
| Whisper 模型权重（[OpenAI](https://github.com/openai/whisper)） | MIT |
| FunASR 工具包（[modelscope/FunASR](https://github.com/modelscope/FunASR)） | Apache-2.0 |
| FunASR 模型（paraformer-zh 等，ModelScope/HF） | 以各模型页标注为准（大多可免费商用，建议集成时逐一核验并保留模型卡） |
| onnxruntime / onnx | MIT |
| 本插件代码 | MIT |

7. **故障提示**：首次识别慢/失败多为模型下载问题（网络/镜像）；云后端报错会原样显示服务商错误码，请核对 Key 与额度。

## 六、打包建议

- 插件本体可发布为 npm 包（`package.json` 已含 `exports["./client"]` 与 `dsh.client` 声明）；模型与 venv **不随包分发**（体积与再分发许可考虑），由设置面板或显式安装参数按需下载。
- 组合注册：Windows 使用仓库根目录的 `install.ps1` 幂等追加 `cordis.patch.yml` 的 `voice-input` 行；Linux/macOS 按上面的手动步骤追加（只增改自己的 insert 区块，勿整体覆盖共享 patch 文件）。
- 跨平台：`transcribe.py` 与 Host 路径处理已按 Windows/POSIX 自适应（`.venv\Scripts` vs `.venv\bin`）；`setup.ps1` 仅 Windows，Linux/macOS 使用者按 requirements.txt 手动建 venv 即可。
