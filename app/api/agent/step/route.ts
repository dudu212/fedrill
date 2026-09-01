import { deepseekStream } from '@/lib/llm/deepseek'
import type { ProviderMessage, ProviderToolSpec } from '@/lib/llm/types'

/**
 * POST /api/agent/step · 无状态 LLM 代理（见 ADR-011）
 *
 * 契约：
 *   入： { messages: ProviderMessage[], tools?: ProviderToolSpec[],
 *          temperature?: number, model?: string }
 *   出： text/event-stream · 每帧 `data: <JSON of ProviderChunk>\n\n`
 *        结束时 `data: [DONE]\n\n`
 *
 * 这个路由本身不管 loop / 不管 session / 不管 tool 执行 ——
 * 只是把客户端传来的 messages+tools 转发给 DeepSeek，再把上游流回来的
 * ProviderChunk 逐条 JSON.stringify 后作为 SSE 事件流回客户端。
 *
 * AbortSignal 端到端：request.signal 透传给 deepseekStream 内部的 fetch。
 * 客户端 fetch 被 abort → 上游 DeepSeek 请求立即中止 → 上游立即停止计费。
 */

interface AgentStepBody {
  messages: ProviderMessage[]
  tools?: ProviderToolSpec[]
  temperature?: number
  model?: string
}

export async function POST(request: Request) {
  let body: AgentStepBody
  try {
    body = await request.json()
  } catch {
    return new Response('Invalid JSON body', { status: 400 })
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return new Response('messages must be a non-empty array', { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const chunks = deepseekStream({
          messages: body.messages,
          tools: body.tools,
          temperature: body.temperature,
          model: body.model,
          signal: request.signal,
        })
        for await (const chunk of chunks) {
          const payload = `data: ${JSON.stringify(chunk)}\n\n`
          controller.enqueue(encoder.encode(payload))
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (err) {
        // 客户端 abort 走这里（fetch 抛 AbortError）；DeepSeek 上游故障也走这里
        // Best-effort：如果 controller 还没关，塞一条 error chunk 给客户端 UI
        const msg = err instanceof Error ? err.message : String(err)
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'error', error: msg })}\n\n`,
            ),
          )
          controller.close()
        } catch {
          // controller 已被 abort 关掉，静默即可
        }
      }
    },
    cancel() {
      // 客户端主动断开 · ReadableStream 自动清理，无需额外操作
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}
