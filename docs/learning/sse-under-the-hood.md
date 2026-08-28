# SSE 底层 · Server-Sent Events 从帧到 React state

> 关联：L1 · LLM Harness 基础
> 用于：[app/api/chat/route.ts](../../app/api/chat/route.ts) · [app/chat-demo/page.tsx](../../app/chat-demo/page.tsx)

## 一、SSE 帧格式（最小知识）

SSE = 单向服务器推送文本流的 HTTP 协议。Content-Type `text/event-stream`。规范见 [WHATWG](https://html.spec.whatwg.org/multipage/server-sent-events.html)。

一个"事件"由若干**字段行**组成，**两个换行 `\n\n` 表示事件结束**：

```
data: {"hello": "world"}

data: line 1
data: line 2
event: custom
id: 42

```

关键字段：

| 字段 | 作用 |
| --- | --- |
| `data:` | 载荷。同事件多个 `data:` 会拼接成多行字符串 |
| `event:` | 事件类型（客户端可分类监听） |
| `id:` | 断线重连用的 last-event-id |
| `retry:` | 重连间隔毫秒 |
| `:` 开头 | 注释 / keepalive，忽略即可 |

**OpenAI/DeepSeek 兼容的流**只用一种事件：连续的 `data: {json}\n\n`，末尾发一个 `data: [DONE]\n\n` 表示结束。

## 二、DeepSeek 一个 chunk 长什么样

```
data: {"id":"...","choices":[{"delta":{"content":"你"},"index":0,"finish_reason":null}]}

data: {"id":"...","choices":[{"delta":{"content":"好"},"index":0,"finish_reason":null}]}

data: {"id":"...","choices":[{"delta":{},"index":0,"finish_reason":"stop"}]}

data: [DONE]

```

我们**只关心** `choices[0].delta.content`。第一帧通常带 `role: "assistant"` 但无 content，忽略；末帧 `finish_reason: "stop"` 也没 content，自然会被跳过。

## 三、服务端解析（[route.ts](../../app/api/chat/route.ts) 的核心 20 行）

```ts
const reader = upstream.body!.getReader()
let buffer = ''
while (true) {
  const { value, done } = await reader.read()
  if (done) break
  buffer += decoder.decode(value, { stream: true })    // 增量解码，避免多字节字符被截断
  const events = buffer.split('\n\n')                  // 用双换行切事件
  buffer = events.pop() ?? ''                          // 最后一段可能不完整，留在 buffer
  for (const event of events) {
    for (const line of event.split('\n')) {
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (payload === '[DONE]') { controller.close(); return }
      const chunk = JSON.parse(payload).choices?.[0]?.delta?.content
      if (chunk) controller.enqueue(encoder.encode(chunk))
    }
  }
}
```

### 为什么必须 `{ stream: true }`

`TextDecoder.decode(bytes, { stream: true })` 会**缓存不完整的多字节字符**。中文 UTF-8 是 3 字节，一个中文字被 TCP 拆到两次 chunk 是常事。少了这个 flag，中间就会出现 `�`（乱码替换字符）。

### 为什么 `buffer.split('\n\n')` 后要 `pop()`

TCP 边界不等于 SSE 事件边界。一次 `reader.read()` 可能只拿到半个事件（`data: {"choi` 就切了）。`split` 后最后一段可能不完整，塞回 `buffer` 等下一次拼接。

### 我们为什么不把 SSE 直接透传给客户端

选择在**服务端剥壳成纯文本**，客户端不需要理解 SSE 协议——只用 `getReader() + decode()` 拼字符串就行。代价：客户端拿不到 finish_reason / usage 等元信息。M2 加 tool calling 时再改协议（可能引入自定义 `event:` 字段）。

## 四、客户端消费（[chat-demo/page.tsx](../../app/chat-demo/page.tsx) 的核心 10 行）

```ts
const reader = res.body.getReader()
const decoder = new TextDecoder()
let acc = ''
while (true) {
  const { value, done } = await reader.read()
  if (done) break
  acc += decoder.decode(value, { stream: true })
  setMessages((prev) => {
    const copy = prev.slice()
    copy[copy.length - 1] = { role: 'assistant', content: acc }
    return copy
  })
}
```

看起来平平，但有两个坑：

**1. 为什么不用 `EventSource` API？**
浏览器内置的 `EventSource` 只支持 GET，且**不可自定义 header**。我们要 POST + JSON body，只能用 fetch + ReadableStream。这是 ChatGPT/Vercel AI SDK 都走的路。

**2. 为什么每次都 `slice()` 而不是 mutate？**
React 靠引用变化判断是否重渲染。`prev[last].content = acc; return prev` 引用没变，React 不 rerender。必须新引用。

## 五、AbortController 传递链

```
用户点"中断"
  ↓ abortRef.current.abort()
fetch({ signal }) 抛 AbortError
  ↓
route.ts 里的 fetch({ signal: request.signal }) 也抛 AbortError（Next 会把客户端断连传播到 request.signal）
  ↓
上游 DeepSeek 连接被关闭
  ↓
DeepSeek 停止计费（省钱关键）
```

**测试方法**：Chrome DevTools · Network · 观察 `/api/chat` 请求状态；再观察 DeepSeek 后台请求日志。两边都应该在点击"中断"后立即结束。

## 六、和 Vercel AI SDK 的对照

SDK 里 `streamText` 做的事，本质就是上面这两段代码，加上：

- Provider adapter（不同厂商 SSE 格式微差 —— Anthropic 是 `event: content_block_delta\ndata: {...}`，不是 OpenAI 兼容的裸 `data:`）
- Message 结构化（区分 text / tool_use / tool_result）
- DataStream 协议（自定义 SSE event 类型，前端 `useChat` 消费）
- `onFinish` / `onError` / `usage` hooks

**升级到 SDK 的信号**：M2 加 tool calling 时。手写协议维护成本会跳升。

## 七、面试话术钩子

- "为什么不用 EventSource？"—— POST + header 限制
- "TCP chunk 边界不等于 SSE 事件边界怎么办？"—— buffer + split + pop
- "中文乱码问题怎么处理？"—— `TextDecoder({ stream: true })` 缓存半字符
- "客户端主动断开会不会浪费上游 tokens？"—— AbortController 传递链，观察 DeepSeek 计费
- "SDK 的 useChat 底层是什么？"—— 本质就是 fetch + ReadableStream + 状态管理，SDK 加了 Message 结构化和 provider adapter