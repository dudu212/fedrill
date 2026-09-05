'use client'

import { useRef, useState } from 'react'
import type { ChatMessage } from '@/lib/types/problem'
import { getApiKey } from '@/lib/settings/api-key'
import { ApiKeySettings } from '@/app/_components/api-key-settings'

type WireMessage = Pick<ChatMessage, 'role' | 'content'>

const SYSTEM_PROMPT = '你是一个前端面试官，说话简洁、只反问不给答案。'

export default function ChatDemoPage() {
  const [messages, setMessages] = useState<WireMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  async function send() {
    const text = input.trim()
    if (!text || streaming) return

    setError(null)
    setInput('')
    const userMsg: WireMessage = { role: 'user', content: text }
    const nextMessages: WireMessage[] = [...messages, userMsg]
    setMessages([...nextMessages, { role: 'assistant', content: '' }])
    setStreaming(true)

    const ac = new AbortController()
    abortRef.current = ac

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      const apiKey = getApiKey()
      if (apiKey) headers['x-deepseek-api-key'] = apiKey

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...nextMessages],
        }),
        signal: ac.signal,
      })

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => '未知错误')
        throw new Error(`${res.status} · ${errText}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        setMessages((prev) => {
          const copy = prev.slice()
          copy[copy.length - 1] = { role: 'assistant', content: acc }
          return copy
        })
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        // user 主动中断，不算错误
      } else {
        setError(e instanceof Error ? e.message : String(e))
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  function stop() {
    abortRef.current?.abort()
  }

  function reset() {
    if (streaming) abortRef.current?.abort()
    setMessages([])
    setError(null)
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 p-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Chat Demo · F-004</h1>
          <p className="text-sm text-zinc-500">
            验证 <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs">/api/chat</code> 流式端到端 · 0 依赖手写 SSE 解析
          </p>
        </div>
        <ApiKeySettings />
      </header>

      <section className="flex min-h-[400px] flex-1 flex-col gap-3 rounded border border-zinc-800 p-4">
        {messages.length === 0 && (
          <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
            输入一条消息开始 · 例如"帮我练一道 debounce"
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded px-3 py-2 text-sm ${
              m.role === 'user'
                ? 'self-end bg-blue-600 text-white'
                : 'self-start bg-zinc-800 text-zinc-100'
            }`}
          >
            <div className="mb-1 text-[10px] uppercase opacity-60">{m.role}</div>
            <div className="whitespace-pre-wrap">
              {m.content}
              {streaming && i === messages.length - 1 && m.role === 'assistant' && (
                <span className="ml-1 animate-pulse">▍</span>
              )}
            </div>
          </div>
        ))}
      </section>

      {error && (
        <div className="rounded border border-red-500 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              send()
            }
          }}
          placeholder="Ctrl/Cmd + Enter 发送"
          rows={3}
          disabled={streaming}
          className="flex-1 resize-none rounded border border-zinc-800 bg-zinc-950 p-2 text-sm text-zinc-100 disabled:opacity-50"
        />
        <div className="flex flex-col gap-2">
          <button
            onClick={send}
            disabled={streaming || !input.trim()}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            发送
          </button>
          <button
            onClick={stop}
            disabled={!streaming}
            className="rounded bg-zinc-700 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-600 disabled:opacity-30"
          >
            中断
          </button>
          <button
            onClick={reset}
            className="rounded border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            清空
          </button>
        </div>
      </div>
    </main>
  )
}
