import { query } from '../config/database.js'

export async function getUserPermissions(req, res, next) {
  try {
    const result = await query(`SELECT permission_key FROM user_permissions WHERE user_id=$1 ORDER BY permission_key`, [req.params.userId])
    res.json({ permissions: result.rows.map(r => r.permission_key) })
  } catch (e) { next(e) }
}

export async function updateUserPermissions(req, res, next) {
  const client = await (await import('../config/database.js')).pool.connect()
  try {
    const permissions = Array.isArray(req.body.permissions) ? [...new Set(req.body.permissions)] : []
    await client.query('BEGIN')
    await client.query('DELETE FROM user_permissions WHERE user_id=$1', [req.params.userId])
    for (const permission of permissions) await client.query('INSERT INTO user_permissions(user_id, permission_key) VALUES($1,$2) ON CONFLICT DO NOTHING', [req.params.userId, permission])
    await client.query('COMMIT')
    res.json({ userId: req.params.userId, permissions })
  } catch (e) { await client.query('ROLLBACK'); next(e) } finally { client.release() }
}
