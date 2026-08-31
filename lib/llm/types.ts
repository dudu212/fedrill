/**
 * LLM Provider 抽象层。
 *
 * 目标：让上层（Agent Loop / tool 定义 / route handler）无需感知
 *      不同 LLM 提供商的消息结构差异。M2a 只落地 DeepSeek，M2b/M5
 *      可无痛切 Claude Haiku 4.5。
 *
 * 设计决策见 ADR-002（手写 Agent Loop vs SDK）+ ADR-004（拒绝 LangChain）。
 * 概念背景见 docs/learning/tool-use-and-react.md。
 */

/**
 * 会话内的一条消息，抽象过的形式。
 *
 * 和 lib/repo 的 SessionMessage 结构一致，但语义边界更严：
 * - 这里是"要发给 LLM 的消息"的中间表示
 * - SessionMessage 是"持久化到 storage 的消息"（额外带 timestamp 等元信息）
 *
 * 不同 provider 会把这个结构转成自己的 wire format：
 * - DeepSeek/OpenAI：role='tool' 的消息用 tool_call_id 引用
 * - Anthropic（未来）：role='user' 内嵌 content: [{type:'tool_result',...}]
 */
export interface ProviderMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  /** Assistant 消息可能带 tool_call（本轮 LLM 决定要调的工具） */
  toolCalls?: ProviderToolCall[]
  /** role='tool' 时必填：这条结果对应上文哪个 tool_call.id */
  toolCallId?: string
}

/**
 * 一次完整的 tool 调用请求（已从流式分片拼装完毕）。
 *
 * args 是解析完的对象——不是 JSON 字符串。DeepSeek 底层 arguments 是
 * 字符串这个历史包袱由 adapter 层吸收。
 */
export interface ProviderToolCall {
  id: string
  name: string
  args: unknown
}

/**
 * Tool 的对外描述，让 LLM 决定"什么时候调、传什么参数"。
 *
 * `parameters` 是标准 JSON Schema。写法：
 *   { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] }
 *
 * description 是 tool 命中率的关键——必须写清"什么时候用 + 返回什么"，
 * 不写实现细节。详见 docs/learning/tool-use-and-react.md §四。
 */
export interface ProviderToolSpec {
  name: string
  description: string
  parameters: Record<string, unknown>
}

/**
 * 流式响应的一个片段。上层 for-await 消费。
 *
 * 三种类型的语义：
 * - text_delta：LLM 正在说话，追加到当前 assistant 消息的 content
 * - tool_call：LLM 决定调一个工具（**完整版**，adapter 已经拼装好分片）
 * - done：这一轮 LLM 说完了（finish_reason 可能是 'stop' / 'tool_calls' / 'length'）
 */
export type ProviderChunk =
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_call'; call: ProviderToolCall }
  | { type: 'done'; finishReason: string | null }

/**
 * 一次流式调用的输入。
 */
export interface StreamOptions {
  messages: ProviderMessage[]
  /** 传 tools 时 LLM 才可能返回 tool_call chunk；不传就是纯聊天 */
  tools?: ProviderToolSpec[]
  temperature?: number
  /** 覆盖默认模型（如 'deepseek-chat' / 'deepseek-reasoner'） */
  model?: string
  /** 端到端可断（透传给 fetch，直达上游 LLM 请求） */
  signal?: AbortSignal
}

/**
 * Provider 的抽象契约。
 *
 * M2a 只有 `deepseekStream`，M2b 会加 `anthropicStream`。
 * 上层 Agent Loop 只依赖这个 shape，不 import 具体实现。
 */
export type ProviderStream = (opts: StreamOptions) => AsyncGenerator<ProviderChunk>
