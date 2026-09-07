// 语音输入插件 Host 半区（静态部署版，Remote 服务 "voice"）
// Host half of the DSH voice-input plugin.  The package is copied into a DSH
// profile by install.ps1; the ASR workspace is resolved at runtime through
// DSH_VOICE_ROOT or the active DSH workspace (never a machine-specific path).
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import fs from "node:fs/promises";
import path from "node:path";

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

// v62：根目录与数据目录均可移植化。DSH_VOICE_ROOT 指向包含 .voice-asr
// 与 .venv 的运行根；未设置时优先使用 DSH workspace，再回退到当前进程目录。
// DSH_VOICE_DATA_ROOT 指向跨浏览器设置目录；未设置时使用 DSH_HOME/.dsh 下的
// voice-input 子目录。DSH_VOICE_PYTHON 可显式指定 Python。
const _win = () => typeof process !== "undefined" && process.platform === "win32";
const sep = () => _win() ? "\\" : "/";
const py = (root) => {
  if (typeof process !== "undefined" && process.env && process.env.DSH_VOICE_PYTHON) return process.env.DSH_VOICE_PYTHON;
  const s = sep();
  return root + s + ".venv" + s + (_win() ? "Scripts" : "bin") + s + "python" + (_win() ? ".exe" : "");
};
const script = (root) => path.join(root, ".voice-asr", "transcribe.py");
const PREFS_FILE = ".voice-prefs.json";
const PREF_KEYS = [
  "engine", "asrProvider", "model", "lang", "beam", "usePunct", "aiPolish",
  "polishPrompt", "polishContext", "batchMode", "asrKey", "asrBaseUrl",
  "deepseekKey", "deepseekBaseUrl", "volcAppId", "volcAccessToken", "volcCluster",
  "uiLang", "modelRoot",
];

function envValue(name) {
  try {
    const value = process && process.env ? process.env[name] : "";
    return typeof value === "string" && value.trim() ? value.trim() : "";
  } catch (e) { return ""; }
}

function pathValue(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 1024 || /[\x00-\x1f]/.test(trimmed)) return "";
  return trimmed;
}

function sanitizePrefs(input) {
  const out = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;
  for (const key of PREF_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
    const value = input[key];
    if (typeof value === "string") {
      // Prompt and endpoint fields are user-editable, but avoid accidental
      // multi-megabyte payloads being written by an RPC caller.
      if (value.length > (key === "polishPrompt" ? 12000 : 4096)) continue;
      out[key] = value;
    } else if (typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
    }
  }
  return out;
}

async function resolveRoot(ctx) {
  const candidates = [];
  const explicit = envValue("DSH_VOICE_ROOT");
  if (explicit) candidates.push(explicit);
  try {
    const p = ctx.get("sandboxPolicy");
    if (p && typeof p.workspaceRoot === "string" && p.workspaceRoot) candidates.push(p.workspaceRoot);
  } catch (e) {}
  try {
    if (typeof process !== "undefined" && process.cwd) candidates.push(process.cwd());
  } catch (e) {}
  const unique = [];
  for (const candidate of candidates) {
    const value = pathValue(candidate);
    if (value && !unique.includes(value)) unique.push(value);
  }
  for (const candidate of unique) {
    try {
      const info = await fs.stat(path.join(candidate, ".voice-asr", "transcribe.py"));
      if (info && info.isFile && info.isFile()) return candidate;
    } catch (e) {}
  }
  // Keep a deterministic fallback so the caller can return a useful
  // "script not found" message instead of throwing while resolving paths.
  return unique[0] || ".";
}

async function resolveDataRoot(ctx) {
  const explicit = envValue("DSH_VOICE_DATA_ROOT");
  if (explicit) return path.resolve(explicit);
  const dshHome = envValue("DSH_HOME");
  if (dshHome) return path.resolve(dshHome, "voice-input");
  const userHome = envValue("USERPROFILE") || envValue("HOME");
  if (userHome) return path.resolve(userHome, ".dsh", "voice-input");
  const root = await resolveRoot(ctx);
  return path.resolve(root, ".voice-data");
}

