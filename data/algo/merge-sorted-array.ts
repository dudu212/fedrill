import type { AlgorithmProblem } from '@/lib/types/problem'

const mergeSortedArray: AlgorithmProblem = {
  id: 'merge-sorted-array',
  type: 'algorithm',
  title: '合并两个有序数组',
  difficulty: 'easy',
  tags: ['数组', '双指针', '归并'],
  description: `## 要求

实现 \`mergeSortedArray(nums1, nums2)\`，把两个**升序**数组合并成一个升序数组返回。

## 约定 API

\`\`\`ts
function mergeSortedArray(nums1: number[], nums2: number[]): number[]
\`\`\`

## 示例

\`\`\`js
mergeSortedArray([1, 3, 5], [2, 4, 6]) // [1, 2, 3, 4, 5, 6]
\`\`\`
`,
  requiredAPI: 'mergeSortedArray',
  starterCode: `function mergeSortedArray(nums1, nums2) {
  // 你的实现
}`,
  testCases: [
    { name: '交错合并', input: [[1, 3, 5], [2, 4, 6]], expected: [1, 2, 3, 4, 5, 6] },
    { name: '一方全小', input: [[1, 2], [3, 4]], expected: [1, 2, 3, 4] },
    { name: 'nums2 为空', input: [[1], []], expected: [1] },
    { name: 'nums1 为空', input: [[], [1]], expected: [1] },
    { name: '含重复', input: [[1, 2, 3], [1, 2, 3]], expected: [1, 1, 2, 2, 3, 3] },
  ],
  timeLimit: 1000,
  memoryLimit: 256,
  hintLevels: [
    '第一层提示：两个数组都有序，可以用两个指针同时从头部开始走。',
    '第二层提示：每次比较两个指针指向的元素，把较小的放进结果数组。',
    '第三层提示：放进结果后，对应的指针向后移一位。',
    '第四层提示：一个数组走完后，把另一个数组剩余部分直接拼到结果末尾。',
    '第五层提示：这就是「归并」的核心操作，复杂度 O(m+n)。',
  ],
}

export default mergeSortedArray
