import type { ImplProblemMinimal } from '@/lib/types/problem'

const promisePool: ImplProblemMinimal = {
  id: 'promise-pool',
  type: 'implementation',
  category: 'async',
  title: 'Promise 并发控制',
  difficulty: 'medium',
  tags: ['Promise', '异步', '并发'],
  description: `## 要求

实现 \`promisePool(tasks, max)\`，控制并发执行：\`tasks\` 是返回 Promise 的函数数组，\`max\` 是最大并发数。返回 Promise，结果数组**顺序与输入一致**；全部成功才 resolve，任一失败立即 reject。

## 约定 API

\`\`\`ts
function promisePool<T>(tasks: Array<() => Promise<T>>, max: number): Promise<T[]>
\`\`\`

## 示例

\`\`\`js
const tasks = [() => Promise.resolve(1), () => Promise.resolve(2)]
promisePool(tasks, 1) // 串行执行，结果 [1, 2]
\`\`\`
`,
  requiredAPI: 'promisePool',
  starterCode: `function promisePool(tasks, max) {
  // 你的实现
}`,
  testCases: {
    basic: [
      {
        name: '三个任务 max=2',
        input: [[{ __fn: '() => Promise.resolve(1)' }, { __fn: '() => Promise.resolve(2)' }, { __fn: '() => Promise.resolve(3)' }], 2],
        expected: [1, 2, 3],
      },
      {
        name: 'max=1 串行',
        input: [[{ __fn: '() => Promise.resolve("a")' }, { __fn: '() => Promise.resolve("b")' }], 1],
        expected: ['a', 'b'],
      },
      {
        name: '单个任务',
        input: [[{ __fn: '() => Promise.resolve(9)' }], 1],
        expected: [9],
      },
      {
        name: '空任务数组',
        input: [[], 3],
        expected: [],
      },
    ],
  },
  edgeCases: [
    { id: 'ec-order', scenario: '结果顺序是否与输入一致', hint: '不能谁先完成谁先 push，要用下标占位保证顺序' },
    { id: 'ec-reject', scenario: '任一任务 reject 时', hint: '应立即 reject 整个结果，且已完成的要处理干净' },
    { id: 'ec-max-limit', scenario: '同时真正跑着的任务数是否 ≤ max', hint: '用 running 计数，完成任务后补下一个，直到都跑完' },
  ],
  followUpPath: { round1: ['ec-order', 'ec-reject', 'ec-max-limit'] },
}

export default promisePool
