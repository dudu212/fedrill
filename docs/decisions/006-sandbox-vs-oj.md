# 006 · 自研 minimal 判题器 vs 引入开源 OJ

- 状态：Accepted
- 日期：2026-08-27
- 关联模块：L1 · Harness · Sandbox 层 / 与 [ADR-001](001-choose-ai-sdk.md) 同一"拒绝一把梭抽象"精神

## 背景

FEDrill 定位为"前端秋招题库 AI 教练"——手撕题 / 算法 / 八股三品类，MVP 聚焦手撕题。M1 已跑通 Web Worker 沙箱 + 手写 `deepEqual` + Round 0 AI 引导对话。

M1 收尾时面临一个岔路：**是否引入开源 OJ 平台**（HydroOJ / Judge0 / OnlineJudge）作为判题基座，自己只做 AI 模块？

## 候选方案

| 方案 | 判题模型 | 沙箱 | 代码量 | 优点 | 缺点 |
| --- | --- | --- | --- | --- | --- |
| **A · 继续自研当前 minimal 判题器** | 函数调用式 · `fn(...input)` | Web Worker + `new Function` + 3s 超时 | `lib/sandbox/` <200 行 | 全链路可控可讲；支持函数入参 / 活 Promise / 循环引用（`{__fn}/{__val}/{__throw}` 逃生舱）；同 tab 实时判题喂 AI | `deepEqual` 有盲区（Symbol / Map / Set / 稀疏数组）；判题深度目前只到 basic |
| **B · 引入 Judge0 / HydroOJ + 自加 AI 模块** | stdin → stdout | Docker 容器 | 引入 + 运维 + 适配层 | 判题成熟；多语言原生支持；用户 / 排行榜 / 讨论区已备 | 判题模型与前端手撕根本不匹配；90% 功能用不上；异步批处理体验断裂；简历叙事被稀释 |

## 决定

**采用方案 A · 继续自研 minimal 判题器**，不引入开源 OJ。

## 理由（四条，按权重排列）

### 1. 判题模型错配

开源 OJ 假设 **stdin → stdout**。前端手撕题需要**函数调用**——甚至要传入函数、活 Promise、循环引用对象。这两个模型不兼容，硬接必须写一层适配，而适配层反而抵消 `{__fn}/{__val}/{__throw}` 逃生舱的价值。

### 2. 90% 功能用不上，徒增复杂度

开源 OJ 的复杂度是被"多语言 + 高并发 + ACM 赛制 + 用户排行榜 + 讨论区"驱动的：

