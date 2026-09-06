# FEDrill · M2 冲刺计划

> 版本 v1 · 2026-08-27
>
> 目标：秋招简历可放版本 · 9/15 硬锁 M2a
>
> 单一事实源：本文档为 M2 期开发/学习节奏的权威。改动优先动这里，其他文档只挂锚点。

## 一、结论

- M1 功能已完整交付（见 [README.md](../README.md)），进入 M2 冲刺
- M2 拆成 **M2a（必做，9/15 前锁）+ M2b（加分区，秋招投递后无死线）**
- 双护栏：**时间锁**（9/15）+ **范围锁**（不复刻 LeetCode）

## 二、时间锁

- **2026-09-15**：M2a 版本冻结 → 简历三条硬亮点定型
- **秋招投递期间**：产品改动全停，专注面试
- **投递后**：解冻做 M2b（加分区，无死线）

从今天（08/27）到 9/15 共 **19 天**，按工作日 1.5h + 周末 3.5h 估算 ≈ **39 小时**投入窗口。

## 三、范围锁（不复刻 LeetCode）

**M2 期明文放弃**：

- ❌ 不追加大量题目（M2b 封顶 15 道，够演示即可）
- ❌ 不做多语言支持（只 JS，题目本身也不改）
- ❌ 不做用户系统 / 排行榜 / 评论 / 提交历史
- ❌ 不做统计仪表盘 / 学习曲线图
- ❌ 不做题目搜索 / 排序（超 15 道再谈）
- ❌ 不做移动端响应式

