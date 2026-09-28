# Turbopack 外部模块软链 · 上传产物时被丢导致 ERR_MODULE_NOT_FOUND

> 上线时 `/api/problems` 返回 0 字节,日志报 `Cannot find package 'pg-71df57fbe79e18ab'`。根因不在数据库,而在 Next 16 Turbopack 生产构建对「ESM 默认导入的 CJS 外部包」的处理方式 + 上传产物时软链丢失。

## 要点

**Turbopack 生产构建会把 `import pg from 'pg'` 这类「ESM 语法默认导入一个 CJS 包」编译成对「带内容哈希的外部模块名」的动态 `import()`:**

```
// 编译后 chunk 里(约等于):
await import("pg-71df57fbe79e18ab")   // externalImport,见 [turbopack]_runtime.js
```

为了让这个哈希名能在运行时解析,Turbopack 会在 **本地** `.next/node_modules/` 生成一个软链,把哈希名指回 pnpm store 里的真实包:

```
.next/node_modules/pg-71df57fbe79e18ab -> ../../node_modules/.pnpm/pg@8.23.0/node_modules/pg
```

上传 `.next/` 产物到服务器时(rsync 不保留软链 / scp 展平 / tar 不打 `-h`),这个**跨目录软链被丢**。服务器上 `import("pg-71df57fbe79e18ab")` 找不到落点 → `ERR_MODULE_NOT_FOUND` → 路由返回 0 字节。

注意区分另一条路径:很多外部包(如 `next/dist/...`、`node:stream`)走的是 `externalRequire`,它们有自包含的 `[externals]__*.js` shim 分块(`() => require("真实模块名")`),不受影响。**只有 `externalImport`(ESM `import()`)这一路需要软链。**

## 我在 FEDrill 哪里用了

- 触发点:[lib/repo/postgres.ts:1](../../lib/repo/postgres.ts) 的 `import pg from 'pg'`。
- 场景:本地 `pnpm build` → 上传 `.next/` → 服务器 `pnpm install --prod` → systemd 跑 `next start`。

## 修复(最小)

服务器上重建软链即可,复用 `--prod` 已装好的真实 pg 包:

```bash
cd ~/fedrill
mkdir -p .next/node_modules
ln -sfn ../../node_modules/.pnpm/pg@8.23.0/node_modules/pg .next/node_modules/pg-71df57fbe79e18ab
systemctl restart fedrill.service   # 需要的话
```

## 更稳的方案 / 通用规律

1. **哈希是 content-hash,脆**:改动了 `postgres.ts`(或任何影响该外部包引用方式的地方)重新构建后,哈希会变,软链名也要跟着变。别把「手工重建软链」当长期方案。
2. **`output: 'standalone'` 是正解**:让 Next 把依赖自包含进 `.next/standalone/`,摆脱「服务器 node_modules 布局必须和构建机一致」这一整类问题。
3. **上传产物要保软链**:rsync 用 `-a`(含 `-l` 保留软链),或 `-L` 跟随软链复制真实文件;tar 用 `-h`。裸 `scp` 单文件不保软链。
4. **排查路径**:`grep -rl "<hash>" .next/` 定位哈希散落在哪些文件 → `ls -la .next/node_modules/` 看软链在不在 → `readlink -f` 看软链目标是否真的落到包目录。

## 参考

- `.next/server/chunks/[turbopack]_runtime.js` 里的 `externalImport` / `externalRequire` 实现(哈希名就是喂给这两个函数的 `id`)。
- 构建产物的 `.nft.json`(Node File Trace)会同时列出软链 `node_modules/pg-<hash>` 和真实包文件 `node_modules/.pnpm/pg@8.23.0/...`,对读机制很有用。
