@AGENTS.md

# CLAUDE.md

本文档为后续 Claude Code (claude.ai/code) 会话在本仓库工作时提供指引。

## 项目定位

FEDrill —— 面向前端秋招的 AI 教练平台（手撕题 / 算法 / 八股）。**同时也是作者的学习项目**：许多技术决策刻意拒绝"一把梭"抽象（Vercel AI SDK、LangChain 等），转而手写可以在面试里讲清楚的实现。接到新需求时请保留这个意图，不要顺手把已经被明确移除的抽象加回来（参见 `docs/decisions/001-choose-ai-sdk.md`）。

里程碑见 `README.md`：M1 骨架 → M2 完整 Agent Loop → M3 算法可视化 → M4 Supabase + SRS → M5 MCP + 上线。**当前处于 M1**。

## 常用命令

所有工具必须在 fedrill/ 里跑。这个陷阱以后每次 pnpm add 都要小心。

```powershell
pnpm install
Copy-Item .env.local.example .env.local   # 然后填入 DEEPSEEK_API_KEY
pnpm dev        # next dev，默认 :3000
pnpm build
pnpm start
pnpm lint       # eslint.config.mjs（flat config），继承 next/core-web-vitals + next/typescript
```

**测试脚手架尚未接入**（`docs/技术方案.md §3.2` 规划了 vitest，但尚未安装依赖）。不要凭空编造 `pnpm test`。

包管理器锁定为 **pnpm 11.17.0**（`package.json` 的 `packageManager` 字段）。`.npmrc` 使用腾讯镜像 —— 除非用户明确要求，别改。`pnpm-workspace.yaml` 关闭了 `sharp` 和 `unrs-resolver` 的 postinstall 构建。

## 架构

按目录边界划分为三层：

- **`app/`** —— Next.js App Router，仅承载 UI。使用 `LayoutProps<"/">`（Next 16 的类型化 layout，与你训练数据里的写法不同）。路径别名 `@/*` 指向仓库根。
- **`lib/`** —— 业务逻辑，**不能引入 React**。目标是可独立单元测试。按关注点分子目录（`sandbox/`，规划中的 `agent/`、`repo/`、`llm/`、`problems/`）。
- **`lib/repo/`**（规划中）—— Repository Pattern 数据层。M1–M3 使用 `localStorage`，M4 换成 Supabase，接口保持不变。不要把存储调用直接内联到组件里。

### 流式对话（`app/api/chat/route.ts` + `app/chat-demo/page.tsx`）

**手写 SSE 代理到 DeepSeek，不要替换成 Vercel AI SDK**，除非先看过 ADR-001。服务端解析上游 DeepSeek 的 `data:` 帧后，向客户端流回**纯文本 chunk**（不是 SSE）。客户端用 `reader.read() + TextDecoder` 拼接。`AbortController` 端到端贯穿（`request.signal` 透传到上游 fetch）。

契约：`POST /api/chat`，body `{ messages: {role, content}[], model?, temperature? }` → `text/plain` 流。

### 沙箱（`lib/sandbox/`）

- `runner.ts`（主线程）每次运行新建一个 `Worker`，`postMessage` 发送 `{code, entryName, cases}`，通过 `worker.terminate()` 强制 3s 超时。
- `worker.ts` 用 `new Function(...)` 编译用户代码，按**函数名**（`entryName`，对应题目的 `requiredAPI` 字段）取出被测函数。**每道题必须把这个函数名告诉用户**。
- 深比较用 `JSON.stringify(a) === JSON.stringify(b)`，已知有信息损失（M2 会换成 `fast-deep-equal`）。在完成替换前，不要引入依赖严格深比较语义的功能。
- Worker 通过 `new URL('./worker.ts', import.meta.url)` 加载 —— 依赖 Next/Turbopack 的 worker 打包能力。如果修改加载方式，请验证 `pnpm build` 仍能正确生成 chunk。

### 领域类型（`lib/types/problem.ts`）

`ImplProblem`、`ChatMessage`、`Session`、`Round`、`TestCase`（从 `lib/sandbox/types.ts` re-export）的单一事实来源。新增题型时请扩展这里的 `BaseProblem`，不要在别处另起一套平行类型。

## 约定

- **引入非平凡依赖或做栈级选型时，请在 `docs/decisions/` 补一份 ADR**（模板见 `docs/decisions/README.md`）。这些"面子级"决策的意义就是能在面试里讲清楚，跳过 ADR 就丢掉了这层价值。
- 当架构真的变了，同步更新 `docs/技术方案.md`。这里是蓝图，过时的段落比缺失更糟。
- 文档、代码注释、UI 文案默认使用中文（简体）；引用技术名词（Next.js、Server Actions、SSE 等）保持英文原词，不做生硬翻译。已有代码里的英文标识符不必强制翻译。
- App Router 默认使用 Server Component；只有确实需要交互的文件才加 `'use client'`（目前 `app/chat-demo/page.tsx` 和 `app/practice/page.tsx` 是仅有的 client component）。
- 所有git提交中都不要加Co-Authored-By: Claude

## 学习项目心态

每个动作进行前要先解释该动作是什么作用，有什么价值，在链路中处于什么位置，为之后的什么动作做铺垫，会造成什么样的影响，让用户深度理解每个步骤以及整个项目。每轮对话时先告诉用户现在处于项目进程中的哪一步。
`docs/learning/` 和 `docs/decisions/` 用来沉淀"为什么这么做"。如果一个任务教会了值得记住的知识（SSE 机制、Agent Loop 内部、RAG 评测等），在对应子目录里写一段短笔记，比造一个把机制藏起来的漂亮抽象更有价值。拿不准时，倾向于选**朴素、可读**的实现。
