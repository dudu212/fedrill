import type {
  ProviderChunk,
  ProviderMessage,
  ProviderToolCall,
  ProviderToolSpec,
  StreamOptions,
} from './types'

/**
 * DeepSeek Provider 实现（OpenAI 兼容协议）。
 *
 * 关键实现点：
 * 1. 手写 SSE 解析（\n\n 分帧、data: 前缀、[DONE] 终止）——与 app/api/chat/route.ts
 *    的实现思路一致，见 docs/learning/sse-under-the-hood.md
 * 2. tool_call 流式分片拼装——DeepSeek 会把 function.arguments 拆成多个 delta 送来，
 *    按 tool_calls[].index 累加，[DONE] 前 flush 出完整版
 * 3. args JSON.parse 藏在 adapter 里，上层拿到直接是对象
 *
 * ADR-002 记录了"为什么手写而不用 SDK"。
 */

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions'
const DEFAULT_MODEL = 'deepseek-chat'
const DEFAULT_TEMPERATURE = 0.3

// DeepSeek wire format 的最小类型（不覆盖所有字段，只挑我们用得到的）
interface DeepSeekStreamFrame {
  choices?: Array<{
    delta?: {
      content?: string
      tool_calls?: Array<{
        index?: number
        id?: string
        type?: string
        function?: { name?: string; arguments?: string }
      }>
    }
    finish_reason?: string | null
  }>
}

interface PendingToolCall {
  id: string
  name: string
  argsStr: string
}

export async function* deepseekStream(
  opts: StreamOptions,
): AsyncGenerator<ProviderChunk> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY missing in env')
  }

  const body: Record<string, unknown> = {
    model: opts.model ?? DEFAULT_MODEL,
    messages: opts.messages.map(toDeepSeekMessage),
    temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
    stream: true,
  }
  if (opts.tools && opts.tools.length > 0) {
    body.tools = opts.tools.map(toDeepSeekTool)
  }

  const upstream = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  })

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => '')
    throw new Error(`DeepSeek upstream ${upstream.status}: ${errText}`)
  }

  const reader = upstream.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  // key: DeepSeek 的 tool_calls[].index，多个 tool_call 并发时能区分
  const pending = new Map<number, PendingToolCall>()
  let finishReason: string | null = null

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const events = buffer.split('\n\n')
      buffer = events.pop() ?? ''

      for (const event of events) {
        for (const line of event.split('\n')) {
          if (!line.startsWith('data:')) continue
          const payload = line.slice(5).trim()

          if (payload === '[DONE]') {
            // 流末端：把累积的 tool_call 组装成完整版 yield 出去
            yield* flushPendingCalls(pending)
            yield { type: 'done', finishReason }
            return
          }

          let frame: DeepSeekStreamFrame
          try {
            frame = JSON.parse(payload) as DeepSeekStreamFrame
          } catch {
            // keepalive / 半截 JSON —— 忽略
            continue
          }

          const choice = frame.choices?.[0]
          if (!choice) continue
          if (choice.finish_reason) finishReason = choice.finish_reason

          const delta = choice.delta
          if (!delta) continue

          // 文本 delta —— 立即 yield
          if (typeof delta.content === 'string' && delta.content.length > 0) {
            yield { type: 'text_delta', delta: delta.content }
          }

          // tool_call delta —— 按 index 累积，不立即 yield
          if (Array.isArray(delta.tool_calls)) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0
              const cur = pending.get(idx) ?? { id: '', name: '', argsStr: '' }
              if (tc.id) cur.id = tc.id
              if (tc.function?.name) cur.name = tc.function.name
              if (tc.function?.arguments) cur.argsStr += tc.function.arguments
              pending.set(idx, cur)
            }
          }
        }
      }
    }

    // 上游异常关流没送 [DONE]，兜底 flush
    yield* flushPendingCalls(pending)
    yield { type: 'done', finishReason }
  } finally {
    // 无论正常/异常，释放 reader（避免 ReadableStream 泄漏）
    reader.releaseLock()
  }
}

/**
 * 累积完的 tool_call → 完整 ProviderToolCall。args 解析放在这里，
 * 上层只看到对象。
 */
function* flushPendingCalls(
  pending: Map<number, PendingToolCall>,
): Generator<ProviderChunk> {
  // 按 index 顺序 yield，保持稳定
  const indices = Array.from(pending.keys()).sort((a, b) => a - b)
  for (const idx of indices) {
    const p = pending.get(idx)!
    if (!p.id || !p.name) continue // 半成品，跳过
    const call: ProviderToolCall = {
      id: p.id,
      name: p.name,
      args: safeJsonParse(p.argsStr),
    }
    yield { type: 'tool_call', call }
  }
  pending.clear()
}

function safeJsonParse(s: string): unknown {
  if (!s) return {}
  try {
    return JSON.parse(s)
  } catch {
    // LLM 有时会在 arguments 里塞非法 JSON。返回 __raw 让上层能看到，
    // 而不是抛错炸掉整个 stream。
    return { __unparseable: s }
  }
}

/**
 * ProviderMessage → DeepSeek wire message.
 * DeepSeek 用 OpenAI 兼容 role='tool' + tool_call_id 引用。
 */
function toDeepSeekMessage(m: ProviderMessage): Record<string, unknown> {
  if (m.role === 'tool') {
    return {
      role: 'tool',
      content: m.content,
      tool_call_id: m.toolCallId ?? '',
    }
  }
  if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
    return {
      role: 'assistant',
      content: m.content,
      tool_calls: m.toolCalls.map((c) => ({
        id: c.id,
        type: 'function',
        function: {
          name: c.name,
          arguments: JSON.stringify(c.args ?? {}),
        },
      })),
    }
  }
  return { role: m.role, content: m.content }
}

function toDeepSeekTool(t: ProviderToolSpec): Record<string, unknown> {
  return {
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }
}
