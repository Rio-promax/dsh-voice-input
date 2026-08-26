#!/usr/bin/env python3
"""DSH voice-input ASR dispatcher.

Reads base64-encoded WAV (16 kHz mono 16-bit PCM) from stdin and
transcribes through a pluggable backend:

  --probe                       list available backends/models as JSON
  --backend local|funasr|openai|volc
                                backend id (default: local)
  --model <name>                model id (local: tiny/base/small/medium/large-v3;
                                funasr: paraformer-zh; openai: whisper-1 or any server model)
  --lang <code|auto>            language hint (default: auto)
  --beam <1|5>                  decoding beam (quality vs latency)
  --chat                        DeepSeek AI polish (reads JSON envelope from stdin)
  --serve                       persistent local worker (JSON lines protocol)

Environment:
  DSH_ASR_API_KEY   - API key for the openai-compatible backend
  DSH_ASR_BASE_URL  - base URL, default https://api.openai.com/v1
  HF_HOME           - huggingface cache dir (local backend)
  HF_ENDPOINT       - huggingface mirror (default hf-mirror.com; 海外可设
                      DSH_HF_ENDPOINT=https://huggingface.co 覆盖)
  DSH_VOICE_ROOT    - 语音组件根目录（默认当前工作目录）
  MODELSCOPE_CACHE  - FunASR 模型缓存（默认 <root>/.modelscope）
"""
import base64
import io
import json
import os
import sys
import time

os.environ.setdefault("HF_ENDPOINT", os.environ.get("DSH_HF_ENDPOINT") or "https://hf-mirror.com")
os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
# v37 可移植化：模型缓存默认落在工作区内（whisper 用 HF_HOME=.hf，由 Host 侧注入；
# ModelScope 缓存默认 <root>/.modelscope，FunASR 用；SDK 会话目录默认 <root>/.modelscope-home）；
# 三者均可被用户环境变量覆盖（MODELSCOPE_HOME 必须指向可写目录）。
_voice_root = os.environ.get("DSH_VOICE_ROOT") or os.getcwd()
os.environ.setdefault("MODELSCOPE_CACHE", os.path.join(_voice_root, ".modelscope"))
os.environ.setdefault("MODELSCOPE_HOME", os.path.join(_voice_root, ".modelscope-home"))

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

LOCAL_MODELS = ["tiny", "base", "small", "medium", "large-v3"]
OPENAI_MODELS = ["whisper-1", "whisper-large-v3-turbo"]

# v37：FunASR（阿里达摩院开源，ONNX 本地推理，无 torch）。
# 短名 → ModelScope ONNX 仓库；自动下载到 MODELSCOPE_CACHE。
FUNASR_MODELS = ["paraformer-zh"]
FUNASR_MODEL_IDS = {
    "paraformer-zh": "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-onnx",
}
FUNASR_VAD_ID = "iic/speech_fsmn_vad_zh-cn-16k-common-onnx"
FUNASR_PUNC_ID = "iic/punc_ct-transformer_cn-en-common-vocab471067-large-onnx"
FUNASR_MODEL_INFO = {
    "paraformer-zh": {"params": "220M", "size": "约450MB", "note": "中文工业级（asr+vad+punc 共约 0.9GB）"},
}
_funasr_cache = {}

# Exact model facts (OpenAI Whisper open weights, faster-whisper ctranslate2 ports).
MODEL_INFO = {
    "tiny":     {"params": "39M",   "size": "约75MB",   "note": "应急档，中文质量差"},
    "base":     {"params": "74M",   "size": "约145MB",  "note": "入门档（当前默认），中文一般"},
    "small":    {"params": "244M",  "size": "约480MB",  "note": "推荐档，中文与标点明显提升"},
    "medium":   {"params": "769M",  "size": "约1.5GB",  "note": "高质档，CPU 较慢"},
    "large-v3": {"params": "1550M", "size": "约3GB",    "note": "最强档，CPU 吃力，建议云端"},
}

