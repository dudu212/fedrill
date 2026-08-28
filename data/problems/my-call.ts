import type { ImplProblemMinimal } from '@/lib/types/problem'

const myCall: ImplProblemMinimal = {
  id: 'my-call',
  type: 'implementation',
  category: 'prototype',
  title: '手写 Function.prototype.call',
  difficulty: 'easy',
  tags: ['this', '原型', '函数式'],
  description: `## 要求

实现 \`myCall(fn, thisArg, ...args)\`，效果等同 \`fn.call(thisArg, ...args)\`。请以**函数形式**导出（避免污染 Function 原型）。

## 约定 API

\`\`\`ts
function myCall(fn: Function, thisArg: any, ...args: any[]): any
\`\`\`

## 示例

\`\`\`js
function greet(word) { return word + ', ' + this.name }
myCall(greet, { name: 'Ada' }, 'hi') // "hi, Ada"
\`\`\`
`,
  requiredAPI: 'myCall',
  starterCode: `function myCall(fn, thisArg, ...args) {
  // 你的实现
}`,
  testCases: {
    basic: [
      {
        name: 'this 是对象',
        input: [{ __fn: 'function() { return this.x + 1 }' }, { x: 10 }],
        expected: 11,
      },
      {
        name: '带参数',
        input: [
          { __fn: 'function(a, b) { return this.k + a + b }' },
          { k: 100 },
          1,
          2,
        ],
        expected: 103,
      },
      {
        name: 'null this 用 globalThis',
        input: [{ __fn: 'function() { return typeof globalThis }' }, null],
        expected: 'object',
      },
      {
        name: '原始值 this 被包装为对象',
        input: [{ __fn: 'function() { return typeof this }' }, 42],
        expected: 'object',
      },
      {
        name: '返回 fn 的返回值',
        input: [{ __fn: 'function() { return 42 }' }, {}],
        expected: 42,
      },
    ],
  },
  edgeCases: [
    {
      id: 'ec-symbol-key',
      scenario: '临时把 fn 挂到 thisArg 上，若用普通字符串 key 可能覆盖用户属性',
      hint: '用 Symbol 作为 key，用完 delete',
    },
    {
      id: 'ec-preserve-return',
      scenario: 'fn 内 return 未定义',
      hint: 'myCall 应返回 undefined 而不是 this 或临时挂载对象',
    },
    {
      id: 'ec-strict-mode',
      scenario: '严格模式下 this 传 null / undefined',
      hint: '严格模式不做 this 装箱；实现要不要 opt in？',
    },
  ],
  followUpPath: {
    round1: ['ec-symbol-key', 'ec-preserve-return', 'ec-strict-mode'],
  },
}

export default myCall
