'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getAlgoProblem } from '@/data/algo'
import { runInSandbox } from '@/lib/sandbox/runner'
import type { SandboxRunResult } from '@/lib/sandbox/types'
import { ArrayVisualizer } from '@/app/_components/array-visualizer'
import { Markdown } from '@/app/_components/markdown'
import { getArrayTrace } from '@/lib/visualization/traces'
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

  const trace = useMemo(() => getArrayTrace(problem?.id ?? '', SAMPLE), [problem?.id])

  useEffect(() => {
    if (problem) setCode(problem.starterCode)
  }, [problem])

  if (!problem) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-4 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">题目不存在</h1>
        <Link href="/algo" className="text-sm text-accent-bright hover:underline">
          ← 返回算法题
        </Link>
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
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-2">
        <Link href="/algo" className="text-xs text-faint hover:text-muted">
          ← 算法题
        </Link>
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-fg">
            {problem.title}
          </h1>
          <span className="shrink-0 text-sm text-muted">
            难度 {problem.difficulty} · 时限 {problem.timeLimit}ms
          </span>
        </div>
      </header>

      <Section title="题目">
        <div className="text-sm leading-7 text-fg">
          <Markdown text={problem.description} />
        </div>
      </Section>

      {trace && (
        <Section title="过程可视化（参考轨迹）">
          <ArrayVisualizer trace={trace} />
        </Section>
      )}

      <Section
        title="你的实现"
        action={
          <span className="text-xs text-faint">
            导出函数{' '}
            <code className="rounded bg-raised px-1.5 py-0.5 font-mono text-fg">
              {problem.requiredAPI}
            </code>
          </span>
        }
      >
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          className="h-40 w-full resize-none rounded-md border border-hairline bg-surface p-3 font-mono text-sm leading-6 text-fg outline-none focus:border-accent"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            onClick={run}
            disabled={running}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-dim disabled:opacity-50"
          >
            {running ? '运行中…' : '运行测试'}
          </button>
          {error && <span className="text-sm text-bad">错误：{error}</span>}
          {result && (
            <span className={`text-sm ${passed === total ? 'text-ok' : 'text-warn'}`}>
              通过 {passed}/{total}
            </span>
          )}
        </div>
        {result && (
          <ul className="mt-3 space-y-1.5">
            {result.results.map((r, i) => (
              <li key={i} className="flex items-baseline gap-2 text-sm">
                <span className={r.passed ? 'text-ok' : 'text-bad'}>
                  {r.passed ? '✓' : '✗'}
                </span>
                <span className="text-fg">{r.name ?? `用例 ${i + 1}`}</span>
                {!r.passed && r.actual !== undefined && (
                  <span className="text-faint">
                    实际 {JSON.stringify(r.actual)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="提示（苏格拉底分级）">
        {hintCount === 0 ? (
          <p className="text-sm text-faint">卡住了再点下面的按钮，逐层给出提示。</p>
        ) : (
          <ol className="space-y-2">
            {problem.hintLevels.slice(0, hintCount).map((h, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="shrink-0 font-mono text-faint">{i + 1}.</span>
                <span className="text-muted">{h}</span>
              </li>
            ))}
          </ol>
        )}
        {hintCount < problem.hintLevels.length && (
          <button
            onClick={() => setHintCount((c) => c + 1)}
            className="mt-3 rounded-md border border-hairline bg-raised px-3 py-1.5 text-sm text-muted transition-colors hover:border-hairline-strong hover:text-fg"
          >
            显示第 {hintCount + 1} 层提示
          </button>
        )}
      </Section>

      <Section title="苏格拉底教练">
        <div className="min-h-[160px] space-y-3">
          {messages.length === 0 && !chatting && (
            <div className="flex h-36 items-center justify-center text-sm text-faint">
              卡住了就问我，只反问、不给答案。
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
            >
              <div
                className={`max-w-[85%] rounded-md px-3 py-2 text-sm ${
                  m.role === 'user' ? 'bg-accent text-white' : 'bg-raised text-fg'
                }`}
              >
                <Markdown text={m.content} />
              </div>
            </div>
          ))}
          {chatting && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-md bg-raised px-3 py-2 text-sm text-fg">
                <Markdown text={streamingText || '思考中…'} />
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
            className="flex-1 rounded-md border border-hairline bg-surface px-3 py-2 text-sm text-fg outline-none focus:border-accent placeholder:text-faint"
          />
          <button
            onClick={send}
            disabled={chatting || !input.trim()}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-dim disabled:opacity-50"
          >
            发送
          </button>
        </div>
      </Section>
    </main>
  )
}

/** 分区卡片：标题栏 + 内容体，全页统一的分区视觉。 */
function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-md border border-hairline bg-surface">
      <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
        <span className="text-sm font-medium text-muted">{title}</span>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}