# Punctuation-encouraging prompt, per language. Whisper mirrors the style of
# the initial prompt, which measurably improves punctuation recall.
PROMPTS = {
    "zh": "以下是普通话的句子，请使用正确的标点符号。",
    "en": "Transcribe the following English speech with correct punctuation.",
    "ja": "以下は日本語の文です。正しい句読点を使用してください。",
    "ko": "다음은 한국어 문장입니다. 올바른 구두점을 사용하세요.",
}

# v30: whisper 会把 initial_prompt 原样“回声”出来（短块/含混音频时尤其常见），
# 导致 UI 上屏「使用正确的标点符号」之类的乱文。识别后剥离已知 prompt 文本。
PROMPT_ECHO_FRAGMENTS = [
    "以下是普通话的句子，请使用正确的标点符号。",
    "以下是普通话的句子，请使用正确的标点符号",
    "请使用正确的标点符号。",
    "请使用正确的标点符号",
    "Transcribe the following English speech with correct punctuation.",
    "以下は日本語の文です。正しい句読点を使用してください。",
    "다음은 한국어 문장입니다. 올바른 구두점을 사용하세요.",
]


def _strip_prompt_echo(text):
    """Drop whole/leading occurrences of known initial-prompt strings."""
    if not text:
        return text
    for frag in PROMPT_ECHO_FRAGMENTS:
        if text == frag:
            return ""
        if text.startswith(frag):
            text = text[len(frag):].strip()
    return text


def fail(code, message):
    print(json.dumps({"error": message}, ensure_ascii=False), file=sys.stderr)
    sys.exit(code)


def probe():
    local_ok = False
    try:
        import faster_whisper  # noqa: F401
        local_ok = True
    except Exception:
        local_ok = False
    funasr_ok = False
    try:
        import funasr_onnx_automodel  # noqa: F401
        funasr_ok = True
    except Exception:
        funasr_ok = False
    openai_key = os.environ.get("DSH_ASR_API_KEY")
    base = os.environ.get("DSH_ASR_BASE_URL", "https://api.openai.com/v1")
    deepseek_key = os.environ.get("DSH_DEEPSEEK_API_KEY") or os.environ.get("DEEPSEEK_API_KEY")
    volc_appid = os.environ.get("DSH_VOLC_APPID")
    volc_token = os.environ.get("DSH_VOLC_ACCESS_TOKEN")
    print(json.dumps({
        "backends": [
            {
                "id": "local",
                "kind": "asr",
                "label": "本地 faster-whisper（免费·离线）",
                "available": local_ok,
                "models": LOCAL_MODELS,
                "hint": "模型按需下载（HF 镜像），越大越准但越慢",
            },
            {
                "id": "funasr",
                "kind": "asr",
                "label": "FunASR 中文（免费·离线·ONNX）",
                "available": funasr_ok,
                "models": FUNASR_MODELS,
                "hint": "阿里达摩院开源中文模型（paraformer-zh），中文识别明显优于 whisper base/small；首次使用自动下载（ModelScope，约 450MB + 标点模型）",
            },
            {
                "id": "openai",
                "kind": "asr",
                "label": "OpenAI 兼容云 ASR",
                "available": bool(openai_key),
                "models": OPENAI_MODELS,
                "hint": "设置环境变量 DSH_ASR_API_KEY 后可用（DSH_ASR_BASE_URL 可换端点，如 Groq/硅基流动）",
            },
            {
                "id": "volc",
                "kind": "asr",
                "label": "豆包（火山引擎）语音识别",
                "available": bool(volc_appid and volc_token),
                "models": ["bigmodel"],
                "hint": "专有 v3 协议（非 OpenAI 兼容）：需 DSH_VOLC_APPID / DSH_VOLC_ACCESS_TOKEN（可选 DSH_VOLC_CLUSTER）；文档 docs.volcengine.com/docs/6561/1798094",
            },
            {
                "id": "polish",
                "kind": "polish",
                "label": "DeepSeek AI 精修（纠错/标点）",
                "available": bool(deepseek_key),
                "models": [],
                "hint": "粗识别后由 DeepSeek 后台纠错+补标点；需设置环境变量 DSH_DEEPSEEK_API_KEY（可选 DSH_DEEPSEEK_BASE_URL）",
            },
        ]
    }, ensure_ascii=False))
    return 0


