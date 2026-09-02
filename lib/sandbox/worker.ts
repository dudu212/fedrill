/// <reference lib="webworker" />

import type { SandboxRequest, SandboxResponse, TestResult } from './types'
import { deepEqual } from './deep-equal'

const ctx = self as unknown as DedicatedWorkerGlobalScope

function reifyInput(v: unknown): unknown {
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

ctx.onmessage = async (e: MessageEvent<SandboxRequest>) => {
  if (e.data.type !== 'run') return
  const { code, entryName, cases, nonce } = e.data

  try {
    const factory = new Function(
      'self', 'postMessage', 'globalThis', 'importScripts',
      `"use strict";\n${code}\nreturn typeof ${entryName} !== 'undefined' ? ${entryName} : undefined`,
    )
    const fn = factory(undefined, undefined, undefined, undefined)

    if (typeof fn !== 'function') {
      const res: SandboxResponse = {
        type: 'error',
        nonce,
        error: `未在用户代码中找到函数 "${entryName}"`,
      }
      ctx.postMessage(res)
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
    ctx.postMessage(res)
  } catch (err) {
    const res: SandboxResponse = {
      type: 'error',
      nonce,
      error: err instanceof Error ? err.message : String(err),
    }
    ctx.postMessage(res)
  }
}

export {}
