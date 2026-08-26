# 语音输入插件 · 说明与版本记录

> 当前版本：**1.0.0**（对应 GitHub Release v1.0.0；下文"vNN"为开发期内部迭代号，仅作变更记录）
> 详细说明见仓库根 `README.md`，分发/合规见 `DISTRIBUTION.md`。

## 一、现状（1.0.0：跨平台安装脚本 setup.sh + Linux/macOS 部署文档）

- 插件 ID：`vmic-1`（已部署静态版，重启自动加载；本目录 `client.js`/`host.js` 快照 = 部署版 `lib/` 副本）
- 界面：输入栏右侧（模型选择旁）两个小按钮——🎤 麦克风、⚙ 设置
- ⚙ 浮层设置：引擎（**浏览器内置 ASR 识别 / 本地 base whisper / 本地FunASR / 云 ASR**）→ 模型 → 语言 → 质量 + 标点/AI精修/**语境**/**整段**；API 配置折叠式；「本地模型管理」与「引擎说明」可折叠
- **v56（跨平台安装）**：新增 `setup.sh`（Linux/macOS 版安装脚本：建 venv + 装依赖 + 预下载 FunASR 模型 + DSH_VOICE_ROOT/海外镜像提示，参数 `-m/--mirror`、`--skip-models`）；`DISTRIBUTION.md` 新增「三-b、Linux/macOS 安装步骤」（setup.sh + 手动复制插件到 `~/.dsh/profiles/node_modules` + cordis.patch.yml 注册 + 重启）；功能全平台兼容（录音/whisper/FunASR/云后端无平台限制，Host 已按 POSIX 路径自适应），macOS 麦克风授权与 Linux 音频服务注意事项已写入文档
- ⚙ 浮层设置：引擎（**浏览器内置 ASR 识别 / 本地 base whisper / 本地FunASR / 云 ASR**）→ 模型 → 语言 → 质量 + 标点/AI精修/**语境**/**整段**；API 配置折叠式；「本地模型管理」与「引擎说明」可折叠
- **v55（删除模型存储位置行）**：引擎说明折叠区删除「本地模型（存储于 …）」行（v47 移入，用户认为无用）；当前引擎说明共 9 行：浏览器内置 / 本地whisper / 本地FunASR / 崩溃自动恢复 / 云 ASR / 标点 / AI精修 / 语境 / 整段
- **v54（引擎说明补语境描述）**：折叠「引擎说明」在 AI精修 与 整段 之间新增一行「语境：精修时输入聊天上下文」（hover 说明：开启后 AI 精修会把最近聊天记录作为语境一并输入，帮助纠同音字/术语/人名；关闭可减少 token 用量）
- **v53（精修成本优化 T1-T3）**：① **T-1**（部署+重启即生效，v51/v52 已含）：聊天语境作为历史消息注入 → DeepSeek 磁盘缓存命中，输入成本降 ~90%；② **T-2**：精修合并窗口 **240→400 字**——更多识别块并入一次精修，请求次数减少（每次省固定 system+历史 ~850 token 输入）；③ **T-3**：设置新增「**语境**」开关（默认开，持久化 `polishContext`）——关闭后精修不再携带聊天记录（每次省 ~700 token 输入，缓存更易命中），未配置 DeepSeek Key 时置灰
- **v52（内存清理 + 波形残留 + 尾部静音裁剪）**：① **M-1 引擎切换销毁 worker**——Host 新增 `resetWorker` Remote（terminate+kill 强化销毁，防孤儿进程）；Client 在引擎/模型切换时自动调用，**whisper 与 FunASR 不再同时驻留**（各 ~1-1.6GB），切到浏览器内置 ASR / 云 ASR 时同样销毁释放；成功后清空预热状态（下次使用重新加载）。② **Bug2 波形残留**——实时模式（stream/dict）入口先 `clearBatchResidual()`：终止未正常停止的整段采集、释放麦克风、清空波形/识别中状态（修复"关掉整段后实时模式仍显示音波图"）。③ **Bug3 末尾重复**——`startDictation` 并行记录每块 rms，flush 时**裁剪尾部连续静音块**（保留 ≥2 块，阈值与 VAD 一致），whisper 不再对长静音尾部幻觉重复字词/标点；默认精修 prompt 追加「合并重复的字词与标点（如"。。""的的"）」。已部署 ✅
- **v51（聊天语境结构化 + 成本优化）**：① 聊天记录改为**结构化消息数组** `[{role, content}]` 作为**多轮历史消息**注入 `messages`（system → 历史 → 当前请求），前缀稳定 → DeepSeek 磁盘缓存命中最大化（聊天记录不变时每次精修仅最后一条按未命中计费）；② **上限 1500→1200 字、前后 8→6 条**；③ **完整消息优先截断**——从最新逐条累加，超 1200 字整条丢弃较旧消息，仅当第一条超长时截尾部；④ 相邻同角色消息合并、历史以 user 结尾时并入当前请求（保证 messages 严格交替，兼容严格网关）；⑤ 兼容旧版字符串格式（"用户：/助手："逐行解析）
- **v50（AI 精修附带聊天记录语境）**：精修请求新增 `context` 参数——客户端从会话快照（`props.session.nodes`）提取最近消息随精修请求发送；Host `polish` 透传；`transcribe.py --chat` 注入对话历史参考。**隐私提示**：聊天记录随精修文本一起发送给 DeepSeek
- **v49（API 徽标修正）**：API 配置按钮后的徽标**保留「云ASR」「精修」文字、仅删除 ✓/✗ 符号**（颜色状态区分保留：绿=已配置/灰=未配置）；修正 v48 的过度删除
- **v48（移除 AUTO 与徽标）**：① **AUTO（自动发送）功能移除**——设置面板删除「AUTO」开关，prefs 移除 `autoSend` 键（旧 localStorage 值被白名单忽略，行为不再自动发送），startStream/stopDict/stopBatch 中的自动发送分支与 `autoSendRef`/`finalText` 一并删除，🎤 gear 悬停提示同步去掉「自动发送」；② API 配置按钮后的 ✓/✗ 符号删除（v49 恢复文字）
- **v47（存储位置移入引擎说明）**：「本地模型（存储于 whisper: …/hub；FunASR: …/models）」一行从「本地模型管理」面板顶部**移入「引擎说明」折叠区**（位于「本地引擎偶发崩溃自动恢复」之后）；模型管理面板只剩模型列表（随引擎联动）
- **v46（模型列表联动 + 大小精简）**：① **本地模型管理随引擎联动**——选「本地FunASR」只显示 paraformer-zh；选「本地 base whisper」只显示 tiny/base/small/medium/large-v3 五个；浏览器内置 ASR / 云 ASR 显示全部（现状）；② 模型行**只显示文件大小**（去掉参数量与备注，如 `tiny 约75MB`），FunASR size 同步精简为「约450MB」；③ 引擎介绍与云 ASR 设置保持不动
- **v45（模型介绍回退 v42）**：v43 在用户未要求下给模型行添加的「（FunASR）」后缀与参数/大小/note 介绍文字**移除**——FunASR 行仅显示「模型名 + 状态圆点（+ 未下载时的下载按钮）」；whisper 行保持 v42 原样（id + params·size·note + 状态）；引擎说明文案不变
- **v44（模型状态圆点化）**：本地模型管理每项前的状态改为**圆点**——**绿色 = 已下载**、**灰色 = 未下载**（hover 有文字提示），删除「可用 ✓ / 未下载·下载」文字；未下载项保留「下载」小按钮（下载中显示「下载中…」）；引擎说明文案不动
- **v43（本地模型统一管理）**：① 引擎选项「FunASR 中文本地」→「**本地FunASR**」；② 「本地模型管理」列表纳入 FunASR——**paraformer-zh（FunASR）排第一位**，其下依次 tiny/base/small/medium/large-v3（whisper）；③ 已下载模型显示「**可用 ✓**」，未下载显示「未下载·下载」可点按下载（FunASR 一次性拉取 asr+vad+punc 约 0.9GB）；④ `transcribe.py --list-models` 返回合并列表（funasr 在前），下载状态检测：FunASR 查 ModelScope 缓存 `models/<org>--<repo>/snapshots`，whisper 查 HF 缓存
- **v42（云 ASR 模型只读化，已部署）**：云 ASR 的模型由 API/服务商决定——「识别模型」在云 ASR 下仅**自定义预设**（OpenAI 兼容 + 空 BaseURL）可手填；其余预设（OpenAI 官方/Groq/硅基流动/智谱/豆包）只读展示「模型名（随服务商）」，防止误以为可任意选模型。v41 文案（延迟并入行内、崩溃合并、whisper 无空格）随本版一并部署
- **v41（引擎说明最终文案）**：延迟并入引擎**同一行**（本地whisper：语言最多，首启较慢 / 本地FunASR：中文最好，首启较慢 / 云 ASR：外部大模型，延迟看网络）；「本地引擎偶发崩溃自动恢复」合并为一行置于两个本地引擎之下；**「本地 whisper」去掉空格为「本地whisper」**；来源信息（openai/阿里/API）移至 hover 悬停提示，行内全部 ≤20 字
- **v39（说明文案 + 质量生效范围）**：折叠说明文案更新——「本地 whisper：语言最多（openai）」「本地FunASR：中文最好（阿里）」「AI精修：语音输出后两秒AI纠错」「整段：输入完毕后整体识别，关闭后实时识别（误差更大）」。**质量（beam）仅在「本地 base whisper」生效**（faster-whisper 解码束宽 1=快速/5=高质量）；浏览器内置 ASR / FunASR / 云 ASR 无此参数——**禁用并显示「不适用」**（此前 auto/funasr/cloud 虽已禁用但显示的是束宽数字，易误导）
- **v38（引擎改名 + 可折叠说明）**：引擎选项更名——「自动」→「浏览器内置 ASR 识别」；「本地引擎（免费·离线）」→「本地 base whisper」；「FunASR 中文（本地·ONNX）」→「FunASR 中文本地」。底部原长段说明改为**可折叠「引擎说明」**（默认收起）：四行引擎对比 + 三行功能说明（浏览器内置：最轻最快（自带）/ 本地 whisper：语言最多 / FunASR：中文最好 / 云 ASR：外部大模型，需 API / 标点 / AI精修 / 整段），hover 有补充来源；「清除保存的 Key」按钮常驻折叠区外
- **v37（FunASR 中文引擎 + 可移植化）**：
  1. **新增 FunASR 引擎**（阿里达摩院开源 paraformer-zh，ONNX 本地推理、**无 torch**）：设置浮层「识别引擎」新增「FunASR 中文（本地·ONNX）」。中文识别明显优于 faster-whisper base/small，自带 VAD 切句与标点（ct-punc），实测 6.5s 音频预热后单块识别 **~270ms**（whisper base 同段音频返回空结果）。模型（paraformer ~450MB + vad ~30MB + punc ~450MB）首次使用自动下载（ModelScope → `<root>\.modelscope`），选引擎即后台预热（对齐 v29 预热机制，`warm` 按 backend=funasr 路由）；实时听写与整段模式均可用；UI 联动：模型固定 paraformer-zh、语言固定中文、质量项禁用
  2. **可移植化重构（为打包分发）**：Host 不再依赖硬编码路径——`DSH_VOICE_ROOT`（根目录）/ `DSH_VOICE_PYTHON`（解释器）环境变量优先，旧路径仅兜底；Windows/POSIX 路径自适应（`.venv\Scripts` vs `bin`）；`DSH_HF_ENDPOINT` 可换 HF 镜像（默认仍 hf-mirror）；ModelScope 缓存默认入工作区（`MODELSCOPE_CACHE` + `MODELSCOPE_HOME`，后者必须可写否则 SDK 报 WinError 5）；新增 `setup.ps1`（建 venv + 装依赖 + 可选预下载模型，pip 缓存固定 `.pip-cache`）与 `requirements.txt`（faster-whisper/httpx/funasr-onnx/funasr-onnx-automodel/onnxruntime）；分发说明见 `DISTRIBUTION.md`
  3. 依赖注意：funasr-onnx 强制 `numpy<=1.26.4`（faster-whisper 兼容）；jieba 仅 sdist（19MB 字典），构建需 setuptools（`--no-build-isolation` 或等其自动装）；pip 缓存目录必须可写（沙箱/受限环境请用 `--cache-dir` 指向工作区）
