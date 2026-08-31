import type { ProviderToolSpec } from '@/lib/llm/types'
import { runInSandbox } from '@/lib/sandbox/runner'
import { getSessionRepo } from '@/lib/repo/session-repo'
import { getProblem } from '@/data/problems'

/**
 * run_tests · M2a Phase 1a 唯一 tool
 *
 * 让 AI 自主决定"我要跑一次测试看结果"。执行位置在客户端（见 ADR-011）：
 * - 底层是 lib/sandbox/runner.ts 的 Web Worker，天生浏览器专属
 * - 复用 M1 已跑通的 3s 超时 + {__fn}/{__val} 逃生舱 + deepEqual
 *
 * 参数设计原则：**能从 session 读的就不让 LLM 传**（防幻觉），所以 args 为空。
 * 结果 shape 见 RunTestsResult——LLM 拿到 JSON.stringify 后能推理接下来该说什么。
 *
 * 设计参考 docs/learning/tool-use-and-react.md §四 · Tool 设计四条铁律。
 */

// ─────────────────────────────────────────────────────────────────
// 1. Tool 元信息 —— 给 LLM 看的描述
// ─────────────────────────────────────────────────────────────────

export const runTestsToolSpec: ProviderToolSpec = {
  name: 'run_tests',
  description:
    '运行用户当前编辑器里的代码，对该题的基础测试用例逐个执行。' +
    '返回每条挂了的用例的名字、输入、期望值、实际值、错误消息（如果抛异常）。' +
    '当你想验证用户代码是否正确、或想让用户看到具体哪条用例挂了时调用。无需参数。',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
  },
}

// ─────────────────────────────────────────────────────────────────
// 2. 结果 shape —— 塞给 LLM 的 tool_result content
// ─────────────────────────────────────────────────────────────────

/**
 * tool 结果的结构。JSON.stringify 后作为 tool_result 消息的 content 塞给 LLM。
 * 结构化字段让 LLM 能"看懂"结果做后续推理，比自然语言摘要更稳。
 */
export interface RunTestsResult {
  success: boolean
  /** 通过用例数 */
  passCount?: number
  /** 用例总数 */
  total?: number
  /** 全部通过（便于 LLM 快速判断进入 Round 1） */
  allPassed?: boolean
  /**
   * 失败用例明细。只列失败以压缩 token；如果全通过，failed 是空数组。
   * name / input / expected / actual / error 五个字段供 LLM 推理。
   */
  failed?: FailedCase[]
  /** 总耗时 ms */
  durationMs?: number
  /** success=false 时的失败原因，例如"沙箱超时"、"未知题目" */
  error?: string
}

export interface FailedCase {
  name?: string
  input: unknown[]
  expected: unknown
  actual?: unknown
  /** 抛异常时的错误消息 */
  error?: string
}

// ─────────────────────────────────────────────────────────────────
// 3. 执行体 —— Agent Loop 拿到 tool_call 后调用
// ─────────────────────────────────────────────────────────────────

/**
 * 执行 run_tests。
 *
 * @param problemId 当前题目 id（Agent Loop 从 UI 上下文注入）
 * @returns 结构化结果，LLM 会看到 JSON.stringify 后的版本
 */
export async function executeRunTests(
  problemId: string,
): Promise<RunTestsResult> {
  const problem = getProblem(problemId)
  if (!problem) {
    return { success: false, error: `未知题目: ${problemId}` }
  }

  const repo = getSessionRepo()
  const session = await repo.get(problemId)
  const code = session?.code ?? ''

  if (!code.trim()) {
    return {
      success: false,
      error: '用户尚未在编辑器里写任何代码',
    }
  }

  try {
    const res = await runInSandbox(
      code,
      problem.requiredAPI,
      problem.testCases.basic,
    )

    const passCount = res.results.filter((r) => r.passed).length
    const total = res.results.length
    const failed: FailedCase[] = res.results
      .filter((r) => !r.passed)
      .map((r) => ({
        name: r.name,
        input: r.input,
        expected: r.expected,
        actual: r.actual,
        error: r.error,
      }))

    // 语义一致：AI 触发跑测试和用户点"运行"按钮行为对齐——
    // 都会刷新 session 的 lastTestResults + testedCodeSnapshot，
    // 让下一次 prompt 注入拿到最新的测试状态和陈旧标记。
    void repo
      .save(problemId, {
        lastTestResults: res,
        testedCodeSnapshot: code,
      })
      .catch(() => {
        // localStorage 满或私有模式禁用等极端情形，静默失败
        // 不影响 tool 结果本身
      })

    return {
      success: true,
      passCount,
      total,
      allPassed: passCount === total && total > 0,
      failed,
      durationMs: res.totalDurationMs,
    }
  } catch (err) {
    // runInSandbox 的 3s 超时、Worker 加载失败等异常走这里。
    // 不 throw——包装成 error 让 LLM 有机会道歉或建议用户简化代码。
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
