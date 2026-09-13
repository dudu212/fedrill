'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getAlgoProblem } from '@/data/algo'
import { runInSandbox } from '@/lib/sandbox/runner'
import type { SandboxRunResult } from '@/lib/sandbox/types'
import { ArrayVisualizer } from '@/app/_components/array-visualizer'
import { bubbleSortTrace } from '@/lib/visualization/traces/bubble-sort'

/** 可视化演示用的样例数组（参考轨迹，v1 不插桩用户代码） */
const SAMPLE = [5, 2, 8, 1, 9, 3, 7, 4, 6]

export default function AlgoDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const problem = id ? getAlgoProblem(id) : undefined

  const [code, setCode] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<SandboxRunResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hintCount, setHintCount] = useState(0)

  const trace = useMemo(() => bubbleSortTrace(SAMPLE), [])

  useEffect(() => {
    if (problem) setCode(problem.starterCode)
  }, [problem])

  if (!problem) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        找不到算法题「{id}」
      </main>
    )
  }

  const run = async () => {
    setRunning(true)
    setError(null)
    try {
      const res = await runInSandbox(code, problem.requiredAPI, problem.testCases, {
        timeoutMs: problem.timeLimit,
      })
      setResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  const passed = result?.results.filter((r) => r.passed).length ?? 0
  const total = result?.results.length ?? 0

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/algo" className="text-sm text-slate-500 hover:underline">
        ← 算法题
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{problem.title}</h1>
      <p className="mt-1 text-sm text-slate-500">
        难度 {problem.difficulty} · 时限 {problem.timeLimit}ms
      </p>

      <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm">
        {problem.description}
      </pre>

      <h2 className="mt-8 mb-2 text-lg font-semibold">过程可视化（参考轨迹）</h2>
      <ArrayVisualizer trace={trace} />

      <h2 className="mt-8 mb-2 text-lg font-semibold">你的实现</h2>
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="h-40 w-full rounded-lg border border-slate-300 p-3 font-mono text-sm"
        spellCheck={false}
      />
      <button
        onClick={run}
        disabled={running}
        className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {running ? '运行中…' : '运行测试'}
      </button>

      {error && <p className="mt-3 text-sm text-red-600">错误：{error}</p>}
      {result && (
        <div className="mt-3 text-sm">
          <p className={passed === total ? 'text-green-600' : 'text-amber-600'}>
            通过 {passed}/{total}
          </p>
          {result.results.map((r, i) => (
            <p key={i} className={r.passed ? 'text-green-700' : 'text-red-700'}>
              {r.passed ? '✓' : '✗'} {r.name ?? `用例 ${i + 1}`}
              {!r.passed && r.actual !== undefined ? ` · 实际 ${JSON.stringify(r.actual)}` : ''}
            </p>
          ))}
        </div>
      )}

      <h2 className="mt-8 mb-2 text-lg font-semibold">提示（苏格拉底分级）</h2>
      {problem.hintLevels.slice(0, hintCount).map((h, i) => (
        <p key={i} className="mb-1 text-sm text-slate-600">
          {h}
        </p>
      ))}
      {hintCount < problem.hintLevels.length && (
        <button
          onClick={() => setHintCount((c) => c + 1)}
          className="mt-2 rounded-md bg-slate-200 px-3 py-1.5 text-sm hover:bg-slate-300"
        >
          显示第 {hintCount + 1} 层提示
        </button>
      )}
    </main>
  )
}
