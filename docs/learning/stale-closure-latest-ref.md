# Latest Ref Pattern · 修 React 与命令式 API 集成的 stale closure

> 起因:一个真实翻车 · Monaco 的 `Ctrl+Enter` 快捷键总是跑不到最新代码,但按钮正常。
>
> 沉淀:这不是 Monaco 特有的坑,而是 **React 响应式模型 vs 命令式外部 API 集成**的通用问题。学会 latest ref pattern,能解决 90% 类似场景(Monaco / setInterval / WebSocket 回调 / 第三方图表库 / native `addEventListener`)。

## 一、翻车现场

FEDrill Phase 1a 完成后,发现:

- **点击"运行"按钮** → 沙箱正常跑,拿到测试结果 ✓
- **Ctrl+Enter 快捷键** → 报 `未在用户代码中找到函数 "myFlat"` ✗

两个路径明明都调用同一个 `runTests`,为什么行为不一样?

## 二、诊断 · 两条路径的关键差异

先看代码结构:

```tsx
function ProblemPage() {
  const [code, setCode] = useState('')

  const runTests = useCallback(async () => {
    const res = await runInSandbox(code, ...)   // ← 闭包读 code
    // ...
  }, [code, ...])   // ← code 变 → 新 runTests

  return (
    <>
      {/* 路径 1 · 按钮 */}
      <button onClick={runTests}>运行</button>

      {/* 路径 2 · Monaco Ctrl+Enter */}
      <Editor
        onMount={(editor, monaco) => {
          editor.addCommand(
            monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
            () => runTests(),   // ← 这里的 runTests 是哪一版?
          )
        }}
      />
    </>
  )
}
```

关键事实:

| 事实 | 后果 |
| --- | --- |
| `runTests` 是 useCallback,`code` 在 deps 里 | code 变 → useCallback 重建 runTests,新版闭包读到新 code |
| React 每次 render 创建新的 `onClick={runTests}` 引用 | 按钮每次点击拿到**当前 render 的**最新 runTests ✓ |
| Monaco 的 `editor.addCommand(...)` 只在 `onMount` 里注册**一次** | 之后再 render 也不重新注册 |

`onMount` 是 Monaco 的生命周期钩子,**编辑器挂载时执行一次**。它捕获的 `runTests` 是**首次 render 时的引用**——那时 `code` 还是初始值 `''`(还没从 SessionRepo 水合)。

后续用户打字 → code 变 → useCallback 重建 runTests → 但 Monaco 里挂着的还是最初那个陈旧闭包,里面 `code` 永远是 `''`。

**这就是 stale closure(陈旧闭包)**。

## 三、根因图 · 两种编程模型的错配

```
[React 响应式模型]                    [命令式外部 API]
─────────────────                     ─────────────────

Render #1                              editor.addCommand(handler_1)
├─ code = ''                                    ↑
├─ runTests = fn_1 (读 code='')       ─────────┘  (Monaco 注册这一份)
├─ onMount 触发,把 fn_1 交给 Monaco
└─ 渲染完成

  (用户打字)

Render #2
├─ code = 'function myFlat() {...}'
├─ runTests = fn_2 (读 code='function myFlat...')   ← React 有新的
├─ onMount 不再触发                                  ← Monaco 不知道
└─ 渲染完成

  (用户按 Ctrl+Enter)
                                       Monaco 触发 handler_1
                                       handler_1 里调 fn_1
                                       fn_1 里的 code 仍然是 '' ✗
```

**问题的本质**:React 假设"每次 render 是全新的一帧",closure 只对本帧负责。命令式 API 假设"我拿到你的回调,以后就用这一份"。**两个假设正面冲突**,需要一层桥接。

## 四、修法 · Latest Ref Pattern

用一个 `ref` 始终指向"当前 render 的最新回调",命令式 API 里读 `ref.current`,永远新鲜:

```tsx
function ProblemPage() {
  const [code, setCode] = useState('')

  const runTests = useCallback(async () => {
    const res = await runInSandbox(code, ...)
  }, [code, ...])

  // 桥接层 · 每次 render 把最新 runTests 同步到 ref
  const runTestsRef = useRef(runTests)
  useEffect(() => {
    runTestsRef.current = runTests
  }, [runTests])

  return (
    <Editor
      onMount={(editor, monaco) => {
        editor.addCommand(
          monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
          () => {
            // Monaco 挂载时捕获的是箭头函数,而箭头函数读 ref.current
            // ref.current 由 useEffect 保持最新 → 永远拿到新鲜的 runTests
            runTestsRef.current()
          },
        )
      }}
    />
  )
}
```

三个关键点:

1. **`ref` 的 identity 稳定** —— `runTestsRef` 这个 ref object 本身跨 render 保持不变,Monaco 捕获它一次就够。
2. **`ref.current` 可变** —— useEffect 每次 render 后把新 `runTests` 写进 `.current`。
3. **Monaco 里的箭头函数**是**间接引用**——它捕获的是 `runTestsRef`(稳定),不是 `runTests`(每次新);运行时才通过 `ref.current` 拿最新回调。

## 五、通用适用性 · 不只是 Monaco

