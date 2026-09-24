import type { AlgorithmProblem } from '@/lib/types/problem'

const maxSubarray: AlgorithmProblem = {
  id: 'max-subarray',
  type: 'algorithm',
  title: '最大子数组和',
  difficulty: 'medium',
  tags: ['动态规划', '数组', 'Kadane'],
  description: `## 要求

实现 \`maxSubArray(nums)\`，找出一个具有最大和的**连续子数组**（至少一个元素），返回其最大和。

## 约定 API

\`\`\`ts
function maxSubArray(nums: number[]): number
\`\`\`

## 示例

\`\`\`js
maxSubArray([-2, 1, -3, 4, -1, 2, 1, -5, 4]) // 6（子数组 [4,-1,2,1]）
\`\`\`
`,
  requiredAPI: 'maxSubArray',
  starterCode: `function maxSubArray(nums) {
  // 你的实现
}`,
  testCases: [
    { name: '混合正负', input: [[-2, 1, -3, 4, -1, 2, 1, -5, 4]], expected: 6 },
    { name: '单元素正数', input: [[1]], expected: 1 },
    { name: '单元素负数', input: [[-1]], expected: -1 },
    { name: '全正数', input: [[5, 4, -1, 7, 8]], expected: 23 },
    { name: '全负数', input: [[-2, -1]], expected: -1 },
  ],
  timeLimit: 1000,
  memoryLimit: 256,
  hintLevels: [
    '第一层提示：暴力是枚举所有子数组求和，但 O(n²) 太慢。',
    '第二层提示：思考「以每个元素结尾的最大子数组和」怎么由前一个推出。',
    '第三层提示：以 i 结尾的最大和 = max(nums[i], 以 i-1 结尾的最大和 + nums[i])。',
    '第四层提示：用一个变量 current 滚动记录「以当前元素结尾的最大和」，一个变量 max 记录全局最大。',
    '第五层提示：这就是 Kadane 算法，O(n) 时间 O(1) 空间；注意全负数时不能取空数组。',
  ],
}

export default maxSubarray
