import Link from 'next/link'
import { algoProblems } from '@/data/algo'

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

export default function AlgoListPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 p-8">
      <header className="flex flex-col gap-2">
        <Link href="/" className="text-xs text-faint hover:text-muted">
          ← 首页
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">算法题</h1>
        <p className="text-sm text-muted">
          共 {algoProblems.length} 道 · 苏格拉底式引导 · 过程可视化
        </p>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {algoProblems.map((p) => (
          <Link
            key={p.id}
            href={`/algo/${p.id}`}
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
              <span>过程可视化</span>
              <span className="text-faint group-hover:text-accent-bright">
                进入
              </span>
            </div>
          </Link>
        ))}
      </section>
    </main>
  )
}
