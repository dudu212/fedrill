'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { categoryLabels } from '@/data/problems'
import type { ImplCategory } from '@/lib/types/problem'
import { ApiKeySettings } from '@/app/_components/api-key-settings'
import { AuthStatus } from '@/app/_components/auth-status'

const CATEGORIES: ImplCategory[] = ['async', 'prototype', 'util', 'pattern']

/** 列表卡片数据（M5 起由 /api/problems 提供，PostgreSQL 为权威源） */
interface ProblemCard {
  id: string
  category: string
  title: string
  difficulty: string
  tags: string[]
}

/**
 * hover 题目卡片时预加载 Monaco 主脚本 · 用户点进去前 Monaco 已在缓存里,首屏 0 等待。
 * 幂等:如果已 prefetch 过就跳过。
 */
function prefetchMonaco(): void {
  if (typeof window === 'undefined') return
  if (document.head.querySelector('link[data-monaco-prefetch]')) return
  const link = document.createElement('link')
  link.rel = 'prefetch'
  link.as = 'script'
  link.href = '/monaco/vs/loader.js'
  link.setAttribute('data-monaco-prefetch', '1')
  document.head.appendChild(link)
}

const difficultyStyle: Record<string, string> = {
  easy: 'text-ok border-ok/40 bg-ok/10',
  medium: 'text-warn border-warn/40 bg-warn/10',
  hard: 'text-bad border-bad/40 bg-bad/10',
}

const difficultyLabel: Record<string, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
}

export default function ProblemsListPage() {
  const [active, setActive] = useState<ImplCategory | 'all'>('all')
  const [problems, setProblems] = useState<ProblemCard[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  // M5：题库权威源迁移 PostgreSQL —— 列表从 /api/problems 读取（DB 优先，API 层回退静态 TS）
  useEffect(() => {
    let cancelled = false
    fetch('/api/problems')
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)),
      )
      .then((data) => {
        if (!cancelled) {
          setProblems((data as { problems?: ProblemCard[] }).problems ?? [])
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : String(e))
          setProblems([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const list: ProblemCard[] =
    problems?.filter((p) => active === 'all' || p.category === active) ?? []
  const total = problems?.length ?? 0

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 p-8">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Link
            href="/"
            className="text-xs text-faint hover:text-muted"
          >
            ← 首页
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">手撕题库</h1>
          <p className="text-sm text-muted">
            共 {total} 道题 · AI 面试官陪你走 Round 0 → 4
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/profile"
            className="rounded-full border border-hairline px-3 py-1 text-xs text-muted transition hover:border-accent/60 hover:text-accent-bright"
          >
            我的画像
          </Link>
          <AuthStatus />
          <ApiKeySettings />
        </div>
      </header>

      <nav className="flex flex-wrap gap-2">
        <TabButton active={active === 'all'} onClick={() => setActive('all')}>
          全部 ({total})
        </TabButton>
        {CATEGORIES.map((c) => {
          const count =
            problems?.filter((p) => p.category === c).length ?? 0
          return (
            <TabButton
              key={c}
              active={active === c}
              onClick={() => setActive(c)}
            >
              {categoryLabels[c]} ({count})
            </TabButton>
          )
        })}
      </nav>

      {problems === null && !loadError && (
        <div className="rounded-md border border-dashed border-hairline p-8 text-center text-sm text-faint">
          题库加载中…
        </div>
      )}

      {loadError && (
        <div className="rounded-md border border-bad/40 bg-bad/10 p-4 text-sm text-bad">
          题库加载失败：{loadError}（请确认 dev server 与 PostgreSQL 可用）
        </div>
      )}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((p) => (
          <Link
            key={p.id}
            href={`/problems/${p.id}`}
            onMouseEnter={prefetchMonaco}
            onFocus={prefetchMonaco}
            className="group flex flex-col gap-3 rounded-md border border-hairline bg-surface p-4 transition-colors hover:border-accent/50 hover:bg-raised"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-base font-medium text-fg group-hover:text-accent-bright">
                {p.title}
              </h3>
              <span
                className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] ${
                  difficultyStyle[p.difficulty] ?? ''
                }`}
              >
                {difficultyLabel[p.difficulty]}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {p.tags.slice(0, 4).map((t) => (
                <span
                  key={t}
                  className="rounded bg-raised px-1.5 py-0.5 text-[10px] text-muted"
                >
                  {t}
                </span>
              ))}
            </div>
            <div className="mt-auto flex items-center justify-between text-[11px] text-faint">
              <span>{categoryLabels[p.category]}</span>
              <span className="text-faint group-hover:text-accent-bright">
                进入
              </span>
            </div>
          </Link>
        ))}
        {list.length === 0 && problems !== null && !loadError && (
          <div className="col-span-full rounded-md border border-dashed border-hairline p-8 text-center text-sm text-faint">
            该分类下暂无题目
          </div>
        )}
      </section>
    </main>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
        active
          ? 'border-accent bg-accent/15 text-accent-bright'
          : 'border-hairline text-muted hover:border-hairline-strong hover:text-fg'
      }`}
    >
      {children}
    </button>
  )
}
