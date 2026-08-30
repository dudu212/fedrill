# 010 · 用 Playwright 做 E2E，只保留 chromium 起步

- 状态：Accepted
- 日期：2026-08-29
- 关联模块：横切 · Testing & Quality
- 前置：[ADR-009 · AI 参与测试与修复的风险分级](009-ai-test-autonomy-tiers.md)

## 背景

M2a 起手的 Agent Loop 会引入多步交互链路：**用户点击 → LLM 决定 tool_call → 沙箱执行 → tool_result 回传 → LLM 最终回答**。这条链路穿透了 client / route handler / Web Worker / DeepSeek 上游，任一环失联都可能导致"UI 上没崩，但功能挂了"。

现有测试栈能覆盖的：

- **Vitest 单测**（Phase 0 完成）：覆盖 `deepEqual` / `summarizeTestResults` / `SessionRepo` 的**函数正确性**——但看不到 SSR 是否产得出、客户端有没有未捕获 Promise、Monaco 有没有加载失败
- **手动 `pnpm dev` 演示**：能看，但**不能持续跑**，每次改动都要人肉走一遍

缺口正是 **E2E**：拉起真实的浏览器 + 真实的 Next.js server，从用户视角断言"点击 X 之后看到 Y"。M2a 要交付简历级 demo（Round 0 → tool_call → Round 1 全链路），没有 E2E 兜底就是**每次改完都手动过一遍**——冲刺阶段这是压死人的时间黑洞。

## 候选方案

