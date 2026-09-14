# FEDrill · M5 改造计划：用户登录 · 用户画像 · 题库迁移 PostgreSQL

> 版本 v1 · 2026-09-13
>
> 前置：M4「PostgreSQL 会话持久化接入」已完成并合入 main（commit a946333）
>
> 单一事实源：本文档为 M5 期改造计划的权威。改动优先动这里，其他文档只挂锚点。

## 一、背景与目标

- **现状**：M4 已完成 PostgreSQL 接入——`users`（匿名用户）、`problems`（做题时单题登记）、`sessions`（会话持久化）三表已启用；`user_profiles` / `test_results` / `srs_cards` 三表与 `update_user_profile` 存储过程已建好但未接线；题库仍为静态 TS（`data/problems/*.ts`，15 道）。
- **M5 目标（三件事）**：
  1. **题库全量迁移 PostgreSQL**：`problems` 表成为题库唯一权威源，覆盖全部题目；
  2. **用户登录**：接入 GitHub OAuth，匿名用户升级为真实账号，支持多设备同步；
  3. **用户画像**：训练行为自动沉淀画像（技能矩阵 / 连续打卡 / 完成数），并提供前端展示页。

## 二、现状盘点

### 2.1 数据库现状（fedrill 库 6 表）

| 表 | 状态 | 说明 |
|---|---|---|
| `users` | ✅ 已启用 | 匿名用户（`anon-<uuid>@fedrill.local`），`github_id` 字段已预留 |
| `problems` | 🟡 部分 | 仅"做过的题"被 seed-problem.ts 自动登记，非全量 |
| `sessions` | ✅ 已启用 | 每用户每题目一条，UNIQUE(user_id, problem_id) |
| `user_profiles` | 🟡 建表未用 | skill_matrix / streak / total_completed 字段就绪 |
| `test_results` | 🟡 建表未用 | 每轮测试历史流水结构就绪 |
| `srs_cards` | 🟡 建表未用 | SM-2 间隔重复卡片结构就绪 |
| `update_user_profile()` | 🟡 已定义未调用 | 按 round=4 会话数算 total_completed |

### 2.2 题库现状

- `data/problems/*.ts`：15 个 TS 文件，每个导出 `ImplProblemMinimal`（id/type/category/title/difficulty/tags/description/starterCode/testCases/…），`index.ts` 聚合。
- 读取路径：页面直接 import 静态 TS；首次做题时 seed-problem.ts 把该题 upsert 进 `problems` 表（仅登记，不作为读取源）。

## 三、任务 A：题库迁移 PostgreSQL

**目标**：`problems` 表成为题库唯一权威源，题目列表/详情改从数据库读取。

### A.1 迁移脚本

- 新增 `scripts/migrate-problems.mjs`：读取 `data/problems/index.ts` 全量题目 → upsert 进 `problems` 表（幂等，可重复执行）。
- `problems.data`（JSONB）存完整题目（description / starterCode / testCases / example 等），顶层列存索引字段（id/type/category/title/difficulty/tags）。

### A.2 读取链路改造

- 新增 `lib/repo/problem-repo.ts`：服务端实现 `listProblems()` / `getProblemById(id)`（pg 查询）。
- 新增 `GET /api/problems`、`GET /api/problems/[id]` 路由。
- 前端题库列表页 / 题目详情页改从 API 取数（复用现有 fetch 封装风格）。
- **fallback 决策**：DB 无数据时回退静态 TS 读取（保持开发期便利），DB 有数据则用 DB。
- `seed-problem.ts` 降级为幂等兜底（保留，避免外键断裂）。

### A.3 涉及文件与验证

- 新增：`scripts/migrate-problems.mjs`、`lib/repo/problem-repo.ts`、`app/api/problems/route.ts`、`app/api/problems/[id]/route.ts`
- 修改：题库列表页、题目详情页取数、`seed-problem.ts`
- 验证：迁移后 `SELECT count(*) FROM problems` = 15；题库列表/详情页端到端可读；重复执行迁移脚本数据不翻倍（幂等）

## 四、任务 B：用户登录（GitHub OAuth）

**目标**：GitHub OAuth 登录 → `users.github_id` 绑定 → 匿名数据迁移合并 → 多设备同步。

### B.1 认证方案

