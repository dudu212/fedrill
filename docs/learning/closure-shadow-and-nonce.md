# Closure Shadow + Nonce · 沙盒结果伪造的双层防御

> 日期:2026-09-02 · 关联 [ADR-009 Tier 3](../decisions/009-ai-test-autonomy-tiers.md) · [sandbox-e2e-harness](sandbox-e2e-harness.md)
>
> **本文档按 STAR 结构写**(情境-任务-行动-成果),这是 FEDrill 学习/决策文档统一格式。
>
> 面试话术钩子:「Web Worker 沙盒的结果伪造漏洞,我做了防御纵深——闭包 shadow 挡直接调用,nonce 挡元编程绕过,并明确记录了这不是完整方案,规划了 M3/M4 换 QuickJS-WASM 的路径。」

---

## S · Situation · 情境

**背景**:FEDrill 是前端手撕题 AI 教练,M1 阶段的判题机制是 Web Worker 沙盒——主线程 `new Worker` 加载 [lib/sandbox/worker.ts](../../lib/sandbox/worker.ts),把用户提交的 JS 代码通过 `new Function(code)` 编译执行,结果 `postMessage` 传回主线程比对期望值。这套架构在 [ADR-006](../decisions/006-sandbox-vs-oj.md) 里明确"拒绝开源 OJ、自研 minimal 判题"。

**背景状态**:
- 沙盒能正常工作:5 道预置手撕题(Promise.all / debounce / curry 等)在里面跑通
- Step 5 沙盒红队测试推进到 5/6 —— RT-01/02/04/05/06 都实证了防御成立或敞口
- **只剩 RT-03 · 结果伪造(spoofing)** 一条,是主动识别出的**真漏洞**,不是"验证防御成立"
- 沙盒信任模型:主线程完全信任 Worker 的 `postMessage` 回执,`onmessage` 只判 `data.type === 'result'` 就 resolve

**为什么这时候动手**:
- M1 收尾阶段,基础设施成型,精力可以集中投在安全边界
- 沙盒代码理解此时最深(刚扫过 6 类攻击面),回来再改要重读
- ADR-009 Tier 3 已就位,流程清楚:AI 诊断 + 人手写代码

---

## T · Task · 任务

**攻击场景**:

用户提交的 fn 在**返回真结果之前**,主动调用 `self.postMessage` 伪造一份「全过」的 result 消息:

```js
function spoof(realArg) {
  self.postMessage({
    type: 'result',
    results: [{name:'假通过', passed:true, input:[], expected:42, actual:42, durationMs:0}],
    totalDurationMs: 0,
  })
  return realArg  // 真返回 0,期望 42,本该 fail
}
```

主线程 `worker.onmessage` **收到伪造消息就 resolve**,`worker.terminate()` 后连真结果都不需要发出——**攻击者赢**。

**约束**:
- **不换沙盒机制**(iframe sandbox / QuickJS-WASM 是 M3/M4 大改)
- **不误伤合法代码**(5 道预置题必须仍能通过,43 条原有单测不能挂)
- **JS 元编程绕过是理论上不可避免的**——`new Function('return this')()` 能拿到真全局,任何 shadow 都能绕
- **Tier 3 规矩**(ADR-009):AI 只诊断 + 提方案 + 逐行 review,代码人手写

**要解决的核心矛盾**:**如何在承认"绝对防御不可能"的前提下,把 99% 的实际作弊挡下**?

---

## A · Action · 行动

**总体设计**:**防御纵深**——两层独立防线,任一层生效即可挡住攻击。

### 层 1 · Closure Shadow(闭包遮挡) · 挡直接调用

**原理**:`new Function` 除了传代码字符串,还能接前几个参数作为**函数形参名**。函数体内的这些名字会**优先解析为参数**,而不是全局。

**改造前**([lib/sandbox/worker.ts](../../lib/sandbox/worker.ts)):

```ts
const factory = new Function(
  `${code}\nreturn typeof ${entryName} !== 'undefined' ? ${entryName} : undefined`,
)
const fn = factory()
```

**改造后**:

```ts
const factory = new Function(
  'self', 'postMessage', 'globalThis', 'importScripts',   // ← 参数名 shadow
  `"use strict";\n${code}\nreturn typeof ${entryName} !== 'undefined' ? ${entryName} : undefined`,
)
const fn = factory(undefined, undefined, undefined, undefined)   // ← 传 undefined
```

