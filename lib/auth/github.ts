/**
 * GitHubOAuth —— GitHub OAuth App 登录（手写轻量方案，零新依赖）。
 *
 * 流程：
 *  1. GET /api/auth/github          → 302 GitHub authorize（state 防 CSRF）
 *  2. GitHub 回调 /api/auth/callback → code 换 access_token → GET /user
 *  3. 服务端按 github_id upsert users → 合并匿名数据 → 签发登录态 cookie
 *
 * 环境变量：
 *  - GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET：GitHub OAuth App 凭据
 *  - APP_BASE_URL：回调基址（本地开发 http://localhost:3000）
 */

export interface GitHubUser {
  id: number
  login: string
  name: string | null
  email: string | null
  avatarUrl: string | null
}

export function githubClientId(): string {
  return process.env.GITHUB_CLIENT_ID ?? ''
}

export function appBaseUrl(): string {
  return process.env.APP_BASE_URL ?? 'http://localhost:3000'
}

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize'
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token'
const GITHUB_USER_URL = 'https://api.github.com/user'

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: githubClientId(),
    redirect_uri: `${appBaseUrl()}/api/auth/callback`,
    scope: 'read:user user:email',
    state,
  })
  return `${GITHUB_AUTHORIZE_URL}?${params.toString()}`
}

export async function exchangeCodeForUser(
  code: string,
): Promise<GitHubUser> {
  const tokenRes = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: githubClientId(),
      client_secret: process.env.GITHUB_CLIENT_SECRET ?? '',
      code,
      redirect_uri: `${appBaseUrl()}/api/auth/callback`,
    }),
    cache: 'no-store',
  })
  if (!tokenRes.ok) {
    throw new Error(`GitHub token 交换失败: HTTP ${tokenRes.status}`)
  }
  const tokenData = (await tokenRes.json()) as {
    access_token?: string
    error?: string
  }
  if (!tokenData.access_token) {
    throw new Error(`GitHub token 交换失败: ${tokenData.error ?? 'no access_token'}`)
  }

  const userRes = await fetch(GITHUB_USER_URL, {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    cache: 'no-store',
  })
  if (!userRes.ok) {
    throw new Error(`GitHub 用户信息获取失败: HTTP ${userRes.status}`)
  }
  const u = (await userRes.json()) as {
    id: number
    login: string
    name: string | null
    email: string | null
    avatar_url: string | null
  }
  return {
    id: u.id,
    login: u.login,
    name: u.name,
    email: u.email,
    avatarUrl: u.avatar_url,
  }
}
