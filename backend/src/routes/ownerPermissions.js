import { Router } from 'express'
import { pool } from '../config/database.js'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/permission.js'

const router = Router()
router.use(authenticate, requireRole('OWNER'))

// Only permissions exercised by the Python POS touchscreen app.
// Other existing permissions remain untouched when the owner saves.
const selectableKeys = [
  'sale.create',
  'inventory.restock.request',
  'inventory.restock.direct',
  'sale.view',
  'sale.correction.request',
  'sale.correction.direct'
]
// The desktop app must load /api/products on login even for staff who only
// use the history page. Grant product.view as a required internal dependency,
// not as a separate website-facing permission checkbox.
const managedKeys = ['product.view', ...selectableKeys]

router.get('/permissions/catalog', async (_req, res, next) => {
  try {
    // The new key may not exist in older databases until it is first granted.
    res.json({ permissions: selectableKeys })
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
      permissions.length > selectableKeys.length ||
      permissions.some(key => typeof key !== 'string' || !selectableKeys.includes(key)) ||
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
    // Bootstrap only the new POS-specific permission in existing databases.
    if (permissions.includes('inventory.restock.direct')) {
      await client.query(`INSERT INTO permissions (permission_key, description)
        VALUES ('inventory.restock.direct', 'Direct barcode restock in Python POS')
        ON CONFLICT (permission_key) DO NOTHING`)
    }
    await client.query(`INSERT INTO permissions(permission_key,description) VALUES
      ('sale.correction.request','Request receipt corrections'),
      ('sale.correction.direct','Direct receipt corrections')
      ON CONFLICT (permission_key) DO NOTHING`)
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
      [id, managedKeys]
    )
    const effectivePermissions = ['product.view', ...permissions]
    if (effectivePermissions.length) {
      await client.query(`
        INSERT INTO user_permissions (user_id, permission_key)
        SELECT $1, unnest($2::varchar[])
        ON CONFLICT DO NOTHING
      `, [id, effectivePermissions])
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
