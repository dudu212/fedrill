# 011 · Agent Loop 在客户端跑，服务端只做 LLM 代理

- 状态：Accepted
- 日期：2026-08-29
- 关联模块：L2 · Agent Loop
- 前置：[ADR-001](001-choose-ai-sdk.md) · [ADR-002](002-hand-rolled-vs-sdk-agent.md) · [ADR-006](006-sandbox-vs-oj.md)

## 背景

M2a Phase 1a 要落地 Agent Loop v1 + `run_tests` tool。tool 的底层是 [Web Worker 沙箱](../../lib/sandbox/worker.ts)（M1 已跑通），**只能在浏览器里跑**。

关键设计问题：**ReAct 循环的主体放哪？** 服务端（Next.js route handler）？客户端（React）？还是拆开？

## 候选方案

| 方案 | Loop 位置 | Tool 位置 | 优点 | 缺点 |
|---|---|---|---|---|
| **A · 全服务端** | Server | Server（需要 Node 沙箱） | 集中调试；符合大多数 agent SaaS 架构 | 得引入 vm2（有已知 CVE）或 isolated-vm（装编译工具链）；违反 ADR-006 "不重造沙箱" 精神 |
| **B · 客户端跑 loop + 服务端 LLM 代理**（本 ADR 选） | Client | Client（Web Worker） | 复用 M1 沙箱；AbortController 端到端；服务端零状态最薄 | 客户端代码略复杂；每次 LLM 调用要完整传 messages |
| C · 混合 | Server | Client | 兼具双方 | 客户端-服务端每轮 tool 都往返一次；协议复杂；断链场景多 |

## 决定

**采用 B · 客户端 Agent Loop + 服务端 LLM 代理**。

## 理由（四条按权重）

### 1. 沙箱天生在客户端，搬服务端是重复劳动

M1 的 [Web Worker 沙箱](../../lib/sandbox/) 已经把 3s 超时 / `{__fn}/{__val}` 逃生舱 / 循环安全 `deepEqual` 全跑通。服务端要复现同等能力，得引入：

- **vm2** —— 已知 CVE，不建议新项目采用
- **isolated-vm** —— `npm install` 需要 python + node-gyp 编译，跨平台坑多
- **手写 vm** —— 又是一个 minimal 项目

花两天再造一份"和浏览器版本行为可能微妙不同"的沙箱？**不做**。ADR-006 的精神就是"不重造已有的 minimal 实现"，这条直接复用。

### 2. AbortController 端到端天然可断

用户点"中断"按钮 → `chatAbortRef.current?.abort()` →

- 立即中止 fetch 到 `/api/agent/step`（透传到 DeepSeek 上游）
- 立即 `worker.terminate()` 干掉正在跑的沙箱
- Agent Loop 的 `for await` 因为 signal 抛错自然退出

**这条链路全部在客户端**，一个 AbortController 管所有。服务端主导的话，"中断服务端 tool 执行"需要额外的 SSE 反向通道通知客户端，或者服务端定时轮询 client signal—— 复杂度爆炸。

### 3. 服务端可以做到最薄（契合 ADR-001 / ADR-002）

`/api/agent/step` 就是 [deepseekStream](../../lib/llm/deepseek.ts) 的 route 包装：

- 拿到客户端传来的 `{ messages, tools }`
- 调 `deepseekStream()`
- 逐 chunk 转 SSE 出流

**服务端不管 loop 状态、不管 tool 执行、不管 session** —— 是**无状态的纯 LLM 代理**。简单 = 好维护 = 好在面试里讲清 = 好水平扩展（后期真上线上部署时零 sticky session 需求）。

### 4. 面试可讲的架构叙事

面试官视角一句话总结：

> "Agent Loop 在客户端跑，服务端只做 LLM 代理，Tool 直接在浏览器执行。客户端一个 AbortController 就能干净断掉整条链路。服务端零状态、可无限水平扩。"

**三层都可深挖**：客户端 ReAct 循环 · 服务端 SSE 与 provider 抽象 · Web Worker 沙箱。三个话题的技术栈全在这条主线上，任一个都能撑起 15 分钟深挖对话。

## 具体架构

```
[客户端 · React state]                [服务端 · route]           [DeepSeek]
─────────────────────                 ─────────────────           ─────────

  Client Agent Loop                                                      
      │                                                                  
      │ POST /api/agent/step                                             
      │   body: { messages, tools }                                      
      │   signal: AbortController.signal                                 
      │────────────────────────────►                                    
                                     agent/step/route.ts (无状态)         
                                       - forward tools spec              
                                       - deepseekStream(...)             
                                            │                            
                                            │  fetch + stream:true       
                                            │  signal 透传               
                                            │─────────────────────────► 
                                            │                            
                                            │◄─── SSE frames ───         
                                            │                            
                                        yield ProviderChunk              
                                            │                            
                                        encode as SSE                    
      │◄─── SSE(text_delta/tool_call/done)                              
      │                                                                  
   for await chunk:                                                     
     · text_delta   → 追加 last assistant.content                       
     · tool_call    → runInSandbox() [Web Worker · 沙箱]                
                    → 拿到 result                                        
                    → messages.push({role:'tool', tool_call_id, ...})   
                    → 回到 POST /api/agent/step 循环开头                
     · done + 无 pending tool_call → 跳出 loop                          
```

