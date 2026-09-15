'use client'

import { useEffect, useState } from 'react'

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

interface Me {
  authed: boolean
  email?: string | null
}

/**
 * AuthStatus —— 顶部登录态组件（M5 Phase 3）。
 *
 * - 未登录：显示「GitHub 登录」，跳 /api/auth/github?userKey=<匿名 key>
 *   （回调时把匿名数据合并进真实账号）
 * - 已登录：显示邮箱 + 登出
 * - 加载中：占位
 */
export function AuthStatus() {
  const [me, setMe] = useState<Me | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: Me) => {
        if (!cancelled) setMe(d)
      })
      .catch(() => {
        if (!cancelled) setMe({ authed: false })
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST', cache: 'no-store' })
    } finally {
      setMe({ authed: false })
      window.location.reload()
    }
  }

  if (me === null) {
    return (
      <span className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-500">
        登录态…
      </span>
    )
  }

  if (me.authed) {
    return (
      <div className="flex items-center gap-2">
        <span className="max-w-[140px] truncate text-xs text-zinc-400">
          {me.email ?? '已登录'}
        </span>
        <button
          onClick={logout}
          className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-300 transition hover:border-red-500/60 hover:text-red-300"
        >
          登出
        </button>
      </div>
    )
  }

  return (
    <a
      href={`/api/auth/github?userKey=${encodeURIComponent(getUserKey())}`}
      className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-300 transition hover:border-emerald-500/60 hover:text-emerald-300"
    >
      GitHub 登录
    </a>
  )
}
