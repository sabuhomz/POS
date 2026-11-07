import { Router } from 'express'
import { pool } from '../config/database.js'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/permission.js'

const router = Router()
router.use(authenticate, requireRole('OWNER'))

const allowedKeys = [
  'product.view', 'inventory.view', 'inventory.restock.request',
  'sale.create', 'sale.view', 'report.view',
  'report.daily', 'report.trend', 'report.top-products', 'report.weekly',
  'promotion.view', 'inventory.restock.view'
]

router.get('/permissions/catalog', async (_req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT permission_key FROM permissions WHERE permission_key = ANY($1::varchar[]) ORDER BY permission_key',
      [allowedKeys]
    )
    res.json({ permissions: result.rows.map(row => row.permission_key) })
  } catch (error) { next(error) }
})

router.get('/permissions/employees', async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.username, u.first_name AS "firstName",
             u.last_name AS "lastName", u.is_active AS "isActive",
             COALESCE(array_agg(up.permission_key ORDER BY up.permission_key)
               FILTER (WHERE up.permission_key IS NOT NULL), ARRAY[]::varchar[]) AS permissions
      FROM users u
      LEFT JOIN user_permissions up ON up.user_id = u.id
      WHERE u.role = 'EMPLOYEE' AND u.store_id = $1
      GROUP BY u.id ORDER BY u.username
    `, [req.user.storeId])
    res.json({ employees: result.rows })
  } catch (error) { next(error) }
})

router.put('/permissions/employees/:id', async (req, res, next) => {
  const id = Number(req.params.id)
  const permissions = req.body?.permissions
  if (!Number.isSafeInteger(id) || id < 1 || !Array.isArray(permissions) ||
      permissions.length > allowedKeys.length ||
      permissions.some(key => typeof key !== 'string' || !allowedKeys.includes(key)) ||
      new Set(permissions).size !== permissions.length) {
    return res.status(400).json({ message: 'รายการสิทธิ์ไม่ถูกต้อง' })
  }
  let client
  try {
    client = await pool.connect()
    await client.query('BEGIN')
    const target = await client.query(
      "SELECT id FROM users WHERE id=$1 AND store_id=$2 AND role='EMPLOYEE' FOR UPDATE",
      [id, req.user.storeId]
    )
    if (!target.rowCount) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'ไม่พบพนักงานในร้านของคุณ' })
    }
    const catalog = await client.query(
      'SELECT permission_key FROM permissions WHERE permission_key = ANY($1::varchar[])',
      [permissions]
    )
    if (catalog.rowCount !== permissions.length) {
      await client.query('ROLLBACK')
      return res.status(400).json({ message: 'มีสิทธิ์ที่ไม่มีในระบบ' })
    }
    // Only replace the explicitly owner-manageable permissions. Preserve
    // any other existing keys instead of silently revoking unrelated access.
    await client.query(
      'DELETE FROM user_permissions WHERE user_id=$1 AND permission_key = ANY($2::varchar[])',
      [id, allowedKeys]
    )
    if (permissions.length) {
      await client.query(`
        INSERT INTO user_permissions (user_id, permission_key)
        SELECT $1, unnest($2::varchar[])
        ON CONFLICT DO NOTHING
      `, [id, permissions])
    }
    await client.query('COMMIT')
    res.json({ message: 'บันทึกสิทธิ์พนักงานแล้ว', employeeId: id, permissions })
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {})
    next(error)
  } finally {
    client?.release()
  }
})

export default router
