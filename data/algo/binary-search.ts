import type { AlgorithmProblem } from '@/lib/types/problem'

const binarySearch: AlgorithmProblem = {
  id: 'binary-search',
  type: 'algorithm',
  title: '二分查找',
  difficulty: 'easy',
  tags: ['查找', '二分', '数组'],
  description: `## 要求

实现 \`binarySearch(nums, target)\`，在**升序**数组里二分查找 target，返回其下标；不存在返回 -1。

## 约定 API

\`\`\`ts
function binarySearch(nums: number[], target: number): number
\`\`\`

## 示例

\`\`\`js
binarySearch([1, 3, 5, 7, 9], 5) // 2
binarySearch([1, 3, 5, 7, 9], 2) // -1
\`\`\`
`,
  requiredAPI: 'binarySearch',
  starterCode: `function binarySearch(nums, target) {
  // 你的实现
}`,
  testCases: [
    { name: '找到中间元素', input: [[1, 3, 5, 7, 9], 5], expected: 2 },
    { name: '不存在', input: [[1, 3, 5, 7, 9], 2], expected: -1 },
    { name: '单元素命中', input: [[1], 1], expected: 0 },
    { name: '单元素未命中', input: [[1], 0], expected: -1 },
    { name: '末尾元素', input: [[2, 4, 6, 8], 8], expected: 3 },
  ],
  timeLimit: 1000,
  memoryLimit: 256,
  hintLevels: [
    '第一层提示：二分查找的前提是数组有序，核心是「每次砍掉一半」。',
    '第二层提示：用左右两个指针 left / right 表示当前查找区间。',
    '第三层提示：取中间 mid = (left + right) 的下取整，和 target 比较。',
    '第四层提示：nums[mid] < target 说明在右半，left = mid + 1；否则 right = mid - 1。',
    '第五层提示：注意循环条件是 left <= right，以及 mid 的溢出写法 left + ((right-left)>>1)。',
  ],
}

export default binarySearch
