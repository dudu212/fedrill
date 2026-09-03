# Sandbox E2E Harness · 从「happy-dom 没 Worker」翻车到「Playwright + harness 页面」

> 立项:2026-09-01 · 关联 [ADR-009](../decisions/009-ai-test-autonomy-tiers.md) · [调研 §3.5](../AI测试工具调研.md)
>
> 目的:记录 Step 5 沙盒红队测试第一天踩的一个坑,以及被坑撞出的一套"测浏览器 API 的正确姿势"。
>
> 面试话术钩子:「我在项目里踩过 happy-dom 没 Worker 的坑,借机把红队测试迁到 Playwright + harness 页面模式,这是测所有强依赖浏览器 API 代码的通法。」

---

## 一、事发经过(60 秒版)

按 [调研 §3.5](../AI测试工具调研.md) 计划,沙盒红队用例本来打算放在 Vitest 里(`lib/sandbox/*.security.test.ts`)。骨架搭好后跑第一条:

```
AssertionError: expected [Function] to throw error matching /超时|timeout/i
  but got 'Worker is not defined'
```

`Worker is not defined`——**happy-dom 根本没实现 Web Worker API**。而 FEDrill 沙盒的核心防线就是 Web Worker(`new Worker + 3s terminate`)。**在没有 Worker 的环境测 Worker 沙盒 = 在沙漠里测防水材料**。

## 二、修复方案总览

迁移到 **Playwright + 真 Chromium**,用 **harness 页面** 把 `runInSandbox` 从 Node 侧桥接到浏览器侧。

```
迁移前(Vitest + happy-dom · 走不通)
  ┌─────────────────────────────────────┐
  │ Vitest ─→ happy-dom ─X→ ??? Worker  │
  └─────────────────────────────────────┘

迁移后(Playwright + Chromium · 走通)
  ┌────────────────────────────────────────────────────┐
  │ Playwright(Node) ─navigate─→ /dev-sandbox-test     │
  │                              (Next.js 真页面)      │
  │                                │                   │
  │                                ↓ useEffect         │
  │                              window.__runInSandbox │
  │                                                    │
  │ Playwright ──page.evaluate──→ 真 Chromium 内       │
  │                              runInSandbox(...)     │
  │                                │                   │
  │                                ↓ new Worker        │
  │                              真 Web Worker 里跑    │
  └────────────────────────────────────────────────────┘
```

## 三、关键概念逐个解释

### 1. Test Harness(测试脚手架)

**定义**:一段**只在测试时存在**的胶水代码/页面,把「被测目标」暴露到「测试工具能触达的位置」。本身没有产品价值。

**FEDrill 的 harness**([app/dev-sandbox-test/page.tsx](../../app/dev-sandbox-test/page.tsx)):

```tsx
'use client'
export default function SandboxTestHarness() {
  useEffect(() => {
    window.__runInSandbox = runInSandbox
    setReady(true)
  }, [])
  return <>{ready && <div id="sandbox-test-ready">READY</div>}</>
}
```

三个要素:
- `'use client'` —— 必须是 client component,`useEffect` 才能跑
- 挂 `window.__runInSandbox` —— 把 Node 里不能直接调的东西挂到浏览器全局
- `#sandbox-test-ready` marker —— 让 Playwright 知道"挂完了,可以调用了"

**词源**:硬件测试里 harness 指「把 IC 芯片固定住、让探针能接触到引脚的托架」。软件借用了这个隐喻。

### 2. `page.evaluate` · Node ↔ Browser 桥梁

**是什么**:Playwright 提供的 API,把一段 JS 函数**序列化成字符串**发到浏览器执行,拿到返回值(必须能 structured-clone)。

```ts
const result = await page.evaluate(async () => {
  // 这段代码运行在浏览器里,不在 Node 里
  return await (window as any).__runInSandbox(code, 'loop', cases)
})
// result 回到 Node 侧
```

