import { NextRequest, NextResponse } from 'next/server'
import { getProblem } from '@/data/problems'
import { getProblemFromDb } from '@/lib/repo/problem-repo'

/**
 * GET /api/problems/[id] —— 题目详情（完整 ImplProblemMinimal）。
 *
 * 权威源：PostgreSQL problems.data（JSONB 完整题目）。
 * fallback：DB 未迁移 / 连接失败时回退静态 TS；均无 → 404。
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Ctx {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params

  try {
    const fromDb = await getProblemFromDb(id)
    if (fromDb) return NextResponse.json({ problem: fromDb })
  } catch (e) {
    console.error(`[api/problems/${id}] DB 读取失败，回退静态题库：`, e)
  }

  const fromStatic = getProblem(id)
  if (fromStatic) return NextResponse.json({ problem: fromStatic })

  return NextResponse.json({ error: 'problem_not_found' }, { status: 404 })
}
