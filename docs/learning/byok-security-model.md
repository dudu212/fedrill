# 零信任 BYOK + CSP · Web 前端安全三重防线

> M2a Phase 1c 上线时的一次深入实战。从"用户担心 API Key 被 log"这个信任问题出发,顺藤摸到 CORS / XSS / CSP 一整套 Web 安全模型。

## Situation · 触发这次讨论的场景

M2a Phase 1a 端到端跑通后,项目部署到 Vercel(`fedrill.vercel.app`),采用 **BYOK(Bring Your Own Key)** 模式 —— 访客用自己的 DeepSeek API Key,零成本给我运营。

初版架构:客户端把 Key 存 `localStorage`,fetch 时通过 `x-deepseek-api-key` header 送到 `/api/agent/step`(Vercel 服务端),服务端再转发给 DeepSeek。

**用户提出的信任问题**:

> "API Key 不应该上传任何第三方网站,你作为开发者也不例外 —— 你说不 log,我怎么知道?"

这不是杞人忧天,而是**安全意识用户的合理担忧**。回答这个问题需要区分**"用户直觉上认为服务端更安全"**和**"BYOK 场景下服务端到底更安全还是更不安全"**。

## Task · 要解决 3 个层面的问题

1. **信任模型**:BYOK 场景下,Key 通过任何第三方服务器都存在信任要求;能否**从架构上消除这层信任要求**?
2. **实证性**:如果消除服务端环节,浏览器直连 LLM 提供商可行吗?**CORS 允许吗**?
3. **深度防御**:即便消除了服务端泄漏路径,浏览器端(XSS / 恶意扩展 / DOM 攻击)依然是攻击面。如何**分层防御**?

## Action · 做了什么

### 行动 1 · 澄清 BYOK 信任模型的 3 层严格程度

| 严格程度 | 定义 | 需要什么架构 |
|---|---|---|
| **弱**:key 不落库、不入日志 | 云服务标配 | 服务端承诺(用户不能独立验证) |
| **中**:key 只在 client-side,server 从不 touch | 需要浏览器直接调 LLM API | Client-direct(CORS 通才行) |
| **强**:key 永不离开本地设备,全离线 | 用户自建 | Fork + 本地跑 |

FEDrill 原本停在"弱"层。目标是升级到"中"层。

### 行动 2 · 实测 DeepSeek CORS 是否允许浏览器直连

在 `fedrill.vercel.app` 的浏览器 Console 里跑:

```js
fetch('https://api.deepseek.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer sk-真实key',
  },
  body: JSON.stringify({
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: 'ping' }],
    max_tokens: 5,
  }),
}).then(async r => {
  console.log('STATUS', r.status)
  console.log('BODY', await r.text())
})
```

**结果**:`STATUS 200`,拿到正常 chat completion 响应。**DeepSeek 允许浏览器 CORS 直调** ✓

多数 LLM 提供商(OpenAI / Anthropic)禁 CORS 强制走后端集成。DeepSeek 相对宽松,这给了架构简化的可能。

### 行动 3 · 重构为 Client-Direct 架构

改动集中在 [`lib/agent/loop.ts`](../../lib/agent/loop.ts) 的 `fetchAgentStep` 函数:

```ts
async function* fetchAgentStep(opts) {
  const apiKey = getApiKey()

  // BYOK · 客户端有 key → 直接调 DeepSeek(浏览器 CORS 通)
  // 请求完全不经过我们的服务器,key 永不落地
  if (apiKey) {
    yield* deepseekStream({
      messages: opts.messages,
      tools: opts.tools,
      signal: opts.signal,
      apiKey,
    })
    return
  }

  // 回退 · 没 BYOK key(通常是本地 dev 用 .env.local)· 走服务端代理
  const res = await fetch(AGENT_STEP_ENDPOINT, { ... })
  // ...
}
```

关键点:**`deepseekStream` 是 AsyncGenerator**,可以直接 `yield*` 转发,零 SSE 编码/解码开销,还顺便省了一次网络跳。

### 行动 4 · 澄清 Client-direct 的安全性(反直觉)

用户跟进:"这样直连会不会有恶意网站攻击盗取 key 的情况?"

**逐个场景对比**:

