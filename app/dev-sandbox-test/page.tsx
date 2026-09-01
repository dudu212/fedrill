'use client'

import { useEffect, useState } from 'react'
import { runInSandbox } from '@/lib/sandbox/runner'

/**
 * 沙盒红队测试 · Harness 页面
 *
 * 目的:把 runInSandbox 挂到 window,让 Playwright 通过 page.evaluate 调用。
 * happy-dom 没有 Web Worker,红队用例必须在真 Chromium 里跑。
 *
 * 路径约定:`dev-sandbox-test` 前缀 = "开发/测试专用,非产品页面"。
 * 注意:Next.js App Router 会跳过下划线开头的目录(如 `_sandbox-test`),
 * 因此不能用下划线。上线前应在 next.config 里通过 rewrites 或环境变量禁用此路径。
 *
 * 关联:ADR-009 Tier 3 · docs/learning/sandbox-e2e-harness.md
 */

declare global {
  interface Window {
    __runInSandbox?: typeof runInSandbox
  }
}

export default function SandboxTestHarness() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    window.__runInSandbox = runInSandbox
    setReady(true)
    return () => {
      delete window.__runInSandbox
    }
  }, [])

  return (
    <main style={{ padding: 24, fontFamily: 'monospace' }}>
      <h1>Sandbox Red-Team Harness</h1>
      <p>
        仅测试用途。Playwright 会 navigate 到此页面,等 <code>#sandbox-test-ready</code> 出现,
        然后通过 <code>page.evaluate</code> 调用 <code>window.__runInSandbox</code>。
      </p>
      {ready && <div id="sandbox-test-ready">READY</div>}
    </main>
  )
}
