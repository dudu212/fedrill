# 自动化测试栈落地日志

> 日期:2026-08-28 → 2026-09-02(跨 4 次会话)
>
> 记录 FEDrill 从零到「Vitest + Playwright + MCP + 沙盒红队」齐活的完整过程,以及每一步的目的、验证方式、产物。将来自己回看能立即接上;新协作者读一遍就懂现在有什么、缺什么。

---

## 一句话总结

用五步搭起了「AI 项目专用」测试栈的骨架:**单测 → E2E → AI 驱动浏览器 → 沙盒红队**,并在动手前写死了 [ADR-009](decisions/009-ai-test-autonomy-tiers.md) 三档风险分级,保证后续「谁改谁审」的决策不用每次现想。**Step 6 promptfoo eval 尚未落地**,是 M2 阶段的重点。

---

## 时间线

| 阶段 | 产出 | 归属 |
|---|---|---|
| **调研** | [AI测试工具调研.md](AI测试工具调研.md)、[面试题笔记](learning/ai-testing-interview.md) | 战略文档 |
| **ADR-009** | [三档风险分级](decisions/009-ai-test-autonomy-tiers.md) | 决策 |
| **Step 1-2** | Vitest + happy-dom + 3 条 co-located 单测 | Tier 1 基建 |
| **Step 3** | [playwright.config.ts](../playwright.config.ts) + [smoke.spec.ts](../tests/e2e/smoke.spec.ts) + npm scripts | Tier 1 基建 |
| **Step 4** | Playwright MCP 挂到用户级 `~/.claude.json` | Tier 1 基建 |
| **Step 5** | ✅ 沙盒红队 6/6(Playwright + harness · RT-03 双层防御闭环) | Tier 3 · 已落地 |
| **Step 6** | ⏳ promptfoo · Round 0 golden set | M2 才用力 |

---

## 详细步骤

### 调研 · 为什么要做这些

**做了什么**:先写调研,不急着装依赖。产出两份文档:
- [AI测试工具调研.md](AI测试工具调研.md)——测试金字塔 FEDrill 版、每层选型、避坑清单
- [learning/ai-testing-interview.md](learning/ai-testing-interview.md)——22 题面试话术

**目的**:LLM 项目和普通前端项目多了三层风险(非确定性、沙盒安全、Agent 调度),普通「Jest + Playwright」只能盖住一半。先把「测什么、用什么工具、什么阶段做」想清楚,后面每一步都能对上位置。

**作用**:后面每一步落地都可以说「按调研的 X 层做」,不用重新论证。

---

### ADR-009 · 谁修 bug 的边界

**做了什么**:在动手前先写死[三档 Tier](decisions/009-ai-test-autonomy-tiers.md):
- **Tier 1** 低风险(utils / UI / 文档) → AI 全闭环写代码 + 生测试 + 自主修(≤5 轮、≤100 行 diff)
- **Tier 2** 中风险(Route Handler / Agent Loop / Repo / 交互 UI) → AI 写 + AI 跑,**失败时只诊断不自动修**,人审 diff 再合
- **Tier 3** 高风险(sandbox / prompt / 成本降级 / 鉴权) → AI 只出诊断,**人亲手改**

**目的**:回应 "Vibe Coding" 全盘 AI 闭环的诱惑,不能全接受也不能全拒绝。**沙盒逃逸和 prompt 漂移**是 FEDrill 两大不可逆风险,必须人守;但 utils / hooks 那种低风险区让 AI 全闭环能显著提速。

**作用**:每次改动前查一下改哪个路径,直接对应 Tier 处理流程,消除「这次让 AI 修不修」的临时判断疲劳。

---

### Step 1-2 · Vitest 单测(已完成)

**做了什么**:
- `pnpm add -D vitest @vitest/ui happy-dom`
- 建 `vitest.config.ts`(`environment: 'happy-dom'`、`globals: false`、`include: ['lib/**/*.test.ts']`)
- `package.json` 加 `test`(单跑)、`test:watch`(watch)脚本
- 已有 3 条真单测:`lib/agent/round0-prompt.test.ts`、`lib/repo/session-repo.test.ts`、`lib/sandbox/deep-equal.test.ts`

