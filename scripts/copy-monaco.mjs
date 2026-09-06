#!/usr/bin/env node
/**
 * postinstall · 从 node_modules/monaco-editor/min 复制 Monaco 主体到 public/monaco。
 *
 * 目的:上线时 Monaco 从自家域 fedrill.vercel.app/monaco/vs/... 加载,
 * 而不是默认的 jsdelivr CDN。收益:
 * - 消除第三方 CDN 依赖(稳定性 + 独立可控)
 * - CSP 可以收紧到 script-src 'self',不用给 jsdelivr 开洞
 * - 国内节点走 Vercel Edge · 首屏更稳
 *
 * public/monaco 加进 .gitignore · 每次 pnpm install 都会重新生成。
 */
import { cpSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const src = resolve('node_modules/monaco-editor/min')
const dst = resolve('public/monaco')

if (!existsSync(src)) {
  console.warn(`⚠ Monaco source not found: ${src} · skipping copy`)
  process.exit(0)
}

cpSync(src, dst, { recursive: true, force: true })
console.log(`✓ Monaco copied · ${src} → ${dst}`)
