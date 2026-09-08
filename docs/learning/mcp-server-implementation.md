# FEDrill 题库 MCP Server · stdio + 3 只读 tool 落地

> M5 的第一块 · 把 FEDrill 题库暴露成 MCP Server，让 Cursor 等 MCP 客户端挂载。从 ADR-005 四连决策到端到端验证，踩了 esbuild alias / Cursor 白名单两个坑。

## Situation · 触发这次工作的场景

M5 里程碑是「MCP + 上线」——把 FEDrill 的能力暴露成 MCP(Model Context Protocol) Server，让 Claude Desktop / Codex / Cursor 等 MCP 兼容客户端挂载。这是「AI 教练」能力走出自家网页、进入第三方 AI 客户端的通道。

起手前发现要一次性定死 4 件事，否则后续返工：transport 选什么、tool 范围怎么定、包放哪、发不发 npm。

## Task · 要解决的问题

1. **4 个决策一次定死**（transport / tool 范围 / 打包位置 / 发布策略）
2. **实现 stdio MCP server**，3 个只读 tool
3. **复用 `data/problems` 单一事实源**，判题继续留在网站沙箱（零安全风险）
4. **端到端挂载验证**——不是「能 build」就完，是「第三方客户端真的能调 tool」

## Action · 做了什么

### 行动 1 · 四连决策（见 ADR-005）

| # | 决策 | 要点 |
|---|---|---|
| 1 | Transport 起手 **stdio** | 零运维、零网络、主流客户端默认；HTTP 是后续增量非互斥 |
| 2 | **只读 3 tool** 不做判题 | `vm2` 已弃更、`isolated-vm` 有 native 编译坑；判题留在网站沙箱 |
| 3 | **monorepo 子包** | 复用 `data/problems` 单一事实源，题库更新零同步 |
| 4 | **v1 不发 npm** | tool 设计还会变，稳定后再发 |

### 行动 2 · 建 monorepo 子包 + esbuild bundle

`pnpm-workspace.yaml` 加 `packages: ['packages/*']`，建 `packages/fedrill-mcp/`。构建用 esbuild：

```bash
esbuild src/index.ts --bundle --platform=node --format=esm --packages=external --outfile=dist/index.js
```

产出**单个 `dist/index.js`**（20.6KB）：题库 inline，`@modelcontextprotocol/sdk` 留作运行时依赖。

### 行动 3 · 低层 Server API + 3 tool

SDK 1.30.0 把低层 `Server` 标了 `@deprecated`（推荐高层 `McpServer`），但**故意用低层**：

```ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'

const server = new Server({ name: 'fedrill-mcp', version: '0.1.0' }, { capabilities: { tools: {} } })
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [...] }))
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params
  // dispatch 到 per-tool handler
})
```

理由：不引 zod、协议细节透明，贴合「手写协议」叙事（和 ADR-001「不用 Vercel AI SDK 手写 SSE」一脉相承）。

3 个 tool 的实现要点：

- `list_problems({category?})` —— 分类键同时兼容英文（`util`）和中文（`工具函数`）
- `get_problem({id})` —— **剥掉 `testCases`**（判题数据），只给「题面 + starterCode + edgeCases + hint」
- `explain_concept({topic})` —— 全文匹配 title/description/tags/edgeCases，复用题库已有的 hint 当「知识点」，不另造内容

### 行动 4 · esbuild 零 alias 打包的关键洞察

`data/problems/*.ts` 里的 `@/` 别名**只出现在 `import type`**：

```ts
import type { ImplProblemMinimal } from '@/lib/types/problem'  // 只 type
import deepClone from './deep-clone'  // 运行时 relative
```

esbuild 擦除 type-only import 时**不解析路径**。所以 `--bundle --packages=external` 无需任何 alias 配置就把题库 inline 进单文件，`@/` 残留 0 处。这是「零成本跨包复用」的关键。

### 行动 5 · 挂载 Cursor（本机只有 Cursor）

先本地验证：写 `scripts/smoke.mjs`，用**原始 JSON-RPC** 走一遍 stdio 握手（initialize → tools/list → 3 个 tool 各调一次），无 MCP client SDK 依赖——这本身就是「手写协议」的延伸。

本机只有 **Cursor**（无 Claude Desktop/Codex），用项目级 `.cursor/mcp.json`（同 Claude Desktop 格式）：

```json
{ "mcpServers": { "fedrill": { "command": "node", "args": ["E:/fedrill/packages/fedrill-mcp/dist/index.js"] } } }
```

动手前先验证两件环境事实：

- `node` 走 Volta，但 shim（`C:\Program Files\Volta`）和真实 node（`D:\Node\nodejs`）**都在系统 PATH**，GUI 应用继承后 `command:"node"` 能解析，无需绝对路径。
- 服务端从**非包目录**起也能正常响应（SDK 从 `dist/../node_modules` 向上解析，不依赖 CWD）。

### 行动 6 · 排查「挂载成功 ≠ 工具可用」

端到端验证时遇到最隐蔽的一坑：server 连接成功、3 个 tool 注册成功（Cursor 把它们存进了 `tools/` 目录），但**每次 `tools/call` 都被拒**，请求根本没发到 server。

