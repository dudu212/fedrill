import type { AlgorithmProblem } from '@/lib/types/problem'

const selectionSort: AlgorithmProblem = {
  id: 'selection-sort',
  type: 'algorithm',
  title: '选择排序',
  difficulty: 'easy',
  tags: ['排序', '数组', '选择'],
  description: `## 要求

实现 \`selectionSort(arr)\`，用选择排序把数组升序排列，返回**新数组**（不修改入参）。

## 约定 API

\`\`\`ts
function selectionSort(arr: number[]): number[]
\`\`\`

## 示例

\`\`\`js
selectionSort([5, 2, 8, 1]) // [1, 2, 5, 8]
\`\`\`
`,
  requiredAPI: 'selectionSort',
  starterCode: `function selectionSort(arr) {
  // 你的实现
}`,
  testCases: [
    { name: '乱序数组', input: [[5, 2, 8, 1, 9]], expected: [1, 2, 5, 8, 9] },
    { name: '已排序', input: [[1, 2, 3]], expected: [1, 2, 3] },
    { name: '逆序', input: [[3, 2, 1]], expected: [1, 2, 3] },
    { name: '含重复元素', input: [[4, 1, 4, 2]], expected: [1, 2, 4, 4] },
    { name: '单元素', input: [[1]], expected: [1] },
  ],
  timeLimit: 1000,
  memoryLimit: 256,
  hintLevels: [
    '第一层提示：选择排序的核心是「每轮从未排序区间选出最小值」。',
    '第二层提示：把选出的最小值放到未排序区间的开头（交换）。',
    '第三层提示：外层循环 i 表示「已排序区间」的末尾，每轮结束 i 向后移一位。',
    '第四层提示：内层循环从 i+1 到末尾，用变量记录最小值的下标，最后和 i 交换。',
    '第五层提示：复杂度 O(n²)、不稳定，但交换次数是 O(n)。',
  ],
  visualizationType: 'array',
}

export default selectionSort
