# FEDrill

> 前端秋招题库 AI 教练 · 让 AI 用面试官方式陪你练手撕/算法/八股

## 项目简介

FEDrill 是一个**前端求职者训练平台**，用 AI 模拟面试官对你阶梯式追问：

- 🔥 **手撕题**：Round 0 基础 → 1 边界 → 2 性能 → 3 工程化 → 4 变体，逼你把 60 分实现进化到面试满分
- 🧠 **算法题**（M3）：苏格拉底式引导（不给答案）+ D3 算法可视化
- 📚 **八股题**（M4）：对话式深挖 + SM-2 间隔重复调度

## 当前进度（2026-09-01）

**M1 · 手撕题单题闭环** ✅ 已跑通

- 5 道预置手撕题（deepClone / flat / Promise.all / call / EventEmitter），覆盖 4 大分类
- Web Worker 沙盒执行 + 手写 `deepEqual`（支持 Date / RegExp / 循环引用）
- Monaco 编辑器 + Ctrl+Enter 快捷键 + 代码 localStorage 持久化
- Round 0 苏格拉底 Agent（DeepSeek 流式，题目 / 代码 / 测试结果三输入 system prompt）
- 三区详情页布局（左右栏 + 每栏上下均可拖拽调宽/调高）+ 测试结果 diff 视图 + 顶部进度条
- 手写 SSE 解析（零依赖，客户端只用 `getReader() + TextDecoder`）
- `AbortController` 中断链贯通到 DeepSeek 上游
- Prompt 反幻觉基座：4 布尔状态标记 + 4 分支路由 + 优先级 0 知识题识别 + 陈旧检测（[复盘笔记](docs/learning/prompt-context-pitfalls.md)）

**M2a Phase 0** ✅ 起步准备完成

- SessionRepo（Repository Pattern · M4 换 Supabase 时调用方零改动 · 自动迁移老 key）
- Vitest 底线测试脚手架（43 条断言 · 覆盖 `deepEqual` / prompt / SessionRepo 迁移）
- 五份 ADR（[002](docs/decisions/002-hand-rolled-vs-sdk-agent.md) / [004](docs/decisions/004-agent-loop-vs-langchain.md) / [006](docs/decisions/006-sandbox-vs-oj.md) / [009](docs/decisions/009-ai-test-autonomy-tiers.md) / [010](docs/decisions/010-playwright-e2e.md)）—— "拒绝一把梭抽象" 技术叙事
- Playwright E2E 骨架 + AI 测试 tier 分级
- 学习笔记：[tool-use-and-react](docs/learning/tool-use-and-react.md)、[prompt-context-pitfalls](docs/learning/prompt-context-pitfalls.md)、[ai-testing-interview](docs/learning/ai-testing-interview.md)

**M2a Phase 1a** ✅ 端到端跑通

- **手写 Agent Loop**（`lib/agent/loop.ts` · ReAct + `MAX_ITERATIONS=10` + AbortSignal 端到端）
- **Provider 抽象层**（`lib/llm/` · DeepSeek 实现 · tool_call 分片拼装 + args JSON.parse 藏于 adapter）
- **客户端跑 loop + 服务端零状态 SSE 代理**（见 [ADR-011](docs/decisions/011-client-side-agent-loop.md)）
- **`run_tests` tool 集成**：客户端本地执行，复用 M1 Web Worker 沙箱
- **Streaming 状态栏**：`🤔 思考 → 🔧 调用工具 → 📊 分析结果 → ✍️ 生成回复`，AI 每一步动作对用户可见
- **语义一致性**：AI 触发跑测试与用户点"运行"按钮的可见效果完全一致

**M2a Phase 1b + 1c** ✅ 主体完成

