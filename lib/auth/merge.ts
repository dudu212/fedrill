import { getPool } from '@/lib/repo/postgres'

/**
 * AnonymousMerge —— 登录后匿名数据合并到真实账号（M5 Phase 3）。
 *
 * 策略（roadmap-m5.md §四 B.2）：
 *  1. sessions：匿名名下的会话迁到真实 user_id；真实已有同题目会话（UNIQUE 冲突）时
 *     以真实为准，丢弃匿名该题会话；
 *  2. user_profiles：真实用户已有画像 → 跳过（保留真实）；没有 → 把匿名画像改挂到真实 user_id；
 *  3. 删除匿名 users 行（ON DELETE CASCADE 清掉未迁移的残留）。
 *
 * 全部在事务中执行；同 github_id 重复登录（已无匿名）时按空操作安全返回。
 */
export async function mergeAnonymousData(
  anonUserId: string,
  realUserId: string,
): Promise<{ sessionsMoved: number; profilesMoved: number }> {
  if (anonUserId === realUserId) {
    return { sessionsMoved: 0, profilesMoved: 0 }
  }
  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 1) sessions：迁移无冲突的，冲突的丢弃（保留真实用户记录）
    const moved = await client.query(
      `UPDATE sessions s
       SET user_id = $2, updated_at = now()
       WHERE s.user_id = $1
         AND NOT EXISTS (
           SELECT 1 FROM sessions s2
           WHERE s2.user_id = $2 AND s2.problem_id = s.problem_id
         )`,
      [anonUserId, realUserId],
    )
    await client.query(
      `DELETE FROM sessions WHERE user_id = $1`,
      [anonUserId],
    )

    // 2) user_profiles：真实用户已有则丢弃匿名画像，否则改挂
    const prof = await client.query(
      `SELECT 1 FROM user_profiles WHERE user_id = $1`,
      [realUserId],
    )
    let profilesMoved = 0
    if (prof.rowCount === 0) {
      const movedProf = await client.query(
        `UPDATE user_profiles SET user_id = $2, updated_at = now()
         WHERE user_id = $1`,
        [anonUserId, realUserId],
      )
      profilesMoved = movedProf.rowCount ?? 0
    } else {
      await client.query(`DELETE FROM user_profiles WHERE user_id = $1`, [anonUserId])
    }

    // 3) 删除匿名 users 行（CASCADE 清残留）
    await client.query(`DELETE FROM users WHERE user_id = $1`, [anonUserId])

    await client.query('COMMIT')
    return { sessionsMoved: moved.rowCount ?? 0, profilesMoved }
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}