| 攻击场景 | Proxy 能防吗 | Direct 能防吗 |
|---|---|---|
| evil.com 跨域读 fedrill 的 localStorage | ✅ 浏览器同源策略(与架构无关) | ✅ 同 |
| 假 DeepSeek(DNS 劫持) | ✅ HTTPS + 证书链 | ✅ 同 |
| MITM 中间人 | ✅ HTTPS 加密 | ✅ 同 |
| CSRF | ✅ DeepSeek 用 Bearer 不用 cookie · N/A | ✅ 同 |
| XSS on fedrill | ❌ 两种一样挂 | ❌ 同 |
| 恶意浏览器扩展 | ❌ 两种一样挂 | ❌ 同 |
| **~~作者恶意 log key~~** | ❌ **只有 proxy 有这个风险** | ✅ **消除** |
| **~~Vercel 平台被黑~~** | ❌ **只有 proxy 有这个风险** | ✅ **消除** |
| **~~服务端代码 bug 误 log~~** | ❌ **只有 proxy 有这个风险** | ✅ **消除** |

**关键洞察**:Direct 是 Proxy 的**严格子集** —— 所有 Proxy 能防的攻击 Direct 都能防,反过来 Direct 多消除了 3 类攻击面。

**为什么反直觉?**

> 用户直觉:"服务器像一堵墙,把我的 Key 挡在墙内,更安全。"
>
> 实际:服务器不是墙,而是**多一个可能出问题的房间**。BYOK 场景下,Key 不需要跨用户集中管理,少一环就是更安全。

### 行动 5 · 讨论 XSS 攻击面

Client-direct 消除了服务端泄漏路径,但**浏览器端**依然是攻击面:

- XSS on fedrill.vercel.app —— 攻击者 JS 读 localStorage 拿 Key
- 恶意浏览器扩展 —— 扩展可读 localStorage + 拦截 fetch

**XSS 3 种类型**:

| 类型 | 攻击路径 | 例子 |
|---|---|---|
| **Stored** | 恶意代码写进数据库,别人访问时被渲染 | 论坛留言植入 `<script>` |
| **Reflected** | 恶意代码通过 URL 参数反射 | `?q=<script>...</script>` 被拼进 HTML |
| **DOM** | 客户端 JS 处理不安全输入 | `location.hash` 直接进 `innerHTML` |

**4 层防御方案**:

1. **框架默认转义** —— React `{content}` 自动转义,免费防 90%
2. **CSP** —— HTTP header 强制白名单,浏览器兜底
3. **Sanitizer** —— 富文本内容过 DOMPurify 白名单化
4. **Trusted Types** —— Chrome 新 API,强制类型系统禁止字符串进 DOM sink

### 行动 6 · FEDrill 代码库 XSS 危险 API 扫描

```
$ grep -rn 'dangerouslySetInnerHTML\|innerHTML\|document\.write\|eval\('
No matches found
```

**零使用**。唯一的 `new Function` 在 `lib/sandbox/worker.ts`,是**设计意图**(用户代码沙箱),不是漏洞 —— Web Worker 是隔离 JS 上下文,无 DOM 访问权,拿不到主线程 localStorage。

### 行动 7 · 上线 CSP 深度防御

在 [`next.config.ts`](../../next.config.ts) 加 CSP response header:

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net;
style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;
connect-src 'self' https://api.deepseek.com https://cdn.jsdelivr.net;
worker-src 'self' blob: https://cdn.jsdelivr.net;
img-src 'self' data: blob:;
font-src 'self' data: https://cdn.jsdelivr.net;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
```

顺便加两条低门槛的安全头:

```
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

### 行动 8 · 踩坑 · Monaco CDN 依赖

首次上 CSP 后 Monaco 编辑器加载不出来。Console 报错:

> Loading the script 'https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs/loader.js' violates the following Content Security Policy directive: "script-src 'self' 'unsafe-inline' 'unsafe-eval'"

**根因**:`@monaco-editor/react` 是**懒加载包装器**,只 ~15KB,不打包 Monaco 本体(~3MB)。首次用户访问 `/problems/[id]` 时才从 jsdelivr CDN 拉 Monaco 主脚本。