**限制(踩过一次的常识)**:
- 函数体不能引用 Node 侧的闭包变量(因为要序列化)
- 返回值必须 clone-able:**Error 对象不行**,DOM 节点不行,Function 不行
- 解法:在 evaluate 内 try/catch,只返回 `{ kind, message }` 这种普通对象

### 3. Test Environment Mismatch(测试环境与生产环境的能力差)

**问题的本质**:测试环境模拟了浏览器**一部分** API,但不是全部。你以为在测浏览器代码,实际在测「模拟浏览器的模拟能力」。

三种主流的浏览器模拟层能力对比:

| API | jsdom | happy-dom | 真浏览器 |
|---|---|---|---|
| `document` / `window` | ✅ | ✅ | ✅ |
| `fetch` (Node 18+) | ✅ | ✅ | ✅ |
| `localStorage` | ✅ | ✅ | ✅ |
| **Web Worker** | ❌ | ❌ | ✅ |
| `SharedWorker` | ❌ | ❌ | ✅ |
| `Service Worker` | ❌ | ❌ | ✅ |
| `IndexedDB` | ⚠️ 部分 | ⚠️ 部分 | ✅ |
| `WebGL` / `Canvas 2D` | ⚠️ node-canvas | ❌ | ✅ |

**教训**:若被测代码用了上表下半区的 API,**必须**用真浏览器(Playwright / Cypress),不能用 jsdom/happy-dom 单测。

### 4. `worker.terminate()` 的原子性

**是什么**:主线程调用 `worker.terminate()` 会**立刻**销毁 Worker,不等待其 microtask/macrotask 队列清空。

**为什么关键**:如果没有这个原子性,`while(true){}` 就永远拿不到"停止"信号——因为 Worker 内部的所有停止逻辑都要走 event loop,而它已经被 while 循环霸占了。

**验证**:RT-01 里 `500ms` 超时后,主线程 `setTimeout` 触发 `terminate()`,总耗时 ~500ms 而不是无限等待。今晚跑绿的 2.9s 就是证据。

### 5. Structured Clone(结构化克隆)

**是什么**:浏览器把对象在 Worker/主线程 之间传输时用的深拷贝算法。也是 `page.evaluate` 返回值走的通道。

**能 clone**:普通对象、数组、Date、Map、Set、Blob、ArrayBuffer、TypedArray、null/undefined、primitives。

**不能 clone**:Function、Error、DOM 节点、Symbol、类实例(会退化成普通对象丢方法)。

**FEDrill 里的关联**:worker.ts 里 `ctx.postMessage(res)` 把 `results` 传回主线程走的就是这条通道。若 `actual` 是超大对象(参见 RT-05),结构化克隆会耗时甚至 OOM。**这是 RT-05 存在的技术原因。**

### 6. Next.js App Router 私有目录约定(踩坑点)

**规则**:App Router 里,`_` 下划线开头的文件夹被视为 **private folder**,**不生成路由**。

- ✅ `app/dev-sandbox-test/` → 路由 `/dev-sandbox-test`
- ❌ `app/_sandbox-test/` → 无路由,访问 404
- ❌ `app/__sandbox-test/` → 无路由(双下划线也一样开头是下划线)

**用途**:让你在 `app/` 下放辅助文件(hooks、utils、组件片段)而不暴露成路由。

**FEDrill 踩坑记录**:第一版 harness 用了 `app/__sandbox-test/page.tsx`,`curl` 返回 404 才反应过来。改成 `app/dev-sandbox-test/` 立即 200 OK。

**上线前收尾**:harness 页面**必须**在 production 环境屏蔽。三种做法:
1. **中间件**:`middleware.ts` 检测 `pathname.startsWith('/dev-')` + `NODE_ENV === 'production'` → 404
2. **环境变量 + 条件路由**:页面内 `if (process.env.NODE_ENV === 'production') notFound()`
3. **构建时排除**:`next.config` 里配 `pageExtensions` 过滤(较麻烦)
FEDrill 目前未上线,这条 TODO 挂在 M4 上线清单。

