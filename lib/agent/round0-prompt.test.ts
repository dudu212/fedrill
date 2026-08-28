import { describe, it, expect } from 'vitest'
import { summarizeTestResults } from './round0-prompt'
import type { SandboxRunResult } from '@/lib/sandbox/types'

describe('summarizeTestResults', () => {
  it('未跑测试：返回明确的占位文本', () => {
    expect(summarizeTestResults(null)).toBe('（尚未运行测试）')
    expect(summarizeTestResults(undefined)).toBe('（尚未运行测试）')
  })

  it('全部通过：包含 ✅ 与总数与耗时', () => {
    const res: SandboxRunResult = {
      totalDurationMs: 42,
      results: [
        {
          name: '基础对象',
          passed: true,
          input: [{ a: 1 }],
          expected: { a: 1 },
          actual: { a: 1 },
          durationMs: 12,
        },
        {
          name: '嵌套',
          passed: true,
          input: [{ x: { y: 2 } }],
          expected: { x: { y: 2 } },
          actual: { x: { y: 2 } },
          durationMs: 30,
        },
      ],
    }
    const summary = summarizeTestResults(res)
    expect(summary).toContain('✅')
    expect(summary).toContain('全部 2 个')
    expect(summary).toContain('42ms')
  })

  describe('部分挂：反幻觉的关键字段必须齐全', () => {
    const res: SandboxRunResult = {
      totalDurationMs: 15,
      results: [
        {
          name: 'this 是对象',
          passed: false,
          input: [{ __fn: 'function(){}' }, { x: 10 }],
          expected: 11,
          actual: undefined,
          durationMs: 5,
        },
        {
          name: '抛异常',
          passed: false,
          input: [null],
          expected: 0,
          error: "Cannot read property 'call' of null",
          durationMs: 3,
        },
        {
          name: '通过的用例（不应在摘要里出现）',
          passed: true,
          input: [1, 2],
          expected: 3,
          actual: 3,
          durationMs: 2,
        },
      ],
    }
    const summary = summarizeTestResults(res)

    it('总体字段：❌ 与 通过数/总数', () => {
      expect(summary).toContain('❌')
      expect(summary).toContain('1/3 通过')
    })

    it('失败用例名必列', () => {
      expect(summary).toContain('this 是对象')
      expect(summary).toContain('抛异常')
    })

    it('失败用例的 input 字段必须出现（曾经的坑：只有 expected/actual 会导致 AI 猜输入）', () => {
      expect(summary).toContain('输入')
      // Verify actual value serialization
      expect(summary).toMatch(/输入.*__fn/)
    })

    it('运行错误分支：包含 error 消息', () => {
      expect(summary).toContain('运行错误')
      expect(summary).toContain("Cannot read property 'call' of null")
    })

    it('通过的用例不列在失败摘要里（压缩 prompt 长度）', () => {
      expect(summary).not.toContain('通过的用例（不应在摘要里出现）')
    })

    it('包含期望/实际（非 error 分支）', () => {
      expect(summary).toContain('期望 11')
      expect(summary).toContain('实际')
    })
  })
})
