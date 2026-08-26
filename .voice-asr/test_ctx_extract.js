// 验证 chatContextFromSession 的提取范围：是否只含 user/assistant 文本、是否严格 ≤6 条 ≤1200 字
// 用法：node test_ctx_extract.js（从 client.js 复制函数体，保持逻辑一致）

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

// 模拟真实会话快照：混合各类节点
const fakeNodes = [
  { kind: 'user', seq: 1, time: 1, content: [{ type: 'text', text: '第一条用户消息（旧，应被丢弃）' }] },
  { kind: 'assistant', seq: 2, time: 2, turn: 1, step: 1, blocks: [{ kind: 'text', text: '助手回复一（旧，应被丢弃）' }] },
  { kind: 'tool-call', seq: 3, time: 3, turn: 1, step: 2, callId: 'c1', name: 'bash', argsRaw: '{}' },
  { kind: 'tool-result', seq: 4, time: 4, turn: 1, step: 3, callId: 'c1' },
  { kind: 'user', seq: 5, time: 5, content: [
      { type: 'text', text: '用户消息2（应保留）' },
      { type: 'image', attachment: {} } ] },
  { kind: 'assistant', seq: 6, time: 6, turn: 2, step: 1, blocks: [
      { kind: 'reasoning', text: '思考过程（不应进入）' },
      { kind: 'tool-call', text: '', callId: 'c2', name: 'read', argsRaw: '{}' },
      { kind: 'text', text: '助手回复2（应保留，首段文本）' } ] },
  { kind: 'steering', seq: 7, time: 7, content: [{ type: 'text', text: 'steering 消息（不应进入）' }] },
  { kind: 'context', seq: 8, time: 8, content: [{ type: 'text', text: '系统注入（不应进入）' }] },
  { kind: 'command', seq: 9, time: 9, content: [{ type: 'text', text: '命令节点（不应进入）' }] },
  { kind: 'compaction', seq: 10, time: 10, content: [{ type: 'text', text: '总结节点（不应进入）' }] },
  { kind: 'user', seq: 11, time: 11, content: [{ type: 'text', text: '用户消息3（应保留）' }] },
  { kind: 'assistant', seq: 12, time: 12, turn: 3, step: 1, blocks: [{ kind: 'text', text: '助手回复3（应保留）' }] },
  { kind: 'user', seq: 13, time: 13, content: [{ type: 'text', text: '用户消息4（应保留）' }] },
  { kind: 'assistant', seq: 14, time: 14, turn: 4, step: 1, blocks: [{ kind: 'text', text: '助手回复4（应保留）' }] },
  { kind: 'user', seq: 15, time: 15, content: [{ type: 'text', text: '用户消息5（应保留）' }] },
  { kind: 'assistant', seq: 16, time: 16, turn: 5, step: 1, blocks: [{ kind: 'text', text: '助手回复5（应保留）' }] },
]

const out = chatContextFromSession({ nodes: fakeNodes })
console.log('提取条数:', out.length, '(上限 6)')
console.log('总字数:', out.reduce((s, m) => s + m.content.length, 0), '(上限 1200)')
console.log('内容:')
for (const m of out) console.log(' ', m.role, '->', m.content)

// 断言
const onlyText = out.every((m) => m.role === 'user' || m.role === 'assistant')
const noForeign = out.every((m) => !/工具调用|工具结果|steering|系统注入|命令节点|总结节点|思考过程|第一条用户消息|助手回复一/.test(m.content))
const within = out.length <= 6 && out.reduce((s, m) => s + m.content.length, 0) <= 1200
console.log('\n只含 user/assistant 文本:', onlyText && noForeign ? 'PASS' : 'FAIL')
console.log('条数/字数上限:', within ? 'PASS' : 'FAIL')

// 超长单条测试
const longText = '长'.repeat(3000)
const out2 = chatContextFromSession({ nodes: [
  { kind: 'user', seq: 1, time: 1, content: [{ type: 'text', text: longText }] },
] })
console.log('\n单条超长(3000字):', out2.length === 1 && out2[0].content.length === 1200 ? 'PASS(截尾1200)' : 'FAIL ' + (out2[0] && out2[0].content.length))
