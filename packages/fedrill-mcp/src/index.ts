/**
 * FEDrill 手撕题库 MCP Server（stdio transport）
 *
 * 让 Claude Desktop / Codex CLI / Cursor 等 MCP 客户端挂载 FEDrill 题库。
 * v1 只做三个只读 tool（判题继续留在 fedrill.vercel.app 网站沙箱）：
 *   - list_problems   列题库（可按分类筛选）
 *   - get_problem     取题面 + starterCode + edgeCases（不含判题数据）
 *   - explain_concept 讲手撕题相关概念（复用题库的 edgeCases/hint 作为知识点）
 *
 * 设计决策见 docs/decisions/005-mcp-server.md。
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

import {
  categoryLabels,
  getProblem,
  problems,
  problemsByCategory,
} from '../../../data/problems'

type Problem = (typeof problems)[number]

const CATEGORIES = ['async', 'prototype', 'util', 'pattern'] as const

/** 统一包装成 MCP 的 text 结果，isError 标记失败 */
function textResult(text: string, isError = false) {
  return { content: [{ type: 'text', text }], isError }
}

/** 分类参数同时兼容英文键（async/...）与中文标签（异步控制/...） */
function normalizeCategory(input: string): string | undefined {
  const key = input.trim().toLowerCase()
  if ((CATEGORIES as readonly string[]).includes(key)) return key
  const hit = Object.entries(categoryLabels).find(([, label]) => label === input.trim())
  return hit?.[0]
}

function summarizeProblem(p: Problem) {
  return {
    id: p.id,
    title: p.title,
    category: p.category,
    categoryLabel: categoryLabels[p.category] ?? p.category,
    difficulty: p.difficulty,
    tags: p.tags,
    requiredAPI: p.requiredAPI,
  }
}

// ---- 三个 tool 的处理逻辑（纯函数，方便以后抽出去单测）----

function handleListProblems(category?: string) {
  if (category) {
    const key = normalizeCategory(category)
    if (!key) {
      return textResult(
        `未知分类「${category}」。可选：${CATEGORIES.map((c) => `${c}（${categoryLabels[c]}）`).join(' / ')}`,
        true,
      )
    }
    return textResult(JSON.stringify((problemsByCategory[key] ?? []).map(summarizeProblem), null, 2))
  }
  return textResult(JSON.stringify(problems.map(summarizeProblem), null, 2))
}

function handleGetProblem(id: string) {
  const p = getProblem(id)
  if (!p) {
    return textResult(`找不到题目「${id}」。可用 id：${problems.map((x) => x.id).join(' / ')}`, true)
  }
  // 剥掉 testCases（判题数据），只给「题面 + starterCode + edgeCases + hint」
  const { testCases: _testCases, ...publicView } = p
  return textResult(JSON.stringify(publicView, null, 2))
}

function handleExplainConcept(topic: string) {
  const t = topic.trim().toLowerCase()
  if (!t) {
    return textResult('需要 topic 参数。可试：深拷贝 / Promise / this 绑定 / 发布订阅 / 数组扁平化', true)
  }

  const scored = problems
    .map((p) => {
      const haystack = [
        p.title,
        p.requiredAPI,
        p.description,
        ...p.tags,
        ...(p.edgeCases ?? []).flatMap((e) => [e.scenario, e.hint]),
      ]
        .join(' ')
        .toLowerCase()
      let score = 0
      if (haystack.includes(t)) score += 3
      for (const tag of p.tags) {
        const tl = tag.toLowerCase()
        if (tl.includes(t) || t.includes(tl)) score += 1
      }
      return { p, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)

  if (scored.length === 0) {
    return textResult(
      `没找到与「${topic}」相关的概念。可试：深拷贝 / Promise / this 绑定 / 发布订阅 / 数组扁平化`,
      true,
    )
  }

  const body = scored
    .map(({ p }) => {
      const lines = [`## ${p.title}（\`${p.requiredAPI}\`）`]
      if (p.edgeCases?.length) {
        lines.push('相关知识点 / 边界陷阱：')
        for (const ec of p.edgeCases) lines.push(`- ${ec.scenario}\n  → 提示：${ec.hint}`)
      }
      return lines.join('\n')
    })
    .join('\n\n')

  return textResult(body)
}

// ---- Server 装配 ----

const server = new Server(
  { name: 'fedrill-mcp', version: '0.1.0' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'list_problems',
      description:
        '列出 FEDrill 手撕题库的全部题目，可按分类筛选。返回每题的 id / 标题 / 分类 / 难度 / 标签 / 约定函数名（requiredAPI）。',
      inputSchema: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: [...CATEGORIES],
            description:
              '可选。分类键：async=异步控制，prototype=原型链，util=工具函数，pattern=设计模式。不传则返回全部。',
          },
        },
      },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    {
      name: 'get_problem',
      description:
        '按 id 取一道手撕题的完整题面：题目描述、约定 API、起始代码（starterCode）、边界追问（edgeCases 场景 + 提示）。不含判题数据（判题在网站沙箱）。',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: '题目 id，例如 deep-clone / flat / promise-all / my-call / event-emitter。',
          },
        },
        required: ['id'],
      },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    {
      name: 'explain_concept',
      description:
        '讲解手撕题相关概念（如深拷贝陷阱、Promise 内部实现、this 绑定、发布订阅、数组扁平化）。返回相关题目的知识点（边界场景 + 提示）。',
      inputSchema: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: '要讲解的概念主题，例如「深拷贝」「Promise」「this 绑定」。',
          },
        },
        required: ['topic'],
      },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name
  const args = request.params.arguments ?? {}

  switch (name) {
    case 'list_problems':
      return handleListProblems(typeof args.category === 'string' ? args.category : undefined)
    case 'get_problem':
      return handleGetProblem(typeof args.id === 'string' ? args.id : '')
    case 'explain_concept':
      return handleExplainConcept(typeof args.topic === 'string' ? args.topic : '')
    default:
      return textResult(`未知 tool：${name}`, true)
  }
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  // stdout 是 MCP 协议通道，日志必须走 stderr
  console.error(`[fedrill-mcp] stdio server 已启动 · ${problems.length} 道题可用`)
}

main().catch((err) => {
  console.error('[fedrill-mcp] 启动失败：', err)
  process.exit(1)
})