**关键**：客户端一趟 loop 可能会**多次**POST 到 `/api/agent/step`（每次 tool_call 之后要再问一次 LLM）。服务端每次都是**独立的 stateless 调用**。

## 什么情况下会推翻这个决策

- 引入需要访问服务端资源的 tool（数据库 / 外部 API / 需 secret 的 API）。M2a 只有 `run_tests`（纯计算），天然客户端友好；但 M4+ 的 `save_progress` 或 `fetch_similar_problems` 就得走服务端 → 那时可能引入 **hybrid 模式**（客户端 tool 就地执行、服务端 tool 走 route）
- Loop 复杂度超过阈值（譬如 10+ tool 交叉调用、状态机很深）→ 客户端可读性下降，服务端集中反而更清晰
- 需要多客户端共享 loop 状态（跨设备同步进度）→ 服务端主导更自然，但那也是 M4+ Supabase 阶段的事

## 代价与补偿

**代价**：

- 客户端 Agent Loop 大约 100–150 行，比"啥都不管的 UI"稍复杂
- 每次 LLM 调用完整传 messages 数组（但客户端本来就要管这个数组做 UI 渲染，不是新增负担）
- 客户端 crash / 刷新时 loop 中断（但 [SessionRepo](../../lib/repo/session-repo.ts) 已经存了 messages，用户重开能看到"上次到哪了"）

**补偿**：

- [Provider 层](../../lib/llm/types.ts) 已抽象，loop 只依赖 `deepseekStream` 契约，换 Claude Haiku 4.5 只改一行 import
- SessionRepo 天然持久化整个 messages 数组，断线重连即可
- AbortController 端到端断链本身就是简历亮点

## 面试问答备忘

**Q：服务端 Agent Loop 是主流吧？你为什么反其道行之？**
A：主流是因为大多数 tool（数据库查询 / API 调用 / vector search）天然在服务端。**FEDrill 的关键 tool 是"跑用户代码"，天然在浏览器**。硬把它拉到服务端要另起沙箱，违反 ADR-006 "不重造轮子" 精神。我根据实际 tool 位置反过来选客户端 loop，让服务端保持无状态最薄。

**Q：LLM API key 会不会在客户端泄漏？**
A：不会。客户端只调 `/api/agent/step`，从来不直接调 DeepSeek。Key 只在服务端 `process.env.DEEPSEEK_API_KEY`。

**Q：客户端 loop 状态断了怎么办？**
A：SessionRepo 每轮 debounce 300ms 存 messages 到 localStorage。刷新页面 hydrate 回来能接着上一轮看。M4 换 Supabase 后跨设备同步。

**Q：服务端如果不管 loop，单元测试怎么写？**
A：服务端只测 provider adapter（SSE 解析 + tool_call 分片拼装），未来加 `deepseek.test.ts`（M2b）。Loop 逻辑测在客户端，未来 `lib/agent/loop.test.ts` 用 mock provider 打桩。

**Q：Tool 结果怎么"回传给 LLM"？**
A：客户端拿到 `tool_call` chunk → 本地跑 → 结果 `JSON.stringify` 塞进一条 `{role:'tool', content, toolCallId}` 消息 → 下一次 POST 到 `/api/agent/step` 时一起发。LLM 看到 tool 消息就能推理接下来。

## 相关决策

- [ADR-001 · 手写 SSE vs Vercel AI SDK](001-choose-ai-sdk.md)（服务端极薄的前提）
- [ADR-002 · 手写 Agent Loop vs SDK 抽象](002-hand-rolled-vs-sdk-agent.md)（loop 自己写才能选择跑在哪）
- [ADR-006 · 自研 minimal 判题器 vs 开源 OJ](006-sandbox-vs-oj.md)（客户端沙箱前提）
- **ADR-012（待写）· messages 数组的压缩策略**（长对话时如何裁剪历史）

## 结果与回顾

**跑通后回填**：

- [ ] 客户端 Agent Loop 实际代码量（target: <200 行）
- [ ] 中断链路实测：点"中断" → DeepSeek 侧秒停 + Worker terminate
- [ ] 首次 SessionRepo 断线重连恢复的实测成功率
- [ ] 客户端 loop 崩过没（未捕获异常）
