import type { NextConfig } from 'next'

/**
 * Content Security Policy 白名单。浏览器强制的深度防御层,
 * 挡"XSS 之后攻击者试图 fetch 外部 · 加载外部 script · 被 iframe"。
 *
 * Monaco 已经 self-host(见 scripts/copy-monaco.mjs + lib/monaco/init.ts),
 * 所以 CSP 全部收紧到 self,不再给任何第三方 CDN 开洞。
 *
 * 每条的语义:
 * - default-src 'self'                 默认所有资源只准同域
 * - script-src ... unsafe-*            Next.js dev HMR + Monaco eval 需要
 * - style-src ... unsafe-inline        Tailwind + Monaco 内联 style
 * - connect-src ... deepseek           fetch 白名单:BYOK 直连 DeepSeek
 * - worker-src ... blob:               Web Worker(沙箱 + Monaco 语法 worker)
 * - img-src ... data: blob:            base64 图片(Monaco 内嵌 icon)
 * - font-src ... data:                 内联字体
 * - frame-ancestors 'none'             不允许被 iframe · 防 clickjacking + 保护 localStorage
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' https://api.deepseek.com",
  "worker-src 'self' blob:",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // 全站生效
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: CSP },
          // 顺便加两条低门槛的安全头
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
}

export default nextConfig
