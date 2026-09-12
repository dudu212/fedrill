import type { ImplProblemMinimal } from '@/lib/types/problem'

const myInstanceof: ImplProblemMinimal = {
  id: 'my-instanceof',
  type: 'implementation',
  category: 'prototype',
  title: '手写 instanceof',
  difficulty: 'easy',
  tags: ['原型链', 'instanceof', '原型'],
  description: `## 要求

实现 \`myInstanceof(obj, Ctor)\`，模拟 \`instanceof\`：沿 \`obj\` 的原型链向上找，判断 \`Ctor.prototype\` 是否在链上。

## 约定 API

\`\`\`ts
function myInstanceof(obj: unknown, Ctor: Function): boolean
\`\`\`

## 示例

\`\`\`js
myInstanceof([], Array) // true
myInstanceof({}, Array) // false
\`\`\`
`,
  requiredAPI: 'myInstanceof',
  starterCode: `function myInstanceof(obj, Ctor) {
  // 你的实现
}`,
  testCases: {
    basic: [
      { name: '数组是 Array 实例', input: [[], { __fn: 'Array' }], expected: true },
      { name: '对象不是 Array 实例', input: [{}, { __fn: 'Array' }], expected: false },
      { name: '对象是 Object 实例', input: [{}, { __fn: 'Object' }], expected: true },
      { name: '数组也是 Object 实例', input: [[], { __fn: 'Object' }], expected: true },
    ],
  },
  edgeCases: [
    { id: 'ec-null-proto', scenario: '原型链走到 null', hint: 'while 循环到 Object.prototype.__proto__ === null 就该返回 false，别死循环' },
    { id: 'ec-primitive', scenario: 'obj 是原始值', hint: '原始值没有原型链，应返回 false（或走装箱）' },
    { id: 'ec-create-null', scenario: 'Object.create(null) 的对象', hint: '无原型链对象 instanceof 任何构造函数都是 false' },
  ],
  followUpPath: { round1: ['ec-null-proto', 'ec-primitive', 'ec-create-null'] },
}

export default myInstanceof