- **v36（整段模式文案精简）**：移除整段模式录音期间的「整段录音中…（再次点击停止）」状态文案（占位且多余——🎤 红点脉冲 + 实时红色短波形已足够反馈）；本地引擎预热提示仍按原逻辑短暂显示后自动清除；停止后「正在识别…」、错误/结果提示均不变
- **v35（整段识别模式，可选）**：设置浮层新增「整段」开关（持久化 `batchMode`）。开启后 🎤 行为改变：① 点击开始——**持续监听、不切块、不上屏**（实时红色短波形，v36 起无状态文案）；② 再次点击停止——把整段音频一次送识别（状态「正在识别…」+ 已录音频的 24 段短波形跳动动画，每 5s 刷新已耗时）；③ 识别完成插入光标处，**立即** AI 精修（语流已结束，不走 2s 合并窗口；因 `commitChunk` 后 draftRef 未及重渲染，先同步 `lastCommittedRef.draft` 再 `flushPolish`，区间校验仍保护用户编辑）；④ AUTO 开启时识别完成后自动发送。实现：新增 `startBatchCapture`（ScriptProcessor 全量录音 + ~80ms 间隔实时电平上报）与 `startBatch`/`stopBatch`（**停止时不自增会话代际**，保证识别结果落定；识别期间重新开始录音则旧结果作废）；>10 分钟录音拒绝（RPC 载荷过大）。配套 Host：worker 请求超时 90s→300s、一次性兜底 graceMs 180s→300s（长音频识别耗时线性增长）。**注意**：整段模式无论引擎选择均走媒体采集；「自动」引擎在整段模式下改用本地识别后端（浏览器实时 API 无整体识别能力）
- **v34（删除超时硬切）**：移除 v31 引入的 `MAX_SPEECH_MS=2500` 连续说话超时强制切块——VAD 恢复为**纯静音切块**（700ms 静音或停止录音才切），一句话不再因 2.5s 计时被拦腰截断（此前长句会被切碎成半句、产生漏字/错识，需 AI 精修兜底）。行为变更：① 无停顿连续语流不再"边说边出"，而是整句说完（停顿 700ms）后一次上屏——单块识别耗时随句长线性增加，长句感知延迟可能上升；② 消除连续说话时每 2.5s 硬切造成的识别队列堆积（原"说几句后越来越慢"的直接来源）；③ 长时间不停顿说话时 speechBuf 持续累积直至停顿，内存/单块长度上限由 worker 90s 超时兜底
- **v33（停止落定精修）**：修复 dict 路径（本地/云引擎）「说完即停」导致最后一块文字永不精修的问题——`stopDict`/`teardownStream` 停止时不再清空丢弃挂起的精修窗口，而是立即 flush 落定（识别仍保持 v27 静默；精修仅改写已有文字、不新增内容；flushPolish 区间校验保护用户编辑）。此前精修只在录音持续 ≥2s 且未停止时触发，停止即丢弃——用户感知"本地引擎精修不生效"；stream 路径（自动引擎）因持续聆听不受影响
- **v32（聆听中过程提示）**：本地/云端/实时任一模式，录音开始后 **≥3s 仍无文字上屏** → 状态区显示灰色 info「聆听中…未识别到语音」，每 5s 刷新已听秒数（如「聆听中…12s 未识别到语音」）；有任何内容上屏即消失，停止/会话换代即清除。解决"红圈亮着、说了话却长时间没识别、既无报错也无反馈"的静默问题（原 4 条静默路径：VAD 未触发 / 短语音丢弃 / whisper no-speech / 空结果）。实现要点：`statusRef` 镜像守卫——提示**不覆盖**预热/重连/错误等已有状态；计时器挂在会话代际（sessionRef）内，旧会话迟到回调一律作废
- **v31（连续说话不憋字）**：VAD 静音门控维持 700ms 不变（有停顿即提前切块），新增**超时强制切块**——连续说话 ≥2.5s 即使无静音也强制 flush 识别上屏（`MAX_SPEECH_MS = 2500`），保证"边说边出、文字持续涌现"；切碎的半句由 AI 精修合并窗口（v24）兜底修正；flush 后 speechActive 保持，不丢声
- **v30（预热不阻塞开麦 + 识别可靠性）**：① **预热并行化**——本地引擎首次录音不再等预热完成，立即进入听写，预热在后台并行（预热本应在「选本地引擎」那一刻已完成，这里只是兜底）；预热期间仅短暂显示「本地引擎预热中…（首句可能较慢）」轻提示，不打扰输入；② **prompt 回声过滤**——whisper 在短块/含混音频上会原样吐出 initial_prompt（如「使用正确的标点符号」上屏），`transcribe.py` 新增 `_strip_prompt_echo` 剥离已知 prompt 文本，且 <1.2s 短块不再注入 initial_prompt；③ **no-speech 静默**——短块/静音块返回 no speech recognized 时客户端不再红字报「无法识别」；④ **host 自动重建**——worker 崩溃走一次性回退后，后台立即重建 worker 并预载模型，下一块即恢复 ~1s（此前每块都走 3-10s 回退）
- **v29（本地引擎预热）**：把冷启动挪到说话之前——① Host 新增 Remote `warm()` + worker 协议 `op:"load"`（只加载模型不转写，缓存命中 0ms）；② 客户端「选择本地引擎 / 切换本地模型」的瞬间即自动预热；③ 首次按下录音时若尚未预热，先显示「正在启动本地识别引擎（首次约 5-10 秒）…」提示并等待预热完成再开麦（预热失败则降级照常开始，首句由 worker 自行加载）；④ 状态提示改为非错误时也可见（灰色 info 样式）。实测：预热 6.5s（一次性）→ 预热后每块转写 ~0.9s
- **v27（本地识别三大问题修复）**：
  1. **识别速度**：新增常驻 worker（Host 侧 `LocalWorker` + `transcribe.py --serve`，JSON 行协议）——faster-whisper 模型**只加载一次**，此后每块识别 ~0.3-2s；此前每块都重新 spawn Python 并加载模型（3-10s/句）。worker 崩溃/超时自动回退一次性调用，不会完全不可用
  2. **频繁 `no speech recognized`**：本地识别 `vad_filter=False`（浏览器端 VAD 已切块，faster-whisper 内部 Silero VAD 会丢弃短块）+ `condition_on_previous_text=False`（短块独立解码）；浏览器端 VAD 校准防污染（开麦瞬间有声音则重置校准，基线只取纯静音）+ 触发时并入 ~200ms pre-roll 缓冲（防切掉字头）
  3. **关闭后再打开跳出旧话 / 删除后重复上屏**：引入会话代际（sessionRef）——`startDict`/`startStream` 递增代际，停止时再递增，**所有在途/排队识别回调与挂起的 AI 精修窗口一律作废**；`stopDict` 不再等待识别链、`teardownStream`/`stopDict` 清空 polish timer 与 pending 窗口
  - 行为变更：**停止录音即静默**——不再回补停止瞬间的最后半句（v24 的"停止立即落定"取消）；自动发送改为停止时立即提交当前草稿
  - 注：AI 精修（DeepSeek）仍按 v24 延迟+合并窗口工作，仅受会话代际保护