**目的**:最快反馈层。纯函数、状态机、协议解析器归这里,改一行 <100ms 知道对错。

**为什么选 Vitest 不选 Jest**:Next.js 16 + ESM 环境,Vitest 与 Rollup/esbuild 同管线,无需 babel-jest;watch 模式明显更快。

**为什么 co-located(测试和源码同目录)不是集中 `tests/`**:改代码时旁边就是测试文件,不用跨目录跳转;文件重命名/移动时 IDE 一起搬更少断链。已经这样做了,Playwright / promptfoo 那种独立 runner 才另开目录。

**为什么 happy-dom 不是 jsdom**:SessionRepo 需要 `window.localStorage`,happy-dom 启动比 jsdom 快 2-4 倍,API 覆盖对我们够用。

**验证**:`pnpm test` → 3 条绿。

**产物**:
- [vitest.config.ts](../vitest.config.ts)
- `lib/**/*.test.ts` × 3
- [package.json](../package.json) scripts 段

---

### Step 3 · Playwright + 冒烟

**做了什么**:
- `pnpm add -D @playwright/test` + `npx playwright install chromium`
- 写 [playwright.config.ts](../playwright.config.ts)——`testDir: './tests/e2e'`、`webServer` 自动起 `pnpm dev`、`trace: 'on-first-retry'`、只装 chromium
- 写 [tests/e2e/smoke.spec.ts](../tests/e2e/smoke.spec.ts)——两条:首页 title 存在、`/chat-demo` 无 `pageerror`
- `package.json` 加 `test:e2e`、`test:e2e:ui`
- `.gitignore` 忽略 `/test-results/`、`/playwright-report/`、`/playwright/.cache/`

**目的**:E2E 是唯一能验证「用户视角这条流真的通」的层。SSR/hydration 出错、Server Component 边界破裂、Suspense 死锁——这些只有跑一遍页面才知道。

**为什么 E2E 必须独立目录**:Playwright 有自己的 test runner,不能塞进 Vitest 的 include。这是**技术约束**,不是风格选择。所以 unit 走 co-located、e2e 走 `tests/e2e/`,两个体系并存不冲突。

**为什么第一版冒烟只有两条**:M1 阶段 UI 结构还会变,业务流程 E2E 现在写等于白写。冒烟只守两件事——**页面能渲染**、**客户端无未捕获异常**——就够守住「基础设施不炸」这条底线。业务用例等 Step 4 装了 MCP 之后让 AI 辅助写效率高得多。

**验证**:`pnpm test:e2e` → `2 passed (8.2s)`。

**产物**:
- [playwright.config.ts](../playwright.config.ts)
- [tests/e2e/smoke.spec.ts](../tests/e2e/smoke.spec.ts)
- [ADR-010](decisions/010-playwright-e2e.md)(附加决策,记录 chromium-only 起步的取舍)

---

### Step 4 · Playwright MCP · 给 AI 装眼和手

**做了什么**:
```bash
claude mcp add playwright --scope user npx @playwright/mcp@latest
```
- 写入 `~/.claude.json` 用户级(所有项目共用)
- 重启 Claude Code 会话后,24 个 `browser_*` 工具可用
- 用 `browser_navigate` + `browser_snapshot` 在首页做了一次探索性验证,拿到语义化 accessibility 树

**目的**:让 AI(Claude Code / Cursor)能像人一样点浏览器。用途:
1. 快速冒烟——一句「打开 /problems/promise-all,提交错误答案,截屏对话」就能验收
2. Bug 复现——用户描述现象,AI 自己点出来看
3. E2E 用例撰写——AI 操作完能把动作序列转成 spec 文件

