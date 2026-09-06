import { test, expect, type Page } from '@playwright/test'

/**
 * 业务闭环 E2E · M1 手撕题主流程
 *
 * 分两组:
 *   1. 无 LLM · 纯前端逻辑(BF-01/02/03)· CI 稳定
 *   2. 需 LLM · Route Handler 调 DeepSeek(BF-04)· 无 key 自动 skip
 *
 * Monaco 输入:直接 `window.monaco.editor.getEditors()[0].setValue()`
 * 避免 keyboard.type 的慢和不确定。
 */

const PROBLEM_ID = 'promise-all'
const PROBLEM_URL = `/problems/${PROBLEM_ID}`

const CORRECT_CODE = `function myPromiseAll(iterable) {
  const arr = Array.from(iterable)
  return new Promise((resolve, reject) => {
    if (arr.length === 0) return resolve([])
    const results = new Array(arr.length)
    let done = 0
    arr.forEach((p, i) => {
      Promise.resolve(p).then(
        (v) => {
          results[i] = v
          if (++done === arr.length) resolve(results)
        },
        reject,
      )
    })
  })
}`

const BUGGY_CODE = `function myPromiseAll(arr) {
  // 尚未实现:每条用例都会在 sandbox 里 catch 到 Error · 显示 ✗
  throw new Error('未实现')
}`

/**
 * 直接 seed SessionRepo · 绕开 Monaco setValue → @monaco-editor/react onChange 的
 * 传递路径(实测 setValue / pushEditOperations 都不触发 React state update,
 * 原因大概率是 @monaco-editor/react 用 valueRef 判 isFlush 跳过程序化 change)。
 *
 * seed 后页面的 useEffect 会调 repo.get(problemId) 拿到快照 → setCode → Monaco
 * 重新渲染出我们塞的代码,此时 React state 是权威的,click 运行走的是新 code。
 */
async function seedCodeViaRepo(
  page: Page,
  problemId: string,
  code: string,
): Promise<void> {
  await page.addInitScript(
    ({ pid, c }) => {
      const key = `fedrill:session:v1:${pid}`
      const now = Date.now()
      localStorage.setItem(
        key,
        JSON.stringify({
          problemId: pid,
          code: c,
          messages: [],
          currentRound: 0,
          hintsUsed: 0,
          testedCodeSnapshot: null,
          lastTestResults: null,
          createdAt: now,
          updatedAt: now,
        }),
      )
    },
    { pid: problemId, c: code },
  )
}

test.describe('业务闭环 · M1 手撕题主流程(无 LLM)', () => {
  test.beforeEach(async ({ page }) => {
    // 清 SessionRepo · 每 test 从零
    await page.addInitScript(() => {
      try {
        localStorage.clear()
      } catch {
        // SSR 阶段没有 localStorage,忽略
      }
    })
  })

  test('BF-01 · 题目页 UI 骨架完整加载', async ({ page }) => {
    await page.goto(PROBLEM_URL)

    await expect(
      page.getByRole('heading', { name: '手写 Promise.all' }),
    ).toBeVisible()
    await expect(page.locator('.monaco-editor').first()).toBeVisible()
    await expect(page.getByRole('button', { name: /运行/ })).toBeVisible()
    await expect(page.getByText(/Round 0/).first()).toBeVisible()
  })

  test('BF-02 · 错误代码 · 判题失败 · Round 0 保持', async ({ page }) => {
    await seedCodeViaRepo(page, PROBLEM_ID, BUGGY_CODE)
    await page.goto(PROBLEM_URL)

    await page.getByRole('button', { name: /运行/ }).click()

    // 至少一个测试用例失败(✗ 标记出现在测试面板)
    await expect(page.locator('text=✗').first()).toBeVisible({
      timeout: 10000,
    })
    // Round badge 仍是 0
    await expect(page.getByText(/Round 0/).first()).toBeVisible()
  })

  test('BF-03 · 正确代码 · 全部通过 · Round 1 出现', async ({ page }) => {
    await seedCodeViaRepo(page, PROBLEM_ID, CORRECT_CODE)
    await page.goto(PROBLEM_URL)

    await page.getByRole('button', { name: /运行/ }).click()

    // Round 1 badge 显示 · 说明 allPassed = true 触发切换
    await expect(page.getByText(/Round 1/).first()).toBeVisible({
      timeout: 10000,
    })
  })
})

test.describe('业务闭环 · 需 LLM · AI 追问', () => {
  test.skip(
    !process.env.DEEPSEEK_API_KEY,
    'DEEPSEEK_API_KEY 未配,跳过 LLM 集成测试',
  )

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.clear()
      } catch {
        // SSR
      }
    })
  })

  test('BF-04 · 触发 Round 0 AI 追问 · 拿到有内容的回复', async ({ page }) => {
    test.setTimeout(60000)

    await seedCodeViaRepo(page, PROBLEM_ID, BUGGY_CODE)
    await page.goto(PROBLEM_URL)

    // 先判题 · 让 AI 有失败上下文
    await page.getByRole('button', { name: /运行/ }).click()
    await expect(page.locator('text=✗').first()).toBeVisible({
      timeout: 10000,
    })

    // Chat 输入并发送
    await page.getByPlaceholder(/Enter 发送/).fill('看看我的代码')
    await page.getByRole('button', { name: '发送' }).click()

    // 等 streaming 状态栏消失(AI 说完)
    await expect(
      page.getByText(/思考中|生成回复|调用|拿到结果/),
    ).toBeHidden({ timeout: 45000 })

    // 最后一个消息气泡应该是 assistant · content 长度 > 20 表示 AI 真的说话了
    const lastBubbleContent = await page
      .locator('div.rounded .whitespace-pre-wrap')
      .last()
      .innerText()
    expect(lastBubbleContent.length).toBeGreaterThan(20)
  })
})
