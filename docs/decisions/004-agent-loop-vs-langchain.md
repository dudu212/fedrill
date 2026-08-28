# 004 · Agent Loop 自研而非使用 LangChain / LangGraph

- 状态：Accepted
- 日期：2026-08-28
- 关联模块：L2 · Agent Loop
- 前置：[ADR-002](002-hand-rolled-vs-sdk-agent.md)（SDK 层已选手写 → framework 层不冗余）

## 背景

M2a Agent Loop 起手前的第二个"要不要用现成"决策。[ADR-002](002-hand-rolled-vs-sdk-agent.md) 已经明确不用 Vercel AI SDK 的 agent 原语（`generateText + tools + maxSteps`）。**这份 ADR 单独讨论更高抽象层 · LangChain / LangGraph**。

两者关注点不同，所以分开写：

| ADR | 抽象层 | 覆盖 |
| --- | --- | --- |
| ADR-002 | Provider SDK 层 | 手写 vs `import { streamText } from 'ai'` |
| **本 ADR** | Framework 层 | 手写 vs `import { createReactAgent } from '@langchain/langgraph'` |

## 候选方案

| 方案 | 优点 | 缺点 |
| --- | --- | --- |
| **A · 手写 Agent Loop**（本 ADR 选） | 100–200 行可控可讲；沿用 ADR-002 的架构；Provider 层薄封装即可切换 | tool 组合 / 分支 / retry 机制全要自己实现 |
| **B · 用 LangGraph** | 状态图原生支持多分支/条件跳转；LangSmith 一键接观测；Round 0–4 阶梯可以作为节点 | 学习曲线陡；抽象层数深（Graph → Node → Runnable → Model）；`@langchain/langgraph` + `@langchain/core` + provider 包共 5+ 依赖；面试价值几乎全归 LangChain 而非项目 |
| **C · 用 LangChain 的 `AgentExecutor`（旧 API）** | 早期教程多 | 官方已宣告 legacy，主推 LangGraph；不建议新项目采用 |

## 决定

**采用 A · 手写 Agent Loop**，不引入 LangChain / LangGraph。

## 理由（三条）

### 1. Round 状态机的"多分支"目前是伪需求

LangGraph 的核心卖点是**状态图**：节点间可以按条件跳转，比如 Round 0 → 判断测试是否全过 → 分叉到 Round 1 或继续 Round 0。听着很匹配 FEDrill 的 Round 0–4 阶梯。

但真跑一遍就发现：

- **Round 之间是纯线性 0 → 1 → 2 → 3 → 4**，不是图。回退到上一 Round 也只是"prompt 重换"，不是图跳转
- **判断跳转靠的是**"basic 用例是否全过"这一个布尔量，一句 `if allPassed` 就够
- **真正的复杂度在 prompt 分档 + tool 集合**，不是控制流

LangGraph 的图能力 90% 用不上，用了反而把简单的 if/else 藏进 Graph 抽象里，**代码可读性和面试可讲性都变差**。

### 2. LangChain 的抽象泄漏臭名昭著

社区共识：LangChain 的抽象**深且脆**。同一件事有 3 种 API（Chain / Runnable / Agent），文档常年落后，实现细节以每季度大改的节奏变化。这在生产项目里是灾难，在**学习项目**里是灾难的平方——学的东西一年后可能就作废。

反观手写：**ReAct 循环 + tool_use 消息协议是行业稳定标准**，2022 年的 ReAct 论文到 2026 年协议核心没变。**学一次用十年**。

### 3. 简历叙事更不可替代

用 LangGraph 起 Agent 的面试话头：

> "我用 LangGraph 定义了 Round 0–4 五个节点。"

面试官下一问："那 tool_use 协议底层长什么样？" —— 答不上就穿帮。

手写的面试话头：

> "我手写了 ReAct 循环，处理了 tool_call streaming 拼装、max_iterations 护栏、tool 错误 shape 标准化，Provider 适配层解决了 Anthropic vs OpenAI 消息结构差异。"

