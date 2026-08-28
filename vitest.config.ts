import { defineConfig } from 'vitest/config'
import path from 'node:path'

/**
 * Vitest 配置。运行 `pnpm test` 时被读取。
 *
 * 关键决策见 CLAUDE.md 与 docs/decisions/：
 * - environment: 'happy-dom' —— SessionRepo 需要 window.localStorage
 * - globals: false —— 显式 import { it, expect } from 'vitest'，避免全局污染
 * - alias @/* —— 与项目 tsconfig.json 保持一致
 */
export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: false,
    include: ['lib/**/*.test.ts', 'lib/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