async function prefsPath(ctx) {
  const root = await resolveDataRoot(ctx);
  await fs.mkdir(root, { recursive: true });
  return path.join(root, PREFS_FILE);
}

async function readStoredModelRoot(ctx) {
  try {
    const filename = await prefsPath(ctx);
    const raw = await fs.readFile(filename, "utf8");
    const parsed = JSON.parse(raw);
    return pathValue(parsed && parsed.modelRoot);
  } catch (e) {
    try {
      const legacy = path.join(await resolveRoot(ctx), PREFS_FILE);
      const raw = await fs.readFile(legacy, "utf8");
      const parsed = JSON.parse(raw);
      return pathValue(parsed && parsed.modelRoot);
    } catch (legacyError) { return ""; }
  }
}

async function resolveModelRoot(ctx, requested, root) {
  // An explicitly supplied empty string means "use the workspace default".
  // This is distinct from an omitted argument, which should honor the stored
  // preference/environment for legacy callers and background probes.
  if (requested !== undefined && requested !== null) {
    const explicit = pathValue(requested);
    return explicit ? (path.isAbsolute(explicit) ? path.resolve(explicit) : path.resolve(root, explicit)) : path.resolve(root);
  }
  const value = await readStoredModelRoot(ctx) || envValue("DSH_MODEL_ROOT");
  if (!value) return path.resolve(root);
  // Relative paths are portable within the ASR workspace; absolute paths are
  // respected so a user can put large models on another drive.
  return path.isAbsolute(value) ? path.resolve(value) : path.resolve(root, value);
}

function modelEnv(root, modelRoot) {
  return {
    DSH_VOICE_ROOT: root,
    DSH_MODEL_ROOT: modelRoot,
    HF_HOME: path.join(modelRoot, ".hf"),
    MODELSCOPE_CACHE: path.join(modelRoot, ".modelscope"),
    MODELSCOPE_HOME: path.join(modelRoot, ".modelscope-home"),
  };
}

