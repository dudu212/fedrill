import { NextRequest, NextResponse } from 'next/server'
import { cookieNames, verifyToken } from '@/lib/auth/session'
import { readCookie } from '@/lib/auth/resolve'
import { getPool } from '@/lib/repo/postgres'

/**
 * GET /api/auth/me —— 当前登录态。
 *
 * 返回：{ authed: false } 或 { authed: true, userId, email }。
 * 前端据此显示"GitHub 登录 / 已登录 + 登出"。
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = readCookie(req, cookieNames.token)
  let userId: string | null = null
  if (token) {
    try {
      userId = verifyToken(token)
    } catch {
      userId = null
    }
  }
  if (!userId) {
    return NextResponse.json({ authed: false })
  }
  try {
    const { rows } = await getPool().query<{ email: string }>(
      `SELECT email FROM users WHERE user_id = $1`,
      [userId],
    )
    return NextResponse.json({
      authed: true,
      userId,
      email: rows[0]?.email ?? null,
    })
  } catch (e) {
    console.error('[auth/me] 查询失败：', e)
    return NextResponse.json({ authed: false })
  }
}