- Trace UI 卡片化 · pending / partial(琥珀)/ fullPass(绿)/ error(红)四态 · 可展开看 tool 内幕 JSON
- Round 1 边界追问 prompt · 客户端按 `currentRound` 派生切 prompt
- Vercel 上线 · [fedrill.vercel.app](https://fedrill.vercel.app)
- BYOK(Bring Your Own Key)· 零成本运营模式
- **零信任 BYOK · 浏览器 CORS 直连 DeepSeek · Key 技术上不可能上服务端**

**M2a 剩余小尾巴**(可选):

- Monaco 慢加载优化(dynamic import + prefetch)
- 简历亮点最终 review + demo GIF(如果需要)

详细路线见 [docs/roadmap-m2.md](docs/roadmap-m2.md) —— M2 冲刺单一事实源。

**范围锁**：不复刻 LeetCode（不追加大量题、不做多语言、不做用户系统），明文见 [需求方案.md §8](docs/需求方案.md#8--out-of-scope明确不做)。

## 快速开始

```bash
pnpm install
cp .env.local.example .env.local
# 编辑 .env.local，填入 DEEPSEEK_API_KEY
pnpm dev
```

访问 <http://localhost:3000>，点"进入题库"，选一道题开始练。

## 页面地图

| 路径 | 用途 |
| --- | --- |
| `/` | 首页 |
| `/problems` | 题目列表（4 分类 Tab） |
| `/problems/[id]` | 三区详情页：题目描述 / Monaco 编辑器 / Agent 对话 |
| `/practice` | 老单页 Demo（保留调试） |
| `/chat-demo` | 纯自由聊天（不绑题目，调试用） |
| `POST /api/chat` | 流式对话端点，支持 `context: { problemId, code, testResults }` |

## 技术栈

- **前端**：Next.js 16 + React 19 + TypeScript + Tailwind CSS 4 + Monaco Editor
- **AI**：DeepSeek-V3（可切 Claude Haiku）· 手写 SSE 解析（无 Vercel AI SDK 依赖）
- **代码执行**：Web Worker + `new Function`（M1 手撕）· Piston API（M3 算法）
- **可视化**（M3）：D3 + Framer Motion
- **数据**：localStorage（M1-M3）→ Supabase Postgres（M4）

## 项目文档

- [需求方案.md](docs/需求方案.md) — PRD（战术层 · 具体做什么）
- [技术方案.md](docs/技术方案.md) — 技术蓝图（实现层）
- [roadmap-m2.md](docs/roadmap-m2.md) — M2 冲刺单一事实源
- [decisions/](docs/decisions/) — ADR 技术选型日志（11 份 · 每份都是面试话头）
- [learning/](docs/learning/) — 学习笔记 + AI 测试面试题（5 份）

## 简历亮点（面试话术钩子）

### 1. 手写 Agent Loop + tool_use 协议 · 客户端主导 + 服务端最薄

- **ReAct 循环** 200 行内落地：`MAX_ITERATIONS=10` 护栏 · `AsyncGenerator` 流式事件 · `AbortController` 端到端断链（client → route → DeepSeek 一路可断）
- **tool_use 协议实现**：DeepSeek 流式 `tool_call` 按 `index` 分片拼装 · `arguments` JSON.parse 藏进 adapter · 上层拿到就是对象不是字符串
- **架构决策**：客户端跑 loop + 服务端只做无状态 SSE 代理（60 行 route handler）。**tool 直接在浏览器执行**，复用 M1 沙箱零重造，`AbortController` 一次搞定整条链路。深挖见 [ADR-002](docs/decisions/002-hand-rolled-vs-sdk-agent.md) / [ADR-011](docs/decisions/011-client-side-agent-loop.md)
- 拒绝 Vercel AI SDK / LangChain，全栈一贯到底的"拒绝一把梭抽象"叙事

### 2. Web Worker 代码沙盒 + `{__fn}/{__val}/{__throw}` 逃生舱

- 手撕题判题基座：`new Function` 隔离 · 3 秒超时（`worker.terminate()` 强杀）· 手写循环安全 `deepEqual`（`WeakMap` 追踪已访问对，支持 `Date` / `RegExp` / 循环引用）
- **关键创新** —— 逃生舱设计突破 `postMessage` 结构化克隆限制：
  - `{__fn: "function(){...}"}` → Worker 内 `new Function` 复原成活函数
  - `{__val: "Promise.resolve(1)"}` → 复原成活 Promise，让测试用例可以断言异步结果
  - `{__throw: "msg"}` → 复原成必抛异常的函数，测异常场景
- 为什么不用开源 OJ：判题模型错配 + 90% 功能用不上 + 简历叙事被稀释，见 [ADR-006](docs/decisions/006-sandbox-vs-oj.md)

### 3. 手写 LLM Harness · SSE 帧解析 + 端到端中断链 · 零依赖

- **客户端 20 行流式消费**：`getReader() + TextDecoder`，按 `\n\n` 分帧
- **服务端手写 SSE 协议解析**：`data: / [DONE] / delta.content` 一路走通，拒绝 `Vercel AI SDK`
- **`AbortController` 传递链**：用户点"中断" → client fetch abort → route handler `request.signal` → 上游 DeepSeek fetch cancel → 上游立即停止计费
- 完整机制深挖 [sse-under-the-hood.md](docs/learning/sse-under-the-hood.md)，决策留痕 [ADR-001](docs/decisions/001-choose-ai-sdk.md)

### 4. 反幻觉 Prompt 基座 · 从真实生产 bug 沉淀出的通用 pattern

从两次 AI 翻车中总结（[复盘笔记](docs/learning/prompt-context-pitfalls.md)）：

- **服务端预算的 4 布尔状态标记**注入 prompt（"有代码 / 已跑测试 / 有失败 / 全过"），让 LLM 不用自己推断状态
- **4 分支路由 A/B/C/D + 优先级 0 知识题识别**：按用户意图分流，不再"一刀切"
- **陈旧检测**：跑测试时快照代码字节，后续 code 改过没重跑 → 显式标记给 LLM，拦下"用旧结果分析新代码"的幻觉
- **AI 触发跑测试的 UI 语义一致性**：AI 通过 tool 触发的判题结果同步刷 UI 面板，避免"AI 做了但用户看不到"的信任陷阱

### 5. 技术决策日志（ADR）· 每份都是可深挖的面试话头

11 份 ADR 覆盖：SDK 层（001/002/004）· 判题层（006）· 测试策略（009/010）· Agent 架构（011）等。**"拒绝一把梭抽象"** 是贯穿全项目的技术叙事。

## Demo · 在线体验

🌐 **[fedrill.vercel.app](https://fedrill.vercel.app)** —— BYOK 模式,访客自带 DeepSeek API Key

推荐路径:

- [/problems/deep-clone](https://fedrill.vercel.app/problems/deep-clone) —— 手撕深拷贝 · Round 0 → 1 全流程
- [/problems](https://fedrill.vercel.app/problems) —— 全 5 道预置题
- [/chat-demo](https://fedrill.vercel.app/chat-demo) —— 裸对话调试口(验证 SSE)

### 🔒 零信任 BYOK

BYOK(Bring Your Own Key)是我的**零成本运营策略**——访客用自己的 DeepSeek API Key,我一分钱不花。但通常 BYOK 有个信任问题:"我的 Key 会不会被服务端偷偷 log?"

**FEDrill 的解法**:测得 DeepSeek 允许浏览器直接 CORS 调用,所以在 BYOK 模式下**让浏览器绕过我的服务器,直接向 `api.deepseek.com` 发请求**。你的 Key 从头到尾只在你自己的浏览器和 DeepSeek 官方之间流转 —— **技术上不可能被我 log**。

实现在 [`lib/agent/loop.ts`](lib/agent/loop.ts) 的 `fetchAgentStep`:检测到 localStorage 里有 Key 就走 `deepseekStream` 直连,否则走 `/api/agent/step` 服务端代理(本地开发用 `.env.local` 兜底)。

## License

MIT