def transcribe_local(data, model, lang, beam):
    try:
        from faster_whisper import WhisperModel
    except ImportError as e:
        fail(3, "本地识别组件（faster-whisper）未安装：%s" % e)
    try:
        whisper = WhisperModel(model, device="cpu", compute_type="int8")
    except Exception as e:
        fail(4, "本地模型加载失败（%s）：%s" % (model, e))
    try:
        text = do_local(whisper, data, lang, beam)
    except RuntimeError as e:
        fail(5, str(e))
    except ValueError as e:
        fail(6, str(e))
    print(text)
    return 0


def do_local(whisper, data, lang, beam):
    """Transcribe one WAV chunk with an already-loaded model.

    vad_filter=False: the browser-side VAD already cuts speech chunks; a
    second Silero VAD pass inside faster-whisper discards short chunks
    (0.35-1s) as "no speech", which caused frequent empty results.
    condition_on_previous_text=False: each chunk is independent; carrying
    previous text into a short chunk only invites hallucination pollution.
    """
    language = None if lang == "auto" else lang
    # v30: 短块（<1.2s）不注入 initial_prompt——prompt 回声主要发生在短块/含混音频上；
    # 正常句子仍保留标点提示。1.2s 16kHz 16bit mono = 38400 字节。
    initial_prompt = None
    if len(data) >= 38400:
        initial_prompt = PROMPTS.get(language or "zh")
    try:
        segments, _info = whisper.transcribe(
            io.BytesIO(data),
            language=language,
            vad_filter=False,
            beam_size=int(beam),
            condition_on_previous_text=False,
            initial_prompt=initial_prompt,
        )
        text = _strip_prompt_echo("".join(seg.text for seg in segments).strip())
    except Exception as e:
        raise RuntimeError("识别失败：%s" % e)
    if not text:
        raise ValueError("未检测到语音")
    return text


def _emit(obj):
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def serve():
    """Persistent worker: JSON request lines on stdin, JSON response lines on stdout.

    Request:  {"id": <n>, "op": "transcribe", "backend": "local"|"funasr",
               "wavBase64": "...", "model": "base", "lang": "zh", "beam": 1}
    Response: {"id": <n>, "ok": true, "text": "..."}
              {"id": <n>, "ok": false, "error": "..."}

    Prewarm:  {"id": <n>, "op": "load", "backend": ..., "model": "base"}
    Response: {"id": <n>, "ok": true, "cached": bool, "ms": <load ms>}
              {"id": <n>, "ok": false, "error": "..."}

    Local models (faster-whisper / FunASR) are loaded once and cached by
    backend+model, so a whole dictation session pays the (3-10s) model load
    only on the first chunk. The process stays alive until stdin closes; the
    Host side restarts it on crash/timeout.
    """
    models = {}
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except Exception:
            continue
        rid = req.get("id")
        if rid is None:
            continue
        backend = req.get("backend") or "local"
        if req.get("op") == "load":
            # v29：预热——只加载模型到进程缓存，不做转写。
            # 客户端在「选择本地引擎 / 按下录音」时提前调用，把首句的
            # 3-10s 模型加载成本挪到真正说话之前。
            try:
                model = req.get("model") or "base"
                key = backend + ":" + model
                already = key in models
                t0 = time.perf_counter()
                if not already:
                    if backend == "funasr":
                        models[key] = _load_funasr(model)
                    else:
                        from faster_whisper import WhisperModel
                        models[key] = WhisperModel(model, device="cpu", compute_type="int8")
                _emit({"id": rid, "ok": True, "cached": already,
                       "ms": int((time.perf_counter() - t0) * 1000)})
            except Exception as e:
                _emit({"id": rid, "ok": False, "error": str(e)})
            continue
        if req.get("op") != "transcribe":
            _emit({"id": rid, "ok": False, "error": "未知操作"})
            continue
        try:
            wav = req.get("wavBase64") or ""
            data = base64.b64decode(wav)
            model = req.get("model") or "base"
            lang = req.get("lang") or "zh"
            beam = int(req.get("beam") or 1)
            key = backend + ":" + model
            if key not in models:
                if backend == "funasr":
                    models[key] = _load_funasr(model)
                else:
                    from faster_whisper import WhisperModel
                    models[key] = WhisperModel(model, device="cpu", compute_type="int8")
            if backend == "funasr":
                text = do_funasr(models[key], data)
            else:
                text = do_local(models[key], data, lang, beam)
            _emit({"id": rid, "ok": True, "text": text})
        except ValueError as e:
            _emit({"id": rid, "ok": False, "error": str(e)})
        except Exception as e:
            _emit({"id": rid, "ok": False, "error": str(e)})
    return 0