**Playwright vs Playwright MCP 的关系**:
- **Playwright**(Step 3)——你写用例给 CI 跑,机械可重复
- **Playwright MCP**(Step 4)——LLM 会话里驱动浏览器做探索性任务,不写死用例
- 两者**同一底层**,配合互补,不是替代

**MCP 的关键设计**:`browser_snapshot` 返回**accessibility 树**而不是 raw HTML——LLM 只看到语义化的 `heading "FEDrill" [level=1]`、`link "进入题库 →"`,tokens 消耗降一个数量级,理解也更稳。这是 Playwright MCP 相对普通「LLM + Puppeteer」的核心优势。

**和 FEDrill M5 MCP Server 的关系**:两者都是 MCP Server,但角色相反——
- **Playwright MCP**:别人写好,FEDrill 消费
- **FEDrill M5 MCP Server**:自己写,别人消费(用来对外暴露题库检索、判题等能力)

装 Playwright MCP 本身就是最好的 M5 预习——先当消费方看一个「好 MCP Server」长什么样,再自己写就有参照。

**验证**:
1. 会话里能看到 `mcp__playwright__browser_*` 系列工具
2. `browser_navigate('http://localhost:3000')` → 成功
3. `browser_snapshot()` → 拿到 accessibility 树,含 `heading "FEDrill"`、两个链接节点

**产物**:
- 用户级 `~/.claude.json`(项目仓库外,不进 git)
- `.gitignore` 加入 `/.playwright-mcp/`(MCP snapshot 缓存目录)

**顺手发现的问题**:
- `<title>` 还是 `Create Next App`,应改成 `FEDrill · 前端秋招 AI 教练`。在 [app/layout.tsx](../app/layout.tsx) 里改 `metadata`。属 Tier 1,单独提 PR 时顺手带。

---

### Step 5 · 沙盒红队 6 类攻击 · 6/6 全绿(2026-09-01 → 09-02)

**做了什么**(按时间线):

1. **诊断阶段**:扫 [lib/sandbox/runner.ts](../lib/sandbox/runner.ts) + [worker.ts](../lib/sandbox/worker.ts),识别 6 类攻击面(RT-01-06),标出 2 处真漏洞(RT-03 结果伪造、RT-06 fetch 出口)
2. **环境迁移**:骨架先放 Vitest,跑第一条挂 `Worker is not defined` —— happy-dom 无 Web Worker。迁到 Playwright + [app/dev-sandbox-test/page.tsx](../app/dev-sandbox-test/page.tsx) harness 页面模式
3. **五条实证型**(RT-01/02/04/05/06)按 Tier 3 手写断言,证实:
   - `worker.terminate()` 对同步 + 异步循环都有效(RT-01/02)
   - Chromium 每次 `new Worker` 独立 realm,`Object.prototype` 污染不跨 run(RT-04)
   - 50MB structured clone 耗时可控(RT-05,elapsed ~1.3s,不开 ADR)
   - fetch 敞口实证成立(RT-06,`blocked:Failed to fetch` 仅因端口不通,不是安全策略拦)
4. **RT-03 双层防御闭环**:走路径 B —— 修 worker.ts 而非登记漏洞
   - 层 1 · **Closure Shadow**:`new Function('self','postMessage','globalThis','importScripts', ...)` + `'use strict'`,用户 fn 内看到的 self/postMessage 都是 undefined
   - 层 2 · **Nonce**:主线程 `crypto.randomUUID()` 生成,worker 内部所有 postMessage 附带,主线程 `onmessage` 校验不匹配丢弃
   - 元编程绕 shadow 也白搭 —— nonce 拿不到

**目的**:验证 [lib/sandbox/](../lib/sandbox/) 在恶意输入下守住底线,不是"跑起来了"就算数。

**关键决策**(与调研 §3.5 对齐但环境迁移):
- 用 Playwright + harness 而非 happy-dom + Vitest,因为 Web Worker 语义只有真浏览器有
- RT-03 走「修复」而非「登记」,产出**防御纵深** face 面试话术

