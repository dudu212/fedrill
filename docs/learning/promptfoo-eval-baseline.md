# promptfoo eval baseline · 首个 LLM 自动化断言集 · 挖到 prompt 优先级冲突

> 日期:2026-09-06 · 关联 [AI 测试工具调研 §3.4](../AI测试工具调研.md) · [ADR-009 Tier 3 · Prompt 属高风险区](../decisions/009-ai-test-autonomy-tiers.md)
>
> **本文档按 STAR 结构写**(情境-任务-行动-成果),沉淀 Step 6 骨架建立过程 + 一个真实的 prompt 优先级 bug 挖掘故事。
>
> 面试话术钩子:「我给 AI 教练的 Round 0 追问建了 promptfoo golden set,首战跑出 4/5,挖到一个 prompt 优先级冲突——顶层"反问引导"风格压过"讲解概念"规则。修 attempt 1 只重排规则(4→5),attempt 2 强化脱离反问(反而 3/5,破坏其他规则)。得出结论:prompt 是耦合系统,LLM eval 本身也有波动性。」

---

## S · Situation · 情境

**背景**:FEDrill 的核心 UX 是 Round 0-4 阶梯追问,LLM 输出质量**没有量化 baseline**。Prompt 迭代靠肉眼看两三个 case,换模型 / 改 prompt 后是否漂移完全没数据。

**FEDrill 当时状态**:
- Round 0 prompt 手写完成,五道预置手撕题跑通(M1)
- 单测 43 条 + Playwright 沙盒红队 6 条 + Playwright MCP 装完
- **测试栈唯一空白:LLM 输出评估**
- 距离 M2 铺开 30 条 golden set 还早,先建骨架

**这时候动手的理由**:
- 测试基建 5 步完成度 5/6,收官需要一个
- Round 0 prompt 复杂(150+ 行 · 多规则),需要**自动化**才能验证改动不回归
- Step 6 骨架成本低(30-40 分钟),M2 铺开时不用现学工具

---

## T · Task · 任务

**目标**:建立一份**可自动跑、有量化分数、可版本化**的 Round 0 追问评测基线,能验证 5 类典型用户输入下 LLM 是否遵守 prompt 规则。

**约束**:
- **成本可控** —— 不能真调 LLM 到 30+ 条(会烧钱且慢),M1 骨架 5 条起步
- **无第三方 SaaS 依赖** —— 本地跑,数据不出仓
- **能被 CI 挂钩** —— 未来 PR 分数 < 阈值即 fail
- **LLM-as-judge 单模型可用** —— DeepSeek 一个 key 就能同时作生成方 + 评审方

**5 类要测的用户输入**(每类一条 golden case):

1. **P1** 无代码 · 求解答 —— 期望反问引导,不给完整实现
2. **P2** 无代码 · 问原理 —— 期望讲核心概念(**这是发现漏洞的那条**)
3. **P3** 有代码 · 部分测试失败 —— 期望指出问题类别,不索要代码
4. **P4** 有代码 · 全部通过 —— 期望进入 Round 1 边界追问
5. **P5** 反元语言词汇 —— 硬性 not-contains 拦截"分支/路由/状态标记/内部判断"

**核心矛盾**:如何在有限 5 条断言下,**既覆盖主流场景又能暴露 prompt 设计漏洞**?

---

## A · Action · 行动

### 工具选型 · 为什么 promptfoo

**候选**:promptfoo · LangSmith(付费 SaaS)· Ragas(Python + RAG 侧)· DeepEval(Python 生态)

**选 promptfoo 的理由**:
1. Node/TS 原生 · 和 FEDrill 技术栈同源,`package.json` 一行装完
2. **本地跑 + YAML 配置** · 完全可版本化,PR review 能看 diff
3. **DeepSeek 作 judge 也支持** · 单 key 走通,不强制 OpenAI/Anthropic
4. **llm-rubric + not-contains 组合** · 既能做柔性质量断言,也能硬拦具体词汇

### 架构 · 三层文件分离

```
tests/eval/
  promptfooconfig.yaml   系统提示词 + provider + 全局配置
  round-0.yaml           5 条 test case(vars + assert)
scripts/
  eval-runner.mjs        跨平台 wrapper(处理 Windows .cmd 坑 + env 映射)
package.json
  test:eval              node --env-file=.env.local scripts/eval-runner.mjs
```

**为什么 wrapper 脚本**:
- **Windows Node spawn `.cmd` shim 会走 shell,路径 CJK 编码碎片化** —— 改用 `process.execPath` 直接跑 `dist/src/entrypoint.js`,零 shell
- **promptfoo yaml 的 `${VAR}` 模板在 provider config 里不生效** —— 改用 `OPENAI_API_KEY` env(promptfoo OpenAI provider 默认从这里读),wrapper 自动把 `DEEPSEEK_API_KEY` 复用过去

