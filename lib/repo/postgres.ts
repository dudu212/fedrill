import pg from 'pg'
import type {
  SessionPatch,
  SessionRepo,
  SessionSnapshot,
} from './session-repo'
import type { Round } from '@/lib/types/problem'

/**
 * PostgresSessionRepo —— 服务端实现（Node 环境专用，不可用于浏览器）。
 *
 * 架构：客户端 HttpSessionRepo → /api/session/[problemId] → 本类 → PostgreSQL
 * 对应表：sessions（以 (user_id, problem_id) 唯一，upsert 语义）
 *
 * 字段映射差异（相对 LocalStorage 实现）：
 *  - Round 'completed' 落库为 4（DB CHECK 0-4），读回保持数字 4
 *  - createdAt / updatedAt：epoch ms ↔ timestamptz；updated_at 由 DB 触发器自动刷新
 *  - messages / lastTestResults 以 JSONB 存取
 */

// 连接池全局单例：每个 Node 进程只建一次
let _pool: pg.Pool | null = null

export function getPool(): pg.Pool {
  if (!_pool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL 未配置')
    }
    _pool = new pg.Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
    })
  }
  return _pool
}

/** Round → DB SMALLINT（'completed' 落库为 4，CHECK 只允许 0-4） */
function toDbRound(round: Round): number {
  return round === 'completed' ? 4 : round
}

interface SessionRow {
  problem_id: string
  code: string
  messages: unknown
  current_round: number
  hints_used: number
  tested_code_snapshot: string | null
  last_test_results: unknown
  created_at: Date
  updated_at: Date
}

function rowToSnapshot(row: SessionRow): SessionSnapshot {
  return {
    problemId: row.problem_id,
    code: row.code,
    messages: Array.isArray(row.messages)
      ? (row.messages as SessionSnapshot['messages'])
      : [],
    currentRound: Number(row.current_round) as Round,
    hintsUsed: row.hints_used,
    testedCodeSnapshot: row.tested_code_snapshot,
    lastTestResults: (row.last_test_results as SessionSnapshot['lastTestResults']) ?? null,
    createdAt: row.created_at.getTime(),
    updatedAt: row.updated_at.getTime(),
  }
}

export class PostgresSessionRepo implements SessionRepo {
  private pool: pg.Pool
  private userId: string

  constructor(userId: string, pool?: pg.Pool) {
    this.pool = pool ?? getPool()
    this.userId = userId
  }

  async get(problemId: string): Promise<SessionSnapshot | null> {
    const { rows } = await this.pool.query<SessionRow>(
      `SELECT problem_id, code, messages, current_round, hints_used,
              tested_code_snapshot, last_test_results, created_at, updated_at
       FROM sessions
       WHERE user_id = $1 AND problem_id = $2`,
      [this.userId, problemId],
    )
    return rows[0] ? rowToSnapshot(rows[0]) : null
  }

  async save(problemId: string, patch: SessionPatch): Promise<void> {
    // 动态列 upsert：INSERT 携带 patch 提供的全部字段（首次插入即完整），
    // ON CONFLICT 时用 EXCLUDED 覆盖 patch 涉及的列（与 LocalStorage {...existing, ...patch} 语义一致）
    const cols: string[] = []
    const values: unknown[] = []
    const setClauses: string[] = []

    const add = (col: string, val: unknown): void => {
      cols.push(col)
      values.push(val)
      setClauses.push(`${col} = EXCLUDED.${col}`)
    }

    add('user_id', this.userId)
    add('problem_id', problemId)
    if (patch.code !== undefined) add('code', patch.code)
    if (patch.messages !== undefined) add('messages', JSON.stringify(patch.messages))
    if (patch.currentRound !== undefined) add('current_round', toDbRound(patch.currentRound))
    if (patch.hintsUsed !== undefined) add('hints_used', patch.hintsUsed)
    if (patch.testedCodeSnapshot !== undefined) {
      add('tested_code_snapshot', patch.testedCodeSnapshot)
    }
    if (patch.lastTestResults !== undefined) {
      add(
        'last_test_results',
        patch.lastTestResults === null
          ? null
          : JSON.stringify(patch.lastTestResults),
      )
    }

    // user_id / problem_id 是冲突键，不参与 UPDATE SET
    const conflictSet =
      setClauses.length > 2
        ? setClauses.slice(2).join(', ')
        : 'hints_used = sessions.hints_used' // 空 patch：no-op 避免语法错误

    await this.pool.query(
      `INSERT INTO sessions (${cols.join(', ')})
       VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})
       ON CONFLICT (user_id, problem_id)
       DO UPDATE SET ${conflictSet}`,
      values,
    )
  }

  async reset(problemId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM sessions WHERE user_id = $1 AND problem_id = $2`,
      [this.userId, problemId],
    )
  }
}
