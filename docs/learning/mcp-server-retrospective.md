# MCP Server 完整复盘 · 从只读到判题再到 npm 发布

> M5 里程碑的完整收官。把 FEDrill 题库 + 判题能力做成一个 MCP Server，从 3 个只读 tool 起步，加 `run_tests` 判题（Node 沙箱），扩到 15 道题，最终发布到 npm。八个维度完整复盘。

## 一、背景（Situation）

FEDrill 是「手撕题 AI 教练」网站（Web Worker 沙箱 + Agent Loop）。M5 的目标是「MCP + 上线」——把题库和判题能力**暴露成 MCP Server**，让 Claude Desktop / Codex / Cursor 等第三方 AI 客户端挂载。

要一次定死 4 件事：transport 选什么、tool 范围、包放哪、发不发 npm（见 [ADR-005](../decisions/005-mcp-server.md)）。

## 二、价值（Value）

**诚实拆成三种价值：**

| 价值类型 | 高低 | 说明 |
|---|---|---|
| 协议标准化 | 高 | **write once, expose everywhere**——题库+判题变成任何 MCP 客户端都能挂的标准接口，这是网站（一个网址）给不了的「协议」价值 |
| 学习价值 | 高 | MCP 是 2025–2026 最热标准之一，手写 stdio server、Node 沙箱隔离，是吃香且可迁移的技能 |
| 功能价值 | 有限 | 5→15 道题仍偏少、是网站功能的子集；但「能用更聪明的模型（Cursor 里的 Claude）+ 结构化题库底座」是真实增量 |

**一句话**：工程上有真材实料、产品价值靠「分发 + 标准 + 作品」兑现，不是「有人会因此抛弃网站」。

## 三、问题及解决（Problems & Solutions）

| # | 问题 | 根因 | 解法 |
|---|---|---|---|
| 1 | esbuild 打包 `@/` alias 报错 | `@/` 只出现在 `import type`（编译器擦除时不解析路径） | `esbuild --bundle --packages=external` **零 alias 配置**就把题库 inline 进单文件 |
| 2 | 判题死循环卡死（Heisenbug） | `worker.terminate()` 是 fire-and-forget，残留 worker 影响后续判题 | `Promise.race` 做超时 + `finally` 里 `await worker.terminate()` |
| 3 | Cursor 里「挂载成功但工具不可用」 | Cursor 3.x 用 allowlist 白名单审批，工具默认不在白名单 | 日志定位（`workbench.mcp.allowlist.log`）→ UI 批准工具 |
| 4 | `vm.compileFunction` 报类型错 | `context` 不是它的合法选项 | 改用 `vm.runInContext(wrapper, context, { timeout })` |
| 5 | npm publish 403 | npm 强制要求 2FA | 开 TOTP 2FA 后 `--otp` 发布 |

## 四、技术决策（Decisions）

| 决策 | 备选 | 选它的理由 | ADR |
|---|---|---|---|
| Transport 起手 **stdio** | HTTP/SSE | 零运维、主流客户端默认；HTTP 是后续增量 | [005](../decisions/005-mcp-server.md) |
| **只读 3 tool** 不做判题 | vm2 / isolated-vm | vm2 弃更、isolated-vm 编译坑；判题留网站沙箱 | [005](../decisions/005-mcp-server.md) |
| **monorepo 子包** | 独立 repo | 复用 `data/problems` SSOT，题库更新零同步 | [005](../decisions/005-mcp-server.md) |
| **worker_threads + vm** 判题 | child_process / isolated-vm | vm 挡 require/process，terminate 兜超时，不引 native | [012](../decisions/012-node-sandbox-isolation.md) |
| **低层 `Server` API** | 高层 `McpServer` | 不引 zod、协议透明，贴合「手写协议」叙事 | — |
| `get_problem` **剥 testCases** | 返回全量 | 判题数据不进 MCP，忠实「题面+starterCode+edgeCases」边界 | — |

## 五、架构（Architecture）

```
[第三方 AI 客户端]
  Cursor (Agent 模式) · 挂载 npx @fedrill/mcp
        │ stdio (JSON-RPC 2.0)
        ▼
[packages/fedrill-mcp/dist/index.js]  ← esbuild 单文件 · 题库已 inline
  4 个 tool:
    list_problems / get_problem / explain_concept  (只读)
    run_tests  (判题)
        │ run_tests 走 worker_threads
        ▼
[dist/judge-worker.js]  ← vm 隔离上下文跑用户代码
        │ import type 擦除 → 复用
        ▼
[data/problems/]  ← 单一事实源 · 15 道题 · 与网站沙箱同一份题库
```

