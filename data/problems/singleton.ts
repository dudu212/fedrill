import type { ImplProblemMinimal } from '@/lib/types/problem'

const singleton: ImplProblemMinimal = {
  id: 'singleton',
  type: 'implementation',
  category: 'pattern',
  title: '手写单例模式',
  difficulty: 'easy',
  tags: ['单例', '设计模式', '闭包'],
  description: `## 要求

实现 \`getSingleton()\`，多次调用返回**同一个实例**（惰性初始化：第一次调用才创建）。

## 约定 API

\`\`\`ts
function getSingleton(): { count: number }
\`\`\`

## 示例

\`\`\`js
const a = getSingleton()
const b = getSingleton()
a === b // true —— 同一个对象
\`\`\`
`,
  requiredAPI: 'getSingleton',
  starterCode: `let instance = null

function getSingleton() {
  // 你的实现
}`,
  testCases: {
    basic: [
      { name: '返回实例', input: [], expected: { count: 0 } },
    ],
  },
  edgeCases: [
    { id: 'ec-identity', scenario: '多次调用返回同一引用', hint: 'instance 用闭包保存，第二次调用直接返回已有实例，不新建' },
    { id: 'ec-lazy', scenario: '惰性初始化（首次调用才创建）', hint: '不要模块加载时就创建，第一次 getSingleton() 时才创建' },
    { id: 'ec-isolate', scenario: 'instance 的存放位置', hint: '单例要共享，instance 必须放在模块级闭包而非函数内局部变量' },
  ],
  followUpPath: { round1: ['ec-identity', 'ec-lazy', 'ec-isolate'] },
}

export default singleton
