import { NextRequest, NextResponse } from 'next/server'
import { PostgresSessionRepo } from '@/lib/repo/postgres'
import { getOrCreateUser } from '@/lib/repo/user'
import { ensureProblemRegistered } from '@/lib/repo/seed-problem'
import { refreshUserProfile } from '@/lib/profile/aggregate'
import type { SessionPatch } from '@/lib/repo/session-repo'

/**
 * /api/session/[problemId] —— 客户端 HttpSessionRepo 与 PostgreSQL 的桥接层。
 *
 *  - GET    → repo.get(problemId)
 *  - PATCH  → repo.save(problemId, patch)（upsert）
 *  - DELETE → repo.reset(problemId)
 *
 * 鉴权：请求头 x-fedrill-user-key（客户端首次生成的 UUID）→ 解析/创建匿名用户。
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const USER_KEY_HEADER = 'x-fedrill-user-key'

async function resolveUserId(req: NextRequest): Promise<string | null> {
  const userKey = req.headers.get(USER_KEY_HEADER)
  if (!userKey) return null
  try {
    return await getOrCreateUser(userKey)
  } catch {
    return null
  }
}

interface Ctx {
  params: Promise<{ problemId: string }>
}

function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: 'missing x-fedrill-user-key header' },
    { status: 401 },
  )
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const { problemId } = await ctx.params
  const userId = await resolveUserId(req)
  if (!userId) return unauthorized()

  const repo = new PostgresSessionRepo(userId)
  const session = await repo.get(problemId)
  return NextResponse.json({ session })
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { problemId } = await ctx.params
  const userId = await resolveUserId(req)
  if (!userId) return unauthorized()

  let patch: SessionPatch
  try {
    patch = (await req.json()) as SessionPatch
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const repo = new PostgresSessionRepo(userId)
  await ensureProblemRegistered(problemId)
  await repo.save(problemId, patch)

  // M5 Phase 2：通关（round 到达 4）时刷新用户画像（total_completed / skill_matrix / streak）
  if (
    patch.currentRound !== undefined &&
    (patch.currentRound === 'completed' || patch.currentRound === 4)
  ) {
    await refreshUserProfile(userId).catch((e) =>
      console.error(
        `[profile] 通关刷新失败 user=${userId} problem=${problemId}:`,
        e,
      ),
    )
  }

  const session = await repo.get(problemId)
  return NextResponse.json({ ok: true, session })
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { problemId } = await ctx.params
  const userId = await resolveUserId(req)
  if (!userId) return unauthorized()

  const repo = new PostgresSessionRepo(userId)
  await repo.reset(problemId)
  return NextResponse.json({ ok: true })
}