**修法**:把 `https://cdn.jsdelivr.net` 加进 `script-src` / `style-src` / `connect-src` / `worker-src` / `font-src` 五个 directive。

**未来优化**(M2b):把 Monaco 复制到 `public/monaco-editor/`,`loader.config({ paths: { vs: '/monaco-editor/vs' } })` 指向本地,CSP 就能收回到只 `self`。

## Result · 三重防线的最终架构

FEDrill 现在的安全模型是**纵深防御**:

```
[层 1 · 架构消除]
零信任 BYOK · 浏览器直连 DeepSeek
Key 从头到尾不上服务端 · 消除"相信作者不 log"这层信任

[层 2 · 框架默认]
React 自动转义 · 全代码库零 dangerouslySetInnerHTML / innerHTML / eval
沙箱 new Function 隔离在 Web Worker,无 DOM 访问权

[层 3 · CSP 深度防御]
浏览器强制白名单:
  connect-src 只允许 self + api.deepseek.com + jsdelivr
  → 被注入的脚本想 exfiltrate key 到别的域被浏览器拦下
  frame-ancestors 'none' 防 clickjacking + 保护 localStorage
  worker-src 允许 Web Worker 沙箱 + Monaco 语法 worker
```

**要偷 Key 必须同时攻破**:
- 用户浏览器(装恶意扩展)—— 用户自身设备安全,产品层挡不住
- 或 FEDrill 代码出 XSS + CSP 有漏洞 —— 三重防线之外

## 知识点沉淀

### 知识点 1 · 什么是 CORS

Cross-Origin Resource Sharing · 浏览器的"跨域访问许可"机制。

- **同源** = 协议 + 域名 + 端口三者完全一致
- **同源策略**:浏览器默认不允许 JS 跨域读响应 —— 防恶意站点自动利用你的登录状态操作银行网站
- **CORS 白名单**:服务器通过 `Access-Control-Allow-Origin` header 显式允许某些域
- **服务器之间通信不受 CORS 限制** —— 只有浏览器发起的 fetch 才受管

### 知识点 2 · 为什么 LLM 提供商大多禁 CORS

- 不想被任意网页直接调 API(反滥用)
- 想强制走服务端集成(有速率限制、身份认证层)
- API key 一旦在浏览器 fetch,F12 就能看到(BYOK 场景反而 OK,因为是用户自己的 key)

DeepSeek 是少数允许 CORS 的 LLM 提供商之一,这直接决定了 FEDrill 能不能走 Client-direct。

### 知识点 3 · BYOK vs 传统认证的信任模型差异

传统"用户 - 密码"认证:密码 hash 后存服务端,服务端集中管理,**集中管理是安全需求**。

BYOK:每个用户用自己的第三方 API 凭据,**没有集中管理需求**,少经过一环就是安全净收益。

**不要把"传统场景的密码要存服务端"套到 BYOK 场景**。

### 知识点 4 · CSP 每个 directive 的作用

| Directive | 管什么 |
|---|---|
| `default-src` | 兜底 · 所有未显式声明的资源类型走这个 |
| `script-src` | `<script>` 标签、内联 script、eval |
| `style-src` | `<style>` 标签、内联 style |
| `connect-src` | fetch / XHR / WebSocket / EventSource / `navigator.sendBeacon` |
| `worker-src` | Web Worker / Service Worker |
| `img-src` | `<img>` / `<link rel="icon">` / CSS `background-image` |
| `font-src` | `@font-face` |
| `frame-ancestors` | 谁能 iframe 我(替代过时的 X-Frame-Options) |
| `base-uri` | `<base href>` 允许的值 |
| `form-action` | `<form action>` 允许的值 |

### 知识点 5 · CSP `unsafe-inline` / `unsafe-eval` 的取舍

- `'unsafe-inline'` —— 允许内联 script / style。**开发方便,但削弱 XSS 防御**
- `'unsafe-eval'` —— 允许 `eval` / `new Function`。**Next.js 开发模式 HMR 需要 · Monaco 也需要**

**production 收紧的方式**:用 `nonce` —— 服务端生成随机字符串,只有带这个 nonce 的内联 script 被允许。Next.js 官方支持,配置略复杂。M2b 收紧再上。

