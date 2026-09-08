# 005 · MCP Server 设计选择

- 状态:Accepted
- 日期:2026-09-07
- 关联模块:L6 · MCP

## 背景

M5 计划把 FEDrill 的能力暴露成 [MCP(Model Context Protocol)](https://modelcontextprotocol.io) Server,让 Claude Desktop / OpenAI Codex CLI / Cursor / Zed / VSCode 等 MCP 兼容客户端都能挂载。

需要一次性决定 4 件事,避免后续返工:

1. **Transport** — stdio 还是 HTTP
2. **Tool 范围** — 是否在服务端做判题
3. **打包位置** — monorepo 子包还是独立 repo
4. **发布策略** — 立即发 npm 还是延后

## 候选与决策

### 决策 1 · Transport 起手 stdio

| 方案 | 优点 | 缺点 |
| --- | --- | --- |
| **stdio** | Claude Desktop / Codex / Cursor **首选也是默认** · 零网络依赖 · 本地拉起子进程 · 不需要部署 | 只能本地跑 · 不能给 Web 客户端调 |
| HTTP / SSE | 可远程访问 · Web 客户端能用 · 可部署 Vercel Edge | 需要认证 / 限流 / CORS 处理 · 起手复杂度高 |

**选 stdio**。理由:
- **主流客户端全支持** — 落地面最广
- **零运维成本** — `npx @fedrill/mcp` 拉起就用,不需要挂云
- **HTTP 后续可加** — 同一 server 加个 HTTP transport wrapper 就行,是**增量**决策不是**互斥**决策

### 决策 2 · v1 不做判题(read-only 三 tool)

服务端跑判题的两条路都劝退:

| 方案 | 优点 | 缺点 |
| --- | --- | --- |
| `vm2` 沙箱 | 老牌 · npm 装即用 | **官方已弃更**(2023 声明"不再是安全边界") · 多个 sandbox escape CVE |
| `isolated-vm` | V8 隔离 · 真安全 | native addon 编译坑(Windows / M1 / Vercel Edge 都要单独适配) |
| **只做元 tool** | 零安全风险 · 快 · 责任边界清晰 | 判题环节要用户自己去 web UI 或让 client 侧的 AI 帮跑 |

**选只做元 tool**。理由:
- **一致于 [ADR-006](006-sandbox-vs-oj.md) 精神** — 不重造沙箱
- **责任边界清晰** — FEDrill MCP 负责"题目 + 知识",判题继续留在 `fedrill.vercel.app` 网站沙箱(Web Worker + closure shadow + nonce · [已论证](../learning/closure-shadow-and-nonce.md))
- **v1 三个 tool 就足够撑起使用场景**:
  - `list_problems({ category? })` · 列题库
  - `get_problem({ id })` · 拿题面 + starterCode + edgeCases + hint
  - `explain_concept({ topic })` · 讲手撕题相关概念(deep clone 陷阱 / Promise 内部实现 / this 绑定等)

### 决策 3 · Monorepo 子包 · `packages/fedrill-mcp/`

| 方案 | 优点 | 缺点 |
| --- | --- | --- |
| **monorepo 子包** | **直接复用 `data/problems`** 零改动 · 版本与主项目同步 · 一个 repo 面试易讲 | pnpm workspace 稍复杂 |
| 独立 repo | 边界干净 · 独立发布节奏 | **题库需要复制或发 npm 依赖** · 更新不同步 · 两个 repo 的维护成本 |

**选 monorepo 子包**。理由:
- 题库(`data/problems/*.ts`)是 MCP 的核心数据源 · **跨 repo 同步会退化成"复制粘贴"** · 违反 SSOT
- pnpm workspace 是标配 · 加一行 `packages/*` 即可
- 面试叙事:"我用 monorepo 是因为主站和 MCP 共享题库这个单一事实源"

### 决策 4 · v1 不发 npm · 本地 dev 起手

| 方案 | 优点 | 缺点 |
| --- | --- | --- |
| **不发 · 直接跑本地路径** | 快 · 迭代无阻力 · 挂载配置写绝对路径就能用 | 只有作者自己方便挂 |
| 立即发 npm | 任何人 `npx @fedrill/mcp` 即用 · 简历上写"发布到 npm" | 发布前每次改都要 bump 版本 · 早期反复迭代太重 |

**选不发**。理由:
- v1 阶段 tool 设计还会变 · 发出去反而是包袱
- **README 里给绝对路径挂载示例**,验证能力充分
- 稳定后(v0.2+)再一次性发 npm · 作为 M5 里程碑收尾动作

## 关键实现设计

### Server 骨架(pseudo)

```ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { problems, getProblem } from '@fedrill/data'

const server = new Server(
  { name: 'fedrill-mcp', version: '0.1.0' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: 'list_problems', description: '列出 FEDrill 手撕题库', inputSchema: {...} },
    { name: 'get_problem', description: '按 id 取题面 + starterCode + edgeCases', inputSchema: {...} },
    { name: 'explain_concept', description: '讲解手撕题相关概念', inputSchema: {...} },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  // dispatch to per-tool handler
})

await server.connect(new StdioServerTransport())
```

### 题库导入路径 · workspace 内部引用

`packages/fedrill-mcp/package.json` 声明:
```json
{ "dependencies": { "@fedrill/data": "workspace:*" } }
```

主项目根加一个虚拟包 `packages/data/`(或直接 re-export `data/problems/`)· 让 MCP 通过 `import { problems } from '@fedrill/data'` 拿题库,**不走 `@/data` 别名**(那个是 Next 专用)。

**注**:实际实现里也可以更简单 —— 直接 `import from '../../data/problems'` 相对路径 · v1 不做 workspace package 抽象。以简单为先。

### 挂载配置(README 会给)

**Claude Desktop** · `claude_desktop_config.json`
```json
{ "mcpServers": { "fedrill": { "command": "node", "args": ["/abs/path/fedrill/packages/fedrill-mcp/dist/index.js"] } } }
```

**Codex CLI** · `~/.codex/config.toml`
```toml
[mcp_servers.fedrill]
command = "node"
args = ["/abs/path/fedrill/packages/fedrill-mcp/dist/index.js"]
```

**Cursor** · `.cursor/mcp.json`(同 Claude Desktop 格式)

## 结果与回顾

**v1 已落地并端到端验证**（2026-09-08）：

- 实现：`packages/fedrill-mcp/`（monorepo 子包）+ esbuild bundle 单文件 `dist/index.js` + 3 个只读 tool（`list_problems` / `get_problem` / `explain_concept`）。
- 验证：本机只有 Cursor（无 Claude Desktop/Codex），改挂项目级 `.cursor/mcp.json`（同格式），`tools/list` 返回 3 tool、`tools/call list_problems` 端到端返回 5 道题。

**踩坑与偏离**：

1. **esbuild 零 alias 打包**：`data/problems/*.ts` 里的 `@/` 只出现在 `import type`（编译器擦除），所以 `esbuild --bundle --packages=external` 无需任何 alias 配置就把题库 inline 进单文件，SDK 留作运行时依赖。
2. **Cursor 3.x 白名单审批**：server 连接成功、工具注册成功，但每个 tool 默认**不在 allowlist**，`tools/call` 被 `needsApproval (not in allowlist)` 拦下（请求根本不发到 server）。需在 Cursor UI 批准/auto-approve。日志证据 `workbench.mcp.allowlist.log`。这是「挂载成功 ≠ 工具可用」的坑。
3. **node 路径**：本机 node 走 Volta（shim `C:\Program Files\Volta`，真实 `D:\Node\nodejs`），但两者都在系统 PATH，GUI 应用继承后 `command:"node"` 可直接解析，无需绝对路径。
