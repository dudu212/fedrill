import type { ImplProblemMinimal } from '@/lib/types/problem'

const arrayDedupe: ImplProblemMinimal = {
  id: 'array-dedupe',
  type: 'implementation',
  category: 'util',
  title: '数组去重',
  difficulty: 'easy',
  tags: ['数组', '去重', 'Set'],
  description: `## 要求

实现 \`dedupe(arr)\`，返回去重后的新数组，保持首次出现顺序。

## 约定 API

\`\`\`ts
function dedupe<T>(arr: T[]): T[]
\`\`\`

## 示例

\`\`\`js
dedupe([1, 2, 2, 3]) // [1, 2, 3]
\`\`\`
`,
  requiredAPI: 'dedupe',
  starterCode: `function dedupe(arr) {
  // 你的实现
}`,
  testCases: {
    basic: [
      { name: '数字去重', input: [[1, 2, 2, 3]], expected: [1, 2, 3] },
      { name: '字符串去重', input: [['a', 'b', 'a']], expected: ['a', 'b'] },
      { name: '全重复', input: [[1, 1, 1, 1]], expected: [1] },
      { name: '无重复', input: [[1, 2, 3]], expected: [1, 2, 3] },
      { name: '空数组', input: [[]], expected: [] },
    ],
  },
  edgeCases: [
    { id: 'ec-nan', scenario: 'NaN 去重', hint: 'NaN !== NaN，用 Set 能正确去重，用 indexOf 则去不掉' },
    { id: 'ec-object', scenario: '对象 / 数组元素去重', hint: 'Set 按引用比较，两个字面量 {a:1} 是不同引用，不会被去掉' },
    { id: 'ec-type-coerce', scenario: '1 和 "1" 是否算重复', hint: '严格相等（===）下不算重复，用 == 会误判' },
  ],
  followUpPath: { round1: ['ec-nan', 'ec-object', 'ec-type-coerce'] },
}

export default arrayDedupe