def _resolve_funasr_id(model):
    """Map short name → ModelScope ONNX repo id（含 / 的视为完整 id 直传）。"""
    if "/" in (model or ""):
        return model
    return FUNASR_MODEL_IDS.get(model, FUNASR_MODEL_IDS["paraformer-zh"])


def _load_funasr(model):
    """Load (and cache) the AutoModel pipeline: VAD → paraformer ASR → Punc."""
    key = _resolve_funasr_id(model)
    if key in _funasr_cache:
        return _funasr_cache[key]
    from funasr_onnx_automodel import AutoModel
    try:
        am = AutoModel(
            model=key,
            vad_model=FUNASR_VAD_ID,
            punc_model=FUNASR_PUNC_ID,
            quantize=True,
            device_id="-1",
            intra_op_num_threads=4,
        )
    except Exception as e:
        raise RuntimeError("FunASR 模型加载失败（%s）：%s" % (model, e))
    _funasr_cache[key] = am
    return am


def do_funasr(am, data):
    """Transcribe one WAV (16k mono PCM bytes) with the loaded FunASR pipeline.

    VAD 路径内部用 librosa.load(input, sr=16000)——传入 BytesIO 即可
    （soundfile 支持 file-like），避免临时文件与采样率转换。
    """
    try:
        res = am.generate(io.BytesIO(data))
        text = ""
        for item in res or []:
            if isinstance(item, dict):
                text += item.get("text") or ""
            elif item:
                text += str(item)
        text = text.strip()
    except RuntimeError:
        raise
    except Exception as e:
        raise RuntimeError("FunASR 识别失败：%s" % e)
    if not text:
        raise ValueError("未检测到语音")
    return text


def transcribe_funasr(data, model, lang, beam):
    try:
        import funasr_onnx_automodel  # noqa: F401
    except ImportError as e:
        fail(3, "FunASR ONNX 组件未安装（funasr-onnx / funasr-onnx-automodel）：%s" % e)
    try:
        text = do_funasr(_load_funasr(model), data)
    except RuntimeError as e:
        fail(5, str(e))
    except ValueError as e:
        fail(6, str(e))
    print(text)
    return 0


def transcribe_openai(data, model, lang, base):
    import httpx
    key = os.environ.get("DSH_ASR_API_KEY")
    if not key:
        fail(7, "未设置云识别 API Key（DSH_ASR_API_KEY）")
    url = base.rstrip("/") + "/audio/transcriptions"
    payload = {"model": model}
    if lang and lang != "auto":
        payload["language"] = lang
    payload["response_format"] = "json"
    try:
        r = httpx.post(
            url,
            headers={"Authorization": "Bearer " + key},
            files={"file": ("audio.wav", data, "audio/wav")},
            data=payload,
            timeout=120,
        )
    except Exception as e:
        fail(8, "云识别请求失败（网络错误）：%s" % e)
    if r.status_code != 200:
        fail(9, "云识别服务返回错误（HTTP %s）：%s" % (r.status_code, r.text[:300]))
    try:
        text = r.json().get("text", "").strip()
    except Exception:
        fail(10, "云识别返回数据格式错误：%s" % r.text[:300])
    if not text:
        fail(11, "云识别未返回文本")
    print(text)
    return 0