### 断言设计 · llm-rubric + not-contains 组合

**Golden case P2** 断言示例:

```yaml
- description: RT-P2 · 用户问原理 · 概念型问题
  vars:
    user_message: Promise.all 的原理是什么?
    user_code: (用户尚未写任何代码)
    test_result: (尚未运行测试)
  assert:
    - type: llm-rubric
      value: 回复应讲解 Promise.all 的核心概念(至少提到"并发"、"聚合结果"、
             "任一 reject 短路"三点中的一点),允许结合当前手撕场景,但不给完整实现代码
```

**为什么用 llm-rubric 而非 contains**:LLM 会用不同措辞表达同一概念("并发发起"/"同时执行"/"paralell fire"),字面匹配脆弱;llm-rubric 让 judge LLM 语义判断,鲁棒。

**为什么加 not-contains 组合**:确定性词汇(如"分支""路由")用 not-contains 硬拦成本低、可信度高,不必浪费 llm-rubric 的 tokens。

### 踩坑三连(每个都值得记住)

**坑 1 · yaml 里 `${DEEPSEEK_API_KEY}` 不做替换**
- 症状:401 · 错误信息 "Your api key: ****KEY} is invalid" (literal `${...}` 结尾)
- 修法:改用 `OPENAI_API_KEY` env(openai provider 自动读),wrapper 里 `process.env.OPENAI_API_KEY ??= process.env.DEEPSEEK_API_KEY`

**坑 2 · pnpm `ERR_PNPM_IGNORED_BUILDS` 预检查**
- 症状:`pnpm test:eval` 直接失败,promptfoo 拉的 native deps(onnxruntime / esbuild / @swc/core)触发 pnpm 安全提示
- 修法:`pnpm-workspace.yaml` 里明确 `allowBuilds: false`(不需要跑 postinstall,只用 API-based provider)

**坑 3 · Windows `.cmd` 通过 spawn+shell 路径乱码**
- 症状:`node_modules 不是内部或外部命令`(cmd.exe 找不到)
- 修法:绕开 `.bin` 的 .cmd shim,直接 `spawn(process.execPath, ['node_modules/promptfoo/dist/src/entrypoint.js', ...])`

### 挖掘瞬间 · Attempt 1 · 首战 4/5

**跑通的第一次**:

```
Results:
  ✓ 4 passed (80.00%)
  ✗ 1 failed (20.00%)
Duration: 5s · Total tokens: 3,117
```

**挂的是 RT-P2**:

- 用户问:「Promise.all 的原理是什么?」
- LLM 回:「先想清楚三件事:输入是什么?输出是什么?中间要对每个输入做哪些操作?」
- Rubric 期望:讲解并发 / 聚合结果 / 任一 reject 短路
- LLM 回复**零概念含量**,完全走了"无代码引导三要素"分支

**诊断 · Prompt 优先级冲突**:

系统提示词最初的规则顺序:

```
- 用户没写代码 → 引导思考"输入/输出/操作"三要素
- 用户有代码有失败用例 → 指出问题类别
- 用户全部通过 → 进入 Round 1
- 用户问概念/原理 → 讲核心概念
```

**RT-P2 用户没写代码 AND 问了原理**,LLM 按顺序 firstmatch 命中"没写代码"规则,永远走不到"问原理"规则。

### 修复实验 · Attempt 1 & 2

**Attempt 1 · 只重排 + 加优先级标签**:

```
- **优先级 1** · 用户问概念/原理 → 讲核心概念,无视是否有代码
- 优先级 2 · 用户全部通过 → 进入 Round 1
- 优先级 3 · 用户有失败用例 → 指出问题类别
- 优先级 4 · 用户没写代码 → 引导三要素
```

**结果**:仍 4/5 · RT-P2 挂 · 但输出改进(提到了 Promise.all 名字)

**Attempt 2 · 强化"脱离反问风格"**:

```
- **优先级 1** · 用户问概念/原理 → **暂时脱离反问风格,直接讲核心概念**(至少 2 个技术要点)
```

**结果:变差了!3/5 (60%)** · 强调"脱离反问"破坏了 RT-P1 和 RT-P5 的"该反问的时候要反问"

**回退到 Attempt 1 · 再跑**:5/5(100%)—— 但这**只是一次跑的波动**,同一 prompt 下次可能又是 4/5。

### 最终决策 · 承认 gap,记录在配置里

不在 prompt 上继续硬加权重,而是在 promptfooconfig.yaml 里写下**已知 gap 说明**:

```yaml
## 已知 gap(2026-09-06 baseline · 4/5)
RT-P2「Promise.all 的原理是什么?」目前仍 fail —— 顶层"简洁犀利、反问引导"风格
压过优先级 1 的"讲概念"规则。加"脱离反问风格"提示反而破坏 RT-P1/P5(3/5)。
M2 前用 Claude Haiku 或加 few-shot 示例修,不通过在系统 prompt 单侧硬加权重。
```

