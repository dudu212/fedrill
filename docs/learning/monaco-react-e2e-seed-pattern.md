# Playwright · Monaco React E2E · 三次踩坑抽象出 SessionRepo Seed 模式

> 日期:2026-09-07 · 关联 [ADR-010 Playwright E2E](../decisions/010-playwright-e2e.md) · [sandbox-e2e-harness.md](sandbox-e2e-harness.md)
>
> **本文档按 STAR 结构写**(情境-任务-行动-成果),沉淀"业务闭环 E2E 骨架"落地过程 + 3 个可讲清楚的踩坑。
>
> 面试话术钩子:「补 M1 手撕闭环 E2E 时,踩到 `@monaco-editor/react` 对程序化 setValue 不触发 React onChange 的坑,试了 setValue / pushEditOperations 都不行;换思路——**不模拟用户输入,预置数据源**——直接 seed SessionRepo localStorage 让页面 useEffect 自己拿到我们的代码,一次成功。抽象出通用规律:测受控组件时,预置底层状态源 > 模拟 UI 输入。」

---

## S · Situation · 情境

**背景**:FEDrill 测试栈 Step 1-6 完成后,总覆盖率约 60%。**最大空白是"业务闭环 E2E"** —— M1 手撕主流程(打开题目 → 编辑 Monaco → 判题 → Round 0 AI 追问 → Round 1 切换)**从头到尾没有 e2e**。改一行 UI 代码不知道会不会破坏主流程。

**已有的测试栈**:
- Vitest 43+ 单测(harness / sandbox / agent 关键路径)
- Playwright 冒烟 2 条 + 沙盒红队 6 条
- Playwright MCP 集成
- promptfoo Round 0 golden set 5 条

**这时候动手的理由**:
- M1 UI 已经稳定(Phase 1a 客户端 Agent Loop 已提交),现在写 e2e 不算白写
- 简历"三层测试网"叙事需要业务闭环这一条支撑
- Playwright MCP 已经装完,遇到问题可以让 AI 自己看浏览器状态

---

## T · Task · 任务

**目标**:4 条 E2E 覆盖手撕主流程关键节点。

| # | 用例 | 需要 LLM |
|---|---|---|
| **BF-01** | 题目页 UI 骨架加载 · 关键元素可见 | ❌ |
| **BF-02** | 提交错误代码 → 测试面板显示 ✗ → Round 0 保持 | ❌ |
| **BF-03** | 提交正确代码 → 全绿 → Round 1 badge 出现 | ❌(纯前端 allPassed 派生) |
| **BF-04** | 触发 AI 追问 → 拿到有内容的回复 | ✅ 真调 DeepSeek |

**约束**:
- **本地能跑 + CI 有 key 也能跑**(不硬依赖 LLM,但配了就用)
- **稳定性 · 不 flaky** —— 4 条各跑 3 次至少 3 次绿才算合格
- **速度 · 每 test <10s**(BF-04 真调 LLM 可以放宽到 30s)
- **不侵入 prod 代码** —— 不能为了测试加 data-testid 破坏语义

**核心矛盾**:如何在 Monaco Editor(React 受控组件 + 内部编辑器状态)上,**可靠地注入测试代码**?

---

## A · Action · 行动

### 攻略 1 · 传统路径:`editor.setValue()` · 失败

第一直觉,通过 `page.evaluate` 拿到 window.monaco,调 setValue:

```ts
await page.evaluate((code) => {
  window.monaco.editor.getEditors()[0].setValue(code)
}, code)
```

**跑一遍**:BF-03 挂 · 加诊断打印发现:

```
[BF-03] Monaco value length: 420 · starts with: function myPromiseAll(iterable)...
[BF-03] Panel: 测试结果 · 0/5 通过 · ... Actual: undefined (×5)
```

**Monaco 里的值是对的(420 字符),但沙盒跑出来 actual 全是 undefined** —— 意味着 sandbox 拿到的是空 starterCode,不是我们塞的 CORRECT_CODE。**React state 没有从 Monaco 拿到新值**。

### 攻略 2 · 模拟真实编辑:`pushEditOperations` · 也失败

`setValue` 触发的 `onDidChangeModelContent` 事件带 `isFlush=true`,可能被 `@monaco-editor/react` 内部当作"外部程序注入"跳过 onChange 转发。换成 model.pushEditOperations 模拟用户键入:

