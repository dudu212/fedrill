# FEDrill

> 前端题库 AI 教练 · 让 AI 用教练方式陪你练手撕/算法/八股

## 项目简介

FEDrill 是一个**前端开发者训练平台**，用 AI 模拟教练对你阶梯式追问：

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

- SessionRepo（Repository Pattern · M4 换 PostgreSQL 时调用方零改动 · 自动迁移老 key）
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
- 技术亮点最终 review + demo GIF(如果需要)

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
- **数据**：localStorage（M1-M3）→ PostgreSQL 会话持久化（M4）· 八股题 + SM-2 间隔重复推迟到 M5 之后

## 项目文档

- [需求方案.md](docs/需求方案.md) — PRD（战术层 · 具体做什么）
- [技术方案.md](docs/技术方案.md) — 技术蓝图（实现层）
- [roadmap-m2.md](docs/roadmap-m2.md) — M2 冲刺单一事实源
- [decisions/](docs/decisions/) — ADR 技术选型日志
- [learning/](docs/learning/) — 学习笔记

## Demo · 在线体验

🌐 **[fedrill.vercel.app](https://fedrill.vercel.app)** —— BYOK 模式,访客自带 DeepSeek API Key

推荐路径:

- [/problems/deep-clone](https://fedrill.vercel.app/problems/deep-clone) —— 手撕深拷贝 · Round 0 → 1 全流程
- [/problems](https://fedrill.vercel.app/problems) —— 全 5 道预置题
- [/chat-demo](https://fedrill.vercel.app/chat-demo) —— 裸对话调试口(验证 SSE)

### 🔒 零信任 BYOK

BYOK(Bring Your Own Key)是我的**零成本运营策略**——访客用自己的 DeepSeek API Key。但通常 BYOK 有个信任问题:"我的 Key 会不会被服务端偷偷 log?"

**FEDrill 的解法**:测得 DeepSeek 允许浏览器直接 CORS 调用,所以在 BYOK 模式下**让浏览器绕过我的服务器,直接向 `api.deepseek.com` 发请求**。你的 Key 从头到尾只在你自己的浏览器和 DeepSeek 官方之间流转 —— **技术上不可能被我 log**。

实现在 [`lib/agent/loop.ts`](lib/agent/loop.ts) 的 `fetchAgentStep`:检测到 localStorage 里有 Key 就走 `deepseekStream` 直连,否则走 `/api/agent/step` 服务端代理(本地开发用 `.env.local` 兜底)。

## License

MIT