已同步进 [需求方案.md §8](需求方案.md#8--out-of-scope明确不做)。

## 四、开发节奏（19 天，四阶段）

### Phase 0 · M2a 启动准备（08/27–08/29，3 天）

**目标**：地基铺好、协议决定、测试网兜就位。

**任务清单**：

- [ ] 写 [ADR-002 手写 Agent Loop vs SDK](decisions/002-hand-rolled-vs-sdk-agent.md)
- [ ] 写 [ADR-004 拒绝 LangChain](decisions/004-agent-loop-vs-langchain.md)
- [ ] 建 `lib/repo/session-repo.ts`：`SessionRepo` 接口 + `LocalStorageSessionRepo` 实现
- [ ] 把 `code` / `messages` 的 localStorage 读写从组件迁进 SessionRepo
- [ ] 装 vitest + 3 条底线测试（`deepEqual` / `summarizeTestResults` / `buildRound0SystemPrompt` 四分支）
- [ ] 在 [需求方案.md §8](需求方案.md#8--out-of-scope明确不做) 明文补全范围锁

**学习焦点（L2 入门）**：

- JSON Schema for tools（怎么描述一个 tool 让 LLM 会调）
- `tool_use` / `tool_result` 消息结构（Anthropic vs OpenAI 微差）
- ReAct 模式：thought → action → observation → 循环
- 参考：[技术方案.md §4.2 Agent Loop](技术方案.md)

### Phase 1a · Agent Loop 起手（08/30–09/01，✅ 完成 · 提前 4 天）

**目标**：端到端跑通 1 个 tool 的 Agent Loop。**已达成:typo bug demo → AI 触发 run_tests → 沙箱 0/4 挂 → AI 分析 → 生成回复,全链路无用户手动干预**。

**任务清单**：

- [x] 新路由 `POST /api/agent/step`，SSE 流出 `text_delta` / `tool_call` / `done` 三种 chunk（[route.ts](../app/api/agent/step/route.ts)）
- [x] `lib/agent/loop.ts` v1：ReAct 循环 + `MAX_ITERATIONS = 10` + AbortSignal 端到端
- [x] `lib/agent/tools/run-tests.ts`：M2a 唯一 tool，参数 `{}`，从 Session 读 code + basic 用例
- [x] 客户端流解析升级：识别三种 chunk 类型 + status 栏可视化 + 语义一致刷 UI
- [x] Provider 抽象层薄封装（[lib/llm/](../lib/llm/)），M2b 切 Claude Haiku 4.5 只改一行 import

**额外产出**（超原计划）：

- [x] Streaming 状态栏 · 🤔 思考 → 🔧 调用 → 📊 分析 → ✍️ 生成
- [x] 语义一致性 · AI 触发 run_tests 后同步刷新 UI 面板（避免"AI 做了但页面没反应"）
- [x] Round 0 Prompt Branch B 强化 · "整体验证类必须先调 tool"（拦下幻觉路径）
- [x] ADR-011 · Agent Loop 在客户端跑，服务端只做 LLM 代理

**学习焦点（L2 进阶 Part 1）**：

- `while` 循环 + 终止条件 + `max_iterations` 保护
- Streaming JSON 分类 chunk 的服务端拼帧 + 客户端识别
- AbortController 跨 Agent Loop 传递
- 参考：Anthropic tool_use 文档、Claude Code 源码里的 loop 实现（如能读）

### Phase 1b · Trace UI + Round 1（09/06–09/12，7 天）

**目标**：简历级别的可演示形态。

**任务清单**：

- [ ] 极简 Trace UI：在对话面板下方或侧边显示"AI 触发了 `run_tests` → 参数 X → 结果 Y"，折叠展开
- [ ] `buildRound1SystemPrompt`：从 `problem.edgeCases[]` + `followUpPath.round1` 挑一个反问
- [ ] 至少 1 道题（推荐 `deep-clone`）**跑通 Round 0 → Round 1 端到端**：挂 → AI 触发 run_tests → 用户改 → Agent 再跑 → 全过 → Round 1 反问
- [ ] Round 1 到 Round 0 的回退兜底（用户改代码挂了应回退）

**学习焦点（L2 进阶 Part 2）**：

- Tool 设计原则：幂等性 / 错误 shape 标准化 / schema 松紧权衡
- 错误处理：tool 失败**不 throw**，标准化错误 shape 塞回 LLM
- Trace / Observability：每步 timestamp / tokens / tool_result

### Phase 1c · 打磨 + 上线 + 简历定稿(09/02–09/06,✅ 主体完成 · 提前 9 天)

**目标**:上线可访问版本、简历亮点定稿。**已达成:Vercel 上线 fedrill.vercel.app + 零信任 BYOK + Trace UI 卡片化**。

**任务清单**:

- [x] Trace UI 卡片化 · 4 档状态(pending / partial 琥珀 / fullPass 绿 / error 红)
- [x] Monaco Ctrl+Enter stale closure 修复 · Latest Ref Pattern 学习笔记
- [x] Vercel 上线 · [fedrill.vercel.app](https://fedrill.vercel.app)
- [x] BYOK · 访客自带 DeepSeek API Key
- [x] **零信任 BYOK · 浏览器 CORS 直连 DeepSeek**(源上线本来是 M5,提前到 Phase 1c 落地)
- [x] README · 简历亮点定稿 + 在线体验链接 + 信任模型说明
- [ ] (可选)Monaco 慢加载优化(dynamic import + prefetch)· M2b 处理
- [ ] (可选)Demo GIF · 最终投简历前一周录一次
- [ ] (可选)写 [docs/learning/agent-loop-implementation.md](learning/agent-loop-implementation.md)(1000-2000 字 · M2 学习沉淀)

**超原计划的额外产出**:

- **零信任 BYOK 架构**(原本 M5 才做的"上线"提前 · 且比原方案更好)
- ADR-011 客户端 Agent Loop · Latest Ref Pattern 学习笔记 · tool-use-and-react 概念铺垫笔记

**学习焦点**:

- 复习:把 Agent Loop / SessionRepo / Round 状态机的实现细节讲一遍给自己听
- 面试话术准备:
  - "你的 Agent Loop 怎么实现的?"
  - "为什么不用 LangChain?"
  - "tool 失败了 LLM 怎么知道?"
  - "如何防止无限 loop?"
  - "BYOK 的信任模型你怎么设计?"(← 新增)
  - "CORS 是什么?为什么大多数 LLM 不允许浏览器直调?"(← 新增)

**→ 【2026-09-15 · 锁 M2a】**

### Phase 2 · M2b 加分区（秋招投递后启动）

**无死线**，秋招投递期间冻结。

- 补齐其他 7 个 tool：`check_edge_case` / `analyze_complexity` / `suggest_ts_types` / `read_current_code` / `add_test_case` 等
- Round 2/3/4 分档 prompt + 题目 `edgeCases` 填 round2–4
- 题库扩到 15 道（封顶）
- Trace UI 深化：pacing / budget / interrupt 可视化
- L2 精通层：Event Loop Engineering（读 Claude Code 源码 sleep/poll/cache 策略）

## 五、学习 + 开发并行时间表

| 日期 | 项目焦点 | 学习焦点（L2） | 交付 | 状态 |
| --- | --- | --- | --- | --- |
| 08/27–08/29（Ph0） | 地基：ADR + Repo + 测试 | 入门 · JSON Schema / tool_use / ReAct | 5 份 ADR + SessionRepo + 43 条测试 + Playwright 骨架 | ✅ |
| 08/30–09/01（Ph1a） | Agent Loop v1 + `run_tests` | 进阶 · while+max_iter / streaming 分类 | 端到端跑通 · 状态栏 · 语义一致 | ✅ **提前 4 天** |
| 09/02–09/02（Ph1b） | Round 1 prompt + Trace UI 卡片化 | 进阶 · Latest Ref Pattern | Round 0→1 端到端 + tool card 4 态 | ✅ **提前 10 天** |
| 09/02–09/06（Ph1c） | Vercel 上线 + 零信任 BYOK + README 定稿 | CORS + 信任模型 | fedrill.vercel.app 上线 · Key 不上服务端 | ✅ **提前 9 天** |
| **09/15 锁 M2a** | | | 简历三条硬亮点定型 | 🎯 |
| 秋招投递后（Ph2） | M2b 加分区 | 精通 · Event Loop Engineering | 无死线 | ⏸ |

## 六、M2a 验收标准（全部满足才算完成）

- [ ] Agent 能**自主**决定"我要跑测试"并触发 `run_tests` tool（不是用户手动点"运行"按钮）
- [ ] 端到端链路：Round 0 挂 → AI 触发 run_tests → 用户改代码 → Agent 再跑 → 全过 → 自动进 Round 1 → AI 边界反问 —— **全链路无需用户点任何工具按钮**
- [ ] 刷新页面对话历史保留（SessionRepo 生效）
- [ ] 至少 3 条 vitest 单测通过（沙箱 / prompt / summary）
- [ ] [README.md](../README.md) 简历三条硬亮点写好
- [ ] 30 秒 demo 视频/GIF 录好，能贴简历/GitHub

## 七、风险 + 缓解

| 风险 | 概率 | 缓解 |
| --- | --- | --- |
| DeepSeek tool calling 不稳定 | 中 | Provider 抽象层预留 Claude Haiku 4.5 切换 |
| 09/15 前来不及 | 中 | 优先保 Agent Loop 端到端跑通；Trace UI 退化为纯文本 log；Round 1 只做 1 道题 |
| L2 概念学不透就动手 → 反复返工 | 中 | Ph0 三天里**必须**读完 tool_use 协议 + ReAct 论文摘要，能画出流程图才动手 |
| 手写 Agent Loop 卡壳 | 低 | ADR-002 里已经埋了逃生舱：**卡壳超 2 天** 就切 Vercel AI SDK，M2b 再重构回手写 |
| 沙箱在多轮里跑挂 | 低 | Ph0 的 3 条 vitest 就是防这个 |

## 八、每日 check-in（每天开工前 30 秒）

问自己两个问题：

1. **今天要交付的最小可演示单位是什么？**（能说清就动手，说不清就先想）
2. **昨天遗留的 bug 或概念不清能不能今天先花 30 分钟消灭？**（不能就先降级今天目标）

答不清时 → 停 → 读文档 / 看代码 → 直到答得清。**这条规则本身**就是 event loop engineering 的入门课：给自己一个 tick 加终止条件。

## 九、简历三条硬亮点（Phase 1a 完成 · 2026-09-01 定稿）

**M2a Phase 1a 端到端跑通后正式定稿。完整版落在 [README.md 简历亮点节](../README.md#简历亮点面试话术钩子)，含 ADR 深挖链接。**

1. **手写 Agent Loop + tool_use 协议**（客户端主导 + 服务端最薄）
   - ReAct 200 行 · `MAX_ITERATIONS=10` 护栏 · AsyncGenerator 出流 · AbortController 端到端
   - DeepSeek `tool_call` 分片按 index 拼装 · `arguments` JSON.parse 藏 adapter
   - 服务端仅 60 行 SSE 代理无状态 · tool 就地在浏览器 Web Worker 执行 · 零 client-server 往返
   - 决策留痕：[ADR-002](decisions/002-hand-rolled-vs-sdk-agent.md) / [ADR-004](decisions/004-agent-loop-vs-langchain.md) / [ADR-011](decisions/011-client-side-agent-loop.md)

2. **Web Worker 代码沙盒 + `{__fn}/{__val}/{__throw}` 逃生舱**
   - `new Function` 隔离 · 3 秒 `worker.terminate()` 强杀 · 循环安全 `deepEqual`（`WeakMap` / `Date` / `RegExp`）
   - **逃生舱设计**突破 postMessage 结构化克隆限制，让测试用例可以传活函数、活 Promise、异常场景
   - 不引入开源 OJ 的理由：[ADR-006](decisions/006-sandbox-vs-oj.md)

3. **手写 LLM Harness · SSE 帧解析 + 端到端中断链**
   - 客户端 20 行 `getReader() + TextDecoder`，服务端手写 `data: / [DONE] / delta.content` 帧
   - AbortController 传递链：client → route `request.signal` → 上游 DeepSeek fetch cancel → 上游立即停止计费
   - 决策留痕：[ADR-001](decisions/001-choose-ai-sdk.md) · 深挖 [sse-under-the-hood.md](learning/sse-under-the-hood.md)

**加分点**（超出原计划的额外产出）：

- **反幻觉 Prompt 基座**：4 布尔状态标记 + 4 分支路由 + 陈旧检测（[复盘笔记](learning/prompt-context-pitfalls.md)）
- **Streaming 状态栏 + 语义一致性**：AI 每步动作对用户可见 + AI 触发跑测试 = 用户点"运行"的完全一致效果
- **11 份 ADR** 形成"拒绝一把梭抽象"技术叙事
- **Playwright E2E 骨架 + AI 测试 tier 分级**（[ADR-009](decisions/009-ai-test-autonomy-tiers.md) / [ADR-010](decisions/010-playwright-e2e.md)）

## 十、相关文档

- [README.md](../README.md) —— 项目总览 + 进度
- [需求方案.md](需求方案.md) —— PRD 权威（§8 范围锁、§9 里程碑）
- [技术方案.md](技术方案.md) —— 技术蓝图（§4.2 Agent Loop 实现）
- [学习规划.md](学习规划.md) —— L2 详细学习清单
- [decisions/](decisions/) —— ADR 决策日志
- [learning/](learning/) —— 学习笔记（每完成一段代码就写一段）
