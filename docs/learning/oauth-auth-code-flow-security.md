# OAuth 授权码机制与安全隔离（FEDrill 实现）

> 学习笔记 · 复习/面试话术底稿 · 代码指向以 `feat/auth`（M5 Phase 3）为准
> 关联决策：M5 Phase 3 选用**手写轻量 OAuth**（零新依赖，避开 NextAuth 对 Next 16 的兼容性风险）

## 一句话定位

**OAuth 让第三方应用（FEDrill）在拿不到用户密码的前提下，获得"以用户名义访问 GitHub 部分资源"的一次性许可**。GitHub 用的是**授权码模式（Authorization Code Flow）**：先给"一次性 code"，再由**应用服务器**用 code + Client Secret 换 token。

---

## 一、五个角色

| 角色 | 标准名 | 本项目里 |
|---|---|---|
| 用户 | Resource Owner | 访问者 |
| 应用 | Client | FEDrill（`client_id` = OAuth App 的 Client ID） |
| 授权服务器 | Authorization Server | `https://github.com/login/oauth` |
| 资源服务器 | Resource Server | `https://api.github.com` |
| 浏览器 | User Agent | 浏览器 |

---

## 二、授权码流程（7 步）

1. 用户点「GitHub 登录」→ 浏览器跳 GitHub authorize，携带 `client_id` / `redirect_uri` / `scope` / `state`
2. GitHub 显示授权页，用户确认（已授权过则自动通过）
3. GitHub 302 回 `redirect_uri?code=xxx&state=xxx`（**只带 code，不带 token**）
4. 应用服务器用 `code + client_secret` POST 到 token 端点换 `access_token`（**服务器到服务器，不经浏览器**）
5. 应用服务器用 token GET `/user` 拿 `id / login / email`
6. 应用按 `github_id` upsert 自己的 `users` 行
7. 应用签发**自己的登录 cookie**（HMAC）→ 完成登录；GitHub token 用完即弃

> 为什么"两步换证"（先 code 后 token）：浏览器环境是**暴露的**（URL、历史记录、抓包、页面 JS 都能看到）。直接回 token 会被泄露；code 一次性 + 短时 + 可撤销，泄露也无害。真正换到 token 的请求发生在**服务器之间**。

---

## 三、安全隔离点（复习重点：每道锁防什么、代码在哪）

### 1. 密码隔离：用户密码永不进入 FEDrill
- 用户只在 GitHub 输入密码，授权页由 GitHub 托管；FEDrill 从密码到 token 全程不接触密码。
- 落点：授权跳转在 `app/api/auth/github/route.ts:29`（`buildAuthorizeUrl`），凭据只含 `client_id`，无密码。

### 2. code 一次性、回调只拿 code
- 回调 URL 只携带 `code` + `state`（`app/api/auth/callback/route.ts:21-22`）；token 交换在服务端完成。
- 落点：`lib/auth/github.ts:48-74` `exchangeCodeForUser`。

### 3. client_secret 只在服务器
- Secret 只出现在服务器代码与 `.env.local`，**永不进浏览器、不进前端 bundle**。
- 落点：`lib/auth/github.ts:57-62`（body 里拼 `client_secret`）；读取在 `:59`。

### 4. token 不进浏览器
- `access_token` 只存在于服务器内存/请求中；浏览器最终拿到的只有**我们自己的 HMAC 登录 cookie**——即使前端被 XSS，也偷不到 GitHub token。
- 落点：`lib/auth/github.ts:76-83`（token 只用于服务器拉 /user）；登录态 cookie 见 §3.6。

### 5. state 防 CSRF（防"登录注入"）
- 威胁：攻击者伪造回调 URL 诱导用户访问，可让用户"登录进攻击者的账号"。
- 设计：发起登录时生成随机 state 写 httpOnly cookie；回调时必须与 cookie 一致才继续。
- 落点：发起 `app/api/auth/github/route.ts:28`（`randomState()`）+ `:34-38`（写 cookie）；校验 `app/api/auth/callback/route.ts:25-30`（`state !== storedState` → 400）。

### 6. redirect_uri 白名单
- GitHub 只允许回调到 App 注册时登记的 URL（本项目 `http://localhost:3000/api/auth/callback`），防止 code 被重定向到攻击者站点。
- 落点：`buildAuthorizeUrl` 用 `APP_BASE_URL` 拼 redirect_uri（`lib/auth/github.ts:41`），与 GitHub App 设置一致即通。

