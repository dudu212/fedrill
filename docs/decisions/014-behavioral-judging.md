# 014 · 判题模型扩展：从「值比较」到「行为型用例」

- 状态: Accepted
- 日期: 2026-10-07
- 关联模块: 沙箱（lib/sandbox/）+ 判题

## 背景

当前判题模型是「**纯函数 → 返回值 → deepEqual**」：

```js
const actual = await fn(...input)
passed = deepEqual(actual, expected)
```

它隐含两个假设：① 结果是**值**（或 Promise 值），能用 deepEqual 比；② 函数是**纯函数**（无状态、无时间、无副作用）。

这导致前端面试**最高频**的一类手撕题判不了：

| 题 | 突破点 | 为什么判不了 |
|---|---|---|
| `once` | 返回函数 + 有状态（记忆化） | 结果是函数，deepEqual 比不了；「只调一次底层 fn」是行为 |
| `curry` / `compose` / `bind` | 返回函数 | 同上 |
| `throttle` / `debounce` | 有时间（setTimeout） | 「wait 内只执行一次」是时序行为 |

之前补题时**刻意跳过**这些题，但它们是前端高频，值得做。做它们的本质是**升级判题模型**，不是「改几个用例」。

## 候选方案

| 方案 | 思路 | 优点 | 缺点 |
|---|---|---|---|
| A. 行为型脚本 | `TestCase` 加 `script` 字段，沙箱编译脚本、传入用户函数、跑脚本返回 boolean | 通用，能覆盖 once/curry/throttle/debounce | 要改类型 + 两端沙箱 |
| B. fake timers | 用假时钟替换 setTimeout，手动推进虚拟时间 | throttle/debounce 确定性、不慢 | 实现复杂，要注入可控时钟到 worker |
| C. 不做 | 继续范围锁跳过这类题 | 零改动 | 题库缺最高频的一类 |

## 决定

**方案 A（行为型脚本），fake timers（方案 B）留 v2。**

理由：
- 方案 A 是「判题模型从纯函数到行为」的最小正确扩展，一次改动覆盖 once/curry/bind/compose/throttle/debounce 全部。
- throttle/debounce 的时序 v1 用**真实 setTimeout + 小 delay（如 150ms）**，够用且简单；等要「严格确定性 + 秒级完成」再上 fake timers。
- 与现有「`{__fn}/{__val}` 逃生舱」一脉相承：都是「跨 postMessage 用字符串传活代码」。

## 关键实现设计

### 1. 类型扩展（`lib/sandbox/types.ts`）

```ts
export type TestCase = {
  name?: string
  input: unknown[]          // 值型用例：参数
  expected: unknown          // 值型用例：期望值
  /**
   * 行为型用例：测试脚本 `(fn) => boolean | Promise<boolean>`。
   * 存在则走行为判题（沙箱把用户函数传给脚本，跑脚本拿 boolean），
   * 忽略 input/expected。字符串形式是为了跨 postMessage 结构化克隆。
   */
  script?: string
}
```

### 2. 沙箱执行逻辑（`worker.ts` 和 MCP `judge-worker.ts` 同步改）

```ts
for (const c of cases) {
  if (c.script) {
    // 行为型：编译脚本 → 传入用户函数 → 跑脚本拿 boolean
    const testFn = new Function(`return (${c.script})`)()
    const passed = await testFn(fn)   // fn 是已提取的用户函数
    results.push({ name: c.name, passed: !!passed, input: [], expected: null })
  } else {
    // 值型：现有逻辑不变
    const args = reifyInput(c.input) as unknown[]
    const actual = await Promise.resolve(fn(...args))
    results.push({ passed: deepEqual(actual, c.expected), ... })
  }
}
```

**关键点**：脚本是**可信的题面数据**（和 `{__fn}` 一样由题库作者编写），在 worker 作用域编译运行；用户函数 `fn` 以参数传入，仍在隔离上下文里，逃不出去。

### 3. 示例 · `once` 的行为型用例

```ts
{
  name: '记忆化第一次结果',
  input: [],
  expected: null,
  script: `(once) => {
    let calls = 0
    const f = once((x) => { calls++; return x * 2 })
    return f(2) === 4 && f(10) === 4 && calls === 1
  }`,
}
```

### 4. 示例 · `throttle` 的行为型用例（真实时间，v1）

```ts
{
  name: 'wait 内只执行一次（leading）',
  input: [],
  expected: null,
  script: `async (throttle) => {
    let calls = 0
    const f = throttle(() => calls++, 100)
    f(); f(); f()
    const after1 = calls
    await new Promise((r) => setTimeout(r, 150))
    f()
    return after1 === 1 && calls === 2
  }`,
}
```

### 5. 兼容性

- 现有 18 道题的 `TestCase`（无 `script` 字段）**零改动**，走值型逻辑。
- 两端沙箱（浏览器 `worker.ts` + MCP `judge-worker.ts`）都要同步加这段 `if (c.script)` 分支，否则一端能用一端不能。

## 结果与回顾

_实现后回填：`once` / `throttle` / `debounce` 补题是否跑通、真实时间的稳定性、是否需要 v2 fake timers。_
