import Link from 'next/link'
import { algoProblems } from '@/data/algo'

export default function AlgoListPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-4 px-6 py-10">
      <header className="flex flex-col gap-2">
        <Link href="/" className="text-xs text-faint hover:text-muted">
          ← 首页
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">算法题</h1>
        <p className="text-sm text-muted">
          带过程可视化的算法练习 · 共 {algoProblems.length} 题
        </p>
      </header>

      <ul className="space-y-2">
        {algoProblems.map((p) => (
          <li key={p.id}>
            <Link
              href={`/algo/${p.id}`}
              className="flex items-center gap-3 rounded-md border border-hairline bg-surface p-3 transition-colors hover:border-accent/50 hover:bg-raised"
            >
              <span className="font-medium text-fg">{p.title}</span>
              <span className="text-sm text-muted">难度 {p.difficulty}</span>
              <span className="ml-auto flex flex-wrap justify-end gap-1.5">
                {p.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded bg-raised px-1.5 py-0.5 text-[10px] text-muted"
                  >
                    {t}
                  </span>
                ))}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