### 7. scope 最小权限
- 只申请 `read:user user:email`（只读资料），不申请 repo / write 权限。
- 落点：`lib/auth/github.ts:42`。

### 8. 我们自己的会话层（HMAC 登录态）
- 登录后签发 `token = <userId>.<HMAC-SHA256(userId)[:32]>`，写 httpOnly + sameSite=lax cookie；服务端 `timingSafeEqual` 恒定时间比较防时序攻击。
- 落点：签发 `lib/auth/session.ts:24-30`（`signToken`）；校验 `:32-46`（`verifyToken`）；secret 来源 `:16-22`（`GITHUB_CLIENT_SECRET ?? AUTH_SECRET`，缺 secret 抛错并在 `resolve.ts` 安全降级）。

### 9. 鉴权优先级：登录态优先，匿名兜底
- 有合法登录 cookie → 真实 userId；否则走匿名 `x-fedrill-user-key`（`getOrCreateUser` 幂等）。
- 落点：`lib/auth/resolve.ts:33-56`（`resolveUserId`）。

### 10. 匿名数据合并的事务隔离
- 登录成功后匿名会话/画像迁移到真实账号：sessions 冲突保留真实、画像缺失才改挂、删除匿名 users 行——**全部在一个事务里**，失败回滚。
- 落点：`lib/auth/merge.ts:14-70`（`mergeAnonymousData`，BEGIN `:24` / COMMIT `:62` / ROLLBACK `:65`）；触发点 `app/api/auth/callback/route.ts:37-47`。

---

## 四、代码索引速查

| 文件 | 职责 | 关键位置 |
|---|---|---|
| `lib/auth/github.ts` | 构造授权 URL、code 换 token、拉用户 | `buildAuthorizeUrl` L38-46；`exchangeCodeForUser` L48-101 |
| `lib/auth/session.ts` | HMAC 登录态 token、state 工具 | `signToken` L24-30；`verifyToken` L32-46；`authSecret` L16-22 |
| `lib/auth/resolve.ts` | 统一鉴权解析（cookie 优先/匿名兜底） | `resolveUserId` L33-56 |
| `lib/auth/merge.ts` | 匿名数据事务合并 | `mergeAnonymousData` L14-70 |
| `app/api/auth/github/route.ts` | 发起登录：302 + state cookie + 未配置 503 | L17-47 |
| `app/api/auth/callback/route.ts` | 回调：校验 state → 换证 → upsert → 合并 → 签发 cookie | L19-63 |
| `lib/repo/user.ts` | 匿名用户幂等解析 / GitHub 用户 upsert | `getOrCreateUser` L19；`upsertGithubUser` L50 |

环境变量：`GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `APP_BASE_URL`；网络受限环境（WSL 代理出网）加 `http_proxy/https_proxy` + `NODE_OPTIONS=--use-env-proxy`（Node 22 原生，零依赖，生产无代理则直连）。

---

## 五、复习速查（面试 Q&A）

- **Q：为什么不用 JWT / 直接用 GitHub token 当会话？** A：GitHub token 权限过大且不可由我们控制失效；JWT 无法在服务端主动吊销。课设用 HMAC cookie + `users` 表，登录态可随时删除（`logout`），简单可控（`lib/auth/session.ts:9-10` 有说明）。
- **Q：换证请求为什么在服务器做？** A：换 token 需要 `client_secret`，它只属于服务器；在浏览器换 = 把 secret 暴露给所有人。
- **Q：state 不校验会怎样？** A：攻击者可用自己的 code 伪造回调，把受害者账号"合并/绑定"到攻击者控制的 GitHub 账号（登录注入）。见 §3.5。
- **Q：为什么按 `github_id` 而非 email upsert？** A：GitHub id 稳定唯一且用户可改邮箱；email 可被改/重复。`github_id` UNIQUE 索引建表时已预留。

---

## 六、参考链接

- GitHub OAuth 官方文档：https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
- OAuth 2.0 授权码模式（RFC 6749 §4.1）：https://datatracker.ietf.org/doc/html/rfc6749#section-4.1
- Node 22 `--use-env-proxy`：https://nodejs.org/api/cli.html#--use-env-proxy
