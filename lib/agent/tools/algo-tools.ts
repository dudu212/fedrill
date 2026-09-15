import type { ProviderToolSpec } from '@/lib/llm/types'
import { runInSandbox } from '@/lib/sandbox/runner'
import { getAlgoProblem } from '@/data/algo'

/**
 * 算法题的 tool 集（M3）。
 *
 * 和手撕题 run_tests 的区别：算法题 code 在页面 state 里（不在 SessionRepo），
 * 所以执行体用闭包注入当前 code；visualize 是算法题独有的「触发动画」tool。
 */

export const algoRunTestsToolSpec: ProviderToolSpec = {
  name: 'run_tests',
  description:
    '运行用户当前编辑器里的算法代码，对该题的基础测试用例逐个执行。' +
    '返回每条用例的通过/失败、期望值、实际值、错误消息。' +
    '当你想验证用户代码是否正确、或想指出具体哪条用例挂了时调用。无需参数。',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
  },
}

export const visualizeToolSpec: ProviderToolSpec = {
  name: 'visualize',
  description:
    '触发该算法题的过程可视化动画（参考轨迹，展示标准解法如何一步步执行）。' +
    '当你想让用户直观看到算法的执行过程时调用。无需参数。',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
  },
}

/** 算法版 run_tests 执行体：code 由调用方闭包注入 */
export async function executeAlgoRunTests(
  problemId: string,
  code: string,
): Promise<Record<string, unknown>> {
  const problem = getAlgoProblem(problemId)
  if (!problem) return { success: false, error: `未知题目: ${problemId}` }
  if (!code.trim()) return { success: false, error: '用户尚未在编辑器里写任何代码' }

  try {
    const res = await runInSandbox(code, problem.requiredAPI, problem.testCases, {
      timeoutMs: problem.timeLimit,
    })
    const passCount = res.results.filter((r) => r.passed).length
    const total = res.results.length
    const failed = res.results
      .filter((r) => !r.passed)
      .map((r) => ({
        name: r.name,
        input: r.input,
        expected: r.expected,
        actual: r.actual,
        error: r.error,
      }))
    return {
      success: true,
      passCount,
      total,
      allPassed: passCount === total && total > 0,
      failed,
      durationMs: res.totalDurationMs,
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** visualize 执行体：返回可视化类型，UI 侧据此触发动画 */
export async function executeVisualize(
  problemId: string,
): Promise<Record<string, unknown>> {
  const problem = getAlgoProblem(problemId)
  if (!problem) return { success: false, error: `未知题目: ${problemId}` }
  if (!problem.visualizationType) return { success: false, error: '该题没有可视化' }
  return {
    success: true,
    visualizationType: problem.visualizationType,
    message: '已触发过程可视化动画（参考轨迹）',
  }
}
