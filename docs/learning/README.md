# Learning · 学习笔记索引

每学一个概念开一节，格式：**要点 + 我在 FEDrill 哪里用了 + 参考链接**。这是复习和面试话术的双料底稿。

## 待写清单

按 [学习规划.md](../学习规划.md) 的模块拆：

### L1 · Harness
- [x] [`sse-under-the-hood.md`](sse-under-the-hood.md) —— SSE 协议、`data:` 帧、`[DONE]`、ReadableStream 消费
- [x] [`prompt-context-pitfalls.md`](prompt-context-pitfalls.md) —— 上下文注入两次翻车（幻觉篇 + 陈旧篇）与修法
- [ ] `token-and-context.md` —— context window、prompt/completion tokens、压缩策略
- [ ] `ai-sdk-anatomy.md` —— Read `node_modules/ai/dist/` 后的笔记

### L2 · Agent Loop
- [x] [`tool-use-and-react.md`](tool-use-and-react.md) —— tool_use 协议 + ReAct 模式速通（Phase 0 起步先看）
- [ ] `react-pattern.md` —— ReAct 论文精读笔记
- [ ] `building-effective-agents.md` —— Anthropic 官方博客精读
- [ ] `tool-design-principles.md` —— 幂等 / 错误 shape / schema 松紧
- [ ] `event-loop-engineering.md` —— 两层含义 + Claude Code 的调度范例

### L3 · Skills
- [ ] `skills-vs-tools.md` —— Skill / Slash / Subagent / MCP Tool 四者辨析

### L4 · RAG
- [ ] `rag-cheatsheet.md` —— chunking → embed → retrieve → rerank → eval 一图流
- [ ] `hybrid-retrieval.md` —— 向量 + BM25 + rerank
- [ ] `rag-eval-with-ragas.md`

### L5 · Memory
- [ ] `memory-layers.md` —— Working / Episodic / Semantic
- [ ] `memgpt-notes.md` —— 论文精读

### L6 · MCP
- [ ] `mcp-primitives.md` —— Tools / Resources / Prompts 边界
- [ ] `mcp-transport.md` —— stdio vs SSE vs HTTP

### 横切 · Testing & Quality
- [x] [`ai-testing-interview.md`](ai-testing-interview.md) —— AI 项目测试面试题 22 问（Vitest / Playwright / promptfoo / 沙盒 / Agent eval / 成本观测）
- [x] [`sandbox-e2e-harness.md`](sandbox-e2e-harness.md) —— happy-dom 无 Worker 翻车 → Playwright + harness 页面迁移;含 test harness / page.evaluate / structured clone / Next 私有目录等 6 个知识点
