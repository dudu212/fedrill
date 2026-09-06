import type {
  ProviderChunk,
  ProviderMessage,
  ProviderToolCall,
  ProviderToolSpec,
} from '@/lib/llm/types'
import { deepseekStream } from '@/lib/llm/deepseek'
import { getApiKey } from '@/lib/settings/api-key'
import { executeRunTests, runTestsToolSpec } from './tools/run-tests'

/**
 * Agent Loop v1 · Phase 1a 心脏
 *
 * 客户端 ReAct 循环（见 ADR-011）：
 *  1. POST 到 /api/agent/step，服务端调 LLM 后 SSE 流回 chunks
 *  2. 边收 chunk 边构造 assistant 消息（累加 text_delta / 收集 tool_call）
 *  3. 一轮 SSE 结束 → 若 assistant 消息里有 tool_call：本地执行 → 结果塞回 messages → 回到步骤 1
 *  4. 若无 tool_call：结束
 *
 * 硬约束：
 * - MAX_ITERATIONS = 10（Anthropic 官方经验值，防无限循环）
 * - AbortSignal 端到端（透传到 fetch + 每步循环开头检查）
 * - tool 执行失败不 throw，包装成 {success:false,error} 让 LLM 有机会自我纠正
 *
 * 设计参考 docs/learning/tool-use-and-react.md §三 · ReAct 模式。
 */

/** 最大 ReAct 迭代数。超出即强制终止防死循环 */
export const MAX_ITERATIONS = 10

/** 服务端 SSE endpoint（POST），无状态 LLM 代理 */
const AGENT_STEP_ENDPOINT = '/api/agent/step'

// ────────────────────────────────────────────────────────────
// 对外事件类型 —— UI 通过 for-await 消费
// ────────────────────────────────────────────────────────────

/**
 * Agent Loop 逐 chunk 吐给 UI 的事件。
 *
 * - `text_delta`：AI 正在说话的一小段。UI 追加到当前 assistant 气泡的 content。
 * - `tool_call`：AI 决定调用工具。UI 显示"loading 卡片"（"AI 正在跑 run_tests…"）。
 * - `tool_result`：工具执行完，结果附给对应 callId 的卡片。UI 展开显示。
 * - `done`：整条 loop 结束。iterations 表示实际转了几轮，reason 说明为啥停。
 * - `error`：网络或服务端异常。UI 显示错误消息。中断（signal.abort）不走这里，而是抛 AbortError。
 */
export type AgentEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_call'; call: ProviderToolCall }
  | { type: 'tool_result'; callId: string; result: unknown }
  | { type: 'done'; iterations: number; reason: 'stop' | 'max_iter' }
  | { type: 'error'; error: string }

export interface RunAgentOptions {
  /** 当前题目 id · tool 执行体从 session 读 code 时要用 */
  problemId: string
  /** 起始消息数组（含 system prompt + 用户历史）· 内部会克隆一份不改原引用 */
  initialMessages: ProviderMessage[]
  /** 端到端可断 · 透传到 fetch 和每步循环开头 */
  signal?: AbortSignal
}

// ────────────────────────────────────────────────────────────
// 主循环
// ────────────────────────────────────────────────────────────

