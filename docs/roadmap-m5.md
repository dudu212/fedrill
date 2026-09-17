# FEDrill · M5 改造计划：用户登录 · 用户画像 · 题库迁移 PostgreSQL

> 版本 v1.3 · 2026-09-15
>
> 前置：M4 已合入（a946333）；Phase 1 已提 PR #3（965d5e5）；Phase 2 已提 PR #4（6111e73，分支 feat/profile）
>
> 单一事实源：本文档为 M5 期改造计划的权威。改动优先动这里，其他文档只挂锚点。

## 〇、进度总览

| Phase | 内容 | 状态 | 备注 |
|---|---|---|---|
| Phase 1 | **任务 A：题库迁移 PostgreSQL** | ✅ 已完成（v1.1） | 15 道题全量入库，列表/详情改从 DB 读取，API fallback 保留；PR #3 已提交 |
| Phase 2 | 任务 C：用户画像 | ✅ 已完成（v1.2） | 匿名用户画像落库 + 通关触发刷新 + /profile 展示页；PR #4 已提交 |
| Phase 3 | 任务 B：用户登录 | 🔶 骨架完成（v1.3） | OAuth 路由 + HMAC 登录态 + 匿名数据合并已实现；待注册 OAuth App 后联调 |

## 一、背景与目标

- **现状**：M4 已完成 PostgreSQL 接入——`users`（匿名用户）、`problems`（做题时单题登记）、`sessions`（会话持久化）三表已启用；`user_profiles` / `test_results` / `srs_cards` 三表与 `update_user_profile` 存储过程已建好但未接线；题库原为静态 TS（`data/problems/*.ts`，15 道）。
- **M5 目标（三件事）**：
  1. **题库全量迁移 PostgreSQL**：`problems` 表成为题库唯一权威源，覆盖全部题目；✅ 已完成
  2. **用户登录**：接入 GitHub OAuth，匿名用户升级为真实账号，支持多设备同步；
  3. **用户画像**：训练行为自动沉淀画像（技能矩阵 / 连续打卡 / 完成数），并提供前端展示页。

## 二、现状盘点

### 2.1 数据库现状（fedrill 库 6 表）

| 表 | 状态 | 说明 |
|---|---|---|
| `users` | ✅ 已启用 | 匿名用户（`anon-<uuid>@fedrill.local`），`github_id` 字段已预留 |
| `problems` | ✅ 已启用（v1.1 起全量） | **15 道题已全量迁移入库**，作为题库权威源 |
| `sessions` | ✅ 已启用 | 每用户每题目一条，UNIQUE(user_id, problem_id) |
| `user_profiles` | ✅ 已启用（v1.2） | 用户创建时自动建行；通关时刷新 total_completed / skill_matrix / streak |
| `update_user_profile()` | ✅ 已启用（v1.2） | 通关时调用，算 total_completed（round=4 会话数） |
| `test_results` | 🟡 建表未用 | 每轮测试历史流水结构就绪 |
| `srs_cards` | 🟡 建表未用 | SM-2 间隔重复卡片结构就绪 |

### 2.2 题库现状（v1.1 更新）

- ~~静态 TS 为唯一源~~ → **PostgreSQL `problems` 表为权威源**（data JSONB 存完整题目，顶层列存索引字段）。
- 静态 TS（`data/problems/*.ts`）保留为 **API fallback**：DB 未迁移 / 连接失败时回退，保证开发期可用。
- 迁移脚本：`scripts/migrate-problems.ts`（`pnpm exec tsx scripts/migrate-problems.ts`，幂等 upsert）。

## 三、任务 A：题库迁移 PostgreSQL（✅ 已完成）

**目标**：`problems` 表成为题库唯一权威源，题目列表/详情改从数据库读取。

### A.1 迁移脚本（已完成）

- `scripts/migrate-problems.ts`：读取 `data/problems/index.ts` 全量题目 → upsert 进 `problems` 表（幂等，可重复执行）。
- 执行方式：`pnpm exec tsx scripts/migrate-problems.ts`（tsx 支持 tsconfig paths `@/`）。
- 执行结果：首次新增 13 道 + 更新 2 道（此前做题已登记）= **共 15 道**；重跑一次新增 0 / 更新 15（**幂等验证通过**）。

### A.2 读取链路改造（已完成）

- `lib/repo/problem-repo.ts`：服务端 `listProblemsFromDb()` / `getProblemFromDb(id)` / `hasSeededProblems()`（pg 查询，data JSONB 即完整题目）。
- `GET /api/problems`：DB 有数据 → 返回 DB 列表；DB 空/失败 → 回退静态 TS（页面无感知）。
- `GET /api/problems/[id]`：DB 查 → 回退静态 → 404。
- 前端：
  - `app/problems/page.tsx`：列表改从 `/api/problems` 异步取数（loading / error 态），分类过滤在客户端。
  - `app/problems/[id]/page.tsx`：题目改从 `/api/problems/[id]` 异步取数（loading 骨架 + 404 分支），Monaco / Agent / 测试逻辑不变。
