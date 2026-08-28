# tool_use 协议 + ReAct 模式速通

> 目标读者：Phase 0 起步前的自己
>
> 阅读时长：15–20 分钟能看完；看完能画出流程图 + 给同学讲清 = 过关
>
> 学习模块：[L2 · Agent Loop](../学习规划.md#l2--agent-loop--event-loop-engineering) 的入门层

## 一、为什么要先搞懂这两个概念

M2a 要做的**唯一大事**：让 AI 自己决定"我要跑测试"，触发 `run_tests` tool，拿到结果，然后继续对话。

这背后是两条独立但耦合的东西：

- **tool_use 协议** —— LLM API 层面的**消息结构**。规定"什么样的消息叫 tool 调用请求 / 什么样的消息叫 tool 结果回传"。
- **ReAct 模式** —— Agent Loop 层面的**控制流**。规定"什么时候该调 LLM / 什么时候该执行 tool / 什么时候该停"。

两者关系：**ReAct 是流程图，tool_use 是流程图上每一步的消息格式**。

## 二、tool_use 协议

### 2.1 一次完整对话的消息序列

以"用户问 → AI 决定跑测试 → 拿到结果 → 回复用户"为例。消息数组会经历三次 API 调用（更精确地说：**LLM 每被调用一次，就基于当前 messages 数组生成下一条 assistant 消息**）。

```
Turn 1 · 首次调 LLM
messages = [
  { role: 'system', content: '你是面试官…' },
  { role: 'user',   content: '这有什么问题？' }
]
                    ↓ POST /v1/chat/completions
                    ↓
                    ← LLM 返回 assistant message，内容是"想跑测试"
{
  role: 'assistant',
  content: '',                       ← 可能空，也可能是"让我先跑一下测试看看"
  tool_calls: [{
    id: 'call_abc',                  ← 唯一 ID，后面 tool_result 要引用
    type: 'function',
    function: {
      name: 'run_tests',
      arguments: '{}'                ← JSON 字符串（历史包袱，不是对象）
    }
  }]
}

Turn 2 · Agent Loop 执行 tool，把结果回传
messages = [
  ...上面全部,
  { role: 'assistant', tool_calls: [{ id: 'call_abc', ... }] },
  {
    role: 'tool',                    ← 特殊 role，专门装 tool 结果
    tool_call_id: 'call_abc',        ← 对应上面的 call.id
    content: '{"passed":0,"total":4,"failed":[...]}'  ← 结果 stringify
  }
]
                    ↓ 再次调 LLM
                    ↓
                    ← LLM 基于 tool_result 生成最终回答
{
  role: 'assistant',
  content: '你定义的是 myDeepClone，但内部调用了 deepClone…'
}
```

**记住三点**：

1. **每个 tool_call 都有唯一 `id`** —— 一次 assistant 消息里可以有多个并发 tool_call（`tool_calls: [call_1, call_2]`），tool_result 用 `tool_call_id` 一一对应
2. **`arguments` 是 JSON 字符串，不是对象** —— 历史遗留，parse 时记得 `JSON.parse`
3. **`role: 'tool'`** —— 除了常见的 system / user / assistant，还有这个特殊 role，专门装工具结果

### 2.2 tool 定义 · JSON Schema

在**首次**调 LLM 时，除了 messages，还要传一个 `tools` 数组，用 JSON Schema 描述可用工具：

```json
{
  "model": "deepseek-chat",
  "messages": [...],
  "tools": [{
    "type": "function",
    "function": {
      "name": "run_tests",
      "description": "运行用户当前代码的基础测试用例。返回每个用例的 pass/fail、期望值、实际值。当你想验证用户代码是否通过时调用。",
      "parameters": {
        "type": "object",
        "properties": {},
        "required": []
      }
    }
  }]
}
```

**几个关键点**：

- **`description` 是 tool 能被正确调用的关键** —— LLM 只能从这句话推断"什么时候用这个工具"。写得越准，误调用率越低。
- **`parameters` 是标准 JSON Schema** —— `type` / `properties` / `required` / `enum` / `description` 都用得上
- **参数越少越好** —— tool 状态最好从 session 里读（比如 `code`），别让 LLM 传，容易幻觉出错误代码
- **name 用 snake_case** —— 约定

### 2.3 Anthropic vs OpenAI 微差

FEDrill 目前用 DeepSeek（OpenAI 兼容），M2b 可能切 Claude Haiku 4.5。两家协议几乎一样，但差异要知道：

| 项 | OpenAI / DeepSeek | Anthropic |
| --- | --- | --- |
| 工具定义位置 | 顶层 `tools: [{type: 'function', function: {...}}]` | 顶层 `tools: [{name, description, input_schema}]`（少一层 `function` 嵌套） |
| assistant tool call 消息 | `tool_calls: [{id, type, function: {name, arguments: string}}]` | `content: [{type: 'tool_use', id, name, input: object}]`（`input` 直接是对象不是 JSON 字符串！） |
| tool result 消息 | `role: 'tool'`，`content: string` | `role: 'user'`，`content: [{type: 'tool_result', tool_use_id, content}]`（**tool 结果放在 user 消息里！**） |

**为什么要记这个**：M2a 后期想切 provider 时，你会知道**要不要改 Agent Loop 的消息拼接逻辑**。答：**要**。所以 [ADR-002](../decisions/002-hand-rolled-vs-sdk-agent.md)（未写）的一个关键决策点就是"要不要抽一层 provider adapter"。

## 三、ReAct 模式

### 3.1 一句话定义

**ReAct = Reasoning + Acting**。每一轮 LLM 输出一段"想法"（reasoning）+ 一个"行动"（act，通常是 tool_call）；执行行动拿到"观察"（observation，也就是 tool_result）；把观察塞回消息数组，再让 LLM 继续想 + 行动。**循环直到 LLM 觉得可以直接答用户**（此时不再输出 tool_call，只输出 content）。

### 3.2 流程图

```
                 ┌─────────┐
                 │  user   │
                 │  问问题 │
                 └────┬────┘
                      │
                      ▼
       ┌─────────────────────────────┐
       │   push user msg to messages │
       └──────────────┬──────────────┘
                      │
      ┌───────────────▼───────────────┐
      │  loop iteration = 0           │
      │  while iteration < MAX_ITER: │◄─────┐
      │                               │      │
      │  ① 调 LLM，拿 assistant msg   │      │
      │  ② push assistant msg         │      │
      │                               │      │
      │     ├─ 如果 msg.tool_calls    │      │
      │     │  ├─ 执行每个 tool       │      │
      │     │  ├─ push tool_result    │──────┘ 回到 ①
      │     │  └─ iteration++         │
      │     │                         │
      │     └─ 否则（纯 content）      │
      │        │                      │
      │        ▼ 跳出循环              │
      └──────────────┬────────────────┘
                     │
                     ▼
              流回给用户（stream）
```

### 3.3 代码骨架（大约 30 行）

用来锚定后面读 [lib/agent/loop.ts](../../lib/agent/loop.ts)（还没写）：

```ts
async function* agentLoop(messages: Message[], ctx: AgentContext) {
  const MAX_ITER = 10
  for (let i = 0; i < MAX_ITER; i++) {
    const response = await callLLM({ messages, tools, stream: true })
    const assistantMsg: Message = { role: 'assistant', content: '', tool_calls: [] }

    for await (const chunk of response) {
      if (chunk.type === 'text_delta') {
        assistantMsg.content += chunk.text
        yield { type: 'text', text: chunk.text }
      } else if (chunk.type === 'tool_call_delta') {
        assistantMsg.tool_calls.push(chunk.call)
      }
    }
    messages.push(assistantMsg)

    if (assistantMsg.tool_calls.length === 0) {
      yield { type: 'done' }
      return
    }

    for (const call of assistantMsg.tool_calls) {
      yield { type: 'tool_call', call }
      const result = await executeTool(call.function.name, JSON.parse(call.function.arguments), ctx)
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) })
      yield { type: 'tool_result', call_id: call.id, result }
    }
  }
  throw new Error(`Agent loop exceeded ${MAX_ITER} iterations`)
}
```

**四个可讲的点**：

1. **`for...of` + `MAX_ITER = 10`** —— 防无限 loop 的护栏。10 是 Anthropic 官方推荐经验值。
2. **`AsyncGenerator`（`yield`）** —— 服务端流协议的 native 表达。route.ts 里用 `for await` 消费然后转成 SSE。
3. **两条终止条件** —— assistant 无 tool_calls（正常结束）or 超过 MAX_ITER（护栏结束）
4. **tool_call 顺序执行** —— 简单起见先串行；并发 tool 是 M2b 优化

### 3.4 max_iterations 为什么必须存在

不加护栏可能出现：

- LLM 不断调 tool 但没收敛（"我再跑一次测试"×∞）
- 陷入 tool_call → 幻觉 → 再 tool_call 的循环
- 网络问题导致每次结果都空，LLM 一直重试

Anthropic Claude Code 的实际实现里 [MAX_ITER 也是 10](https://github.com/anthropics/claude-code)（可讲的面试点）。到 10 就 throw，让上层决定是否 retry 或告用户。

## 四、Tool 设计四条铁律

这些是 [学习规划.md L2 进阶层](../学习规划.md#l2--agent-loop--event-loop-engineering) 的内容，Phase 1b 会用到，先记下：

1. **幂等**：调多次结果一致（`run_tests` 天然满足；`add_test_case` 就要小心防重复）
2. **错误标准化**：tool 失败**不 throw**，返回 `{success: false, error: '...'}`，让 LLM 有机会自我纠正
3. **参数 schema 严紧**：能用枚举就别用 string；能省的参数就省，从 session 里读
4. **description 决定命中率**：写清楚"什么时候用" + "返回什么"，别写实现细节

反例：

```json
{
  "name": "get_code",
  "description": "获取代码"    ← 什么代码？谁的代码？什么时候用？
}
```

正例：

```json
{
  "name": "run_tests",
  "description": "运行用户当前代码的基础测试用例，返回每条用例的 pass/fail、期望值、实际值、错误消息（如果抛异常）。当你想验证用户代码正确性时调用；返回的失败信息可以用来指导用户修改。"
}
```

## 五、映射到 FEDrill M2a

拿到这里就能对着 [roadmap-m2.md Phase 1a](../roadmap-m2.md) 动手了。

**M2a 唯一 tool = `run_tests`**：

- 参数：`{}`（从 session 读 code + 从题目静态数据读 basic 用例）
- 返回：`{passed: number, total: number, failed: TestResult[], durationMs: number}`
- 幂等：✅（同代码同用例同结果）
- 错误 shape：`{success: false, error: 'sandbox timeout / worker crashed'}`
- description：见上文正例

**Agent Loop 三段流协议**：

- `text` → 直接追加到最后一条 assistant 消息（复用 M1 的渲染）
- `tool_call` → 显示"AI 正在跑 run_tests…"loading 卡片
- `tool_result` → 卡片展开显示结果摘要（几过几挂）
- `done` → 结束流

## 六、常见坑 · 一句话版

- **忘 push assistant tool_calls 消息** → 下一轮 LLM 找不到自己上一轮 call 的 id，report 报错
- **`arguments` 忘 JSON.parse** → 直接传字符串给 tool，参数类型全错
- **tool 抛 throw** → Agent Loop 崩掉；应该返回错误 shape 让 LLM 修
- **tool_call_id 对不上** → 有些 provider 严格校验，会 400
- **MAX_ITER 太大**（>15）→ 一次卡壳烧掉几十 K token
- **MAX_ITER 太小**（<5）→ 需要多步的任务被截断

## 七、面试问答备忘

**Q：你的 Agent Loop 是怎么防无限循环的？**
A：`max_iterations = 10`，超了 throw。两个终止条件：LLM 输出无 tool_calls 消息（正常结束）或迭代到上限（护栏结束）。Anthropic 的实现也是 10，属经验值。

**Q：tool_call 失败了 LLM 怎么知道？**
A：**不 throw**。把错误包装成 `{success: false, error: '...'}` 塞回 tool_result 消息，LLM 拿到这个 observation 会自己决定是道歉、换个工具、还是重试。

**Q：为什么 tool_result 要塞进 messages 数组？不能直接把结果拼进下一条 prompt 吗？**
A：可以拼，但会失去多轮语义完整性。塞进 messages 数组，LLM 后续能看到"我调过什么、结果如何"，做出前后一致的决策；而如果只当一次性 context 拼进 prompt，跨轮上下文就断了。

**Q：并发 tool 调用怎么办？**
A：M2a 只做串行，简单。M2b 如果引入 `check_edge_case` + `analyze_complexity` 这类独立 tool，可以 `Promise.all` 并发。前提：所有 tool 都是幂等的、无副作用共享。

**Q：ReAct 和 Chain-of-Thought 有什么区别？**
A：CoT 是"让 LLM 输出推理步骤再给答案"，纯文本。ReAct 是"推理 + 执行外部动作 + 观察结果 + 再推理"，多了行动/观察这两步，能与真实世界交互（跑代码、查数据库、调 API）。**Agent Loop 是 ReAct 的工程实现**。

## 八、动手前的自测

看完这份笔记，能不能：

- [ ] 徒手在纸上画出"user 问 → LLM tool_call → 执行 tool → tool_result → LLM final"的消息流
- [ ] 说清楚 `tool_call.id` 是干嘛用的
- [ ] 说清楚为什么 `arguments` 是字符串不是对象
- [ ] 说清楚 max_iterations 的两个作用
- [ ] 说清楚 tool 失败为什么不 throw
- [ ] 一句话讲清楚 ReAct 和 CoT 的区别

**六条都能过 = Phase 0 概念层达标**，可以开始动手写 SessionRepo 和 ADR-002 了。

## 九、参考资料

- [Anthropic · Tool use 官方文档](https://docs.anthropic.com/en/docs/tool-use)
- [OpenAI · Function calling guide](https://platform.openai.com/docs/guides/function-calling)
- [ReAct 论文](https://arxiv.org/abs/2210.03629) —— 原始出处，读摘要 + Figure 1 即可
- [Anthropic 的 SWE-Agent 简介](https://www.anthropic.com/news/agent) —— Claude Code 内部 Agent Loop 的思路来源
- 本项目相关：[technical方案.md §4.2 Agent Loop](../技术方案.md) · [round0-prompt.ts](../../lib/agent/round0-prompt.ts) 现有 prompt 是 tool 上下文的载体
