import { getPool } from './postgres'

/**
 * 匿名用户解析（M4 接入用）。
 *
 * 项目当前无登录体系：客户端首次访问生成一次性 userKey（UUID，localStorage 持久化），
 * 随请求头 x-fedrill-user-key 发送；服务端按 email = anon-<userKey>@fedrill.local
 * 在 users 表 upsert 一条匿名用户并返回其 user_id。
 *
 * 这样 sessions.user_id（NOT NULL + UNIQUE(user_id, problem_id)）有真实归属，
 * 也为后续 srs_cards / user_profiles 关联留好基础；接入正式登录体系后替换此处即可。
 */
const ANON_EMAIL_DOMAIN = 'fedrill.local'

export function anonEmail(userKey: string): string {
  return `anon-${userKey}@${ANON_EMAIL_DOMAIN}`
}

export async function getOrCreateUser(userKey: string): Promise<string> {
  const pool = getPool()
  const email = anonEmail(userKey)

  await pool.query(
    `INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO NOTHING`,
    [email],
  )
  // M5 Phase 2：确保画像行存在（幂等）——user_profiles 与 users 一一对应
  await pool.query(
    `INSERT INTO user_profiles (user_id)
     SELECT user_id FROM users WHERE email = $1
     ON CONFLICT (user_id) DO NOTHING`,
    [email],
  )
  const { rows } = await pool.query<{ user_id: string }>(
    `SELECT user_id FROM users WHERE email = $1`,
    [email],
  )
  if (!rows[0]) {
    throw new Error(`无法创建匿名用户: ${email}`)
  }
  return rows[0].user_id
}

/**
 * UpsertGithubUser —— GitHub OAuth 登录用户（M5 Phase 3）。
 *
 * 按 github_id 查找：存在 → 返回已有 user_id；不存在 → INSERT（email 用 GitHub
 * 主邮箱，缺失时用 login 兜底域名），返回新 user_id。github_id 有 UNIQUE 索引。
 */
export async function upsertGithubUser(gh: {
  id: number
  login: string
  email: string | null
}): Promise<string> {
  const pool = getPool()
  const gid = String(gh.id)

  const existing = await pool.query<{ user_id: string }>(
    `SELECT user_id FROM users WHERE github_id = $1`,
    [gid],
  )
  if (existing.rows[0]) return existing.rows[0].user_id

  const email = gh.email ?? `github-${gid}@users.noreply.github.com`
  await pool.query(
    `INSERT INTO users (email, github_id) VALUES ($1, $2)
     ON CONFLICT (github_id) DO NOTHING`,
    [email, gid],
  )
  const row = await pool.query<{ user_id: string }>(
    `SELECT user_id FROM users WHERE github_id = $1`,
    [gid],
  )
  if (!row.rows[0]) throw new Error(`无法创建 GitHub 用户: ${gid}`)
  return row.rows[0].user_id
}