---

## 四、更普适的规律 · 什么代码"必须真浏览器测"

这次踩坑抽象出一条判断规则,以后遇到类似决策直接查表:

| 被测代码依赖的 API | 能用 happy-dom/jsdom 吗 | 建议 |
|---|---|---|
| 纯逻辑 / 状态机 / DOM 查询 | ✅ | Vitest + happy-dom |
| localStorage / cookie | ✅ | Vitest + happy-dom |
| fetch 到外部 (需 mock) | ✅ + MSW | Vitest + MSW |
| **Web Worker / SharedWorker** | ❌ | **Playwright + harness** |
| **Service Worker / PWA** | ❌ | **Playwright + harness** |
| IndexedDB 复杂事务 | ⚠️ 有限 | Playwright 更稳 |
| WebGL / Canvas 视觉断言 | ❌ | Playwright |
| WebSocket / WebRTC | ❌ | Playwright |
| **File API / Clipboard** | ⚠️ 不完整 | Playwright |

**判断口诀**:如果 API 名字里带 "Worker" / "Service" / "Real-time" / "Media" / "GL",一律真浏览器。

---

## 五、FEDrill 里怎么落地的

**新增文件**:
- [app/dev-sandbox-test/page.tsx](../../app/dev-sandbox-test/page.tsx) — harness 页面
- [tests/e2e/sandbox-redteam.spec.ts](../../tests/e2e/sandbox-redteam.spec.ts) — 6 条红队用例(RT-01 全实现,RT-02-06 骨架)

**删除文件**:
- ~~`lib/sandbox/runner.security.test.ts`~~ — Vitest 版,happy-dom 走不通,已废弃

**跑通结果**:`pnpm test:e2e sandbox-redteam` → 6 passed (2.9s)
- RT-01 真的守住了(500ms 超时,`terminate` 生效)
- RT-02-06 是 `expect(true).toBe(true)` 占位,等 Tier 3 人手写断言

**面试可讲的点**(按重要性排列):
1. **踩坑本身**:发现 happy-dom 缺 Worker,不是所有浏览器 API 都有 shim
2. **迁移决策**:选 Playwright + harness 而不是"给 happy-dom 加 polyfill"或"换 jsdom"——因为要测的是**真 Worker 语义**,不是能不能过测试
3. **harness 模式**:通用的「Node 测浏览器专属能力」范式,可迁移到 SW、IndexedDB、WebRTC 场景
4. **RT-01 里 500ms 真的被杀了**:证明 `worker.terminate()` 的原子性——微任务队列被霸占也能杀,不是 microtask 层的取消信号

---

## 六、进一步 · 想清楚了再加的功能

- [ ] 上线前把 harness 页面在 production 屏蔽(M4 上线清单)
- [x] RT-02-06 断言体填充 · 2026-09-02 完成(6/6 全绿)
- [x] RT-03 决策 · 走路径 B 修 worker.ts,双层防御闭环 · 见 [closure-shadow-and-nonce.md](closure-shadow-and-nonce.md)
- [ ] RT-05 结构化克隆超限后加大小上限 · elapsed ~1.3s 暂无风险,不开 ADR
- [ ] RT-06 fetch 敞口 · 实证成立(`blocked:Failed to fetch` 仅因端口不通),M4 前评估 iframe sandbox / CSP / QuickJS-WASM

---

## 七、后记 · Step 5 完整收官(2026-09-02)

**从 3/6 到 6/6 · 关键节点**:

1. RT-05 计时断言:elapsed ~1.3s,50MB 结构化克隆不构成风险,ADR 免开
2. RT-06 fetch 实证:`blocked:Failed to fetch` —— 网络层因端口不通失败,不是浏览器安全策略拦,**敞口成立**,登记 M4
3. **RT-03 从"待决策"到"闭环"**:选择路径 B(修 worker),不选 A(登记漏洞)。理由三条:
   - 反正 M2 前也要修,现在修比记 TODO 心智负担小
   - "防御纵深"比"登记漏洞"是**更高档次**的面试话术
   - 沙盒代码理解此时最深,过一周回来还要重读

