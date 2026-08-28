import type { ImplProblemMinimal } from '@/lib/types/problem'

const flat: ImplProblemMinimal = {
  id: 'flat',
  type: 'implementation',
  category: 'util',
  title: '手写 Array.prototype.flat',
  difficulty: 'easy',
  tags: ['数组', '递归', '扁平化'],
  description: `## 要求

实现 \`myFlat(arr, depth = 1)\`，按 depth 层数展平嵌套数组。

## 约定 API

\`\`\`ts
function myFlat<T>(arr: T[], depth?: number): T[]
\`\`\`

## 示例

\`\`\`js
myFlat([1, [2, 3]])                    // [1, 2, 3]
myFlat([1, [2, [3]]], 1)               // [1, 2, [3]]
myFlat([1, [2, [3, [4]]]], Infinity)   // [1, 2, 3, 4]
\`\`\`
`,
  requiredAPI: 'myFlat',
  starterCode: `function myFlat(arr, depth = 1) {
  // 你的实现
}`,
  testCases: {
    basic: [
      { name: '默认 depth = 1', input: [[1, [2, 3]]], expected: [1, 2, 3] },
      { name: '不足以完全展平', input: [[1, [2, [3]]], 1], expected: [1, 2, [3]] },
      { name: 'depth = 2', input: [[1, [2, [3, [4]]]], 2], expected: [1, 2, 3, [4]] },
      { name: 'depth = Infinity', input: [[1, [2, [3, [4]]]], Infinity], expected: [1, 2, 3, 4] },
      { name: '空数组', input: [[]], expected: [] },
    ],
  },
  edgeCases: [
    {
      id: 'ec-sparse',
      scenario: '稀疏数组 [1, , 2]',
      hint: '原生 flat 会跳过 empty slot，你的实现呢？',
    },
    {
      id: 'ec-non-array-iterable',
      scenario: '嵌套里有字符串 [1, "abc", [2]]',
      hint: '"abc" 是可迭代但不是数组，不应被展开',
    },
    {
      id: 'ec-depth-0',
      scenario: 'depth = 0',
      hint: '应返回浅拷贝而不是原数组，语义要一致',
    },
  ],
  followUpPath: {
    round1: ['ec-sparse', 'ec-non-array-iterable', 'ec-depth-0'],
  },
}

export default flat
