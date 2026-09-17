import { createHmac, randomUUID, timingSafeEqual } from 'crypto'

/**
 * AuthSession —— 登录态令牌（HMAC 签名，零新依赖）。
 *
 * 登录成功后签发 token = `<userId>.<hmac(userId)>`，写入 httpOnly cookie；
 * 服务端 API 校验签名后得到真实 userId，优先于匿名 user_key 解析。
 *
 * 说明：本地课设级方案，不引入 JWT/会话表。生产环境应换签名会话或
 * 接入正式认证中间件（secret 强度与轮换另行处理）。
 */
const TOKEN_COOKIE = 'fedrill:auth:token'
const STATE_COOKIE = 'fedrill:auth:state'
const ANON_KEY_COOKIE = 'fedrill:anon:key'

export function authSecret(): string {
  const secret = process.env.GITHUB_CLIENT_SECRET ?? process.env.AUTH_SECRET ?? ''
  if (!secret) {
    throw new Error('缺少 GITHUB_CLIENT_SECRET / AUTH_SECRET 环境变量')
  }
  return secret
}

export function signToken(userId: string): string {
  const sig = createHmac('sha256', authSecret())
    .update(userId)
    .digest('hex')
    .slice(0, 32)
  return `${userId}.${sig}`
}

export function verifyToken(token: string | null | undefined): string | null {
  if (!token) return null
  const dot = token.indexOf('.')
  if (dot <= 0) return null
  const userId = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expect = createHmac('sha256', authSecret())
    .update(userId)
    .digest('hex')
    .slice(0, 32)
  const a = Buffer.from(sig)
  const b = Buffer.from(expect)
  if (a.length !== b.length) return null
  return timingSafeEqual(a, b) ? userId : null
}

export const cookieNames = {
  token: TOKEN_COOKIE,
  state: STATE_COOKIE,
  anonKey: ANON_KEY_COOKIE,
}

export function randomState(): string {
  return randomUUID()
}
