/**
 * 把 test case 的 input 从「结构化克隆安全」的形式还原成「活」的值。
 *
 * postMessage / worker_threads 都走结构化克隆，传不了函数 / Promise / 必抛异常的函数。
 * 约定用哨兵对象表达：
 * - `{ __fn: "function(a,b){...}" }`  → 还原成活函数（测试用例要传回调时用）
 * - `{ __val: "Promise.resolve(1)" }` → 还原成活 Promise（测试异步结果时用）
 * - `{ __throw: "msg" }`               → 还原成必抛异常的函数（测试异常场景时用）
 *
 * 从 worker.ts 抽出，网站沙箱（Web Worker）和 MCP 判题（Node worker_threads）共用。
 */
export function reifyInput(v: unknown): unknown {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const rec = v as Record<string, unknown>
    if (typeof rec.__fn === 'string') {
      return new Function(`return (${rec.__fn})`)()
    }
    if (typeof rec.__val === 'string') {
      return new Function(`return (${rec.__val})`)()
    }
    if (typeof rec.__throw === 'string') {
      const msg = rec.__throw
      return () => {
        throw new Error(msg)
      }
    }
    const out: Record<string, unknown> = {}
    for (const [k, x] of Object.entries(rec)) out[k] = reifyInput(x)
    return out
  }
  if (Array.isArray(v)) return v.map(reifyInput)
  return v
}
