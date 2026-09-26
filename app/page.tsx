import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col justify-center px-6 py-16">
      <div className="hero-enter mx-auto flex w-full max-w-2xl flex-col gap-8">
        <div className="font-mono text-sm text-muted">FEDrill</div>

        <div className="flex flex-col gap-4">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-fg">
            手撕题，交给 AI 面试官盯着练。
          </h1>
          <p className="max-w-md text-base leading-7 text-muted">
            阶梯式追问，只反问、不给答案。写完在浏览器沙盒里跑测试，直到边界问不出破绽。
          </p>
        </div>

        {/* 模拟面试会话 —— 这个产品最本真的瞬间,胜过一张装饰图 */}
        <div className="overflow-hidden rounded-md border border-hairline bg-surface">
          <div className="flex items-center gap-1.5 border-b border-hairline px-4 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-bad/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-warn/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-ok/60" />
            <span className="ml-2 font-mono text-xs text-faint">
              fedrill · 手撕训练
            </span>
          </div>
          <div className="space-y-3 px-4 py-4 font-mono text-sm leading-6">
            <p>
              <span className="text-accent-bright">面试官</span>
              <span className="text-fg">
                {' '}
                手写一个 debounce，要求立刻执行与可取消。
              </span>
            </p>
            <p>
              <span className="text-muted">你</span>
              <span className="text-fg"> 我卡住了，能给点提示吗？</span>
            </p>
            <p>
              <span className="text-accent-bright">面试官</span>
              <span className="text-fg">
                {' '}
                先想：事件触发后，函数应该什么时候第一次执行？
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/problems"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-dim"
          >
            进入题库
          </Link>
          <Link
            href="/algo"
            className="rounded-md border border-hairline px-4 py-2 text-sm text-muted transition-colors hover:border-hairline-strong hover:text-fg"
          >
            算法可视化
          </Link>
          <Link
            href="/chat-demo"
            className="text-sm text-faint transition-colors hover:text-muted"
          >
            Chat Demo（调试）
          </Link>
        </div>
      </div>
    </main>
  )
}
