import type { AlgorithmProblem } from '@/lib/types/problem'

const removeDuplicates: AlgorithmProblem = {
  id: 'remove-duplicates',
  type: 'algorithm',
  title: '删除有序数组中的重复项',
  difficulty: 'easy',
  tags: ['数组', '双指针', '去重'],
  description: `## 要求

实现 \`removeDuplicates(nums)\`，删除**升序**数组里的重复元素，返回去重后的新数组（保持顺序，不修改入参）。

## 约定 API

\`\`\`ts
function removeDuplicates(nums: number[]): number[]
\`\`\`

## 示例

\`\`\`js
removeDuplicates([1, 1, 2]) // [1, 2]
\`\`\`
`,
  requiredAPI: 'removeDuplicates',
  starterCode: `function removeDuplicates(nums) {
  // 你的实现
}`,
  testCases: [
    { name: '有重复', input: [[1, 1, 2]], expected: [1, 2] },
    { name: '无重复', input: [[1, 2, 3]], expected: [1, 2, 3] },
    { name: '全重复', input: [[1, 1, 1]], expected: [1] },
    { name: '单元素', input: [[1]], expected: [1] },
    { name: '空数组', input: [[]], expected: [] },
  ],
  timeLimit: 1000,
  memoryLimit: 256,
  hintLevels: [
    '第一层提示：数组已有序，所以重复元素一定相邻。',
    '第二层提示：用双指针——一个记录「去重后写到哪」，一个遍历。',
    '第三层提示：当前元素和上一个「已保留」的元素不同，就把它保留下来。',
    '第四层提示：慢指针 slow 指向下一个可写位置，快指针 fast 逐个扫描。',
    '第五层提示：复杂度 O(n)、空间 O(1)（原地）或 O(n)（返回新数组）。',
  ],
}

export default removeDuplicates
