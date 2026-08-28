import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-3">
        <h1 className="text-5xl font-bold tracking-tight">FEDrill</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          前端秋招题库 AI 教练
        </p>
        <p className="max-w-md text-center text-sm text-zinc-500">
          AI 面试官陪你练手撕题 · 阶梯式追问 · 不给答案只反问
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/problems"
          className="rounded bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          进入题库 →
        </Link>
        <Link
          href="/chat-demo"
          className="rounded border border-zinc-700 px-5 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-900"
        >
          Chat Demo（调试用）
        </Link>
      </div>
    </main>
  )
}
