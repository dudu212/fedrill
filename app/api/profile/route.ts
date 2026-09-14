import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/repo/user'
import { getProfileSnapshot } from '@/lib/profile/aggregate'

/**
 * GET /api/profile —— 用户画像读取。
 *
 * 鉴权：请求头 x-fedrill-user-key（与 /api/session 同一匿名用户机制）。
 * 返回：totalCompleted / skillMatrix / streak / recentSessions / updatedAt。
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const USER_KEY_HEADER = 'x-fedrill-user-key'

export async function GET(req: NextRequest) {
  const userKey = req.headers.get(USER_KEY_HEADER)
  if (!userKey) {
    return NextResponse.json(
      { error: 'missing x-fedrill-user-key header' },
      { status: 401 },
    )
  }

  try {
    const userId = await getOrCreateUser(userKey) // 幂等：确保 users + user_profiles 行存在
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
