import type { AlgorithmProblem } from '@/lib/types/problem'

const climbingStairs: AlgorithmProblem = {
  id: 'climbing-stairs',
  type: 'algorithm',
  title: '爬楼梯',
  difficulty: 'easy',
  tags: ['动态规划', '斐波那契'],
  description: `## 要求

实现 \`climbStairs(n)\`，每次可以爬 1 或 2 级台阶，返回爬到第 n 级有多少种不同方法。

## 约定 API

\`\`\`ts
function climbStairs(n: number): number
\`\`\`

## 示例

\`\`\`js
climbStairs(3) // 3（1+1+1 / 1+2 / 2+1）
\`\`\`
`,
  requiredAPI: 'climbStairs',
  starterCode: `function climbStairs(n) {
  // 你的实现
}`,
  testCases: [
    { name: 'n=1', input: [1], expected: 1 },
    { name: 'n=2', input: [2], expected: 2 },
    { name: 'n=3', input: [3], expected: 3 },
    { name: 'n=5', input: [5], expected: 8 },
    { name: 'n=10', input: [10], expected: 89 },
  ],
  timeLimit: 1000,
  memoryLimit: 256,
  hintLevels: [
    '第一层提示：爬到第 n 级，最后一步要么从 n-1 跨 1 级、要么从 n-2 跨 2 级。',
    '第二层提示：所以 f(n) = f(n-1) + f(n-2)，这是递推关系。',
    '第三层提示：边界 f(1)=1、f(2)=2。',
    '第四层提示：用两个变量滚动保存前两个值，避免递归重复计算。',
    '第五层提示：这就是斐波那契数列，动态规划最经典的入门题，O(n) 时间 O(1) 空间。',
  ],
}

export default climbingStairs
