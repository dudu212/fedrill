# Decisions · 技术选型日志（ADR）

每份决策一个文件，命名 `NNN-topic.md`。目的：把"当时为什么选 A 不选 B"沉淀下来，面试时可以直接讲。

## 模板

```markdown
# NNN · 决策标题

- 状态：Draft / Accepted / Superseded
- 日期：YYYY-MM-DD
- 关联模块：L1 / L2 / ...

## 背景
（要解决什么问题）

## 候选方案
| 方案 | 优点 | 缺点 |
| --- | --- | --- |

## 决定
（选了什么、为什么）

## 结果与回顾
（用一段时间后更新：预期是否达成，踩了什么坑）
```

## 待写清单

- [x] `001-choose-ai-sdk.md` —— L1，Vercel AI SDK vs 手写 fetch vs LangChain（Accepted）
- [ ] `002-hand-rolled-vs-sdk-agent.md` —— L2，手写 Agent Loop vs 用 SDK 抽象（M2 前必写）
- [ ] `003-localstorage-until-m4.md` —— L1，M1–M3 用 localStorage，M4 才引数据库
- [ ] `004-agent-loop-vs-langchain.md` —— L2，Agent Loop 自研而非 LangChain（M2 前必写）
- [ ] `005-mcp-server.md` —— L6，MCP transport / primitives 选择
- [x] `006-sandbox-vs-oj.md` —— L1，自研 minimal 判题器 vs 引入开源 OJ（Accepted）
- [ ] `007-vector-db-selection.md` —— L4，sqlite-vec / pgvector / Pinecone 对比
- [ ] `008-memory-architecture.md` —— L5，三层 memory 架构
- [x] `009-ai-test-autonomy-tiers.md` —— 横切 · Testing，AI 参与测试与修复的风险分级（Tier 1/2/3）（Accepted）
- [x] `010-playwright-e2e.md` —— 横切 · Testing，Playwright E2E 与 chromium-only 起步（Accepted）
