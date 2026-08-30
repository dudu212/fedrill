import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright 配置。运行 `pnpm test:e2e` 时被读取。
 *
 * 关键决策(与 ADR-009 一致):
 * - testDir: './tests/e2e' —— E2E 独立目录,和 Vitest co-located 单测隔离
 *   (Playwright 有自己的 runner,不能塞进 vitest include)
 * - webServer —— 自动 `pnpm dev`,本地已开着 dev 时会复用(reuseExistingServer)
 * - trace: 'on-first-retry' —— 挂了自动录 DOM/网络/console 回放,调试神器
 * - projects: 只 chromium —— MVP 阶段少装 300MB,上线前再补 firefox/webkit
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
