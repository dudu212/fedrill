# @fedrill/mcp

FEDrill 手撕题库的 MCP Server —— 让 Claude Desktop / Codex CLI / Cursor 等 MCP 客户端直接挂载题库，AI 教练可以在这里查题、取题面、讲概念。

设计决策见 [`docs/decisions/005-mcp-server.md`](../../docs/decisions/005-mcp-server.md)（ADR-005）。

## 三个只读 tool

判题（跑代码）继续留在 [fedrill.vercel.app](https://fedrill.vercel.app) 网站沙箱；本 server 只提供「题目 + 知识」，零安全风险。

| tool | 参数 | 返回 |
| --- | --- | --- |
| `list_problems` | `category?`（async / prototype / util / pattern，也支持中文标签） | 题库列表：id / 标题 / 分类 / 难度 / 标签 / 约定函数名（requiredAPI） |
| `get_problem` | `id` | 完整题面：描述 + 约定 API + starterCode + edgeCases（场景 + 提示）。不含判题数据 |
| `explain_concept` | `topic` | 相关题目的知识点（边界陷阱 + 提示），如「深拷贝」「Promise」「this 绑定」 |

## 构建

在仓库根目录：

```bash
pnpm --filter @fedrill/mcp build
```

产出单个 `dist/index.js`（esbuild bundle：题库已 inline，`@modelcontextprotocol/sdk` 留作运行时依赖）。

## 本地验证

```bash
cd packages/fedrill-mcp
node scripts/smoke.mjs
```

用原始 JSON-RPC 走一遍 stdio 握手（initialize → tools/list → 三个 tool 各调一次），无 MCP SDK client 依赖。

## 挂载配置

把下面的绝对路径换成你本机的仓库路径（本项目是 `E:\fedrill`）。

### Claude Desktop

编辑 `%APPDATA%\Claude\claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "fedrill": {
      "command": "node",
      "args": ["E:\\fedrill\\packages\\fedrill-mcp\\dist\\index.js"]
    }
  }
}
```

### Codex CLI

编辑 `~/.codex/config.toml`：

```toml
[mcp_servers.fedrill]
command = "node"
args = ["E:\\fedrill\\packages\\fedrill-mcp\\dist\\index.js"]
```

### Cursor

编辑项目根 `.cursor/mcp.json`（格式同 Claude Desktop）：

```json
{
  "mcpServers": {
    "fedrill": {
      "command": "node",
      "args": ["E:\\fedrill\\packages\\fedrill-mcp\\dist\\index.js"]
    }
  }
}
```

## 为什么这样设计

- **stdio 起手**：Claude Desktop / Codex / Cursor 首选且默认，零网络依赖、零运维；HTTP 是后续增量（不是互斥）。
- **不做判题**：`vm2` 已弃更、`isolated-vm` 有 native 编译坑，判题继续留在网站沙箱（Web Worker + closure shadow + nonce）。
- **monorepo 子包**：直接复用根目录 `data/problems` 作为单一事实源，题库更新零同步成本。
- **v1 不发 npm**：tool 设计还会变，稳定后再一次性发布。

完整权衡见 [ADR-005](../../docs/decisions/005-mcp-server.md)。
