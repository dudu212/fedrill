'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { categoryLabels } from '@/data/problems'
import { ApiKeySettings } from '@/app/_components/api-key-settings'

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

interface RecentSession {
  problemId: string
  title: string | null
  category: string | null
  round: number
  updatedAt: string
}

interface Profile {
  totalCompleted: number
  skillMatrix: Record<string, number>
  streak: number
  recentSessions: RecentSession[]
  updatedAt: string | null
}

const CATEGORY_ORDER = ['async', 'prototype', 'util', 'pattern'] as const

const ROUND_LABEL: Record<number, string> = {
  0: 'Round 0 · 基础实现',
  1: 'Round 1 · 边界追问',
  4: '✅ 通关',
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const userKey = getUserKey()
    fetch('/api/profile', {
      headers: { 'x-fedrill-user-key': userKey },
      cache: 'no-store',
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return ((await r.json()) as { profile: Profile }).profile
      })
      .then((p) => {
        if (!cancelled) setProfile(p)
      })
      .catch((e) => {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : String(e))
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-8">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Link
            href="/problems"
            className="text-xs text-faint hover:text-muted"
          >
            ← 返回题库
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">我的画像</h1>
          <p className="text-sm text-muted">
            技能掌握度 · 连续打卡 · 完成题数（数据存于 PostgreSQL）
          </p>
        </div>
        <ApiKeySettings />
      </header>

      {loadError && (
        <div className="rounded-md border border-bad/40 bg-bad/10 p-4 text-sm text-bad">
          画像加载失败：{loadError}（请确认 dev server 与 PostgreSQL 可用）
        </div>
      )}

      {!profile && !loadError && (
        <div className="rounded-md border border-dashed border-hairline p-8 text-center text-sm text-faint">
          画像加载中…
        </div>
      )}

      {profile && (
        <>
          {/* 顶部指标卡 */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MetricCard
              label="已完成题目"
              value={String(profile.totalCompleted)}
              hint="Round 4 通关数"
            />
            <MetricCard
              label="连续打卡"
              value={String(profile.streak)}
              hint="连续自然日有训练"
            />
            <MetricCard
              label="最近更新"
              value={profile.updatedAt ? profile.updatedAt.slice(0, 10) : '—'}
              hint="画像最后更新时间"
            />
          </section>

          {/* 技能矩阵 */}
          <section className="rounded-md border border-hairline bg-surface p-5">
            <h2 className="mb-4 text-base font-medium text-fg">
              技能矩阵（按类别掌握度）
            </h2>
            <div className="space-y-3">
              {CATEGORY_ORDER.map((cat) => {
                const value = profile.skillMatrix[cat] ?? 0
                return (
                  <div key={cat}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-muted">
                        {categoryLabels[cat] ?? cat}
                      </span>
                      <span className="font-mono text-muted">{value}%</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-raised">
                      <div
                        className={`h-full rounded-full transition-all ${
                          value >= 100
                            ? 'bg-ok'
                            : value > 0
                              ? 'bg-accent'
                              : 'bg-hairline'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* 最近做题记录 */}
          <section className="rounded-md border border-hairline bg-surface p-5">
            <h2 className="mb-4 text-base font-medium text-fg">
              最近训练记录
            </h2>
            {profile.recentSessions.length === 0 ? (
              <div className="text-sm text-muted">
                还没有训练记录——去{' '}
                <Link
                  href="/problems"
                  className="text-accent-bright hover:underline"
                >
                  题库
                </Link>{' '}
                做一道题吧
              </div>
            ) : (
              <ul className="divide-y divide-hairline">
                {profile.recentSessions.map((s) => (
                  <li
                    key={`${s.problemId}-${s.updatedAt}`}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <Link
                      href={`/problems/${s.problemId}`}
                      className="text-sm text-fg hover:text-accent-bright"
                    >
                      {s.title ?? s.problemId}
                    </Link>
                    <div className="flex shrink-0 items-center gap-2">
                      {s.category && (
                        <span className="rounded bg-raised px-1.5 py-0.5 text-[10px] text-muted">
                          {categoryLabels[s.category] ?? s.category}
                        </span>
                      )}
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] ${
                          s.round === 4
                            ? 'bg-ok/15 text-ok'
                            : 'bg-raised text-muted'
                        }`}
                      >
                        {ROUND_LABEL[s.round] ?? `Round ${s.round}`}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  )
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="rounded-md border border-hairline bg-surface p-4">
      <div className="text-xs text-faint">{label}</div>
      <div className="mt-1 text-3xl font-semibold text-fg">{value}</div>
      <div className="mt-1 text-[11px] text-faint">{hint}</div>
    </div>
  )
}
