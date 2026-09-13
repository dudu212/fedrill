import { describe, it, expect } from 'vitest'
import { buildSocraticSystemPrompt } from './socratic-prompt'
import type { AlgorithmProblem } from '@/lib/types/problem'

const bubbleSort: AlgorithmProblem = {
  id: 'bubble-sort',
  type: 'algorithm',
  title: '冒泡排序',
  difficulty: 'easy',
  tags: ['排序', '数组'],
  description: '## 要求\n\n实现 bubbleSort',
  requiredAPI: 'bubbleSort',
  starterCode: 'function bubbleSort(arr) {\n  // 你的实现\n}',
  testCases: [{ name: '乱序', input: [[3, 1, 2]], expected: [1, 2, 3] }],
  timeLimit: 1000,
  memoryLimit: 256,
  hintLevels: ['第 1 层提示', '第 2 层提示', '第 3 层提示'],
  visualizationType: 'array',
}

describe('buildSocraticSystemPrompt', () => {
  it('包含题目、函数名和分层提示', () => {
    const prompt = buildSocraticSystemPrompt(bubbleSort, { problemId: 'bubble-sort' })
    expect(prompt).toContain('冒泡排序')
    expect(prompt).toContain('bubbleSort')
    expect(prompt).toContain('第 1 层提示')
    expect(prompt).toContain('第 3 层提示')
  })

  it('强调「不给答案」的硬性禁止', () => {
    const prompt = buildSocraticSystemPrompt(bubbleSort, { problemId: 'bubble-sort' })
    expect(prompt).toContain('绝不给出完整实现')
    expect(prompt).toContain('一次只揭示一层提示')
  })

  it('注入用户代码和测试结果', () => {
    const prompt = buildSocraticSystemPrompt(bubbleSort, {
      problemId: 'bubble-sort',
      code: 'function bubbleSort(arr) { return arr }',
      testResults: {
        results: [{ name: '乱序', input: [[3, 1, 2]], expected: [1, 2, 3], actual: [3, 1, 2], passed: false, durationMs: 1 }],
        totalDurationMs: 1,
      },
    })
    expect(prompt).toContain('function bubbleSort(arr) { return arr }')
    expect(prompt).toContain('0/1 通过')
  })

  it('标注已揭示提示层数', () => {
    const prompt = buildSocraticSystemPrompt(bubbleSort, {
      problemId: 'bubble-sort',
      hintLevelRevealed: 1,
    })
    expect(prompt).toContain('已揭示提示层数：1 / 3')
  })
})