**用户视角**:
- `self.postMessage(...)` → `self` 是 undefined → 抛 TypeError
- `postMessage(...)` → postMessage 是 undefined → 抛 TypeError
- `globalThis.postMessage(...)` → globalThis 是 undefined → 抛 TypeError
- `this.postMessage(...)` → strict mode 下 this 是 undefined → 抛 TypeError

**挡什么**:所有**直接命名引用**这 4 个符号的伪造代码。这是 90% 复制粘贴级作弊的形态。

**挡不住什么**:
- `new Function('return this')()` —— Function 构造函数不受 shadow 影响,能拿到真全局
- `(0).__proto__.constructor.constructor('return this')()` —— 原型链爬
- `import('data:...')` —— 动态导入

### 层 2 · Nonce(签名校验) · 挡元编程绕过

**原理**:即使层 1 被绕过,攻击者拿到了真 `postMessage`,但**不知道本次运行的签名**(nonce),伪造的消息缺 nonce,主线程认得出来。

**协议改造** [lib/sandbox/types.ts](../../lib/sandbox/types.ts):

```ts
export type SandboxRequest = {
  type: 'run'
  code: string
  entryName: string
  cases: TestCase[]
  nonce: string   // ← 新增
}

export type SandboxResponse =
  | { type: 'result'; nonce: string; results: TestResult[]; totalDurationMs: number }
  | { type: 'error'; nonce: string; error: string }
  //                 ^^^^^^^^^^^^^^^ 两个变体都加
```

**主线程** [lib/sandbox/runner.ts](../../lib/sandbox/runner.ts):

```ts
const nonce = crypto.randomUUID()   // ← 每次 run 新生成

// ...

worker.onmessage = (e: MessageEvent<SandboxResponse>) => {
  const data = e.data
  if (data.nonce !== nonce) return   // ← 签名不匹配丢弃
  // ...原有逻辑
}

const request: SandboxRequest = {
  type: 'run',
  code, entryName, cases,
  nonce,   // ← 发给 worker
}
worker.postMessage(request)
```

**Worker 端** [lib/sandbox/worker.ts](../../lib/sandbox/worker.ts):

```ts
const { code, entryName, cases, nonce } = e.data   // ← 解出 nonce

// ... 三处 postMessage 响应都附 nonce:
ctx.postMessage({ type: 'result', nonce, results, totalDurationMs })
ctx.postMessage({ type: 'error', nonce, error: '...' })
```

**为什么 nonce 不能被泄漏**:nonce 是 worker.ts 内部作用域的常量,**用户代码的 fn 作用域根本看不到它**。就算元编程绕过 shadow 拿到真 postMessage,发消息时也带不上正确 nonce。主线程校验失败,丢弃。

### 关键设计决策(3 个)

1. **Nonce 由主线程生成**:主线程是信任根,worker 是打工的。反过来 worker 生成 nonce,如果 worker 被攻破就没意义。用 `crypto.randomUUID()` 而不是 `Math.random()`——前者密码学随机,不可预测。

2. **Shadow 只选 4 个符号**(self / postMessage / globalThis / importScripts):这 4 个是 Worker 里"往外发消息"的所有直接入口。**不 shadow `fetch`**——那是 RT-06 的事,和结果伪造是不同层次的敞口。

3. **不修 `new Function` 而修 factory 参数**:另一个方案是禁用 new Function(不允许用户代码),但这颠覆整个判题机制。改 factory 参数**几乎无侵入**,只是给现有的 IIFE 包装加了 4 个形参名。

### 实施顺序(按 Tier 3 逐文件)

1. `types.ts` 加 nonce 字段 → TS 报错 3 处(缺 nonce 的响应对象)
2. `runner.ts` 三处小改:生成、校验、附上 → TS 错误降 1 处
3. `worker.ts` 五处小改:解构、IIFE + shadow、三处响应附 nonce → TS 错误清零
4. `sandbox-redteam.spec.ts` 补 RT-03 断言(spoof 失败 · actual=0 · passed=false)
5. `pnpm test` 先跑 → 确认 shadow 未误伤(43 条无回归)
6. `pnpm test:e2e sandbox-redteam` → 确认 RT-03 通过

---

## R · Result · 成果

### 定量结果

