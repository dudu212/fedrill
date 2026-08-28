# FEDrill · AI 测试工具与测试策略调研

> 立项：2026-08-28 · 关联 [需求方案.md](需求方案.md) · [技术方案.md](技术方案.md) · [学习规划.md](学习规划.md)
>
> 目标：给 FEDrill 一套「AI 项目专用」的测试栈。既覆盖普通前端项目该有的单测/E2E/视觉回归，也覆盖 LLM 产品独有的痛点（非确定性、幻觉、成本、注入攻击、沙盒逃逸）。

---

## 一、为什么 FEDrill 需要专门做一份测试调研

FEDrill 和普通前端项目相比多了三层特殊风险，普通测试策略 hold 不住：

| 风险 | 说明 | 典型失控场景 |
|---|---|---|
| **LLM 非确定性** | 同一个 prompt 每次输出不同，`toEqual` 失效 | 提交后 CI 时红时绿，回归靠肉眼 |
| **代码沙盒安全** | Web Worker + `new Function` 跑用户代码 | 用户提交死循环冻结页面 / 通过 `postMessage` 逃逸 |
| **Agent 工具调用** | LLM 决定调哪个 tool，链路不确定 | Round 0 该问基础却直接跳到性能，或 tool schema 变了 LLM 不知道 |

传统「Jest + Playwright」只能盖住一半；剩下一半要靠 **LLM Eval + 沙盒专项 + AI Review**。

---

## 二、测试金字塔（FEDrill 版）

```
                  ┌────────────────────────┐
                  │  LLM Eval / 面试官打分  │   慢、贵、非确定
                  │  (promptfoo, ragas)    │
                  ├────────────────────────┤
                  │      E2E · Playwright   │   中等，最贴近用户
                  │      + Playwright MCP   │
                  ├────────────────────────┤
                  │  Integration · Route    │   Route Handler + SSE
                  │  Handler + MSW          │
                  ├────────────────────────┤
                  │   Unit · Vitest + RTL   │   多、快、确定
                  │   (harness/tools/utils) │
                  └────────────────────────┘
        ┌───────────────────────────────────────────────┐
        │  横切:security-review · simplify · CodeRabbit │
        └───────────────────────────────────────────────┘
```

---

## 三、逐层工具选型

### 3.1 单元测试层 · Vitest + React Testing Library

**为什么不是 Jest**：Next.js 16 + Vite 生态原生兼容，ESM 无需 babel-jest；`vitest --ui` 观察 SSE 流数据比 Jest 舒服；watch 模式 <100ms 反馈。

**FEDrill 里必须单测的部分**：

| 目标 | 位置（预计） | 断言点 |
|---|---|---|
| SSE 帧解析器 | `lib/harness/sse-parser.ts` | 半帧拼接、`[DONE]` 终止、错误帧 |
| Agent Loop 状态机 | `lib/agent/loop.ts` | tool_use → tool_result → 继续；max_turns 熔断 |
| 工具函数 schema 校验 | `lib/tools/*.ts` | Zod 输入校验；错误 shape 稳定 |
| Web Worker 沙盒消息协议 | `lib/sandbox/protocol.ts` | 消息序列化、超时、内存上限 |
| 手撕题判题器 | `lib/judge/run-tests.ts` | 用例通过率、异常堆栈裁剪 |

**AI 加速点**：**Qodo（原 Codium AI）** VSCode 插件，选中函数一键生成 Vitest 用例并解释每条用例覆盖的 branch。对 FEDrill 里 SSE 解析器这种「状态多、边界密」的函数最省时间。

---

### 3.2 集成测试层 · Vitest + MSW + Undici

**要拦的**：Route Handler 里对 DeepSeek/Claude 的 fetch 调用。不能真打 LLM（贵 + 慢 + 不确定）。

**推荐组合**：

- **MSW (Mock Service Worker)** —— 拦截 fetch，返回预录制的 SSE 帧
- **`node:test` 内置 fetch mock**（Node 22+，Next.js 16 已经要求）作为轻量替代
- 用「录制/回放」模式：真实调一次 → 存到 `tests/fixtures/sse/*.txt` → 后续用它回放

**要测什么**（对齐需求方案 F-004 SSE chat）：

- `/api/chat` 拿到 fixture SSE 后能正确转发给前端
- LLM 中途断开时，AbortController 的传递链是否把 upstream 一起 abort
- tool_use 事件被 Route Handler 识别后能否正确路由到 `/api/tools/*`

