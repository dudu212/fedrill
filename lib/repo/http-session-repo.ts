import type {
  SessionPatch,
  SessionRepo,
  SessionSnapshot,
} from './session-repo'

/**
 * HttpSessionRepo —— 客户端实现：通过 /api/session/[problemId] 桥接服务端 PostgreSQL。
 *
 * 浏览器不能直连 pg，统一走 fetch（与 M1-M3 的 LocalStorage 实现同接口，调用方零改动）。
 * 匿名用户标识：首次生成 UUID 存 localStorage，随请求头 x-fedrill-user-key 发送，
 * 服务端据此 upsert 匿名用户。
 */
const USER_KEY_STORAGE = 'fedrill:user:v1'

function getUserKey(): string {
  if (typeof window === 'undefined') return ''
  let key = window.localStorage.getItem(USER_KEY_STORAGE)
  if (!key) {
    key =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`
    window.localStorage.setItem(USER_KEY_STORAGE, key)
  }
  return key
}

export class HttpSessionRepo implements SessionRepo {
  private userKey: string

  constructor() {
    this.userKey = getUserKey()
  }

  private request(problemId: string, init?: RequestInit): Promise<Response> {
    return fetch(`/api/session/${encodeURIComponent(problemId)}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'x-fedrill-user-key': this.userKey,
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
    })
  }

  async get(problemId: string): Promise<SessionSnapshot | null> {
    const res = await this.request(problemId)
    if (!res.ok) {
      throw new Error(`GET /api/session/${problemId}: ${res.status}`)
    }
    const data = (await res.json()) as { session: SessionSnapshot | null }
    return data.session
  }

  async save(problemId: string, patch: SessionPatch): Promise<void> {
    const res = await this.request(problemId, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      throw new Error(`PATCH /api/session/${problemId}: ${res.status}`)
    }
  }

  async reset(problemId: string): Promise<void> {
    const res = await this.request(problemId, { method: 'DELETE' })
    if (!res.ok) {
      throw new Error(`DELETE /api/session/${problemId}: ${res.status}`)
    }
  }
}