**分层**：MCP server 是独立的 monorepo 子包，通过相对路径复用根目录的 `data/problems` 和 `lib/sandbox`（`deepEqual` / `reifyInput`）。

## 六、数据流向（Data Flow）

**① MCP 握手（stdio · JSON-RPC 2.0 换行分隔）**

```
initialize（协商 protocolVersion 2024-11-05）
  → notifications/initialized
  → tools/list（拉 4 个 tool 清单）
  → tools/call（调工具，返回 { content: [{type:'text',text}], isError }）
```

**② run_tests 判题（一个 tool 调用的完整链路）**

```
tools/call { id, code }
  → handleRunTests：getProblem(id) 拿 requiredAPI + testCases.basic
  → runInSandbox(code, requiredAPI, basic)
      → worker_threads.Worker(dist/judge-worker.js)
      → vm.createContext(沙箱：只放 console/timer，不放 require/process)
      → vm.runInContext("use strict; {code} 返回 entryName", timeout 3000)
      → 每个用例：reifyInput(input) → fn(...args) → deepEqual(actual, expected)
  → 3s 超时 → Promise.race 抛「执行超时」→ finally await worker.terminate()
  → 返回 { results, totalDurationMs }
```

## 七、结果（Results）

- **4 个 tool**（3 只读 + run_tests 判题）
- **15 道题**（5 手撕基础 + 10 道补题，testCases 全验证通过）
- **npm 发布**：`@fedrill/mcp@0.2.0`，`npx @fedrill/mcp` 可用
- **验证**：smoke 3 连跑全绿（正确 4/4、错误 1/4、死循环 3s 超时）；隔离实测 `typeof require/process/fetch` 全 `undefined`；Cursor 端到端 `list_problems` 返回 15 道

## 八、涉及的八股知识点

### 1. MCP（Model Context Protocol）是什么

给 AI 应用提供标准化的「工具/资源/提示」访问协议。三个原语：**Tools**（可调用的函数）、**Resources**（可读的数据）、**Prompts**（模板）。Transport 分 **stdio**（本地子进程）和 **HTTP/SSE**（远程）。

### 2. stdio transport 的约定

`stdout` 是协议通道（只能写 JSON-RPC），**日志必须走 `stderr`**。JSON-RPC 2.0 消息换行分隔，一行一条。

### 3. esbuild 的 type-only import 擦除

`import type { X } from '@/y'` 在 parse 阶段就被擦除、**不解析路径**。所以「`@/` 只出现在 type import」的代码库打包时零 alias 配置——这是 `--packages=external`（裸 specifier 留 external）+ 相对 import inline 的完美配合。

### 4. Node 沙箱隔离的几种方案对比

| 方案 | 隔离强度 | 缺点 |
|---|---|---|
| `new Function` + shadow | 弱 | Node 全局有 require/process，shadow 挡不住 `constructor.constructor` 逃逸 |
| `vm` 模块 | 中 | 官方明说「不是安全边界」，有已知逃逸 |
| `worker_threads` + `vm` | 中 | 同 vm；但 terminate 兜超时 |
| `isolated-vm` | 强 | native addon 编译坑 |

**核心认知**：浏览器 Web Worker 是「天然隔离」（无 fs/process），Node 不是——所以 Node 判题必须用 vm 显式隔离，且要诚实声明「隔离 ≠ 安全边界」。

### 5. `worker.terminate()` 是异步 Promise

浏览器 `worker.terminate()` 同步杀线程，**Node 是异步 Promise**。fire-and-forget 会残留 worker 导致竞态——必须 `await` 收尾。这是照搬网站 runner 时最容易翻车的点。

### 6. Cursor 3.x 的白名单审批

MCP 工具不是「连上就能用」，而是 `approvalMode="allowlist"`：工具默认不在白名单，`tools/call` 在发到 server 前就被 `needsApproval` 拦下。**挂载成功 ≠ 工具可用**。

### 7. npm 发布要点

- scoped 包（`@fedrill/mcp`）需要 `publishConfig.access: "public"`，且 scope 归你所有（用户名或 org）
- npm 强制 2FA 才能发布（TOTP + `--otp`）
- `bin` 字段 + shebang（`#!/usr/bin/env node`）才能 `npx` 拉起
- `.npmrc` 镜像只读，发布要 `--registry https://registry.npmjs.org/`

## 相关文件

- [ADR-005 MCP Server 设计](../decisions/005-mcp-server.md)
- [ADR-012 Node 沙箱隔离](../decisions/012-node-sandbox-isolation.md)
- [packages/fedrill-mcp/](../../packages/fedrill-mcp/) —— server 源码
- [lib/sandbox/](../../lib/sandbox/) —— 复用 deepEqual / reifyInput
