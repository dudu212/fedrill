# Prompt 上下文注入的两次翻车 —— FEDrill Round-0 复盘

## 背景

FEDrill 当前处于 M1 骨架期，AI 部分只有一个 `buildRound0SystemPrompt` 单档 prompt，通过 `/api/chat` 代理到 DeepSeek 流式对话。每次请求服务端会把「题面 / 用户当前代码 / 最近一次测试结果」拼进 system prompt。类型层已经预留了 Round 0–4 的分档、`ToolCall`、`Session` 等结构，但代码层只落地了 Round 0。

本篇复盘一次真实的调试经历——同一次会话里连环踩到两个上下文相关的坑，把修法和方案选型的推理过程记下来，方便讲。

## 一、AI 假装看不见代码（幻觉篇）

### 现场还原

题目：手写 `myDeepClone`。用户代码：

```js
function myDeepClone(value) {
  const cache = new WeakMap();
  if (Array.isArray(value)) {
    const copy = [];
    cache.set(value, copy);
    for (let i = 0; i < value.length; i++) {
      copy[i] = deepClone(value[i], cache);   // ← typo：应该是 myDeepClone
    }
    return copy;
  }
  const copy = {};
  cache.set(value, copy);
  for (const key of Object.keys(value)) {
    copy[key] = deepClone(value[key], cache); // ← 同上
  }
  return copy;
}
```

跑测试得到 `0/4 通过`，全部 `Error: deepClone is not defined`。用户在对话框问「你看这是出现了什么问题」，AI 答：

> 你还没贴代码。把当前代码发出来，我才能告诉你问题在哪。

这是一个**幻觉**——代码明明已经通过 `context.code` 传到服务端并注入了 system prompt。

### AI 实际收到了什么

服务端拼出的 system prompt 里包含：

- 完整的题面 description
- 用户代码全文（包在 ` ```js ` 代码块里）
- 失败测试摘要（每条：`name · 期望 X · 实际 Y` 或 `运行错误: ...`）
- 该题所有 edgeCases

所以「AI 拿不到代码」这个前提本身就错——它拿到了。问题是**它选择不用**。

### 四个可能的诱因

按影响力排序，我怀疑的原因：

1. **代码块的语义信号太弱**。原 prompt 里 `## 用户目前的代码` 只是一个孤立的小标题，下面跟几百字的任务规则和边界追问菜单。DeepSeek 的注意力被稀释了，模型可能没把这段识别为「用户此刻的现状」，而当作「参考背景」。
2. **状态判断被外包给模型**。原版让 AI 自己从摘要里推断「代码是否为空、测试是否跑过」，模糊语义容易走岔——尤其被用户的开放式提问「什么问题」诱导向「不清楚现状」分支。
3. **测试摘要没告诉 AI `requiredAPI` 是什么**。看到 `deepClone is not defined`，AI 可能误以为「用户根本没定义函数」，于是要求贴代码就变得「合理」。但真相是：题目要求的名字是 `myDeepClone`，用户定义了它但内部调用错了。
4. **历史对话的惯性**。上一轮 AI 还在教 `Object.entries()`——那时用户确实没写代码。模型在多轮里会沿着旧假设走，即使新一轮的 system prompt 已经刷新。

### 修法（四把刀）

体现在 [round0-prompt.ts](../../lib/agent/round0-prompt.ts) 里：

1. **代码 / 测试节标题加「权威事实」标签**：`## 用户当前 Monaco 编辑器里的代码（权威事实，已经在你手上，不要向用户索取）`。用明确语义压制「问用户要」的默认冲动。
2. **服务端先算好 4 个布尔量**注入 prompt：`用户是否写了代码 / 是否已跑测试 / 是否有失败 / 是否全部通过`。把状态判断从模型侧搬到代码侧。
3. **状态驱动的四分支路由 A/B/C/D**，取代原版模糊的三条自然语言规则。每个分支对应一个明确的 (hasCode, testsRan, anyFailed) 组合。
4. **反幻觉护栏节**：明文列出「不要问用户贴代码」「历史假设作废，以状态标记为准」两条禁令，直接封堵观察到的失败模式。

顺便在测试摘要里补上了 `输入`（原版只有 `期望 / 实际`），把 AI 判 bug 能拿到的证据补全。

## 二、改完代码不重跑，AI 拿到错配上下文（陈旧篇）

### 现象

上面的 prompt 改完后又想到一个更隐蔽的场景：

```
时刻 T1：写 v1 → 跑测试 → 得到 r1（失败）
时刻 T2：改成 v2 → Monaco onChange 触发 setCode
时刻 T3：不跑测试，直接问 AI
```

看客户端 state：

- `code` 已经是 v2（Monaco onChange 实时同步）
- `testResults` **仍然是 r1**（`setTestResults(null)` 只在 `runTests` 内部开头调用；code 变化没触发任何清理）

所以 AI 收到的 `context = { code: v2, testResults: r1 }` —— **代码和测试结果不属于同一时刻**。