def transcribe_volc(data, appid, token, cluster):
    """Volcengine Doubao ASR (non-streaming v3 /api/v3/auc).

    Proprietary protocol (NOT OpenAI-compatible): AppID + Access Token auth.
    Reference: https://docs.volcengine.com/docs/6561/1798094 (recording-file
    recognition); auth: https://docs.volcengine.com/docs/6561/107789
    """
    import httpx
    if not appid or not token:
        fail(19, "未设置豆包 AppID / Access Token（DSH_VOLC_APPID / DSH_VOLC_ACCESS_TOKEN）")
    url = "https://openspeech.bytedance.com/api/v3/auc"
    body = {
        "app": {"appid": appid, "token": token, "cluster": cluster or "volcengine_input_common"},
        "user": {"uid": "dsh-voice-input"},
        "audio": {"format": "wav", "rate": 16000, "bits": 16, "channel": 1, "data": data},
        "request": {"model_name": "bigmodel", "enable_punc": True, "enable_itn": True, "language": "zh-CN"},
    }
    try:
        r = httpx.post(url, json=body, timeout=120)
    except Exception as e:
        fail(20, "豆包识别请求失败（网络错误）：%s" % e)
    try:
        parsed = r.json()
    except Exception:
        fail(21, "豆包返回数据格式错误：%s" % r.text[:300])
    code = parsed.get("code")
    if code != 0:
        # Surface the vendor's code/message verbatim for troubleshooting.
        fail(22, "豆包识别失败（错误码 %s）：%s" % (code, parsed.get("message", r.text[:200])))
    text = (parsed.get("result") or "").strip()
    if not text:
        fail(23, "豆包未返回识别结果：%s" % r.text[:200])
    print(text)
    return 0


def list_local_models():
    """Report local model download state（FunASR 在前，whisper 在后，统一本地模型管理）."""
    # v43：FunASR 下载状态——检查 ModelScope 缓存中对应 ONNX 仓库目录
    ms_root = os.path.join(os.environ.get("MODELSCOPE_CACHE", os.path.expanduser("~/.cache/modelscope")), "models")
    funasr_models = []
    for m in FUNASR_MODELS:
        org, repo = FUNASR_MODEL_IDS[m].split("/", 1)
        # ModelScope 缓存结构：<cache>/models/<org>--<repo>/snapshots/...
        marker = os.path.join(ms_root, org + "--" + repo)
        downloaded = os.path.isdir(os.path.join(marker, "snapshots"))
        info = FUNASR_MODEL_INFO.get(m, {})
        funasr_models.append({
            "id": m,
            "backend": "funasr",
            "downloaded": os.path.isdir(marker),
            "params": info.get("params", ""),
            "size": info.get("size", ""),
            "note": info.get("note", ""),
        })
    cache_root = os.path.join(os.environ.get("HF_HOME", os.path.expanduser("~/.cache/huggingface")), "hub")
    models = []
    for m in LOCAL_MODELS:
        marker = os.path.join(cache_root, "models--Systran--faster-whisper-" + m)
        models.append({
            "id": m,
            "backend": "local",
            "downloaded": os.path.isdir(marker),
            "params": MODEL_INFO[m]["params"],
            "size": MODEL_INFO[m]["size"],
            "note": MODEL_INFO[m]["note"],
        })
    print(json.dumps({"ok": True, "models": funasr_models + models,
                      "cacheDir": "whisper: " + cache_root + "；FunASR: " + ms_root}, ensure_ascii=False))
    return 0