---

### 3.3 E2E 层 · Playwright + Playwright MCP Server

**Playwright 本身**：

- 跨浏览器（Chromium/Firefox/WebKit）
- Trace Viewer 出错自动截屏 + 录网络请求
- 内置视觉快照（`expect(page).toHaveScreenshot()`）—— 轻量视觉回归不用另买 Chromatic

**Playwright MCP Server（关键）**：

- 装法：`.claude/mcp.json` 加 `@playwright/mcp` 或 `@executeautomation/playwright-mcp-server`
- 效果：Claude Code / Cursor 直接暴露 `browser_click` / `browser_snapshot` / `browser_console` 工具
- FEDrill 里可以让 AI 自己：
  1. 打开 `/problems/promise-all`
  2. 在 Monaco 里粘贴一份错误答案
  3. 点「运行测试」
  4. 截屏对话 Round 0 是否弹出正确追问
  5. 拿 console log 回来分析

**MVP 阶段（M1）跑的核心 E2E 用例**：

1. 手撕题单题闭环：加载 → 编辑 → 判题 → Round 0 追问 → 结束
2. SSE 断线重连：模拟 offline，UI 不崩、错误 toast 可读
3. 沙盒极端输入：`while(true){}` → 应在 3s 内被 kill 并提示

---

### 3.4 LLM Eval 层 · promptfoo（首选）

**为什么必须**：Agent Loop 的输出没法 `toEqual`。你只能问「Round 0 有没有真的问基础」「有没有泄漏答案」。

**promptfoo 能力**：

- 一份 YAML 定义 test case（用户输入 + 期望性质）
- 断言方式：字面量、正则、`llm-rubric`（用另一个 LLM 打分）、`similar`（embedding 相似度）
- 一键 side-by-side 对比 DeepSeek-V3 vs Claude Haiku 4.5，量化「哪个模型更适合 Round 0」
- CI 集成：分数 < 阈值就 fail PR

**FEDrill 里最该建的三个 eval 集**：

| Eval 集 | 断言 | 收益 |
|---|---|---|
| Round 0 追问金标准（30 例） | 必须包含「你觉得基础实现是什么」类问句；不得直接给完整答案 | 换模型不翻车 |
| tool_use 调度正确性（20 例） | 用户说「测一下」→ 必须触发 `run_tests`，不能 `analyze_complexity` | Agent Loop 回归 |
| 幻觉红线（10 例） | 用户问「Promise.race 什么时候被废弃了」→ 不得编造答案 | 品牌保护 |

**替代品**：LangSmith（付费、闭源）、Ragas（偏 RAG 场景，M3 起做）、DeepEval（开源、Python 生态）。**FEDrill 选 promptfoo，因为 Node/TS 原生、可跑本地、免费**。

---

### 3.5 沙盒安全专项 · 手写红队用例集 + `security-review` skill

**背景**（对齐 decisions/006-sandbox-vs-oj.md）：手撕题选了 Web Worker + `new Function`，不用 Piston（那是 M3 算法题的方案）。

**必测的红队用例**：

```js
// 死循环
while (true) {}

// 内存爆
Array(1e9).fill(0)

// 全局污染
globalThis.answer = 42; postMessage(globalThis)

// 原型链攻击
Object.prototype.leak = 1

// 试图访问 window / document
self.parent?.postMessage?.(...)

// 长字符串输出淹没 SSE
console.log('x'.repeat(1e8))
```

**流程**：

1. 在 `tests/security/sandbox-redteam.test.ts` 存所有用例
2. 每个用例都断言：
   - 3 秒内被 kill
   - 主线程未冻结（用另一个 setInterval 心跳验证）
   - Worker 内存增长有上限（`performance.memory` 或子进程 RSS）
   - 错误信息不泄漏内部路径
3. 每次改沙盒代码前调用 Claude Code 的 `/security-review` skill 过一次 diff

---

### 3.6 AI Code Review 层 · CodeRabbit + Claude Code `simplify`

**CodeRabbit**：GitHub App，每个 PR 自动做 line-level review。对 FEDrill 特别有用的地方：

- React 19 的 `use()` / Server Component 边界最容易出错，CodeRabbit 抓 hook 依赖比人肉快
- Zod schema 变了但 tool 调用侧忘记同步 → 会提示
- 开源仓库免费

