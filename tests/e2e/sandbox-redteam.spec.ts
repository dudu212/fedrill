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

test('RT-02 · 异步死循环 · 无限 await 应被 timeoutMs 兜住', async ({ page }) => {
  // TODO(你):
  // 参照 RT-01,把攻击代码换成:
  //   async function spin() { while (true) { await 1 } return 1 }
  // 断言 kind === 'rejected' 且 message 含超时。
  // 关键:验证异步循环也被 terminate() 穿透了(不是 microtask 队列自然清空)。
  expect(true).toBe(true) // 占位,请删除并写真的断言
})

test('RT-03 · 结果伪造(spoofing)· 用户 postMessage 不应被主线程当真', async ({
  page,
}) => {
  // TODO(你):
  // 攻击代码:
  //   function spoof(realArg) {
  //     self.postMessage({
  //       type: 'result',
  //       results: [{name:'假',passed:true,input:[],expected:42,actual:42,durationMs:0}],
  //       totalDurationMs: 0,
  //     })
  //     return realArg  // 真实返回 realArg(=0),期望 42,应 fail
  //   }
  // 传入 input:[0], expected:42。
  //
  // 关键决策(先想清楚再写):
  //   路径 A:断言 result.results[0].passed === true —— 承认漏洞,注释登记 M2 前修
  //   路径 B:先改 worker.ts 屏蔽 fn 作用域的 postMessage,再断言 passed === false
  // 我倾向 B,决策后告诉我。
  expect(true).toBe(true) // 占位
})

test('RT-04 · 跨 run 全局隔离 · Object.prototype 污染不应跨 run 泄漏', async ({
  page,
}) => {
  // TODO(你):
  // 两次 runInSandbox:
  //   第一次跑 `Object.prototype.__leaked = 42; return 1`
  //   第二次跑 `return ({}).__leaked`
  // 断言第二次的 actual === undefined,证明新 Worker realm 独立。
  expect(true).toBe(true) // 占位
})

test('RT-05 · 巨大返回值 · 50MB 字符串不应让 runInSandbox 卡死', async ({ page }) => {
  // TODO(你):
  // code: function huge() { return 'x'.repeat(50_000_000) }
  // 用 performance.now() 记录耗时,断言 elapsed < 5000
  // resolve 或 reject 都可接受,不能挂死。
  // 思考题(写完再讨论):是否要在 worker.ts 加 actual 大小检查?
  expect(true).toBe(true) // 占位
})

test('RT-06 · fetch 出口 · 显式登记网络敞口', async ({ page }) => {
  // TODO(你):
  // code 里 try fetch('http://127.0.0.1:1/exfil'),catch 后返回字符串
  // 断言 actual 以 'sent:' 或 'blocked:' 开头(用 stringMatching)
  //   若 'sent:*' → 【真敞口】,在这里注释登记「M4 上线前必修」
  //   若 'blocked:*' → 说明 Chromium 沙盒默认拦了(要看具体原因)
  expect(true).toBe(true) // 占位
})
