import { getProblem } from '@/data/problems'
import { getPool } from './postgres'

/**
 * 题目登记：首次保存会话时把题目插入 problems 表，满足 sessions.problem_id 外键。
 *
 * 当前题库主数据来自静态 TS（data/problems/*.ts），problems 表默认是空的；
 * 会话写入（PATCH /api/session/[id]）前调用本函数，把题目完整数据登记进 problems 表
 * （渐进填充，避免一次性迁移整个题库）。未知题目不登记，让外键自然报错，防止脏数据。
 */
export async function ensureProblemRegistered(
  problemId: string,
): Promise<void> {
  const problem = getProblem(problemId)
  if (!problem) return

  const pool = getPool()
  await pool.query(
    `INSERT INTO problems (problem_id, type, category, title, difficulty, tags, data)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (problem_id) DO NOTHING`,
    [
      problem.id,
      problem.type,
      'category' in problem ? (problem as { category: string }).category : null,
      problem.title,
      problem.difficulty,
      problem.tags,
      JSON.stringify(problem), // 完整题目数据（starterCode/testCases/edgeCases/followUpPath…）
    ],
  )
}
