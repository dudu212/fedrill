import { NextResponse } from 'next/server'
import { cookieNames } from '@/lib/auth/session'

/**
 * POST /api/auth/logout —— 登出（清除登录态 cookie）。
 */
export const runtime = 'nodejs'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(cookieNames.token)
  return res
}
