import type { ChatMessage } from '@/lib/types/problem'
import {
  buildRound0SystemPrompt,
  type ChatContext,
} from '@/lib/agent/round0-prompt'
import { getProblem } from '@/data/problems'

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions'

type WireMessage = Pick<ChatMessage, 'role' | 'content'>

type IncomingBody = {
  messages: WireMessage[]
  context?: ChatContext
  model?: string
  temperature?: number
}

function withSystemPrompt(
  messages: WireMessage[],
  systemPrompt: string,
): WireMessage[] {
  const rest = messages.filter((m) => m.role !== 'system')
  return [{ role: 'system', content: systemPrompt }, ...rest]
}

export async function POST(request: Request) {
  let body: IncomingBody
  try {
    body = await request.json()
  } catch {
    return new Response('Invalid JSON body', { status: 400 })
  }

  let { messages } = body
  const { context, model = 'deepseek-chat', temperature = 0.3 } = body
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response('messages must be a non-empty array', { status: 400 })
  }

  if (context?.problemId) {
    const problem = getProblem(context.problemId)
    if (!problem) {
      return new Response(`unknown problem: ${context.problemId}`, { status: 400 })
    }
    const systemPrompt = buildRound0SystemPrompt(problem, context)
    messages = withSystemPrompt(messages, systemPrompt)
  }

  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    return new Response('DEEPSEEK_API_KEY missing in env', { status: 500 })
  }

  const upstream = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, temperature, stream: true }),
    signal: request.signal,
  })

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => '')
    return new Response(`Upstream ${upstream.status}: ${text}`, { status: 502 })
  }

  const decoder = new TextDecoder()
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body!.getReader()
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
              if (payload === '[DONE]') {
                controller.close()
                return
              }
              try {
                const json = JSON.parse(payload) as {
                  choices?: { delta?: { content?: string } }[]
                }
                const chunk = json.choices?.[0]?.delta?.content
                if (chunk) controller.enqueue(encoder.encode(chunk))
              } catch {
                // skip keepalive comments / malformed frames
              }
            }
          }
        }
        controller.close()
      } catch (err) {
        controller.error(err)
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}
