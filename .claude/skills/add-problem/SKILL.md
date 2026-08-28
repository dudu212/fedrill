---
name: add-problem
description: Generate a complete ImplProblem file for the FEDrill 手撕题库. Use when the user asks to add a 手撕题, bulk-generate several, or补题. Produces a TypeScript file matching ImplProblemMinimal. Triggers on "加一道手撕题", "生成 debounce", "补齐 4 道题" etc.
---

# add-problem

给定一个手撕题 spec（比如"手写 debounce"），生成一个符合 `ImplProblemMinimal` 结构的 TS 文件到 `data/problems/`，并追加进 `data/problems/index.ts`。

## 触发场景

用户说要"加一道手撕题"、"生成 xxx 题目"、"补 N 道手撕题"等。

## 必要输入

- **题名**（中文标题，如"手写 debounce"）
- **分类**：`async` | `prototype` | `util` | `pattern`（用户没说就按题名猜）
- **难度**：`easy` | `medium` | `hard`（默认 medium）

只有以上模糊时才反问，题名清晰的直接开工。

## 步骤

1. **读模板**（对齐风格）：
   - `data/problems/deep-clone.ts` —— 结构范本
   - `lib/types/problem.ts` —— 类型定义（使用 `ImplProblemMinimal`）

2. **写文件** `data/problems/{kebab-id}.ts`，字段要求：

   | 字段 | 要求 |
   |---|---|
   | `id` | kebab-case 唯一，如 `debounce`、`promise-all` |
   | `type` | 固定 `'implementation'` |
   | `category` | 从 union 里选一个 |
   | `title` | 中文，如"手写 debounce" |
   | `difficulty` | easy / medium / hard |
   | `tags` | 3-5 个中文标签 |
   | `description` | Markdown，含"要求"+"约定 API"+"示例"三段 |
   | `requiredAPI` | camelCase 函数名，sandbox 从这里查找导出 |
   | `starterCode` | 只留签名，不给实现 |
   | `testCases.basic` | **4-5 个基础用例**覆盖典型场景 |
   | `edgeCases` | **3 个**，每个 `{ id, scenario, hint }` |
   | `followUpPath.round1` | 上面 edge case 的 id 数组 |
   | 其余 | 全部省略（`edge`/`stress`/`referenceImpls`/`round2-4`） |

3. **更新** `data/problems/index.ts` —— 追加 import + 导出到数组

## 用例约束（很重要，写错就跑不了）

- `input` **必须是数组**：沙盒以 `fn(...input)` 调用
- `expected` 用字面值（会走 `deepEqual`，不依赖 key 顺序）
- **禁止**在用例里用 `setTimeout` / `setInterval` / `fetch`——M1 沙盒不支持定时器 mock；如果题目本质需要，改用同步伪造或跳过该题
- Promise 类题：函数返回 Promise 则 `expected` 写 resolved 值（沙盒 await 后比较），reject 场景暂放 `edgeCases` 里不做自动断言

## 完成后

告诉用户：`data/problems/{id}.ts` 已生成、`index.ts` 已更新，建议人工过一遍 testCases 再跑。
