# FEDrill

> 前端秋招题库 AI 教练 · 让 AI 用面试官方式陪你练手撕/算法/八股

## 项目简介

FEDrill 是一个**前端求职者训练平台**，用 AI 模拟面试官对你阶梯式追问：

- 🔥 **手撕题**：Round 0 基础 → 1 边界 → 2 性能 → 3 工程化 → 4 变体，逼你把 60 分实现进化到面试满分
- 🧠 **算法题**（M3）：苏格拉底式引导（不给答案）+ D3 算法可视化
- 📚 **八股题**（M4）：对话式深挖 + SM-2 间隔重复调度

## 当前进度（2026-08-27）

**M1 · 手撕题单题闭环** ✅ 已跑通

- 5 道预置手撕题（deepClone / flat / Promise.all / call / EventEmitter），覆盖 4 大分类
- Web Worker 沙盒执行 + 手写 `deepEqual`（支持 Date / RegExp / 循环引用）
- Monaco 编辑器 + Ctrl+Enter 快捷键 + 代码 localStorage 持久化
- Round 0 苏格拉底 Agent（DeepSeek 流式，题目 / 代码 / 测试结果三输入 system prompt）
- 三区详情页布局（左右栏 + 每栏上下均可拖拽调宽/调高）+ 测试结果 diff 视图 + 顶部进度条
- 手写 SSE 解析（零依赖，客户端只用 `getReader() + TextDecoder`）
- `AbortController` 中断链贯通到 DeepSeek 上游
- Prompt 反幻觉基座：4 布尔状态标记 + 4 分支路由 + 优先级 0 知识题识别 + 陈旧检测（[复盘笔记](docs/learning/prompt-context-pitfalls.md)）

**M2 · 冲刺中**（M2a 硬锁 **2026-09-15** · M2b 秋招投递后启动）

- **M2a 目标**（简历可放版本）：SessionRepo 地基 + Agent Loop v1 + `run_tests` tool + Round 1 边界追问端到端
- 详细计划见 [docs/roadmap-m2.md](docs/roadmap-m2.md) —— 单一事实源
- 学习节奏 L2 Agent Loop 与代码并行推进（见 [docs/学习规划.md](docs/学习规划.md)）

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

- [项目调研.md](docs/项目调研.md) — 为什么做（战略层）
- [需求方案.md](docs/需求方案.md) — 具体做什么（战术层，PRD 权威）
- [技术方案.md](docs/技术方案.md) — 怎么做（实现层）
- [学习规划.md](docs/学习规划.md) — 学 Agent 全栈的路线图（L1-L6）
- [docs/decisions/](docs/decisions/) — ADR 技术选型日志
- [docs/learning/](docs/learning/) — 学习笔记（一稿可两用给博客）

## 简历亮点（面试话术钩子）

1. **手写 LLM Harness**：SSE 帧解析 + AbortController 传递链，零依赖 —— 见 [docs/learning/sse-under-the-hood.md](docs/learning/sse-under-the-hood.md)
2. **Web Worker 代码沙盒**：`new Function` 隔离 + 3s 超时 + `{__fn}/{__val}` escape hatch 让测试用例可以传函数值
3. **上下文注入 Agent**：题目 + 代码 + 测试结果三输入 system prompt，Round 状态由代码维护（LLM 做感知）
4. **技术决策日志**：每个技术选型有 ADR，面试直接讲

## License

MIT
