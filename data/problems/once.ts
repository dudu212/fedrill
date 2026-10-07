import type { ImplProblemMinimal } from '@/lib/types/problem'

const once: ImplProblemMinimal = {
  id: 'once',
  type: 'implementation',
  category: 'util',
  title: '手写 once 函数',
  difficulty: 'easy',
  tags: ['函数', '记忆化', '闭包'],
  description: `## 要求

实现 \`once(fn)\`，返回一个新函数，该函数**只执行 fn 一次**，后续调用直接返回第一次的结果。

## 约定 API

\`\`\`ts
function once<T>(fn: (...args: any[]) => T): (...args: any[]) => T
\`\`\`

## 示例

\`\`\`js
const init = once(() => { console.log('init'); return 1 })
init() // 执行，返回 1
init() // 不再执行，返回 1
\`\`\`
`,
  requiredAPI: 'once',
  starterCode: `function once(fn) {
  // 你的实现
}`,
  testCases: {
    basic: [
      {
        name: '只执行一次并记忆结果',
        input: [],
        expected: null,
        script: `(once) => {
          let calls = 0
          const f = once((x) => { calls++; return x * 2 })
          const r1 = f(2)
          const r2 = f(10)
          return r1 === 4 && r2 === 4 && calls === 1
        }`,
      },
      {
        name: '多次调用返回同一结果',
        input: [],
        expected: null,
        script: `(once) => {
          const f = once(() => Math.random())
          return f() === f() && f() === f()
        }`,
      },
    ],
  },
  edgeCases: [
    { id: 'ec-args', scenario: '第一次调用时的参数', hint: '第一次调用要把参数传给 fn，后续调用忽略新参数' },
    { id: 'ec-this', scenario: 'this 绑定是否透传', hint: 'once 包装后的函数作为方法调用时，this 应指向调用者' },
    { id: 'ec-error', scenario: 'fn 抛异常时', hint: '异常应照常抛出，且不缓存失败结果（约定清楚）' },
  ],
  followUpPath: { round1: ['ec-args', 'ec-this', 'ec-error'] },
}

export default once