- **v28（设置弹窗说明精简）**：设置弹窗底部提示区删除三条长说明（云 ASR 分类、AI精修原理、配置/Key 保存位置），仅保留「自动 = …随引擎自动」一句（句末 `；` 改 `。`）与「清除保存的 Key」按钮
- **v26（滚动条可见性修复）**：v25 的滚动条为 `overflow-y: auto` + 淡色滑块（6px、18% 透明度），在系统开启「自动隐藏滚动条」或浅色背景下几乎不可见，用户感知为"没有滑块"。改为：`overflow-y: scroll`（**常驻显示滚动条槽**，不依赖内容溢出判断）+ 8px 宽、32% 透明度滑块 + 浅灰轨道 + hover 加深，并加 Firefox 的 `scrollbar-width/scrollbar-color` 兼容
- **v25（界面修复 + 产品文档）**：
  1. 设置弹窗可滚动：`max-height: calc(100vh - 48px)` + `overflow-y: auto` + 细滚动条样式 + 滚动穿透防护（此前内容超高时顶部选项被视口裁掉且无法滑动）
  2. 新增《语音输入-设置界面产品说明.md》（工作区根目录）：识别引擎选择、服务商预设、API 配置的完整设计规格 + 可复用文案/占位符/错误态速查表，供集成到其他产品
