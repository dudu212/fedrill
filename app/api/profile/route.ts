import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/auth/resolve'
import { getProfileSnapshot } from '@/lib/profile/aggregate'

/**
 * GET /api/profile —— 用户画像读取。
 *
 * 鉴权：请求头 x-fedrill-user-key（与 /api/session 同一匿名用户机制）。
 * 返回：totalCompleted / skillMatrix / streak / recentSessions / updatedAt。
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const userId = await resolveUserId(req)
  if (!userId) {
    return NextResponse.json(
      { error: 'missing auth: login or x-fedrill-user-key header' },
      { status: 401 },
    )
  }

  try {
    const profile = await getProfileSnapshot(userId)
    return NextResponse.json({ profile })
  } catch (e) {
    console.error('[api/profile] 读取失败：', e)
    return NextResponse.json(
      { error: 'profile_read_failed' },
      { status: 500 },
    )
  }
}
