import type { AlgorithmProblem } from '@/lib/types/problem'

const bubbleSort: AlgorithmProblem = {
  id: 'bubble-sort',
  type: 'algorithm',
  title: '冒泡排序',
  difficulty: 'easy',
  tags: ['排序', '数组', '双循环'],
  description: `## 要求

实现 \`bubbleSort(arr)\`，用冒泡排序把数组升序排列，返回**新数组**（不修改入参）。

## 约定 API

\`\`\`ts
function bubbleSort(arr: number[]): number[]
\`\`\`

## 示例

\`\`\`js
bubbleSort([5, 2, 8, 1]) // [1, 2, 5, 8]
\`\`\`
`,
  requiredAPI: 'bubbleSort',
  starterCode: `function bubbleSort(arr) {
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
    '第一层提示：冒泡排序的核心是「相邻两两比较，逆序就交换」。',
    '第二层提示：一轮比较会把当前未排序区间的最大值「冒」到最后。',
    '第三层提示：外层循环控制「轮数」，n 个数最多 n-1 轮。',
    '第四层提示：内层循环从 0 到「未排序区间末尾」，每次比较 arr[j] 和 arr[j+1]。',
    '第五层提示：如果某一轮没有发生任何交换，说明已有序，可以提前结束。',
  ],
  visualizationType: 'array',
}

export default bubbleSort