- **v24（伪句号掩码修复）**：VAD 按静音切块、whisper 在块尾倾向补句号，产生"停顿=句号"的伪句号；若逐块立即精修，触发时后续句子尚未说出（after 为空），LLM 无从判断语流是否继续，只能确认句号——即"掩码"效应。修复：
  1. **延迟精修**：chunk 上屏后延迟 2000ms 才调 DeepSeek，等后续语流到达
  2. **合并窗口**：期间相邻块（间隔 ≤2 个分隔符，窗口 ≤240 字）自动合并，flush 时从最新草稿重建合并文本一次精修，LLM 能看到完整语流，自然把"…。但是…"改回"…，但是…"
  3. **停止录音立即落定**：teardown/stop 时 flush 挂起窗口；卸载时清 timer
  4. **默认精修 prompt 强化**：明确"句号不一定是真实句子边界；结尾接连接词时允许句号改逗号"
  - 注：合并窗口/延迟仅作用于 AI 精修环节，识别与上屏仍实时
- **v23（核心修复）**：Typert 网关 SRC 回退按 Host 方法**源码参数名**做 wire 字段；客户端带参调用统一包 `{ args: {...} }` 对齐。此前 `transcribe/polish/downloadModel` 全部被网关拒绝（`args fields do not match the descriptor`），本地识别红字失败、AI 精修从未真正执行（错误被 `.catch` 静默吞掉）。修复后精修失败也会红字显示原因
- v22：引擎三项化（自动/本地/云 ASR）、豆包并入「预设服务商」、旧配置自动迁移
- v21 已含：错误格式化修复、auto 语义占位；v20：去括号标注；v19：豆包后端；v18：云 ASR 预设；v17：网络重试/失败可视化/模型管理/精修 Prompt
- 版本历史：… → v22 豆包并入预设 → v23 Typert 参数描述符修复（识别/精修打通） → v24 延迟合并精修（伪句号掩码修复） → v25 设置弹窗滚动修复 + 产品说明文档 → v26 常驻可见滚动条 → **v27 本地识别常驻 worker + VAD 修正 + 会话代际** → **v28 设置弹窗说明精简** → **v29 本地引擎预热（选引擎即冷启动 + 启动提示）** → **v30 预热不阻塞开麦（后台并行 + 轻提示）** → **v31 连续说话超时强制切块（文字持续涌现）** → **v32 聆听中过程提示（≥3s 无上屏显示"聆听中…未识别到语音"，含秒数刷新）** → **v33 停止落定精修（本地/云引擎说完即停，最后一句也被 AI 精修）** → **v34 删除 2.5s 超时硬切（恢复纯静音切块，句子不再被切碎）** → **v35 新增「整段识别」可选模式（持续录音→停止后整体识别→正在识别提示+短波形→立即 AI 精修）** → **v36 整段模式录音中移除状态文案（仅保留红点+实时波形）** → **v37 FunASR 中文引擎（paraformer-zh ONNX，无 torch，中文大幅提升）+ 可移植化重构（DSH_VOICE_ROOT/PYTHON/HF_ENDPOINT + setup.ps1 + requirements.txt + DISTRIBUTION.md）** → **v38 引擎更名（浏览器内置 ASR/本地 base whisper/FunASR 中文本地）+ 可折叠引擎说明** → **v39 引擎说明文案更新（AI精修两秒纠错/整段对比）+ 质量选项仅本地 whisper 生效，其余引擎禁用显示「不适用」**

