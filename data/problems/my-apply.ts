import type { ImplProblemMinimal } from '@/lib/types/problem'

const myApply: ImplProblemMinimal = {
  id: 'my-apply',
  type: 'implementation',
  category: 'prototype',
  title: '手写 Function.prototype.apply',
  difficulty: 'medium',
  tags: ['this', 'apply', '函数'],
  description: `## 要求

实现 \`myApply(fn, thisArg, argsArray)\`，模拟 \`Function.prototype.apply\`：以 \`thisArg\` 为 this、\`argsArray\` 为参数调用 \`fn\`，返回结果。

## 约定 API

\`\`\`ts
function myApply<T>(fn: (...args: any[]) => T, thisArg: unknown, argsArray: any[]): T
\`\`\`

## 示例

\`\`\`js
myApply(function(a, b) { return a + b }, null, [2, 3]) // 5
\`\`\`
`,
  requiredAPI: 'myApply',
  starterCode: `function myApply(fn, thisArg, argsArray) {
  // 你的实现
}`,
  testCases: {
    basic: [
      { name: '求和', input: [{ __fn: 'function(a, b) { return a + b }' }, null, [2, 3]], expected: 5 },
      { name: '求差', input: [{ __fn: 'function(a, b) { return a - b }' }, null, [10, 3]], expected: 7 },
      { name: 'this 绑定', input: [{ __fn: 'function() { return this.base + 1 }' }, { base: 10 }, []], expected: 11 },
      { name: '无参函数', input: [{ __fn: 'function() { return 42 }' }, null, []], expected: 42 },
    ],
  },
  edgeCases: [
    { id: 'ec-null-this', scenario: 'thisArg 为 null / undefined', hint: '非严格模式下 null/undefined 会被替换成全局对象' },
    { id: 'ec-primitive-this', scenario: 'thisArg 是原始值', hint: '原始值 this 会被装箱成包装对象' },
    { id: 'ec-not-array', scenario: 'argsArray 不是数组', hint: 'apply 第二参必须是数组，传错应报 TypeError' },
  ],
  followUpPath: { round1: ['ec-null-this', 'ec-primitive-this', 'ec-not-array'] },
}

export default myApply
