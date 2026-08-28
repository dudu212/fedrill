import type { ImplProblemMinimal } from '@/lib/types/problem'

const promiseAll: ImplProblemMinimal = {
  id: 'promise-all',
  type: 'implementation',
  category: 'async',
  title: '手写 Promise.all',
  difficulty: 'medium',
  tags: ['Promise', '异步', '并发'],
  description: `## 要求

实现 \`myPromiseAll(iterable)\`，模拟原生 \`Promise.all\`：

- 所有 Promise 都 resolve → 按输入顺序返回结果数组
- 任一 reject → 立即整体 reject，不必等其他 settle
- 非 Promise 值应被自动 wrap
- 空 iterable 应立即 resolve 为 \`[]\`

## 约定 API

\`\`\`ts
function myPromiseAll<T>(iterable: Iterable<T | Promise<T>>): Promise<T[]>
\`\`\`

## 示例

\`\`\`js
await myPromiseAll([Promise.resolve(1), Promise.resolve(2)]) // [1, 2]
await myPromiseAll([])                                        // []
await myPromiseAll([1, Promise.resolve(2), 3])                // [1, 2, 3]
\`\`\`
`,
  requiredAPI: 'myPromiseAll',
  starterCode: `function myPromiseAll(iterable) {
  // 你的实现
}`,
  testCases: {
    basic: [
      {
        name: '空数组立即 resolve 为 []',
        input: [{ __val: '[]' }],
        expected: [],
      },
      {
        name: '单元素 resolve',
        input: [{ __val: '[Promise.resolve(1)]' }],
        expected: [1],
      },
      {
        name: '多元素按输入顺序',
        input: [{ __val: '[Promise.resolve(1), Promise.resolve("x"), Promise.resolve(true)]' }],
        expected: [1, 'x', true],
      },
      {
        name: '混合非 Promise 值也能处理',
        input: [{ __val: '[1, Promise.resolve(2), 3]' }],
        expected: [1, 2, 3],
      },
      {
        name: '延迟 resolve 保持输入顺序',
        input: [
          {
            __val:
              '[new Promise(r => setTimeout(() => r("late"), 20)), Promise.resolve("early")]',
          },
        ],
        expected: ['late', 'early'],
      },
    ],
  },
  edgeCases: [
    {
      id: 'ec-reject-short-circuit',
      scenario: '第 3 个 Promise reject',
      hint: '不能等所有都 settle 再判断；结果 Promise 应立即 reject 到 catch 分支',
    },
    {
      id: 'ec-non-iterable',
      scenario: '入参是 null / 数字',
      hint: '原生会 throw TypeError；你的实现是抛错还是静默返回？',
    },
    {
      id: 'ec-thenable',
      scenario: '数组里的元素是 thenable 但不是 Promise 实例',
      hint: 'Promise.resolve 会认 thenable —— 你的实现呢？',
    },
  ],
  followUpPath: {
    round1: ['ec-reject-short-circuit', 'ec-non-iterable', 'ec-thenable'],
  },
}

export default promiseAll