def download_model(model):
    """Pre-download one local model (loads it via the backend = caches it)."""
    if model in FUNASR_MODELS or "/" in (model or ""):
        # v37：FunASR 模型（paraformer-zh 等）——实例化 AutoModel 即完成下载
        try:
            _load_funasr(model)
        except Exception as e:
            fail(18, "FunASR 模型下载/加载失败（%s）：%s" % (model, e))
        print(json.dumps({"ok": True, "model": model}, ensure_ascii=False))
        return 0
    if model not in LOCAL_MODELS:
        fail(17, "未知模型：%s" % model)
    try:
        from faster_whisper import WhisperModel
    except ImportError as e:
        fail(3, "本地识别组件（faster-whisper）未安装：%s" % e)
    try:
        WhisperModel(model, device="cpu", compute_type="int8")
    except Exception as e:
        fail(18, "模型下载/加载失败（%s）：%s" % (model, e))
    print(json.dumps({"ok": True, "model": model}, ensure_ascii=False))
    return 0


def transcribe_chat(payload):
    """Coarse-ASR polish via DeepSeek chat (OpenAI-compatible).

    Reads a JSON envelope {"text": ..., "before": ..., "after": ...} from
    stdin (raw text also accepted for backward compatibility); prints the
    polished text. The surrounding draft context lets the LLM disambiguate
    homophones and accent-driven errors, not just fix punctuation.
    """
    import httpx
    key = os.environ.get("DSH_DEEPSEEK_API_KEY") or os.environ.get("DEEPSEEK_API_KEY")
    if not key:
        fail(12, "未设置精修 API Key（DSH_DEEPSEEK_API_KEY）")
    text = (payload.get("text") or "").strip()
    if not text:
        fail(2, "精修文本为空")
    before = (payload.get("before") or "").strip()[-400:]
    after = (payload.get("after") or "").strip()[:200]
    # v51：最近聊天记录——客户端以结构化消息数组 [{role, content}] 传入（≤6 条、合计 ≤1200 字，
    # 完整消息优先），作为多轮历史消息注入 messages（前缀稳定 → DeepSeek 磁盘缓存命中最大化）；
    # 兼容旧版字符串格式（"用户：…/助手：…"逐行解析）。
    chat_ctx = payload.get("context") or []
    chat_msgs = []
    if isinstance(chat_ctx, list):
        for m in chat_ctx:
            if isinstance(m, dict) and m.get("content"):
                role = "assistant" if m.get("role") == "assistant" else "user"
                content = str(m["content"]).strip()
                if content:
                    chat_msgs.append({"role": role, "content": content[:1200]})
    elif isinstance(chat_ctx, str):
        for line in chat_ctx.splitlines():
            line = line.strip()
            if not line:
                continue
            if line.startswith("用户："):
                chat_msgs.append({"role": "user", "content": line[3:][:1200]})
            elif line.startswith("助手："):
                chat_msgs.append({"role": "assistant", "content": line[3:][:1200]})
    # 合并相邻同角色消息（部分 OpenAI 兼容网关不允许连续相同角色）
    merged = []
    for m in chat_msgs:
        if merged and merged[-1]["role"] == m["role"]:
            merged[-1]["content"] += "\n" + m["content"]
        else:
            merged.append(m)
    chat_msgs = merged[-6:]
    base = os.environ.get("DSH_DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")
    model = os.environ.get("DSH_DEEPSEEK_MODEL", "deepseek-chat")
    custom_prompt = (payload.get("prompt") or "").strip()
    system_prompt = custom_prompt or (
        "你是语音转写校对助手。语音识别结果可能存在同音字/近音字错误、口音导致的错字、"
        "标点与断句不当。请结合上下文语义，把识别错误的字词规正为最符合语境、最自然的表达"
        "（例如“時別”应纠正为“識別”），并补充或修正标点与断句。"
        "断句注意：输入可能只是语流中的一段而非完整句子，句号不一定是真实句子边界；"
        "若下文（如果提供）与本文语义连续，或结尾接有“但是/不过/因为/所以/然后/还有/接着”"
        "等连接词，允许把句末句号改为逗号或保持断句开放；若语义确已完整，保持句号。"
        "对话历史（若提供）仅作语境参考，其中的主题、人名与用词风格可帮助判断正确的字词。"
        "要求：保持原意与口语风格；合并重复的字词与标点（如“。。”“的的”“谢谢谢谢”）；"
        "不增删内容，除非确有漏字需要补全；"
        "只输出修正后的文本，不要任何解释。"
    )
    # v51：若历史以 user 结尾（助手未回复），与当前请求会形成连续 user——
    # 把该条并入当前请求，保证 messages 严格交替
    user_parts = []
    if chat_msgs and chat_msgs[-1]["role"] == "user":
        last_hist = chat_msgs.pop()["content"]
        user_parts.append("最近一条对话（语境参考，勿修改）：\n" + last_hist)
    user_parts.append("识别文本（需修正）：\n" + text)
    if before:
        user_parts.append("上文（用于判断语义，勿修改）：\n" + before)
    if after:
        user_parts.append("下文（用于判断语义，勿修改）：\n" + after)
    user_content = "\n\n".join(user_parts)
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(chat_msgs)
    messages.append({"role": "user", "content": user_content})
    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0,
        "max_tokens": max(256, len(text) * 2),
        "stream": False,
    }
    try:
        r = httpx.post(
            base.rstrip("/") + "/chat/completions",
            json=payload,
            headers={"Authorization": "Bearer " + key},
            timeout=90,
        )
    except Exception as e:
        fail(13, "精修请求失败（网络错误）：%s" % e)
    if r.status_code != 200:
        fail(14, "精修服务返回错误（HTTP %s）：%s" % (r.status_code, r.text[:300]))
    try:
        out = r.json()["choices"][0]["message"]["content"].strip()
    except Exception:
        fail(15, "精修返回数据格式错误：%s" % r.text[:300])
    if not out:
        fail(16, "精修未返回文本")
    print(out)
    return 0