- `seed-problem.ts`：保持幂等兜底（迁移后 INSERT 冲突走 `ON CONFLICT DO NOTHING`，天然 no-op），无需改动。

### A.3 验证记录（已完成）

- [x] 迁移幂等：跑两遍 `count(*)` 恒为 15
- [x] `GET /api/problems` → 200，15 道，分类分布 util 5 / async 4 / prototype 4 / pattern 2
- [x] `GET /api/problems/promise-all` → 完整题目（requiredAPI / testCases.basic 5 个 / starterCode / edgeCases / followUpPath）
- [x] `GET /api/problems/async-series`（此前未做过）→ 正确返回，证明全量迁移
- [x] 未知 id → 404
- [x] `tsc --noEmit` 零错误；`vitest` 74/74 通过
- [x] 浏览器端到端：题库列表页（15 道卡片 + 分类计数）、题目详情页（async-series 完整渲染）均从 API/DB 正常加载

## 四、任务 B：用户登录（GitHub OAuth）（🔶 骨架完成 v1.3）

**目标**：GitHub OAuth 登录 → `users.github_id` 绑定 → 匿名数据迁移合并 → 多设备同步。

### B.1 认证方案（已定：手写轻量 OAuth，零新依赖）

- `users.github_id` UNIQUE 索引：**已有**（建表时预留），无需改 schema。
- 端点（已实现）：
  - `GET /api/auth/github`：302 → GitHub authorize（scope `read:user user:email`，state 写 httpOnly cookie 防 CSRF；可选 `?userKey=` 绑定匿名）
  - `GET /api/auth/callback`：校验 state → code 换 token → 拉取 /user → `upsertGithubUser`（github_id 幂等）→ 匿名数据合并 → 签发登录态 cookie → 302 /profile
  - `GET /api/auth/me`：返回 `{authed, userId, email}`（前端登录态判断）
  - `POST /api/auth/logout`：清除登录态 cookie
- `lib/auth/session.ts`：登录态 token = `userId.hmac(userId)`（HMAC-SHA256，恒定时间比较；secret 用 GITHUB_CLIENT_SECRET/AUTH_SECRET）
- 登录态 cookie：`fedrill:auth:token`（httpOnly + sameSite=lax）

### B.2 匿名数据合并（已实现，lib/auth/merge.ts）

1. 回调带匿名 user_key（cookie）→ `getOrCreateUser` 解析匿名 user_id；
2. 事务内：sessions 迁移到真实 user_id（UNIQUE(user_id, problem_id) 冲突时保留真实、丢弃匿名该题）→ user_profiles 真实已有则丢弃匿名、否则改挂 → 删除匿名 users 行（CASCADE 清残留）；
3. 同 github_id 重复登录（无匿名 cookie）→ 空操作安全返回；
4. 鉴权升级：`lib/auth/resolve.ts` 统一解析——**登录态 cookie 优先，匿名 user-key 兜底**；session/profile 路由已接入。

### B.3 客户端与配置

- `app/_components/auth-status.tsx`：未登录显示「GitHub 登录」（跳 `/api/auth/github?userKey=<匿名 key>`），已登录显示邮箱 + 登出；列表页 header 已接入。
- `.env.local(.example)`：新增 `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `APP_BASE_URL`；未配置时 `/api/auth/github` 返回 503 友好提示，`/api/auth/me` 与匿名链路不受影响。

### B.4 剩余工作与风险

- [ ] **注册 GitHub OAuth App**（需用户在 GitHub 操作）：Settings → Developer settings → OAuth Apps → New OAuth App；Homepage URL `http://localhost:3000`、Authorization callback URL `http://localhost:3000/api/auth/callback`；把 Client ID/Secret 填入 `.env.local` 后重启 dev server；
- [ ] 完整登录联调（真实 OAuth 流程端到端：登录 → 数据合并 → 多设备同步验证）；
- [ ] 安全备注：本地课设级 HMAC cookie（无过期/轮换），生产需换签名会话或正式认证中间件。

## 五、任务 C：用户画像（✅ 已完成 v1.2）

**目标**：训练行为自动沉淀画像数据，提供展示页。

### C.1 口径（已定）

| 指标 | 采用口径 | 状态 |
|---|---|---|
| `skill_matrix` | 按题目 `category` 维度掌握度 = 该类别通关题数 / 该类别题数 × 100，JSON `{"async": 25, ...}`（0-100） | ✅ 已实现 |
| `streak` | 连续自然日有会话更新（`sessions.updated_at` 覆盖天数，按 UTC 自然日），断更归零 | ✅ 已实现 |
| `total_completed` | round=4 会话数（复用存储过程 `update_user_profile`） | ✅ 已实现 |

