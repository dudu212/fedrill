// smoke.mjs —— 用原始 JSON-RPC 走一遍 MCP stdio 握手，验证 3 个只读 tool
// 运行：node scripts/smoke.mjs（需先 pnpm build）
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const pkgDir = join(dirname(fileURLToPath(import.meta.url)), '..')

const child = spawn(process.execPath, ['dist/index.js'], {
  cwd: pkgDir,
  stdio: ['pipe', 'pipe', 'inherit'],
})

let buf = ''
let nextId = 1
const pending = new Map()

child.stdout.on('data', (chunk) => {
  buf += chunk.toString()
  let idx
  while ((idx = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, idx).trim()
    buf = buf.slice(idx + 1)
    if (!line) continue
    const msg = JSON.parse(line)
    const cb = pending.get(msg.id)
    if (cb) {
      pending.delete(msg.id)
      cb(msg)
    }
  }
})

function rpc(method, params = {}) {
  const id = nextId++
  return new Promise((resolve) => {
    pending.set(id, resolve)
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
  })
}

function notify(method) {
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method }) + '\n')
}

// 兜底：5 秒没跑完说明服务器没响应
setTimeout(() => {
  console.error('⏱ smoke 超时（5s）—— 服务器可能没响应')
  child.kill()
  process.exit(1)
}, 5000)

// ① initialize（握手，协商协议版本）
const init = await rpc('initialize', {
  protocolVersion: '2024-11-05',
  capabilities: {},
  clientInfo: { name: 'smoke', version: '0.0.0' },
})
console.log('① initialize →', JSON.stringify(init.result.serverInfo), '| 协商协议:', init.result.protocolVersion)

notify('notifications/initialized')

// ② tools/list
const list = await rpc('tools/list')
console.log('\n② tools/list →', list.result.tools.map((t) => t.name).join(', '))

// ③ list_problems
const lp = await rpc('tools/call', { name: 'list_problems', arguments: {} })
console.log('\n③ list_problems（前 2 道）→\n' + lp.result.content[0].text.split('\n').slice(0, 24).join('\n'))

// ④ list_problems 未知分类
const lpBad = await rpc('tools/call', { name: 'list_problems', arguments: { category: 'nope' } })
console.log('\n④ list_problems(category=nope) → isError:', lpBad.result.isError, '|', lpBad.result.content[0].text)

// ⑤ get_problem
const gp = await rpc('tools/call', { name: 'get_problem', arguments: { id: 'deep-clone' } })
const gpText = gp.result.content[0].text
console.log('\n⑤ get_problem(deep-clone) → isError:', gp.result.isError, '| 含 testCases:', gpText.includes('testCases'))
console.log(gpText.slice(0, 420))

// ⑥ get_problem 未知 id
const gpBad = await rpc('tools/call', { name: 'get_problem', arguments: { id: 'nope' } })
console.log('\n⑥ get_problem(nope) → isError:', gpBad.result.isError, '|', gpBad.result.content[0].text)

// ⑦ explain_concept
const ex = await rpc('tools/call', { name: 'explain_concept', arguments: { topic: '深拷贝' } })
console.log('\n⑦ explain_concept(深拷贝) →\n' + ex.result.content[0].text)

child.kill()
console.log('\n✅ smoke 完成')
process.exit(0)