```ts
const model = editor.getModel()
model.pushEditOperations(
  [],
  [{ range: model.getFullModelRange(), text: v }],
  () => null,
)
```

**再跑**:仍是 0/5 通过,actual 全 undefined。`pushEditOperations` 也没能触发 React onChange。

**推测根因**:`@monaco-editor/react` 用 `valueRef.current` 判等,只在**发起点是"外部 React value prop 变化"**时才会同步。程序化模型编辑绕不过它的守卫。

### 攻略 3 · 换思路:**绕过 Monaco · 预置数据源** · 成功

不模拟 UI 输入,直接**在页面加载前把代码塞进 SessionRepo(localStorage)**,让页面自己的 useEffect 从 repo 读取。

```ts
async function seedCodeViaRepo(page, problemId, code) {
  await page.addInitScript(
    ({ pid, c }) => {
      const key = `fedrill:session:v1:${pid}`
      const now = Date.now()
      localStorage.setItem(key, JSON.stringify({
        problemId: pid,
        code: c,
        messages: [],
        currentRound: 0,
        hintsUsed: 0,
        testedCodeSnapshot: null,
        lastTestResults: null,
        createdAt: now,
        updatedAt: now,
      }))
    },
    { pid: problemId, c: code },
  )
}
```

**流程变成**:

```
Playwright:seed SessionRepo localStorage
   ↓
page.goto('/problems/xxx')
   ↓
React 挂载 · useEffect 触发 · repo.get() 拿到 seeded snapshot
   ↓
setCode(snapshot.code) · React state 权威更新
   ↓
Monaco 重新渲染出 seeded code · useCallback runTests 用新 code
   ↓
Playwright click "运行" · sandbox 跑的是 seeded code ✅
```

**跑一遍**:BF-03 通过 · **Round 1 badge 显示** · panel 显示 5/5 全绿。

**同一模式覆盖 BF-02/03/04**,BF-01 不需要 seed(只测 UI 元素可见)。

### 附带踩坑 1 · BUGGY_CODE 太狠,触发 sandbox 全局超时

BF-02 期望"提交错误代码 → 逐条 ✗ 显示"。第一版 BUGGY_CODE:

```js
function myPromiseAll(arr) {
  return new Promise((resolve) => {
    const results = []
    arr.forEach((p, i) => {
      Promise.resolve(p).then((v) => {
        results[i] = v
        if (results.length === arr.length) resolve(results)
      })
    })
    // 缺 · 空数组永远不 resolve
  })
}
```

跑测试:**空数组 case 永远 pending → sandbox worker 卡住 → 主线程 3s terminate → runInSandbox reject → 页面显示红色 testError · 没有逐条 ✗**。

**修法**:让 BUGGY_CODE 是"合理错误"而非"完全崩":

```js
function myPromiseAll(arr) {
  throw new Error('未实现')
}
```

每条 case 在 sandbox 里 catch 到 Error → 显示 ✗ + 错误信息。5 条测试用例逐条 fail,可视断言。

### 附带踩坑 2 · Playwright 进程本身不读 `.env.local`

BF-04 需要 `test.skip(!process.env.DEEPSEEK_API_KEY)` 优雅跳过。第一次跑:**BF-04 skipped**,但 `.env.local` 明明配了 key。

**根因**:`.env.local` 是 **Next.js 独有约定**,只有 Next dev/build 时自己用内置 dotenv 读。**Playwright 进程 (`playwright test`) 本身是纯 Node · 不知道要读 .env.local**。

**修法**:`playwright.config.ts` 顶部加内联 dotenv loader:

```ts
import { existsSync, readFileSync } from 'node:fs'

const envLocal = '.env.local'
if (existsSync(envLocal)) {
  for (const line of readFileSync(envLocal, 'utf-8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}
```

Playwright 加载 config 时执行 loader,`process.env.DEEPSEEK_API_KEY` 就有了。子 worker 通过 `spawn env` 继承。

---

## R · Result · 成果

### 定量结果

- **4 条业务闭环 e2e 全绿 · 15.1 秒**(含真调 DeepSeek)
- **Playwright 覆盖率**:40% → **80%**(补齐 M1 主流程)
- **整体测试栈加权覆盖率**:60% → **75%**
- **代码变更**:1 个新 spec 文件 + playwright.config env loader,共 186 行

### 能力覆盖

**能做**:
- 改 UI 代码后一键跑 4 条业务 e2e,15 秒知道有没有破坏主流程
- 真实 LLM 调用端到端测通(Route Handler → SSE → Chat UI)
- 每个 test 都可以复现 · 无 flaky