### C.2 写入链路（✅ 已实现）

- `lib/repo/user.ts` `getOrCreateUser`：用户创建时**补建 `user_profiles` 行**（幂等 `ON CONFLICT (user_id) DO NOTHING`）；
- `lib/profile/aggregate.ts`：`computeSkillMatrix` / `computeStreak` / `refreshUserProfile` / `getProfileSnapshot`；
- `app/api/session/[problemId]/route.ts` PATCH：检测通关（`currentRound` 到达 4）→ `refreshUserProfile`（调存储过程算 total_completed + 应用层算 skill_matrix / streak 写回），失败仅记日志不阻塞响应。

### C.3 读取与展示（✅ 已实现）

- `GET /api/profile`：按 `x-fedrill-user-key` 解析用户（无头 401）→ 返回 `totalCompleted / skillMatrix / streak / recentSessions(5 条) / updatedAt`；skill_matrix 落库为空时用实时矩阵兜底（保证 4 类维度完整）；
- `/profile` 页面（`app/profile/page.tsx`）：指标卡（完成数 / 连续打卡 / 最近更新）+ 技能矩阵进度条（async / prototype / util / pattern 四类）+ 最近训练记录（题目链接 + 分类 + Round 状态）；
- 导航入口：题库列表页 header「我的画像」链接。

### C.4 依赖关系

- C 基于匿名用户实现；Phase 3（登录）完成后画像自动归属真实账号（数据合并时 user_profiles 一并迁移）。

### C.5 验证记录（已完成）

- [x] 空画像：`GET /api/profile` → 200，totalCompleted=0 / streak=0 / skillMatrix 4 类均 0 / 无记录
- [x] 通关 promise-all（async 类）→ totalCompleted=1 / streak=1 / skillMatrix.async=25（1/4）
- [x] 再通关 my-call（prototype 类）→ totalCompleted=2 / skillMatrix.prototype=25
- [x] 数据库核验：user_profiles 行自动创建、total_completed / streak / skill_matrix 落库正确
- [x] 无 `x-fedrill-user-key` → 401
- [x] `tsc --noEmit` 零错误；`vitest` 74/74 通过
- [x] 浏览器端到端：题库列表页导航入口 + /profile 页面（指标卡 / 技能矩阵 / 最近记录）渲染正常

## 六、实施顺序与里程碑

| Phase | 内容 | 状态 | 优先级 |
|---|---|---|---|
| **Phase 1** | 任务 A 题库迁移 | ✅ 已完成（2026-09-13） | 数据层地基 |
| **Phase 2** | 任务 C 用户画像 | ✅ 已完成（2026-09-14） | 次做 |
| **Phase 3** | 任务 B 用户登录 | 🔶 骨架完成（2026-09-15，待 OAuth App 联调） | 后做 |

每 Phase 交付即验证，改动同步进 `docs/` 与 Windows 端课程设计目录 SQL/文档。

## 七、验证方案

- **A**（已完成）：迁移脚本幂等（跑两遍 count 仍=15）；题库列表/详情端到端从 API 读取成功；
- **B**（骨架已验证）：`/api/auth/me` 未登录 `{authed:false}`；未配置 OAuth 时 `/api/auth/github` 503 提示；无凭据 /api/profile 401；伪造 cookie 安全降级；匿名链路回归 200；`tsc` 零错误、`vitest` 77/77（含 token 单测 3 例）。完整登录流（真实 OAuth）待 App 注册后联调；
- **C**（已完成）：通关到 round4 → total_completed+1、skill_matrix 按 category 更新、streak 连续/断更逻辑正确；`/profile` 页展示数据与 DB 一致。

## 八、风险与开放问题

- [x] `skill_matrix` 口径：**已定**——按 category（默认方案，v1.2 已实现）；tags 维度留作扩展
- [ ] GitHub OAuth App 注册（需用户在 GitHub 操作，回调 URL `http://localhost:3000/api/auth/callback`）；
- [x] 认证实现选型：**已定**——手写轻量 OAuth（零新依赖，Next 16 兼容无风险）；
- [x] ~~题库 fallback 策略~~：**已定**——DB 空/失败时回退静态 TS（API 层实现，页面无感知）；
- [x] **推送权限**：本机 SSH 账号 `lllxxxxxlll` 对 `dudu212/fedrill` 无 push 权限 → 已改走 **fork + PR 流程**（PR #2 已合并，PR #3 待 owner 合并）。

## 九、范围调整（2026-09-15）

- 「八股题 + SM-2 间隔重复（SRS）」从原 M4 推迟到 **M5 之后**（M4 实际交付为 PostgreSQL 会话持久化）。
- 决策留痕见 [ADR-013](decisions/013-postgres-over-supabase.md)。
- 影响：`srs_cards` 表已建未接线，维持现状；SRS 设计（SM-2 算法 + 八股题深挖）在 M5 三任务完成后单独立项。