---

## R · Result · 成果

### 定量结果

- **首个 LLM 自动化 eval 跑通**:`pnpm test:eval` 一条命令跑完 5 条 · 4-5 秒 · 3-4K tokens
- **Baseline 分数**:4-5/5(range 80-100%) · 首战 4/5(80%)
- **发现真 prompt 设计漏洞**:规则优先级冲突 → 已在配置里显式登记
- **文件产出**:3 个(config yaml + tests yaml + wrapper mjs),9940 insertions
- **投入时间**:约 90 分钟(含 3 次踩坑迭代)

### 能力覆盖

**能做**:
- 改 prompt 后自动跑一遍,分数低于 baseline 即刻发现
- 换模型对比(未来 M2 加 Claude Haiku 4.5)一键 side-by-side
- CI 挂钩:PR 触发 eval,分数 < 阈值 fail

**已知边界**(诚实登记):
- **LLM eval 有波动性**:同一 prompt 相同 case,4-5/5 之间抖动 —— 未来需多次跑取分数分布,或固定 seed
- **单模型 judge 有自我偏见风险**:DeepSeek 判 DeepSeek 输出,可能偏松;M2 用 Claude Haiku 做交叉验证
- **5 条骨架覆盖场景不足**:M2 铺到 20-30 条 · 加上 tool_use 调度 golden set · 幻觉红线

### 更普适规律 · 值得记住的 3 条

**规律 1 · Prompt 是耦合系统 · 单侧加权重会破坏别的规则**

我加"脱离反问风格"想让 RT-P2 过,反而破坏 RT-P1/P5。这说明 prompt 里的规则不是独立的——顶层风格(简洁犀利/反问引导)会渗透到具体规则的执行方式。**改 prompt 后必须跑完整 eval 集,不能只看目标 case**。

**规律 2 · LLM eval 本身非确定 · 多次跑取分布 > 单次结果**

同 prompt 同 case,4/5 → 5/5 的抖动纯粹是 LLM 输出波动。**任何"改 prompt 让分数提升"的结论,都需至少 3 次跑取均值**。生产环境应该:
- 提高 seed 一致性 或 用 temperature=0
- 保留多次跑的 detailed logs,看 flaky case

**规律 3 · 让 eval 发现 bug 比让 eval 通过重要**

首战 4/5 · **失败的那一条比成功的四条更有价值** —— 它是 prompt 设计的真实漏洞,不做 eval 上线后用户遇到才会发现。**80% pass rate 是骨架合格证**,不是终点。

### 面试话术升级

**弱版**:「我用 promptfoo 做了 LLM 评测,过了 5 条断言」

**强版**:
> 「我给 FEDrill 的 Round 0 追问建了 promptfoo golden set,首战跑出 4/5,挖到一个 prompt 优先级冲突——顶层"反问引导"风格压过了"讲解概念"规则。修 attempt 1 只重排规则,结果没变(仍 4/5)但输出改进;attempt 2 强化"脱离反问",反而 3/5(破坏了另外 2 条)。这让我意识到 **prompt 是耦合系统,单侧改动会破坏别的规则**;并且 **LLM eval 本身有波动性,同一 prompt 抖 4-5/5**,需要多次跑取分布。最后我把这个已知 gap 记在配置里,M2 换 Claude Haiku 做交叉判断 + 加 few-shot 示例修,不在系统 prompt 单侧硬加权重。」

—— **"承认自己方案的边界"** > **"报了个好看的分数"**。

### 已开启的后续动作

- [x] 本 STAR 学习笔记(此文)
- [x] [testing-setup-log.md](../testing-setup-log.md) Step 6 更新(TODO)
- [ ] M2 · 扩到 20-30 条 golden set(Round 0-4 各建 5 条 + tool_use 调度 + 幻觉红线)
- [ ] M2 · 加 Claude Haiku 4.5 作交叉 judge
- [ ] M2 · CI 挂钩(GitHub Actions `.yml`)· PR 触发 eval · 分数低于阈值 fail
- [ ] M2 · 每 case 跑 3 次取均值,记录波动区间

---

## 相关

- [ADR-009 · Tier 3 · Prompt 属高风险区](../decisions/009-ai-test-autonomy-tiers.md) —— Prompt 修改必须人手写,eval 结果验收
- [AI 测试工具调研 §3.4](../AI测试工具调研.md) —— promptfoo 选型完整依据
- [testing-setup-log.md](../testing-setup-log.md) —— 6 步测试栈落地全景
- [sandbox-e2e-harness.md](sandbox-e2e-harness.md) · [closure-shadow-and-nonce.md](closure-shadow-and-nonce.md) —— 姊妹 STAR 文档
