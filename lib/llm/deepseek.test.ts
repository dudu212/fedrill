import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { deepseekStream } from './deepseek'
import type { ProviderChunk } from './types'

// ────────────────────────────────────────
// 小工具
// ────────────────────────────────────────

async function collect(
  gen: AsyncGenerator<ProviderChunk>,
): Promise<ProviderChunk[]> {
  const out: ProviderChunk[] = []
  for await (const c of gen) out.push(c)
  return out
}

/**
 * 构造 SSE 响应体:每帧一段编码后塞进 ReadableStream。
 * 使用真 Response + ReadableStream,让 deepseek.ts 里的 reader 逻辑走真实分支。
 */
function mkSSE(...frames: string[]): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      for (const f of frames) controller.enqueue(encoder.encode(f))
      controller.close()
    },
  })
  return new Response(stream, { status: 200 })
}

/** DeepSeek wire 帧包成 SSE `data: ...\n\n` */
function sseFrame(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

// ────────────────────────────────────────
// API Key 处理
// ────────────────────────────────────────

describe('deepseekStream · API Key 处理', () => {
  beforeEach(() => {
    delete process.env.DEEPSEEK_API_KEY
    vi.restoreAllMocks()
  })

  afterEach(() => {
    delete process.env.DEEPSEEK_API_KEY
  })

  it('无 apiKey 且无 env · 抛 DEEPSEEK_API_KEY missing', async () => {
    const gen = deepseekStream({
      messages: [{ role: 'user', content: 'hi' }],
    })
    await expect(collect(gen)).rejects.toThrow(/DEEPSEEK_API_KEY missing/)
  })

  it('opts.apiKey 优先于 env(BYOK 场景)', async () => {
    process.env.DEEPSEEK_API_KEY = 'env-key'
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(mkSSE('data: [DONE]\n\n'))

    await collect(
      deepseekStream({
        messages: [{ role: 'user', content: 'hi' }],
        apiKey: 'byok-key',
      }),
    )

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer byok-key')
  })
})

// ────────────────────────────────────────
// SSE 流解析
// ────────────────────────────────────────

describe('deepseekStream · 流解析', () => {
  beforeEach(() => {
    process.env.DEEPSEEK_API_KEY = 'test-key'
    vi.restoreAllMocks()
  })

  afterEach(() => {
    delete process.env.DEEPSEEK_API_KEY
  })

  it('上游 4xx · 抛错含 status', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('bad request', { status: 401 }),
    )
    const gen = deepseekStream({
      messages: [{ role: 'user', content: 'hi' }],
    })
    await expect(collect(gen)).rejects.toThrow(/DeepSeek upstream 401/)
  })

  it('text_delta 逐帧流出 · 顺序保持', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      mkSSE(
        sseFrame({ choices: [{ delta: { content: '你' } }] }),
        sseFrame({ choices: [{ delta: { content: '好' } }] }),
        sseFrame({ choices: [{ delta: { content: '世界' } }] }),
        'data: [DONE]\n\n',
      ),
    )

    const chunks = await collect(
      deepseekStream({ messages: [{ role: 'user', content: 'hi' }] }),
    )
    const deltas = chunks
      .filter(
        (c): c is Extract<ProviderChunk, { type: 'text_delta' }> =>
          c.type === 'text_delta',
      )
      .map((c) => c.delta)
    expect(deltas).toEqual(['你', '好', '世界'])
  })

  it('tool_call 分片累加 · [DONE] 前 flush 出完整消息', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      mkSSE(
        // 分 3 帧发同一个 tool_call(index=0)
        sseFrame({
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: 'call_1',
                    function: { name: 'run_tests' },
                  },
                ],
              },
            },
          ],
        }),
        sseFrame({
          choices: [
            {
              delta: {
                tool_calls: [
                  { index: 0, function: { arguments: '{"pr' } },
                ],
              },
            },
          ],
        }),
        sseFrame({
          choices: [
            {
              delta: {
                tool_calls: [
                  { index: 0, function: { arguments: 'oblemId":"a"}' } },
                ],
              },
            },
          ],
        }),
        'data: [DONE]\n\n',
      ),
    )

    const chunks = await collect(
      deepseekStream({ messages: [{ role: 'user', content: 'hi' }] }),
    )
    const toolCalls = chunks.filter(
      (c): c is Extract<ProviderChunk, { type: 'tool_call' }> =>
        c.type === 'tool_call',
    )
    expect(toolCalls).toHaveLength(1)
    expect(toolCalls[0].call).toEqual({
      id: 'call_1',
      name: 'run_tests',
      args: { problemId: 'a' },
    })
  })

  it('args 非法 JSON · 返回 { __unparseable } 兜底不 throw', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      mkSSE(
        sseFrame({
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: 'c1',
                    function: { name: 't', arguments: '{not-json}' },
                  },
                ],
              },
            },
          ],
        }),
        'data: [DONE]\n\n',
      ),
    )

    const chunks = await collect(
      deepseekStream({ messages: [{ role: 'user', content: 'hi' }] }),
    )
    const call = chunks.find(
      (c): c is Extract<ProviderChunk, { type: 'tool_call' }> =>
        c.type === 'tool_call',
    )
    expect(call?.call.args).toEqual({ __unparseable: '{not-json}' })
  })

  it('流被截断没送 [DONE] · 兜底 flush pending 不丢 tool_call', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      mkSSE(
        sseFrame({
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: 'c-early',
                    function: { name: 't', arguments: '{}' },
                  },
                ],
              },
            },
          ],
        }),
        // 没送 [DONE] · stream 直接 close
      ),
    )

    const chunks = await collect(
      deepseekStream({ messages: [{ role: 'user', content: 'hi' }] }),
    )
    const call = chunks.find(
      (c): c is Extract<ProviderChunk, { type: 'tool_call' }> =>
        c.type === 'tool_call',
    )
    expect(call).toBeDefined()
    expect(call?.call.id).toBe('c-early')
  })

  it('done chunk 携带 finishReason', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      mkSSE(
        sseFrame({
          choices: [
            { delta: { content: 'hi' }, finish_reason: 'stop' },
          ],
        }),
        'data: [DONE]\n\n',
      ),
    )

    const chunks = await collect(
      deepseekStream({ messages: [{ role: 'user', content: 'hi' }] }),
    )
    const done = chunks.find(
      (c): c is Extract<ProviderChunk, { type: 'done' }> => c.type === 'done',
    )
    expect(done).toEqual({ type: 'done', finishReason: 'stop' })
  })
})
