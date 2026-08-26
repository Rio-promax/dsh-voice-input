// 语音输入插件 Host 半区（静态部署版，Remote 服务 "voice"）
// 部署方式：junction 到 C:\Users\catsk\.dsh\profiles\node_modules\dsh-plugin-voice-input
// 并在 profiles\web\cordis.patch.yml 注册 id: voice-input
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";

// ---- decorator emulation (standard TS transpile output pattern) ----
var __runInitializers = function (thisArg, initializers, value) {
  var useValue = arguments.length > 2;
  for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
  return useValue ? value : void 0;
};
var __esDecorate = function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
  function accept(f) {
    if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
    return f;
  }
  var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
  var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
  var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
  var _, done = false;
  for (var i = decorators.length - 1; i >= 0; i--) {
    var context = {};
    for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
    context.addInitializer = function (f) {
      if (done) throw new TypeError("Cannot add initializers after decoration has completed");
      extraInitializers.push(accept(f || null));
    };
    var result = (0, decorators[i])(kind === "accessor" ? {
      get: descriptor.get,
      set: descriptor.set
    } : descriptor[key], context);
    if (kind === "accessor") {
      if (result === void 0) continue;
      if (result === null || typeof result !== "object") throw new TypeError("Object expected");
      if (_ = accept(result.get)) descriptor.get = _;
      if (_ = accept(result.set)) descriptor.set = _;
      if (_ = accept(result.init)) initializers.unshift(_);
    } else if (_ = accept(result)) if (kind === "field") initializers.unshift(_);
    else descriptor[key] = _;
  }
  if (target) Object.defineProperty(target, contextIn.name, descriptor);
  done = true;
};

// v37 可移植化：DSH_VOICE_ROOT 显式指定工作区根（优先级高于 sandboxPolicy.workspaceRoot，
// 未设置时回退到会话工作区，最后兼容本机旧部署路径）；DSH_VOICE_PYTHON 显式指定 python
// 可执行文件（未设置时用 <root>\.venv 内解释器，Windows Scripts / POSIX bin 自适应）。
const _win = () => typeof process !== "undefined" && process.platform === "win32";
const py = (root) => {
  if (typeof process !== "undefined" && process.env && process.env.DSH_VOICE_PYTHON) return process.env.DSH_VOICE_PYTHON;
  const sep = _win() ? "\\" : "/";
  return root + sep + ".venv" + sep + (_win() ? "Scripts" : "bin") + sep + "python" + (_win() ? ".exe" : "");
};
const script = (root) => root + (_win() ? "\\" : "/") + ".voice-asr" + (_win() ? "\\" : "/") + "transcribe.py";

async function resolveRoot(ctx) {
  const candidates = [];
  if (typeof process !== "undefined" && process.env && process.env.DSH_VOICE_ROOT) candidates.push(process.env.DSH_VOICE_ROOT);
  try {
    const p = ctx.get("sandboxPolicy");
    if (p && typeof p.workspaceRoot === "string" && p.workspaceRoot) candidates.push(p.workspaceRoot);
  } catch (e) {}
  candidates.push("D:\\Codex\\dsh语音输入");
  const fs = ctx.get("fs");
  if (fs && typeof fs.stat === "function") {
    for (const c of candidates) {
      try {
        const target = await fs.resolve(c + (_win() ? "\\" : "/") + ".voice-asr" + (_win() ? "\\" : "/") + "transcribe.py");
        const info = await fs.stat(target);
        if (info) return c;
      } catch (e) {}
    }
  }
  return candidates[0];
}

