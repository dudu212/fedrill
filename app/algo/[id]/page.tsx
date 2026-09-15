'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getAlgoProblem } from '@/data/algo'
import { runInSandbox } from '@/lib/sandbox/runner'
import type { SandboxRunResult } from '@/lib/sandbox/types'
import { ArrayVisualizer } from '@/app/_components/array-visualizer'
import { bubbleSortTrace } from '@/lib/visualization/traces/bubble-sort'
import { runAgentLoop } from '@/lib/agent/loop'
import type { ProviderMessage } from '@/lib/llm/types'
import { buildSocraticSystemPrompt } from '@/lib/agent/socratic-prompt'
import {
  algoRunTestsToolSpec,
  visualizeToolSpec,
  executeAlgoRunTests,
  executeVisualize,
} from '@/lib/agent/tools/algo-tools'

/** 可视化演示用的样例数组（参考轨迹，v1 不插桩用户代码） */
const SAMPLE = [5, 2, 8, 1, 9, 3, 7, 4, 6]

type ChatMsg = { role: 'user' | 'assistant'; content: string }

export default function AlgoDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const problem = id ? getAlgoProblem(id) : undefined

  const [code, setCode] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<SandboxRunResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hintCount, setHintCount] = useState(0)
  const [testedCodeSnapshot, setTestedCodeSnapshot] = useState<string | null>(null)

  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [chatting, setChatting] = useState(false)
  const [streamingText, setStreamingText] = useState('')

  const trace = useMemo(() => bubbleSortTrace(SAMPLE), [])

  useEffect(() => {
    if (problem) setCode(problem.starterCode)
  }, [problem])

  if (!problem) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">找不到算法题「{id}」</main>
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
      setTestedCodeSnapshot(code)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  const send = async () => {
    if (!input.trim() || chatting) return
    const userMsg = input.trim()
    setInput('')
    setMessages((m) => [...m, { role: 'user', content: userMsg }])
    setChatting(true)
    setStreamingText('')

    const systemPrompt = buildSocraticSystemPrompt(problem, {
      problemId: problem.id,
      code,
      testResults: result,
      hintLevelRevealed: hintCount,
      testedCodeSnapshot,
    })

    const history: ProviderMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }))
    const initialMessages: ProviderMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMsg },
    ]

    let assistantContent = ''
    try {
      for await (const event of runAgentLoop({
        problemId: problem.id,
        initialMessages,
        tools: [algoRunTestsToolSpec, visualizeToolSpec],
        executeTool: async (name, _args, pid) => {
          if (name === 'run_tests') return await executeAlgoRunTests(pid, code)
          if (name === 'visualize') return await executeVisualize(pid)
          return { success: false, error: `Unknown tool: ${name}` }
        },
      })) {
        if (event.type === 'text_delta') {
          assistantContent += event.delta
          setStreamingText(assistantContent)
        } else if (event.type === 'tool_call') {
          assistantContent += `\n\n[🔧 调用 ${event.call.name}]`
          setStreamingText(assistantContent)
        }
      }
      setMessages((m) => [...m, { role: 'assistant', content: assistantContent }])
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: `⚠️ ${e instanceof Error ? e.message : String(e)}` },
      ])
    } finally {
      setChatting(false)
      setStreamingText('')
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

      <h2 className="mt-8 mb-2 text-lg font-semibold">苏格拉底教练</h2>
      <div className="rounded-lg border border-slate-200 p-4">
        <div className="space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
              <div
                className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                  m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-800'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {chatting && (
            <div className="text-left">
              <div className="inline-block max-w-[85%] whitespace-pre-wrap rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-800">
                {streamingText || '思考中…'}
              </div>
            </div>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder="问我这道题怎么想、卡在哪了…"
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            onClick={send}
            disabled={chatting || !input.trim()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            发送
          </button>
        </div>
      </div>
    </main>
  )
}
