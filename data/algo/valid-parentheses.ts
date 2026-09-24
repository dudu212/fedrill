import type { AlgorithmProblem } from '@/lib/types/problem'

const validParentheses: AlgorithmProblem = {
  id: 'valid-parentheses',
  type: 'algorithm',
  title: '有效的括号',
  difficulty: 'easy',
  tags: ['栈', '字符串', '括号匹配'],
  description: `## 要求

实现 \`isValid(s)\`，判断字符串里的括号是否合法（括号类型为 \`()[] {}\`，需正确闭合、顺序匹配）。

## 约定 API

\`\`\`ts
function isValid(s: string): boolean
\`\`\`

## 示例

\`\`\`js
isValid('()[]{}') // true
isValid('(]')     // false
\`\`\`
`,
  requiredAPI: 'isValid',
  starterCode: `function isValid(s) {
  // 你的实现
}`,
  testCases: [
    { name: '单对括号', input: ['()'], expected: true },
    { name: '多对括号', input: ['()[]{}'], expected: true },
    { name: '类型不匹配', input: ['(]'], expected: false },
    { name: '顺序错乱', input: ['([)]'], expected: false },
    { name: '空字符串', input: [''], expected: true },
  ],
  timeLimit: 1000,
  memoryLimit: 256,
  hintLevels: [
    '第一层提示：括号匹配是典型的「后进先出」结构，想想栈。',
    '第二层提示：遇到左括号就压栈，遇到右括号就弹栈比较。',
    '第三层提示：右括号必须和栈顶的左括号类型匹配，否则不合法。',
    '第四层提示：遍历完整个字符串，栈应为空才说明全部闭合。',
    '第五层提示：用 map 存右括号→左括号的对应关系，复杂度 O(n)。',
  ],
}

export default validParentheses
