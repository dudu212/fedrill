import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Markdown 渲染 —— 基于 react-markdown + remark-gfm。
 *
 * 选型：不手写解析器（成熟领域，手写易漏表格/转义/嵌套等边界），
 * 用 React 生态标准的 react-markdown，直接产出 React 元素、天然无 XSS；
 * remark-gfm 补 GitHub 风格（表格/删除线/任务列表/自动链接）。
 *
 * 通过 components 把渲染结果接回 FEDrill 语义 token：
 * 代码块/行内代码/标题/列表/引用/链接都套用 --color-* 变量，随亮暗主题切换。
 * 题目描述、Agent 对话正文统一用它渲染。
 */

const CODE_BLOCK =
  'my-3 overflow-x-auto rounded-md border border-hairline bg-raised p-3 font-mono text-sm leading-6 text-fg'
const INLINE_CODE =
  'rounded bg-raised px-1.5 py-0.5 font-mono text-[0.85em] text-fg'

const components: Components = {
  pre: ({ children }) => <pre className={CODE_BLOCK}>{children}</pre>,
  code: ({ className, children }) => {
    // 围栏代码块带 language-xxx class（渲染在 pre 内）；行内代码没有
    const isBlock = typeof className === 'string' && className.includes('language-')
    return isBlock ? (
      <code className={className}>{children}</code>
    ) : (
      <code className={INLINE_CODE}>{children}</code>
    )
  },
  h1: ({ children }) => (
    <h1 className="mt-5 mb-2 text-xl font-semibold">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-5 mb-2 text-lg font-semibold">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-4 mb-2 text-base font-semibold">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-4 mb-2 text-sm font-semibold">{children}</h4>
  ),
  h5: ({ children }) => (
    <h5 className="mt-4 mb-2 text-sm font-semibold">{children}</h5>
  ),
  h6: ({ children }) => (
    <h6 className="mt-4 mb-2 text-sm font-semibold">{children}</h6>
  ),
  p: ({ children }) => <p className="my-2">{children}</p>,
  ul: ({ children }) => (
    <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-hairline-strong pl-3 text-muted">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent-bright underline hover:text-accent"
    >
      {children}
    </a>
  ),
}

export function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {text}
    </ReactMarkdown>
  )
}