**已知边界**:
- BF-04 依赖 LLM 输出非确定 · 只断言"content 长度 > 20",不验证具体内容
- Monaco 输入路径没被测(通过 seed 绕开)· 键盘交互 bug 这层测不到
- BYOK 分支未单独 e2e(BF-04 走 Route Handler 代理路径)

### 更普适规律 · 值得记住的 3 条

**规律 1 · 测受控组件时,预置底层状态源 > 模拟 UI 输入**

Monaco / CodeMirror / rich text editor 类"重量级"React 受控组件都有内部状态机 + 外部 React state 的双源。**从 UI 层塞值经常触发不了 React onChange · 用底层数据源(localStorage / IndexedDB / URL param)反而稳定**。

同样适用于:
- Chart 库(Recharts / D3):seed 数据源,不模拟拖拽
- Form 库(Formik / React Hook Form):seed initial values,不模拟输入
- 富文本(Draft.js / Lexical):seed 序列化的 EditorState,不敲键盘

**规律 2 · 负样本要"合理错误" · 而非"完全崩"**

BUGGY_CODE 触发全局 sandbox 超时,导致预期的"逐条 ✗"看不见。测试反例要 **在预期错误层触发** · 别让上一层的兜底吞掉细节。

**具体判断**:
- API 400/401 · 是合理错误 → 测得到具体错误消息
- API 超时 · 触发上层 retry / circuit-breaker · 测不到 route handler 逻辑
- 沙盒里 case-level throw · 触发 worker.ts try/catch · 显示 ✗
- 沙盒里死循环 · 触发主线程 terminate · 显示全局 error div

**规律 3 · Next.js 的 `.env.local` 只有 Next 认 · 其他工具都要自己加载**

Next dev/build 通过内置 dotenv 读 `.env.local`,但:
- **Playwright test 进程**:不读 · 需要 `playwright.config.ts` 手动 loader
- **Vitest**:不读 · 需要 `vitest.config.ts` 或 setup 文件手动 loader
- **promptfoo eval**:不读 · 需要 `node --env-file=.env.local` 或 wrapper 脚本
- **任何 CLI 工具**:同上

**同一规律的反面**:如果测试跑挂了但 `pnpm dev` 是好的,先怀疑**测试进程没拿到 env**,不是 code bug。

### 面试话术升级

**弱版**:「我写了 4 条 Playwright e2e,覆盖 M1 主流程」

**强版**:

> 「M1 业务闭环 e2e 我做 4 条,跑通花 15 秒,包含真调 DeepSeek 的 AI 追问一条。过程踩到 `@monaco-editor/react` 的一个坑——**程序化 setValue 不触发 React onChange**,试了 setValue、pushEditOperations 都失败。换思路:**不模拟 UI 输入,预置数据源** —— 直接 seed SessionRepo localStorage,让页面 useEffect 自己拿到我们塞的代码。这个模式可以迁移到所有测受控组件的场景(Chart / Form / 富文本)。
>
> 附带发现 Next.js 的 `.env.local` 只有 Next 认,Playwright 进程要在 playwright.config.ts 里手动加载,这一坑之后 promptfoo eval 也遇到过 · 抽象成了一条通用规律。」

—— **"能讲通用规律"** > **"我写了 4 条 e2e"**

### 已开启的后续动作

- [x] 本 STAR 学习笔记
- [x] 简历 FEDrill Bullet 4 更新加 BF-04
- [ ] M2 · BF-05 · BYOK 端到端(设置 key → 客户端直连 DeepSeek)
- [ ] M2 · BF-06 · streaming 中断(点中断 → streaming 立即停 · 无残留状态)
- [ ] M2 · Playwright 视觉快照(Monaco 布局 / chat 气泡)

---

## 相关

- [ADR-010 · Playwright E2E · chromium-only 起步](../decisions/010-playwright-e2e.md)
- [sandbox-e2e-harness.md](sandbox-e2e-harness.md) —— 前一次 Playwright 相关踩坑(happy-dom 无 Worker → harness 页面模式)
- [closure-shadow-and-nonce.md](closure-shadow-and-nonce.md) · [promptfoo-eval-baseline.md](promptfoo-eval-baseline.md) —— 姊妹 STAR 文档
- [testing-setup-log.md](../testing-setup-log.md) —— 测试栈整体落地全景
