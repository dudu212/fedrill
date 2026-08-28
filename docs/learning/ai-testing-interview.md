# AI 项目测试 · 面试题 & 知识点

> 关联 [../AI测试工具调研.md](../AI测试工具调研.md) · 用于秋招面试话术准备
>
> 用法：每题分「问题 → 60 秒话术 → 深挖点 → 我在 FEDrill 哪里用了」。深挖点是面试官二问的方向，提前想好；FEDrill 引用是把回答落到项目上，比空谈框架加分。

---

## 一、单元测试 · Vitest / Jest 差异与 ESM

### Q1. 为什么 Next.js 16 项目选 Vitest 而不是 Jest？

**60 秒话术**：Jest 长期依赖 CommonJS，处理 ESM 要挂 `--experimental-vm-modules` 或过 babel-jest，慢且脆。Vitest 底层是 Vite 的 SSR，原生 ESM、原生 TS、和 Next.js 16 走的是同一套 Rollup/esbuild 管线，配置量比 Jest 少一半，watch 模式反馈 <100ms。

**深挖点**：
- Vitest 的 `pool` 选项（`threads` vs `forks`）区别 → forks 隔离更强，threads 共享内存快
- `vi.mock` 和 `jest.mock` 的 hoisting 语义差异 → Vitest 静态分析限制更严
- 覆盖率工具：Vitest 用 v8 或 istanbul，v8 快但行覆盖不如 istanbul 精确

**FEDrill 里**：SSE 解析器测试 200+ 用例，Vitest watch 模式改一行 <1s；Jest 版本时代同样规模要 4-5s。

---

### Q2. 什么样的函数值得写单测？什么不值得？

**60 秒话术**：**纯函数、状态机、协议解析器** 三类必写；只做 IO 转发的胶水层不写。判断标准：若函数有分支且分支难在集成测试里触发，就要单测。UI 组件里只测「用户看得见的行为」，不测 useState 内部值。

**深挖点**：测试金字塔倒立问题（unit 少 e2e 多）→ CI 慢、失败定位难；「测实现细节」的味道 → 改重构改红。

**FEDrill 里**：`lib/harness/sse-parser.ts` 状态机分支密，写；`app/api/chat/route.ts` 只做转发，靠集成测。

---

### Q3. React Testing Library 的核心哲学是什么？为什么不推荐用 `container.querySelector`？

**60 秒话术**：RTL 的核心是「像用户一样查询 DOM」。用户看到的是文本、label、role，不是 CSS 选择器；用 `querySelector` 写的测试和实现耦合，改样式会挂。查询优先级：`getByRole` > `getByLabelText` > `getByText` > `getByTestId`。

**深挖点**：
- `getBy*`、`queryBy*`、`findBy*` 三组差异（存在/不存在/异步）
- `userEvent` vs `fireEvent`：前者模拟真实交互（含 focus/blur），后者只派发合成事件
- act() warning 出现的两种原因（未 flush 的更新 / 未 await 的异步）

---

## 二、集成测试 · MSW / Route Handler

### Q4. MSW 和传统 fetch mock 相比强在哪？

**60 秒话术**：MSW 拦在网络层（Service Worker 或 Node interceptor），代码里 `fetch()` 不用改。相比 `vi.mock('fetch')` 三点优势：一是同一份 handler 单测/E2E/Storybook 都能复用；二是能测中间件（比如 Route Handler 里对 upstream 的转发逻辑）；三是能模拟 SSE 流、慢速网络、错误状态。

**深挖点**：Service Worker 模式（浏览器）vs Node interceptor 模式（Node 20+ 靠 undici hooks）；如何录制/回放；怎么和 Playwright 联动。

**FEDrill 里**：`/api/chat` 集成测试用 MSW 回放 DeepSeek 的 SSE 帧，避免 CI 真调 LLM（成本 + 非确定性）。

---

### Q5. 怎么测一个 Next.js Route Handler 的 SSE 响应？

**60 秒话术**：三步：一是导出 `POST` 函数直接调（不起 server），传一个 `Request` 对象；二是拿到返回的 `Response` 后用 `response.body.getReader()` 读流；三是把每帧解出来断言。要点：`AbortController` 的传递链一定要测——用户断开后 upstream fetch 也要 abort，否则漏费用。

**深挖点**：
- Node 侧 `ReadableStream` 和浏览器侧的差异
- SSE 帧格式：`data: ...\n\n` 双换行终止
- 如何在测试里模拟客户端主动断开（`controller.abort()`）

---

## 三、E2E · Playwright / MCP

### Q6. Playwright 相比 Cypress 的核心优势？