- **RT-03 双层防御通过** · e2e 6 passed (9.5s)
- **原 43 单测无回归** · 3 条测试文件全绿,shadow 未误伤 5 道预置题
- **代码变更规模**:4 个文件,+165 -34 行
- **投入时间**:约 60 分钟(诊断已在此前完成,实施纯执行)

### 能力覆盖

| 攻击手段 | 防御层 | 结果 |
|---|---|---|
| `self.postMessage(...)` 直接调 | Shadow | ✅ TypeError |
| `postMessage(...)` 无前缀调 | Shadow | ✅ TypeError |
| `this.postMessage(...)` | Shadow(strict) | ✅ TypeError |
| `globalThis.postMessage(...)` | Shadow | ✅ TypeError |
| `new Function('return this')().postMessage(...)` | Nonce | ✅ 消息无 nonce 丢弃 |
| 原型链爬拿全局 | Nonce | ✅ 消息无 nonce 丢弃 |
| 动态 import 拿全局 | Nonce | ✅ 消息无 nonce 丢弃 |

### 已知边界(诚实登记)

- Shadow 是"表面拦截",不是"能力剥夺"—— 元编程能绕
- Nonce 依赖 `crypto.randomUUID()` 的随机性(几乎无懈可击,除非 Math.random 被劫持——那是更深层的攻击)
- **不能挡的场景**:
  - 用户代码里通过 `throw` 抛特制对象干扰主线程状态(不是伪造 result,是别的 DoS 面,不在 RT-03 范围)
  - Worker 内 `Object.prototype` 被污染后影响 deepEqual 判等(RT-04 已验证不跨 run,单 run 内可能有影响,但用户是骗自己不影响判定质量)

### 更普适规律(可复用到别的场景)

**「表面 shadow + 深层签名」** 是所有跨信任边界通信的通用范式:

- **Web Worker vs 主线程**:本次
- **iframe 内嵌页面**:跨 origin,`postMessage` 加 nonce
- **Node child_process**:IPC 消息加 nonce
- **浏览器 extension messaging**:content script vs background,加 nonce
- **WebSocket 服务端**:消息附 session token

**判断口诀**:任何"接收方无法验证发送方身份"的通道,都需要一层带随机签名的握手。

### 已开启的后续动作

- [x] 本 STAR 学习笔记(此文)
- [x] [sandbox-e2e-harness.md](sandbox-e2e-harness.md) 加"后记 · Step 5 完整收官"小节
- [x] [testing-setup-log.md](../testing-setup-log.md) 更新 Step 5 3/6 → 6/6
- [ ] M4 上线前决策:换 iframe sandbox / QuickJS-WASM(另开 ADR)
- [ ] harness 页面 production 屏蔽(M4 前)

### 面试话术升级(前后对比)

**改前**(登记漏洞路径):

> "我做了红队测试,发现了 postMessage 伪造漏洞,登记在待办里。"

**改后**(双层防御路径):

> "我做了红队测试,发现 Web Worker 沙盒的结果伪造漏洞。做了两层防御:
>
> 层 1 是闭包 shadow,`new Function` 接 self/postMessage/globalThis/importScripts 作参数,传 undefined,加 strict mode 让 this 也是 undefined,用户 fn 内直接调这些符号立即 TypeError。
>
> 层 2 是 nonce 校验,主线程 `crypto.randomUUID()` 每次 run 新生成,worker 内部所有消息附带,主线程 onmessage 校验不匹配丢弃。即使用户通过元编程绕过 shadow 拿到真 postMessage,伪造的消息没 nonce 也发不进来。
>
> 我清楚这不是绝对安全,元编程理论上能绕 shadow,但 nonce 层兜住。**彻底方案是换 iframe sandbox 或 QuickJS-WASM,我在 ADR-009 明确规划了 M4 前迁移**。"

—— **"能讲清楚方案边界"** > **"我修了 bug"**,这是中级和高级的分水岭。

---

## 相关

- [ADR-009 · AI 测试自主性 Tier 分级](../decisions/009-ai-test-autonomy-tiers.md) —— 本次流程的规矩
- [ADR-006 · 自研 minimal 判题器 vs 引入开源 OJ](../decisions/006-sandbox-vs-oj.md) —— 沙盒选型
- [sandbox-e2e-harness.md](sandbox-e2e-harness.md) —— Step 5 环境迁移与 6 类攻击面全景
- [ai-testing-interview.md](ai-testing-interview.md) —— 22 题 AI 项目测试面试题
