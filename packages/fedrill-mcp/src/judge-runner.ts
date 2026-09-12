/**
 * Node 判题入口（主线程侧）。
 * 对应网站沙箱 lib/sandbox/runner.ts：worker_threads + terminate 超时 + nonce 校验。
 * 用 Promise.race 做超时，finally 里 await terminate() 确保 worker 彻底清理，避免残留影响下一次判题。
 */
import { Worker } from 'node:worker_threads'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type {
  SandboxRequest,
  SandboxResponse,
  SandboxRunResult,
  TestCase,
} from '../../../lib/sandbox/types'

// judge-worker 单独打包成 dist/judge-worker.js，这里按 dist 目录相对定位
const workerPath = join(dirname(fileURLToPath(import.meta.url)), 'judge-worker.js')

export async function runInSandbox(
  code: string,
  entryName: string,
  cases: TestCase[],
  options: { timeoutMs?: number } = {},
): Promise<SandboxRunResult> {
  const timeoutMs = options.timeoutMs ?? 3000
  const nonce = randomUUID()
  const worker = new Worker(workerPath)

  try {
    return await Promise.race([
      // 正常结果
      new Promise<SandboxRunResult>((resolve, reject) => {
        worker.on('message', (data: SandboxResponse) => {
          if (data.nonce !== nonce) return
          if (data.type === 'result') {
            resolve({ results: data.results, totalDurationMs: data.totalDurationMs })
          } else {
            reject(new Error(data.error))
          }
        })
        worker.on('error', (err) => {
          reject(new Error(err.message || 'Worker 执行错误'))
        })

        const request: SandboxRequest = { type: 'run', code, entryName, cases, nonce }
        worker.postMessage(request)
      }),
      // 超时
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`执行超时（${timeoutMs}ms），可能存在死循环`))
        }, timeoutMs)
      }),
    ])
  } finally {
    // 无论成功/失败/超时，都确保 worker 彻底终止后再返回，避免残留 worker 影响后续判题
    await worker.terminate().catch(() => {})
  }
}
