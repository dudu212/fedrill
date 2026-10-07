#!/usr/bin/env bash
# FEDrill 服务器一键部署脚本
#
# 用法（在服务器上、项目根目录执行，无需参数）：
#   ./scripts/deploy.sh
# 服务名如果不是 fedrill，用环境变量覆盖：
#   SERVICE_NAME=my-fedrill ./scripts/deploy.sh
#
# 流程：拉最新 → 装依赖 → 构建 → 灌题 → 重启 → 看状态
# 设计要点：
#   - 在服务器上直接 pnpm build，软链在本地生成，不会踩 Turbopack
#     「上传产物丢软链 → ERR_MODULE_NOT_FOUND」的坑（见 docs/learning/turbopack-external-module-symlink.md）
#   - pnpm install 装全量（含 devDeps），因为服务器上构建需要 tsx / next / typescript
#   - set -e：任一步失败立即停，不会带着坏构建去重启服务
set -euo pipefail

# 无论从哪里调用，都先切到仓库根目录
cd "$(dirname "$0")/.."

SERVICE_NAME="${SERVICE_NAME:-fedrill}"

echo "==> [1/5] 拉取最新代码（origin/main）"
git pull origin main

echo "==> [2/5] 安装依赖（含 devDeps）"
pnpm install

echo "==> [3/5] 构建（next build）"
pnpm build

echo "==> [4/5] 灌题（幂等 upsert，补齐新增题目）"
pnpm exec tsx scripts/migrate-problems.ts

echo "==> [5/5] 重启服务 ${SERVICE_NAME}"
sudo systemctl restart "${SERVICE_NAME}"

echo "✅ 部署完成，服务状态："
sudo systemctl status "${SERVICE_NAME}" --no-pager | head -n 8
