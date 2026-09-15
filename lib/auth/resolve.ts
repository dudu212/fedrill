import { NextRequest } from 'next/server'
import { getOrCreateUser } from '@/lib/repo/user'
import { cookieNames, verifyToken } from '@/lib/auth/session'

/**
 * ResolveUser —— 统一鉴权解析（M5 Phase 3）。
 *
 * 优先级：
 *  1. 登录态 cookie `fedrill:auth:token`（HMAC 校验通过 → 真实 userId）
 *  2. 匿名请求头 `x-fedrill-user-key`（getOrCreateUser 幂等解析）
 * 未命中 → null（调用方返回 401）。
 */
const USER_KEY_HEADER = 'x-fedrill-user-key'

export function readCookie(req: NextRequest, name: string): string | null {
  const raw = req.headers.get('cookie')
  if (!raw) return null
  for (const part of raw.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    const key = part.slice(0, eq).trim()
    if (key === name) {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim())
      } catch {
        return part.slice(eq + 1).trim()
      }
    }
  }
  return null
}

export async function resolveUserId(
  req: NextRequest,
): Promise<string | null> {
  // 1) 登录态优先（secret 未配置/校验失败时安全降级，不阻塞匿名路径）
  const token = readCookie(req, cookieNames.token)
  let authedId: string | null = null
  if (token) {
    try {
      authedId = verifyToken(token)
    } catch {
      authedId = null
    }
  }
  if (authedId) return authedId

  // 2) 匿名兜底
  const userKey = req.headers.get(USER_KEY_HEADER)
  if (!userKey) return null
  try {
    return await getOrCreateUser(userKey)
  } catch {
    return null
  }
}

export { USER_KEY_HEADER }
