'use client'

import { useState } from 'react'
import Editor from '@monaco-editor/react'
import '@/lib/monaco/init'
import { runInSandbox } from '@/lib/sandbox/runner'
import type { SandboxRunResult } from '@/lib/sandbox/types'

const INITIAL_CODE = `function myDeepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(myDeepClone)
  const out = {}
  for (const k of Object.keys(obj)) {
    out[k] = myDeepClone(obj[k])
  }
  return out
}`

const CASES = [
  {
    name: '基础对象',
    input: [{ a: 1, b: 'x' }],
    expected: { a: 1, b: 'x' },
  },
  {
    name: '嵌套对象 + 数组',
    input: [{ a: 1, nested: { b: [1, 2, { c: 3 }] } }],
    expected: { a: 1, nested: { b: [1, 2, { c: 3 }] } },
  },
  {
    name: 'null 与原始值',
    input: [null],
    expected: null,
  },
]

export default function PracticePage() {
  const [code, setCode] = useState(INITIAL_CODE)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<SandboxRunResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleRun() {
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const res = await runInSandbox(code, 'myDeepClone', CASES)
      setResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  const passCount = result?.results.filter((r) => r.passed).length ?? 0
  const total = result?.results.length ?? 0

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-8">
      <header>
        <h1 className="text-2xl font-bold">Sandbox Walking Skeleton</h1>
        <p className="text-sm text-zinc-500">
          题目：手写 deepClone · Monaco 编辑器 + Worker 沙盒 + 3 个测试用例
        </p>
      </header>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-400">
          用户代码（可编辑）· 约定导出函数名{' '}
          <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs">
            myDeepClone
          </code>
        </h2>
        <div className="overflow-hidden rounded border border-zinc-800">
          <Editor
            height="320px"
            language="javascript"
            value={code}
            onChange={(v: string | undefined) => setCode(v ?? '')}
            theme="vs-dark"
            loading={
              <div className="flex h-[320px] items-center justify-center text-xs text-zinc-500">
                Monaco 加载中…
              </div>
            }
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              scrollBeyondLastLine: false,
              tabSize: 2,
              lineNumbers: 'on',
              renderLineHighlight: 'line',
              automaticLayout: true,
            }}
          />
        </div>
      </section>

      <button
        onClick={handleRun}
        disabled={running}
        className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {running ? '运行中…' : '在 Worker 里跑'}
      </button>

      {error && (
        <div className="rounded border border-red-500 bg-red-500/10 p-4 text-sm text-red-400">
          <strong>失败：</strong>
          {error}
        </div>
      )}

      {result && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-zinc-400">
            结果 · {passCount}/{total} 通过 · 总耗时{' '}
            {result.totalDurationMs.toFixed(2)}ms
          </h2>
          <ul className="flex flex-col gap-2">
            {result.results.map((r, i) => (
              <li
                key={i}
                className={`rounded border p-3 text-sm ${
                  r.passed
                    ? 'border-green-500/50 bg-green-500/5'
                    : 'border-red-500/50 bg-red-500/5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {r.passed ? '✓' : '✗'} {r.name ?? `case ${i}`}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {r.durationMs.toFixed(2)}ms
                  </span>
                </div>
                {!r.passed && (
                  <pre className="mt-2 overflow-x-auto text-xs text-zinc-400">
                    {r.error
                      ? `error: ${r.error}`
                      : `expected: ${JSON.stringify(r.expected)}\nactual:   ${JSON.stringify(r.actual)}`}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
