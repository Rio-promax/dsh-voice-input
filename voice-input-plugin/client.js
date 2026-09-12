// 语音输入插件 Client 半区（静态部署版 v63，模块加载器格式）
// v63：实时识别「收尾预留」——点击停止后不再立刻 abort，而是只 stop() 让浏览器把
// 尾部结果落定为 final，并保留 2s 收尾窗口：窗口内迟到的 final 与始终未落定的
// interim 仍会上屏（与实时上屏路径一致，含 AI 精修）；窗口内开启新会话（实时/听写/
// 整段任一）、用户在窗口内改动草稿（编辑或已发送）、组件卸载 → 一律抛弃收尾内容，
// 与整段识别「新会话开启后旧会话结果作废」保持一致。
// v62：设置跨浏览器持久化、模型缓存目录可选、安装/部署入口统一；
// v61：整段识别中不再渲染波形图（波形仅录音中显示）；识别状态精简为「正在识别…」，
// 仅超 5s 追加「（已用 Ns）」——避免识别时波形+长文案把输入栏拉宽延伸。
// v57：①成功/中性提示（已识别等）3s 自动消失；②引擎就绪后无语音 15s 自动停止（预热期不计入）；
// ③预热提示带秒数 + 「引擎就绪」+ 上限；④按钮禁用原因细化。
// v58：①整段录音尾部静音裁剪（重复字缓解）+ 识别中显示音频时长；②精修配置区加 localStorage 提示；
// ③底部新增「中英切换」（联动语言，stream 跟随）；④识别 API 探测扩展（moz/ms/o/大小写）+ 失败提示改引擎建议；
// ⑤预热文案按引擎如实显示、上限 60s（FunASR 冷加载实测 38-39s）；⑥设置弹窗自适应高度（顶部不再超屏）。
// v59：跨浏览器设置持久化——设置与 Key 存 Host 侧 .voice-prefs.json（任何浏览器共享），
// localStorage 降级为本地缓存；启动时从服务端拉取并合并，改动 400ms 防抖写回。
// v60：界面中英文（i18n）——uiLang 偏好（中/EN，跨浏览器同步）；全界面文案双语；
// 设置底部「中 | EN」分段开关，选中侧绿色高亮（识别语言仍由「语言」下拉独立控制）。
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
            listModels: (args) => call("listModels", args),
            downloadModel: (args) => call("downloadModel", args),
            getEnvironment: () => call("getEnvironment"),
            installEnvironment: (args) => call("installEnvironment", args),
            transcribe: (args) => call("transcribe", args),
            polish: (args) => call("polish", args),
            // v52：销毁常驻 worker（引擎切换/切到浏览器 ASR 或云 ASR 时释放内存）
            resetWorker: () => call("resetWorker"),
            // v59：跨浏览器设置持久化（Host 侧 .voice-prefs.json）
            getPrefs: () => call("getPrefs"),
            setPrefs: (args) => call("setPrefs", args),
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

        // v57：提示/超时参数（按需调整）
        const STATUS_FLASH_MS = 3000        // 成功/中性提示（已识别等）自动消失时长
        const ENGINE_READY_FLASH_MS = 1500  // 「引擎就绪」提示时长
        const NO_SPEECH_STOP_MS = 15000     // 引擎就绪后连续无语音自动停止（预热期不计入）
        // v58：预热上限 60s——FunASR 冷加载实测 38-39s，30s 会误报「超时」
        const WARM_CAP_MS = 60000
        const WARM_HINT_TICK_MS = 5000      // 预热提示已等待秒数刷新间隔
        const SPEECH_RMS = 0.008            // 活动检测阈值（与 VAD 最低阈值一致）
        const BATCH_SPEECH_LEVEL = 0.15     // 整段录音「有语音」判断（电平感知曲线下限）
        // v58：浏览器实时识别语言映射（stream 模式跟随「语言」设置；auto 不设置走浏览器默认）
        const STREAM_LANG_MAP = { zh: 'zh-CN', en: 'en-US', ja: 'ja-JP', ko: 'ko-KR' }
        // v63：实时识别停止后的收尾预留窗口——浏览器迟到输出的 final / 未落定 interim
        // 在此时长内仍会上屏；窗口内开启新会话则照整段识别作废。1~2s 为该值可调区间。
        const STREAM_TAIL_GRACE_MS = 2000

        // v58：识别 API 探测扩展——webkit/moz/ms/o 前缀 + 大小写兜底扫描
        //（部分国产/小众浏览器暴露私有实现，主动适配）
        function detectSpeechRecognition() {
          try {
            if (typeof window === 'undefined') return null
            const names = ['SpeechRecognition', 'webkitSpeechRecognition', 'mozSpeechRecognition', 'msSpeechRecognition', 'oSpeechRecognition']
            for (const n of names) {
              if (typeof window[n] === 'function') return n
            }
            for (const k of Object.keys(window)) {
              if (typeof window[k] === 'function' && /speechrecognition$/i.test(k)) return k
            }
          } catch (e) {}
          return null
        }

        const STORAGE_KEY = 'dsh.voice.prefs.v1'
        const PERSISTED_KEYS = ['engine', 'asrProvider', 'model', 'lang', 'beam', 'usePunct', 'aiPolish', 'polishPrompt', 'polishContext', 'batchMode', 'asrKey', 'asrBaseUrl', 'deepseekKey', 'deepseekBaseUrl', 'volcAppId', 'volcAccessToken', 'volcCluster', 'uiLang', 'modelRoot']

        // v60：界面中英文（i18n）——uiLang: 'zh' | 'en'；t(key, vars) 取当前界面语言文案。
        // 识别语言（prefs.lang）与界面语言（prefs.uiLang）相互独立。
        const I18N = {
          zh: {
            'ui.langZh': '中',
            'ui.langEn': 'EN',
            'ui.langTitle': '界面语言：中文 / English（UI language，不影响识别语言）',
            // ---- 状态提示 ----
            'status.polishFail': '精修失败: {err}',
            'status.listening': '聆听中…未识别到语音',
            'status.listeningSec': '聆听中…未识别到语音（{s}s）',
            'status.micDenied': '麦克风被拒绝：请检查浏览器权限',
            'status.micDeniedInsecure': '麦克风被拒绝：页面非 HTTPS/localhost，浏览器禁用录音',
            'status.noMic': '未找到麦克风设备',
            'status.micBusy': '麦克风被占用，请关闭其他应用',
            'status.micStartFail': '麦克风启动失败: {err}',
            'status.networkReconnect': '网络中断，正在重连…（{n}/3）',
            'status.streamNoService': '浏览器无实时识别服务：建议 ⚙ 改用本地/云端引擎',
            'status.streamNetworkFail': '浏览器实时识别不可用（网络）：建议 ⚙ 改用本地/云端引擎',
            'status.noSpeechStopped': '未检测到语音，已停止',
            'status.stoppedNoSpeechLong': '已停止（长时间无语音）',
            'status.startFailed': '启动失败',
            'status.recogErrorCode': '识别错误: {code}',
            'status.startingMic': '正在启动麦克风…',
            'status.recogFail': '识别失败: {err}',
            'status.recogError': '识别错误: {err}',
            'status.warmHintFunasr': '本地引擎预热中…（已 {s} 秒，首次约 30-40 秒）',
            'status.warmHintWhisper': '本地引擎预热中…（已 {s} 秒，首次约 5-10 秒）',
            'status.engineReady': '引擎就绪',
            'status.warmTimeout': '引擎启动超时，仍可继续使用（首句可能较慢）',
            'status.noSpeechAutoStopped': '未检测到语音，已自动停止',
            'status.recognized': '已识别',
            'status.stopped': '已停止',
            'status.tooLong': '录音过长（超过 10 分钟），请分段识别',
            'status.tooShort': '录音过短，未识别',
            'status.noSpeech': '未识别到语音',
            // v61：识别状态精简——始终「正在识别…」，仅超 5s 追加「（已用 Ns）」
            'status.recognizing': '正在识别…',
            'status.recognizingElapsed': '正在识别…（已用 {e}s）',
            // ---- 按钮提示 ----
            'ui.insecure': '非安全上下文（需 HTTPS 或 localhost）',
            'ui.noMediaApi': '无麦克风 API',
            'ui.noAudioCtx': '无音频上下文',
            'ui.unknownReason': '原因未知',
            'ui.unsupported': '当前环境不支持录音：{why}（⚙ 设置可查看）',
            'ui.recognizingWhole': '正在整体识别…',
            'ui.batchStop': '停止录音并整体识别',
            'ui.batchStart': '语音输入（整段：停止后统一识别，识别时显示波形）',
            'ui.streamStop': '停止聆听（实时识别）',
            'ui.streamStart': '语音输入（实时，光标处插入）',
            'ui.dictStop': '停止听写',
            'ui.dictStart': '语音输入（实时听写，说完一句识别一句）',
            'ui.gearCollapse': '收起语音设置',
            'ui.gearOpen': '语音设置（引擎/模型/语言/质量/标点/AI精修）',
            // ---- 设置面板 ----
            'set.title': '语音输入设置',
            'set.close': '关闭',
            'set.engine': '识别引擎',
            'set.model': '识别模型',
            'set.lang': '语言',
            'set.quality': '质量',
            'set.engineAuto': '浏览器内置 ASR 识别',
            'set.engineLocal': '本地 base whisper',
            'set.engineFunasr': '本地FunASR',
            'set.engineCloud': '云 ASR（未配置）',
            'set.engineCloudReady': '云 ASR',
            'set.langAuto': '自动',
            'set.langZh': '中文',
            'set.langJa': '日本語',
            'set.langKo': '한국어',
            'set.qualityFast': '快速',
            'set.qualityHigh': '高质量',
            'set.qualityNa': '不适用',
            'set.modelAuto': '随引擎自动',
            'set.modelFunasrFixed': 'paraformer-zh（中文，固定）',
            'set.modelWithProvider': '{m}（随服务商）',
            'set.togglePunct': '标点',
            'set.togglePolish': 'AI精修',
            'set.toggleContext': '语境',
            'set.toggleBatch': '整段',
            'set.punctTitle': '自动添加标点（关闭后剥离标点）',
            'set.polishTitleOn': '每句识别后由 DeepSeek 后台纠错（同音字/口音/标点）',
            'set.polishTitleOff': '未配置 DeepSeek Key，不可用',
            'set.contextTitleOn': 'AI精修时参考最近聊天记录（主题/人名语境，提升纠错；关闭可减少 token 用量）',
            'set.batchTitle': '整段识别：录音期间持续监听，点击停止后整体识别一次（识别时显示"正在识别"提示与短波形，识别后立即 AI 精修）；适合长段落',
            'set.apiBtn': 'API 配置',
            'set.apiBtnClose': '收起 API 配置',
            'set.badgeCloud': '云ASR',
            'set.badgePolish': '精修',
            'set.apiCloudTitle': '云 ASR 配置（预设服务商：OpenAI / Groq / 硅基流动 / 智谱 / 豆包等）',
            'set.providerPreset': '预设服务商',
            'set.presetCustom': '自定义',
            'set.presetOpenai': 'OpenAI 官方',
            'set.presetGroq': 'Groq',
            'set.presetSilicon': '硅基流动',
            'set.presetZhipu': '智谱',
            'set.presetVolc': '豆包（火山引擎）',
            'set.volcAppId': 'AppID（火山引擎语音识别控制台）',
            'set.volcToken': 'Access Token（已配置，可修改）',
            'set.volcTokenEmpty': 'Access Token',
            'set.volcCluster': 'Cluster（默认 volcengine_input_common）',
            'set.volcHint': '豆包为专有 v3 协议（非 OpenAI 兼容），字段以官方文档为准：docs.volcengine.com/docs/6561/1798094；返回 code≠0 时原样显示错误码。',
            'set.baseUrlPh': 'Base URL（默认 https://api.openai.com/v1）',
            'set.apiKeyPh': 'API Key（已配置，可修改）',
            'set.apiKeyPhEmpty': 'API Key',
            'set.polishCfgTitle': 'AI精修（DeepSeek）配置',
            'set.polishStorageHint': '设置与 Key 保存在本机服务端（.voice-prefs.json），换浏览器/清除浏览器数据不丢失；首次会在本机自动同步。',
            'set.storageSyncError': '本机设置同步失败：{err}。当前浏览器缓存仍可用，请检查 DSH Host。',
            'set.modelPath': '模型保存目录',
            'set.modelPathPh': '留空使用默认目录；也可填写其他磁盘路径',
            'set.modelPathDefault': '当前目录：{path}',
            'set.modelPathApply': '应用目录',
            'set.modelPathReset': '使用默认',
            'set.modelPathHint': '模型按需下载，不会随插件本体自动下载；更换目录后只影响后续下载与识别。',
            'set.deepseekBasePh': 'Base URL（默认 https://api.deepseek.com/v1）',
            'set.deepseekKeyPh': 'DeepSeek API Key（已配置，可修改）',
            'set.deepseekKeyPhEmpty': 'DeepSeek API Key',
            'set.polishPromptLabel': '精修 Prompt（留空 = 默认：结合上下文纠正同音字/口音/标点，保持原意与口语风格）',
            'set.polishPromptPh': '（默认 prompt）你是语音转写校对助手。请结合上下文语义，把识别错误的字词规正为最符合语境、最自然的表达，并补充或修正标点与断句；保持原意与口语风格；只输出修正后的文本。',
            'set.modelsBtn': '本地模型管理',
            'set.modelsBtnClose': '收起本地模型',
            'set.modelsCount': '已装 {a}/{b}',
            'set.downloading': '下载中…',
            'set.download': '下载',
            'set.downloaded': '已下载',
            'set.notDownloaded': '未下载',
            'set.loading': '加载中…',
            'set.explainBtn': '引擎说明',
            'set.explainBtnClose': '收起引擎说明',
            'set.explainBrowser': '浏览器内置：最轻最快（自带）',
            'set.explainWhisper': '本地whisper：语言最多，首启较慢',
            'set.explainFunasr': '本地FunASR：中文最好，首启较慢',
            'set.explainRecover': '本地引擎偶发崩溃自动恢复',
            'set.explainCloud': '云 ASR：外部大模型，延迟看网络',
            'set.explainPunct': '标点：自动添加标点',
            'set.explainPolish': 'AI精修：语音输出后两秒AI纠错',
            'set.explainContext': '语境：精修时输入聊天上下文',
            'set.explainBatch': '整段：输入完毕后整体识别，关闭后实时识别（误差更大）',
            'set.explainBrowserTitle': 'Chrome/Edge 内置语音识别（Firefox/Safari 自动改走实时听写）',
            'set.explainWhisperTitle': 'OpenAI Whisper 多语言开源模型，本地离线；质量（beam）仅此引擎生效',
            'set.explainFunasrTitle': '阿里达摩院 paraformer-zh，本地离线，模型按需下载',
            'set.explainRecoverTitle': '本地 worker 进程偶发崩溃时自动一次性回退并后台重建，下一块即恢复',
            'set.explainCloudTitle': 'OpenAI 兼容 / 豆包等外部服务，需自备 API Key',
            'set.clearKeys': '清除保存的 Key',
            'set.clearKeysTitle': '清除本机保存的 API Key（不含其他设置）',
            'set.backendFail': '后端探测失败: {err}',
            'set.modelListFail': '无法获取本地模型状态',
            'set.downloadFail': '下载失败: {err}',
            'set.localComponent': '本地识别组件',
            'set.localReady': '已安装，可以使用本地识别',
            'set.localLegacy': '已发现原有本地环境，将直接复用',
            'set.localMissing': '使用本地识别前，需要安装一次运行组件',
            'set.localInstall': '安装本地组件',
            'set.localInstalling': '正在安装，请保持 DSH 运行…',
            'set.localConfirm': '将安装本地识别运行组件。安装需要联网并占用约 700 MB 空间，是否继续？',
            'set.localInstallFail': '本地组件安装失败: {err}',
            'err.unknown': '未知错误',
          },
          en: {
            'ui.langZh': '中',
            'ui.langEn': 'EN',
            'ui.langTitle': 'UI language: 中文 / English (does not affect recognition language)',
            // ---- status ----
            'status.polishFail': 'Polish failed: {err}',
            'status.listening': 'Listening… no speech yet',
            'status.listeningSec': 'Listening… no speech yet ({s}s)',
            'status.micDenied': 'Microphone denied: check browser permission',
            'status.micDeniedInsecure': 'Microphone denied: page is not HTTPS/localhost (browser blocks recording)',
            'status.noMic': 'No microphone device found',
            'status.micBusy': 'Microphone in use, close other apps',
            'status.micStartFail': 'Microphone start failed: {err}',
            'status.networkReconnect': 'Network lost, reconnecting… ({n}/3)',
            'status.streamNoService': 'No browser speech service: switch to local/cloud engine (⚙)',
            'status.streamNetworkFail': 'Browser speech unavailable (network): switch to local/cloud engine (⚙)',
            'status.noSpeechStopped': 'No speech detected, stopped',
            'status.stoppedNoSpeechLong': 'Stopped (no speech for a long time)',
            'status.startFailed': 'Start failed',
            'status.recogErrorCode': 'Recognition error: {code}',
            'status.startingMic': 'Starting microphone…',
            'status.recogFail': 'Recognition failed: {err}',
            'status.recogError': 'Recognition error: {err}',
            'status.warmHintFunasr': 'Warming up local engine… ({s}s, first time ~30-40s)',
            'status.warmHintWhisper': 'Warming up local engine… ({s}s, first time ~5-10s)',
            'status.engineReady': 'Engine ready',
            'status.warmTimeout': 'Engine start timed out, still usable (first sentence may be slow)',
            'status.noSpeechAutoStopped': 'No speech detected, auto-stopped',
            'status.recognized': 'Recognized',
            'status.stopped': 'Stopped',
            'status.tooLong': 'Recording too long (>10 min), please split it',
            'status.tooShort': 'Recording too short, not recognized',
            'status.noSpeech': 'No speech detected',
            // v61：识别状态精简——始终「Recognizing…」，仅超 5s 追加「(elapsed Ns)」
            'status.recognizing': 'Recognizing…',
            'status.recognizingElapsed': 'Recognizing… (elapsed {e}s)',
            // ---- tooltips ----
            'ui.insecure': 'Not a secure context (HTTPS or localhost required)',
            'ui.noMediaApi': 'No microphone API',
            'ui.noAudioCtx': 'No audio context',
            'ui.unknownReason': 'unknown reason',
            'ui.unsupported': 'Recording not supported: {why} (see ⚙ Settings)',
            'ui.recognizingWhole': 'Recognizing whole recording…',
            'ui.batchStop': 'Stop and recognize all',
            'ui.batchStart': 'Voice input (batch: recognized all at once on stop, waveform shown)',
            'ui.streamStop': 'Stop listening (realtime)',
            'ui.streamStart': 'Voice input (realtime, inserted at cursor)',
            'ui.dictStop': 'Stop dictation',
            'ui.dictStart': 'Voice input (dictation, sentence by sentence)',
            'ui.gearCollapse': 'Collapse voice settings',
            'ui.gearOpen': 'Voice settings (engine/model/language/quality/punct/AI polish)',
            // ---- settings ----
            'set.title': 'Voice Input Settings',
            'set.close': 'Close',
            'set.engine': 'Engine',
            'set.model': 'Model',
            'set.lang': 'Language',
            'set.quality': 'Quality',
            'set.engineAuto': 'Browser built-in ASR',
            'set.engineLocal': 'Local base whisper',
            'set.engineFunasr': 'Local FunASR',
            'set.engineCloud': 'Cloud ASR (not configured)',
            'set.engineCloudReady': 'Cloud ASR',
            'set.langAuto': 'Auto',
            'set.langZh': 'Chinese',
            'set.langJa': 'Japanese',
            'set.langKo': 'Korean',
            'set.qualityFast': 'Fast',
            'set.qualityHigh': 'High quality',
            'set.qualityNa': 'N/A',
            'set.modelAuto': 'Auto (per engine)',
            'set.modelFunasrFixed': 'paraformer-zh (Chinese, fixed)',
            'set.modelWithProvider': '{m} (per provider)',
            'set.togglePunct': 'Punct',
            'set.togglePolish': 'AI polish',
            'set.toggleContext': 'Context',
            'set.toggleBatch': 'Batch',
            'set.punctTitle': 'Auto punctuation (off = strip punctuation)',
            'set.polishTitleOn': 'DeepSeek corrects each sentence in background (homophones/accent/punct)',
            'set.polishTitleOff': 'No DeepSeek Key configured, disabled',
            'set.contextTitleOn': 'Polish uses recent chat context (topics/names, better corrections; off saves tokens)',
            'set.batchTitle': 'Batch: record continuously, recognize all on stop (shows "recognizing" + waveform, then AI polish); good for long passages',
            'set.apiBtn': 'API Settings',
            'set.apiBtnClose': 'Collapse API Settings',
            'set.badgeCloud': 'Cloud ASR',
            'set.badgePolish': 'Polish',
            'set.apiCloudTitle': 'Cloud ASR config (presets: OpenAI / Groq / SiliconFlow / Zhipu / Doubao etc.)',
            'set.providerPreset': 'Provider preset',
            'set.presetCustom': 'Custom',
            'set.presetOpenai': 'OpenAI official',
            'set.presetGroq': 'Groq',
            'set.presetSilicon': 'SiliconFlow',
            'set.presetZhipu': 'Zhipu',
            'set.presetVolc': 'Doubao (Volcengine)',
            'set.volcAppId': 'AppID (Volcengine speech console)',
            'set.volcToken': 'Access Token (configured, editable)',
            'set.volcTokenEmpty': 'Access Token',
            'set.volcCluster': 'Cluster (default volcengine_input_common)',
            'set.volcHint': 'Doubao uses proprietary v3 protocol (not OpenAI-compatible); see docs.volcengine.com/docs/6561/1798094; non-zero code shown verbatim.',
            'set.baseUrlPh': 'Base URL (default https://api.openai.com/v1)',
            'set.apiKeyPh': 'API Key (configured, editable)',
            'set.apiKeyPhEmpty': 'API Key',
            'set.polishCfgTitle': 'AI Polish (DeepSeek) Settings',
            'set.polishStorageHint': 'Settings & keys are stored on this machine (.voice-prefs.json) — shared across browsers; clearing browser data won\'t lose them.',
            'set.storageSyncError': 'Machine settings sync failed: {err}. Browser cache is still available; check the DSH Host.',
            'set.modelPath': 'Model directory',
            'set.modelPathPh': 'Blank uses the default; another drive is supported',
            'set.modelPathDefault': 'Current directory: {path}',
            'set.modelPathApply': 'Apply directory',
            'set.modelPathReset': 'Use default',
            'set.modelPathHint': 'Models download on demand; the plugin does not fetch them during install. Changing this affects future downloads and recognition.',
            'set.deepseekBasePh': 'Base URL (default https://api.deepseek.com/v1)',
            'set.deepseekKeyPh': 'DeepSeek API Key (configured, editable)',
            'set.deepseekKeyPhEmpty': 'DeepSeek API Key',
            'set.polishPromptLabel': 'Polish prompt (blank = default: fix homophones/accent/punctuation in context, keep meaning & spoken style)',
            'set.polishPromptPh': '(default prompt) You are a speech transcription proofreader. Fix misrecognized words to the most context-appropriate natural expressions, and add/correct punctuation; keep meaning & spoken style; output only the corrected text.',
            'set.modelsBtn': 'Local Models',
            'set.modelsBtnClose': 'Collapse Local Models',
            'set.modelsCount': 'Installed {a}/{b}',
            'set.downloading': 'Downloading…',
            'set.download': 'Download',
            'set.downloaded': 'Downloaded',
            'set.notDownloaded': 'Not downloaded',
            'set.loading': 'Loading…',
            'set.explainBtn': 'Engine Notes',
            'set.explainBtnClose': 'Collapse Engine Notes',
            'set.explainBrowser': 'Browser built-in: lightest & fastest (built-in)',
            'set.explainWhisper': 'Local whisper: most languages, slower first start',
            'set.explainFunasr': 'Local FunASR: best Chinese, slower first start',
            'set.explainRecover': 'Local engine auto-recovers after crashes',
            'set.explainCloud': 'Cloud ASR: external model, latency depends on network',
            'set.explainPunct': 'Punct: auto punctuation',
            'set.explainPolish': 'AI polish: corrects 2s after speech',
            'set.explainContext': 'Context: chat context fed to polish',
            'set.explainBatch': 'Batch: recognize all at once on stop; off = realtime (less accurate)',
            'set.explainBrowserTitle': 'Chrome/Edge built-in speech (Firefox/Safari fall back to dictation)',
            'set.explainWhisperTitle': 'OpenAI Whisper multilingual open model, local & offline; quality (beam) only applies here',
            'set.explainFunasrTitle': 'Alibaba DAMO paraformer-zh, local & offline, downloaded on demand',
            'set.explainRecoverTitle': 'Auto one-shot fallback + background rebuild when local worker crashes; next chunk recovers',
            'set.explainCloudTitle': 'OpenAI-compatible / Doubao external services, bring your own API key',
            'set.clearKeys': 'Clear saved keys',
            'set.clearKeysTitle': 'Clear API keys saved on this machine (other settings kept)',
            'set.backendFail': 'Backend probe failed: {err}',
            'set.modelListFail': 'Cannot fetch local model status',
            'set.downloadFail': 'Download failed: {err}',
            'set.localComponent': 'Local recognition component',
            'set.localReady': 'Installed and ready for local recognition',
            'set.localLegacy': 'Existing local environment found and reused',
            'set.localMissing': 'Install the runtime component once before using local recognition',
            'set.localInstall': 'Install local component',
            'set.localInstalling': 'Installing. Keep DSH running…',
            'set.localConfirm': 'This installs the local recognition runtime. It requires internet access and about 700 MB of disk space. Continue?',
            'set.localInstallFail': 'Local component installation failed: {err}',
            'err.unknown': 'Unknown error',
          },
        }
        function t(key, vars) {
          const dict = I18N[prefs.uiLang === 'en' ? 'en' : 'zh'] || I18N.zh
          let s = dict[key] || I18N.zh[key] || key
          if (vars) { for (const k in vars) s = s.split('{' + k + '}').join(String(vars[k])) }
          return s
        }

        // v62：跨浏览器设置持久化——改动 400ms 防抖写回 Host 数据目录。
        // localStorage 仍保留为离线缓存；Host 写入失败必须对用户可见，不能静默吞掉。
        let prefsPushTimer = null
        let prefsSyncError = ''
        const prefsSyncListeners = new Set()
        function notifyPrefsSync(error) {
          const next = error ? String(error) : ''
          if (prefsSyncError === next) return
          prefsSyncError = next
          prefsSyncListeners.forEach((fn) => { try { fn(prefsSyncError) } catch (e) {} })
        }
        function schedulePrefsPush() {
          if (prefsPushTimer) clearTimeout(prefsPushTimer)
          prefsPushTimer = setTimeout(() => {
            prefsPushTimer = null
            const v = voiceRemote()
            if (!v || typeof v.setPrefs !== 'function') {
              notifyPrefsSync('本机服务未连接')
              return
            }
            const save = {}
            for (const k of PERSISTED_KEYS) save[k] = prefs[k]
            Promise.resolve(v.setPrefs({ prefs: save })).then((res) => {
              if (!res || res.ok !== true) notifyPrefsSync((res && res.error) || '本机服务未确认保存')
              else notifyPrefsSync('')
            }).catch((err) => {
              notifyPrefsSync((err && (err.message || err.error)) || String(err || '本机服务不可用'))
            })
          }, 400)
        }

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
          // v62：模型缓存根目录。留空沿用 ASR 工作区，可填写其他磁盘目录。
          modelRoot: '',
          // v60：界面语言（中/EN），与识别语言（lang）独立
          uiLang: 'zh',
        }, loadSaved(), {
          envAsrAvailable: false,
          envPolishAvailable: false,
          settingsOpen: false,
          listeners: new Set(),
          get() { return { engine: this.engine, asrProvider: this.asrProvider, model: this.model, lang: this.lang, beam: this.beam, usePunct: this.usePunct, aiPolish: this.aiPolish, polishPrompt: this.polishPrompt, polishContext: this.polishContext, batchMode: this.batchMode, envAsrAvailable: this.envAsrAvailable, envPolishAvailable: this.envPolishAvailable, asrKey: this.asrKey, asrBaseUrl: this.asrBaseUrl, deepseekKey: this.deepseekKey, deepseekBaseUrl: this.deepseekBaseUrl, volcAppId: this.volcAppId, volcAccessToken: this.volcAccessToken, volcCluster: this.volcCluster, uiLang: this.uiLang, modelRoot: this.modelRoot, settingsOpen: this.settingsOpen } },
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
              // v59：改动同步到 Host（跨浏览器共享），防抖 400ms
              schedulePrefsPush()
            }
          },
          clearSecrets() {
            this.set({ asrKey: '', asrBaseUrl: '', deepseekKey: '', deepseekBaseUrl: '', volcAppId: '', volcAccessToken: '', volcCluster: '' })
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

        // v62：启动时从 Host 拉取跨浏览器设置——服务端优先合并进本地并写回 localStorage；
        // 合并后总是写回服务端，保证「服务端 ∪ 本地」一致（首次迁移不因浏览器打开顺序丢 Key）。
        {
          const v0 = voiceRemote()
          if (v0 && typeof v0.getPrefs === 'function') {
            v0.getPrefs().then((res) => {
              if (!res || !res.ok || !res.prefs || typeof res.prefs !== 'object') {
                notifyPrefsSync((res && res.error) || '读取本机设置失败')
                schedulePrefsPush()
                return
              }
              notifyPrefsSync('')
              const patch = {}
              for (const k of PERSISTED_KEYS) {
                if (typeof res.prefs[k] !== 'undefined') patch[k] = res.prefs[k]
              }
              if (Object.keys(patch).length) prefs.set(patch)
              schedulePrefsPush()
            }).catch((err) => {
              notifyPrefsSync((err && (err.message || err.error)) || '读取本机设置失败')
            })
          } else {
            notifyPrefsSync('本机服务未连接')
          }
        }
        const usePrefs = () => {
          const [, bump] = React.useState(0)
          React.useEffect(() => prefs.subscribe(() => bump((v) => v + 1)), [])
          return prefs.get()
        }
        const usePrefsSync = () => {
          const [, bump] = React.useState(0)
          React.useEffect(() => {
            const fn = () => bump((v) => v + 1)
            prefsSyncListeners.add(fn)
            return () => prefsSyncListeners.delete(fn)
          }, [])
          return prefsSyncError
        }
        const fmtErr = (e) => {
          if (typeof e === 'string') return e
          if (e == null) return t('err.unknown')
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

        // v57：onSpeech——检测到语音（每块响度超阈 / 句子 flush）时回调，用于重置无语音自动停止计时
        function startDictation(onSentence, onError, onSpeech) {
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
                  // v61：校准期不再丢弃音频——静音块进滚动 preBuf（pre-roll 缓冲）；
                  // 检测到开口（rms>0.03）立即结束校准（用默认基线 0.01），不再无限重置丢弃——
                  // 原 v26 逻辑在「开麦即开口」时反复重置并丢弃音频，导致首句整段丢失；
                  // 开口块本身不重复进 preBuf（fallthrough 后由 VAD 直接收入 speechBuf）
                  if (rms > 0.03) {
                    calibMs = 300 // 开口 → 立即结束校准，fallthrough 用当前块触发 VAD
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
                    preBuf.push(new Float32Array(d))
                    if (preBuf.length > PRE_ROLL_BLOCKS) preBuf.shift()
                  }
                  if (calibMs < 300) return
                }
                thr = Math.max(baseline * 3, 0.008) // v52：更新外层阈值，flush 裁剪与 VAD 判断一致
                if (rms > thr) {
                  if (!speechActive) {
                    speechActive = true
                    // v26：pre-roll——把触发前的 ~200ms 缓冲并入块，避免切掉字头（声母）
                    speechBuf = preBuf.slice()
                    speechRms = []
                  }
                  // v57：持续说话期间每块都重置无语音计时，杜绝句子中途被自动停止
                  try { onSpeech && onSpeech() } catch (e) {}
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
        // v57：onActivity——块级响度超阈时回调，用于重置无语音自动停止计时（整段模式无 VAD）
        function startBatchCapture(onLevel, onError, onActivity) {
          return new Promise((resolve, reject) => {
            navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
              const AC = window.AudioContext || window.webkitAudioContext
              const actx = new AC()
              const rate = actx.sampleRate || 48000
              const source = actx.createMediaStreamSource(stream)
              const processor = actx.createScriptProcessor(4096, 1, 1)
              const chunks = []
              const blockRms = [] // v58：每块 rms（与 chunks 对齐），供尾部静音裁剪
              const CHUNK_MS = 4096 / rate * 1000
              let seconds = 0
              let lastLevelAt = 0
              processor.onaudioprocess = (e) => {
                const d = e.inputBuffer.getChannelData(0)
                chunks.push(new Float32Array(d))
                seconds += CHUNK_MS / 1000
                let sum = 0
                for (let i = 0; i < d.length; i++) sum += d[i] * d[i]
                const rms = Math.sqrt(sum / d.length)
                blockRms.push(rms)
                // v57：有声音即重置无语音计时（阈值与 VAD 最低阈值一致）
                if (rms > SPEECH_RMS) { try { onActivity && onActivity() } catch (err) {} }
                const now = Date.now()
                if (now - lastLevelAt >= 80) {
                  lastLevelAt = now
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
                // v58：尾部静音裁剪——与听写模式 flush 同款逻辑（阈值 0.008，保留 ≥2 块 ~170ms），
                // 防 whisper/FunASR 对长静音尾部产生幻觉重复字，同时缩短识别耗时
                let cut = chunks.length
                while (cut > 2 && blockRms[cut - 1] < SPEECH_RMS) cut--
                const trimmed = (cut < chunks.length) ? chunks.slice(0, cut) : chunks
                const trimmedSeconds = chunks.length ? seconds * trimmed.length / chunks.length : seconds
                return { wav: encodeWavBase64(trimmed, sampleRate), seconds: trimmedSeconds }
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
            // v58：扩展探测（moz/ms/o 前缀 + 大小写兜底）
            try {
              return typeof window !== 'undefined' && !!detectSpeechRecognition()
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
          // v57：状态自动消失 / 无语音自动停止 / 预热提示的定时器与标志
          const statusTimerRef = React.useRef(null)
          const noSpeechTimerRef = React.useRef(null)
          const warmTimerRef = React.useRef(null)
          const warmTickRef = React.useRef(null)
          const warmStartRef = React.useRef(0)
          const warmHintActiveRef = React.useRef(false)
          const autoStopRef = React.useRef(false)
          // v57：无语音计时触发时按当前模式调用对应的停止函数（渲染时更新，避免回调闭包过期）
          const stopActionRef = React.useRef(null)

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
          // v63：实时识别收尾预留窗口状态 { rec, timer, draft, own }
          //   rec   停止后仍保留回调的识别对象（窗口结束或抛弃时才真正拆机）
          //   draft 点击停止时的草稿快照；own 窗口内插件自己写入草稿的最新值
          //   草稿既不等于 draft 也不等于 own ⇒ 用户在窗口内改动过（编辑/已发送/换对话）
          const graceRef = React.useRef(null)
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
            // v61：不再清空 lastChunkRef（保留重定位锚点）；插入点锚定到当前草稿末尾，
            // 避免后续块插入到 AI 精修/外部改动后的过期坐标（原 bug：重复/错位堆积）
            insPointRef.current = draft.length
          }

          // v63：插件自身写入草稿（上屏、AI 精修改字）时同步刷新收尾窗口快照，
          // 避免把自己的写入误判成「用户改动」而白丢收尾内容。
          const noteGraceDraft = (next) => {
            const g = graceRef.current
            if (g) g.own = next
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
            const warmKey = (pre.modelRoot || '') + '|' + (isFunasr ? 'funasr' : 'local') + '|' + model
            const st = warmStateRef.current
            if (st[warmKey] === 'done') return Promise.resolve({ ok: true, cached: true })
            if (warmPendingRef.current[warmKey]) return warmPendingRef.current[warmKey]
            const p = v.warm({ model, backend: isFunasr ? 'funasr' : 'local', modelRoot: pre.modelRoot || '' }).then((r) => {
              st[warmKey] = (r && r.ok) ? 'done' : 'failed'
              return r || { ok: false }
            }).catch((err) => {
              st[warmKey] = 'failed'
              return { ok: false, error: String((err && err.message) || err) }
            })
            warmPendingRef.current[warmKey] = p
            const settle = () => { if (warmPendingRef.current[warmKey] === p) delete warmPendingRef.current[warmKey] }
            p.then(settle, settle)
            return p
          }, [])

          React.useEffect(() => {
            // 选择本地/FunASR 引擎 / 切换本地模型的那一刻就预热，把冷启动挪到说话之前
            if (p.engine === 'local' || p.engine === 'funasr') warmLocal()
          }, [p.engine, p.model, p.modelRoot, warmLocal])

          // v52：引擎/模型切换时销毁常驻 worker——whisper 与 FunASR 不同时驻留
          //（每个模型 ~1-1.6GB）；切到浏览器内置 ASR / 云 ASR 时同样销毁释放内存。
          // 成功后清空预热状态，下次使用会重新加载（首次稍慢但内存干净）。
          // v61：修复「换对话后首次说话重新加载」——原效果在每次挂载（新对话输入栏
          // 挂载）时都执行 resetWorker，把已加载模型销毁；改为仅当引擎/模型真的变化
          // 时才销毁（prev ref 跳过首次挂载与纯重渲染）。
          const prevEngineRef = React.useRef(null)
          const prevModelRef = React.useRef(null)
          const prevModelRootRef = React.useRef(null)
          React.useEffect(() => {
            const engineChanged = prevEngineRef.current !== null && prevEngineRef.current !== p.engine
            const modelChanged = prevModelRef.current !== null && prevModelRef.current !== p.model
            const modelRootChanged = prevModelRootRef.current !== null && prevModelRootRef.current !== p.modelRoot
            prevEngineRef.current = p.engine
            prevModelRef.current = p.model
            prevModelRootRef.current = p.modelRoot
            if (!engineChanged && !modelChanged && !modelRootChanged) return // 首次挂载/换对话：保留已加载 worker
            const v = voiceRemote()
            if (!v || typeof v.resetWorker !== 'function') return
            let alive = true
            v.resetWorker().then(() => {
              if (!alive) return
              warmStateRef.current = {}
              warmPendingRef.current = {}
            }).catch(() => {})
            return () => { alive = false }
          }, [p.engine, p.model, p.modelRoot])

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
            v.polish({ text, before, after, context: chatCtx, prompt: pre.polishPrompt || '', apiKey: pre.deepseekKey, baseUrl: pre.deepseekBaseUrl, modelRoot: pre.modelRoot || '' }).then((r2) => {
              if (!r2) return
              if (!r2.ok) { setStatusSafe(t('status.polishFail', { err: fmtErr(r2.error || t('err.unknown')) })); return }
              if (typeof r2.text !== 'string' || !r2.text || r2.text === text) return
              const cur2 = draftRef.current
              if (cur2.slice(start, end) === text) {
                const next = cur2.slice(0, start) + r2.text + cur2.slice(end)
                applyDraft(next)
                noteGraceDraft(next) // v63：精修改字同样算插件自己的写入
                restoreCaret(start + r2.text.length)
              }
            }).catch((err) => { setStatusSafe(t('status.polishFail', { err: fmtErr(err) })) })
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
          // v57：任何新状态都会取消挂起的自动消失定时器（错误提示不会被旧定时器误清）
          const setStatusSafe = (s) => {
            if (statusTimerRef.current) { clearTimeout(statusTimerRef.current); statusTimerRef.current = null }
            if (typeof s === 'function') {
              setStatus((prev) => { const n = s(prev); statusRef.current = n; return n })
              return
            }
            statusRef.current = s
            setStatus(s)
          }

          // v57：瞬时提示——设置状态并在 ms 后自动消失（仅当状态仍未被其他操作替换时清除）
          const flashStatus = React.useCallback((msg, ms) => {
            setStatusSafe(msg)
            statusTimerRef.current = setTimeout(() => {
              if (statusRef.current === msg) setStatusSafe('')
            }, ms || STATUS_FLASH_MS)
          }, [])

          // v57：清除预热提示（定时器 + 状态文案）
          // v60：中文/英文界面双前缀判断
          const stopWarmHint = React.useCallback(() => {
            warmHintActiveRef.current = false
            if (warmTimerRef.current) { clearTimeout(warmTimerRef.current); warmTimerRef.current = null }
            if (warmTickRef.current) { clearInterval(warmTickRef.current); warmTickRef.current = null }
            const s = statusRef.current
            if (s && (s.indexOf('本地引擎预热中') === 0 || s.indexOf('Warming up local engine') === 0)) setStatusSafe('')
          }, [])

          // v32：过程提示——录音中 ≥3s 仍无文字上屏，显示灰色「聆听中…未识别到语音」（每 5s 刷新已听秒数）
          // v57：同时清除无语音自动停止计时与预热提示（任何停止/上屏/重新计时都重置）
          // v60：中文/英文界面双前缀判断
          const stopIdleHint = React.useCallback(() => {
            if (idleTimerRef.current) { clearTimeout(idleTimerRef.current); idleTimerRef.current = null }
            if (idleTickRef.current) { clearInterval(idleTickRef.current); idleTickRef.current = null }
            if (noSpeechTimerRef.current) { clearTimeout(noSpeechTimerRef.current); noSpeechTimerRef.current = null }
            stopWarmHint()
            const s = statusRef.current
            if (s && (s.indexOf('聆听中') === 0 || s.indexOf('Listening') === 0)) setStatusSafe('')
          }, [stopWarmHint])

          const startIdleHint = React.useCallback((mySession) => {
            stopIdleHint()
            idleStartRef.current = Date.now()
            idleTimerRef.current = setTimeout(() => {
              if (sessionRef.current !== mySession) { stopIdleHint(); return }
              if (statusRef.current) return
              const secs = Math.max(0, Math.floor((Date.now() - idleStartRef.current) / 1000))
              setStatusSafe(secs < 5 ? t('status.listening') : t('status.listeningSec', { s: secs }))
              idleTickRef.current = setInterval(() => {
                if (sessionRef.current !== mySession) { stopIdleHint(); return }
                if (statusRef.current) { stopIdleHint(); return }
                const s2 = Math.max(0, Math.floor((Date.now() - idleStartRef.current) / 1000))
                setStatusSafe(t('status.listeningSec', { s: s2 }))
              }, 5000)
            }, 3000)
          }, [stopIdleHint])

          // v57：无语音自动停止——引擎就绪后连续 NO_SPEECH_STOP_MS 无语音则自动停止。
          // 预热期间不计时（warm 完成/30s 超时后才生效）；说话（VAD/活动检测）会重置计时。
          // force=true：预热超时兜底路径（此时 warm 可能仍在后台，但不能再无限等待）。
          const armNoSpeech = React.useCallback((mySession, force) => {
            if (noSpeechTimerRef.current) { clearTimeout(noSpeechTimerRef.current); noSpeechTimerRef.current = null }
            if (!force) {
              const pre = prefsRef.current
              const model = pre.engine === 'funasr' ? 'paraformer-zh' : (pre.model || 'base')
              if (warmPendingRef.current[model]) return // 引擎未就绪，不计时
            }
            noSpeechTimerRef.current = setTimeout(() => {
              if (sessionRef.current !== mySession) return
              if (!dictStopRef.current && !batchStopRef.current) return
              autoStopRef.current = true
              const fn = stopActionRef.current
              if (fn) fn()
            }, NO_SPEECH_STOP_MS)
          }, [])

          // v57：预热提示——「本地引擎预热中…（已 N 秒，首次约 5-10 秒）」每 5s 刷新；
          // 预热上限 WARM_CAP_MS，超时提示后转入正常聆听计时（不阻断使用）。
          const startWarmHint = React.useCallback((mySession) => {
            stopIdleHint()
            warmHintActiveRef.current = true
            warmStartRef.current = Date.now()
            const show = () => {
              if (sessionRef.current !== mySession) { stopWarmHint(); return }
              const secs = Math.max(0, Math.floor((Date.now() - warmStartRef.current) / 1000))
              // v58：按引擎如实显示预期时长（FunASR 冷加载实测 38-39s）
              const key = prefsRef.current.engine === 'funasr' ? 'status.warmHintFunasr' : 'status.warmHintWhisper'
              setStatusSafe(t(key, { s: secs }))
            }
            show()
            warmTickRef.current = setInterval(show, WARM_HINT_TICK_MS)
            warmTimerRef.current = setTimeout(() => {
              if (sessionRef.current !== mySession) return
              stopWarmHint()
              flashStatus(t('status.warmTimeout'), STATUS_FLASH_MS)
              // 等超时提示消失后再进入聆听计时（避免提示互相覆盖）
              warmTimerRef.current = setTimeout(() => {
                if (sessionRef.current !== mySession) return
                startIdleHint(mySession)
                armNoSpeech(mySession, true)
              }, STATUS_FLASH_MS + 100)
            }, WARM_CAP_MS)
          }, [stopIdleHint, stopWarmHint, flashStatus, startIdleHint, armNoSpeech])

          const commitChunk = React.useCallback((chunk) => {
            stopIdleHint()
            // v57：文字上屏后重启无语音计时（stopIdleHint 已清除旧计时；仅在听写/整段录音中生效）
            if (dictStopRef.current || batchStopRef.current) armNoSpeech(sessionRef.current)
            if (!chunk) return
            const a = actionsRef.current
            if (!a || typeof a.setDraft !== 'function') return
            const cur = draftRef.current
            // v61：优先按上一块文本在最新草稿中重定位插入点（AI精修/外部改动后自愈，
            // 不再依赖会被精修改失效的绝对偏移）；找不到锚点则回退到 insPointRef
            //（外部改动时已被锚定到草稿末尾 → 追加，杜绝重复/错位堆积）
            let at = null
            if (lastChunkRef.current && typeof lastChunkRef.current.text === 'string' && lastChunkRef.current.text) {
              const idx = cur.lastIndexOf(lastChunkRef.current.text)
              if (idx >= 0) at = idx + lastChunkRef.current.text.length
            }
            if (at == null) at = Math.max(0, Math.min(insPointRef.current || cur.length, cur.length))
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
            noteGraceDraft(next) // v63：上屏同样算插件自己的写入
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

          // v63：收尾预留窗口收尾。
          //   commit=true —— 窗口正常到点：把窗口内浏览器始终未落定为 final 的最后一段
          //                  interim 补上屏（现在实现里 interim 本就不显示，这是「还有话
          //                  没上屏」的主要来源），再落定精修、光标回位。
          //   commit=false —— 立即抛弃：窗口内开启新会话 / 用户改动草稿 / 组件卸载，
          //                  照整段识别的老规矩，旧会话在途结果一律作废。
          // 两条路径都摘除回调、abort、代际 +1，窗口外的迟到事件不可能再上屏。
          const closeStreamTail = React.useCallback((commit) => {
            const g = graceRef.current
            if (!g) return
            graceRef.current = null
            if (g.timer) { clearTimeout(g.timer); g.timer = null }
            // 草稿被用户改动过（手动编辑 / 消息已发送 / 换了新对话）→ 即便到点也不补上屏。
            // own 覆盖插件自己在窗口内的写入（上屏/精修），避免把自己的写入误判成用户改动。
            const stale = draftRef.current !== g.draft && draftRef.current !== g.own
            const leftover = (textRef.current || '').trim()
            textRef.current = ''
            if (commit && !stale && leftover) {
              const chunk = (usePunctRef.current ? leftover : stripPunct(leftover)).trim()
              if (chunk) {
                commitChunk(chunk)
                const lc = lastChunkRef.current
                if (lc) queuePolish(lc.start, chunk)
              }
            }
            sessionRef.current += 1 // v26：代际作废——窗口外迟到事件一律丢弃
            const rec = g.rec
            if (rec) {
              try {
                rec.onresult = null; rec.onerror = null; rec.onend = null
                rec.stop && rec.stop()
                rec.abort && rec.abort()
              } catch (e) { console.error('closeStreamTail', e) }
            }
            if (commit) {
              // v33：停止时落定挂起的精修窗口（最后一句也被精修，识别仍静默）
              if (polishTimerRef.current) {
                clearTimeout(polishTimerRef.current)
                polishTimerRef.current = null
                flushPolish()
              }
              polishPendingRef.current = null
              // 用户已改动草稿时不再回位光标，避免打断正在进行的编辑
              if (!stale) restoreCaret(insPointRef.current)
            }
          }, [commitChunk, stripPunct, queuePolish, flushPolish, restoreCaret])

          const startStream = React.useCallback((keepPoint) => {
            const a = actionsRef.current
            if (!streamSupported || !a) return
            if (recRef.current !== null) return
            // v52：进入实时模式前清理整段残留（未正常停止的整段采集/波形）
            clearBatchResidual()
            // v63：开启新会话 → 立即抛弃上一次实时识别的收尾预留内容（与整段识别一致）
            if (graceRef.current) closeStreamTail(false)
            const mySession = ++sessionRef.current
            autoStopRef.current = false
            const SR = window[detectSpeechRecognition()]
            const rec = new SR()
            // v58：stream 跟随「语言」设置（auto 不设置走浏览器默认）
            const mappedLang = STREAM_LANG_MAP[prefsRef.current.lang]
            if (mappedLang) rec.lang = mappedLang
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
              // v63：收尾窗口内草稿已被用户改动（手动编辑 / 消息已发送 / 换了新对话）→
              // 立即抛弃收尾，避免尾巴文字落进用户的新内容里
              const gg = graceRef.current
              if (gg && draftRef.current !== gg.draft && draftRef.current !== gg.own) { closeStreamTail(false); return }
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
                // v58：明确建议改用本地/云端引擎（小众浏览器常无可用实时识别服务）
                setStatusSafe(code === 'service-not-allowed' ? t('status.streamNoService') : t('status.micDenied'))
                return
              }
              if (code === 'network') {
                if (netRetriesRef.current < 3) {
                  netRetriesRef.current += 1
                  setStatusSafe(t('status.networkReconnect', { n: netRetriesRef.current }))
                  setIsError(true)
                  startStream(true)
                } else {
                  setListening(false); setIsError(true)
                  // v58：不自动切引擎，给出明确建议
                  setStatusSafe(t('status.streamNetworkFail'))
                }
                return
              }
              if (code === 'no-speech') {
                if (noSpeechRetriesRef.current < 2) {
                  noSpeechRetriesRef.current += 1
                  startStream(true)
                } else {
                  setListening(false); setIsError(true)
                  flashStatus(t('status.noSpeechStopped'), STATUS_FLASH_MS)
                }
                return
              }
              if (code) {
                setListening(false); setIsError(true)
                setStatusSafe(t('status.recogErrorCode', { code }))
                return
              }
              if (cleanRestartsRef.current < 15) {
                cleanRestartsRef.current += 1
                startStream(true)
              } else {
                setListening(false); setIsError(false)
                flashStatus(t('status.stoppedNoSpeechLong'), STATUS_FLASH_MS)
                restoreCaret(insPointRef.current)
              }
            }
            recRef.current = rec
            setListening(true)
            setStatusSafe('')
            setIsError(false)
            startIdleHint(mySession)
            try { rec.start() } catch (e) { console.error('start', e); recRef.current = null; setListening(false); setIsError(true); setStatusSafe(t('status.startFailed')) }
          }, [streamSupported, commitChunk, stripPunct, restoreCaret, queuePolish, startIdleHint, stopIdleHint, closeStreamTail])

          const teardownStream = React.useCallback(() => {
            userStoppedRef.current = true
            stopIdleHint()
            const rec = recRef.current
            recRef.current = null
            setListening(false)
            if (rec) {
              // v63：收尾预留——不再立刻 abort（abort 会丢弃浏览器尚未落定的最后一句）。
              // 只 stop()：浏览器停止采集并把已收音的尾部结果落定为 final，随后 onend；
              // 期间保留 onresult 进入收尾窗口，窗口内迟到的 final / 未落定 interim 仍上屏。
              try { rec.stop && rec.stop() } catch (e) { console.error('stop stream', e) }
              const g = { rec: rec, timer: null, draft: draftRef.current, own: null }
              graceRef.current = g
              g.timer = setTimeout(() => { closeStreamTail(true) }, STREAM_TAIL_GRACE_MS)
            } else {
              // v26：无活动识别对象时直接作废代际（保持旧行为）
              sessionRef.current += 1
            }
            // v33：停止时立即落定挂起的精修窗口（最后一句也被精修，识别仍静默）
            if (polishTimerRef.current) {
              clearTimeout(polishTimerRef.current)
              polishTimerRef.current = null
              flushPolish()
            }
            polishPendingRef.current = null
            restoreCaret(insPointRef.current)
          }, [restoreCaret, stopIdleHint, flushPolish, closeStreamTail])

          const startDict = React.useCallback(() => {
            const a = actionsRef.current
            if (!mediaSupported || !a || dictStopRef.current) return
            // v52：进入实时听写前清理整段残留（未正常停止的整段采集/波形）
            clearBatchResidual()
            // v63：开启新会话 → 立即抛弃上一次实时识别的收尾预留内容（与整段识别一致）
            if (graceRef.current) closeStreamTail(false)
            // v27：新会话代际——旧会话（含已停止但仍在途的请求）回调一律作废
            const mySession = ++sessionRef.current
            autoStopRef.current = false
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
              setStatusSafe(t('status.startingMic'))
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
                    modelRoot: pre.modelRoot || '',
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
                    const em = fmtErr((res && res.error) || t('err.unknown'))
                    if (/no speech/i.test(em)) return
                    setIsError(true)
                    setStatusSafe(t('status.recogFail', { err: em }))
                  }
                }).catch((err) => {
                  if (sessionRef.current !== mySession) return
                  const em = fmtErr(err)
                  if (/no speech/i.test(em)) return
                  setIsError(true)
                  setStatusSafe(t('status.recogFail', { err: em }))
                })
              }, (err) => {
                if (sessionRef.current !== mySession) return
                setIsError(true)
                setStatusSafe(t('status.recogError', { err: String((err && err.message) || err) }))
              }, () => {
                // v57：检测到语音 → 重置无语音自动停止计时
                // v60：同时清除「聆听中…未识别到语音」提示——用户正在说（即使引擎仍在加载），
                // 不应对用户显示「未识别到语音」
                if (sessionRef.current === mySession) {
                  stopIdleHint()
                  armNoSpeech(mySession)
                }
              })
              .then((stopFn) => {
                if (sessionRef.current !== mySession) {
                  // 会话已被停止（如授权弹窗期间点了停止）：仍须释放麦克风流
                  try { if (stopFn) stopFn() } catch (e) { console.error('stop late dict', e) }
                  return
                }
                dictStopRef.current = stopFn
                setListening(true)
                // v57：预热未完成 → 预热提示（带已等待秒数）；已就绪 → 聆听提示 + 无语音计时
                if (warmPendingRef.current[model]) {
                  startWarmHint(mySession)
                } else {
                  setStatusSafe('')
                  startIdleHint(mySession)
                  armNoSpeech(mySession)
                }
              }).catch((err) => {
                if (sessionRef.current !== mySession) return
                setIsError(true)
                const name = err && err.name
                if (name === 'NotAllowedError' || name === 'SecurityError') {
                  const insecure = typeof window !== 'undefined' && window.isSecureContext === false
                  setStatusSafe(insecure ? t('status.micDeniedInsecure') : t('status.micDenied'))
                }
                else if (name === 'NotFoundError') setStatusSafe(t('status.noMic'))
                else if (name === 'NotReadableError') setStatusSafe(t('status.micBusy'))
                else setStatusSafe(t('status.micStartFail', { err: (name || (err && err.message) || err) }))
              })
            }
            if (needWarm) {
              // v57：预热不阻塞开麦——立即进入听写，预热在后台并行完成；
              // 预热提示由 beginDict 的 .then（麦克风已开）接管；预热完成后：
              // 清除预热提示 → 「引擎就绪」1.5s → 聆听提示 + 无语音计时。
              setIsError(false)
              warmLocal().then((r) => {
                if (sessionRef.current !== mySession) return
                stopWarmHint()
                if (warmHintActiveRef.current && r && r.ok) flashStatus(t('status.engineReady'), ENGINE_READY_FLASH_MS)
                startIdleHint(mySession)
                armNoSpeech(mySession)
              })
            }
            beginDict()
          }, [mediaSupported, commitChunk, stripPunct, queuePolish, warmLocal, startIdleHint, startWarmHint, armNoSpeech, flashStatus, closeStreamTail])

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
            // v57：无语音自动停止 → 「未检测到语音，已自动停止」；否则「已识别」；均 3s 自动消失
            if (autoStopRef.current) {
              autoStopRef.current = false
              flashStatus(t('status.noSpeechAutoStopped'), STATUS_FLASH_MS)
            } else {
              flashStatus(t('status.recognized'), STATUS_FLASH_MS)
            }
          }, [restoreCaret, stopIdleHint, flushPolish, flashStatus])

          // v35：整段模式（可选）——录音期间持续监听、不切块不上屏，
          // 点击停止后整体识别一次：显示「正在识别…」提示 + 整段短波形，
          // 识别完成后插入光标处，并立即由 AI 精修（语流已结束，不等合并窗口）。
          const startBatch = React.useCallback(() => {
            const a = actionsRef.current
            if (!mediaSupported || !a || batchStopRef.current) return
            // v63：开启新会话 → 立即抛弃上一次实时识别的收尾预留内容（与整段识别一致）
            if (graceRef.current) closeStreamTail(false)
            const mySession = ++sessionRef.current
            autoStopRef.current = false
            const pre = prefsRef.current
            const isFunasr = pre.engine === 'funasr'
            const localDict = isFunasr || pre.engine === 'local' || pre.engine === 'auto'
            const model = isFunasr ? 'paraformer-zh' : (pre.model || 'base')
            const v = voiceRemote()
            const warmSupported = !!(v && typeof v.warm === 'function')
            const needWarm = localDict && warmSupported && warmStateRef.current[model] !== 'done'
            const beginBatch = () => {
              if (sessionRef.current !== mySession) return
              setStatusSafe(t('status.startingMic'))
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
              }, null, () => {
                // v57：检测到声音 → 重置无语音自动停止计时（整段模式无 VAD，用响度判断）
                // v60：同时清除「聆听中…未识别到语音」提示
                if (sessionRef.current === mySession) {
                  stopIdleHint()
                  armNoSpeech(mySession)
                }
              }).then((stopFn) => {
                if (sessionRef.current !== mySession) {
                  // 会话已被停止（如授权弹窗期间点了停止）：仍须释放麦克风流
                  try { if (stopFn) stopFn() } catch (e) { console.error('stop late batch', e) }
                  return
                }
                batchStopRef.current = stopFn
                setListening(true)
                // v36：录音中不再显示「整段录音中…（再次点击停止）」文案（占位），
                // 红点脉冲 + 实时波形已足够反馈；预热中显示预热提示（v57 带秒数）
                if (warmPendingRef.current[model]) {
                  startWarmHint(mySession)
                } else {
                  setStatusSafe('')
                  startIdleHint(mySession)
                  armNoSpeech(mySession)
                }
              }).catch((err) => {
                if (sessionRef.current !== mySession) return
                setIsError(true)
                const name = err && err.name
                if (name === 'NotAllowedError' || name === 'SecurityError') {
                  const insecure = typeof window !== 'undefined' && window.isSecureContext === false
                  setStatusSafe(insecure ? t('status.micDeniedInsecure') : t('status.micDenied'))
                }
                else if (name === 'NotFoundError') setStatusSafe(t('status.noMic'))
                else if (name === 'NotReadableError') setStatusSafe(t('status.micBusy'))
                else setStatusSafe(t('status.micStartFail', { err: (name || (err && err.message) || err) }))
              })
            }
            if (needWarm) {
              // v57：预热不阻塞开麦——立即进入录音，预热在后台并行完成；
              // 预热提示由 beginBatch 的 .then（麦克风已开）接管；预热完成后：
              // 清除预热提示 → 「引擎就绪」1.5s → 聆听提示 + 无语音计时。
              setIsError(false)
              warmLocal().then((r) => {
                if (sessionRef.current !== mySession) return
                stopWarmHint()
                if (warmHintActiveRef.current && r && r.ok) flashStatus(t('status.engineReady'), ENGINE_READY_FLASH_MS)
                startIdleHint(mySession)
                armNoSpeech(mySession)
              })
            }
            beginBatch()
          }, [mediaSupported, warmLocal, startIdleHint, startWarmHint, armNoSpeech, flashStatus])

          const stopBatch = React.useCallback(() => {
            stopIdleHint()
            const stopFn = batchStopRef.current
            batchStopRef.current = null
            setListening(false)
            // v57：无语音自动停止标志——本次停止是否由计时器触发
            const auto = autoStopRef.current
            autoStopRef.current = false
            if (!stopFn) {
              flashStatus(auto ? t('status.noSpeechAutoStopped') : t('status.stopped'), STATUS_FLASH_MS)
              return
            }
            let res = null
            try { res = stopFn() } catch (e) { console.error('stop batch', e) }
            const wavBase64 = res && res.wav
            const seconds = (res && res.seconds) || 0
            // 整段超过 10 分钟：base64 载荷过大（RPC/内存），拒绝并提示分段
            if (seconds > 600) {
              setWaveLevels([])
              setWaveFinal([])
              setIsError(true)
              setStatusSafe(t('status.tooLong'))
              restoreCaret(insPointRef.current)
              return
            }
            if (!wavBase64) {
              setWaveLevels([])
              setWaveFinal([])
              setIsError(false)
              flashStatus(auto ? t('status.noSpeechAutoStopped') : t('status.tooShort'), STATUS_FLASH_MS)
              restoreCaret(insPointRef.current)
              return
            }
            // 由录音期间的实时电平计算整段波形（24 段），识别过程中展示
            const lv = batchLevelsRef.current
            // v57：无语音自动停止且全程无声音 → 直接结束，不再送识别（省去静音转写等待）
            const hadSpeech = lv.some((v) => v >= BATCH_SPEECH_LEVEL)
            const N = 24
            const final = []
            for (let i = 0; i < N; i++) {
              const a = Math.floor(lv.length * i / N)
              const b = Math.max(a + 1, Math.floor(lv.length * (i + 1) / N))
              let s = 0
              for (let j = a; j < b; j++) s += lv[j]
              final.push(Math.max(0.06, Math.min(1, s / (b - a))))
            }
            if (auto && !hadSpeech) {
              setWaveLevels([])
              setWaveFinal([])
              setIsError(false)
              flashStatus(t('status.noSpeechAutoStopped'), STATUS_FLASH_MS)
              restoreCaret(insPointRef.current)
              return
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
              // v61：识别状态精简——始终「正在识别…」，仅超 5s 追加「（已用 Ns）」
              setStatusSafe(secs < 5 ? t('status.recognizing') : t('status.recognizingElapsed', { e: secs }))
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
                modelRoot: pre.modelRoot || '',
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
                  flashStatus(t('status.recognized'), STATUS_FLASH_MS)
                } else {
                  setIsError(false)
                  flashStatus(t('status.noSpeech'), STATUS_FLASH_MS)
                }
              } else {
                const em = fmtErr((r2 && r2.error) || t('err.unknown'))
                if (/no speech/i.test(em)) { setIsError(false); flashStatus(t('status.noSpeech'), STATUS_FLASH_MS) }
                else { setIsError(true); setStatusSafe(t('status.recogFail', { err: em })) }
              }
              restoreCaret(insPointRef.current)
            }).catch((err) => {
              clearInterval(timer)
              if (sessionRef.current !== mySession) return
              setRecognizing(false)
              setWaveFinal([])
              const em = fmtErr(err)
              if (/no speech/i.test(em)) { setIsError(false); flashStatus(t('status.noSpeech'), STATUS_FLASH_MS) }
              else { setIsError(true); setStatusSafe(t('status.recogFail', { err: em })) }
              restoreCaret(insPointRef.current)
            })
          }, [restoreCaret, stopIdleHint, commitChunk, flushPolish, stripPunct, flashStatus, closeStreamTail])

          // v57：无语音计时触发时按当前模式调用对应停止函数（渲染时刷新，保证定时回调拿到最新闭包）
          stopActionRef.current = p.batchMode ? stopBatch : stopDict

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
            if (statusTimerRef.current) { clearTimeout(statusTimerRef.current); statusTimerRef.current = null }
            const rec = recRef.current
            recRef.current = null
            if (rec) {
              try {
                rec.onresult = null; rec.onerror = null; rec.onend = null
                rec.stop && rec.stop()
                rec.abort && rec.abort()
              } catch (e) {}
            }
            // v63：卸载时立即抛弃收尾预留窗口（不补上屏，也不碰草稿）
            const g = graceRef.current
            graceRef.current = null
            if (g) {
              if (g.timer) clearTimeout(g.timer)
              const gr = g.rec
              if (gr) {
                try {
                  gr.onresult = null; gr.onerror = null; gr.onend = null
                  gr.stop && gr.stop()
                  gr.abort && gr.abort()
                } catch (e) {}
              }
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
          // v57：环境诊断——禁用时列出具体缺失项（豆包等浏览器排查用）
          const envDiag = React.useMemo(() => {
            const secure = typeof window !== 'undefined' && (typeof window.isSecureContext === 'boolean' ? window.isSecureContext : !!(window.location && (window.location.protocol === 'https:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname))))
            const media = typeof navigator !== 'undefined' && !!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function'
            const audio = typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext)
            return { secure, media, audio }
          }, [])
          let title
          if (!c.usable) {
            const missing = []
            if (!envDiag.secure) missing.push(t('ui.insecure'))
            if (!envDiag.media) missing.push(t('ui.noMediaApi'))
            if (!envDiag.audio) missing.push(t('ui.noAudioCtx'))
            title = t('ui.unsupported', { why: missing.length ? missing.join('、') : t('ui.unknownReason') })
          }
          else if (c.recognizing) title = t('ui.recognizingWhole')
          else if (p.batchMode) title = c.listening ? t('ui.batchStop') : t('ui.batchStart')
          else if (c.mode === 'stream') title = c.listening ? t('ui.streamStop') : t('ui.streamStart')
          else title = c.listening ? t('ui.dictStop') : t('ui.dictStart')
          return React.createElement('div', { style: { display: 'inline-flex', alignItems: 'center', gap: '6px' } },
            // v61：识别中不再渲染波形——波形仅在录音中显示（实时红色短波形），
            // 停止进入识别后输入栏保持干净（只留状态文案 + 🎤⚙）
            (c.listening && c.waveLevels.length)
              ? React.createElement(Waveform, { levels: c.waveLevels, live: true })
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
              title: p.settingsOpen ? t('ui.gearCollapse') : t('ui.gearOpen'),
              onClick: () => prefs.set({ settingsOpen: !p.settingsOpen }),
            }, GEAR_ICON)
          )
        }

        function VoiceSettingsPop(props) {
          const p = usePrefs()
          const [streamSupported] = React.useState(() => {
            // v58：扩展探测（moz/ms/o 前缀 + 大小写兜底）
            try {
              return typeof window !== 'undefined' && !!detectSpeechRecognition()
            } catch (e) { return false }
          })
          const [backends, setBackends] = React.useState(null)
          const [loadErr, setLoadErr] = React.useState('')
          const [apiOpen, setApiOpen] = React.useState(false)
          const [modelOpen, setModelOpen] = React.useState(false)
          const [localModels, setLocalModels] = React.useState(null)
          const [modelErr, setModelErr] = React.useState('')
          const [downloading, setDownloading] = React.useState('')
          const [environment, setEnvironment] = React.useState(null)
          const [installingEnvironment, setInstallingEnvironment] = React.useState(false)
          const [modelRootDraft, setModelRootDraft] = React.useState(p.modelRoot || '')
          const syncError = usePrefsSync()
          // v38：引擎说明折叠区（每条 ≤20 字）
          const [explainOpen, setExplainOpen] = React.useState(false)
          // v58：弹窗自适应最大高度——按输入栏上方实际可用空间测量，
          // 修复「弹窗顶部伸出屏幕/滚动条不出现」问题（原 calc(100vh-48px) 低估了上方空间）
          const [popMaxH, setPopMaxH] = React.useState(null)
          const cardRef = React.useRef(null)
          React.useEffect(() => {
            if (!p.settingsOpen) return
            const measure = () => {
              // 弹窗为 absolute，其 containing block（offsetParent）即锚点容器：
              // 弹窗底边在锚点顶部上方 10px，故可用高度 = 锚点顶部 - 14px
              const cb = cardRef.current ? cardRef.current.offsetParent : null
              const top = cb && typeof cb.getBoundingClientRect === 'function' ? cb.getBoundingClientRect().top : window.innerHeight
              setPopMaxH(Math.max(180, Math.round(top - 14)))
            }
            measure()
            window.addEventListener('resize', measure)
            return () => window.removeEventListener('resize', measure)
          }, [p.settingsOpen])
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
            if (!p.settingsOpen) return
            const v = voiceRemote()
            if (!v || typeof v.getEnvironment !== 'function') { setEnvironment({ ok: false, installed: false }); return }
            let alive = true
            v.getEnvironment().then((res) => { if (alive) setEnvironment(res && res.ok ? res : { ok: false, installed: false }) })
              .catch(() => { if (alive) setEnvironment({ ok: false, installed: false }) })
            return () => { alive = false }
          }, [p.settingsOpen])
          React.useEffect(() => {
            if (!p.settingsOpen || !environment || !environment.installed) return
            const v = voiceRemote()
            if (!v || typeof v.listModels !== 'function') { setModelErr(t('set.modelListFail')); return }
            let alive = true
            v.listModels({ modelRoot: p.modelRoot || '' }).then((res) => {
              if (!alive) return
              if (res && res.ok && Array.isArray(res.models)) setLocalModels(res)
              else setModelErr((res && res.error) || t('set.modelListFail'))
            }).catch((e) => { if (alive) setModelErr(t('set.modelListFail') + ': ' + fmtErr(e)) })
            return () => { alive = false }
          }, [p.settingsOpen, p.modelRoot, environment && environment.installed])
          React.useEffect(() => {
            setModelRootDraft(p.modelRoot || '')
          }, [p.modelRoot])
          const doDownload = (m) => {
            const v = voiceRemote()
            if (!v || typeof v.downloadModel !== 'function' || downloading) return
            setDownloading(m)
            setModelErr('')
            v.downloadModel({ model: m, modelRoot: p.modelRoot || '' }).then((res) => {
              setDownloading('')
              if (res && res.ok) {
                v.listModels({ modelRoot: p.modelRoot || '' }).then((r2) => { if (r2 && r2.ok && Array.isArray(r2.models)) setLocalModels(r2) })
              } else {
                setModelErr(t('set.downloadFail', { err: (res && res.error) || t('err.unknown') }))
              }
            }).catch((e) => { setDownloading(''); setModelErr(t('set.downloadFail', { err: String((e && e.message) || e) })) })
          }
          const doInstallEnvironment = () => {
            const v = voiceRemote()
            if (!v || typeof v.installEnvironment !== 'function' || installingEnvironment) return
            if (!window.confirm(t('set.localConfirm'))) return
            setInstallingEnvironment(true)
            setModelErr('')
            v.installEnvironment({ confirm: true }).then((res) => {
              setInstallingEnvironment(false)
              if (res && res.ok) {
                setEnvironment(res)
                setLocalModels(null)
              } else {
                setModelErr(t('set.localInstallFail', { err: (res && res.error) || t('err.unknown') }))
              }
            }).catch((e) => {
              setInstallingEnvironment(false)
              setModelErr(t('set.localInstallFail', { err: fmtErr(e) }))
            })
          }
          const chooseEngine = (nextEngine) => {
            prefs.set({ engine: nextEngine })
            if ((nextEngine === 'local' || nextEngine === 'funasr') && environment && !environment.installed) {
              setModelOpen(true)
              doInstallEnvironment()
            }
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
            { id: 'auto', label: t('set.engineAuto') },
            { id: 'local', label: t('set.engineLocal') },
            { id: 'funasr', label: t('set.engineFunasr') },
            { id: 'cloud', label: t(cloudReady ? 'set.engineCloudReady' : 'set.engineCloud') },
          ]
          const langOptions = [['auto', t('set.langAuto')], ['zh', t('set.langZh')], ['en', 'English'], ['ja', t('set.langJa')], ['ko', t('set.langKo')]]
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
            { id: 'custom', label: t('set.presetCustom'), provider: 'openai', baseUrl: '', model: '' },
            { id: 'openai', label: t('set.presetOpenai'), provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'whisper-1' },
            { id: 'groq', label: t('set.presetGroq'), provider: 'openai', baseUrl: 'https://api.groq.com/openai/v1', model: 'whisper-large-v3-turbo' },
            { id: 'siliconflow', label: t('set.presetSilicon'), provider: 'openai', baseUrl: 'https://api.siliconflow.cn/v1', model: '' },
            { id: 'zhipu', label: t('set.presetZhipu'), provider: 'openai', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: '' },
            { id: 'volc', label: t('set.presetVolc'), provider: 'volc', baseUrl: '', model: 'bigmodel' },
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

          return React.createElement('div', { className: 'vi-pop', ref: cardRef, role: 'dialog', style: popMaxH ? { maxHeight: popMaxH } : undefined },
            React.createElement('div', { className: 'vi-pop-title' },
              React.createElement('span', null, t('set.title')),
              React.createElement('button', { className: 'vi-pop-close', type: 'button', title: t('set.close'), onClick: () => prefs.set({ settingsOpen: false }) }, CLOSE_ICON)
            ),
            React.createElement('div', { className: 'vi-pop-grid' },
              field(t('set.engine'), mkSel(p.engine, engineOptions, chooseEngine)),
              // v42：云 ASR 模型由 API/服务商决定——仅「自定义」预设（openai + 空 BaseURL）可手填，
              // 其余预设（OpenAI 官方/Groq/硅基流动/智谱/豆包）只读展示「随服务商」
              field(t('set.model'), mkSel(
                p.engine === 'auto' ? '__auto__' : (p.engine === 'funasr' ? 'paraformer-zh' : (p.engine === 'cloud' ? (p.asrProvider === 'volc' ? 'bigmodel' : p.model) : p.model)),
                p.engine === 'auto' ? [{ id: '__auto__', label: t('set.modelAuto') }]
                  : p.engine === 'funasr' ? [{ id: 'paraformer-zh', label: t('set.modelFunasrFixed') }]
                  : (p.engine === 'cloud' && !(p.asrProvider !== 'volc' && !p.asrBaseUrl)) ? [{ id: p.model || '__na__', label: t('set.modelWithProvider', { m: p.model || '—' }) }]
                  : modelOptions,
                (v) => prefs.set({ model: v }),
                p.engine === 'auto' || p.engine === 'funasr' || (p.engine === 'cloud' && !(p.asrProvider !== 'volc' && !p.asrBaseUrl))
              )),
              field(t('set.lang'), mkSel(p.engine === 'funasr' ? 'zh' : p.lang, langOptions.map(([id, label]) => ({ id, label })), (v) => prefs.set({ lang: v }), p.engine === 'funasr')),
              // v39：质量（beam）仅在本地 whisper 生效——faster-whisper 解码束宽；
              // 浏览器内置 ASR / FunASR / 云 ASR 无此参数，禁用并显示「不适用」
              field(t('set.quality'), mkSel(p.engine === 'local' ? String(p.beam) : '__na__', p.engine === 'local' ? [{ id: '1', label: t('set.qualityFast') }, { id: '5', label: t('set.qualityHigh') }] : [{ id: '__na__', label: t('set.qualityNa') }], (v) => { if (v !== '__na__') prefs.set({ beam: Number(v) }) }, p.engine !== 'local'))
            ),
            syncError ? React.createElement('div', { className: 'vi-set-hint', 'data-error': true }, t('set.storageSyncError', { err: syncError })) : null,
            React.createElement('div', { className: 'vi-pop-toggles' },
              React.createElement('button', {
                className: 'vi-toggle', type: 'button',
                title: t('set.punctTitle'),
                'data-on': p.usePunct || undefined,
                onClick: () => prefs.set({ usePunct: !p.usePunct }),
              }, React.createElement('span', null, t('set.togglePunct'))),
              React.createElement('button', {
                className: 'vi-toggle', type: 'button',
                title: polishReady ? t('set.polishTitleOn') : t('set.polishTitleOff'),
                disabled: !polishReady ? true : undefined,
                'data-on': (p.aiPolish && polishReady) || undefined,
                onClick: () => prefs.set({ aiPolish: !p.aiPolish }),
              }, React.createElement('span', null, t('set.togglePolish'))),
              // v53：T-3——精修是否参考最近聊天记录（默认开；关闭省输入 token）
              React.createElement('button', {
                className: 'vi-toggle', type: 'button',
                title: polishReady ? t('set.contextTitleOn') : t('set.polishTitleOff'),
                disabled: !polishReady ? true : undefined,
                'data-on': (p.polishContext && polishReady) || undefined,
                onClick: () => prefs.set({ polishContext: !p.polishContext }),
              }, React.createElement('span', null, t('set.toggleContext'))),
              React.createElement('button', {
                className: 'vi-toggle', type: 'button',
                title: t('set.batchTitle'),
                'data-on': p.batchMode || undefined,
                onClick: () => prefs.set({ batchMode: !p.batchMode }),
              }, React.createElement('span', null, t('set.toggleBatch')))
            ),
            React.createElement('button', {
              className: 'vi-api-btn', type: 'button',
              onClick: () => setApiOpen(v => !v),
            },
              React.createElement('span', null, apiOpen ? t('set.apiBtnClose') : t('set.apiBtn')),
              // v49：仅保留「云ASR」「精修」文字，删除 ✓/✗ 符号（颜色状态仍区分）
              React.createElement('span', { className: 'vi-api-dot' },
                React.createElement('span', { className: cloudReady ? 'ok' : 'no' }, t('set.badgeCloud')),
                React.createElement('span', { className: polishReady ? 'ok' : 'no' }, t('set.badgePolish'))
              )
            ),
            apiOpen
              ? React.createElement('div', { className: 'vi-set-field vi-set-wide' },
                  React.createElement('span', null, t('set.apiCloudTitle')),
                  field(t('set.providerPreset'), mkSel(currentPresetId, ASR_PRESETS, applyPreset)),
                  p.asrProvider === 'volc'
                    ? React.createElement('div', { className: 'vi-set-field vi-set-wide' },
                        mkInput(p.volcAppId, (v) => prefs.set({ volcAppId: v }), t('set.volcAppId')),
                        mkInput(p.volcAccessToken, (v) => prefs.set({ volcAccessToken: v }), volcKeySet ? t('set.volcToken') : t('set.volcTokenEmpty'), 'password'),
                        mkInput(p.volcCluster, (v) => prefs.set({ volcCluster: v }), t('set.volcCluster')),
                        React.createElement('div', { className: 'vi-set-hint' }, t('set.volcHint'))
                      )
                    : React.createElement('div', { className: 'vi-set-field vi-set-wide' },
                        mkInput(p.asrBaseUrl, (v) => prefs.set({ asrBaseUrl: v }), t('set.baseUrlPh')),
                        mkInput(p.asrKey, (v) => prefs.set({ asrKey: v }), asrKeySet ? t('set.apiKeyPh') : t('set.apiKeyPhEmpty'), 'password')
                      )
                )
              : null,
            apiOpen
              ? React.createElement('div', { className: 'vi-set-field vi-set-wide' },
                  React.createElement('span', null, t('set.polishCfgTitle')),
                  // v59：设置与 Key 存 Host 侧（.voice-prefs.json），跨浏览器共享
                  React.createElement('div', { className: 'vi-set-hint' }, t('set.polishStorageHint')),
                  mkInput(p.deepseekBaseUrl, (v) => prefs.set({ deepseekBaseUrl: v }), t('set.deepseekBasePh')),
                  mkInput(p.deepseekKey, (v) => prefs.set({ deepseekKey: v }), polishReady ? t('set.deepseekKeyPh') : t('set.deepseekKeyPhEmpty'), 'password'),
                  React.createElement('span', null, t('set.polishPromptLabel')),
                  React.createElement('textarea', {
                    className: 'vi-set-field vi-set-wide',
                    style: { height: 64, resize: 'vertical', fontFamily: 'inherit' },
                    value: p.polishPrompt,
                    spellCheck: false,
                    placeholder: t('set.polishPromptPh'),
                    onChange: (e) => prefs.set({ polishPrompt: e.target.value }),
                  })
                )
              : null,
            React.createElement('button', {
              className: 'vi-api-btn', type: 'button',
              onClick: () => setModelOpen(v => !v),
            },
              React.createElement('span', null, modelOpen ? t('set.modelsBtnClose') : t('set.modelsBtn')),
              React.createElement('span', { className: 'vi-api-dot' },
                React.createElement('span', { className: 'no' }, localModels ? t('set.modelsCount', { a: localModels.models.filter((m) => m.downloaded).length, b: localModels.models.length }) : '…')
              )
            ),
            modelOpen
              ? React.createElement('div', { className: 'vi-set-field vi-set-wide' },
                  React.createElement('span', null, t('set.localComponent')),
                  environment && environment.installed
                    ? React.createElement('div', { className: 'vi-set-hint' }, t(environment.reusedLegacy ? 'set.localLegacy' : 'set.localReady'))
                    : React.createElement('div', { className: 'vi-set-field vi-set-wide' },
                        React.createElement('div', { className: 'vi-set-hint' }, installingEnvironment ? t('set.localInstalling') : t('set.localMissing')),
                        React.createElement('button', {
                          className: 'vi-clear-btn', type: 'button',
                          disabled: installingEnvironment || undefined,
                          onClick: doInstallEnvironment,
                        }, installingEnvironment ? t('set.localInstalling') : t('set.localInstall'))
                      ),
                  // v62：模型缓存目录可由用户指定；空值保留旧版工作区默认目录。
                  field(t('set.modelPath'), React.createElement('div', { style: { display: 'flex', gap: 6, alignItems: 'center' } },
                    mkInput(modelRootDraft, (v) => setModelRootDraft(v), t('set.modelPathPh')),
                    React.createElement('button', {
                      className: 'vi-clear-btn', type: 'button',
                      disabled: modelRootDraft === (p.modelRoot || '') ? true : undefined,
                      onClick: () => prefs.set({ modelRoot: (modelRootDraft || '').trim() }),
                    }, t('set.modelPathApply')),
                    React.createElement('button', {
                      className: 'vi-clear-btn', type: 'button',
                      disabled: !modelRootDraft ? true : undefined,
                      onClick: () => { setModelRootDraft(''); prefs.set({ modelRoot: '' }) },
                    }, t('set.modelPathReset'))
                  )),
                  React.createElement('div', { className: 'vi-set-hint' }, t('set.modelPathHint')),
                  localModels && localModels.modelRoot
                    ? React.createElement('div', { className: 'vi-set-hint' }, t('set.modelPathDefault', { path: localModels.modelRoot }))
                    : null,
                  environment && environment.installed && localModels
                    ? localModels.models
                        .filter((m) => p.engine === 'funasr' ? m.backend === 'funasr' : (p.engine === 'local' ? m.backend === 'local' : true))
                        .map((m) => React.createElement('div', { key: m.id, style: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: 12 } },
                        React.createElement('span', {
                          title: m.downloaded ? t('set.downloaded') : t('set.notDownloaded'),
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
                            }, downloading === m.id ? t('set.downloading') : t('set.download'))
                      ))
                    : (environment && environment.installed ? React.createElement('div', { className: 'vi-set-hint' }, modelErr || t('set.loading')) : null),
                  modelErr ? React.createElement('div', { className: 'vi-set-hint', 'data-error': true }, modelErr) : null
                )
              : null,
            // v38：可折叠引擎说明——简要对比特点与来源（每条 ≤20 字）
            React.createElement('button', {
              className: 'vi-api-btn', type: 'button',
              onClick: () => setExplainOpen((v) => !v),
            },
              React.createElement('span', null, explainOpen ? t('set.explainBtnClose') : t('set.explainBtn')),
              React.createElement('span', { className: 'vi-api-dot' },
                React.createElement('span', { className: 'no' }, explainOpen ? '▲' : '▼'))
            ),
            explainOpen
              ? React.createElement('div', { className: 'vi-set-field vi-set-wide' },
                  // v41：延迟并入引擎同一行；崩溃自动恢复合并为一行；本地whisper无空格
                  React.createElement('div', { className: 'vi-set-hint', title: t('set.explainBrowserTitle') }, t('set.explainBrowser')),
                  React.createElement('div', { className: 'vi-set-hint', title: t('set.explainWhisperTitle') }, t('set.explainWhisper')),
                  React.createElement('div', { className: 'vi-set-hint', title: t('set.explainFunasrTitle') }, t('set.explainFunasr')),
                  React.createElement('div', { className: 'vi-set-hint', title: t('set.explainRecoverTitle') }, t('set.explainRecover')),
                  // v62：模型目录已放回模型管理面板，便于按需下载时确认落盘位置
                  React.createElement('div', { className: 'vi-set-hint', title: t('set.explainCloudTitle') }, t('set.explainCloud')),
                  React.createElement('div', { className: 'vi-set-hint' }, t('set.explainPunct')),
                  React.createElement('div', { className: 'vi-set-hint' }, t('set.explainPolish')),
                  // v54：语境说明（开启后精修会输入聊天上下文）
                  React.createElement('div', { className: 'vi-set-hint', title: t('set.contextTitleOn') }, t('set.explainContext')),
                  React.createElement('div', { className: 'vi-set-hint' }, t('set.explainBatch')),
                  loadErr ? React.createElement('div', { className: 'vi-set-hint', 'data-error': true }, t('set.backendFail', { err: loadErr })) : null
                )
              : null,
            // v60：底部一行——左侧清除 Key，右侧「中 | EN」界面语言分段开关（选中侧绿色）
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 } },
              React.createElement('button', { className: 'vi-clear-btn', type: 'button', title: t('set.clearKeysTitle'), onClick: () => prefs.clearSecrets() }, t('set.clearKeys')),
              React.createElement('div', { style: { display: 'inline-flex', alignItems: 'center', border: '1px solid var(--dsw-alias-border-l2, #e5e7eb)', borderRadius: 9, overflow: 'hidden', flexShrink: 0 } },
                ['zh', 'en'].map((lang) => React.createElement('button', {
                  key: lang, type: 'button',
                  style: {
                    // v60：再缩小一档「中 | EN」开关——高 18、内边距 0 6px、字号 10
                    height: 18, padding: '0 6px', border: 'none', cursor: 'pointer',
                    fontSize: 10, fontWeight: 600, lineHeight: '18px',
                    background: p.uiLang === lang ? 'var(--dsw-alias-state-success-primary, #16a34a)' : 'transparent',
                    color: p.uiLang === lang ? '#fff' : 'var(--dsw-alias-label-tertiary, #9ca3af)',
                  },
                  title: t('ui.langTitle'),
                  onClick: () => prefs.set({ uiLang: lang }),
                }, lang === 'zh' ? t('ui.langZh') : t('ui.langEn'))))
            )
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