async function runPython(ctx, argv, stdinData, envExtra, options) {
  const sp = ctx.get("subprocess");
  if (!sp || typeof sp.spawn !== "function") {
    return { ok: false, error: "子进程服务不可用" };
  }
  let root;
  try {
    root = pathValue(options && options.root) || await resolveRoot(ctx);
  } catch (e) {
    return { ok: false, error: "定位工作区失败: " + String((e && e.message) || e) };
  }
  try {
    const info = await fs.stat(script(root));
    if (!info || (info.isFile && !info.isFile())) return { ok: false, error: "未找到语音识别脚本，请设置 DSH_VOICE_ROOT" };
  } catch (e) {
    return { ok: false, error: "未找到语音识别脚本，请设置 DSH_VOICE_ROOT" };
  }
  const hasRequestedModelRoot = !!(options && Object.prototype.hasOwnProperty.call(options, "modelRoot"));
  const modelRoot = await resolveModelRoot(ctx, hasRequestedModelRoot ? options.modelRoot : undefined, root);
  const env = modelEnv(root, modelRoot);
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
  constructor(ctx, root, modelRoot) {
    this.ctx = ctx;
    this.root = root;
    this.modelRoot = modelRoot || root;
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
      env: modelEnv(this.root, this.modelRoot),
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
    ], args.wavBase64, null, { root: this.root, modelRoot: this.modelRoot });
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
  // v59：跨浏览器设置持久化——Host 侧 <root>/.voice-prefs.json 为唯一事实源
  let _getPrefs_decorators;
  let _setPrefs_decorators;
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
      _getPrefs_decorators = [Remote("getPrefs")];
      __esDecorate(this, null, _getPrefs_decorators, {
        kind: "method", name: "getPrefs", static: false, private: false,
        access: { has: (obj) => "getPrefs" in obj, get: (obj) => obj.getPrefs },
        metadata: _metadata,
      }, null, _instanceExtraInitializers);
      _setPrefs_decorators = [Remote("setPrefs")];
      __esDecorate(this, null, _setPrefs_decorators, {
        kind: "method", name: "setPrefs", static: false, private: false,
        access: { has: (obj) => "setPrefs" in obj, get: (obj) => obj.setPrefs },
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
      const root = await resolveRoot(this.ctx);
      const r = await runPython(this.ctx, [py(root), script(root), "--probe"], null, null, { root });
      if (!r || !r.outcome || r.outcome.exitCode !== 0) {
        const code = r && r.outcome && typeof r.outcome.exitCode !== "undefined" ? "退出码 " + r.outcome.exitCode : "服务不可用";
        return { ok: false, error: "探测后端失败: " + ((r && (r.err || r.out || r.error)) || code) };
      }
      try {
        const parsed = JSON.parse(r.out);
        return { ok: true, backends: parsed.backends };
      } catch (e) {
        return { ok: false, error: "探测输出格式错误" };
      }
    }
    /** List local model download state. */
    async listModels(args) {
      const root = await resolveRoot(this.ctx);
      const modelRoot = await resolveModelRoot(this.ctx, args && args.modelRoot, root);
      const r = await runPython(this.ctx, [py(root), script(root), "--list-models"], null, null, { root, modelRoot });
      if (!r || !r.outcome || r.outcome.exitCode !== 0) {
        const code = r && r.outcome && typeof r.outcome.exitCode !== "undefined" ? "退出码 " + r.outcome.exitCode : "服务不可用";
        return { ok: false, error: "查询模型失败: " + ((r && (r.err || r.out || r.error)) || code) };
      }
      try {
        const result = JSON.parse(r.out);
        if (result && typeof result === "object") {
          result.modelRoot = modelRoot;
          result.defaultModelRoot = path.resolve(root);
        }
        return result;
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
      const modelRoot = await resolveModelRoot(this.ctx, args && args.modelRoot, root);
      try {
        await fs.mkdir(modelRoot, { recursive: true });
      } catch (e) {
        return { ok: false, error: "模型目录不可写，请更换保存位置" };
      }
      const r = await runPython(this.ctx, [py(root), script(root), "--download", model], null, null, { root, modelRoot });
      if (!r || !r.outcome || r.outcome.exitCode !== 0) {
        const code = r && r.outcome && typeof r.outcome.exitCode !== "undefined" ? "退出码 " + r.outcome.exitCode : "服务不可用";
        return { ok: false, error: "模型下载失败: " + ((r && (r.err || r.out || r.error)) || code) };
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
      const modelRoot = await resolveModelRoot(this.ctx, args && args.modelRoot, root);
      try { await fs.mkdir(modelRoot, { recursive: true }); } catch (e) { return { ok: false, error: "模型目录不可写，请更换保存位置" }; }
      try {
        if (this._localWorker && this._localWorker.modelRoot !== modelRoot) {
          this._localWorker.dispose();
          this._localWorker = null;
        }
        if (!this._localWorker) this._localWorker = new LocalWorker(this.ctx, root, modelRoot);
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
    /**
     * v62: 跨浏览器设置持久化。设置文件放在 DSH 数据目录，而不是当前
     * 会话工作区；这样 Chrome/Edge/豆包等浏览器会共享同一份设置，工作区
     * 变化也不会让 API Key 消失。明文存储风险在 README 中明确说明。
     */
    async getPrefs() {
      let target;
      try {
        target = await prefsPath(this.ctx);
        const raw = await fs.readFile(target, "utf8");
        const parsed = JSON.parse(raw);
        return { ok: true, prefs: sanitizePrefs(parsed) };
      } catch (e) {
        if (e && e.code === "ENOENT") {
          // v59 stored the file beside the ASR workspace.  Read it once as a
          // migration source; the client will write the sanitized copy to the
          // stable DSH data directory on the next sync.
          try {
            const legacy = path.join(await resolveRoot(this.ctx), PREFS_FILE);
            if (!target || path.resolve(legacy) !== path.resolve(target)) {
              const legacyRaw = await fs.readFile(legacy, "utf8");
              return { ok: true, prefs: sanitizePrefs(JSON.parse(legacyRaw)), migrated: true };
            }
          } catch (legacyError) {}
          return { ok: true, prefs: {} };
        }
        if (e instanceof SyntaxError) return { ok: false, error: "设置文件格式损坏，请在设置中重新保存" };
        return { ok: false, error: "读取本机设置失败，请检查文件权限" };
      }
    }
    /**
     * v62: 原子写入设置，避免浏览器切换或 DSH 重启时留下半个 JSON 文件。
     * 只保存白名单字段，并限制文本长度，避免 RPC 调用写入任意数据。
     */
    async setPrefs(args) {
      const input = args && args.prefs;
      if (!input || typeof input !== "object" || Array.isArray(input)) {
        return { ok: false, error: "设置数据无效" };
      }
      const prefs = sanitizePrefs(input);
      let temp = "";
      try {
        const target = await prefsPath(this.ctx);
        // RPC callers may send a patch rather than the complete client state.
        // Merge only the whitelisted fields so a partial update cannot erase
        // keys or model settings saved by another browser.
        let current = {};
        try {
          const raw = await fs.readFile(target, "utf8");
          current = sanitizePrefs(JSON.parse(raw));
        } catch (readError) {
          // Missing or malformed data is safe to replace with the sanitized
          // patch; the next write restores a valid canonical JSON file.
        }
        const merged = Object.assign({}, current, prefs);
        temp = target + ".tmp-" + process.pid + "-" + Date.now();
        await fs.writeFile(temp, JSON.stringify(merged, null, 2) + "\n", "utf8");
        await fs.rename(temp, target);
        return { ok: true };
      } catch (e) {
        if (temp) { try { await fs.unlink(temp); } catch (cleanupError) {} }
        return { ok: false, error: "保存本机设置失败，请检查文件权限" };
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
      const modelRoot = await resolveModelRoot(this.ctx, args && args.modelRoot, root);
      if (backend === "local" || backend === "funasr") {
        // v26: persistent worker — model loads once per process, then each
        // chunk is ~0.3-2s instead of re-spawning python + reloading (3-10s).
        // v37: funasr 走同一 worker（serve 按 backend 路由加载 paraformer-zh）
        try {
          await fs.mkdir(modelRoot, { recursive: true });
          if (this._localWorker && this._localWorker.modelRoot !== modelRoot) {
            this._localWorker.dispose();
            this._localWorker = null;
          }
          if (!this._localWorker) this._localWorker = new LocalWorker(this.ctx, root, modelRoot);
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
      ], wavBase64, envExtra, { root, modelRoot });
      if (!r || !r.outcome || r.outcome.exitCode !== 0) {
        const code = r && r.outcome && typeof r.outcome.exitCode !== "undefined" ? "退出码 " + r.outcome.exitCode : "服务不可用";
        return { ok: false, error: "识别失败（" + code + "）：" + ((r && (r.err || r.out || r.error)) || "未知错误") };
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
      const modelRoot = await resolveModelRoot(this.ctx, args && args.modelRoot, root);
      const r = await runPython(this.ctx, [py(root), script(root), "--chat"], payload, envExtra, { root, modelRoot });
      if (!r || !r.outcome || r.outcome.exitCode !== 0) {
        const code = r && r.outcome && typeof r.outcome.exitCode !== "undefined" ? "退出码 " + r.outcome.exitCode : "服务不可用";
        return { ok: false, error: "精修失败（" + code + "）：" + ((r && (r.err || r.out || r.error)) || "未知错误") };
      }
      if (!r.out) {
        return { ok: false, error: "精修未返回文本" + (r.err ? "（" + r.err + "）" : "") };
      }
      return { ok: true, text: r.out };
    }
  };
})();

export { VoiceGateway, VoiceGateway as default };