def main():
    args = sys.argv[1:]
    if "--probe" in args:
        return probe()
    if "--list-models" in args:
        return list_local_models()
    if "--download" in args:
        i = args.index("--download")
        if i + 1 >= len(args):
            fail(2, "--download 需要指定模型名")
        return download_model(args[i + 1])
    if "--chat" in args:
        raw = sys.stdin.buffer.read().decode("utf-8", "replace").strip()
        if not raw:
            fail(2, "标准输入为空")
        try:
            parsed = json.loads(raw)
            payload = parsed if isinstance(parsed, dict) else {"text": raw}
        except Exception:
            payload = {"text": raw}
        return transcribe_chat(payload)
    if "--serve" in args:
        return serve()
    opts = {}
    for flag, key in (("--backend", "backend"), ("--model", "model"),
                      ("--lang", "lang"), ("--beam", "beam")):
        if flag in args:
            i = args.index(flag)
            if i + 1 < len(args):
                opts[key] = args[i + 1]
    backend = opts.get("backend", "local")
    model = opts.get("model", "base")
    lang = opts.get("lang", "zh")
    beam = opts.get("beam", "1")

    raw = sys.stdin.buffer.read()
    if not raw:
        fail(2, "标准输入为空")
    try:
        data = base64.b64decode(raw)
    except Exception as e:
        fail(2, "音频数据解码失败（base64）：%s" % e)
    if len(data) < 1000:
        fail(2, "音频过短（%d 字节）" % len(data))

    if backend == "funasr":
        return transcribe_funasr(data, model, lang, beam)
    if backend == "volc":
        return transcribe_volc(
            data,
            os.environ.get("DSH_VOLC_APPID", ""),
            os.environ.get("DSH_VOLC_ACCESS_TOKEN", ""),
            os.environ.get("DSH_VOLC_CLUSTER", ""),
        )
    if backend == "openai":
        return transcribe_openai(data, model, lang,
                                 os.environ.get("DSH_ASR_BASE_URL", "https://api.openai.com/v1"))
    return transcribe_local(data, model, lang, beam)


if __name__ == "__main__":
    sys.exit(main())