- **建议**：轻量手写 OAuth 流程（两个 API 端点）或 NextAuth（Auth.js）。需验证 Next 16 兼容性后定。
- 端点设计（手写方案）：
  - `GET /api/auth/github`：302 跳转 GitHub authorize（state 绑定匿名 user_key）
  - `GET /api/auth/callback`：code 换 token → 获取 GitHub 用户信息 → users upsert（github_id 唯一）
- `users` 表：给 `github_id` 补 UNIQUE 索引。

### B.2 匿名数据合并策略（关键）

1. 登录前若存在匿名 `user_key` → 解析匿名 user_id；
2. 登录成功后 upsert 真实用户行 → 把该匿名 user_id 名下的 `sessions`（含 problems/test_results 后续归属）迁移到真实 user_id（`UPDATE ... SET user_id = $real WHERE user_id = $anon`）；
3. 迁移完成后删除匿名 users 行；
4. 客户端升级：登录后携带真实身份（token/user_id），`x-fedrill-user-key` 头语义升级为"登录态优先，未登录回退匿名"。

### B.3 涉及文件与风险

- 新增：`app/api/auth/github/route.ts`、`app/api/auth/callback/route.ts`、`lib/auth/*`
- 风险：
  - 需注册 GitHub OAuth App（回调 URL 配置）；
  - NextAuth 与 Next 16 兼容性（若选 NextAuth，先 spike 验证）；
  - 并发登录/重复登录的幂等处理（同 github_id 再次登录不重复迁移）。

## 五、任务 C：用户画像

**目标**：训练行为自动沉淀画像数据，提供展示页。

### C.1 口径（需拍板）

| 指标 | 建议口径 | 状态 |
|---|---|---|
| `skill_matrix` | 按题目 `category` 维度掌握度 = 该类别通关题数 / 该类别题数，JSON `{"async": 100, ...}` | 默认方案，待确认 |
| `streak` | 连续自然日有会话更新（`sessions.updated_at` 覆盖天数），断更归零 | 待确认 |
| `total_completed` | round=4 会话数（存储过程已定义） | 复用 |

### C.2 写入链路

- 用户创建时**补建 `user_profiles` 行**（当前只有 users 行，存储过程 UPDATE 会命中 0 行）；
- 通关（round 到达 4）→ 调用 `update_user_profile` 刷新 total_completed / streak；
- 跑测试 / 通关时按题目 category 更新 skill_matrix；
- 新增 `lib/profile/aggregate.ts`（画像聚合计算，纯函数便于单测）。

### C.3 读取与展示

- 新增 `GET /api/profile`：按 user-key 解析用户 → 返回 user_profiles + 做题统计摘要；
- 新增 `/profile` 页面：技能矩阵（雷达图/进度条）、连续打卡、完成数、最近做题记录；顶部导航加入口。

### C.4 依赖关系

- C 可先基于匿名用户实现；B 完成后画像自动归属真实账号（数据合并时 user_profiles 一并迁移）。

## 六、实施顺序与里程碑

| Phase | 内容 | 依赖 | 优先级 |
|---|---|---|---|
| **Phase 1** | 任务 A 题库迁移 | 无（独立、低风险） | 先做，作为数据层地基 |
| **Phase 2** | 任务 C 用户画像 | 无（基于现有匿名体系） | 次做 |
| **Phase 3** | 任务 B 用户登录 | 建议在 A/C 之后（user 体系成熟后合并） | 后做 |

每 Phase 交付即验证，改动同步进 `docs/` 与 Windows 端课程设计目录 SQL/文档。

## 七、验证方案

- **A**：迁移脚本幂等（跑两遍 count 仍=15）；题库列表/详情端到端从 API 读取成功；
- **B**：OAuth 登录 → users 更新；匿名数据合并后 sessions 归属正确；重复登录不重复迁移；
- **C**：通关到 round4 → total_completed+1、skill_matrix 按 category 更新、streak 连续/断更逻辑正确；`/profile` 页展示数据与 DB 一致。

## 八、风险与开放问题

- [ ] `skill_matrix` 口径：按 category（默认）还是按 tags，待拍板；
- [ ] GitHub OAuth App 注册（需仓库/账号管理员操作，回调 URL）；
- [ ] 认证实现选型：手写 OAuth vs NextAuth（Next 16 兼容性待验证）；
- [ ] 题库 fallback 策略：DB 空时回退静态 TS 是否保留；
- [ ] **推送权限**：本机 SSH 账号 `lllxxxxxlll` 对 `dudu212/fedrill` 无 push 权限（待 owner 加协作者或走 fork + PR）。