async function runPython(ctx, argv, stdinData, envExtra) {
  const sp = ctx.get("subprocess");
  if (!sp || typeof sp.spawn !== "function") {
    return { ok: false, error: "子进程服务不可用" };
  }
  let root;
  try {
    root = await resolveRoot(ctx);
  } catch (e) {
    return { ok: false, error: "定位工作区失败: " + String((e && e.message) || e) };
  }
  const env = { HF_HOME: root + (_win() ? "\\" : "/") + ".hf" };
  if (envExtra) for (const k in envExtra) if (envExtra[k]) env[k] = envExtra[k];
  let handle;
  try {
    handle = sp.spawn({
      argv,
      cwd: root,
      stdio: {
        stdin: stdinData ? { data: stdinData } : "ignore",
        stdout: { maxBytes: 65536 },
        stderr: { maxBytes: 65536 },
      },
      graceMs: 300000, // v35：整段模式一次识别数分钟音频，放宽兜底进程等待
      env,
    });
  } catch (e) {
    return { ok: false, error: "启动识别进程失败: " + String((e && e.message) || e) };
  }
  let outcome;
  try {
    outcome = await handle.done;
  } catch (e) {
    return { ok: false, error: "识别进程运行失败: " + String((e && e.message) || e) };
  }
  let out = "", err = "";
  try {
    out = (handle.collected && handle.collected.stdout) ? handle.collected.stdout.readFrom(0).text.trim() : "";
    err = (handle.collected && handle.collected.stderr) ? handle.collected.stderr.readFrom(0).text.trim() : "";
  } catch (e) {
    return { ok: false, error: "读取识别输出失败: " + String((e && e.message) || e) };
  }
  return { outcome, out, err };
}

/**
 * Persistent local-ASR worker (v26). Spawns `transcribe.py --serve` once and
 * keeps it alive: the faster-whisper model is loaded ONCE per process, so a
 * dictation session's first chunk still pays the 3-10s load but every later
 * chunk transcribes in ~0.3-2s. Previously every chunk spawned a fresh python
 * process and reloaded the model (3-10s each), which made dictation feel
 * unusably slow.
 *
 * Protocol: JSON request lines on stdin, JSON response lines on stdout
 * (see transcribe.py serve()). On any failure (exit/timeout/write error) the
 * worker is disposed and the one-shot spawn path is used as fallback.
 */
