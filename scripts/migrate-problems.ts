/**
 * M5 · 题库全量迁移脚本：静态 TS（data/problems/*.ts）→ PostgreSQL problems 表。
 *
 * 幂等：ON CONFLICT (problem_id) DO UPDATE，可重复执行。
 * 用法：pnpm exec tsx scripts/migrate-problems.ts
 *
 * 背景：tsx 支持 tsconfig paths（@/ → ./），故脚本可直接 import data/problems。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { problems } from '../data/problems'
import { getPool } from '../lib/repo/postgres'

// Next 不会把 .env.local 加载进独立脚本进程，这里手动解析 DATABASE_URL
function loadEnvLocal(): void {
  if (process.env.DATABASE_URL) return
  try {
    const path = fileURLToPath(new URL('../.env.local', import.meta.url))
    const raw = readFileSync(path, 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.trim().match(/^([A-Za-z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
      }
    }
  } catch {
    console.warn('[migrate] 未找到 .env.local，请确保 DATABASE_URL 已通过环境变量提供')
  }
}

async function main(): Promise<void> {
  loadEnvLocal()
  const pool = getPool()

  let inserted = 0
  let updated = 0
  for (const p of problems) {
    const category = 'category' in p ? (p as { category: string }).category : null
    const { rows } = await pool.query<{ inserted: boolean }>(
      `INSERT INTO problems (problem_id, type, category, title, difficulty, tags, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (problem_id)
       DO UPDATE SET type = EXCLUDED.type,
                     category = EXCLUDED.category,
                     title = EXCLUDED.title,
                     difficulty = EXCLUDED.difficulty,
                     tags = EXCLUDED.tags,
                     data = EXCLUDED.data
       RETURNING (xmax = 0) AS inserted`,
      [
        p.id,
        p.type,
        category,
        p.title,
        p.difficulty,
        p.tags,
        JSON.stringify(p),
      ],
    )
    if (rows[0]?.inserted) inserted++
    else updated++
  }

  const { rows: countRow } = await pool.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM problems`,
  )
  console.log(
    `[migrate] 完成：新增 ${inserted} 道 · 更新 ${updated} 道 · problems 表现共 ${countRow[0]?.c ?? '?'} 道`,
  )
  await pool.end()
}

main().catch((e) => {
  console.error('[migrate] 失败：', e)
  process.exit(1)
})
