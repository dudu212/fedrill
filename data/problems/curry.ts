import type { ImplProblemMinimal } from '@/lib/types/problem'

const curry: ImplProblemMinimal = {
  id: 'curry',
  type: 'implementation',
  category: 'util',
  title: '手写 curry 柯里化',
  difficulty: 'medium',
  tags: ['函数', '柯里化', '闭包'],
  description: `## 要求

实现 \`curry(fn)\`，把多参函数转成柯里化函数：可以逐个传参，参数凑够 fn 的形参个数才执行并返回结果。

## 约定 API

\`\`\`ts
function curry(fn: (...args: any[]) => any): (...args: any[]) => any
\`\`\`

## 示例

\`\`\`js
const add = (a, b, c) => a + b + c
const curried = curry(add)
curried(1)(2)(3)   // 6
curried(1, 2)(3)   // 6
\`\`\`
`,
  requiredAPI: 'curry',
  starterCode: `function curry(fn) {
  // 你的实现
}`,
  testCases: {
    basic: [
      {
        name: '逐个传参',
        input: [],
        expected: null,
        script: `(curry) => {
          const add = (a, b, c) => a + b + c
          const c = curry(add)
          return c(1)(2)(3) === 6
        }`,
      },
      {
        name: '一次传多个',
        input: [],
        expected: null,
        script: `(curry) => {
          const add = (a, b, c) => a + b + c
          const c = curry(add)
          return c(1, 2)(3) === 6 && c(1)(2, 3) === 6
        }`,
      },
    ],
  },
  edgeCases: [
    { id: 'ec-arity', scenario: 'fn 形参个数如何确定', hint: '用 fn.length 拿形参个数，参数凑够就执行' },
    { id: 'ec-this', scenario: 'this 绑定', hint: '柯里化后的函数作为方法调用时 this 是否透传' },
    { id: 'ec-zero-arity', scenario: 'fn 没有形参', hint: '形参为 0 的函数，curry 后调用一次就执行' },
  ],
  followUpPath: { round1: ['ec-arity', 'ec-this', 'ec-zero-arity'] },
}

export default curry
