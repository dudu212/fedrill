import type { ImplProblemMinimal } from '@/lib/types/problem'

const promiseRetry: ImplProblemMinimal = {
  id: 'promise-retry',
  type: 'implementation',
  category: 'async',
  title: 'Promise 重试机制',
  difficulty: 'medium',
  tags: ['Promise', '异步', '重试'],
  description: `## 要求

实现 \`retry(fn, times, delay)\`，\`fn\` 返回 Promise。失败后等待 \`delay\` 毫秒再重试，最多重试 \`times\` 次（总共最多调用 times+1 次）。成功则 resolve；全部失败则 reject 最后一次错误。

## 约定 API

\`\`\`ts
function retry<T>(fn: () => Promise<T>, times: number, delay: number): Promise<T>
\`\`\`

## 示例

\`\`\`js
// fn 第一次失败、第二次成功
retry(fn, 1, 100) // 失败后等 100ms 重试，最终 resolve
\`\`\`
`,
  requiredAPI: 'retry',
  starterCode: `function retry(fn, times, delay) {
  // 你的实现
}`,
  testCases: {
    basic: [
      {
        name: '第一次失败第二次成功',
        input: [{ __fn: '(function(){ let i = 0; return () => i++ === 0 ? Promise.reject("err") : Promise.resolve("ok") })()' }, 1, 10],
        expected: 'ok',
      },
      {
        name: '首次就成功',
        input: [{ __fn: '() => Promise.resolve(42)' }, 2, 10],
        expected: 42,
      },
      {
        name: '失败两次第三次成功',
        input: [{ __fn: '(function(){ let i = 0; return () => i++ < 2 ? Promise.reject("err") : Promise.resolve("done") })()' }, 2, 10],
        expected: 'done',
      },
    ],
  },
  edgeCases: [
    { id: 'ec-all-fail', scenario: '重试全部失败', hint: '应 reject 最后一次错误，而不是第一次或吞掉' },
    { id: 'ec-delay', scenario: '重试是否真的等待了 delay', hint: '用 setTimeout 延迟，注意 timer 在成功/失败后要清理' },
    { id: 'ec-times-zero', scenario: 'times = 0 时', hint: '不重试，失败直接 reject（首次调用是唯一一次）' },
  ],
  followUpPath: { round1: ['ec-all-fail', 'ec-delay', 'ec-times-zero'] },
}

export default promiseRetry
