import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForUser, appBaseUrl } from '@/lib/auth/github'
import { cookieNames, signToken } from '@/lib/auth/session'
import { readCookie } from '@/lib/auth/resolve'
import { upsertGithubUser, getOrCreateUser } from '@/lib/repo/user'
import { mergeAnonymousData } from '@/lib/auth/merge'

/**
 * GET /api/auth/callback —— GitHub OAuth 回调。
 *
 * 1. 校验 state（防 CSRF）
 * 2. code 换 token → 拉取 GitHub 用户 → upsert users（github_id UNIQUE）
 * 3. 若携带匿名 user_key（cookie）→ 合并匿名数据到真实账号
 * 4. 签发登录态 cookie → 302 /profile
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const storedState = readCookie(req, cookieNames.state)

  if (!code || !state || state !== storedState) {
    return NextResponse.json(
      { error: 'oauth state mismatch' },
      { status: 400 },
    )
  }

  try {
    const ghUser = await exchangeCodeForUser(code)
    const userId = await upsertGithubUser(ghUser)

    // 匿名数据合并（幂等：无匿名 cookie 时为空操作）
    const anonKey = readCookie(req, cookieNames.anonKey)
    if (anonKey) {
      try {
        const anonId = await getOrCreateUser(anonKey)
        if (anonId !== userId) {
          await mergeAnonymousData(anonId, userId)
        }
      } catch (e) {
        console.error('[auth/callback] 匿名数据合并失败：', e)
      }
    }

    const token = signToken(userId)
    const res = NextResponse.redirect(`${appBaseUrl()}/profile`)
    res.cookies.set(cookieNames.token, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    })
    res.cookies.delete(cookieNames.state)
    res.cookies.delete(cookieNames.anonKey)
    return res
  } catch (e) {
    console.error('[auth/callback] 登录失败：', e)
    return NextResponse.json({ error: 'auth_failed' }, { status: 500 })
  }
}