### 知识点 6 · 其他常用安全 header

| Header | 作用 |
|---|---|
| `X-Content-Type-Options: nosniff` | 防 MIME 类型嗅探 · 攻击者上传伪造扩展名文件被当 script 执行 |
| `Referrer-Policy: strict-origin-when-cross-origin` | 跨域跳出时不泄漏完整 URL |
| `Strict-Transport-Security` (HSTS) | 强制 HTTPS · Vercel 默认已设 |
| `X-Frame-Options: DENY` | 老式的防 iframe(现在 CSP frame-ancestors 更强大,可以只用 CSP 那条) |
| `Permissions-Policy` | 控制页面能用哪些浏览器 API(camera / mic / geolocation) |

## 面试问答备忘

**Q: 你的 BYOK 为什么选浏览器直连不选服务端代理?**

A: 反直觉但严格更安全。BYOK 场景下 Key 通过服务端多一层攻击面(作者作恶 / 平台被黑 / 代码 bug 意外泄漏),而所有 Direct 挡不住的攻击(XSS / 恶意扩展 / 同源策略绕过 / MITM)Proxy 也挡不住。我实测 DeepSeek 允许 CORS 后就走 Direct,严格上消除了 3 类攻击面,同时给用户一个"技术上不可能 log"的强承诺。

**Q: CORS 是什么?为什么大多数 LLM 不允许?**

A: CORS 是浏览器的跨域许可机制。同源策略是浏览器最底层的安全边界 —— evil.com 的 JS 不能自动访问你银行网站的 API。CORS 让服务器可以显式白名单允许某些域访问。LLM 提供商大多禁 CORS 是为了强制走服务端集成(便于速率限制 / 审计 / 反滥用)。DeepSeek 相对宽松允许了,这给我架构简化的机会。

**Q: XSS 防御你做了几层?**

A: 三层纵深。第一层框架默认 —— React 自动对 `{content}` 转义,全代码库零 `dangerouslySetInnerHTML` / `innerHTML` / `eval`。第二层 CSP —— HTTP header 强制浏览器执行白名单,`connect-src` 收紧到 self + api.deepseek.com + jsdelivr,任何被注入的脚本想 exfiltrate 到别的域直接被浏览器拦下。第三层 `frame-ancestors 'none'` 防 clickjacking + 保护 localStorage。加上 `X-Content-Type-Options: nosniff` 和 `Referrer-Policy` 两条辅助 header。

**Q: `'unsafe-inline'` `'unsafe-eval'` 不是弱化 CSP 了吗?**

A: 是有代价 —— Next.js 开发模式的 HMR 需要 eval,Monaco 编辑器和 Tailwind 的内联 style 需要 inline。production 收紧的方式是用 nonce:服务端每次生成随机字符串,只有带这个 nonce 的内联 script/style 被允许,注入的攻击脚本没 nonce 直接被拦。这是 M2b 的优化点,当前 MVP 承受这层削弱换开发便利性。

**Q: 你的沙箱不是也用了 `new Function` 吗,那 CSP 怎么允许?**

A: `new Function` 是设计意图 —— 用户在 Monaco 编辑器写代码,我要执行它评测。这个 `new Function` 在 Web Worker 里跑,Worker 是隔离的 JS 上下文,没 DOM 访问权、拿不到主线程 localStorage。**物理上无法逃逸出去偷 Key**。CSP 的 `unsafe-eval` 允许它跑,但攻击面是主线程的 API Key,Worker 里的 `new Function` 碰不到 —— 隔离级别管住了。

## 相关文件

- [`next.config.ts`](../../next.config.ts) —— CSP header 配置
- [`lib/agent/loop.ts`](../../lib/agent/loop.ts) —— `fetchAgentStep` 的 BYOK 直连分支
- [`app/_components/api-key-settings.tsx`](../../app/_components/api-key-settings.tsx) —— BYOK 设置模态框 + 披露文案
- [`lib/settings/api-key.ts`](../../lib/settings/api-key.ts) —— localStorage 存取
- [`lib/llm/deepseek.ts`](../../lib/llm/deepseek.ts) —— `deepseekStream` · AsyncGenerator 直接可被客户端 `yield*`
