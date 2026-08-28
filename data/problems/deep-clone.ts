import type { ImplProblemMinimal } from '@/lib/types/problem'

const deepClone: ImplProblemMinimal = {
  id: 'deep-clone',
  type: 'implementation',
  category: 'util',
  title: '手写 deepClone',
  difficulty: 'medium',
  tags: ['克隆', '递归', '引用类型'],
  description: `## 要求

实现一个 \`myDeepClone(obj)\`，深拷贝任意可 JSON 序列化的对象与数组。

## 约定 API

\`\`\`ts
function myDeepClone<T>(obj: T): T
\`\`\`

## 示例

\`\`\`js
const a = { x: 1, nested: { y: [1, 2] } }
const b = myDeepClone(a)
b.nested.y.push(3)
a.nested.y // [1, 2]  —— 原对象未被污染
\`\`\`
`,
  requiredAPI: 'myDeepClone',
  starterCode: `function myDeepClone(obj) {
  // 你的实现
}`,
  testCases: {
    basic: [
      {
        name: '基础对象',
        input: [{ a: 1, b: 'x' }],
        expected: { a: 1, b: 'x' },
      },
      {
        name: '嵌套对象 + 数组',
        input: [{ a: 1, nested: { b: [1, 2, { c: 3 }] } }],
        expected: { a: 1, nested: { b: [1, 2, { c: 3 }] } },
      },
      {
        name: 'null 与原始值',
        input: [null],
        expected: null,
      },
      {
        name: '数组顶层',
        input: [[1, [2, 3], { a: 4 }]],
        expected: [1, [2, 3], { a: 4 }],
      },
    ],
  },
  edgeCases: [
    {
      id: 'ec-cycle',
      scenario: '对象含循环引用（obj.self = obj）',
      hint: '试想直接递归会栈溢出，需要用 Map/WeakMap 记录已拷贝的引用',
    },
    {
      id: 'ec-date',
      scenario: '值里有 Date / RegExp',
      hint: 'new Date() 走通用 for-in 会拷贝成空对象，需要 instanceof 分支',
    },
    {
      id: 'ec-symbol-key',
      scenario: '对象含 Symbol 作为 key',
      hint: 'Object.keys 拿不到 Symbol，得用 Reflect.ownKeys 或 Object.getOwnPropertySymbols',
    },
  ],
  followUpPath: {
    round1: ['ec-cycle', 'ec-date', 'ec-symbol-key'],
  },
}

export default deepClone
