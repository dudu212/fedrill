import type { ImplProblemMinimal } from '@/lib/types/problem'

const promiseRace: ImplProblemMinimal = {
  id: 'promise-race',
  type: 'implementation',
  category: 'async',
  title: '手写 Promise.race',
  difficulty: 'medium',
  tags: ['Promise', '异步', '竞速'],
  description: `## 要求

实现 \`myPromiseRace(promises)\`，返回一个 Promise，其状态由**第一个 settle** 的 promise 决定（fulfilled 或 rejected）。

## 约定 API

\`\`\`ts
function myPromiseRace<T>(promises: Promise<T>[]): Promise<T>
\`\`\`

## 示例

\`\`\`js
myPromiseRace([Promise.resolve(1), Promise.resolve(2)]) // 1
\`\`\`
`,
  requiredAPI: 'myPromiseRace',
  starterCode: `function myPromiseRace(promises) {
  // 你的实现
}`,
  testCases: {
    basic: [
      { name: '第一个 resolve 胜出', input: [[{ __val: 'Promise.resolve(1)' }, { __val: 'Promise.resolve(2)' }]], expected: 1 },
      { name: '字符串结果', input: [[{ __val: 'Promise.resolve("a")' }, { __val: 'Promise.resolve("b")' }]], expected: 'a' },
      { name: '单个 promise', input: [[{ __val: 'Promise.resolve([1, 2])' }]], expected: [1, 2] },
      { name: '对象结果', input: [[{ __val: 'Promise.resolve({ x: 1 })' }]], expected: { x: 1 } },
    ],
  },
  edgeCases: [
    { id: 'ec-reject', scenario: '第一个 settle 的是 reject', hint: 'race 是「第一个 settle」而非「第一个 resolve」，reject 也会定终态' },
    { id: 'ec-empty', scenario: '空数组', hint: '原生 race([]) 永远 pending，不会 settle' },
    { id: 'ec-settle-once', scenario: '多个几乎同时 settle', hint: '已 settle 后再来结果应忽略，需一个 settled 哨兵防止二次 resolve' },
  ],
  followUpPath: { round1: ['ec-reject', 'ec-empty', 'ec-settle-once'] },
}

export default promiseRace
