import Link from 'next/link'
import { algoProblems } from '@/data/algo'

export default function AlgoListPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-4 text-2xl font-bold">算法题</h1>
      <ul className="space-y-2">
        {algoProblems.map((p) => (
          <li key={p.id}>
            <Link
              href={`/algo/${p.id}`}
              className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50"
            >
              <span className="font-medium">{p.title}</span>
              <span className="text-sm text-slate-500">难度 {p.difficulty}</span>
              <span className="ml-auto text-sm text-slate-400">{p.tags.join(' · ')}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
