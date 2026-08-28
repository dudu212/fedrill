# 001 · 选择 0 依赖手写 fetch 而非 Vercel AI SDK

- 状态：Accepted
- 日期：2026-08-18
- 关联模块：L1 · LLM Harness 基础

## 背景

M1 要落 F-004 · LLM 流式对话。前端 → Next.js Route Handler → DeepSeek → 流回前端。市面主流做法是 `pnpm add ai @ai-sdk/deepseek`，用 `streamText` + `useChat` 一把梭。

但学习规划 L1 明确把"自建 minimal harness"列为精通级交付物，且我希望能讲清楚 SSE 底层怎么走。所以要在"快速跑通"和"看清底层"之间选一次。

## 候选方案

| 方案 | 优点 | 缺点 |
| --- | --- | --- |
| A · Vercel AI SDK | `streamText` + `useChat` 五行搞定；provider 可切换；backpressure/error 处理已封装 | 抽象泄漏到客户端（DataStream 协议、Message 结构不透明）；调 tool calling 时得读 SDK 源码；引入 3 个包 |
| B · 0 依赖手写 fetch + Web Streams | 全链路 100 行内看得清；教育价值高；面试可讲 SSE / ReadableStream / AbortController；客户端只 20 行 | 需要自己处理 SSE 帧解析、`[DONE]` 终止、error mapping；后期加 tool calling 要自己实现协议 |
| C · 只服务端用 SDK，客户端裸 fetch | 折中；upstream 换 provider 便宜 | 反而两边都要懂，心智负担最大 |

## 决定

选 **B**。理由：

1. **学习优先**：L1 的核心目标是搞懂 harness 内部，用 SDK 就跳过了整个 SSE 层
2. **代码可读**：全链路（route.ts 78 行 + chat-demo/page.tsx 130 行）完全可控，任何 bug 都能读代码定位
3. **未来切换成本低**：只要 `/api/chat` 端点契约（POST messages → 流文本）不变，任何时候可以把 route.ts 换成 SDK 实现，客户端不动
4. **面试可讲的强度**：SSE 帧解析 + AbortController 传递链 + Web Streams 三点连讲 > "我用了 AI SDK"

## 具体实现

- `app/api/chat/route.ts` —— 服务端解析上游 SSE，只把 `delta.content` 作为纯文本 chunk 流出
- `app/chat-demo/page.tsx` —— 客户端 `reader.read() + TextDecoder` 拼接，`AbortController` 管理中断
- 契约：`POST /api/chat` body `{ messages: {role, content}[] }` → 流式 `text/plain`

## 结果与回顾

**跑通后回填**：

- [ ] 首 token 延迟实测
- [ ] 中断链是否真的传到 DeepSeek（观察 DeepSeek 后台是否立即停止计费）
- [ ] error path 覆盖度（API key 缺失 / 上游 500 / 客户端断连）

## 触发升级到 SDK 的条件

出现下列任一情况就重新评估：

- M2 tool calling 时手写 tool_use / tool_result 协议出现难查 bug（此时 SDK 更稳）
- 需要接 3+ 个 provider 且要动态切换
- 需要 `useChat` 提供的 `stop / reload / retry / edit` 等交互，自己实现成本高
