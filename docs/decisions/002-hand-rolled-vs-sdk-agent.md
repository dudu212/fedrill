# 002 · 手写 Agent Loop 而非使用 Vercel AI SDK 的 agent 抽象

- 状态：Accepted
- 日期：2026-08-27
- 关联模块：L2 · Agent Loop & Event Loop Engineering
- 前置：[ADR-001](001-choose-ai-sdk.md)（chat 层选手写 → 保持一致精神）· [ADR-006](006-sandbox-vs-oj.md)

## 背景

M2a 要落 [F-106 Agent Loop](../需求方案.md)：Agent 自主决定何时调 `run_tests`，拿到结果继续对话，直到给用户最终回答。

2024–2025 期间 Vercel AI SDK 加入了较完整的 agent 原语：`generateText / streamText` 已支持 `tools` + `maxSteps` + `toolChoice`，AI SDK 5 甚至提供了 `Agent` 类和 `stopWhen` 停机条件、`prepareStep` 拦截器、[loop control 官方指南](https://ai-sdk.dev/docs/agents/loop-control)。对个人项目来说"5 行代码起 Agent Loop"是真的可行。

问题回到 M2 起手前：**用 SDK 的 agent 原语，还是继续 [ADR-001](001-choose-ai-sdk.md) 的路线，手写自己的 loop？**

## 候选方案

| 方案 | 优点 | 缺点 |
| --- | --- | --- |
| **A · 手写 Agent Loop**（本 ADR 选） | 全链路 100–200 行可读；ReAct + tool_use / tool_result / max_iterations 都是自己拼；面试可讲的深度直达底层；不引入运行时依赖 | 需要自己处理并发 tool、错误 shape、tool_call streaming 帧拼装；provider 切换要自己维护 adapter |
| **B · 用 AI SDK 的 `generateText/streamText + tools`** | `maxSteps`/`stopWhen`/`prepareStep` 都有；provider adapter 现成；类型完整 | 循环体被 SDK 隐藏 → L2 学习目标（"看清 Agent Loop 内部"）落空；调试要读 `node_modules/ai/dist/`；SDK 抽象泄漏（DataStream 协议）；面试问"你怎么防无限 loop"回答"SDK 自己处理的"就废了 |
| **C · 混合 · 用 SDK 的 tool 定义 + 手写 loop** | 保留手写学习价值，蹭 `tool()` helper 的类型推导 | 类型收益极低（tool 就 1 个）；反而多一个耦合点 |

## 决定

**采用 A · 手写 Agent Loop**。

## 理由（四条，按权重）

### 1. L2 的核心学习目标就是"看清 loop 内部"

[学习规划 L2](../学习规划.md#l2--agent-loop--event-loop-engineering) 明写：

> 精通 | Event Loop Engineering | token budget、per-tool timeout、pacing、interruption、priority queue

这些都是需要**自己写 while 循环、自己接 tool_result、自己算迭代**才能真正理解的东西。用 SDK 就等于把 loop 变成黑盒，L2 精通级交付物无处可讲。

### 2. 保持与 ADR-001 的对称

M1 手写 SSE 换来了"我能讲清 SSE 帧协议"的面试话头。M2 用 SDK 就等于承认"chat 层能讲、agent 层不能讲"——**技术叙事断层**。要么两层都手写要么两层都用 SDK。既然 ADR-001 已经定手写，ADR-002 保持一致。

### 3. 简历三条硬亮点里 Agent Loop 排第一

参考 [roadmap-m2.md §9](../roadmap-m2.md)，M2a 锁定后简历三条硬亮点是：

1. **手写 Agent Loop + tool 集成 + 阶梯追问**
2. Web Worker 代码沙盒 + `{__fn}/{__val}` escape hatch
3. 手写 LLM Harness（SSE + AbortController）

第一条如果内容是"用 AI SDK 的 `stopWhen` 起了个 agent"，深度直接砍半。**这是简历叙事最贵的地方，不能省这一步的手写投入**。

### 4. tool_use 协议本身就一百来行

参见 [tool-use-and-react.md §3.3](../learning/tool-use-and-react.md)：Agent Loop 的骨架只要 ~30 行 `AsyncGenerator`。加上 tool_call streaming 帧拼装 + 错误 shape + AbortController 传递，总量 100–200 行。**这个复杂度不值得引一整个 SDK**。

## 具体实现契约

固化下来防未来动摇：

```
lib/agent/loop.ts
  ├─ export async function* agentLoop(
  │    messages: Message[],
  │    tools: ToolDefinition[],
  │    ctx: AgentContext,
  │  ): AsyncGenerator<AgentEvent>
  │
  ├─ AgentEvent = 
  │  | { type: 'text_delta', text: string }
  │  | { type: 'tool_call',  call: {id, name, args} }
  │  | { type: 'tool_result', callId, result }
  │  | { type: 'done' }
  │  | { type: 'error', error: string }
  │
  └─ 硬约束
     ├─ MAX_ITER = 10
     ├─ 单 tool 超时 5s（Web Worker 沙箱 3s + 缓冲）
     ├─ AbortController 端到端（继承 ADR-001 的传递链）
     └─ tool 失败不 throw，返回 {success:false, error}
```

Provider 层薄封装：

```
lib/llm/
  ├─ types.ts      // ProviderMessage / ProviderToolCall 统一类型
  ├─ deepseek.ts   // 当前默认
  └─ (m2b) anthropic.ts // 兜底 provider
```

**这层薄适配器解决 Anthropic vs OpenAI 消息结构差异**（见 [tool-use-and-react.md §2.3](../learning/tool-use-and-react.md#23-anthropic-vs-openai-微差)）。约 30 行/provider。

## 什么情况下会推翻这个决策

诚实列反例，不把"手写"绝对化：

- **手写 loop 卡壳超过 2 天** → 走逃生舱：先用 AI SDK 跑通 M2a，M2b 期回来重构。这条 [roadmap-m2.md §7 风险](../roadmap-m2.md#七风险--缓解) 已经写死
- **要支持 6+ provider 且动态切换** → SDK 的 provider adapter 生态更划算
- **要接 `useChat` / `useCompletion` 的开箱交互**（stop / reload / retry / edit / branching）→ 自己实现成本 > SDK 学习成本

## 代价与补偿

**代价**：

- tool_call 的 streaming 帧拼装比 chat 复杂（多个 delta 拼一个完整 call），需要小心 index / call_id
- provider adapter 层薄封装的意义只有在真的切 provider 时才显现，短期看是无用负担
- SDK 生态的进步（未来 5.x/6.x）与我们无缘

**补偿**：

- 每写一段核心逻辑就在 [docs/learning/](../learning/) 里写一段配套笔记，把"代价"转成"简历弹药"
- Provider adapter 的接口即便简单也要立好，M2b 一键切 Claude Haiku 就靠这层

## 相关决策

- [ADR-001 · 手写 SSE vs Vercel AI SDK](001-choose-ai-sdk.md)（同一精神的 chat 层版本）
- [ADR-006 · 自研 minimal 判题器 vs 开源 OJ](006-sandbox-vs-oj.md)（同一精神的 sandbox 层版本）
- **ADR-004（待写）· Agent Loop 自研而非 LangChain**（本 ADR 覆盖 SDK 层；ADR-004 覆盖 framework 层）
- **ADR-003（待写）· M1–M3 用 localStorage，M4 才引数据库**（同一"按里程碑演进 minimal"精神）

## 面试问答备忘

**Q：为什么不用 Vercel AI SDK 的 agent 原语，明明能省很多代码？**
A：AI SDK 5 现在 `maxSteps + stopWhen` 起 agent 确实五行搞定，但那把 Agent Loop 变成黑盒，L2 学习目标（"看清 loop 内部"）落空。项目定位是**学习 + 简历项目**，SDK 起 agent 换来的时间省下来了，可讲的技术深度也一起被省掉了。所以选手写。

**Q：手写 loop 相比 SDK 有什么实际优势？**
A：**可控性**。tool 的执行策略（串/并/串行超时）、messages 拼接（Anthropic vs OpenAI 微差）、AbortController 传递、错误 shape 兜底——都可以按项目需求捏。SDK 抽象再好，往下追一层还是这些东西。手写等于我把"往下追一层"这段路走了一遍。

**Q：那 tool_call streaming 怎么处理？**
A：DeepSeek/OpenAI 的 tool_call 会分成多个 delta chunk（`function.name` 一段、`function.arguments` 分段）。手写 loop 里维护一个 `pendingToolCalls: Map<index, PartialCall>`，按 index 拼装，遇到下一条 assistant message 边界或 finish_reason='tool_calls' 就 close 出完整 call。这段是 [AI SDK 的 `parseToolCall` 内部实现的部分](https://github.com/vercel/ai/blob/main/packages/ai/core/generate-text/parse-tool-call.ts)，能自己讲清 = 面试 +1。

**Q：max_iterations 你怎么定的？**
A：10。参考 Anthropic Claude Code 的经验值 + 我自己的场景（一道手撕题的 Round 0→1 追问一般 3–5 轮 tool_call 就到位）。超过 10 大概率是 LLM 陷入循环或幻觉，直接 throw 让上层决定 retry 或告用户。

## 结果与回顾

**跑通后回填**：

- [ ] 实测 tool_call streaming 拼装的稳定性（有没有 chunk 顺序问题）
- [ ] MAX_ITER = 10 是否合适（观察真实用户 Round 0→1 一般走几轮）
- [ ] Provider adapter 层的接口稳定性（M2b 切 Claude 时改动量）
- [ ] 是否触发逃生舱（写 loop 卡壳 > 2 天）
