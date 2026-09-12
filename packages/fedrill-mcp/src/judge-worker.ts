/**
 * Node 判题 Worker（worker_threads）。
 * 对应网站沙箱 lib/sandbox/worker.ts，但 `new Function` 换成 `vm` 隔离上下文——
 * 因为 Node 全局有 require/process，vm 能真正把它们挡在上下文外。
 */
import { parentPort } from 'node:worker_threads'
import vm from 'node:vm'
import type {
  SandboxRequest,
  SandboxResponse,
  TestResult,
} from '../../../lib/sandbox/types'
import { deepEqual } from '../../../lib/sandbox/deep-equal'
import { reifyInput } from '../../../lib/sandbox/reify-input'

if (!parentPort) throw new Error('judge-worker 只能作为 worker_threads 运行')
const port = parentPort

port.on('message', async (msg: SandboxRequest) => {
  if (msg.type !== 'run') return
  const { code, entryName, cases, nonce } = msg

  try {
    // 隔离上下文：只放无害全局（console / 定时器），不放 require/process/fetch
    const sandbox: Record<string, unknown> = {
      console,
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
    }
    const context = vm.createContext(sandbox)

    // 在上下文里运行用户代码 + 取 entryName 函数（vm 挡掉 require/process）
    const wrapper = `"use strict";\n${code}\ntypeof ${entryName} !== 'undefined' ? ${entryName} : undefined`
    const fn = vm.runInContext(wrapper, context, { timeout: 3000 })

    if (typeof fn !== 'function') {
      const res: SandboxResponse = {
        type: 'error',
        nonce,
        error: `未在用户代码中找到函数 "${entryName}"`,
      }
      port.postMessage(res)
      return
    }

    const results: TestResult[] = []
    const t0 = performance.now()

    for (const c of cases) {
      const caseStart = performance.now()
      try {
        const args = reifyInput(c.input) as unknown[]
        const actual = await Promise.resolve(fn(...args))
        results.push({
          name: c.name,
          passed: deepEqual(actual, c.expected),
          input: c.input,
          expected: c.expected,
          actual,
          durationMs: performance.now() - caseStart,
        })
      } catch (err) {
        results.push({
          name: c.name,
          passed: false,
          input: c.input,
          expected: c.expected,
          error: err instanceof Error ? err.message : String(err),
          durationMs: performance.now() - caseStart,
        })
      }
    }

    const res: SandboxResponse = {
      type: 'result',
      nonce,
      results,
      totalDurationMs: performance.now() - t0,
    }
    port.postMessage(res)
  } catch (err) {
    const res: SandboxResponse = {
      type: 'error',
      nonce,
      error: err instanceof Error ? err.message : String(err),
    }
    port.postMessage(res)
  }
})