**双层防御的技术要点**:
- 层 1 · Closure Shadow(`new Function('self','postMessage',...)` + strict mode)—— 挡直接调用
- 层 2 · Nonce(`crypto.randomUUID()` + 主线程 onmessage 校验)—— 挡元编程绕过

**完整技术复盘**(STAR 结构)见 [closure-shadow-and-nonce.md](closure-shadow-and-nonce.md)。

**Step 5 成果**:
- 沙盒红队 6 类攻击面 · 6/6 全绿(9.5s)
- 原 43 单测无回归
- 2 处真漏洞:1 已修(RT-03)+ 1 已登记(RT-06)
- 简历叙事从「测了沙盒」升级为「做了防御纵深并清楚边界」

---

## 附录 · 通俗介绍(讲给别人听时用)

### 一句话版本

**给 FEDrill 的沙盒装了一套"入侵检测器",并让第一个检测器真的能报警。**

### 解释
FEDrill 有个关键安全边界——Web Worker 沙盒,专门跑用户代码。这边界有漏洞,别人的代码就能:冻结你的浏览器 / 伪造判题结果骗过 AI 教练 / 从你电脑往攻击者服务器发请求。以前没人测过。今天:

1. 列出 6 类攻击手法("红队用例",安全圈术语)
2. 搭了真正能测浏览器行为的框架——踩了个坑:happy-dom 竟然不支持 Web Worker,只好换 Playwright(真开浏览器进程)
3. 第一条攻击"死循环"跑通,证明 3 秒熔断真的会杀掉恶意循环
4. 剩下 5 条留骨架,还发现了 2 处**真漏洞**(结果伪造 + fetch 出口)

**🥇 技术层面**

> 我在 FEDrill 里做了一套针对 Web Worker 沙盒的红队测试套件,三个亮点:
>
> 第一,**攻击面识别**——扫沙盒 runner 和 worker,识别 6 类攻击面,定位 2 处真漏洞:用户代码可以调 `self.postMessage` 伪造判题结果(main 端不校验来源);Web Worker 里没有 CSP,fetch 出口全开。
>
> 第二,**测试环境决策**——原本用 Vitest + happy-dom,发现 happy-dom 根本没实现 Web Worker,`Worker is not defined`。这是 jsdom/happy-dom 类工具的通病,只模拟一部分 API。迁到 Playwright + harness 页面模式:测试专用页面把 runInSandbox 挂到 window,Playwright 通过 `page.evaluate` 桥接到真 Chromium。
>
> 第三,**关键防御的实证**——同步死循环跑通,验证 `worker.terminate()` 的原子性:即使 microtask 队列被霸占,主线程 setTimeout 触发的 terminate 也能立即杀掉 Worker。端到端 2.9 秒,证明 500ms 超时防线有效。

### 关键词对照表(便于切换语境)

| 通俗说法 | 技术名词 |
|---|---|
| 安全气泡 / 通风橱 | 沙盒(Web Worker sandbox) |
| 故意搞破坏 / 演习黑客 | 红队测试(Red-team testing) |
| 测试脚手架 / 桥梁页面 | Harness 页面 |
| 真开一个浏览器测 | E2E · Playwright |
| 假的浏览器 | jsdom / happy-dom |
| 3 秒不响就掐掉 | 超时熔断 · `worker.terminate()` |
| 骗过 AI 教练伪造答对 | 结果伪造 · Result spoofing |

---

**相关**:
- [ADR-009 · AI 测试自主性 Tier 分级](../decisions/009-ai-test-autonomy-tiers.md)
- [ADR-010 · Playwright E2E 与 chromium-only 起步](../decisions/010-playwright-e2e.md)
- [AI 测试工具调研](../AI测试工具调研.md)
- [测试基建落地日志](../testing-setup-log.md)
