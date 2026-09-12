# 012 · MCP 判题 tool 的 Node 侧沙箱隔离

- 状态: Accepted
- 日期: 2026-09-09
- 关联模块: L6 · MCP + 沙箱

## 背景

MCP v1 只做了 3 个只读 tool（[ADR-005](005-mcp-server.md) 决策 2 暂缓判题）。要让 MCP 从「查题面」升级到「AI 教练真正判题」，需要加 `run_tests` tool，在 MCP server（Node 进程）里跑用户代码。

关键问题：网站沙箱跑用户代码靠的是**浏览器 Web Worker 的自然隔离**（没有 fs / 没有 process）。但 MCP server 跑在 **Node** 里，Node 的全局有 `require` / `process` / `fetch`——直接 `new Function` 等于在用户本机开一个「AI 驱动的代码执行口」。

## 候选方案

| 方案 | 隔离强度 | 缺点 |
|---|---|---|
| `new Function` + shadow（照搬网站） | 弱 | Node 全局有 require/process，shadow 挡不住 `constructor.constructor` 逃逸 |
| `vm` 模块（built-in） | 中 | 官方明说「不是安全边界」，有已知逃逸 |
| `worker_threads` + `vm` | 中 | 同 vm；但 `terminate()` 能兜住超时/挂起 |
| `child_process` + `vm` | 中高 | `process.exit` 只杀子进程；但 IPC 复杂、要多 bundle 一份 |
| `isolated-vm` | 强（真隔离） | native addon 编译坑（ADR-005 已论证） |

## 决定

**`worker_threads` + `vm`**，架构 mirror 网站沙箱（[`lib/sandbox/`](../../lib/sandbox/)）：

| 网站沙箱 | Node 判题 | 作用 |
|---|---|---|
| `new Worker` | `worker_threads.Worker` | 独立线程，超时 `terminate()` 硬杀（覆盖同步死循环 + 异步挂起） |
| `new Function` | `vm.createContext` + `vm.compileFunction` | 编译并运行用户代码；Node 全局有 require/process，用 vm 隔离掉 |
| `reifyInput` / `deepEqual` | 直接 import 复用 | 纯逻辑，零改动 |
| shadow + nonce | 同网站 | 防伪造结果（RT-02/03） |

**为什么不用 `isolated-vm`**：native addon 编译坑（Windows/M1/Vercel 都要单独适配），与 ADR-006「不重造沙箱」精神一致。**为什么不用 `child_process`**：`worker.terminate()` 已兜住超时，child_process 唯一的额外收益（`process.exit` 逃逸只杀子进程）覆盖的是「恶意逃逸」场景，复杂度不值。

**诚实声明残余风险**：`vm` 是「隔离」不是「安全边界」——`constructor.constructor('return process')()` 这类已知逃逸仍在。这与网站沙箱定位一致（Web Worker 也是隔离非安全），且 MCP 跑的是「用户自己的代码 + 可信题库」，威胁模型是「AI 生成代码的意外 / 注入」，不是「恶意攻击者」。

## 结果与回顾

**v1 已实现并验证**（2026-09-09）：

- `run_tests` tool 上线：worker_threads + vm 隔离 + `Promise.race` 超时 + nonce。smoke 3 连跑全绿（正确 4/4、错误 1/4、死循环 3s 超时）。
- 隔离实测：`typeof require / process / fetch / globalThis.require` 在上下文里都是 `undefined`，naive 访问被 vm 挡住。

**踩坑**：

1. **`worker.terminate()` 是 fire-and-forget 的竞态**：初版 `finish` 里 `void worker.terminate()` 不 await，导致前一次判题的 worker 没清理干净、下一次判题（尤其死循环 case）卡死——而且是个 Heisenbug（加一行 `console.error` 就消失）。修法：`Promise.race` 做超时 + `finally` 里 `await worker.terminate()` 确保彻底清理。这印证「worker 生命周期必须显式 await 收尾」。
2. **Node worker_threads ≠ 浏览器 Worker**：浏览器 `worker.terminate()` 同步杀线程，Node 是异步 Promise。照搬网站 runner 时这点最容易翻车。