**60 秒话术**：三点：多进程并发（Cypress 单页强绑定，Playwright 一个 test file 一个 worker）；跨浏览器（Firefox、WebKit 都支持，Cypress 只到 Chromium 系）；auto-wait 更聪明（内置等 element 可见/稳定/可点，几乎不用 sleep）。另外 Trace Viewer 是杀手锏，出错自动生成含 DOM 快照 + 网络 + console 的回放。

**深挖点**：
- Test isolation：Playwright 每个 test 起独立 BrowserContext，共享代价小
- `expect.poll` 用来做「最终一致性」断言
- Shard + retry 策略 + fixtures

---

### Q7. 什么是 Playwright MCP？和普通 Playwright 有什么区别？

**60 秒话术**：Playwright 本身是给人写用例的。Playwright MCP Server 把 `browser_click` / `browser_snapshot` 这些操作暴露成 MCP 协议下的 tool，让 LLM（Claude Code、Cursor）能像人一样操作浏览器。用途：AI 自动跑冒烟测试、bug 复现、UI 探索性测试。区别就一条——**驱动方是代码还是 LLM**。

**深挖点**：
- MCP 协议本身（JSON-RPC over stdio/SSE，tool 定义就是 JSON Schema）
- 为什么不直接给 LLM Puppeteer？→ 缺 accessibility snapshot，LLM 拿不到语义化 DOM
- accessibility snapshot vs screenshot：前者省 token 且更稳

**FEDrill 里**：M1 结束前接入，让 AI 自动跑「新增一题 → 加载 → 提交 → 拿到 Round 0 追问」这个冒烟流。

---

### Q8. E2E 测试怎么处理不稳定（flaky）？

**60 秒话术**：三层策略。第一层杜绝随机等待（禁 `waitForTimeout`），改用 Playwright 的 auto-wait 断言（`toBeVisible`、`toHaveText`）。第二层用 `test.step` 切段 + trace 抓失败点，先定位是网络/时序/环境。第三层保底：`retries: 2`，但每次 retry 记 flaky 分数，累计到阈值就把该用例标 `.fixme` 强制修。

**深挖点**：animation 导致的快照 flake（`animations: 'disabled'`）；时区/locale 差异；并发写数据库的隔离（每 test 用独立 fixture）。

---

## 四、LLM Eval · promptfoo / Ragas

### Q9. 为什么 LLM 输出不能用普通单测？

**60 秒话术**：因为**同一 prompt 每次输出不同**，`toEqual` 不成立。哪怕开 `temperature=0`，模型升级、上下文微改都会漂移。要测的是「输出的性质」而不是「输出的字面量」。常见断言：包含关键词、语义相似度（embedding cosine）、另一个 LLM 打分（llm-as-a-judge）、结构化输出的 schema 校验。

**深挖点**：
- llm-as-a-judge 的偏见（位置偏见、自我偏见、长度偏见）与缓解
- Golden set 怎么维护 —— 版本化到 git，模型升级前后跑一遍对齐
- 分数阈值 vs 相对回归：绝对分数没意义，看相对 baseline 是否降

**FEDrill 里**：Round 0 追问用 llm-rubric 断言「有引导问句、无完整答案泄漏」；30 条 golden set 版本化到 `tests/eval/round-0.yaml`。

---

### Q10. 讲一下 promptfoo 的评估流程

**60 秒话术**：YAML 定义 `providers`（要测的模型/prompt 组合）+ `tests`（每条含 vars 和 assert）。`promptfoo eval` 跑完拿到分数矩阵，`promptfoo view` 开 Web UI side-by-side 对比。CI 里跑 `--output` 生成 JSON，用阈值判定 fail。核心价值：**换模型/改 prompt 前后有量化对比**，不是拍脑袋。

**深挖点**：
- 与 LangSmith 的差异（开源本地 vs SaaS）
- 如何加自定义 assertion（导出一个 JS 函数）
- 成本控制：`--filter-first-n`、`--cache`

---

### Q11. RAG 系统怎么评估？

**60 秒话术**：分「检索质量」和「生成质量」两层。检索用 **Recall@K / MRR**，看 top-K 里有没有 ground truth 文档。生成用 **faithfulness（回答是否忠于检索到的上下文，不编造）+ answer_relevance（答案是否切题）+ context_precision（检索的段有没有真被用到）**。Ragas 这个库把这四个指标封好了，直接用。

**深挖点**：
- 为什么单看 BLEU/ROUGE 不够（表层重合 ≠ 语义正确）
- Faithfulness 底层也是 llm-as-a-judge，判断答案里的每个 claim 有没有在 context 里出现
- Hard negatives 挖掘（把用户点了 dislike 的检索结果当反例）

**FEDrill 里**：M3 起做，八股题的知识库检索用 Ragas 建 baseline。

---

## 五、代码沙盒安全

### Q12. Web Worker + `new Function` 跑用户代码有哪些风险？

