import { loader } from '@monaco-editor/react'

/**
 * 把 Monaco 从 jsdelivr CDN 重定向到自家 public/monaco/vs
 *
 * public/monaco 由 scripts/copy-monaco.mjs postinstall 时从 node_modules 复制生成,
 * .gitignore 掉不入 git(每次 pnpm install 都会重新生成)。
 *
 * 使用方式:在**任何用 @monaco-editor/react 的页面顶部**加一行:
 *   import '@/lib/monaco/init'
 * 副作用 import,模块加载时执行一次 loader.config,幂等安全。
 *
 * 收益:
 * - 消除对第三方 CDN 的运行时依赖(稳定性 + 独立可控)
 * - CSP 可以收紧到 script-src 'self',不用给 jsdelivr 开洞
 * - 国内节点走 Vercel Edge,首屏更稳
 */
if (typeof window !== 'undefined') {
  loader.config({ paths: { vs: '/monaco/vs' } })
}