翻 Cursor 日志，在 `workbench.mcp.allowlist.log` 找到铁证：

```
[permissions-service] shouldBlockMcp: needsApproval (not in allowlist)
    toolName="list_problems", approvalMode="allowlist"
```

**Cursor 3.x 对 MCP 工具用「allowlist 白名单审批」**：工具默认不在白名单，需在 UI 批准。修法 = 弹窗点 Allow，或 Settings → MCP 里逐个批准。批准后 `list_problems` 端到端返回 5 道题。

## Result · 最终架构

```
[第三方 AI 客户端]
  Cursor (Agent 模式) · 挂载 .cursor/mcp.json
        │ stdio (JSON-RPC 2.0)
        ▼
[packages/fedrill-mcp/dist/index.js]  ← esbuild 单文件 · 题库已 inline
  list_problems / get_problem / explain_concept  (只读)
        │ import type 擦除 → 复用
        ▼
[data/problems/]  ← 单一事实源 · 与网站沙箱同一份题库
```

判题继续在网站沙箱（Web Worker + shadow + nonce），MCP 这层零安全风险。

## 知识点沉淀

### 知识点 1 · MCP 协议四步

JSON-RPC 2.0 over stdio（换行分隔）。握手：

1. `initialize` —— 客户端报 `protocolVersion`，server 回协商后的版本 + capabilities + serverInfo
2. `notifications/initialized` —— 客户端通知握手完成
3. `tools/list` —— 拉工具清单（name / description / inputSchema）
4. `tools/call` —— 调工具，返回 `{ content: [{type:'text',text}], isError }`

### 知识点 2 · esbuild type-only import 擦除

`import type { X } from '@/y'` 里的 `@/y` 永远不被 esbuild 解析——type import 在 parse 阶段就被擦除。所以「`@/` 只出现在 type import」的代码库，打包时零 alias 配置。这是 `--packages=external`（裸 specifier 留 external）+ relative import inline 的完美配合。

### 知识点 3 · pnpm workspace 三行

```yaml
packages:
  - 'packages/*'
```

包内声明 `"@modelcontextprotocol/sdk": "^1.30.0"`，pnpm 自动 link。monorepo 共享单一事实源（data/problems）。

### 知识点 4 · stdio 协议通道约定

`stdout` 是协议通道（只能写 JSON-RPC），**日志必须走 `stderr`**（`console.error`）。这跟「HTTP server 的 stdout 随便打日志」不同，是 stdio transport 的硬约定。

### 知识点 5 · ESM 解析不依赖 CWD

`dist/index.js` 里 `import '@modelcontextprotocol/sdk/...'` 从 `dist/../node_modules` 向上解析，**跟进程 CWD 无关**。所以 GUI 客户端（Cursor）从任意目录拉起 server 都能 resolve SDK——挂载配置里 `args` 用绝对路径指 dist 即可，不需要 cd。

### 知识点 6 · Cursor 3.x allowlist 审批

Cursor 对 MCP 工具不是「连上就能用」，而是 `approvalMode="allowlist"`：工具默认不在白名单，`tools/call` 在发到 server 之前就被 `needsApproval` 拦下。排查日志在 `workbench.mcp.allowlist.log`。**挂载成功 ≠ 工具可用**，中间还隔着一层「批准」。

## 问答备忘

**Q: esbuild 打包为什么不用配 `@/` alias？**

A: `data/problems/*.ts` 里的 `@/` 只出现在 `import type`，esbuild 擦除 type import 时不解析路径。runtime import 全是 `./deep-clone` 这种相对路径，直接被 bundle。所以 `--bundle --packages=external` 一个命令就出单文件，零 alias 配置。

**Q: 为什么用被 deprecated 的低层 `Server` API？**

A: 高层 `McpServer.registerTool` 用 zod 做 schema，方便但把协议细节藏起来了。低层 `Server` + `setRequestHandler` + `ListToolsRequestSchema` 直接暴露 JSON-RPC 层，我能讲清楚每一步。这跟 ADR-001「不用 Vercel AI SDK 手写 SSE」是同一套叙事——这个项目要的是「能讲清楚的实现」。

**Q: MCP server 的判题能力为什么不做？**

A: 服务端判题两条路都劝退：`vm2` 官方已弃更（声明"不再是安全边界"）、`isolated-vm` 是 native addon 有编译坑。判题继续留在网站沙箱（Web Worker + closure shadow + nonce），MCP 这层只做「题目 + 知识」的只读查询，零安全风险。

## 相关文件

- [`packages/fedrill-mcp/src/index.ts`](../../packages/fedrill-mcp/src/index.ts) —— server 源码
- [`packages/fedrill-mcp/scripts/smoke.mjs`](../../packages/fedrill-mcp/scripts/smoke.mjs) —— 原始 JSON-RPC 握手验证
- [`packages/fedrill-mcp/README.md`](../../packages/fedrill-mcp/README.md) —— 三端挂载配置
- [`.cursor/mcp.json`](../../.cursor/mcp.json) —— Cursor 项目级挂载
- [`docs/decisions/005-mcp-server.md`](../decisions/005-mcp-server.md) —— ADR 四连决策 + 结果回顾