**60 秒话术**：**逃逸 + 资源耗尽 + 侧信道** 三类。逃逸靠原型链污染（`Object.prototype.leak = 1`）或 postMessage 泄漏引用。资源耗尽有死循环、栈溢出、爆内存。侧信道能通过 timing / memory 读到其他 Worker 数据。Worker 只是隔离了 DOM 和主线程 window，不是完整沙盒。

**深挖点**：
- Realm 隔离 vs Worker 隔离（Worker 有独立 realm，但 `self` 上仍有 fetch/XHR）
- 为什么不用 iframe sandbox？→ 通信笨、开销大、无法方便传输大对象
- QuickJS-WASM / SES 是更强的选项，但引入成本高

**FEDrill 里**：MVP 手撕题就是这个方案（decisions/006）；算法题 M3 才切 Piston OJ。

---

### Q13. 怎么防死循环冻结页面？

**60 秒话术**：**主线程 kill Worker + 心跳兜底**。主线程 `setTimeout(() => worker.terminate(), 3000)` 是硬超时；Worker 内 `postMessage({type:'heartbeat'})` 每 200ms 发一次，主线程收到就重置软超时，收不到就杀。`terminate()` 会立刻停 Worker（不等 microtask 队列），所以有效。

**深挖点**：
- 为什么不能在 Worker 内自己判超时 → 死循环时 setTimeout 根本不会 fire
- 内存超限没有原生 API，只能靠 `performance.memory`（Chrome 独有、非精确）或 CI 里跑子进程测 RSS
- 主线程被 sync 阻塞（如超长 JSON.parse 用户输入）也要防

---

### Q14. 你的沙盒测试用例集怎么设计？

**60 秒话术**：按「攻击面」分类：**资源耗尽**（死循环、爆内存、深递归）、**逃逸**（原型链、globalThis、postMessage 引用泄漏）、**API 滥用**（fetch 打外部、localStorage 写主域）、**输出淹没**（超长 console.log 撑爆 SSE）。每条用例断言两件事：**危险行为被阻止 + 主线程/其他 Worker 不受影响**。红队用例专门跑一个 CI job，别混主 test。

**深挖点**：如何验证「主线程未冻结」——另起心跳定时器看是否被延迟；错误信息要脱敏（不含内部文件路径）。

---

## 六、Agent Loop 测试

### Q15. Agent Loop 的输出不确定，怎么保证 tool 调度正确率不回归？

**60 秒话术**：三招组合：一是**结构化断言**（tool_use 事件必须有正确的 name 和 args schema，这层是确定的）；二是**分类 eval**（用 golden set 定义「用户说 X → 该调 tool Y」，跑 20-50 条统计准确率，画混淆矩阵）；三是**snapshot on tool trace**（记录一次典型对话的 tool 调用序列，snapshot 到 git，回归时看序列是否漂移）。

**深挖点**：
- 为什么不直接测最终答案 → 中间调错工具但答案对是「运气好」，会掩盖 bug
- tool schema 变了 LLM 不知道怎么办 → schema 变更时 eval 集也要重跑
- max_turns 熔断的测试怎么写 → 构造一个会陷入循环的对话，断言 N 步内退出

**FEDrill 里**：`tests/eval/tool-dispatch.yaml` 会存 30 条「用户意图 → 期望 tool」对，CI 阈值设 95%。

---

### Q16. 讲一下 ReAct 模式和它的测试挑战

**60 秒话术**：ReAct = Reasoning + Acting，模型交替产出 thought（推理）和 action（tool 调用），拿到 observation 后继续推理。测试挑战：一是 thought 是自然语言，没法字面断言；二是 action 序列因模型不同而不同，序列敏感的 snapshot 会脆；三是失败模式很多（幻觉 tool 名、幻觉 arg、无限循环）。策略：只测 action 及其效果，thought 用 llm-rubric 抽查「推理是否合理」。

**深挖点**：ReAct vs plan-and-execute 差异；tool schema 严格性（Zod 校验非常关键）；Anthropic 官方博客 "Building Effective Agents" 里 workflow vs agent 的取舍。

**FEDrill 里**：Round 0 是 workflow（固定顺序），Round 1-4 是 agent（LLM 自主选顺序）；两者测试策略不同。

---

## 七、AI Code Review · CodeRabbit / simplify

### Q17. AI Code Review 和人肉 Code Review 的分工怎么划？

**60 秒话术**：AI 擅长「机械但耗神」的部分：hooks 依赖、类型收窄、schema 同步、命名一致、简单 bug 模式。人肉负责「需要业务上下文」的部分：架构是否合理、抽象层级是否合适、这次改动会不会破坏未提到的场景。理想工作流：AI 先过一轮把噪音干掉，人再看剩下的实质问题。

