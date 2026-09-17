import { NextResponse } from 'next/server'
import { problems } from '@/data/problems'
import {
  hasSeededProblems,
  listProblemsFromDb,
  type ProblemListItem,
} from '@/lib/repo/problem-repo'

/**
 * GET /api/problems —— 题库列表。
 *
 * 权威源：PostgreSQL problems 表（M5 迁移后）。
 * fallback：DB 未迁移 / 连接失败时回退静态 TS（保证开发期可用），页面无感知。
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  try {
    if (await hasSeededProblems()) {
      return NextResponse.json({ problems: await listProblemsFromDb() })
    }
  } catch (e) {
    console.error('[api/problems] DB 读取失败，回退静态题库：', e)
  }

  const list: ProblemListItem[] = problems.map((p) => ({
    id: p.id,
    type: p.type,
    category: 'category' in p ? (p as { category: string }).category : 'util',
    title: p.title,
    difficulty: p.difficulty,
    tags: p.tags,
  }))
  return NextResponse.json({ problems: list })
}
