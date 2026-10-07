import type { ImplProblemMinimal } from '@/lib/types/problem'

const arrayToTree: ImplProblemMinimal = {
  id: 'array-to-tree',
  type: 'implementation',
  category: 'util',
  title: '数组转树形结构',
  difficulty: 'medium',
  tags: ['树', '数组', '递归'],
  description: `## 要求

实现 \`arrayToTree(items)\`，把扁平数组转成树形结构。每个元素有 \`id\` 和 \`pid\`（父节点 id，顶层 pid 为 0）。返回树，**每个节点都带 \`children\` 数组**（叶子为空数组）。

## 约定 API

\`\`\`ts
function arrayToTree<T>(items: Array<T & { id: number; pid: number }>): Array<T & { id: number; pid: number; children: unknown[] }>
\`\`\`

## 示例

\`\`\`js
arrayToTree([
  { id: 1, pid: 0 },
  { id: 2, pid: 1 },
  { id: 3, pid: 1 },
])
// [{ id: 1, pid: 0, children: [{ id: 2, pid: 1, children: [] }, { id: 3, pid: 1, children: [] }] }]
\`\`\`
`,
  requiredAPI: 'arrayToTree',
  starterCode: `function arrayToTree(items) {
  // 你的实现
}`,
  testCases: {
    basic: [
      {
        name: '两层树',
        input: [[{ id: 1, pid: 0 }, { id: 2, pid: 1 }, { id: 3, pid: 1 }]],
        expected: [
          {
            id: 1,
            pid: 0,
            children: [
              { id: 2, pid: 1, children: [] },
              { id: 3, pid: 1, children: [] },
            ],
          },
        ],
      },
      {
        name: '多层嵌套',
        input: [[{ id: 1, pid: 0 }, { id: 2, pid: 1 }, { id: 3, pid: 2 }]],
        expected: [
          {
            id: 1,
            pid: 0,
            children: [{ id: 2, pid: 1, children: [{ id: 3, pid: 2, children: [] }] }],
          },
        ],
      },
      {
        name: '多个根节点',
        input: [[{ id: 1, pid: 0 }, { id: 2, pid: 0 }]],
        expected: [
          { id: 1, pid: 0, children: [] },
          { id: 2, pid: 0, children: [] },
        ],
      },
      {
        name: '空数组',
        input: [[]],
        expected: [],
      },
    ],
  },
  edgeCases: [
    { id: 'ec-mutate', scenario: '是否修改了入参 items', hint: '若直接给原对象挂 children 会污染入参，考虑复制节点或用 Map 索引' },
    { id: 'ec-out-of-order', scenario: '子节点出现在父节点之前', hint: '先建 id→节点 的 Map 索引，再统一挂载，就能处理乱序输入' },
    { id: 'ec-orphan', scenario: 'pid 指向不存在的父节点', hint: '孤儿节点应作为根节点返回还是丢弃？约定清楚' },
  ],
  followUpPath: { round1: ['ec-mutate', 'ec-out-of-order', 'ec-orphan'] },
}

export default arrayToTree
