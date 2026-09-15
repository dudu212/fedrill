# 013 · 会话持久化用裸 PostgreSQL 而非 Supabase

- 状态: Accepted
- 日期: 2026-09-15
- 关联模块: L4 · 数据层

## 背景

原计划（CLAUDE.md / README 技术栈）把 M4 定义为「Supabase + SRS」——会话持久化接 Supabase，八股题用 SM-2 间隔重复调度。M2a 上线后真正要落的是**会话持久化**（刷新保留 + 跨设备同步），选型时面临：

- Supabase 是 BaaS，自带 Auth / PostgREST 自动 REST API / 托管控制台；
- 项目叙事是「拒绝一把梭抽象」：M5 登录本就要手写 OAuth，再叠 Supabase Auth 会冗余；PostgREST 自动 API 也与我方手写 SSE 路由的风格相悖；
- 更关键：Supabase 把「云、表管理、Auth」整套细节藏进控制台，讲不清。

## 候选方案

| 方案 | 优点 | 缺点 |
| --- | --- | --- |
| Supabase（BaaS） | Auth / PostgREST / 托管控制台开箱即用 | 托管抽象 + 与手写 OAuth 冗余 + 供应商锁定 + 难讲清 |
| 裸 `pg` 驱动 + 手写 Repo + 手写 REST route | 最小依赖、Repository 接口不变、每条链路可讲 | 连接池 / schema / 迁移自己管，Auth 手写 |
| 继续 localStorage | 零成本零依赖 | 无法跨设备同步，M4 就为补这个 |

## 决定

**裸 PostgreSQL（`pg` 驱动）**：`PostgresSessionRepo`（服务端）+ `HttpSessionRepo`（客户端）走 `/api/session/[problemId]`。

- **`SessionRepo` 接口保持不变**——原设计保住的核心价值：换库对调用方零改动，`getSessionRepo()` 单例工厂是唯一切换点（`NEXT_PUBLIC_USE_POSTGRES=1` 走 PG，否则 localStorage 兜底）。
- **八股题 + SM-2 间隔重复（SRS）推迟到 M5 之后**：M4 只交付会话持久化，SRS 留待 M5 三任务（题库迁移 / 登录 / 画像）完成后单独立项。

## 结果与回顾

**已落地（2026-09-13）**：`sessions` 表 `UNIQUE(user_id, problem_id)` upsert；匿名用户 `anon-<uuid>@fedrill.local`；`seed-problem.ts` 幂等兜底。

**代价与后续**：

1. **Auth 手写压力后移到 M5**：Supabase Auth 本可白拿 GitHub OAuth + session，现在 M5 手写（见 [roadmap-m5](../roadmap-m5.md) §B）。
2. **蓝图文档残留 Supabase 假设**：`docs/技术方案.md`、`docs/需求方案.md` 仍按 Supabase 描述 M4，需后续同步。
