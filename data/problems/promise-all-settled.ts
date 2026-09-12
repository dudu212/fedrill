import type { ImplProblemMinimal } from '@/lib/types/problem'

const promiseAllSettled: ImplProblemMinimal = {
  id: 'promise-all-settled',
  type: 'implementation',
  category: 'async',
  title: '手写 Promise.allSettled',
  difficulty: 'medium',
  tags: ['Promise', '异步', 'allSettled'],
  description: `## 要求

实现 \`myPromiseAllSettled(promises)\`，等所有 promise settle 后，返回每个结果数组 \`{ status: 'fulfilled', value } 或 { status: 'rejected', reason }\`，**整体永不 reject**。

## 约定 API

\`\`\`ts
function myPromiseAllSettled<T>(promises: Promise<T>[]): Promise<Array<{ status: 'fulfilled', value: T } | { status: 'rejected', reason: unknown }>>
\`\`\`

## 示例

\`\`\`js
myPromiseAllSettled([Promise.resolve(1), Promise.reject('err')])
// [{ status: 'fulfilled', value: 1 }, { status: 'rejected', reason: 'err' }]
\`\`\`
`,
  requiredAPI: 'myPromiseAllSettled',
  starterCode: `function myPromiseAllSettled(promises) {
  // 你的实现
}`,
  testCases: {
    basic: [
      { name: '全部 fulfilled', input: [[{ __val: 'Promise.resolve(1)' }, { __val: 'Promise.resolve(2)' }]], expected: [{ status: 'fulfilled', value: 1 }, { status: 'fulfilled', value: 2 }] },
      { name: '单个 fulfilled', input: [[{ __val: 'Promise.resolve("a")' }]], expected: [{ status: 'fulfilled', value: 'a' }] },
      { name: '空数组', input: [[]], expected: [] },
      { name: '对象值', input: [[{ __val: 'Promise.resolve({ x: 1 })' }]], expected: [{ status: 'fulfilled', value: { x: 1 } }] },
    ],
  },
  edgeCases: [
    { id: 'ec-reject', scenario: '有 rejected 的 promise', hint: 'rejected 记 {status:"rejected", reason}，整体不 reject，每个都要 catch 兜住' },
    { id: 'ec-mixed', scenario: 'fulfilled + rejected 混合', hint: '每个 promise 都要 then + catch，结果按原顺序排' },
    { id: 'ec-order', scenario: '结果顺序', hint: '结果顺序 = 传入顺序，不是 settle 先后' },
  ],
  followUpPath: { round1: ['ec-reject', 'ec-mixed', 'ec-order'] },
}

export default promiseAllSettled
