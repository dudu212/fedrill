# FEDrill

> 前端秋招题库 AI 教练 · 让 AI 用面试官方式陪你练手撕/算法/八股

## 项目简介

FEDrill 是一个**前端求职者训练平台**，用 AI 模拟面试官对你阶梯式追问：

- 🔥 **手撕题**：Round 0 基础 → 1 边界 → 2 性能 → 3 工程化 → 4 变体，逼你把 60 分实现进化到面试满分
- 🧠 **算法题**：苏格拉底式引导（不给答案）+ D3 算法可视化
- 📚 **八股题**：对话式深挖 + SM-2 间隔重复调度

## 开发

```bash
pnpm install
cp .env.local.example .env.local  # 填入 API key
pnpm dev
```

访问 <http://localhost:3000>

## 技术栈

- **前端**：Next.js 16 + React 19 + TypeScript + Tailwind CSS 4
- **AI**：Vercel AI SDK + DeepSeek + Claude
- **代码执行**：Web Worker 沙箱（M1-M2）+ Piston API（M3）
- **可视化**：D3 + Framer Motion（M3）
- **数据**：localStorage（M1-M3）→ Supabase Postgres（M4）

## 项目文档

- [项目调研](docs/项目调研.md) — 为什么做（战略层）
- [需求方案](docs/需求方案.md) — 具体做什么（战术层）
- [技术方案](docs/技术方案.md) — 怎么做（实现层）

## 开发进度

- [ ] M1 · 手撕题单题闭环
- [ ] M2 · 完整阶梯追问 Agent
- [ ] M3 · 算法题模块 + 可视化
- [ ] M4 · 八股题模块 + 长期记忆
- [ ] M5 · MCP + 上线

## License

MIT
