import type { ImplProblemMinimal } from '@/lib/types/problem'

const deepMerge: ImplProblemMinimal = {
  id: 'deep-merge',
  type: 'implementation',
  category: 'util',
  title: '手写 deepMerge',
  difficulty: 'medium',
  tags: ['合并', '递归', '对象'],
  description: `## 要求

实现 \`deepMerge(target, source)\`，把 \`source\` 深合并进 \`target\`，返回**新对象**（不修改入参）。同名键：基础值 source 覆盖 target，对象递归合并，数组整体替换。

## 约定 API

\`\`\`ts
function deepMerge<T>(target: T, source: T): T
\`\`\`

## 示例

\`\`\`js
deepMerge({ a: 1, b: { x: 1 } }, { b: { y: 2 }, c: 3 })
// { a: 1, b: { x: 1, y: 2 }, c: 3 }
\`\`\`
`,
  requiredAPI: 'deepMerge',
  starterCode: `function deepMerge(target, source) {
  // 你的实现
}`,
  testCases: {
    basic: [
      { name: '顶层同名键覆盖', input: [{ a: 1 }, { a: 2 }], expected: { a: 2 } },
      { name: '互不重叠的键合并', input: [{ a: 1 }, { b: 2 }], expected: { a: 1, b: 2 } },
      { name: '嵌套对象递归合并', input: [{ a: { b: 1 } }, { a: { c: 2 } }], expected: { a: { b: 1, c: 2 } } },
      { name: '数组整体替换', input: [{ a: [1, 2] }, { a: [3] }], expected: { a: [3] } },
      { name: '空 target', input: [{}, { a: 1 }], expected: { a: 1 } },
    ],
  },
  edgeCases: [
    { id: 'ec-mutate', scenario: '是否修改了入参 target / source', hint: '应返回新对象，原对象保持不动（可 Object.assign({}, ...) 起步）' },
    { id: 'ec-nested-array', scenario: '嵌套数组是合并还是替换', hint: '约定数组整体替换而非逐项合并，需要 Array.isArray 分支' },
    { id: 'ec-deep-null', scenario: '深层值为 null / 基本类型', hint: 'null 的 typeof 也是 object，要先判 null 再递归' },
  ],
  followUpPath: { round1: ['ec-mutate', 'ec-nested-array', 'ec-deep-null'] },
}

export default deepMerge