**每一句都是可深挖的子话题**，任何一个方向面试官追问都答得动。这才是 M2a 简历三条硬亮点里"Agent Loop"该有的密度。

## 什么情况下会推翻这个决策

- 需求变成"多 Agent 协作"（多个 agent 传递消息 / 共享状态）→ LangGraph 的图能力真派上用场
- 引入 human-in-the-loop 的复杂中断/回放 → LangGraph 的 checkpointing 现成
- 项目从"个人学习"转"生产系统"，需要 LangSmith 一类企业级观测 → 生态收益 > 抽象成本

上述任何一条成立，重估这份 ADR。

## 代价与补偿

**代价**：

- 没有 LangSmith 的开箱观测 → M2b 自建 minimal trace UI 补上（[roadmap-m2.md Phase 1b](../roadmap-m2.md)）
- 没有社区的 pre-built tool 库 → 我们只有 8 个 tool，全部手写反而更贴项目上下文
- 没有 checkpoint / replay → M4 上 Supabase 后自己实现，接口本来就要过 SessionRepo

**补偿**：

- Trace 手写会写成 [event-loop-engineering.md](../learning/event-loop-engineering.md)（占位），比 LangSmith 使用手册可讲十倍
- Provider adapter + SessionRepo + Agent Loop 三层都自己搭，是整套 harness 的教科书

## 相关决策

- [ADR-001 · 手写 SSE vs Vercel AI SDK](001-choose-ai-sdk.md)
- [ADR-002 · 手写 Agent Loop vs SDK 抽象](002-hand-rolled-vs-sdk-agent.md)
- [ADR-006 · 自研 minimal 判题器 vs 开源 OJ](006-sandbox-vs-oj.md)
- **ADR-003（待写）· M1–M3 用 localStorage，M4 才引数据库**

**三条 ADR 的共同精神**（ADR-001 / 002 / 004 / 006）：**任何足够小且底层暴露的层，都自己写；任何足够大且业务无关的层（如 Piston 代码执行、Supabase 存储），才用现成的**。

## 面试问答备忘

**Q：LangGraph 现在这么流行，你为什么不用？**
A：一句话——**图能力对我用不上**。FEDrill 的 Round 0–4 是纯线性推进，判断跳转就一个 `if allPassed`，用 LangGraph 反而把简单 if 藏进节点抽象里。另外 LangChain 抽象泄漏严重，API 一年三改，学到的东西留存率低。手写的 ReAct 循环协议五年不变，学习 ROI 更高。

**Q：那多 Agent 协作场景 LangGraph 是不是就有优势？**
A：**是**。如果 FEDrill 之后要做"Agent 出题官 + Agent 面试官 + Agent 判官"多角色协作，我会重新评估这份 ADR。但当前 M2 只有一个 agent 一个 tool，LangGraph 是杀鸡用牛刀。

**Q：LangSmith 的 trace 观测你怎么办？**
A：**M2b 自建 minimal trace UI**——每步 timestamp / tokens / tool_result 展开卡片。虽然功能没 LangSmith 全，但**代码是我的，任何一层都能讲**，比调 LangSmith API 更有面试深度。

**Q：LangChain 生态那些 pre-built tool（Wikipedia / Search / SQL）不心动吗？**
A：**不匹配需求**。FEDrill 的 tool 是 `run_tests / check_edge_case / analyze_complexity` 这类**极项目相关**的工具，社区没有现成，全都得自己写。所以 LangChain 的 tool 生态对我零价值。

## 结果与回顾

**跑通后回填**：

- [ ] Trace UI 的信息密度是否够（能否替代 LangSmith 的核心功能：tool 执行链可视化）
- [ ] 手写 Provider adapter 在切 Claude Haiku 时的实际改动量
- [ ] Round 状态机是否真的够线性（有没有出现"必须回退"的场景）