- FEDrill 只有 JS
- 单人练习，无并发压力
- 无用户系统 / 排行榜 / 比赛（[需求方案.md §8](../需求方案.md#8--out-of-scope明确不做) 明文 Out of Scope）

引入开源 OJ = **用它 100% 的复杂度换 10% 的功能**。净亏。

### 3. 核心用户体验依赖"浏览器里的 Web Worker"

FEDrill 的 AI 上下文注入依赖一个关键前提：**用户代码 + 测试结果 + AI 对话在同一个 tab 里**，服务端每次拿到最新代码和测试结果实时拼进 system prompt。

开源 OJ 的 Docker 判题是**异步 + 服务端**的，判题完成要经过任务队列 → 沙箱 → 结果回传。这个体验断裂了——AI 拿不到"用户此刻正在编辑的代码"这份权威事实。

换句话说，开源 OJ 给的是"批处理判题"，FEDrill 需要的是"实时同 tab 判题"。

### 4. 简历叙事价值悬殊

用开源 OJ + AI 模块，面试官视角：

> "他用 HydroOJ 起的，自己加了个 AI 对话框。"

技术贡献只有那个 AI 对话框，判题、沙箱、SSE 都是别人的。

自研 minimal + Agent Loop，面试官视角：

> "他手写了浏览器沙箱、SSE 流协议、Agent Loop、上下文注入机制。"

每一层都是可深挖的面试话题。[CLAUDE.md](../../CLAUDE.md) 明写："许多技术决策刻意拒绝一把梭抽象，转而手写可以在面试里讲清楚的实现"——引开源和这条原则直接冲突。

## 什么情况下会推翻这个决策

诚实列出反例，而不是把"自研"绝对化：

- 产品目标变成"通用刷题平台"（多语言 + 用户系统 + 排行榜）—— 这时开源 OJ 是加速器
- 用户量真的上到需要削峰填谷 —— 不再是单人练习
- 要支持算法题的 C++/Python 执行 —— 超出浏览器 Web Worker 能力

以上任何一条成立，重启这份 ADR 讨论。M3（算法可视化）引入 [Piston API](https://github.com/engineer-man/piston) 就是一次**局部性重估**——但那也是选**服务**而不是重建基建。

## 代价与补偿

**自研的代价**：

- `deepEqual` 有盲区（Symbol 键 / Map / Set / 稀疏数组）—— 需要补齐或明文降低期望
- 判题深度目前只到 basic 用例 —— 需要 M2 补 edge/stress + `check_edge_case` 工具 + 参考实现对拍
- 没有多语言支持 —— 但已在 Out of Scope 里明文划出

**补偿手段**：

- **M2** · AI 触发 `check_edge_case` 工具**动态生成边界用例**进沙箱 —— 这是开源 OJ 都没有的判题深度
- **M2** · Reference implementation differential testing（用户代码 vs 参考实现对拍随机输入）
- **M3+** · 属性化测试（fast-check）可选接入

## 面试问答备忘

**Q：为什么不用现成的判题系统？**
A：**产品模型不匹配**。开源 OJ 是 stdin→stdout 的批处理判题，我们需要**函数调用式 + 浏览器内同 tab 实时判题**，让 AI 能拿到用户此刻的代码和结果做上下文。硬接反而增加适配复杂度。

**Q：判题准确性怎么保证？**
A：**分层保证**。第一层 basic 用例 + `deepEqual`（手写、支持循环引用/Date/RegExp）；第二层 edge/stress 用例（M2 补）；第三层 `check_edge_case` 工具让 AI 动态生成边界用例进沙箱（M2）；第四层 differential testing 用参考实现对拍随机输入（M2+）。这套组合的判题深度**比 LeetCode 的固定用例更强**——因为 AI 会主动挑用户可能漏的场景。

**Q：沙箱安全性怎么办？**
A：**前提场景是单人练习**，不需要防陌生人恶意代码。Web Worker + 3s 超时 + `worker.terminate()` 强杀足够防止死循环炸掉主线程。如果之后有真实用户，再评估升级为 iframe sandbox 或服务端 vm2/isolated-vm。

**Q：为什么 Web Worker 用 `new Function` 而不是 `eval`？**
A：`new Function` **只在全局作用域执行**，拿不到闭包变量，天然比 `eval` 更隔离。加上 Web Worker 本身就没有 DOM 访问权、跨 origin 隔离，双层保护。

**Q：这套的可扩展性？**
A：`SandboxRequest` / `SandboxResponse` 已经是标准消息协议（[lib/sandbox/types.ts](../../lib/sandbox/types.ts)）。M3 要加算法题的服务端执行时，把 Worker 换成 Piston API 调用，主线程 `runInSandbox` 接口保持不变——**Repository Pattern 的思路复用到判题层**。

## 相关决策

- [ADR-001 · 手写 SSE vs Vercel AI SDK](001-choose-ai-sdk.md)（已 Accepted · 同一"拒绝一把梭抽象"的精神）
- **ADR-003（待写）· M1–M3 用 localStorage，M4 才引数据库**（同一"minimal 起步、按里程碑演进"的精神）
- **ADR-004（待写）· Agent Loop 自研而非 LangChain**（M2 前必写）
- **ADR-002（待写）· 手写 Agent Loop vs 用 SDK 抽象**（M2 前必写）

## 一句话叙事

> FEDrill 的差异化在"AI 面试官"，不在"评测器"。评测器只要够用就行——够用的标准是"能判 basic + 能配合 AI 触发边界用例进沙箱"，这条 minimal 路径的总投入不到自建/引入 OJ 的 1/10，但面试可讲价值是 10 倍——因为面试官没见过前端候选人做"AI 判题"，却看过一百个 LeetCode 复刻。

## 结果与回顾

**跑通后回填**：

- [ ] M2 `check_edge_case` 工具上线后，实测"AI 动态生成边界用例进沙箱"的成功率
- [ ] Reference impl differential testing 覆盖率
- [ ] 面试实际讲这段的效果（哪些追问最常出现）
