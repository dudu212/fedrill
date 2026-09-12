import type { ImplProblemMinimal } from '@/lib/types/problem'

const myNew: ImplProblemMinimal = {
  id: 'my-new',
  type: 'implementation',
  category: 'prototype',
  title: '手写 new',
  difficulty: 'medium',
  tags: ['原型', 'new', '构造函数'],
  description: `## 要求

实现 \`myNew(Ctor, ...args)\`，模拟 \`new\`：创建实例（原型指向 \`Ctor.prototype\`）、执行构造函数、返回实例。

## 约定 API

\`\`\`ts
function myNew<T>(Ctor: new (...args: any[]) => T, ...args: any[]): T
\`\`\`

## 示例

\`\`\`js
function Person(name) { this.name = name }
myNew(Person, 'Tom') // { name: 'Tom' }
\`\`\`
`,
  requiredAPI: 'myNew',
  starterCode: `function myNew(Ctor, ...args) {
  // 你的实现
}`,
  testCases: {
    basic: [
      { name: '创建实例并挂属性', input: [{ __fn: 'function Person(name) { this.name = name }' }, 'Tom'], expected: { name: 'Tom' } },
      { name: '多参数构造', input: [{ __fn: 'function Point(x, y) { this.x = x; this.y = y }' }, 1, 2], expected: { x: 1, y: 2 } },
      { name: '无参构造', input: [{ __fn: 'function Empty() {}' }], expected: {} },
    ],
  },
  edgeCases: [
    { id: 'ec-prototype', scenario: '实例能访问 Ctor.prototype 上的方法', hint: 'new 会把实例 __proto__ 指向 Ctor.prototype，方法挂原型上才共享' },
    { id: 'ec-return-object', scenario: '构造函数显式 return 对象', hint: '构造函数返回对象时应返回该对象，返回原始值则忽略' },
    { id: 'ec-arrow', scenario: '箭头函数不能 new', hint: '箭头函数没有 prototype，new 会抛错' },
  ],
  followUpPath: { round1: ['ec-prototype', 'ec-return-object', 'ec-arrow'] },
}

export default myNew