class LocalWorker {
  constructor(ctx, root) {
    this.ctx = ctx;
    this.root = root;
    this.handle = null;
    this.seq = 0;
    this.buf = "";
    this.errLog = "";
    this.waiters = new Map();
  }
  _spawn() {
    const sp = this.ctx.get("subprocess");
    if (!sp || typeof sp.spawn !== "function") return null;
    const handle = sp.spawn({
      argv: [py(this.root), script(this.root), "--serve"],
      cwd: this.root,
      stdio: { stdin: "pipe", stdout: "pipe", stderr: "pipe" },
      graceMs: 5000,
      env: { HF_HOME: this.root + (_win() ? "\\" : "/") + ".hf" },
    });
    this.handle = handle;
    this.buf = "";
    this.errLog = "";
    if (handle.stdout && typeof handle.stdout.on === "function") {
      handle.stdout.on("data", (c) => this._onData(c));
      handle.stdout.on("error", () => {});
    }
    if (handle.stderr && typeof handle.stderr.on === "function") {
      handle.stderr.on("data", (c) => { this.errLog = (this.errLog + String(c)).slice(-4000); });
      handle.stderr.on("error", () => {});
    }
    const done = handle.done || Promise.resolve({ exitCode: -1 });
    done.then(
      () => this._down("本地识别服务已退出"),
      () => this._down("本地识别服务运行失败"),
    );
    return handle;
  }
  _down(reason) {
    this.handle = null;
    const waiters = this.waiters;
    this.waiters = new Map();
    for (const [, w] of waiters) {
      w({ ok: false, error: reason + (this.errLog ? ": " + this.errLog.slice(-300) : "") });
    }
  }
  _onData(chunk) {
    this.buf += String(chunk);
    let idx;
    while ((idx = this.buf.indexOf("\n")) >= 0) {
      const line = this.buf.slice(0, idx).trim();
      this.buf = this.buf.slice(idx + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch (e) { continue; }
      if (!msg || typeof msg.id === "undefined") continue;
      const w = this.waiters.get(msg.id);
      if (w) { this.waiters.delete(msg.id); w(msg); }
    }
  }
  _request(req) {
    let handle = this.handle;
    if (!handle) {
      handle = this._spawn();
      if (!handle) return Promise.resolve({ ok: false, error: "子进程服务不可用" });
    }
    const id = ++this.seq;
    req.id = id;
    return new Promise((resolve) => {
      // v35：整段模式（停止后整体识别）的请求可能是数分钟音频，
      // 一次性识别耗时线性增长，超时从 90s 放宽到 300s
      const timer = setTimeout(() => {
        this.waiters.delete(id);
        resolve({ ok: false, error: "本地识别服务超时" });
      }, 300000);
      this.waiters.set(id, (msg) => { clearTimeout(timer); resolve(msg); });
      try {
        handle.stdin.write(JSON.stringify(req) + "\n");
      } catch (e) {
        clearTimeout(timer);
        this.waiters.delete(id);
        resolve({ ok: false, error: "本地识别服务写入失败: " + String((e && e.message) || e) });
      }
    });
  }
  async transcribe(args) {
    const backend = (args && args.backend === "funasr") ? "funasr" : "local";
    const r = await this._request({
      op: "transcribe",
      backend,
      wavBase64: args.wavBase64,
      model: args.model || (backend === "funasr" ? "paraformer-zh" : "base"),
      lang: args.lang || "zh",
      beam: String(args.beam || 1),
    });
    if (r && r.ok === true && typeof r.text === "string") {
      return { ok: true, text: r.text };
    }
    const workerErr = (r && r.error) || "本地识别服务异常";
    // Fallback: dispose the broken worker, retry once through the one-shot path.
    try { this.dispose(); } catch (e) {}
    // v30: 立刻在后台重建 worker 并预载模型，让「重新需要启动」只影响当前这一块，
    // 下一块即恢复 ~1s 速度（否则会每块都走 3-10s 的一次性路径）。
    this._request({ op: "load", backend, model: args.model || (backend === "funasr" ? "paraformer-zh" : "base") }).catch(() => {})
    const r2 = await runPython(this.ctx, [
      py(this.root), script(this.root),
      "--backend", backend, "--model", args.model || (backend === "funasr" ? "paraformer-zh" : "base"),
      "--lang", args.lang || "zh", "--beam", String(args.beam || 1),
    ], args.wavBase64);
    if (r2.outcome && r2.outcome.exitCode === 0 && r2.out) {
      return { ok: true, text: r2.out };
    }
    return { ok: false, error: workerErr + (r2.outcome ? " | 兜底识别退出码 " + r2.outcome.exitCode + "：" + (r2.err || r2.out || "无输出") : "") };
  }
  warm(model, backend) {
    // v29: prewarm — ask the worker to load the model into memory without
    // transcribing, so the first real chunk is fast.
    return this._request({ op: "load", model: model || "base", backend: backend || "local" });
  }
  dispose() {
    const h = this.handle;
    this.handle = null;
    if (h) {
      // v52：强制终止——terminate 后仍残留则尝试 kill；杜绝孤儿 worker 占内存
      try { if (h.terminate) h.terminate(); } catch (e) {}
      try { if (h.kill) h.kill(); } catch (e) {}
      try { if (h.done) h.done.catch(() => {}); } catch (e) {}
    }
    const waiters = this.waiters;
    this.waiters = new Map();
    for (const [, w] of waiters) w({ ok: false, error: "本地识别服务已释放" });
  }
}

/** Remote-only service exposing the voice-input ASR backends. */
let VoiceGateway = (() => {
  let _classSuper = TypertRemoteService;
  let _instanceExtraInitializers = [];
  let _listBackends_decorators;
  let _listModels_decorators;
  let _downloadModel_decorators;
  let _warm_decorators;
  let _transcribe_decorators;
  let _polish_decorators;
  let _resetWorker_decorators;
  return class VoiceGateway extends _classSuper {
    static {
      const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
      _listBackends_decorators = [Remote("listBackends")];
      __esDecorate(this, null, _listBackends_decorators, {
        kind: "method", name: "listBackends", static: false, private: false,
        access: { has: (obj) => "listBackends" in obj, get: (obj) => obj.listBackends },
        metadata: _metadata,
      }, null, _instanceExtraInitializers);
      _listModels_decorators = [Remote("listModels")];
      __esDecorate(this, null, _listModels_decorators, {
        kind: "method", name: "listModels", static: false, private: false,
        access: { has: (obj) => "listModels" in obj, get: (obj) => obj.listModels },
        metadata: _metadata,
      }, null, _instanceExtraInitializers);
      _downloadModel_decorators = [Remote("downloadModel")];
      __esDecorate(this, null, _downloadModel_decorators, {
        kind: "method", name: "downloadModel", static: false, private: false,
        access: { has: (obj) => "downloadModel" in obj, get: (obj) => obj.downloadModel },
        metadata: _metadata,
      }, null, _instanceExtraInitializers);
      _warm_decorators = [Remote("warm")];
      __esDecorate(this, null, _warm_decorators, {
        kind: "method", name: "warm", static: false, private: false,
        access: { has: (obj) => "warm" in obj, get: (obj) => obj.warm },
        metadata: _metadata,
      }, null, _instanceExtraInitializers);
      _transcribe_decorators = [Remote("transcribe")];
      __esDecorate(this, null, _transcribe_decorators, {
        kind: "method", name: "transcribe", static: false, private: false,
        access: { has: (obj) => "transcribe" in obj, get: (obj) => obj.transcribe },
        metadata: _metadata,
      }, null, _instanceExtraInitializers);
      _polish_decorators = [Remote("polish")];
      __esDecorate(this, null, _polish_decorators, {
        kind: "method", name: "polish", static: false, private: false,
        access: { has: (obj) => "polish" in obj, get: (obj) => obj.polish },
        metadata: _metadata,
      }, null, _instanceExtraInitializers);
      _resetWorker_decorators = [Remote("resetWorker")];
      __esDecorate(this, null, _resetWorker_decorators, {
        kind: "method", name: "resetWorker", static: false, private: false,
        access: { has: (obj) => "resetWorker" in obj, get: (obj) => obj.resetWorker },
        metadata: _metadata,
      }, null, _instanceExtraInitializers);
      if (_metadata) Object.defineProperty(this, Symbol.metadata, {
        enumerable: true, configurable: true, writable: true, value: _metadata,
      });
    }
    static inject = ["subprocess"];
    constructor(ctx) {
      super(ctx, "voice");
      this._localWorker = null;
      __runInitializers(this, _instanceExtraInitializers);
    }
    /** List available ASR backends and polish availability. */
    async listBackends() {
      const r = await runPython(this.ctx, [py(await resolveRoot(this.ctx)), script(await resolveRoot(this.ctx)), "--probe"]);
      if (r.outcome.exitCode !== 0) {
        return { ok: false, error: "探测后端失败: " + (r.err || r.out || ("退出码 " + r.outcome.exitCode)) };
      }
      try {
        const parsed = JSON.parse(r.out);
        return { ok: true, backends: parsed.backends };
      } catch (e) {
        return { ok: false, error: "探测输出格式错误" };
      }
    }
    /** List local model download state. */
    async listModels() {
      const root = await resolveRoot(this.ctx);
      const r = await runPython(this.ctx, [py(root), script(root), "--list-models"]);
      if (r.outcome.exitCode !== 0) {
        return { ok: false, error: "查询模型失败: " + (r.err || r.out || ("退出码 " + r.outcome.exitCode)) };
      }
      try {
        return JSON.parse(r.out);
      } catch (e) {
        return { ok: false, error: "模型列表输出格式错误" };
      }
    }
    /** Pre-download one local model (waits for completion). */
    async downloadModel(args) {
      const model = args && args.model;
      if (typeof model !== "string" || !model) {
        return { ok: false, error: "未指定模型" };
      }
      const root = await resolveRoot(this.ctx);
      const r = await runPython(this.ctx, [py(root), script(root), "--download", model]);
      if (r.outcome.exitCode !== 0) {
        return { ok: false, error: "模型下载失败: " + (r.err || r.out || ("退出码 " + r.outcome.exitCode)) };
      }
      try {
        return JSON.parse(r.out);
      } catch (e) {
        return { ok: false, error: "模型下载输出格式错误" };
      }
    }
    /**
     * v29: Prewarm the persistent local worker — loads `model` into memory so
     * the first real chunk skips the 3-10s model load. No-op cost when the
     * model is already loaded. local backend → faster-whisper；funasr → paraformer-zh。
     */
    async warm(args) {
      const backend = (args && args.backend === "funasr") ? "funasr" : "local";
      const model = (args && args.model) || (backend === "funasr" ? "paraformer-zh" : "base");
      const root = await resolveRoot(this.ctx);
      try {
        if (!this._localWorker) this._localWorker = new LocalWorker(this.ctx, root);
        const r = await this._localWorker.warm(model, backend);
        if (r && r.ok === true) {
          return { ok: true, model, backend, cached: !!r.cached, ms: r.ms || 0 };
        }
        const err = (r && r.error) || "本地识别服务异常";
        try { this._localWorker.dispose(); } catch (e) {}
        this._localWorker = null;
        return { ok: false, error: err };
      } catch (e) {
        return { ok: false, error: "模型预热失败: " + String((e && e.message) || e) };
      }
    }
    /**
     * v52: 销毁常驻 worker（终止进程、卸载模型）。
     * 客户端在引擎切换（local↔funasr，或切到浏览器 ASR / 云 ASR）时调用，
     * 避免 whisper + FunASR 两个模型同时驻留（2.6GB+）或残留孤儿进程。
     */
    async resetWorker() {
      try {
        if (this._localWorker) {
          this._localWorker.dispose();
          this._localWorker = null;
        }
        return { ok: true };
      } catch (e) {
        return { ok: false, error: "重置本地识别服务失败: " + String((e && e.message) || e) };
      }
    }
    /** Transcribe one base64 WAV via the selected backend. */
    async transcribe(args) {
      const wavBase64 = args && args.wavBase64;
      if (typeof wavBase64 !== "string" || !wavBase64) {
        return { ok: false, error: "没有音频数据" };
      }
      const backend = (args && args.backend === "openai") ? "openai" : ((args && args.backend === "volc") ? "volc" : ((args && args.backend === "funasr") ? "funasr" : "local"));
      const model = (args && args.model) || (backend === "funasr" ? "paraformer-zh" : "base");
      const lang = (args && args.lang) || "zh";
      const beam = String((args && args.beam) || 1);
      const root = await resolveRoot(this.ctx);
      if (backend === "local" || backend === "funasr") {
        // v26: persistent worker — model loads once per process, then each
        // chunk is ~0.3-2s instead of re-spawning python + reloading (3-10s).
        // v37: funasr 走同一 worker（serve 按 backend 路由加载 paraformer-zh）
        try {
          if (!this._localWorker) this._localWorker = new LocalWorker(this.ctx, root);
          return await this._localWorker.transcribe({ wavBase64, model, lang, beam, backend });
        } catch (e) {
          return { ok: false, error: "本地识别服务失败: " + String((e && e.message) || e) };
        }
      }
      const envExtra = {};
      if (backend === "openai") {
        if (args && args.apiKey) envExtra.DSH_ASR_API_KEY = args.apiKey;
        if (args && args.baseUrl) envExtra.DSH_ASR_BASE_URL = args.baseUrl;
      }
      if (backend === "volc") {
        if (args && args.volcAppId) envExtra.DSH_VOLC_APPID = args.volcAppId;
        if (args && args.volcAccessToken) envExtra.DSH_VOLC_ACCESS_TOKEN = args.volcAccessToken;
        if (args && args.volcCluster) envExtra.DSH_VOLC_CLUSTER = args.volcCluster;
      }
      const r = await runPython(this.ctx, [
        py(root), script(root),
        "--backend", backend, "--model", model, "--lang", lang, "--beam", beam,
      ], wavBase64, envExtra);
      if (r.outcome.exitCode !== 0) {
        return { ok: false, error: "识别失败（退出码 " + r.outcome.exitCode + "）：" + (r.err || r.out || "未知错误") };
      }
      if (!r.out) {
        return { ok: false, error: "识别未返回文本" + (r.err ? "（" + r.err + "）" : "") };
      }
      return { ok: true, text: r.out };
    }
    /** DeepSeek polish with surrounding draft + recent chat context. */
    async polish(args) {
      const text = args && args.text;
      if (typeof text !== "string" || !text.trim()) {
        return { ok: false, error: "没有可精修的文本" };
      }
      const root = await resolveRoot(this.ctx);
      const envExtra = {};
      if (args && args.apiKey) envExtra.DSH_DEEPSEEK_API_KEY = args.apiKey;
      if (args && args.baseUrl) envExtra.DSH_DEEPSEEK_BASE_URL = args.baseUrl;
      const payload = JSON.stringify({
        text,
        before: (args && args.before) || "",
        after: (args && args.after) || "",
        // v50：最近聊天记录（语境参考）
        context: (args && args.context) || "",
        prompt: (args && args.prompt) || "",
      });
      const r = await runPython(this.ctx, [py(root), script(root), "--chat"], payload, envExtra);
      if (r.outcome.exitCode !== 0) {
        return { ok: false, error: "精修失败（退出码 " + r.outcome.exitCode + "）：" + (r.err || r.out || "未知错误") };
      }
      if (!r.out) {
        return { ok: false, error: "精修未返回文本" + (r.err ? "（" + r.err + "）" : "") };
      }
      return { ok: true, text: r.out };
    }
  };
})();

export { VoiceGateway, VoiceGateway as default };