### 为什么比坑一更危险

坑一是「信息在但没被用」；坑二是「信息在但是错的」。

具体到 typo 场景：如果用户已经把 `deepClone` 全改成 `myDeepClone` 但没重跑，AI 会看到——

- 代码里已经没有 typo（v2）
- 测试摘要里仍写 `deepClone is not defined`（r1）

模型两种典型反应，都不好：

- 顺着 r1 说「你还是有 typo」——**基于陈旧数据的错误诊断**
- 说「你代码看着没问题，再跑一下」——凑巧对，但只是幸运

陈旧数据比缺失数据更危险，因为它会主动误导。

### 修法（一句话）

引入一个 `stale` 标记：跑测试时把「当时的代码」记下来，之后只要当前 code 和这个记录不一致，就在 prompt 状态节里插一行 `测试结果是否已陈旧: 是`，并在分支 C 里加规则「陈旧就让用户先重跑，不基于陈旧摘要分析」。

## 三、方案选择：snapshot 字符串 vs 版本 id（决策篇）

### 两条思路

**A · snapshot 字符串（我）**
- `runTests` 时：`setTestedCodeSnapshot(code)`
- 判断：`stale = testedCodeSnapshot !== code`
- state 数：1
- 需要维护的写入点：1（runTests 内）

**B · 版本 id（用户提出）**
- Monaco onChange 时：`setCodeVersionId(v => v + 1)`
- `runTests` 时：`setTestedVersionId(codeVersionId)`
- 判断：`stale = testedVersionId !== codeVersionId`
- state 数：2
- 需要维护的写入点：2（onChange + runTests，且必须成对更新）

### 五维对比

| 维度 | A · snapshot 字符串 | B · 版本 id |
|---|---|---|
| state 数量 | 1 | 2 |
| 需要同步的写入点 | 1 | 2（漏一个就是静默 bug） |
| 从 localStorage 恢复代码 | 无需特殊处理 | 得记得同时重置两个 id |
| 存储开销 | 一份代码副本，几 KB | 两个 number，几 B |
| **Undo 到「跑过的那一版」** | ✅ 判为 fresh（对） | ❌ 仍判为 stale（错） |

### 关键差异：Undo 场景

用户跑 v1（id=5）→ 改成 v2（id=6）→ **Ctrl+Z 撤回**，此刻 Monaco 里的字符串又变回 v1，但 `codeVersionId` 已经涨到 7，`testedVersionId=5` —— 方案 B 会判 stale。可实际上此刻的代码字节就是刚才跑过的那一版，测试结果依然有效。

方案 A 的字节级相等自动答对——因为「陈旧」的**真实定义**就是「代码字节和当时跑的不一致」，不是「版本序号变过」。

### 决策：选 A

三条理由：

1. **少一个 state = 少一个必须同步的点**。软件复杂度约等于「你必须记得同时更新的字段数量」，少一个就少一份将来忘同步的可能。
2. **Undo 场景语义天然正确**。字符串等值就是问题域自然主键。
3. **edit 链和 test 链完全解耦**。onChange 不用碰任何和测试相关的东西，将来加 Undo / 模板重置 / 协同编辑都不用来动。

方向对（都是「pin 住测试运行那一刻的某个特征」），只是选**「代码本身作为主键」** 比 **「外部计数器」** 更贴问题域。

## 面试可讲的三个洞见

1. **Prompt 注入上下文不等于模型会用**。把数据塞进 system prompt 只是第一步，真正的挑战是让模型**信任并使用**这段上下文。信号强度（节标题的语义标签）、状态外包（服务端预算的布尔量）、明文护栏（不要说 X）这三个杠杆比堆更多内容有用得多。

2. **陈旧数据比缺失数据更危险**。缺失时模型至少会承认「不知道」；陈旧时它会**自信地基于错误前提推理**。凡是「多轮之间可能不同步」的字段，都应该带一个 `stale` 标记，让模型能选择「先确认」而不是「继续猜」。

3. **状态设计优先用问题域自然主键**。选 snapshot 字符串还是 version id，抽象上等价，但落到用户操作（尤其是 Undo）就分出优劣。**用问题域里本来就存在的东西做等值判断，永远比外部编号可靠**。这条经验不止 prompt 工程受用，任何「跨时刻同步」的场景都成立。

## 相关文件

- [lib/agent/round0-prompt.ts](../../lib/agent/round0-prompt.ts) —— 系统提示词构造器（含 4 布尔状态标记 / 四分支路由 / 反幻觉护栏 / 陈旧检测）
- [app/api/chat/route.ts](../../app/api/chat/route.ts) —— SSE 代理，负责按 `context.problemId` 拉题并注入 system prompt
- [app/problems/\[id\]/page.tsx](../../app/problems/[id]/page.tsx) —— 客户端 state 管理 `code / testResults`（陈旧检测的 snapshot 也在这里维护）
