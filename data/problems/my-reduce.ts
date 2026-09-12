import type { ImplProblemMinimal } from '@/lib/types/problem'

const myReduce: ImplProblemMinimal = {
  id: 'my-reduce',
  type: 'implementation',
  category: 'util',
  title: '手写 Array.prototype.reduce',
  difficulty: 'medium',
  tags: ['数组', 'reduce', '高阶函数'],
  description: `## 要求

实现 \`myReduce(arr, fn, init)\`，模拟 \`Array.prototype.reduce\`：对每个元素调用 \`fn(acc, cur, index, array)\`，返回累积结果。

## 约定 API

\`\`\`ts
function myReduce<T, U>(arr: T[], fn: (acc: U, cur: T, index: number, arr: T[]) => U, init: U): U
\`\`\`

## 示例

\`\`\`js
myReduce([1, 2, 3], (acc, x) => acc + x, 0) // 6
\`\`\`
`,
  requiredAPI: 'myReduce',
  starterCode: `function myReduce(arr, fn, init) {
  // 你的实现
}`,
  testCases: {
    basic: [
      { name: '求和', input: [[1, 2, 3, 4], { __fn: '(acc, x) => acc + x' }, 0], expected: 10 },
      { name: '求积', input: [[1, 2, 3], { __fn: '(acc, x) => acc * x' }, 1], expected: 6 },
      { name: '空数组返回 init', input: [[], { __fn: '(acc, x) => acc + x' }, 5], expected: 5 },
      { name: '字符串拼接', input: [['a', 'b', 'c'], { __fn: '(acc, x) => acc + x' }, ''], expected: 'abc' },
      { name: '计数', input: [[1, 2, 3], { __fn: '(acc) => acc + 1' }, 0], expected: 3 },
    ],
  },
  edgeCases: [
    { id: 'ec-no-init', scenario: '不传 init（从第一个元素起步）', hint: 'init 缺失时第一个元素当 acc，从 index 1 开始' },
    { id: 'ec-empty-no-init', scenario: '空数组且无 init', hint: '原生 reduce 会抛 TypeError' },
    { id: 'ec-index', scenario: 'fn 的 index / array 参数', hint: '回调第二参是 index、第三参是原数组，注意传对' },
  ],
  followUpPath: { round1: ['ec-no-init', 'ec-empty-no-init', 'ec-index'] },
}

export default myReduce
