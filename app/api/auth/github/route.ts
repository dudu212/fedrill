import { NextRequest, NextResponse } from 'next/server'
import { buildAuthorizeUrl, githubClientId } from '@/lib/auth/github'
import { cookieNames, randomState } from '@/lib/auth/session'

/**
 * GET /api/auth/github —— 发起 GitHub OAuth 登录。
 *
 * 前端跳转：`/api/auth/github?userKey=<匿名 user_key>`（可选）：
 *  - 携带匿名标识，回调时把匿名数据合并进真实账号
 *  - state 写 httpOnly cookie 防 CSRF
 *
 * 未配置 OAuth App 凭据时返回 503 并提示（开发期友好报错）。
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!githubClientId() || !process.env.GITHUB_CLIENT_SECRET) {
    return NextResponse.json(
      {
        error:
          'GitHub OAuth App 未配置：请先在 .env.local 设置 GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET（需在 GitHub 注册 OAuth App）',
      },
      { status: 503 },
    )
  }

  const state = randomState()
  const authorizeUrl = buildAuthorizeUrl(state)
  const url = new URL(req.url)
  const anonKey = url.searchParams.get('userKey') ?? ''

  const res = NextResponse.redirect(authorizeUrl)
  res.cookies.set(cookieNames.state, state, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  })
  if (anonKey) {
    res.cookies.set(cookieNames.anonKey, anonKey, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    })
  }
  return res
}