**验证**:
- `pnpm test:e2e sandbox-redteam --reporter=list` → 6 passed (9.5s)
- `pnpm test` → 43 passed(shadow 未误伤 5 道预置题)

**产物**:
- [tests/e2e/sandbox-redteam.spec.ts](../tests/e2e/sandbox-redteam.spec.ts) —— 6 条红队
- [app/dev-sandbox-test/page.tsx](../app/dev-sandbox-test/page.tsx) —— harness
- [lib/sandbox/{types,runner,worker}.ts](../lib/sandbox/) —— 双层防御修改
- [docs/learning/sandbox-e2e-harness.md](learning/sandbox-e2e-harness.md) —— 环境迁移知识点
- [docs/learning/closure-shadow-and-nonce.md](learning/closure-shadow-and-nonce.md) —— RT-03 双层防御 STAR 复盘

**已知边界**(诚实登记):
- Shadow 只挡直接调用,元编程(`Function('return this')()`)能绕过 —— 靠 nonce 兜底
- fetch 敞口未修,登记 M4 上线前必修(iframe sandbox / CSP / QuickJS-WASM 三选一)
- harness 页面需在 production 屏蔽 —— M4 上线清单

---

## 现在的能力盘点

### 能做

- ✅ 写纯函数、状态机、协议解析器 → `pnpm test:watch` 100ms 反馈
- ✅ 改交互后跑一遍冒烟 → `pnpm test:e2e` <10s 双绿
- ✅ 让 AI 用 Playwright MCP 探索 UI、复现 bug、验收流程
- ✅ 用 ADR-009 三档 Tier 决定「这次让 AI 修不修」
- ✅ **验证沙盒 6 类攻击面 —— 结果伪造已修,fetch 敞口已登记**

### 还不能做

- ❌ **量化 LLM 输出质量**——Round 0-4 追问 prompt 变了没有 baseline 对比,靠人肉眼睛
- ❌ **拦 Route Handler 里的 LLM 调用**——集成测试还没有 MSW,`/api/chat` 只能真调 DeepSeek 才能测
- ❌ **视觉回归**——Monaco 排版、chat 气泡样式改坏了没测试守
- ❌ **元编程级沙盒逃逸**——shadow + nonce 挡 90% 但非 100%,彻底方案要等 M3/M4 换 QuickJS-WASM

---

## 下一步

### Step 6 · promptfoo · Round 0 golden set(M2 才用力)

**先做**:M1 收尾时先建 5 条 golden set,`tests/eval/round-0.yaml`,断言「不许直接给完整答案」+「必须包含引导问句」。

**M2 铺开**:30 条 Round 0-4 + tool_use 调度 20 条 + 幻觉红线 10 条。CI 里跑,分数 < 阈值 fail PR。

---

## 环境说明(避坑)

- **项目路径**:仓库现在在 `e:/fedrill`(2026-08-31 从 `E:/ai-RAG/fedrill` 迁过来)。老文档里绝对路径引用仍指向真实文件,但**后续文档一律用相对路径**避免搬家断链。
- **Playwright dev server**:`pnpm test:e2e` 会自己起 `pnpm dev`,本地已开着 dev 时通过 `reuseExistingServer: true` 复用。用 MCP 探索前手动 `pnpm dev`。
- **Windows 上 pnpm**:如果 `webServer.command: 'pnpm dev'` 卡住,改成 `'pnpm.cmd dev'`。
- **`.playwright-mcp/`** 是 MCP 每次 snapshot 的临时缓存,已加 `.gitignore`,不进 git。

---

## 相关文档

- 战略层:[AI测试工具调研.md](AI测试工具调研.md)
- 决策:[ADR-009 AI 测试自主性](decisions/009-ai-test-autonomy-tiers.md) · [ADR-010 Playwright E2E](decisions/010-playwright-e2e.md)
- 学习:[面试题笔记 22 问](learning/ai-testing-interview.md)
- 里程碑:[roadmap-m2.md](roadmap-m2.md)
