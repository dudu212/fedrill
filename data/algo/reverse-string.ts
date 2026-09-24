import type { AlgorithmProblem } from '@/lib/types/problem'

const reverseString: AlgorithmProblem = {
  id: 'reverse-string',
  type: 'algorithm',
  title: '反转字符串',
  difficulty: 'easy',
  tags: ['字符串', '双指针'],
  description: `## 要求

实现 \`reverseString(s)\`，返回反转后的字符串。

## 约定 API

\`\`\`ts
function reverseString(s: string): string
\`\`\`

## 示例

\`\`\`js
reverseString('hello') // 'olleh'
\`\`\`
`,
  requiredAPI: 'reverseString',
  starterCode: `function reverseString(s) {
  // 你的实现
}`,
  testCases: [
    { name: '普通字符串', input: ['hello'], expected: 'olleh' },
    { name: '单字符', input: ['a'], expected: 'a' },
    { name: '空字符串', input: [''], expected: '' },
    { name: '回文', input: ['abba'], expected: 'abba' },
    { name: '含空格', input: ['Hello World'], expected: 'dlroW olleH' },
  ],
  timeLimit: 1000,
  memoryLimit: 256,
  hintLevels: [
    '第一层提示：反转 = 首尾对调，可以用双指针。',
    '第二层提示：left 指向头、right 指向尾，交换后两个指针向中间靠拢。',
    '第三层提示：也可以转成字符数组，用数组的 reverse 再拼回字符串。',
    '第四层提示：字符串本身不可变，需要转成数组操作。',
    '第五层提示：复杂度 O(n)，注意空串和单字符的边界。',
  ],
}

export default reverseString
