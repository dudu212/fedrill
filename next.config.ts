import type { NextConfig } from 'next'

/**
 * Content Security Policy 白名单。浏览器强制的深度防御层,
 * 挡"XSS 之后攻击者试图 fetch 外部 · 加载外部 script · 被 iframe"。
 *
 * 特别说明 · Monaco Editor:
 * @monaco-editor/react 默认从 https://cdn.jsdelivr.net 加载 Monaco 主脚本、
 * 语法 worker、CSS、字体。所以 script/style/font/worker/connect 都要加 jsdelivr。
 * (未来 M2b 优化时可换成自宿主 Monaco · public/monaco-editor/vs,消除对 CDN 的依赖)
 *
 * 每条的语义:
 * - default-src 'self'                     默认所有资源只准同域
 * - script-src ... unsafe-* + jsdelivr     Next.js/Monaco 需要 inline + eval + CDN
 * - style-src ... unsafe-inline + jsdelivr Tailwind + Monaco CSS
 * - connect-src ... deepseek + jsdelivr    fetch 白名单:BYOK 直连 + Monaco 动态模块
 * - worker-src ... blob: + jsdelivr        Web Worker 沙箱 + Monaco 语法 worker
 * - img-src ... data: blob:                base64 图片(Monaco 内嵌 icon)
 * - font-src ... data: + jsdelivr          Geist/Monaco 字体
 * - frame-ancestors 'none'                 不允许被 iframe · 防 clickjacking + 保护 localStorage
 */
const CDN = 'https://cdn.jsdelivr.net'

const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${CDN}`,
  `style-src 'self' 'unsafe-inline' ${CDN}`,
  `connect-src 'self' https://api.deepseek.com ${CDN}`,
  `worker-src 'self' blob: ${CDN}`,
  "img-src 'self' data: blob:",
  `font-src 'self' data: ${CDN}`,
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
