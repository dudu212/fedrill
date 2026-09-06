import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ProviderChunk } from '@/lib/llm/types'

// vi.mock 会被 hoist 到文件顶部,放这里只为可读性
vi.mock('@/lib/settings/api-key', () => ({
  getApiKey: vi.fn(() => null),
}))
vi.mock('@/lib/llm/deepseek', () => ({
  deepseekStream: vi.fn(),
}))
vi.mock('./tools/run-tests', () => ({
  executeRunTests: vi.fn(),
  runTestsToolSpec: {
    name: 'run_tests',
    description: 'test spec',
    parameters: {},
  },
}))

import { runAgentLoop, MAX_ITERATIONS, type AgentEvent } from './loop'
import { getApiKey } from '@/lib/settings/api-key'
import { deepseekStream } from '@/lib/llm/deepseek'
import { executeRunTests } from './tools/run-tests'

// ────────────────────────────────────────
// 小工具
// ────────────────────────────────────────

async function* mkStream(
  chunks: ProviderChunk[],
): AsyncGenerator<ProviderChunk> {
  for (const c of chunks) yield c
}

async function collect(
  gen: AsyncGenerator<AgentEvent>,
): Promise<AgentEvent[]> {
  const out: AgentEvent[] = []
  for await (const e of gen) out.push(e)
  return out
}

// ────────────────────────────────────────
// 基本状态机流转
// ────────────────────────────────────────

describe('runAgentLoop · 状态机基本流转', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 默认走 BYOK 路径(有 key),避免 mock fetch
    vi.mocked(getApiKey).mockReturnValue('sk-test')
  })

  it('无 tool_call · 一轮结束 · done stop iterations=1', async () => {
    vi.mocked(deepseekStream).mockImplementation(() =>
      mkStream([
        { type: 'text_delta', delta: 'Hello ' },
        { type: 'text_delta', delta: 'world' },
        { type: 'done', finishReason: 'stop' },
      ]),
    )

    const events = await collect(
      runAgentLoop({ problemId: 'p1', initialMessages: [] }),
    )

    const done = events.find((e) => e.type === 'done')
    expect(done).toEqual({ type: 'done', iterations: 1, reason: 'stop' })

    const deltas = events
      .filter((e): e is Extract<AgentEvent, { type: 'text_delta' }> =>
        e.type === 'text_delta',
      )
      .map((e) => e.delta)
    expect(deltas.join('')).toBe('Hello world')
  })

  it('一次 tool_call · 二轮结束 · tool_result 事件带正确 callId', async () => {
    let call = 0
    vi.mocked(deepseekStream).mockImplementation(() => {
      call++
      if (call === 1) {
        return mkStream([
          {
            type: 'tool_call',
            call: { id: 'c1', name: 'run_tests', args: {} },
          },
          { type: 'done', finishReason: 'tool_calls' },
        ])
      }
      return mkStream([
        { type: 'text_delta', delta: 'Done' },
        { type: 'done', finishReason: 'stop' },
      ])
    })
    vi.mocked(executeRunTests).mockResolvedValue({ success: true, results: [] })

    const events = await collect(
      runAgentLoop({ problemId: 'p1', initialMessages: [] }),
    )

    const toolResult = events.find((e) => e.type === 'tool_result')
    const done = events.find((e) => e.type === 'done')

    expect(toolResult).toMatchObject({ type: 'tool_result', callId: 'c1' })
    expect(done).toEqual({ type: 'done', iterations: 2, reason: 'stop' })
    expect(executeRunTests).toHaveBeenCalledWith('p1')
  })

  it('无限 tool_call · MAX_ITERATIONS 熔断 · reason=max_iter', async () => {
    vi.mocked(deepseekStream).mockImplementation(() =>
      mkStream([
        {
          type: 'tool_call',
          call: { id: 'c-loop', name: 'run_tests', args: {} },
        },
        { type: 'done', finishReason: 'tool_calls' },
      ]),
    )
    vi.mocked(executeRunTests).mockResolvedValue({ success: true })

    const events = await collect(
      runAgentLoop({ problemId: 'p1', initialMessages: [] }),
    )

    const done = events.find((e) => e.type === 'done')
    expect(done).toEqual({
      type: 'done',
      iterations: MAX_ITERATIONS,
      reason: 'max_iter',
    })
  })

  it('未知 tool 名 · 返回 error 结构不 throw · loop 正常继续', async () => {
    let call = 0
    vi.mocked(deepseekStream).mockImplementation(() => {
      call++
      if (call === 1) {
        return mkStream([
          {
            type: 'tool_call',
            call: { id: 'c-x', name: 'nonexistent_tool', args: {} },
          },
          { type: 'done', finishReason: 'tool_calls' },
        ])
      }
      return mkStream([{ type: 'done', finishReason: 'stop' }])
    })

    const events = await collect(
      runAgentLoop({ problemId: 'p1', initialMessages: [] }),
    )

    const toolResult = events.find((e) => e.type === 'tool_result')
    expect(toolResult?.result).toMatchObject({
      success: false,
      error: expect.stringContaining('Unknown tool'),
    })
    // executeRunTests 不该被调用(名字不匹配)
    expect(executeRunTests).not.toHaveBeenCalled()
  })
})

// ────────────────────────────────────────
// AbortSignal
// ────────────────────────────────────────

describe('runAgentLoop · AbortSignal 传递', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getApiKey).mockReturnValue('sk-test')
  })

  it('signal 已 aborted · 立即抛 AbortError · 不 yield done', async () => {
    const controller = new AbortController()
    controller.abort()

    const gen = runAgentLoop({
      problemId: 'p1',
      initialMessages: [],
      signal: controller.signal,
    })

    await expect(collect(gen)).rejects.toThrow(/abort/i)
  })
})

// ────────────────────────────────────────
// 上游错误
// ────────────────────────────────────────

describe('runAgentLoop · 上游错误', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getApiKey).mockReturnValue('sk-test')
  })

  it('deepseekStream 抛非 abort 错误 · yield error 事件后 return · 无 done', async () => {
    vi.mocked(deepseekStream).mockImplementation(() => {
      async function* boom(): AsyncGenerator<ProviderChunk> {
        throw new Error('network fail')
      }
      return boom()
    })

    const events = await collect(
      runAgentLoop({ problemId: 'p1', initialMessages: [] }),
    )

    const errEvt = events.find((e) => e.type === 'error')
    expect(errEvt).toEqual({ type: 'error', error: 'network fail' })
    expect(events.find((e) => e.type === 'done')).toBeUndefined()
  })
})

// ────────────────────────────────────────
// BYOK 分支
// ────────────────────────────────────────

describe('runAgentLoop · BYOK 分支路由', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('有 API Key · 走 deepseekStream · apiKey 透传 · fetch 未调', async () => {
    vi.mocked(getApiKey).mockReturnValue('sk-user-byok')
    vi.mocked(deepseekStream).mockImplementation(() =>
      mkStream([{ type: 'done', finishReason: 'stop' }]),
    )
    const fetchSpy = vi.spyOn(global, 'fetch')

    await collect(runAgentLoop({ problemId: 'p1', initialMessages: [] }))

    expect(deepseekStream).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'sk-user-byok' }),
    )
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('无 API Key · 走 fetch(/api/agent/step) · deepseekStream 未调', async () => {
    vi.mocked(getApiKey).mockReturnValue(null)

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'data: {"type":"done","finishReason":"stop"}\n\n',
          ),
        )
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(stream, { status: 200 }))

    await collect(runAgentLoop({ problemId: 'p1', initialMessages: [] }))

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/agent/step',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(deepseekStream).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})
