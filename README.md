# FEDrill

> 前端题库 AI 教练 · 让 AI 用教练方式陪你练手撕/算法/八股

## 项目简介

FEDrill 是一个**前端开发者训练平台**，用 AI 模拟教练对你阶梯式追问：

- 🔥 **手撕题**：Round 0 基础 → 1 边界 → 2 性能 → 3 工程化 → 4 变体，逼你把 60 分实现进化到面试满分
- 🧠 **算法题**（M3）：苏格拉底式引导（不给答案）+ D3 算法可视化
- 📚 **八股题**（M4）：对话式深挖 + SM-2 间隔重复调度

## 当前进度（2026-09-26）

里程碑：M1 骨架 → M2 Agent Loop → M3 算法可视化 → M4 PostgreSQL → M5 MCP + 上线。
**当前处于 M5 收尾阶段** —— 三大改造 Phase（题库迁移 / 画像 / OAuth 登录）已合入，剩 MCP 集成与正式上线。

**M1 · 手撕题单题闭环** ✅

- 预置手撕题（deepClone / flat / Promise.all / call / EventEmitter 等），覆盖 4 大分类
- Web Worker 沙盒（`new Function`）+ 手写 `deepEqual` + Monaco 编辑器 + Ctrl+Enter
- 三区可拖拽详情页 + 测试 diff 视图 + 顶部进度条
- 手写 SSE 解析（零依赖）+ `AbortController` 中断链贯通
- Prompt 反幻觉基座（4 状态标记 + 4 分支路由 + 陈旧检测）

**M2 · 完整 Agent Loop** ✅

- 手写 ReAct loop（`lib/agent/loop.ts`）+ Provider 抽象层（DeepSeek）
- 客户端跑 loop + 服务端零状态 SSE 代理（ADR-011）
- `run_tests` tool 集成 + 流式状态栏 + Trace 卡片四态 + Round 0 → 1 边界追问
- BYOK 零信任直连（浏览器 CORS 直连 DeepSeek）+ Vercel 上线

**M3 · 算法可视化** ✅

- 算法题 10 道（排序 / 二分 / 动态规划等）+ D3 过程可视化（`lib/visualization/traces/`）
- 苏格拉底式引导（`socratic-prompt`）+ 分级提示

**M4 · PostgreSQL 会话持久化** ✅

- 裸 `pg` 直连（ADR-013，弃 Supabase）+ `PostgresSessionRepo` + `HttpSessionRepo`
- `SessionRepo` 接口不变，`NEXT_PUBLIC_USE_POSTGRES=1` 唯一切换点

**M5 · MCP + 上线** 🔶 主体完成

- Phase 1：题库全量迁移 PostgreSQL（`scripts/migrate-problems.ts` 幂等 upsert）
- Phase 2：用户画像落库 + `/profile`（技能矩阵 / 连续打卡 / 最近训练）
- Phase 3：GitHub OAuth 登录 + 匿名数据合并
- 剩余：MCP 集成 · 正式上线（当前 Vercel 为 M2 版）
- 附：UI 主题化重构 + 亮暗主题切换（2026-09-26）

**推迟到 M5 之后**：八股题 + SM-2 间隔重复（SRS，`srs_cards` 表已预留）

详细路线见 [docs/roadmap-m5.md](docs/roadmap-m5.md) —— M5 冲刺单一事实源。

**范围锁**：不复刻 LeetCode（不追加大量题、不做多语言、不做用户系统），明文见 [需求方案.md §8](docs/需求方案.md#8--out-of-scope明确不做)。

## 快速开始

```bash
pnpm install
cp .env.local.example .env.local
# 编辑 .env.local，填入 DEEPSEEK_API_KEY（BYOK 模式下可留空，访客自带 key）

# 起本地 PostgreSQL + 建表 + 灌题（详见 docs/本地数据库自举.md）
docker compose up -d
docker compose exec -T postgres psql -U ddd -d fedrill < fedrill.sql
pnpm exec tsx scripts/migrate-problems.ts

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
- [本地数据库自举.md](docs/本地数据库自举.md) — 同学/协作者一键起库指南（Docker + fedrill.sql + 迁移）

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