## 二、重启后恢复（轻量过渡，1 分钟）

动态插件随 DSH 进程消失，重启后让 AI 助手执行以下三步即可恢复：

1. `cordis_define`（kind: new）——把本目录 `client.js` 与 `host.js` 的内容分别作为
   `code.client` / `code.host` 提交（代码在会话历史中亦有完整备份，可让助手从
   `cordis_inspect_self` 或对话记录还原）
2. `cordis_run`（mode: run）——在 UI 中批准
3. 检查输入栏右侧出现 🎤 ⚙ 按钮

## 三、依赖（由 setup.ps1 安装）

| 组件 | 路径（相对仓库根） | 说明 |
|---|---|---|
| ASR 脚本 | `.voice-asr\transcribe.py` | 多后端调度器（probe/local/funasr/openai/volc） |
| Python 环境 | `.venv\`（setup.ps1 创建） | faster-whisper + FunASR-ONNX + httpx |
| 模型缓存 | `.hf\`（whisper）/ `.modelscope\`（FunASR） | 首次使用自动下载 |
| 云端 Key（可选） | 环境变量 `DSH_ASR_API_KEY` / `DSH_ASR_BASE_URL` | OpenAI 兼容端点 |

## 四、部署（分发版）

部署方式见根 README「快速开始」与 `DISTRIBUTION.md`（dsh 组合注册、环境变量 `DSH_VOICE_ROOT`/`DSH_VOICE_PYTHON`）。

**架构（静态部署版与动态版差异）**：
- Host 半区：`host.js` = Typert Remote 服务 `voice`（`listBackends` / `transcribe` / `polish` / `warm`），
  经 `dsh-typert-protocol` 的 `@Remote` 机制暴露给浏览器
- Client 半区：`client.js` = `window.__ModuleLoader__.load` 模块格式，
  经 `ctx.remote.voice.*` 调用 Host（替代动态版的 `host.call`），样式经 document 注入
- 配置/Key 仍存 localStorage（`dsh.voice.prefs.v1`），重启不丢

**重启后**：插件随 DSH 自动加载（无需批准），与动态版功能一致。
**注意**：动态会话版（vmic-1）与静态部署版不能同时挂载（重复注册同一槽位），
重启后仅静态版生效；如需回退，删除 patch 中的 `voice-input` 行并重启。

## 五、根目录变更排障记录（历次错误与结论）

| 场景 | 错误现象 | 根因 | 结论 |
|---|---|---|---|
| 部署① | 依赖解析失败 | junction 被 Node 解析为真实路径，`dsh-typert-protocol` 沿真实路径查找不到 | 用真实拷贝部署（deploy.ps1） |
| 部署② | 入口不在启动图、client.js 404 | `package.json` 缺 `exports["./client"]`，client-modules 无法定位客户端包 | 补 `exports` 字段 |
| 部署③ | 重启后入口消失、patch 被抹回 `[]` | patch 追加格式非法（`[]`+块序列），启动时被规范化回写 | 以规范 insert 列表整体替换（当时文件仅 `[]`） |
| v23 前 | 本地识别报 `typert gateway: voice/transcribe: args fields do not match the descriptor: unexpected "wavBase64", …` | 网关 SRC 回退按 Host 方法**源码参数名**做 wire 字段；`transcribe(args)` 只有 `args` 一个字段，客户端却展开传业务对象 | 客户端带参调用统一包 `{ args: {...} }`（v23 修复）；AI 精修同因此前从未生效 |
| 重启后 | "DSH 无法正常启动" | **3080 端口被现有实例占用**（EADDRINUSE），非根目录修改导致；已实测 rc.7（全局版）与部署完全兼容（启动成功、入口在、client.js 200） | 先停旧实例再启动；端口占用 ≠ 配置错误 |
| 潜在 | deploy.ps1 旧版整体替换 patch | patch 是共享文件（dsh-skin 等也写入） | 已改为增量维护（AGENTS.md 规则七） |
