import type { ImplProblemMinimal } from '@/lib/types/problem'

const asyncSeries: ImplProblemMinimal = {
  id: 'async-series',
  type: 'implementation',
  category: 'async',
  title: '手写异步串行执行',
  difficulty: 'medium',
  tags: ['Promise', '异步', '串行'],
  description: `## 要求

实现 \`asyncSeries(fns)\`，接收一个返回 Promise 的函数数组，**串行**执行（前一个 resolve 后才执行下一个），返回结果数组。

## 约定 API

\`\`\`ts
function asyncSeries<T>(fns: Array<() => Promise<T>>): Promise<T[]>
\`\`\`

## 示例

\`\`\`js
asyncSeries([() => Promise.resolve(1), () => Promise.resolve(2)]) // [1, 2]
\`\`\`
`,
  requiredAPI: 'asyncSeries',
  starterCode: `function asyncSeries(fns) {
  // 你的实现
}`,
  testCases: {
    basic: [
      { name: '两个异步函数串行', input: [[{ __fn: '() => Promise.resolve(1)' }, { __fn: '() => Promise.resolve(2)' }]], expected: [1, 2] },
      { name: '单个函数', input: [[{ __fn: '() => Promise.resolve("a")' }]], expected: ['a'] },
      { name: '空数组', input: [[]], expected: [] },
      { name: '三个函数', input: [[{ __fn: '() => Promise.resolve(1)' }, { __fn: '() => Promise.resolve(2)' }, { __fn: '() => Promise.resolve(3)' }]], expected: [1, 2, 3] },
    ],
  },
  edgeCases: [
    { id: 'ec-serial', scenario: '串行（后一个依赖前一个）', hint: '串行意味着用 reduce 链式 then，而不是 Promise.all 并行' },
    { id: 'ec-reject', scenario: '中间某个 reject', hint: 'reject 应立即终止并向外 reject，后续函数不执行' },
    { id: 'ec-sync-value', scenario: 'fn 返回同步值而非 Promise', hint: '应 Promise.resolve 包一层，兼容同步返回值' },
  ],
  followUpPath: { round1: ['ec-serial', 'ec-reject', 'ec-sync-value'] },
}

export default asyncSeries