| 方案 | 优点 | 缺点 |
| --- | --- | --- |
| **A · Playwright**（本 ADR 选） | 一等 Next.js 支持（内建 `webServer` 集成）；Trace Viewer 可视化重放 DOM/网络/console；同一 API 支持 Chromium/Firefox/WebKit；Anthropic 官方 [Playwright MCP](https://github.com/executeautomation/mcp-playwright) 生态成熟，M2b/M3 可让 AI 辅助写用例 | 完整浏览器 binary 300+ MB；测试文件夹要和 Vitest 隔离（不同 runner） |
| B · Cypress | UI 时间旅行调试直观 | 只支持 Chromium 家族；架构基于 iframe 有诸多限制（跨域、Multi-tab、下载等）；对 Next 15/16 的兼容比 Playwright 慢半拍 |
| C · WebdriverIO / Selenium | 老牌广谱 | 对 SPA 的适配薄；配置繁琐；面试信号弱（"用了 selenium" 现在几乎是负面 signal） |
| D · 完全不做 E2E | 零依赖 | Phase 1a Agent Loop 上线后回归测试全靠人眼；面试可讲的测试深度只到单测层 |

## 决定

**采用 A · Playwright**，MVP 阶段**只保留 chromium 一个 project**。

## 理由（三条）

### 1. Next.js 16 集成是关键

Playwright 的 `webServer` 配置可以**自动拉起 `pnpm dev`**：
- 本地已经开着 dev 就复用（`reuseExistingServer: !CI`）
- CI 里没开则自动启动，跑完自动关
- 相比 Cypress 要额外脚本管理 server 生命周期，Playwright 是内建的

看 [playwright.config.ts](../../playwright.config.ts) 里就一段搞定。

### 2. Trace Viewer 是本项目的调试杀器

Agent Loop 的失败往往不是"控件点错"，而是"tool_call 帧解析漏了一段"、"AbortController 断链"这类深层链路问题。Playwright 挂了自动录：**DOM 快照 + 网络请求 + console 输出 + 时间线**，一份 zip 打开 `npx playwright show-trace` 就能像看录像一样重放。

Cypress 也有 time-travel 但只到 DOM 层，网络/console 弱。**手写 Agent Loop 出 bug 时，Trace Viewer 能省 10 倍调试时间**——这就是"面试可讲的测试基础设施"里的具体成本节省。

### 3. Playwright MCP 生态铺路 M2b/M3

Anthropic 官方 `@playwright/mcp` 让 AI（Claude Desktop / Claude Code）可以**驱动一个真实浏览器写测试**。当前 M2a 冒烟层由人写；Phase 1b Trace UI 上线后，考虑接入 MCP 让 AI 辅助起草 UI 交互流程用例（人审）——路径清晰。这条路径和 ADR-009 的 Tier 2（AI 起草 + 人审）自然衔接。

选 Cypress/Selenium 都没这条 AI 辅助测试的 forward-compat 路径。

## 具体实施契约

### 目录 / 命令

- **`tests/e2e/*.spec.ts`** —— E2E 独立目录（Vitest 是 `lib/**/*.test.ts` co-located，不冲突）
- **`pnpm test:e2e`** —— 无头跑
- **`pnpm test:e2e:ui`** —— 打开 Playwright UI 交互调试

### 硬约束

- **只 chromium** —— MVP 阶段不装 firefox/webkit（每个多 100+ MB）。上线前（M5）补齐
- **`retries: CI ? 2 : 0`** —— 本地不重试（红了立刻看），CI 允许 2 次防抖
- **`forbidOnly: !!CI`** —— 防止 `test.only` 漏进 CI
- **`trace: 'on-first-retry'`** —— 只在重试时录 trace，节省本地 IO

### 覆盖分层（挂钩 ADR-009 Tier）

| Tier | 场景 | AI 参与度 | M2a 是否覆盖 |
|---|---|---|---|
| **Tier 1** | 冒烟（SSR 出得来、无 JS 未捕获异常） | AI 全托管 | ✅ 已有 `smoke.spec.ts` |
| Tier 2 | UI 交互流程（点运行 → 看结果 diff） | AI 起草 + 人审 | Phase 1b 补 |
| Tier 3 | Agent Loop 端到端 mock LLM | 人主导 + AI 起草 | M2b 或 M3 |

## 什么情况下会推翻这个决策

- 需要覆盖 iOS Safari 老版本（Playwright WebKit 只跟最新版）→ 补 BrowserStack / Sauce Labs
- 团队引入 CI 后跑 E2E 时间超预算 → 拆冒烟层每 PR 跑 + 全量层 nightly 跑
- Anthropic 的 Computer Use API 稳定后可能替代大部分 UI 层 E2E → 那时重估

## 代价与补偿

**代价**：

- 300+ MB 浏览器 binary（chromium 一个 project 就够呛，加 firefox/webkit 变 800+）
- CI 时间：一个 spec 起 dev server + 跑一次浏览器 ~10s，容易累计
- 每加一个 UI 交互都得思考 selector 稳定性（`data-testid` vs role vs text）

**补偿**：

- 冒烟层的 ROI 极高：改任何代码 → `pnpm test:e2e` 3 秒告诉你 SSR 是否崩
- Trace viewer 记录了每次失败的完整重放，出 bug 时是"给你一份录像"而不是"重现步骤"
- MVP 只 chromium 直接省 2/3 binary 体积

## 相关决策

- [ADR-009 · AI 参与测试与修复的风险分级](009-ai-test-autonomy-tiers.md) —— 明确 E2E 各 Tier 的 AI 参与边界
- [ADR-001 · 手写 SSE vs Vercel AI SDK](001-choose-ai-sdk.md) —— 一等测试基础设施是"拒绝抽象"策略能持续走下去的前提

## 面试问答备忘

**Q：为什么不用 Cypress？前端圈用它的更多。**
A：**Next.js 集成是关键**。Playwright 有 `webServer` 配置自动拉 dev server，Cypress 得自己写脚本管理生命周期。加上 Cypress 基于 iframe 架构，跨域/多 tab/下载都受限——虽然一般项目不碰这些，但 FEDrill 后期要接 MCP、Piston 等外部服务时，架构灵活性差别就出来了。

**Q：`retries: CI ? 2 : 0` 为什么本地不重试？**
A：**本地重试掩盖问题**。红了要立刻看到、当场修；CI 是防"网络抖动、chromium 冷启动 flake"这类偶发环境问题。这也是 [Playwright 官方推荐](https://playwright.dev/docs/test-retries)。

**Q：Trace on 'first-retry' 是什么意思？**
A：只在测试重试时才录 trace（DOM/网络/console）。**平时跑不录**（省 IO），一挂了自动录，第二次跑同一测试时就有 trace 了。`npx playwright show-trace trace.zip` 打开像回看视频。

**Q：为什么 MVP 只装 chromium 不装 firefox/webkit？**
A：**多装一个浏览器多 100+ MB**，MVP 冲刺阶段 `git clone` 后 `pnpm install` 的门槛越低越好。国内 chromium 覆盖前端主流场景，firefox/webkit 补测放到上线前的兼容性验证轮。

## 结果与回顾

**跑通后回填**：

- [ ] 首个 Phase 1b UI 交互测试用了多少行、稳定性如何
- [ ] Trace viewer 实际救了几次调试
- [ ] 接入 Playwright MCP 后 AI 起草的用例通过率
