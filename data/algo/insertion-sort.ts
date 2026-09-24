import type { AlgorithmProblem } from '@/lib/types/problem'

const insertionSort: AlgorithmProblem = {
  id: 'insertion-sort',
  type: 'algorithm',
  title: '插入排序',
  difficulty: 'easy',
  tags: ['排序', '数组', '插入'],
  description: `## 要求

实现 \`insertionSort(arr)\`，用插入排序把数组升序排列，返回**新数组**（不修改入参）。

## 约定 API

\`\`\`ts
function insertionSort(arr: number[]): number[]
\`\`\`

## 示例

\`\`\`js
insertionSort([5, 2, 8, 1]) // [1, 2, 5, 8]
\`\`\`
`,
  requiredAPI: 'insertionSort',
  starterCode: `function insertionSort(arr) {
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
    '第一层提示：插入排序像「整理扑克牌」，每次把一张新牌插进已排好的一侧。',
    '第二层提示：从第二个元素开始，把当前元素和它左边的元素比较。',
    '第三层提示：当前元素比左边小就交换，直到左边没有更小的（或到数组开头）。',
    '第四层提示：外层 i 从 1 开始向右走，内层 j 从 i 向左「冒」到正确位置。',
    '第五层提示：复杂度 O(n²)、稳定，近乎有序时接近 O(n)。',
  ],
  visualizationType: 'array',
}

export default insertionSort
