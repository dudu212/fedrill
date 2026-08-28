import type { ImplProblemMinimal } from '@/lib/types/problem'

const eventEmitter: ImplProblemMinimal = {
  id: 'event-emitter',
  type: 'implementation',
  category: 'pattern',
  title: '手写 EventEmitter',
  difficulty: 'medium',
  tags: ['发布订阅', '观察者', '设计模式'],
  description: `## 要求

实现一个 \`MyEventEmitter\` 类，支持四个方法：

- \`on(event, fn)\` —— 订阅
- \`emit(event, ...args)\` —— 发布，按注册顺序调用所有 handler
- \`off(event, fn)\` —— 精确移除某个 handler
- \`once(event, fn)\` —— 只触发一次后自动解绑

## 约定 API

为方便测试，测试分发器 \`eventTest(scenario)\` 已在 starterCode 中预置。你**只需实现 MyEventEmitter 类**，不要修改 eventTest。

## 示例

\`\`\`js
const e = new MyEventEmitter()
e.on('x', v => console.log(v))
e.emit('x', 1)  // 1
\`\`\`
`,
  requiredAPI: 'eventTest',
  starterCode: `class MyEventEmitter {
  on(event, fn) { /* TODO */ }
  emit(event, ...args) { /* TODO */ }
  off(event, fn) { /* TODO */ }
  once(event, fn) { /* TODO */ }
}

// —— 以下测试分发器，请勿修改 ——
function eventTest(scenario) {
  const e = new MyEventEmitter()
  const seen = []
  const h = v => seen.push(v)
  switch (scenario) {
    case 'on-emit':
      e.on('x', h); e.emit('x', 1); e.emit('x', 2)
      return seen
    case 'multi-handler':
      e.on('x', v => seen.push('a:' + v))
      e.on('x', v => seen.push('b:' + v))
      e.emit('x', 1)
      return seen
    case 'off':
      e.on('x', h); e.emit('x', 1)
      e.off('x', h); e.emit('x', 2)
      return seen
    case 'once':
      e.once('x', h); e.emit('x', 1); e.emit('x', 2)
      return seen
    case 'other-event-untouched':
      e.on('x', h); e.emit('y', 999)
      return seen
    default:
      return null
  }
}`,
  testCases: {
    basic: [
      { name: 'on + emit 顺序', input: ['on-emit'], expected: [1, 2] },
      { name: '多 handler 同事件', input: ['multi-handler'], expected: ['a:1', 'b:1'] },
      { name: 'off 精确移除', input: ['off'], expected: [1] },
      { name: 'once 只触发一次', input: ['once'], expected: [1] },
      { name: '不同事件互不干扰', input: ['other-event-untouched'], expected: [] },
    ],
  },
  edgeCases: [
    {
      id: 'ec-emit-during-emit',
      scenario: 'handler 内部再 emit 同一事件',
      hint: '迭代过程中改数组是否安全？会不会死循环？',
    },
    {
      id: 'ec-once-off',
      scenario: 'once 注册后又主动 off 同一个 handler',
      hint: '内部包装函数的身份能不能通过原 handler 找到？',
    },
    {
      id: 'ec-multi-same-handler',
      scenario: '同一 handler 用 on 注册多次',
      hint: '一次 emit 应触发几次？off 一次是移除全部还是最早的？',
    },
  ],
  followUpPath: {
    round1: ['ec-emit-during-emit', 'ec-once-off', 'ec-multi-same-handler'],
  },
}

export default eventEmitter
