import { getPool } from './postgres'
import type { ImplProblemMinimal } from '@/lib/types/problem'

/**
 * ProblemRepo —— 题库读取（服务端，PostgreSQL 权威源）。
 *
 * M5 迁移后 problems 表为题库唯一权威源：
 *  - data（JSONB）保存完整题目对象（description/starterCode/testCases/…）
 *  - 顶层列（type/category/title/difficulty/tags）为索引字段，供列表页轻量查询
 *  - API 路由层负责"DB 为空时回退静态 TS"，本模块只面向 DB
 */

interface ProblemRow {
  problem_id: string
  type: string
  category: string | null
  title: string
  difficulty: string | null
  tags: string[]
  data: unknown
}

/** 列表页需要的轻量字段 */
export interface ProblemListItem {
  id: string
  type: string
  category: string
  title: string
  difficulty: string
  tags: string[]
}

/** DB 行 → 完整题目对象（data JSONB 即完整 ImplProblemMinimal） */
export function rowToProblem(row: ProblemRow): ImplProblemMinimal {
  return row.data as ImplProblemMinimal
}

export async function listProblemsFromDb(): Promise<ProblemListItem[]> {
  const { rows } = await getPool().query<ProblemRow>(
    `SELECT problem_id, type, category, title, difficulty, tags, data
     FROM problems
     ORDER BY problem_id`,
  )
  return rows.map((r) => ({
    id: r.problem_id,
    type: r.type,
    category: r.category ?? 'util',
    title: r.title,
    difficulty: r.difficulty ?? 'medium',
    tags: r.tags,
  }))
}

export async function getProblemFromDb(
  id: string,
): Promise<ImplProblemMinimal | null> {
  const { rows } = await getPool().query<ProblemRow>(
    `SELECT problem_id, type, category, title, difficulty, tags, data
     FROM problems
     WHERE problem_id = $1`,
    [id],
  )
  return rows[0] ? rowToProblem(rows[0]) : null
}

/** 题库是否已迁移（DB 中存在题目数据） */
export async function hasSeededProblems(): Promise<boolean> {
  const { rows } = await getPool().query<{ c: string }>(
    `SELECT count(*)::text AS c FROM problems`,
  )
  return Number(rows[0]?.c ?? 0) > 0
}
