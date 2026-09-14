import { getPool } from '@/lib/repo/postgres'

/**
 * ProfileAggregate —— 用户画像聚合（M5 Phase 2）。
 *
 * 口径（roadmap-m5.md §五 C.1）：
 *  - skill_matrix：按题目 category 的掌握度 = 该类别通关题数 / 该类别题数 × 100
 *  - streak：连续自然日有会话更新（sessions.updated_at 覆盖的天数），断更归零
 *  - total_completed：current_round = 4 的会话数（复用存储过程 update_user_profile）
 *
 * 写入时机：通关（round 到达 4）时 refreshUserProfile 持久化 total_completed /
 * skill_matrix / streak；读取时 streak 实时重算（sessions 才是权威）。
 */

export interface RecentSession {
  problemId: string
  title: string | null
  category: string | null
  round: number
  updatedAt: string
}

export interface ProfileSnapshot {
  totalCompleted: number
  skillMatrix: Record<string, number>
  streak: number
  recentSessions: RecentSession[]
  updatedAt: string | null
}

/** 掌握度：该 category 通关数 / 该 category 题目总数 × 100（0-100） */
export async function computeSkillMatrix(
  userId: string,
): Promise<Record<string, number>> {
  const { rows } = await getPool().query<{
    category: string | null
    completed: string
    total: string
  }>(
    `SELECT p.category,
            COUNT(*) FILTER (WHERE s.current_round = 4)::text AS completed,
            COUNT(*)::text AS total
     FROM problems p
     LEFT JOIN sessions s ON s.problem_id = p.problem_id AND s.user_id = $1
     GROUP BY p.category`,
    [userId],
  )
  const matrix: Record<string, number> = {}
  for (const r of rows) {
    const cat = r.category ?? 'util'
    const total = Number(r.total)
    const completed = Number(r.completed)
    matrix[cat] = total > 0 ? Math.round((completed / total) * 100) : 0
  }
  return matrix
}

/** 连续自然日（有会话更新的天数，按 UTC 自然日计），断更归零 */
export async function computeStreak(userId: string): Promise<number> {
  const { rows } = await getPool().query<{ d: string }>(
    `SELECT DISTINCT (updated_at AT TIME ZONE 'UTC')::date::text AS d
     FROM sessions
     WHERE user_id = $1
     ORDER BY d DESC`,
    [userId],
  )
  const days = new Set(rows.map((r) => r.d))
  const key = (d: Date): string => d.toISOString().slice(0, 10)

  // 从今天往回数（今天无记录则从昨天开始，允许"还没做今天的题"）
  let cursor = new Date()
  if (!days.has(key(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
    if (!days.has(key(cursor))) return 0
  }
  let streak = 0
  while (days.has(key(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

/** 通关（round=4）时全量刷新 user_profiles：total_completed + skill_matrix + streak */
export async function refreshUserProfile(userId: string): Promise<void> {
  const pool = getPool()
  // total_completed：复用 DB 存储过程（round=4 会话数）
  await pool.query(`SELECT update_user_profile($1)`, [userId])
  // skill_matrix / streak：应用层聚合
  const [matrix, streak] = await Promise.all([
    computeSkillMatrix(userId),
    computeStreak(userId),
  ])
  await pool.query(
    `UPDATE user_profiles
     SET skill_matrix = $2, streak = $3
     WHERE user_id = $1`,
    [userId, JSON.stringify(matrix), streak],
  )
}

/** 画像读取：落库值 + 实时 streak + 最近做题记录 */
export async function getProfileSnapshot(
  userId: string,
): Promise<ProfileSnapshot> {
  const pool = getPool()
  const [profRes, streak, matrix, recentRes] = await Promise.all([
    pool.query<{
      total_completed: number
      skill_matrix: unknown
      updated_at: Date | null
    }>(
      `SELECT total_completed, skill_matrix, updated_at
       FROM user_profiles
       WHERE user_id = $1`,
      [userId],
    ),
    computeStreak(userId),
    computeSkillMatrix(userId),
    pool.query<{
      problem_id: string
      title: string | null
      category: string | null
      current_round: number
      updated_at: Date
    }>(
      `SELECT s.problem_id, p.title, p.category, s.current_round, s.updated_at
       FROM sessions s
       LEFT JOIN problems p ON p.problem_id = s.problem_id
       WHERE s.user_id = $1
       ORDER BY s.updated_at DESC
       LIMIT 5`,
      [userId],
    ),
  ])

  const prof = profRes.rows[0]
  const storedMatrix = prof?.skill_matrix as Record<string, number> | undefined
  return {
    totalCompleted: prof?.total_completed ?? 0,
    // 落库为空对象（尚未通关）时用实时矩阵兜底，保证 4 类维度始终完整
    skillMatrix:
      storedMatrix && Object.keys(storedMatrix).length > 0 ? storedMatrix : matrix,
    streak,
    recentSessions: recentRes.rows.map((r) => ({
      problemId: r.problem_id,
      title: r.title,
      category: r.category,
      round: Number(r.current_round),
      updatedAt: r.updated_at.toISOString(),
    })),
    updatedAt: prof?.updated_at?.toISOString() ?? null,
  }
}