**深挖点**：
- False positive 处理（明显不对的建议怎么反馈调优）
- CodeRabbit / Greptile / Sourcery 的定位差异
- Claude Code 的 `simplify` skill 定位：本地跑、只挑重复/复用/效率，不挑 bug

---

## 八、成本、观测、CI 编排

### Q18. LLM 项目的 CI 怎么控成本？

**60 秒话术**：**分层策略**。unit/integration 全部 mock，不真调；E2E 里的 LLM 调用也全部 fixture 回放；只有 eval job 真调 LLM，且 eval job 只在 `main` 分支或 label `run-eval` 的 PR 上跑。再叠三重保险：`OPENAI_LIKE_BUDGET_USD` 熔断、`--cache` 复用相同 prompt、`--filter-first-n` 快速验证再全量。

**深挖点**：
- prompt cache（Anthropic 侧的 5 分钟 TTL prompt caching）怎么用
- token 计费口径（prompt tokens vs completion tokens）
- 小模型跑 eval 的可行性 —— 用 Haiku 4.5 做 judge 便宜且够用

---

### Q19. LLM 产品要监控哪些指标？

**60 秒话术**：**四类核心**。质量：eval 分数（趋势）、用户点赞率、tool 调用失败率。性能：p50/p95 首 token 延迟、总生成延迟。成本：每千次会话美元数、缓存命中率。安全：拒答率、敏感词命中数、沙盒 kill 次数。落地上：Vercel Analytics 抓前端事件，Route Handler 里手写 middleware 打 log 到 Logtail/Grafana。

**深挖点**：
- 首 token 延迟为什么关键 → 用户感知第一屏，比总时长更影响留存
- Traces（LangSmith / Langfuse）vs Metrics：前者是全链路 debug，后者是聚合大盘

---

## 九、跨领域一定要会的三个通用问题

### Q20. Testing Trophy vs Testing Pyramid，你怎么看？

**60 秒话术**：金字塔是「多单测少 E2E」的经典比喻，Trophy 是 Kent C. Dodds 主张「集成测试最厚」。分歧本质是「单元」怎么定义。前端里 UI 组件的「单元」经常不是纯函数，测它反而要 mock 一堆依赖，价值低；测「组件 + 一小段真交互」的集成测试性价比更高。所以现代前端偏 Trophy，后端偏 Pyramid。

**深挖点**：契约测试（Pact）在 Trophy 里的位置；成本-价值曲线在 monorepo 里的差异。

---

### Q21. 什么是「测测试的测试」？Mutation Testing 是什么？

**60 秒话术**：Mutation Testing 会故意改一处代码（比如 `>` 变 `>=`），然后跑测试，看有没有测试因此挂。如果没挂，说明这行代码没被有效覆盖 —— 行覆盖率是骗人的（能进这行但没断言）。工具：Stryker（JS/TS）。适合关键路径（判题器、沙盒 kill 逻辑）做，不适合全项目跑（慢）。

**深挖点**：Mutation score 阈值；等价 mutant 问题（改了但语义没变，误报）；哪些代码不值得做（UI 展示层）。

---

### Q22. 你怎么衡量一个测试套件「够不够好」？

**60 秒话术**：不看行覆盖率，看**三个信号**：一是引入一个已知 bug 时能不能被现有测试抓到（chaos test）；二是重构时测试挂不挂 —— 挂表示测试和实现耦合太紧；三是测试运行时长的稳定性 —— 波动大意味 flaky 或有共享状态。行覆盖率只是「必要不充分」，达到 80% 但断言弱，等于没测。

**深挖点**：Branch coverage、path coverage 层级；mutation testing 是黄金标准但成本高；code review 里怎么审 test（先看断言强度而不是数量）。

---

## 十、面试话术组织建议

1. **每题准备一个 FEDrill 例子**。面试官问原理，你答完总能补一句「我在 FEDrill 的 XX 里就这么做的，效果是……」。
2. **暴露真实踩坑**。比如「我一开始用 Jest，改了 Vitest 因为 Next.js 16 ESM 配 babel-jest 折腾一晚上没成功」——比背原理更真实。
3. **能画图就画图**。测试金字塔、Agent Loop、SSE 帧格式，白板上一画立刻分层。
4. **区分 M1-M5**。同一件事在不同阶段做法不同（M1 沙盒用 Web Worker，M3 算法题用 Piston），说清楚是「阶段性最优」而不是「唯一正解」。
5. **敢说不知道**。Ragas 内部 metric 具体公式不用背，说「知道概念，用的时候查文档，主要靠 baseline 对比看趋势」就够。

---

**相关**：[../AI测试工具调研.md](../AI测试工具调研.md) · [sse-under-the-hood.md](sse-under-the-hood.md) · [tool-use-and-react.md](tool-use-and-react.md) · [prompt-context-pitfalls.md](prompt-context-pitfalls.md)
