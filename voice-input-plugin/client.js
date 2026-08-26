// 语音输入插件 Client 半区（静态部署版 v36，模块加载器格式）
// 与动态版差异：通过 connection.rpc.call 访问 Host 端 voice RPC；styles.insert → document 注入；
// 插件只依赖已存在的 connection 服务，避免等待未注册的 remote.voice 服务。
window.__ModuleLoader__.load({
  id: "dsh-plugin-voice-input",
  factory: (require) => {
    const React = require("react");

    function injectStyles(css) {
      const tag = document.createElement("style");
      tag.dataset.plugin = "dsh-plugin-voice-input";
      tag.textContent = css;
      document.head.appendChild(tag);
      return () => { tag.remove() };
    }

    return {
      inject: ["connection"],
      apply(ctx) {
        const slots = ctx.get("slots");
        if (slots === undefined) return;

        const voiceRemote = () => {
          const connection = ctx.get("connection");
          if (!connection || !connection.rpc || typeof connection.rpc.call !== "function") return undefined;
          // Typert SRC 回退：网关把 Host 方法源码的参数名（这里统一是 args）当作 wire 字段，
          // 因此带参调用必须把业务对象包在 { args: {...} } 里；无参方法传空对象。
          const call = (method, args) => connection.rpc.call("/api", "voice/" + method, { args: args === undefined ? {} : { args } }).then((result) => {
            return result && result.ok === true && Object.prototype.hasOwnProperty.call(result, "value") ? result.value : result;
          });
          return {
            listBackends: () => call("listBackends"),
            listModels: () => call("listModels"),
            downloadModel: (args) => call("downloadModel", args),
            transcribe: (args) => call("transcribe", args),
            polish: (args) => call("polish", args),
            // v52：销毁常驻 worker（引擎切换/切到浏览器 ASR 或云 ASR 时释放内存）
            resetWorker: () => call("resetWorker"),
          };
        };

        injectStyles(`
.vi-mic, .vi-gear {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; padding: 0; border: none; border-radius: 28px;
  background: transparent; color: var(--dsw-alias-label-secondary, #9ca3af);
  cursor: pointer; transition: background .15s ease, color .15s ease;
}
.vi-mic:hover, .vi-gear:hover { background: var(--dsw-alias-fill-tsp-secondary, rgba(0,0,0,.06)); color: var(--dsw-alias-label-primary, #111827); }
.vi-mic[data-listening] {
  background: var(--dsw-alias-state-error-primary, #dc2626); color: #fff;
  animation: vi-pulse-red 1.2s ease-in-out infinite;
}
.vi-mic:disabled, .vi-gear:disabled { cursor: not-allowed; opacity: .45; }
@keyframes vi-pulse-red {
  0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,.45); }
  50% { box-shadow: 0 0 0 6px rgba(220,38,38,0); }
}
.vi-status {
  font-size: 11px; line-height: 1; max-width: 180px; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap;
  color: var(--dsw-alias-state-error-primary, #dc2626);
}
.vi-status.info {
  color: var(--dsw-alias-label-tertiary, #9ca3af);
}
/* v35：整段模式的短波形——录音时实时电平（红色），识别中整段波形 + 跳动动画（灰色） */
.vi-wave {
  display: inline-flex; align-items: center; gap: 2px; height: 16px;
  color: var(--dsw-alias-label-tertiary, #9ca3af);
}
.vi-wave-live { color: var(--dsw-alias-state-error-primary, #dc2626); }
.vi-wave > span { width: 3px; border-radius: 2px; background: currentColor; opacity: .85; }
.vi-wave-anim > span { animation: vi-wave-bounce .9s ease-in-out infinite; }
.vi-wave-anim > span:nth-child(4n+2) { animation-delay: .12s; }
.vi-wave-anim > span:nth-child(4n+3) { animation-delay: .24s; }
.vi-wave-anim > span:nth-child(4n+4) { animation-delay: .36s; }
@keyframes vi-wave-bounce {
  0%, 100% { transform: scaleY(.35); }
  50% { transform: scaleY(1.2); }
}
.vi-pop {
  position: absolute; bottom: calc(100% + 10px); right: 0; z-index: 60;
  width: 320px; max-width: calc(100vw - 32px);
  box-sizing: border-box; display: flex; flex-direction: column; gap: 10px;
  padding: 12px 14px;
  max-height: calc(100vh - 48px);
  overflow-y: scroll;
  overflow-x: hidden;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: rgba(0,0,0,.32) rgba(0,0,0,.06);
  background: var(--dsw-alias-bg-layer-3, #fff);
  border: 1px solid var(--dsw-alias-border-l2, #e5e7eb);
  border-radius: 12px;
  box-shadow: 0 8px 28px rgba(0,0,0,.16);
}
.vi-pop::-webkit-scrollbar { width: 8px; }
.vi-pop::-webkit-scrollbar-thumb { background: rgba(0,0,0,.32); border-radius: 4px; border: 2px solid transparent; background-clip: padding-box; }
.vi-pop::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,.5); border: 2px solid transparent; background-clip: padding-box; }
.vi-pop::-webkit-scrollbar-track { background: rgba(0,0,0,.06); border-radius: 4px; }
.vi-pop::-webkit-scrollbar-corner { background: transparent; }
.vi-pop-title {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 13px; font-weight: 600; color: var(--dsw-alias-label-primary, #111827);
}
.vi-pop-close {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border: none; border-radius: 6px;
  background: transparent; color: var(--dsw-alias-label-tertiary, #9ca3af);
  cursor: pointer; font-size: 13px;
}
.vi-pop-close:hover { background: var(--dsw-alias-fill-tsp-secondary, rgba(0,0,0,.06)); }
.vi-pop-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 8px 10px;
}
.vi-set-field { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.vi-set-field > span { font-size: 11px; color: var(--dsw-alias-label-secondary, #6b7280); }
.vi-set-field select, .vi-set-field input, .vi-set-field textarea {
  height: 26px; border: 1px solid var(--dsw-alias-border-l2, #e5e7eb); border-radius: 6px;
  background: var(--dsw-alias-bg-base, #fff); color: var(--dsw-alias-label-primary, #111827);
  font-size: 12px; padding: 0 6px; max-width: 100%; box-sizing: border-box;
}
.vi-set-field textarea { height: 64px; padding: 4px 6px; resize: vertical; font-family: inherit; }
.vi-set-wide { grid-column: 1 / -1; }
.vi-pop-toggles { display: flex; gap: 8px; flex-wrap: wrap; }
.vi-toggle {
  display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 8px;
  border: 1px solid var(--dsw-alias-border-l2, #e5e7eb); border-radius: 12px;
  background: transparent; color: var(--dsw-alias-label-tertiary, #9ca3af);
  font-size: 11px; cursor: pointer;
}
.vi-toggle[data-on] { background: var(--dsw-alias-state-success-primary, #16a34a); border-color: transparent; color: #fff; }
.vi-toggle:disabled { cursor: not-allowed; opacity: .4; }
.vi-api-btn {
  display: flex; align-items: center; justify-content: space-between; gap: 6px;
  height: 28px; padding: 0 10px;
  border: 1px dashed var(--dsw-alias-border-l2, #e5e7eb); border-radius: 8px;
  background: transparent; color: var(--dsw-alias-label-secondary, #6b7280);
  font-size: 12px; cursor: pointer; width: 100%; box-sizing: border-box;
}
.vi-api-btn:hover { background: var(--dsw-alias-fill-tsp-secondary, rgba(0,0,0,.06)); }
.vi-api-dot { display: inline-flex; gap: 5px; font-size: 11px; }
.vi-api-dot > span { padding: 0 5px; border-radius: 8px; line-height: 16px; }
.vi-api-dot .ok { background: var(--dsw-alias-state-success-primary, #16a34a); color: #fff; }
.vi-api-dot .no { background: var(--dsw-alias-fill-tsp-secondary, rgba(0,0,0,.08)); color: var(--dsw-alias-label-tertiary, #9ca3af); }
.vi-clear-btn {
  align-self: flex-start; height: 22px; padding: 0 8px;
  border: 1px solid var(--dsw-alias-border-l2, #e5e7eb); border-radius: 6px;
  background: transparent; color: var(--dsw-alias-label-tertiary, #9ca3af);
  font-size: 11px; cursor: pointer;
}
.vi-clear-btn:hover { color: var(--dsw-alias-state-error-primary, #dc2626); border-color: var(--dsw-alias-state-error-primary, #dc2626); }
.vi-set-hint { font-size: 11px; color: var(--dsw-alias-label-tertiary, #9ca3af); line-height: 1.5; }
.vi-set-hint[data-error] { color: var(--dsw-alias-state-error-primary, #dc2626); }
`)

        const MIC_ICON = React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true },
          React.createElement('path', { d: 'M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z' })
        )
        const GEAR_ICON = React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true },
          React.createElement('path', { d: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.81c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41L9.25 5.35C8.66 5.59 8.12 5.92 7.63 6.29L5.24 5.33c-.22-.08-.47 0-.59.22L2.74 8.87C2.62 9.08 2.66 9.34 2.86 9.48l2.03 1.58c-.04.3-.08.63-.08.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z' })
        )
        const CLOSE_ICON = React.createElement('span', null, '✕')

        const STORAGE_KEY = 'dsh.voice.prefs.v1'
        const PERSISTED_KEYS = ['engine', 'asrProvider', 'model', 'lang', 'beam', 'usePunct', 'aiPolish', 'polishPrompt', 'polishContext', 'batchMode', 'asrKey', 'asrBaseUrl', 'deepseekKey', 'deepseekBaseUrl', 'volcAppId', 'volcAccessToken', 'volcCluster']
        function loadSaved() {
          try {
            const raw = window.localStorage.getItem(STORAGE_KEY)
            if (!raw) return {}
            const obj = JSON.parse(raw)
            const out = {}
            for (const k of PERSISTED_KEYS) {
              if (typeof obj[k] !== 'undefined') out[k] = obj[k]
            }
            return out
          } catch (e) { return {} }
        }
        const prefs = Object.assign({
          engine: 'auto',
          asrProvider: 'openai',
          model: 'base',
          lang: 'zh',
          beam: 1,
          usePunct: true,
          aiPolish: true,
          polishPrompt: '',
          // v53：精修是否参考最近聊天记录（默认开；关闭可省输入 token）
          polishContext: true,
          batchMode: false,
          asrKey: '',
          asrBaseUrl: '',
          deepseekKey: '',
          deepseekBaseUrl: '',
          volcAppId: '',
          volcAccessToken: '',
          volcCluster: '',
        }, loadSaved(), {
          envAsrAvailable: false,
          envPolishAvailable: false,
          settingsOpen: false,
          listeners: new Set(),
          get() { return { engine: this.engine, asrProvider: this.asrProvider, model: this.model, lang: this.lang, beam: this.beam, usePunct: this.usePunct, aiPolish: this.aiPolish, polishPrompt: this.polishPrompt, polishContext: this.polishContext, batchMode: this.batchMode, envAsrAvailable: this.envAsrAvailable, envPolishAvailable: this.envPolishAvailable, asrKey: this.asrKey, asrBaseUrl: this.asrBaseUrl, deepseekKey: this.deepseekKey, deepseekBaseUrl: this.deepseekBaseUrl, volcAppId: this.volcAppId, volcAccessToken: this.volcAccessToken, volcCluster: this.volcCluster, settingsOpen: this.settingsOpen } },
          set(patch) {
            let changed = false
            for (const k in patch) {
              if (this[k] !== patch[k]) { this[k] = patch[k]; changed = true }
            }
            if (changed) {
              const save = {}
              for (const k of PERSISTED_KEYS) save[k] = this[k]
              try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(save)) } catch (e) {}
              this.listeners.forEach((fn) => fn())
            }
          },
          clearSecrets() {
            this.set({ asrKey: '', asrBaseUrl: '', deepseekKey: '', deepseekBaseUrl: '' })
          },
          subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn) },
        })
        // Migrate legacy engine values ('openai'/'volc') to unified 'cloud' + asrProvider.
        if (prefs.engine === 'openai' || prefs.engine === 'volc') {
          prefs.asrProvider = prefs.engine === 'volc' ? 'volc' : 'openai'
          prefs.engine = 'cloud'
          try {
            const save = {}
            for (const k of PERSISTED_KEYS) save[k] = prefs[k]
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(save))
          } catch (e) {}
        }
        const usePrefs = () => {
          const [, bump] = React.useState(0)
          React.useEffect(() => prefs.subscribe(() => bump((v) => v + 1)), [])
          return prefs.get()
        }
        const fmtErr = (e) => {
          if (typeof e === 'string') return e
          if (e == null) return '未知错误'
          if (typeof e.message === 'string' && e.message) return e.message
          if (typeof e.error === 'string' && e.error) return e.error
          try { return JSON.stringify(e) } catch (err2) { return String(e) }
        }
        const probeBackends = () => {
          const v = voiceRemote()
          if (!v || typeof v.listBackends !== 'function') return Promise.resolve(null)
          return v.listBackends().then((res) => {
            if (res && res.ok && Array.isArray(res.backends)) return res.backends
            return null
          }).catch(() => null)
        }

        function startCapture() {
          return new Promise((resolve, reject) => {
            navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
              const AC = window.AudioContext || window.webkitAudioContext
              const actx = new AC()
              const source = actx.createMediaStreamSource(stream)
              const chunks = []
              const processor = actx.createScriptProcessor(4096, 1, 1)
              processor.onaudioprocess = (e) => {
                const d = e.inputBuffer.getChannelData(0)
                chunks.push(new Float32Array(d))
              }
              source.connect(processor)
              processor.connect(actx.destination)
              let stopped = false
              const stop = () => {
                if (stopped) return null
                stopped = true
                try { processor.disconnect() } catch (e) {}
                try { source.disconnect() } catch (e) {}
                try { stream.getTracks().forEach((t) => t.stop()) } catch (e) {}
                const sampleRate = actx.sampleRate || 48000
                try { actx.close() } catch (e) {}
                return encodeWavBase64(chunks, sampleRate)
              }
              resolve(stop)
            }).catch((err) => reject(err))
          })
        }

        function startDictation(onSentence, onError) {
          return new Promise((resolve, reject) => {
            navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
              const AC = window.AudioContext || window.webkitAudioContext
              const actx = new AC()
              const rate = actx.sampleRate || 48000
              const source = actx.createMediaStreamSource(stream)
              const processor = actx.createScriptProcessor(4096, 1, 1)
              const CHUNK_MS = 4096 / rate * 1000
              const SILENCE_END_MS = 700
              const MIN_SENTENCE = Math.floor(rate * 0.35)
              const PRE_ROLL_BLOCKS = Math.max(1, Math.round(200 / CHUNK_MS)) // ~200ms 前置缓冲（防切字头）
              let calib = []
              let calibMs = 0
              let baseline = 0.01
              let speechActive = false
              let speechBuf = []
              let preBuf = []
              let silenceMs = 0
              let stopped = false
              // v52：尾部静音裁剪——并行记录每块 rms，flush 时裁掉尾部静音块，
              // 防止 whisper 对长静音尾部幻觉重复末尾字词/标点
              let thr = 0.008
              let speechRms = []
              const flush = () => {
                // 从尾部移除连续静音块（rms < 阈值），保留至少 2 块（~170ms）
                let cut = speechRms.length
                while (cut > 2 && speechRms[cut - 1] < thr) cut--
                const r0 = speechBuf.length - speechRms.length // pre-roll 块数（无 rms，视为语音）
                if (cut < speechRms.length) {
                  speechBuf = speechBuf.slice(0, r0 + cut)
                  speechRms = speechRms.slice(0, cut)
                }
                let total = 0
                for (let i = 0; i < speechBuf.length; i++) total += speechBuf[i].length
                const pcm = new Float32Array(total)
                let off = 0
                for (let i = 0; i < speechBuf.length; i++) { pcm.set(speechBuf[i], off); off += speechBuf[i].length }
                speechBuf = []
                speechRms = []
                if (total >= MIN_SENTENCE) {
                  try {
                    onSentence(encodeWavBase64([pcm], rate))
                  } catch (e) { onError && onError(e) }
                }
              }
              processor.onaudioprocess = (e) => {
                if (stopped) return
                const d = e.inputBuffer.getChannelData(0)
                let sum = 0
                for (let i = 0; i < d.length; i++) sum += d[i] * d[i]
                const rms = Math.sqrt(sum / d.length)
                if (calibMs < 300) {
                  // v26：校准期检测到明显声音（开麦瞬间人已开口）→ 重置校准，
                  // 基线只取纯静音均值，避免阈值被语音污染导致整句漏检
                  if (rms > 0.03) {
                    calibMs = 0
                    calib = []
                  } else {
                    calib.push(rms)
                    calibMs += CHUNK_MS
                    if (calibMs >= 300) {
                      let s = 0
                      for (let i = 0; i < calib.length; i++) s += calib[i]
                      baseline = s / calib.length
                      calib = []
                    }
                  }
                  return
                }
                thr = Math.max(baseline * 3, 0.008) // v52：更新外层阈值，flush 裁剪与 VAD 判断一致
                if (rms > thr) {
                  if (!speechActive) {
                    speechActive = true
                    // v26：pre-roll——把触发前的 ~200ms 缓冲并入块，避免切掉字头（声母）
                    speechBuf = preBuf.slice()
                    speechRms = []
                  }
                  speechBuf.push(new Float32Array(d))
                  speechRms.push(rms)
                  silenceMs = 0
                } else {
                  preBuf.push(new Float32Array(d))
                  if (preBuf.length > PRE_ROLL_BLOCKS) preBuf.shift()
                  if (speechActive) {
                    speechBuf.push(new Float32Array(d))
                    silenceMs += CHUNK_MS
                    if (silenceMs >= SILENCE_END_MS) {
                      flush()
                      speechActive = false
                      silenceMs = 0
                    }
                  }
                }
              }
              source.connect(processor)
              processor.connect(actx.destination)
              const stop = () => {
                if (stopped) return
                stopped = true
                if (speechActive) flush()
                try { processor.disconnect() } catch (e) {}
                try { source.disconnect() } catch (e) {}
                try { stream.getTracks().forEach((t) => t.stop()) } catch (e) {}
                try { actx.close() } catch (e) {}
              }
              resolve(stop)
            }).catch((err) => reject(err))
          })
        }

        // v35：整段模式采集——持续录音不切块，同时按 ~80ms 间隔上报实时电平
        // （用于录音中的短波形）；stop() 返回 { wav, seconds }（wav 为 base64 或 null）
        function startBatchCapture(onLevel, onError) {
          return new Promise((resolve, reject) => {
            navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
              const AC = window.AudioContext || window.webkitAudioContext
              const actx = new AC()
              const rate = actx.sampleRate || 48000
              const source = actx.createMediaStreamSource(stream)
              const processor = actx.createScriptProcessor(4096, 1, 1)
              const chunks = []
              const CHUNK_MS = 4096 / rate * 1000
              let seconds = 0
              let lastLevelAt = 0
              processor.onaudioprocess = (e) => {
                const d = e.inputBuffer.getChannelData(0)
                chunks.push(new Float32Array(d))
                seconds += CHUNK_MS / 1000
                const now = Date.now()
                if (now - lastLevelAt >= 80) {
                  lastLevelAt = now
                  let sum = 0
                  for (let i = 0; i < d.length; i++) sum += d[i] * d[i]
                  const rms = Math.sqrt(sum / d.length)
                  // 感知曲线：sqrt 压缩 + 增益，让普通语音呈现出可见的短波形
                  const level = Math.min(1, Math.sqrt(Math.max(0, rms)) * 2.2)
                  try { onLevel(level) } catch (err) {}
                }
              }
              source.connect(processor)
              processor.connect(actx.destination)
              let stopped = false
              const stop = () => {
                if (stopped) return null
                stopped = true
                try { processor.disconnect() } catch (e) {}
                try { source.disconnect() } catch (e) {}
                try { stream.getTracks().forEach((t) => t.stop()) } catch (e) {}
                const sampleRate = actx.sampleRate || 48000
                try { actx.close() } catch (e) {}
                return { wav: encodeWavBase64(chunks, sampleRate), seconds }
              }
              resolve(stop)
            }).catch((err) => reject(err))
          })
        }

        function writeStr(view, offset, str) {
          for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
        }

        function encodeWavBase64(chunks, srcRate) {
          let total = 0
          for (let i = 0; i < chunks.length; i++) total += chunks[i].length
          if (total < 4800) return null
          const all = new Float32Array(total)
          let off = 0
          for (let i = 0; i < chunks.length; i++) { all.set(chunks[i], off); off += chunks[i].length }
          const TARGET = 16000
          const ratio = srcRate / TARGET
          let pcm
          if (Math.abs(ratio - 1) < 0.001) {
            pcm = all
          } else {
            const n = Math.floor(total / ratio)
            pcm = new Float32Array(n)
            for (let i = 0; i < n; i++) {
              const start = Math.floor(i * ratio)
              const end = Math.min(total, Math.floor((i + 1) * ratio))
              let sum = 0
              const len = Math.max(1, end - start)
              for (let j = start; j < end; j++) sum += all[j]
              pcm[i] = sum / len
            }
          }
          const numSamples = pcm.length
          const dataSize = numSamples * 2
          const buf = new ArrayBuffer(44 + dataSize)
          const view = new DataView(buf)
          writeStr(view, 0, 'RIFF')
          view.setUint32(4, 36 + dataSize, true)
          writeStr(view, 8, 'WAVE')
          writeStr(view, 12, 'fmt ')
          view.setUint32(16, 16, true)
          view.setUint16(20, 1, true)
          view.setUint16(22, 1, true)
          view.setUint32(24, TARGET, true)
          view.setUint32(28, TARGET * 2, true)
          view.setUint16(32, 2, true)
          view.setUint16(34, 16, true)
          writeStr(view, 36, 'data')
          view.setUint32(40, dataSize, true)
          let o = 44
          for (let i = 0; i < numSamples; i++) {
            let s = pcm[i]
            if (s > 1) s = 1
            else if (s < -1) s = -1
            view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true)
            o += 2
          }
          const bytes = new Uint8Array(buf)
          let bin = ''
          const CH = 0x8000
          for (let i = 0; i < bytes.length; i += CH) {
            bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH))
          }
          return window.btoa(bin)
        }

        // v51：从会话快照提取最近聊天记录（AI 精修语境参考）。
        // 返回结构化消息数组 [{role:'user'|'assistant', content}]：
        //   - 最多 6 条（前后各取最近的人机消息，跳过工具/系统节点）
        //   - 完整消息优先：从最新逐条累加，总字数 ≤1200，超限整条丢弃较旧消息
        //   - 仅当第一条就超长时截断其尾部
        function chatContextFromSession(session) {
          try {
            const nodes = (session && Array.isArray(session.nodes)) ? session.nodes : []
            const msgs = []
            for (const n of nodes) {
              if (!n || typeof n.kind !== 'string') continue
              if (n.kind === 'user' && Array.isArray(n.content)) {
                for (const b of n.content) {
                  if (b && b.type === 'text' && typeof b.text === 'string' && b.text.trim()) {
                    msgs.push({ role: 'user', content: b.text.trim() })
                    break
                  }
                }
              } else if (n.kind === 'assistant' && Array.isArray(n.blocks)) {
                for (const b of n.blocks) {
                  if (b && b.kind === 'text' && typeof b.text === 'string' && b.text.trim()) {
                    msgs.push({ role: 'assistant', content: b.text.trim() })
                    break
                  }
                }
              }
            }
            const out = []
            let total = 0
            for (let i = msgs.length - 1; i >= 0 && out.length < 6; i--) {
              let t = msgs[i].content
              if (total + t.length > 1200) {
                if (out.length === 0) t = t.slice(-1200)
                else break
              }
              out.unshift({ role: msgs[i].role, content: t })
              total += t.length
            }
            return out
          } catch (e) { return [] }
        }

        function useVoiceCore(props) {
          const actions = props && props.inputActions
          const input = props && props.input
          const draft = (input && typeof input.draft === 'string') ? input.draft : ''
          const p = usePrefs()

          const [streamSupported] = React.useState(() => {
            try {
              return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)
            } catch (e) { return false }
          })
          const [mediaSupported] = React.useState(() => {
            try {
              return typeof window !== 'undefined' && !!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia && !!(window.AudioContext || window.webkitAudioContext)
            } catch (e) { return false }
          })
          const mode = (p.engine === 'auto' && streamSupported) ? 'stream' : 'dict'
          // v37：FunASR 中文引擎（本地·ONNX）→ 后端 id 'funasr'
          const backendId = p.engine === 'funasr' ? 'funasr' : ((p.engine === 'auto' || p.engine === 'local') ? 'local' : (p.asrProvider === 'volc' ? 'volc' : 'openai'))
          // v35：整段模式走媒体采集（不依赖浏览器实时识别 API）
          const usable = p.batchMode ? mediaSupported : (mode === 'stream' ? streamSupported : mediaSupported)

          const [listening, setListening] = React.useState(false)
          const [status, setStatus] = React.useState('')
          const [isError, setIsError] = React.useState(false)
          // v35：整段模式——录音实时电平（短波形）与识别中整段波形、识别中标志
          const [waveLevels, setWaveLevels] = React.useState([])
          const [waveFinal, setWaveFinal] = React.useState([])
          const [recognizing, setRecognizing] = React.useState(false)
          // v32：status 镜像 ref + 「聆听中」过程提示计时器——提示只在无其他状态时显示
          const statusRef = React.useRef('')
          const idleTimerRef = React.useRef(null)
          const idleTickRef = React.useRef(null)
          const idleStartRef = React.useRef(0)

          const recRef = React.useRef(null)
          const dictStopRef = React.useRef(null)
          // v35：整段模式——采集 stop 函数与已收集的电平序列
          const batchStopRef = React.useRef(null)
          const batchLevelsRef = React.useRef([])
          const chainRef = React.useRef(Promise.resolve())
          const draftRef = React.useRef('')
          const textRef = React.useRef('')
          const lastErrorRef = React.useRef(null)
          const noSpeechRetriesRef = React.useRef(0)
          const cleanRestartsRef = React.useRef(0)
          const netRetriesRef = React.useRef(0)
          const userStoppedRef = React.useRef(false)
          const usePunctRef = React.useRef(true)
          const actionsRef = React.useRef(actions)
          const prefsRef = React.useRef(p)
          const caretRef = React.useRef(null)
          const insPointRef = React.useRef(null)
          const lastCommittedRef = React.useRef(null)
          const lastChunkRef = React.useRef(null)
          const composerElRef = React.useRef(null)
          // v50：会话快照引用（AI 精修的聊天语境来源；每次渲染跟随 props 更新）
          const chatRef = React.useRef(null)
          const polishTimerRef = React.useRef(null)
          // v26：会话代际——startDict/startStream 递增，停止时递增作废所有在途回调
          const sessionRef = React.useRef(0)
          const polishPendingRef = React.useRef(null)
          // v29：本地引擎预热——model -> 'pending'|'done'|'failed'，以及按模型的在途 promise
          const warmStateRef = React.useRef({})
          const warmPendingRef = React.useRef({})
          draftRef.current = draft
          chatRef.current = (props && props.session) || null
          actionsRef.current = actions
          usePunctRef.current = p.usePunct
          prefsRef.current = p
          if (lastCommittedRef.current && lastCommittedRef.current.draft !== draft) {
            lastCommittedRef.current = null
            lastChunkRef.current = null
          }

          React.useEffect(() => {
            probeBackends().then((backends) => {
              if (!backends) return
              const asr = backends.find((b) => b.id === 'openai')
              const pol = backends.find((b) => b.kind === 'polish')
              prefs.set({ envAsrAvailable: !!(asr && asr.available), envPolishAvailable: !!(pol && pol.available) })
            })
          }, [])

          // v29：预热本地引擎——让 Host 侧常驻 worker 提前把模型载入内存。
          // 幂等：同一模型只预热一次（失败可重试）；host 未提供 warm 时静默降级。
          // v37：FunASR 引擎按 backend='funasr' 预热 paraformer-zh。
          const warmLocal = React.useCallback(() => {
            const pre = prefsRef.current
            const v = voiceRemote()
            if (!v || typeof v.warm !== 'function') return Promise.resolve({ ok: false, unavailable: true })
            const isFunasr = pre.engine === 'funasr'
            const model = isFunasr ? 'paraformer-zh' : (pre.model || 'base')
            const st = warmStateRef.current
            if (st[model] === 'done') return Promise.resolve({ ok: true, cached: true })
            if (warmPendingRef.current[model]) return warmPendingRef.current[model]
            const p = v.warm({ model, backend: isFunasr ? 'funasr' : 'local' }).then((r) => {
              st[model] = (r && r.ok) ? 'done' : 'failed'
              return r || { ok: false }
            }).catch((err) => {
              st[model] = 'failed'
              return { ok: false, error: String((err && err.message) || err) }
            })
            warmPendingRef.current[model] = p
            const settle = () => { if (warmPendingRef.current[model] === p) delete warmPendingRef.current[model] }
            p.then(settle, settle)
            return p
          }, [])

          React.useEffect(() => {
            // 选择本地/FunASR 引擎 / 切换本地模型的那一刻就预热，把冷启动挪到说话之前
            if (p.engine === 'local' || p.engine === 'funasr') warmLocal()
          }, [p.engine, p.model, warmLocal])

          // v52：引擎/模型切换时销毁常驻 worker——whisper 与 FunASR 不同时驻留
          //（每个模型 ~1-1.6GB）；切到浏览器内置 ASR / 云 ASR 时同样销毁释放内存。
          // 成功后清空预热状态，下次使用会重新加载（首次稍慢但内存干净）。
          React.useEffect(() => {
            const v = voiceRemote()
            if (!v || typeof v.resetWorker !== 'function') return
            let alive = true
            v.resetWorker().then(() => {
              if (!alive) return
              warmStateRef.current = {}
              warmPendingRef.current = {}
            }).catch(() => {})
            return () => { alive = false }
          }, [p.engine, p.model])

          React.useEffect(() => {
            const isComposer = (el) => {
              try {
                return !!el && el.tagName === 'TEXTAREA' && typeof el.hasAttribute === 'function' && el.hasAttribute('data-phase')
              } catch (e) { return false }
            }
            const record = () => {
              const el = document.activeElement
              if (!isComposer(el)) return
              composerElRef.current = el
              caretRef.current = { start: el.selectionStart || 0, end: el.selectionEnd || 0 }
            }
            document.addEventListener('selectionchange', record)
            document.addEventListener('focusin', record)
            return () => {
              document.removeEventListener('selectionchange', record)
              document.removeEventListener('focusin', record)
            }
          }, [])

          const restoreCaret = React.useCallback((pos) => {
            if (typeof pos !== 'number' || pos < 0) return
            const el = composerElRef.current || (typeof document !== 'undefined' && document.querySelector && document.querySelector('textarea[data-phase]'))
            if (!el || !el.isConnected) return
            const ae = document.activeElement
            const isOurs = !!ae && ae !== el && ae.classList && (ae.classList.contains('vi-mic') || ae.classList.contains('vi-gear') || ae.classList.contains('vi-toggle') || ae.classList.contains('vi-pop-close'))
            const isTextarea = ae === el
            if (ae && !isOurs && !isTextarea) return
            const doRestore = () => {
              try {
                el.focus()
                el.setSelectionRange(pos, pos)
                caretRef.current = { start: pos, end: pos }
              } catch (e) {}
            }
            if (typeof window !== 'undefined' && window.requestAnimationFrame) {
              window.requestAnimationFrame(() => window.requestAnimationFrame(doRestore))
            } else {
              doRestore()
            }
          }, [])

          const isCJK = (ch) => !!ch && /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/.test(ch)

          const stripPunct = React.useCallback((s) => {
            return String(s).replace(/[\u3002\uff0c\uff01\uff1f\u3001\uff1b\uff1a\u201c\u201d\u2018\u2019\uff08\uff09\u300a\u300b\u3010\u3011\u300c\u300d\u300e\u300f\u3014\u3015\u2014\u2026\u00b7\uff5e,.!?;:()\[\]{}<>"'`]/g, '').replace(/\s+/g, ' ').trim()
          }, [])

          const insertAtCaret = React.useCallback((draftText, text) => {
            const caret = caretRef.current
            let c = draftText.length
            if (caret && typeof caret.start === 'number') {
              c = Math.max(0, Math.min(caret.start, draftText.length))
            }
            const prefix = draftText.slice(0, c)
            const suffix = draftText.slice(c)
            const leftCJK = isCJK(prefix.slice(-1))
            const rightCJK = isCJK(text.slice(0, 1))
            const sepL = (prefix && !/\s$/.test(prefix) && !(leftCJK && rightCJK)) ? ' ' : ''
            const leftCJK2 = isCJK(text.slice(-1))
            const rightCJK2 = isCJK(suffix.slice(0, 1))
            const sepR = (suffix && !/^\s/.test(suffix) && !(leftCJK2 && rightCJK2)) ? ' ' : ''
            return { next: prefix + sepL + text + sepR + suffix, caretAfter: prefix.length + sepL.length + text.length }
          }, [])

          const applyDraft = React.useCallback((next) => {
            const a = actionsRef.current
            if (!a || typeof a.setDraft !== 'function') return
            a.setDraft(next)
          }, [])

          // v24：延迟 + 合并窗口精修。
          // 背景：VAD 按静音切块，whisper 在块尾倾向补句号（伪句号）；若逐块立即精修，
          // 触发时后续句子尚未说出（after 为空），LLM 会把停顿误判为句子结束并确认句号——
          // 这就是"掩码"效应。修复：chunk 上屏后延迟 2000ms 才精修，期间相邻块（间隔 ≤2 个
          // 分隔符）合并进同一窗口，flush 时从最新 draft 重建合并文本，一次精修覆盖整段语流。
          const flushPolish = React.useCallback(() => {
            if (polishTimerRef.current) { clearTimeout(polishTimerRef.current); polishTimerRef.current = null }
            const pending = polishPendingRef.current
            if (!pending) return
            polishPendingRef.current = null
            const pre = prefsRef.current
            if (!(pre.aiPolish && (pre.envPolishAvailable || pre.deepseekKey))) return
            const v = voiceRemote()
            if (!v || typeof v.polish !== 'function') return
            const cur = draftRef.current
            const start = pending.start
            const end = pending.end
            const text = cur.slice(start, end)
            if (!text) return
            const before = cur.slice(Math.max(0, start - 150), start)
            const after = cur.slice(end, end + 60)
            // v53：聊天语境可开关（prefs.polishContext，默认开）——关闭时省输入 token
            const chatCtx = pre.polishContext ? chatContextFromSession(chatRef.current) : ''
            v.polish({ text, before, after, context: chatCtx, prompt: pre.polishPrompt || '', apiKey: pre.deepseekKey, baseUrl: pre.deepseekBaseUrl }).then((r2) => {
              if (!r2) return
              if (!r2.ok) { setStatusSafe('精修失败: ' + fmtErr(r2.error || '未知错误')); return }
              if (typeof r2.text !== 'string' || !r2.text || r2.text === text) return
              const cur2 = draftRef.current
              if (cur2.slice(start, end) === text) {
                const next = cur2.slice(0, start) + r2.text + cur2.slice(end)
                applyDraft(next)
                restoreCaret(start + r2.text.length)
              }
            }).catch((err) => { setStatusSafe('精修失败: ' + fmtErr(err)) })
          }, [applyDraft, restoreCaret])

          const queuePolish = React.useCallback((start, chunk) => {
            const pre = prefsRef.current
            if (!(pre.aiPolish && (pre.envPolishAvailable || pre.deepseekKey))) return
            if (polishTimerRef.current) { clearTimeout(polishTimerRef.current); polishTimerRef.current = null }
            const pending = polishPendingRef.current
            if (pending) {
              // 相邻块（间隔 ≤2 个分隔符）→ 扩展合并窗口；否则先落定上一窗口
              // v53：合并窗口 240→400 字（T-2）——更多块并入一次精修，减少请求次数与固定输入开销
              const gap = start - pending.end
              if (gap >= 0 && gap <= 2 && (pending.end - pending.start) + chunk.length <= 400) {
                pending.end = start + chunk.length
                if (pending.end - pending.start > 400) { flushPolish(); return }
              } else {
                flushPolish()
                polishPendingRef.current = { start, end: start + chunk.length }
              }
            } else {
              polishPendingRef.current = { start, end: start + chunk.length }
            }
            polishTimerRef.current = setTimeout(flushPolish, 2000)
          }, [flushPolish])

          // v32：setStatus 镜像版——同步 statusRef，供「聆听中」提示判断当前是否有其他状态
          const setStatusSafe = (s) => { statusRef.current = s; setStatus(s) }

          // v32：过程提示——录音中 ≥3s 仍无文字上屏，显示灰色「聆听中…未识别到语音」（每 5s 刷新已听秒数）
          const stopIdleHint = React.useCallback(() => {
            if (idleTimerRef.current) { clearTimeout(idleTimerRef.current); idleTimerRef.current = null }
            if (idleTickRef.current) { clearInterval(idleTickRef.current); idleTickRef.current = null }
            const s = statusRef.current
            if (s && s.indexOf('聆听中') === 0) setStatusSafe('')
          }, [])

          const startIdleHint = React.useCallback((mySession) => {
            stopIdleHint()
            idleStartRef.current = Date.now()
            idleTimerRef.current = setTimeout(() => {
              if (sessionRef.current !== mySession) { stopIdleHint(); return }
              if (statusRef.current) return
              const secs = Math.max(0, Math.floor((Date.now() - idleStartRef.current) / 1000))
              setStatusSafe(secs < 5 ? '聆听中…未识别到语音' : '聆听中…未识别到语音（' + secs + 's）')
              idleTickRef.current = setInterval(() => {
                if (sessionRef.current !== mySession) { stopIdleHint(); return }
                if (statusRef.current) { stopIdleHint(); return }
                const s2 = Math.max(0, Math.floor((Date.now() - idleStartRef.current) / 1000))
                setStatusSafe('聆听中…未识别到语音（' + s2 + 's）')
              }, 5000)
            }, 3000)
          }, [stopIdleHint])

          const commitChunk = React.useCallback((chunk) => {
            stopIdleHint()
            if (!chunk) return
            const a = actionsRef.current
            if (!a || typeof a.setDraft !== 'function') return
            const last = lastCommittedRef.current
            const cur = (last && typeof last.draft === 'string') ? last.draft : draftRef.current
            const at = Math.max(0, Math.min(last ? last.at : (insPointRef.current || cur.length), cur.length))
            const prefix = cur.slice(0, at)
            const suffix = cur.slice(at)
            const leftCJK = isCJK(prefix.slice(-1))
            const rightCJK = isCJK(chunk.slice(0, 1))
            const sepL = (prefix && !/\s$/.test(prefix) && !(leftCJK && rightCJK)) ? ' ' : ''
            const leftCJK2 = isCJK(chunk.slice(-1))
            const rightCJK2 = isCJK(suffix.slice(0, 1))
            const sepR = (suffix && !/^\s/.test(suffix) && !(leftCJK2 && rightCJK2)) ? ' ' : ''
            const next = prefix + sepL + chunk + sepR + suffix
            const at2 = at + sepL.length + chunk.length + sepR.length
            insPointRef.current = at2
            lastCommittedRef.current = { draft: next, at: at2 }
            lastChunkRef.current = { start: at2 - sepR.length - chunk.length, text: chunk }
            a.setDraft(next)
          }, [])

          // v52：清理整段模式残留——若整段采集未正常停止则先释放麦克风，
          // 并清空波形/识别中状态（修复实时模式下残留音波图）
          const clearBatchResidual = () => {
            if (batchStopRef.current) {
              try { batchStopRef.current() } catch (e) {}
              batchStopRef.current = null
            }
            batchLevelsRef.current = []
            setWaveLevels([])
            setWaveFinal([])
            setRecognizing(false)
          }

          const startStream = React.useCallback((keepPoint) => {
            const a = actionsRef.current
            if (!streamSupported || !a) return
            if (recRef.current !== null) return
            // v52：进入实时模式前清理整段残留（未正常停止的整段采集/波形）
            clearBatchResidual()
            const mySession = ++sessionRef.current
            const SR = window.SpeechRecognition || window.webkitSpeechRecognition
            const rec = new SR()
            rec.lang = 'zh-CN'
            rec.continuous = true
            rec.interimResults = true
            if (!keepPoint) {
              const cur = draftRef.current
              const caret = caretRef.current
              const c = (caret && typeof caret.start === 'number') ? Math.max(0, Math.min(caret.start, cur.length)) : cur.length
              insPointRef.current = c
            }
            lastCommittedRef.current = null
            lastChunkRef.current = null
            textRef.current = ''
            lastErrorRef.current = null
            userStoppedRef.current = false
            rec.onresult = (event) => {
              // v26：代际校验——停止后的迟到事件一律作废，防旧话串入新会话
              if (sessionRef.current !== mySession) return
              let finals = ''
              let interim = ''
              const start = (typeof event.resultIndex === 'number' && event.resultIndex > 0) ? event.resultIndex : 0
              for (let i = start; i < event.results.length; i++) {
                const r = event.results[i]
                const t = r[0] && r[0].transcript ? r[0].transcript : ''
                if (r.isFinal) finals += t
                else interim = t
              }
              textRef.current = interim.trim()
              if (finals) {
                const chunk = (usePunctRef.current ? finals : stripPunct(finals)).trim()
                commitChunk(chunk)
                const lc = lastChunkRef.current
                if (lc) queuePolish(lc.start, chunk)
              }
              setStatusSafe('')
              setIsError(false)
            }
            rec.onerror = (event) => {
              if (sessionRef.current !== mySession) return
              const code = event && event.error
              lastErrorRef.current = code
              console.error('recognition error:', code)
            }
            rec.onend = () => {
              if (sessionRef.current !== mySession) return
              recRef.current = null
              stopIdleHint()
              const code = lastErrorRef.current
              if (userStoppedRef.current) { setListening(false); return }
              if (code === 'not-allowed' || code === 'service-not-allowed') {
                setListening(false); setIsError(true)
                setStatusSafe('麦克风被拒绝：请检查浏览器权限')
                return
              }
              if (code === 'network') {
                if (netRetriesRef.current < 3) {
                  netRetriesRef.current += 1
                  setStatusSafe('网络中断，正在重连…（' + netRetriesRef.current + '/3）')
                  setIsError(true)
                  startStream(true)
                } else {
                  setListening(false); setIsError(true)
                  setStatusSafe('网络错误：与语音服务连接中断，请稍后再试')
                }
                return
              }
              if (code === 'no-speech') {
                if (noSpeechRetriesRef.current < 2) {
                  noSpeechRetriesRef.current += 1
                  startStream(true)
                } else {
                  setListening(false); setIsError(true)
                  setStatusSafe('未检测到语音，已停止')
                }
                return
              }
              if (code) {
                setListening(false); setIsError(true)
                setStatusSafe('识别错误: ' + code)
                return
              }
              if (cleanRestartsRef.current < 15) {
                cleanRestartsRef.current += 1
                startStream(true)
              } else {
                setListening(false); setIsError(false)
                setStatusSafe('已停止（长时间无语音）')
                restoreCaret(insPointRef.current)
              }
            }
            recRef.current = rec
            setListening(true)
            setStatusSafe('')
            setIsError(false)
            startIdleHint(mySession)
            try { rec.start() } catch (e) { console.error('start', e); recRef.current = null; setListening(false); setIsError(true); setStatusSafe('启动失败') }
          }, [streamSupported, commitChunk, stripPunct, restoreCaret, queuePolish, startIdleHint, stopIdleHint])

          const teardownStream = React.useCallback(() => {
            userStoppedRef.current = true
            stopIdleHint()
            // v26：代际递增作废迟到事件
            sessionRef.current += 1
            const rec = recRef.current
            recRef.current = null
            if (rec) {
              try {
                rec.onresult = null; rec.onerror = null; rec.onend = null
                rec.stop && rec.stop()
                rec.abort && rec.abort()
              } catch (e) { console.error('teardown', e) }
            }
            setListening(false)
            // v33：停止时立即落定挂起的精修窗口（最后一句也被精修，识别仍静默）
            if (polishTimerRef.current) {
              clearTimeout(polishTimerRef.current)
              polishTimerRef.current = null
              flushPolish()
            }
            polishPendingRef.current = null
            restoreCaret(insPointRef.current)
          }, [restoreCaret, stopIdleHint, flushPolish])

          const startDict = React.useCallback(() => {
            const a = actionsRef.current
            if (!mediaSupported || !a || dictStopRef.current) return
            // v52：进入实时听写前清理整段残留（未正常停止的整段采集/波形）
            clearBatchResidual()
            // v27：新会话代际——旧会话（含已停止但仍在途的请求）回调一律作废
            const mySession = ++sessionRef.current
            // v29：本地引擎首次使用前先预热（模型加载约 5-10s），期间给出界面提示；
            // 预热完成或失败后照常开始听写（失败时首句由 worker 自行加载，可能较慢）
            const pre = prefsRef.current
            const isFunasr = pre.engine === 'funasr'
            const localDict = isFunasr || pre.engine === 'local' || (pre.engine === 'auto' && !streamSupported)
            const model = isFunasr ? 'paraformer-zh' : (pre.model || 'base')
            const v = voiceRemote()
            const warmSupported = !!(v && typeof v.warm === 'function')
            const needWarm = localDict && warmSupported && warmStateRef.current[model] !== 'done'
            const beginDict = () => {
              if (sessionRef.current !== mySession) return
              setStatusSafe('正在启动麦克风…')
              setIsError(false)
              const cur = draftRef.current
              const caret = caretRef.current
              const c = (caret && typeof caret.start === 'number') ? Math.max(0, Math.min(caret.start, cur.length)) : cur.length
              insPointRef.current = c
              lastCommittedRef.current = null
              lastChunkRef.current = null
              chainRef.current = Promise.resolve()
              startDictation((wavBase64) => {
                chainRef.current = chainRef.current.then(() => {
                  const pre = prefsRef.current
                  const v = voiceRemote()
                  if (sessionRef.current !== mySession) return Promise.resolve(null)
                  if (!v || typeof v.transcribe !== 'function') return Promise.resolve(null)
                  return v.transcribe({
                    wavBase64,
                    lang: pre.lang,
                    backend: pre.engine === 'funasr' ? 'funasr' : ((pre.engine === 'auto' || pre.engine === 'local') ? 'local' : (pre.asrProvider === 'volc' ? 'volc' : 'openai')),
                    model: pre.engine === 'funasr' ? 'paraformer-zh' : pre.model,
                    beam: pre.beam,
                    apiKey: pre.engine === 'openai' ? pre.asrKey : '',
                    baseUrl: pre.engine === 'openai' ? pre.asrBaseUrl : '',
                    volcAppId: pre.engine === 'volc' ? pre.volcAppId : '',
                    volcAccessToken: pre.engine === 'volc' ? pre.volcAccessToken : '',
                    volcCluster: pre.engine === 'volc' ? pre.volcCluster : '',
                  })
                }).then((res) => {
                  if (sessionRef.current !== mySession) return
                  if (res && res.ok && typeof res.text === 'string' && res.text) {
                    const chunk = (usePunctRef.current ? res.text : stripPunct(res.text)).trim()
                    if (chunk) {
                      commitChunk(chunk)
                      const lc = lastChunkRef.current
                      if (lc) queuePolish(lc.start, chunk)
                    }
                  } else {
                    // v30：短块/静音块 whisper 返回 no speech 属正常现象，静默忽略，
                    // 不再红字提示「无法识别」刷屏
                    const em = fmtErr((res && res.error) || '未知错误')
                    if (/no speech/i.test(em)) return
                    setIsError(true)
                    setStatusSafe('识别失败: ' + em)
                  }
                }).catch((err) => {
                  if (sessionRef.current !== mySession) return
                  const em = fmtErr(err)
                  if (/no speech/i.test(em)) return
                  setIsError(true)
                  setStatusSafe('识别失败: ' + em)
                })
              }, (err) => {
                if (sessionRef.current !== mySession) return
                setIsError(true)
                setStatusSafe('识别错误: ' + String((err && err.message) || err))
              })
              .then((stopFn) => {
                if (sessionRef.current !== mySession) {
                  // 会话已被停止（如授权弹窗期间点了停止）：仍须释放麦克风流
                  try { if (stopFn) stopFn() } catch (e) { console.error('stop late dict', e) }
                  return
                }
                dictStopRef.current = stopFn
                setListening(true)
                setStatusSafe('')
                startIdleHint(mySession)
                // v30：若预热仍在后台进行，听写中给出轻提示（首句会稍慢）
                if (warmPendingRef.current[prefsRef.current.model || 'base']) setStatusSafe('本地引擎预热中…（首句可能较慢）')
              }).catch((err) => {
                if (sessionRef.current !== mySession) return
                setIsError(true)
                const name = err && err.name
                if (name === 'NotAllowedError' || name === 'SecurityError') setStatusSafe('麦克风被拒绝：请检查浏览器权限')
                else if (name === 'NotFoundError') setStatusSafe('未找到麦克风设备')
                else if (name === 'NotReadableError') setStatusSafe('麦克风被占用，请关闭其他应用')
                else setStatusSafe('麦克风启动失败: ' + (name || (err && err.message) || err))
              })
            }
            if (needWarm) {
              // v30：预热不阻塞开麦——立即进入听写，预热在后台并行完成；
              // 预热本应在「选本地引擎」那一刻就做完，这里只是兜底。
              // 提示仅在预热期间短暂显示（正在启动麦克风/首句前），不打扰输入。
              setStatusSafe('本地引擎预热中…（首句可能较慢）')
              setIsError(false)
              warmLocal().then((r) => {
                if (sessionRef.current !== mySession) return
                setStatusSafe((s) => (s && s.indexOf('预热') >= 0) ? '' : s)
              })
            }
            beginDict()
          }, [mediaSupported, commitChunk, stripPunct, queuePolish, warmLocal, startIdleHint])

          const stopDict = React.useCallback(() => {
            stopIdleHint()
            const stopFn = dictStopRef.current
            dictStopRef.current = null
            // v27：代际递增作废所有在途/排队回调——停止即静默（不再回补识别）
            sessionRef.current += 1
            // v33：停止时不再丢弃挂起的精修窗口，而是立即落定——最后一块文字
            // 也会被 AI 精修（识别仍静默，精修只是改写已有文字，不新增内容；
            // flushPolish 内部有区间校验保护用户编辑）
            if (polishTimerRef.current) {
              clearTimeout(polishTimerRef.current)
              polishTimerRef.current = null
              flushPolish()
            }
            polishPendingRef.current = null
            setListening(false)
            if (stopFn) {
              try { stopFn() } catch (e) { console.error('stop dict', e) }
            }
            restoreCaret(insPointRef.current)
            // v48：AUTO（自动发送）功能已移除
            setStatusSafe('已识别')
          }, [restoreCaret, stopIdleHint, flushPolish])

          // v35：整段模式（可选）——录音期间持续监听、不切块不上屏，
          // 点击停止后整体识别一次：显示「正在识别…」提示 + 整段短波形，
          // 识别完成后插入光标处，并立即由 AI 精修（语流已结束，不等合并窗口）。
          const startBatch = React.useCallback(() => {
            const a = actionsRef.current
            if (!mediaSupported || !a || batchStopRef.current) return
            const mySession = ++sessionRef.current
            const pre = prefsRef.current
            const isFunasr = pre.engine === 'funasr'
            const localDict = isFunasr || pre.engine === 'local' || pre.engine === 'auto'
            const model = isFunasr ? 'paraformer-zh' : (pre.model || 'base')
            const v = voiceRemote()
            const warmSupported = !!(v && typeof v.warm === 'function')
            const needWarm = localDict && warmSupported && warmStateRef.current[model] !== 'done'
            const beginBatch = () => {
              if (sessionRef.current !== mySession) return
              setStatusSafe('正在启动麦克风…')
              setIsError(false)
              setRecognizing(false)
              setWaveLevels([])
              setWaveFinal([])
              batchLevelsRef.current = []
              const cur = draftRef.current
              const caret = caretRef.current
              const c = (caret && typeof caret.start === 'number') ? Math.max(0, Math.min(caret.start, cur.length)) : cur.length
              insPointRef.current = c
              lastCommittedRef.current = null
              lastChunkRef.current = null
              startBatchCapture((level) => {
                if (sessionRef.current !== mySession) return
                batchLevelsRef.current.push(level)
                setWaveLevels(batchLevelsRef.current.slice(-24))
              }).then((stopFn) => {
                if (sessionRef.current !== mySession) {
                  // 会话已被停止（如授权弹窗期间点了停止）：仍须释放麦克风流
                  try { if (stopFn) stopFn() } catch (e) { console.error('stop late batch', e) }
                  return
                }
                batchStopRef.current = stopFn
                setListening(true)
                // v36：录音中不再显示「整段录音中…（再次点击停止）」文案（占位），
                // 红点脉冲 + 实时波形已足够反馈；预热中仍保留预热提示
                if (!warmPendingRef.current[model]) setStatusSafe('')
              }).catch((err) => {
                if (sessionRef.current !== mySession) return
                setIsError(true)
                const name = err && err.name
                if (name === 'NotAllowedError' || name === 'SecurityError') setStatusSafe('麦克风被拒绝：请检查浏览器权限')
                else if (name === 'NotFoundError') setStatusSafe('未找到麦克风设备')
                else if (name === 'NotReadableError') setStatusSafe('麦克风被占用，请关闭其他应用')
                else setStatusSafe('麦克风启动失败: ' + (name || (err && err.message) || err))
              })
            }
            if (needWarm) {
              // 预热不阻塞开麦——立即进入录音，预热在后台并行完成
              setStatusSafe('本地引擎预热中…（首句可能较慢）')
              setIsError(false)
              warmLocal().then(() => {
                if (sessionRef.current !== mySession) return
                if (statusRef.current && String(statusRef.current).indexOf('预热') >= 0) setStatusSafe('')
              })
            }
            beginBatch()
          }, [mediaSupported, warmLocal])

          const stopBatch = React.useCallback(() => {
            stopIdleHint()
            const stopFn = batchStopRef.current
            batchStopRef.current = null
            setListening(false)
            if (!stopFn) { setStatusSafe('已停止'); return }
            let res = null
            try { res = stopFn() } catch (e) { console.error('stop batch', e) }
            const wavBase64 = res && res.wav
            const seconds = (res && res.seconds) || 0
            // 整段超过 10 分钟：base64 载荷过大（RPC/内存），拒绝并提示分段
            if (seconds > 600) {
              setWaveLevels([])
              setWaveFinal([])
              setIsError(true)
              setStatusSafe('录音过长（超过 10 分钟），请分段识别')
              restoreCaret(insPointRef.current)
              return
            }
            if (!wavBase64) {
              setWaveLevels([])
              setWaveFinal([])
              setIsError(false)
              setStatusSafe('录音过短，未识别')
              restoreCaret(insPointRef.current)
              return
            }
            // 由录音期间的实时电平计算整段波形（24 段），识别过程中展示
            const lv = batchLevelsRef.current
            const N = 24
            const final = []
            for (let i = 0; i < N; i++) {
              const a = Math.floor(lv.length * i / N)
              const b = Math.max(a + 1, Math.floor(lv.length * (i + 1) / N))
              let s = 0
              for (let j = a; j < b; j++) s += lv[j]
              final.push(Math.max(0.06, Math.min(1, s / (b - a))))
            }
            setWaveLevels([])
            setWaveFinal(final)
            setRecognizing(true)
            // 注意：这里不递增代际——识别结果必须落定；但识别期间若用户
            // 重新开始录音（session++），旧结果的回调会被代际校验作废。
            const mySession = sessionRef.current
            const t0 = Date.now()
            let timer = null
            const tick = () => {
              if (sessionRef.current !== mySession) { if (timer) clearInterval(timer); return }
              const secs = Math.max(0, Math.floor((Date.now() - t0) / 1000))
              setStatusSafe(secs < 5 ? '正在识别…' : '正在识别…（' + secs + 's）')
            }
            tick()
            timer = setInterval(tick, 5000)
            Promise.resolve().then(() => {
              const pre = prefsRef.current
              const v = voiceRemote()
              if (sessionRef.current !== mySession) return Promise.resolve(null)
              if (!v || typeof v.transcribe !== 'function') return Promise.resolve(null)
              return v.transcribe({
                wavBase64,
                lang: pre.lang,
                backend: pre.engine === 'funasr' ? 'funasr' : ((pre.engine === 'auto' || pre.engine === 'local') ? 'local' : (pre.asrProvider === 'volc' ? 'volc' : 'openai')),
                model: pre.engine === 'funasr' ? 'paraformer-zh' : pre.model,
                beam: pre.beam,
                apiKey: pre.engine === 'openai' ? pre.asrKey : '',
                baseUrl: pre.engine === 'openai' ? pre.asrBaseUrl : '',
                volcAppId: pre.engine === 'volc' ? pre.volcAppId : '',
                volcAccessToken: pre.engine === 'volc' ? pre.volcAccessToken : '',
                volcCluster: pre.engine === 'volc' ? pre.volcCluster : '',
              })
            }).then((r2) => {
              clearInterval(timer)
              if (sessionRef.current !== mySession) return
              setRecognizing(false)
              setWaveFinal([])
              if (r2 && r2.ok && typeof r2.text === 'string' && r2.text) {
                const chunk = (usePunctRef.current ? r2.text : stripPunct(r2.text)).trim()
                if (chunk) {
                  commitChunk(chunk)
                  const lc = lastChunkRef.current
                  if (lc) {
                    // 语流已结束：立即精修（不等 2s 合并窗口）。
                    // commitChunk 后 draftRef 尚未随重渲染更新，先用刚提交的草稿同步，
                    // 让 flushPolish 的区间校验（slice(start,end)===text）命中
                    if (lastCommittedRef.current && typeof lastCommittedRef.current.draft === 'string') {
                      draftRef.current = lastCommittedRef.current.draft
                    }
                    polishPendingRef.current = { start: lc.start, end: lc.start + chunk.length }
                    flushPolish()
                  }
                  // v48：AUTO（自动发送）功能已移除
                  setStatusSafe('已识别')
                } else {
                  setIsError(false)
                  setStatusSafe('未识别到语音')
                }
              } else {
                const em = fmtErr((r2 && r2.error) || '未知错误')
                if (/no speech/i.test(em)) { setIsError(false); setStatusSafe('未识别到语音') }
                else { setIsError(true); setStatusSafe('识别失败: ' + em) }
              }
              restoreCaret(insPointRef.current)
            }).catch((err) => {
              clearInterval(timer)
              if (sessionRef.current !== mySession) return
              setRecognizing(false)
              setWaveFinal([])
              const em = fmtErr(err)
              if (/no speech/i.test(em)) { setIsError(false); setStatusSafe('未识别到语音') }
              else { setIsError(true); setStatusSafe('识别失败: ' + em) }
              restoreCaret(insPointRef.current)
            })
          }, [restoreCaret, stopIdleHint, commitChunk, flushPolish, stripPunct])

          const onToggle = React.useCallback(() => {
            if (p.batchMode) {
              listening ? stopBatch() : startBatch()
            } else if (mode === 'stream') {
              listening ? teardownStream() : startStream(false)
            } else {
              listening ? stopDict() : startDict()
            }
          }, [p.batchMode, mode, listening, startStream, teardownStream, startDict, stopDict, startBatch, stopBatch])

          React.useEffect(() => () => {
            stopIdleHint()
            const rec = recRef.current
            recRef.current = null
            if (rec) {
              try {
                rec.onresult = null; rec.onerror = null; rec.onend = null
                rec.stop && rec.stop()
                rec.abort && rec.abort()
              } catch (e) {}
            }
            if (dictStopRef.current) {
              try { dictStopRef.current() } catch (e) {}
              dictStopRef.current = null
            }
            if (batchStopRef.current) {
              try { batchStopRef.current() } catch (e) {}
              batchStopRef.current = null
            }
            if (polishTimerRef.current) { clearTimeout(polishTimerRef.current); polishTimerRef.current = null }
            polishPendingRef.current = null
          }, [])

          return { mode, backendId, usable, listening, status, isError, actions, onToggle, waveLevels, waveFinal, recognizing }
        }

        // v35：短波形——录音中显示实时电平（红色），识别中显示整段波形并跳动（灰色）
        function Waveform(props) {
          const levels = props.levels || []
          return React.createElement('div', {
            className: 'vi-wave' + (props.anim ? ' vi-wave-anim' : '') + (props.live ? ' vi-wave-live' : ''),
            'aria-hidden': true,
          }, levels.map((v, i) => React.createElement('span', {
            key: i,
            style: { height: Math.max(2, Math.round(v * 14)) },
          })))
        }

        function MicButton(props) {
          const c = useVoiceCore(props)
          const p = usePrefs()
          let title
          if (!c.usable) title = '当前环境不支持录音（需 HTTPS 或 localhost）'
          else if (c.recognizing) title = '正在整体识别…'
          else if (p.batchMode) title = c.listening ? '停止录音并整体识别' : '语音输入（整段：停止后统一识别，识别时显示波形）'
          else if (c.mode === 'stream') title = c.listening ? '停止聆听（实时识别）' : '语音输入（实时，光标处插入）'
          else title = c.listening ? '停止听写' : '语音输入（实时听写，说完一句识别一句）'
          return React.createElement('div', { style: { display: 'inline-flex', alignItems: 'center', gap: '6px' } },
            (c.recognizing || c.listening) && (c.waveLevels.length || c.waveFinal.length)
              ? React.createElement(Waveform, { levels: c.recognizing ? c.waveFinal : c.waveLevels, anim: c.recognizing, live: !c.recognizing })
              : null,
            c.status
              ? React.createElement('span', { className: 'vi-status' + (c.isError ? '' : ' info') }, c.status)
              : null,
            React.createElement('button', {
              className: 'vi-mic', type: 'button', title,
              disabled: !c.usable || !c.actions,
              'data-listening': c.listening || undefined,
              onClick: c.onToggle,
            }, MIC_ICON),
            React.createElement('button', {
              className: 'vi-gear', type: 'button',
              title: p.settingsOpen ? '收起语音设置' : '语音设置（引擎/模型/语言/质量/标点/AI精修）',
              onClick: () => prefs.set({ settingsOpen: !p.settingsOpen }),
            }, GEAR_ICON)
          )
        }

        function VoiceSettingsPop(props) {
          const p = usePrefs()
          const [streamSupported] = React.useState(() => {
            try {
              return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)
            } catch (e) { return false }
          })
          const [backends, setBackends] = React.useState(null)
          const [loadErr, setLoadErr] = React.useState('')
          const [apiOpen, setApiOpen] = React.useState(false)
          const [modelOpen, setModelOpen] = React.useState(false)
          const [localModels, setLocalModels] = React.useState(null)
          const [modelErr, setModelErr] = React.useState('')
          const [downloading, setDownloading] = React.useState('')
          // v38：引擎说明折叠区（每条 ≤20 字）
          const [explainOpen, setExplainOpen] = React.useState(false)
          const cardRef = React.useRef(null)
          React.useEffect(() => {
            probeBackends().then((bs) => {
              if (!bs) return
              setBackends(bs)
              const asr = bs.find((b) => b.id === 'openai')
              const pol = bs.find((b) => b.kind === 'polish')
              prefs.set({ envAsrAvailable: !!(asr && asr.available), envPolishAvailable: !!(pol && pol.available) })
            })
          }, [])
          React.useEffect(() => {
            if (!p.settingsOpen) return
            const onPointerDown = (ev) => {
              try {
                if (cardRef.current && cardRef.current.contains(ev.target)) return
                if (ev.target instanceof Node && ev.target.closest && ev.target.closest('.vi-gear')) return
              } catch (e) {}
              prefs.set({ settingsOpen: false })
            }
            document.addEventListener('pointerdown', onPointerDown, true)
            return () => document.removeEventListener('pointerdown', onPointerDown, true)
          }, [p.settingsOpen])
          React.useEffect(() => {
            const v = voiceRemote()
            if (!v || typeof v.listModels !== 'function') return
            let alive = true
            v.listModels().then((res) => {
              if (!alive) return
              if (res && res.ok && Array.isArray(res.models)) setLocalModels(res)
              else setModelErr((res && res.error) || '无法获取本地模型状态')
            }).catch(() => { if (alive) setModelErr('无法获取本地模型状态') })
            return () => { alive = false }
          }, [p.settingsOpen])
          const doDownload = (m) => {
            const v = voiceRemote()
            if (!v || typeof v.downloadModel !== 'function' || downloading) return
            setDownloading(m)
            setModelErr('')
            v.downloadModel({ model: m }).then((res) => {
              setDownloading('')
              if (res && res.ok) {
                v.listModels().then((r2) => { if (r2 && r2.ok && Array.isArray(r2.models)) setLocalModels(r2) })
              } else {
                setModelErr('下载失败: ' + ((res && res.error) || '未知错误'))
              }
            }).catch((e) => { setDownloading(''); setModelErr('下载失败: ' + String((e && e.message) || e)) })
          }
          React.useEffect(() => {
            if (!apiOpen) return
            const cloudReady = !!(p.envAsrAvailable || p.asrKey)
            const polishReady = !!(p.envPolishAvailable || p.deepseekKey)
            if (cloudReady && polishReady) {
              const t = window.setTimeout(() => setApiOpen(false), 700)
              return () => window.clearTimeout(t)
            }
          }, [apiOpen, p.envAsrAvailable, p.envPolishAvailable, p.asrKey, p.deepseekKey])
          if (!p.settingsOpen) return null

          const backendIdNow = p.engine === 'funasr' ? 'funasr' : (p.engine === 'local' ? 'local' : (p.asrProvider === 'volc' ? 'volc' : 'openai'))
          const current = backends ? (backends.find((b) => b.id === backendIdNow) || null) : null
          const models = (current && current.models) || ['base']
          const asrKeySet = !!(p.envAsrAvailable || p.asrKey)
          const volcKeySet = !!(p.volcAppId && p.volcAccessToken)
          const cloudReady = asrKeySet || volcKeySet
          const polishReady = !!(p.envPolishAvailable || p.deepseekKey)
          const engineOptions = [
            // v43：引擎名——自动→浏览器内置 ASR；本地→本地 base whisper；FunASR→本地FunASR
            { id: 'auto', label: '浏览器内置 ASR 识别' },
            { id: 'local', label: '本地 base whisper' },
            { id: 'funasr', label: '本地FunASR' },
            { id: 'cloud', label: '云 ASR' + (cloudReady ? '' : '（未配置）') },
          ]
          const langOptions = [['auto', '自动'], ['zh', '中文'], ['en', 'English'], ['ja', '日本語'], ['ko', '한국어']]
          const field = (label, children) => React.createElement('div', { className: 'vi-set-field' },
            React.createElement('span', null, label), children)
          const mkSel = (value, options, onChange, disabled) => React.createElement('select', {
            value,
            disabled: disabled || undefined,
            onChange: (e) => onChange(e.target.value),
          }, options.map((o) => {
            if (o.group) {
              return React.createElement('optgroup', { key: o.group, label: o.group },
                o.items.map((it) => React.createElement('option', { key: it.id, value: it.id }, it.label)))
            }
            return React.createElement('option', { key: o.id, value: o.id }, o.label)
          }))
          const mkInput = (value, onChange, placeholder, type) => React.createElement('input', {
            type: type || 'text',
            value,
            placeholder: placeholder || '',
            spellCheck: false,
            onChange: (e) => onChange(e.target.value),
          })
          const modelOptions = models.concat(models.includes(p.model) ? [] : [p.model]).map((m) => ({ id: m, label: m }))
          const browserRealtimeActive = (p.engine === 'auto' && streamSupported)
          const ASR_PRESETS = [
            { id: 'custom', label: '自定义', provider: 'openai', baseUrl: '', model: '' },
            { id: 'openai', label: 'OpenAI 官方', provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'whisper-1' },
            { id: 'groq', label: 'Groq', provider: 'openai', baseUrl: 'https://api.groq.com/openai/v1', model: 'whisper-large-v3-turbo' },
            { id: 'siliconflow', label: '硅基流动', provider: 'openai', baseUrl: 'https://api.siliconflow.cn/v1', model: '' },
            { id: 'zhipu', label: '智谱', provider: 'openai', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: '' },
            { id: 'volc', label: '豆包（火山引擎）', provider: 'volc', baseUrl: '', model: 'bigmodel' },
          ]
          const currentPresetId = p.asrProvider === 'volc'
            ? 'volc'
            : (ASR_PRESETS.find((x) => x.provider === 'openai' && x.baseUrl && x.baseUrl === p.asrBaseUrl) || ASR_PRESETS[0]).id
          const applyPreset = (pid) => {
            const preset = ASR_PRESETS.find((x) => x.id === pid) || ASR_PRESETS[0]
            const patch = { asrProvider: preset.provider }
            if (preset.provider === 'openai') {
              patch.asrBaseUrl = preset.baseUrl
              if (preset.model) patch.model = preset.model
            }
            prefs.set(patch)
          }

          return React.createElement('div', { className: 'vi-pop', ref: cardRef, role: 'dialog' },
            React.createElement('div', { className: 'vi-pop-title' },
              React.createElement('span', null, '语音输入设置'),
              React.createElement('button', { className: 'vi-pop-close', type: 'button', title: '关闭', onClick: () => prefs.set({ settingsOpen: false }) }, CLOSE_ICON)
            ),
            React.createElement('div', { className: 'vi-pop-grid' },
              field('识别引擎', mkSel(p.engine, engineOptions, (v) => prefs.set({ engine: v }))),
              // v42：云 ASR 模型由 API/服务商决定——仅「自定义」预设（openai + 空 BaseURL）可手填，
              // 其余预设（OpenAI 官方/Groq/硅基流动/智谱/豆包）只读展示「随服务商」
              field('识别模型', mkSel(
                p.engine === 'auto' ? '__auto__' : (p.engine === 'funasr' ? 'paraformer-zh' : (p.engine === 'cloud' ? (p.asrProvider === 'volc' ? 'bigmodel' : p.model) : p.model)),
                p.engine === 'auto' ? [{ id: '__auto__', label: '随引擎自动' }]
                  : p.engine === 'funasr' ? [{ id: 'paraformer-zh', label: 'paraformer-zh（中文，固定）' }]
                  : (p.engine === 'cloud' && !(p.asrProvider !== 'volc' && !p.asrBaseUrl)) ? [{ id: p.model || '__na__', label: (p.model || '—') + '（随服务商）' }]
                  : modelOptions,
                (v) => prefs.set({ model: v }),
                p.engine === 'auto' || p.engine === 'funasr' || (p.engine === 'cloud' && !(p.asrProvider !== 'volc' && !p.asrBaseUrl))
              )),
              field('语言', mkSel(p.engine === 'funasr' ? 'zh' : p.lang, langOptions.map(([id, label]) => ({ id, label })), (v) => prefs.set({ lang: v }), p.engine === 'funasr')),
              // v39：质量（beam）仅在本地 whisper 生效——faster-whisper 解码束宽；
              // 浏览器内置 ASR / FunASR / 云 ASR 无此参数，禁用并显示「不适用」
              field('质量', mkSel(p.engine === 'local' ? String(p.beam) : '__na__', p.engine === 'local' ? [{ id: '1', label: '快速' }, { id: '5', label: '高质量' }] : [{ id: '__na__', label: '不适用' }], (v) => { if (v !== '__na__') prefs.set({ beam: Number(v) }) }, p.engine !== 'local'))
            ),
            React.createElement('div', { className: 'vi-pop-toggles' },
              React.createElement('button', {
                className: 'vi-toggle', type: 'button',
                title: '自动添加标点（关闭后剥离标点）',
                'data-on': p.usePunct || undefined,
                onClick: () => prefs.set({ usePunct: !p.usePunct }),
              }, React.createElement('span', null, '标点')),
              React.createElement('button', {
                className: 'vi-toggle', type: 'button',
                title: polishReady ? '每句识别后由 DeepSeek 后台纠错（同音字/口音/标点）' : '未配置 DeepSeek Key，不可用',
                disabled: !polishReady ? true : undefined,
                'data-on': (p.aiPolish && polishReady) || undefined,
                onClick: () => prefs.set({ aiPolish: !p.aiPolish }),
              }, React.createElement('span', null, 'AI精修')),
              // v53：T-3——精修是否参考最近聊天记录（默认开；关闭省输入 token）
              React.createElement('button', {
                className: 'vi-toggle', type: 'button',
                title: polishReady ? 'AI精修时参考最近聊天记录（主题/人名语境，提升纠错；关闭可减少 token 用量）' : '未配置 DeepSeek Key，不可用',
                disabled: !polishReady ? true : undefined,
                'data-on': (p.polishContext && polishReady) || undefined,
                onClick: () => prefs.set({ polishContext: !p.polishContext }),
              }, React.createElement('span', null, '语境')),
              React.createElement('button', {
                className: 'vi-toggle', type: 'button',
                title: '整段识别：录音期间持续监听，点击停止后整体识别一次（识别时显示"正在识别"提示与短波形，识别后立即 AI 精修）；适合长段落',
                'data-on': p.batchMode || undefined,
                onClick: () => prefs.set({ batchMode: !p.batchMode }),
              }, React.createElement('span', null, '整段'))
            ),
            React.createElement('button', {
              className: 'vi-api-btn', type: 'button',
              onClick: () => setApiOpen(v => !v),
            },
              React.createElement('span', null, apiOpen ? '收起 API 配置' : 'API 配置'),
              // v49：仅保留「云ASR」「精修」文字，删除 ✓/✗ 符号（颜色状态仍区分）
              React.createElement('span', { className: 'vi-api-dot' },
                React.createElement('span', { className: cloudReady ? 'ok' : 'no' }, '云ASR'),
                React.createElement('span', { className: polishReady ? 'ok' : 'no' }, '精修')
              )
            ),
            apiOpen
              ? React.createElement('div', { className: 'vi-set-field vi-set-wide' },
                  React.createElement('span', null, '云 ASR 配置（预设服务商：OpenAI / Groq / 硅基流动 / 智谱 / 豆包等）'),
                  field('预设服务商', mkSel(currentPresetId, ASR_PRESETS, applyPreset)),
                  p.asrProvider === 'volc'
                    ? React.createElement('div', { className: 'vi-set-field vi-set-wide' },
                        mkInput(p.volcAppId, (v) => prefs.set({ volcAppId: v }), 'AppID（火山引擎语音识别控制台）'),
                        mkInput(p.volcAccessToken, (v) => prefs.set({ volcAccessToken: v }), volcKeySet ? 'Access Token（已配置，可修改）' : 'Access Token', 'password'),
                        mkInput(p.volcCluster, (v) => prefs.set({ volcCluster: v }), 'Cluster（默认 volcengine_input_common）'),
                        React.createElement('div', { className: 'vi-set-hint' }, '豆包为专有 v3 协议（非 OpenAI 兼容），字段以官方文档为准：docs.volcengine.com/docs/6561/1798094；返回 code≠0 时原样显示错误码。')
                      )
                    : React.createElement('div', { className: 'vi-set-field vi-set-wide' },
                        mkInput(p.asrBaseUrl, (v) => prefs.set({ asrBaseUrl: v }), 'Base URL（默认 https://api.openai.com/v1）'),
                        mkInput(p.asrKey, (v) => prefs.set({ asrKey: v }), asrKeySet ? 'API Key（已配置，可修改）' : 'API Key', 'password')
                      )
                )
              : null,
            apiOpen
              ? React.createElement('div', { className: 'vi-set-field vi-set-wide' },
                  React.createElement('span', null, 'AI精修（DeepSeek）配置'),
                  mkInput(p.deepseekBaseUrl, (v) => prefs.set({ deepseekBaseUrl: v }), 'Base URL（默认 https://api.deepseek.com/v1）'),
                  mkInput(p.deepseekKey, (v) => prefs.set({ deepseekKey: v }), polishReady ? 'DeepSeek API Key（已配置，可修改）' : 'DeepSeek API Key', 'password'),
                  React.createElement('span', null, '精修 Prompt（留空 = 默认：结合上下文纠正同音字/口音/标点，保持原意与口语风格）'),
                  React.createElement('textarea', {
                    className: 'vi-set-field vi-set-wide',
                    style: { height: 64, resize: 'vertical', fontFamily: 'inherit' },
                    value: p.polishPrompt,
                    spellCheck: false,
                    placeholder: '（默认 prompt）你是语音转写校对助手。请结合上下文语义，把识别错误的字词规正为最符合语境、最自然的表达，并补充或修正标点与断句；保持原意与口语风格；只输出修正后的文本。',
                    onChange: (e) => prefs.set({ polishPrompt: e.target.value }),
                  })
                )
              : null,
            React.createElement('button', {
              className: 'vi-api-btn', type: 'button',
              onClick: () => setModelOpen(v => !v),
            },
              React.createElement('span', null, modelOpen ? '收起本地模型' : '本地模型管理'),
              React.createElement('span', { className: 'vi-api-dot' },
                React.createElement('span', { className: 'no' }, localModels ? ('已装 ' + localModels.models.filter((m) => m.downloaded).length + '/' + localModels.models.length) : '…')
              )
            ),
            modelOpen
              ? React.createElement('div', { className: 'vi-set-field vi-set-wide' },
                  // v47：存储位置行已移入引擎说明；此处仅模型列表（随引擎联动）
                  localModels
                    ? localModels.models
                        .filter((m) => p.engine === 'funasr' ? m.backend === 'funasr' : (p.engine === 'local' ? m.backend === 'local' : true))
                        .map((m) => React.createElement('div', { key: m.id, style: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: 12 } },
                        React.createElement('span', {
                          title: m.downloaded ? '已下载' : '未下载',
                          style: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
                            background: m.downloaded ? 'var(--dsw-alias-state-success-primary, #16a34a)' : 'var(--dsw-alias-label-tertiary, #9ca3af)' },
                        }),
                        React.createElement('span', { style: { minWidth: 70, fontWeight: 600 } }, m.id),
                        React.createElement('span', { style: { color: 'var(--dsw-alias-label-tertiary, #9ca3af)', flex: 1 } }, m.size || ''),
                        m.downloaded
                          ? null
                          : React.createElement('button', {
                              className: 'vi-clear-btn', type: 'button',
                              disabled: !!downloading,
                              onClick: () => doDownload(m.id),
                            }, downloading === m.id ? '下载中…' : '下载')
                      ))
                    : React.createElement('div', { className: 'vi-set-hint' }, modelErr || '加载中…'),
                  modelErr ? React.createElement('div', { className: 'vi-set-hint', 'data-error': true }, modelErr) : null
                )
              : null,
            // v38：可折叠引擎说明——简要对比特点与来源（每条 ≤20 字）
            React.createElement('button', {
              className: 'vi-api-btn', type: 'button',
              onClick: () => setExplainOpen((v) => !v),
            },
              React.createElement('span', null, explainOpen ? '收起引擎说明' : '引擎说明'),
              React.createElement('span', { className: 'vi-api-dot' },
                React.createElement('span', { className: 'no' }, explainOpen ? '▲' : '▼'))
            ),
            explainOpen
              ? React.createElement('div', { className: 'vi-set-field vi-set-wide' },
                  // v41：延迟并入引擎同一行；崩溃自动恢复合并为一行；本地whisper无空格
                  React.createElement('div', { className: 'vi-set-hint', title: 'Chrome/Edge 内置语音识别（Firefox/Safari 自动改走实时听写）' }, '浏览器内置：最轻最快（自带）'),
                  React.createElement('div', { className: 'vi-set-hint', title: 'OpenAI Whisper 多语言开源模型，本地离线；质量（beam）仅此引擎生效' }, '本地whisper：语言最多，首启较慢'),
                  React.createElement('div', { className: 'vi-set-hint', title: '阿里达摩院 paraformer-zh，本地离线，首次自动下载' }, '本地FunASR：中文最好，首启较慢'),
                  React.createElement('div', { className: 'vi-set-hint', title: '本地 worker 进程偶发崩溃时自动一次性回退并后台重建，下一块即恢复' }, '本地引擎偶发崩溃自动恢复'),
                  // v55：模型存储位置行已删除（用户认为无用）
                  React.createElement('div', { className: 'vi-set-hint', title: 'OpenAI 兼容 / 豆包等外部服务，需自备 API Key' }, '云 ASR：外部大模型，延迟看网络'),
                  React.createElement('div', { className: 'vi-set-hint' }, '标点：自动添加标点'),
                  React.createElement('div', { className: 'vi-set-hint' }, 'AI精修：语音输出后两秒AI纠错'),
                  // v54：语境说明（开启后精修会输入聊天上下文）
                  React.createElement('div', { className: 'vi-set-hint', title: '开启后，AI 精修时会把最近聊天记录作为语境一并输入，帮助纠同音字/术语/人名；关闭可减少 token 用量' }, '语境：精修时输入聊天上下文'),
                  React.createElement('div', { className: 'vi-set-hint' }, '整段：输入完毕后整体识别，关闭后实时识别（误差更大）'),
                  loadErr ? React.createElement('div', { className: 'vi-set-hint', 'data-error': true }, '后端探测失败: ' + loadErr) : null
                )
              : null,
            React.createElement('button', { className: 'vi-clear-btn', type: 'button', title: '清除本浏览器保存的 API Key（不含其他设置）', onClick: () => prefs.clearSecrets() }, '清除保存的 Key')
          )
        }

        slots.inject('conversation.input.right', () => slots.register(
          { name: 'conversation.input.right', id: 'voice-input' },
          (props) => React.createElement(MicButton, props)
        ))

        slots.inject('conversation.input.overlay', () => slots.register(
          { name: 'conversation.input.overlay', id: 'voice-settings', order: 2 },
          (props) => React.createElement(VoiceSettingsPop, props)
        ))
      },
    };
  },
});
