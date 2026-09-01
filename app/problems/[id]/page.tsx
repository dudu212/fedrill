'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Editor from '@monaco-editor/react'
import { categoryLabels, getProblem } from '@/data/problems'
import { runInSandbox } from '@/lib/sandbox/runner'
import type { SandboxRunResult, TestResult } from '@/lib/sandbox/types'
import { buildRound0SystemPrompt } from '@/lib/agent/round0-prompt'
import { runAgentLoop } from '@/lib/agent/loop'
import type { ProviderMessage } from '@/lib/llm/types'
import {
  getSessionRepo,
  type SessionMessage,
} from '@/lib/repo/session-repo'

type WireMessage = { role: 'user' | 'assistant' | 'system'; content: string }

export default function ProblemDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const problem = id ? getProblem(id) : undefined
  const repo = useMemo(() => getSessionRepo(), [])

  const [code, setCode] = useState<string>('')
  const [running, setRunning] = useState(false)
  const [testResults, setTestResults] = useState<SandboxRunResult | null>(null)
  const [testError, setTestError] = useState<string | null>(null)
  const [testedCodeSnapshot, setTestedCodeSnapshot] = useState<string | null>(
    null,
  )

  const [messages, setMessages] = useState<WireMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  /** streaming 期间显示 AI 现在在做什么 · 状态栏用 */
  const [agentStatus, setAgentStatus] = useState<string | null>(null)
  const chatAbortRef = useRef<AbortController | null>(null)

  // Split ratios (percentages, 0-100)
  const [leftPct, setLeftPct] = useState(40)
  const [leftTopPct, setLeftTopPct] = useState(55)
  const [rightTopPct, setRightTopPct] = useState(50)
  // Chat input area height (px)
  const [inputAreaHeight, setInputAreaHeight] = useState(96)
  const mainRef = useRef<HTMLDivElement>(null)
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)

  // Hydrate all persisted state from SessionRepo on mount (auto-migrates legacy fedrill:code:<id> key)
  useEffect(() => {
    if (!problem) return
    let cancelled = false
    ;(async () => {
      const snap = await repo.get(problem.id)
      if (cancelled) return
      if (snap) {
        setCode(snap.code || problem.starterCode)
        const wire: WireMessage[] = snap.messages
          .filter(
            (m) =>
              m.role === 'user' ||
              m.role === 'assistant' ||
              m.role === 'system',
          )
          .map((m) => ({
            role: m.role as WireMessage['role'],
            content: m.content,
          }))
        setMessages(wire)
        setTestedCodeSnapshot(snap.testedCodeSnapshot)
        setTestResults(snap.lastTestResults)
      } else {
        setCode(problem.starterCode)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [problem, repo])

  // Debounced persist of code changes (300ms 合并连续按键)
  useEffect(() => {
    if (!problem || !code) return
    const timer = setTimeout(() => {
      repo.save(problem.id, { code }).catch(console.error)
    }, 300)
    return () => clearTimeout(timer)
  }, [code, problem, repo])

  // Debounced persist of messages (300ms 合并流式追加的 setState 洪泛)
  useEffect(() => {
    if (!problem) return
    const timer = setTimeout(() => {
      const now = Date.now()
      const persisted: SessionMessage[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: now,
      }))
      repo.save(problem.id, { messages: persisted }).catch(console.error)
    }, 300)
    return () => clearTimeout(timer)
  }, [messages, problem, repo])

  const runTests = useCallback(async () => {
    if (!problem || running) return
    setRunning(true)
    setTestError(null)
    setTestResults(null)
    setTestedCodeSnapshot(null)
    try {
      const res = await runInSandbox(
        code,
        problem.requiredAPI,
        problem.testCases.basic,
      )
      setTestResults(res)
      setTestedCodeSnapshot(code)
      repo
        .save(problem.id, {
          lastTestResults: res,
          testedCodeSnapshot: code,
        })
        .catch(console.error)
    } catch (e) {
      setTestError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }, [problem, code, running, repo])

  const sendMessage = useCallback(async () => {
    if (!problem) return
    const text = input.trim()
    if (!text || streaming) return
    setChatError(null)
    setInput('')

    const userMsg: WireMessage = { role: 'user', content: text }
    const nextMessages: WireMessage[] = [...messages, userMsg]
    setMessages([...nextMessages, { role: 'assistant', content: '' }])
    setStreaming(true)
    setAgentStatus('🤔 思考中')

    const ac = new AbortController()
    chatAbortRef.current = ac

    // 按 ADR-011：客户端组装 system prompt，服务端保持无状态 LLM 代理
    const systemPrompt = buildRound0SystemPrompt(problem, {
      problemId: problem.id,
      code,
      testResults,
      testedCodeSnapshot,
    })
    const initialMessages: ProviderMessage[] = [
      { role: 'system', content: systemPrompt },
      ...nextMessages.map((m) => ({ role: m.role, content: m.content })),
    ]

    try {
      // 一个 assistant "气泡" 对应 loop 的一次 iteration 输出。
      // pendingContent 累加当前气泡的文字；tool_result 后重置并等下一次 text_delta
      // 开新气泡。
      let pendingContent = ''
      let newBubbleExpected = false

      for await (const event of runAgentLoop({
        problemId: problem.id,
        initialMessages,
        signal: ac.signal,
      })) {
        if (event.type === 'text_delta') {
          setAgentStatus('✍️ 生成回复...')
          if (newBubbleExpected) {
            pendingContent = event.delta
            setMessages((prev) => [
              ...prev,
              { role: 'assistant', content: pendingContent },
            ])
            newBubbleExpected = false
          } else {
            pendingContent += event.delta
            setMessages((prev) => {
              const copy = prev.slice()
              copy[copy.length - 1] = {
                role: 'assistant',
                content: pendingContent,
              }
              return copy
            })
          }
        } else if (event.type === 'tool_call') {
          setAgentStatus(`🔧 调用 ${event.call.name}...`)
          // MVP：行内 emoji 标记表达 tool_call；M2b Phase 1b 换成卡片组件
          const marker = `🔧 调用 ${event.call.name}...`
          pendingContent = pendingContent
            ? `${pendingContent}\n\n${marker}`
            : marker
          setMessages((prev) => {
            const copy = prev.slice()
            copy[copy.length - 1] = {
              role: 'assistant',
              content: pendingContent,
            }
            return copy
          })
        } else if (event.type === 'tool_result') {
          setAgentStatus('📊 拿到结果,分析中...')
          const r = event.result as {
            success?: boolean
            passCount?: number
            total?: number
            allPassed?: boolean
            error?: string
          }
          const summary = r.success
            ? r.allPassed
              ? ` → ✓ 全部 ${r.total} 个用例通过`
              : ` → ✗ ${r.passCount}/${r.total} 通过`
            : ` → ⚠️ 执行错误: ${r.error ?? '未知'}`
          pendingContent += summary
          setMessages((prev) => {
            const copy = prev.slice()
            copy[copy.length - 1] = {
              role: 'assistant',
              content: pendingContent,
            }
            return copy
          })
          // 语义一致：AI 触发的 run_tests 也应该像用户点"运行"一样刷新 UI 面板。
          // tool 执行时已经把结果存到 SessionRepo，这里从 repo 拉回来同步 React state。
          const snap = await repo.get(problem.id).catch(() => null)
          if (snap?.lastTestResults) {
            setTestResults(snap.lastTestResults)
            setTestedCodeSnapshot(snap.testedCodeSnapshot)
          }
          // 下一次 text_delta 归属新 assistant 气泡
          newBubbleExpected = true
          pendingContent = ''
        } else if (event.type === 'done') {
          break
        } else if (event.type === 'error') {
          throw new Error(event.error)
        }
      }
    } catch (e) {
      if (!(e instanceof Error && e.name === 'AbortError')) {
        setChatError(e instanceof Error ? e.message : String(e))
      }
    } finally {
      setStreaming(false)
      setAgentStatus(null)
      chatAbortRef.current = null
    }
  }, [problem, input, streaming, messages, code, testResults, testedCodeSnapshot])

  const passCount = testResults?.results.filter((r) => r.passed).length ?? 0
  const total = testResults?.results.length ?? 0
  const allPassed = total > 0 && passCount === total
  const currentRound = allPassed ? 1 : 0

  if (!problem) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-4 p-8">
        <h1 className="text-2xl font-bold">题目不存在</h1>
        <Link href="/problems" className="text-blue-500 hover:underline">
          ← 返回题库
        </Link>
      </main>
    )
  }

  return (
    <main className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-3">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Link href="/problems" className="hover:text-zinc-100">
            手撕训练
          </Link>
          <span>/</span>
          <span>{categoryLabels[problem.category]}</span>
          <span>/</span>
          <span className="text-zinc-100">{problem.title}</span>
        </div>
        <div className="flex items-center gap-3">
          {total > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <div className="h-2 w-28 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className={`h-full transition-all ${
                    allPassed ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${(passCount / total) * 100}%` }}
                />
              </div>
              <span className="text-zinc-300">
                {passCount}/{total}
              </span>
            </div>
          )}
          <span
            className={`rounded-full border px-2.5 py-0.5 text-sm ${
              currentRound === 0
                ? 'border-blue-500/50 bg-blue-500/10 text-blue-300'
                : 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
            }`}
          >
            Round {currentRound} · {currentRound === 0 ? '基础实现' : '边界追问'}
          </span>
        </div>
      </header>

      <div ref={mainRef} className="flex min-h-0 flex-1">
        {/* Left column */}
        <section
          ref={leftRef}
          className="flex min-h-0 flex-col overflow-hidden"
          style={{ flex: `0 0 ${leftPct}%` }}
        >
          <div
            className="min-h-0 overflow-auto border border-zinc-800 bg-zinc-950 p-5"
            style={{ flex: `0 0 ${leftTopPct}%` }}
          >
            <h2 className="mb-3 text-2xl font-semibold text-zinc-50">
              {problem.title}
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {problem.tags.map((t) => (
                <span
                  key={t}
                  className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-200"
                >
                  {t}
                </span>
              ))}
            </div>
            <article className="mt-4 whitespace-pre-wrap text-base leading-7 text-zinc-100">
              {problem.description}
            </article>
          </div>
          <ResizeHandle
            direction="vertical"
            containerRef={leftRef}
            setPct={setLeftTopPct}
          />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden border border-zinc-800 bg-zinc-950">
            <div className="border-b border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300">
              测试结果
              {total > 0 &&
                ` · ${passCount}/${total} 通过 · ${testResults?.totalDurationMs.toFixed(0)}ms`}
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-3 text-sm">
              {testError && (
                <div className="rounded border border-red-500/40 bg-red-500/10 p-2 text-red-300">
                  {testError}
                </div>
              )}
              {!testError && !testResults && (
                <div className="text-zinc-500">
                  点"运行"或 Ctrl/Cmd+Enter 开始
                </div>
              )}
              {testResults?.results.map((r, i) => (
                <TestResultRow key={i} result={r} />
              ))}
            </div>
          </div>
        </section>

        <ResizeHandle
          direction="horizontal"
          containerRef={mainRef}
          setPct={setLeftPct}
        />

        {/* Right column */}
        <section
          ref={rightRef}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div
            className="flex flex-col overflow-hidden border border-zinc-800"
            style={{ flex: `0 0 ${rightTopPct}%` }}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
              <span className="text-zinc-400">
                导出函数：
                <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-100">
                  {problem.requiredAPI}
                </code>
              </span>
              <button
                onClick={runTests}
                disabled={running}
                className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {running ? '运行中…' : '运行 (Ctrl+Enter)'}
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <Editor
                height="100%"
                language="javascript"
                value={code}
                onChange={(v) => setCode(v ?? '')}
                theme="vs-dark"
                loading={
                  <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                    Monaco 加载中…
                  </div>
                }
                onMount={(editor, monaco) => {
                  editor.addCommand(
                    monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
                    () => {
                      runTests()
                    },
                  )
                }}
                options={{
                  minimap: { enabled: false },
                  fontSize: 15,
                  scrollBeyondLastLine: false,
                  tabSize: 2,
                  lineNumbers: 'on',
                  automaticLayout: true,
                }}
              />
            </div>
          </div>

          <ResizeHandle
            direction="vertical"
            containerRef={rightRef}
            setPct={setRightTopPct}
          />

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden border border-zinc-800 bg-zinc-950">
            <div className="border-b border-zinc-800 px-3 py-2 text-sm font-medium text-zinc-300">
              Agent 对话 · Round {currentRound}
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-auto p-3">
              {messages.length === 0 && (
                <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                  说点什么，比如"我不会写"或"我这样写对吗？"
                </div>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`rounded px-3 py-2 text-base ${
                    m.role === 'user'
                      ? 'bg-blue-600/20 text-zinc-50'
                      : 'bg-zinc-900 text-zinc-100'
                  }`}
                >
                  <div className="mb-1 text-xs uppercase opacity-60">
                    {m.role === 'user' ? 'you' : 'agent'}
                  </div>
                  <div className="whitespace-pre-wrap">
                    {m.content}
                    {streaming &&
                      i === messages.length - 1 &&
                      m.role === 'assistant' && (
                        <span className="ml-1 animate-pulse">▍</span>
                      )}
                  </div>
                </div>
              ))}
            </div>
            {chatError && (
              <div className="border-t border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {chatError}
              </div>
            )}
            {streaming && agentStatus && (
              <div className="flex items-center gap-2 border-t border-blue-500/40 bg-blue-500/10 px-3 py-2 text-sm text-blue-200">
                <span className="animate-pulse text-blue-300">▍</span>
                <span>{agentStatus}</span>
              </div>
            )}
            <HeightHandle
              height={inputAreaHeight}
              setHeight={setInputAreaHeight}
            />
            <div
              className="flex shrink-0 gap-2 border-t border-zinc-800 p-2"
              style={{ height: inputAreaHeight }}
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === 'Enter' &&
                    !e.shiftKey &&
                    !e.metaKey &&
                    !e.ctrlKey &&
                    !e.altKey
                  ) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                placeholder="Enter 发送 · Shift+Enter 换行"
                disabled={streaming}
                className="h-full flex-1 resize-none overflow-y-auto rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-base text-zinc-100 placeholder:text-zinc-500 disabled:opacity-50"
              />
              <div className="flex h-full flex-col gap-1">
                <button
                  onClick={sendMessage}
                  disabled={streaming || !input.trim()}
                  className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  发送
                </button>
                <button
                  onClick={() => chatAbortRef.current?.abort()}
                  disabled={!streaming}
                  className="rounded bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700 disabled:opacity-30"
                >
                  中断
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function ResizeHandle({
  direction,
  containerRef,
  setPct,
  min = 15,
  max = 85,
}: {
  direction: 'horizontal' | 'vertical'
  containerRef: RefObject<HTMLDivElement | null>
  setPct: (v: number) => void
  min?: number
  max?: number
}) {
  const dragging = useRef(false)
  const [active, setActive] = useState(false)
  const base =
    direction === 'horizontal'
      ? 'w-2 shrink-0 cursor-col-resize'
      : 'h-2 shrink-0 cursor-row-resize'
  return (
    <div
      role="separator"
      aria-orientation={direction === 'horizontal' ? 'vertical' : 'horizontal'}
      className={`${base} select-none transition-colors ${
        active ? 'bg-blue-500' : 'bg-zinc-700 hover:bg-blue-500'
      }`}
      onPointerDown={(e) => {
        dragging.current = true
        setActive(true)
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (!dragging.current || !containerRef.current) return
        const rect = containerRef.current.getBoundingClientRect()
        const raw =
          direction === 'horizontal'
            ? ((e.clientX - rect.left) / rect.width) * 100
            : ((e.clientY - rect.top) / rect.height) * 100
        setPct(Math.max(min, Math.min(max, raw)))
      }}
      onPointerUp={(e) => {
        dragging.current = false
        setActive(false)
        e.currentTarget.releasePointerCapture(e.pointerId)
      }}
    />
  )
}

function HeightHandle({
  height,
  setHeight,
  min = 60,
  max = 320,
}: {
  height: number
  setHeight: (v: number) => void
  min?: number
  max?: number
}) {
  const startY = useRef(0)
  const startH = useRef(0)
  const [active, setActive] = useState(false)
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      className={`h-2 shrink-0 cursor-row-resize select-none transition-colors ${
        active ? 'bg-blue-500' : 'bg-zinc-700 hover:bg-blue-500'
      }`}
      onPointerDown={(e) => {
        startY.current = e.clientY
        startH.current = height
        setActive(true)
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
        const dy = e.clientY - startY.current
        // Handle 在输入框上方：向上拖 → dy 为负 → 高度变大
        setHeight(Math.max(min, Math.min(max, startH.current - dy)))
      }}
      onPointerUp={(e) => {
        setActive(false)
        e.currentTarget.releasePointerCapture(e.pointerId)
      }}
    />
  )
}

function TestResultRow({ result }: { result: TestResult }) {
  const [expanded, setExpanded] = useState(!result.passed)
  return (
    <div
      className={`mb-1.5 rounded border p-2 ${
        result.passed
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : 'border-red-500/40 bg-red-500/5'
      }`}
    >
      <button
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="font-medium text-zinc-100">
          {result.passed ? '✓' : '✗'} {result.name ?? '?'}
        </span>
        <span className="text-xs text-zinc-500">
          {result.durationMs.toFixed(1)}ms
        </span>
      </button>
      {expanded && !result.passed && (
        <pre className="mt-2 overflow-x-auto text-xs leading-6 text-zinc-300">
          {result.error
            ? `Error: ${result.error}`
            : `Input:    ${JSON.stringify(result.input)}\nExpected: ${JSON.stringify(result.expected)}\nActual:   ${JSON.stringify(result.actual)}`}
        </pre>
      )}
    </div>
  )
}