以下场景都是同一个陷阱的变体:

| 场景 | 陈旧闭包发生在 | 解法 |
| --- | --- | --- |
| **`setInterval` / `setTimeout`** | 定时器只在 `useEffect(() => setInterval(...), [])` 里注册一次 | latest ref |
| **`WebSocket` `onmessage`** | 建连接时把 `onmessage` 绑定一次 | latest ref |
| **native `addEventListener`** | mount 时挂 listener,unmount 时移除 | latest ref |
| **第三方图表库事件**(D3 / Chart.js) | 图表 init 时注册回调 | latest ref |
| **Monaco / CodeMirror 命令注册** | onMount 一次性 register | latest ref(本文场景) |
| **React DnD / MSW handler** | 类似 | latest ref |

一句话:**任何"外部世界只拿一次你的回调"的集成点,都需要 latest ref 桥接**。

## 六、相关模式 · `useEventCallback`

社区常把这个 pattern 抽成 hook,叫 `useEventCallback` / `useLatest` / `useLatestRef`。React 官方 RFC 也曾讨论把 `useEvent`(现在叫 `useEffectEvent`)纳入标准,截至 2026 仍在 experimental。

一个自己写的通用版:

```ts
function useLatestCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
): T {
  const ref = useRef(callback)
  useEffect(() => {
    ref.current = callback
  }, [callback])
  return useCallback(
    ((...args) => ref.current(...args)) as T,
    [],
  )
}

// 用法:
const stableRunTests = useLatestCallback(runTests)
// stableRunTests 引用稳定,但每次调用都跑最新的 runTests
```

好处:返回的 `stableRunTests` 引用永远不变(deps=[] 的 useCallback),可以直接传给命令式 API 或作为其他 hook 的 dep,不会引起无限循环。

**FEDrill 目前只有一处用到这个模式,先不抽 hook**;M2b 若出现第二处,考虑抽公共 hook。

## 七、常见误解 · 为什么 useCallback 不能替代?

有人会想:`runTests` 本身就是 useCallback,难道每次 render 拿到的不是同一个引用吗?

**不是**。useCallback 的返回值**只在 deps 都相等时才复用**。`runTests` 的 deps 包括 `code`,`code` 一变就是新引用。useCallback 的目的是"deps 没变时避免下游组件重 render",不是"让引用永远稳定"。

要让引用永远稳定,只有 `useRef` 能做到——因为 ref 是"escape hatch",它跳出了 React 的响应式追踪。

## 八、面试问答备忘

**Q:什么是 stale closure?**
A:JavaScript 闭包会记住定义它时的变量值。在 React 里,每次 render 都创建新的函数(新闭包),它们各自记住自己那一帧的 state。如果某段代码持有一个"旧闭包"(比如 setInterval 里的回调),它读到的 state 就永远停留在最初那一帧,即使外层的 state 已经变了。这就是 stale closure。

**Q:useCallback 能修 stale closure 吗?**
A:**不能一劳永逸**。useCallback 只在"用它的地方每次 render 都能拿到最新引用"时有用——比如 JSX 里 `<button onClick={runTests}>`。但如果回调被交给一个**只拿一次**的外部 API(Monaco / setInterval / WebSocket),useCallback 每 render 生成的新引用它拿不到,还是陈旧。

**Q:那怎么修?**
A:**Latest ref pattern**。用一个 `ref` 存"最新回调",每次 render 用 `useEffect` 同步 ref.current。外部 API 里读 `ref.current()`——ref 对象引用稳定,里面的 `.current` 永远新鲜。

**Q:为什么 React 不直接提供 useEvent?**
A:官方之前提过 RFC(现在叫 `useEffectEvent`),截至 2026 还在 experimental,主要因为语义细节没定稳(比如是否可以在 render 里调、是否 stable across suspense 等)。社区自己实现的 `useEventCallback` 已经足够用,大多数库(如 react-use)都提供了。

**Q:latest ref 有副作用吗?**
A:有两个要注意的:
1. **不能在 render 里读 ref.current** —— 违反 React 的纯 render 假设,可能导致 tearing。要在事件回调、effect、外部 API 里读。
2. **异步场景要小心** —— 如果 ref.current 在 async 函数执行中间被更新,后续读到的可能是"半路的最新值",不是启动时的值。**需要"启动时快照"的场景不适合 latest ref**。

## 九、FEDrill 里的落地

- 文件:[app/problems/\[id\]/page.tsx](../../app/problems/[id]/page.tsx)
- 提交:见 git log,搜"Monaco Ctrl+Enter 用 ref"
- 效果:Ctrl+Enter 和"运行"按钮现在语义完全一致

## 十、延伸阅读

- [React 官方 · Escape hatches](https://react.dev/learn/escape-hatches)
- [Kent C. Dodds · How to use React Context effectively](https://kentcdodds.com/blog/how-to-use-react-context-effectively) —— 讲了 stable dispatch 的类似模式
- [React RFC · useEvent](https://github.com/reactjs/rfcs/pull/220) —— 官方提案,状态跟踪
- [react-use · useLatest](https://github.com/streamich/react-use/blob/master/docs/useLatest.md) —— 社区实现
