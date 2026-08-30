import { test, expect } from '@playwright/test'

/**
 * 冒烟测试 · Step 3 基础设施验证
 *
 * 目标:确认 SSR 出得来,客户端没有未捕获异常。
 * 不做业务断言——业务流程等 Step 4 装了 Playwright MCP 后让 AI 辅助写。
 *
 * 归属:ADR-009 Tier 1(纯脚手架)
 */
test.describe('冒烟 · 关键页面能加载', () => {
  test('首页渲染', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/./)
  })

  test('chat-demo 无客户端未捕获异常', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.goto('/chat-demo')
    await expect(page.locator('body')).toBeVisible()

    expect(errors, `页面 JS 未捕获异常:\n${errors.join('\n')}`).toEqual([])
  })
})