export async function* runAgentLoop(
  opts: RunAgentOptions,
): AsyncGenerator<AgentEvent> {
  const messages: ProviderMessage[] = [...opts.initialMessages]
  const tools: ProviderToolSpec[] = [runTestsToolSpec]

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    throwIfAborted(opts.signal)

    // 本轮 assistant 消息的累加器
    let contentBuf = ''
    const toolCallsBuf: ProviderToolCall[] = []

    // 调服务端 · 消费 SSE
    try {
      for await (const chunk of fetchAgentStep({
        messages,
        tools,
        signal: opts.signal,
      })) {
        throwIfAborted(opts.signal)

        if (chunk.type === 'text_delta') {
          contentBuf += chunk.delta
          yield chunk
        } else if (chunk.type === 'tool_call') {
          toolCallsBuf.push(chunk.call)
          yield chunk
        }
        // 'done' chunk：内部记 finishReason 但不外发（外部只关心 loop 层的 done）
      }
    } catch (err) {
      if (isAbortError(err)) throw err
      yield {
        type: 'error',
        error: err instanceof Error ? err.message : String(err),
      }
      return
    }

    // 拼装本轮 assistant 消息，push 进 history
    const assistantMsg: ProviderMessage = {
      role: 'assistant',
      content: contentBuf,
    }
    if (toolCallsBuf.length > 0) {
      assistantMsg.toolCalls = toolCallsBuf
    }
    messages.push(assistantMsg)

    // 没 tool_call 表示 LLM 已经给出最终回答 —— loop 正常结束
    if (toolCallsBuf.length === 0) {
      yield { type: 'done', iterations: iter + 1, reason: 'stop' }
      return
    }

    // 逐个执行 tool_call（M2a 只串行；M2b 若加多 tool 再考虑 Promise.all 并发）
    for (const call of toolCallsBuf) {
      throwIfAborted(opts.signal)

      const result = await executeTool(call.name, opts.problemId)

      messages.push({
        role: 'tool',
        content: JSON.stringify(result),
        toolCallId: call.id,
      })

      yield { type: 'tool_result', callId: call.id, result }
    }

    // 回到循环开头继续追问 LLM
  }

  // 用完 MAX_ITERATIONS 还没跳出 —— 说明 LLM 陷入循环，护栏兜底
  yield { type: 'done', iterations: MAX_ITERATIONS, reason: 'max_iter' }
}

// ────────────────────────────────────────────────────────────
// Tool 分发（M2a 只有一个 tool，直接 if；M2b+ 换成 registry map）
// ────────────────────────────────────────────────────────────

async function executeTool(
  name: string,
  problemId: string,
): Promise<unknown> {
  if (name === 'run_tests') {
    return await executeRunTests(problemId)
  }
  // 未知 tool 名 —— 不 throw，返回结构化错误让 LLM 自我纠正
  return {
    success: false,
    error: `Unknown tool: ${name}`,
  }
}

// ────────────────────────────────────────────────────────────
// SSE 消费 · 客户端读 /api/agent/step 的流
// ────────────────────────────────────────────────────────────

interface FetchAgentStepOpts {
  messages: ProviderMessage[]
  tools: ProviderToolSpec[]
  signal?: AbortSignal
}

/**
 * 消费 /api/agent/step 的 SSE 流，逐 chunk yield 出 ProviderChunk。
 *
 * 服务端 wire 格式（每条事件独立一行 JSON）：
 *   data: {"type":"text_delta","delta":"..."}
 *   data: {"type":"tool_call","call":{...}}
 *   data: {"type":"done","finishReason":"..."}
 *   data: [DONE]
 */
async function* fetchAgentStep(
  opts: FetchAgentStepOpts,
): AsyncGenerator<ProviderChunk> {
  // BYOK · 客户端有 key → 直接调 DeepSeek(浏览器 CORS 通),
  // 请求完全不经过我们的服务器,key 永不落地。
  const apiKey = getApiKey()
  if (apiKey) {
    yield* deepseekStream({
      messages: opts.messages,
      tools: opts.tools,
      signal: opts.signal,
      apiKey,
    })
    return
  }

  // 回退 · 没有 BYOK key(通常是本地 dev 用 .env.local)· 走服务端代理
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  const res = await fetch(AGENT_STEP_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ messages: opts.messages, tools: opts.tools }),
    signal: opts.signal,
  })

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => '')
    throw new Error(`agent/step ${res.status}: ${errText}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

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
          if (payload === '[DONE]') return
          try {
            yield JSON.parse(payload) as ProviderChunk
          } catch {
            // keepalive / 半截 JSON，忽略
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

// ────────────────────────────────────────────────────────────
// 小工具
// ────────────────────────────────────────────────────────────

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}
