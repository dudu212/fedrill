import type {
  SandboxRequest,
  SandboxResponse,
  SandboxRunResult,
  TestCase,
} from './types'

export async function runInSandbox(
  code: string,
  entryName: string,
  cases: TestCase[],
  options: { timeoutMs?: number } = {},
): Promise<SandboxRunResult> {
  const timeoutMs = options.timeoutMs ?? 3000
  const worker = new Worker(new URL('./worker.ts', import.meta.url), {
    type: 'module',
  })

  return new Promise<SandboxRunResult>((resolve, reject) => {
    let settled = false
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      worker.terminate()
      fn()
    }

    const timer = setTimeout(() => {
      finish(() =>
        reject(new Error(`执行超时（${timeoutMs}ms），可能存在死循环`)),
      )
    }, timeoutMs)

    worker.onmessage = (e: MessageEvent<SandboxResponse>) => {
      const data = e.data
      if (data.type === 'result') {
        finish(() =>
          resolve({
            results: data.results,
            totalDurationMs: data.totalDurationMs,
          }),
        )
      } else {
        finish(() => reject(new Error(data.error)))
      }
    }

    worker.onerror = (err) => {
      finish(() => reject(new Error(err.message || 'Worker 加载/执行错误')))
    }

    const request: SandboxRequest = {
      type: 'run',
      code,
      entryName,
      cases,
    }
    worker.postMessage(request)
  })
}