**Claude Code 的 `simplify` skill**：本地跑，写完一段 Agent 逻辑立刻调用一次，主要抓：

- 重复的 SSE 帧处理逻辑
- 可复用的 hook 抽取
- 过度嵌套的 tool_result 匹配

---

## 四、落地路线图（对齐 M1-M5）

| 里程碑 | 引入的测试能力 | 交付物 |
|---|---|---|
| **M1**（当前 · Week 1-2） | Vitest + RTL；Playwright 骨架；沙盒红队用例 | `pnpm test` `pnpm test:e2e` `pnpm test:security` 三个脚本能跑通 |
| **M2**（Week 3） | promptfoo；Round 0-4 各建 20 例 golden set；CI 里跑 | `.github/workflows/eval.yml`；PR 里能看到 eval 分数评论 |
| **M3**（Week 4） | Ragas（可视化算法题起，RAG 起步）；Playwright 视觉快照 | RAG 检索质量指标 baseline |
| **M4**（Week 5） | LLM cost/latency 观测；MSW 覆盖 Supabase | Grafana / Vercel Analytics 大盘 |
| **M5**（Week 6） | MCP Server 的契约测试（tool schema 冒烟） | 对外发布前的 100% tool schema 覆盖 |

---

## 五、避坑清单（提前记，免得踩）

1. **不要真 LLM 调用进 CI** —— 一次 push 若 20 个用例真调 DeepSeek，成本可控但**慢**（3-5 分钟），且非确定性让 CI 时红时绿。用 fixture 回放。
2. **eval 也要版本化 prompt** —— prompt 改了 eval 分数变了要能追溯。promptfoo 支持 `promptfoo eval --diff`，把 prompt 存进 git。
3. **视觉回归先别接第三方** —— Chromatic/Percy 免费额度小，M1-M2 用 Playwright 内置 `toHaveScreenshot()` 足够；上线后再评估。
4. **沙盒测试要在 CI 的独立 job 跑** —— 死循环 kill 用例可能拖垮主 test job 的 worker，隔离出去。
5. **AI 生成的测试要人审一遍** —— Qodo 生成的用例经常「测了实现细节而非行为」，收进 PR 前必删。
6. **LLM 输出不做正则精确匹配** —— 换成 `llm-rubric`（另一个 LLM 打分）或 semantic similarity。字面量正则一改 prompt 就全红。
7. **成本告警配上** —— eval 集扩大后 promptfoo 每次跑几刀。设 `OPENAI_LIKE_BUDGET_USD=5` 环境变量做熔断。

---

## 六、和简历亮点的绑定

四大亮点每一个都能挂一份「我怎么测的」故事：

| 亮点 | 挂钩测试 | 面试话术钩子 |
|---|---|---|
| 手写 LLM Harness | Vitest 单测 SSE 解析 + MSW 集成回放 | 「SSE 帧半包/粘包我用 fixture 回放测了 12 种边界」 |
| 手写 Agent Loop | promptfoo eval + Playwright MCP 全链路 | 「tool 调度正确率靠 eval 集守，回归靠 MCP 让 AI 自己点 UI」 |
| Web Worker 沙盒 | 红队用例集 + `/security-review` | 「6 类攻击手法我都写了用例，PR 前用 AI 过一遍 diff」 |
| RAG + MCP | Ragas + MCP 契约测试 | 「检索质量有 baseline，工具协议对外发布前有 schema 冒烟」 |

---

## 七、下一步（本周可动手）

- [ ] `pnpm add -D vitest @vitest/ui @testing-library/react @testing-library/dom jsdom`
- [ ] `pnpm add -D @playwright/test && npx playwright install chromium`
- [ ] 建 `tests/{unit,integration,e2e,security,eval}` 五目录(README 说明每层跑什么)
- [x] [`docs/decisions/009-ai-test-autonomy-tiers.md`](decisions/009-ai-test-autonomy-tiers.md) ADR 记录 AI 自主性风险分级
- [ ] `docs/learning/ai-testing-interview.md` 面试题笔记(本次一起产出)
- [ ] M1 结束时挑 5 个红队用例先跑起来，比理论更能镇场

---

**相关**：[需求方案.md](需求方案.md) · [技术方案.md](技术方案.md) · [decisions/006-sandbox-vs-oj.md](decisions/006-sandbox-vs-oj.md) · [learning/ai-testing-interview.md](learning/ai-testing-interview.md)
