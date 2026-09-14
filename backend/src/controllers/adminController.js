import bcrypt from 'bcryptjs'
import { pool, query } from '../config/database.js'

function validRole(role) {
  return ['ADMIN', 'OWNER'].includes(role)
}

export async function getAdminDashboard(req, res, next) {
  try {
    const result = await query(`
      SELECT
        s.id,
        s.name,
        s.status,
        s.created_at,
        s.updated_at,
        owner.id AS owner_id,
        owner.username AS owner_name
      FROM stores s
      LEFT JOIN LATERAL (
        SELECT u.id, u.username
        FROM users u
        WHERE u.store_id = s.id AND u.role = 'OWNER'
        ORDER BY u.id ASC
        LIMIT 1
      ) owner ON TRUE
      ORDER BY s.id DESC
    `)

    res.json({
      totalStores: result.rowCount,
      stores: result.rows
    })
  } catch (e) {
    next(e)
  }
}

export async function listStores(req, res, next) {
  try {
    const result = await query('SELECT id, name, status, created_at, updated_at FROM stores ORDER BY id DESC')
    res.json({ stores: result.rows })
  } catch (e) { next(e) }
}

export async function createStore(req, res, next) {
  try {
    const name = String(req.body.name || '').trim()
    if (!name) return res.status(400).json({ message: 'Store name is required' })
    const result = await query('INSERT INTO stores(name) VALUES($1) RETURNING id, name, status, created_at', [name])
    res.status(201).json({ store: result.rows[0] })
  } catch (e) { next(e) }
}

export async function listUsers(req, res, next) {
  try {
    const result = await query(`
      SELECT u.id, u.username, u.role, u.store_id, s.name AS store_name, u.is_active, u.created_at
      FROM users u LEFT JOIN stores s ON s.id=u.store_id
      WHERE u.role IN ('ADMIN','OWNER')
      ORDER BY u.id DESC`)
    res.json({ users: result.rows })
  } catch (e) { next(e) }
}

export async function createUser(req, res, next) {
  try {
    const username = String(req.body.username || '').trim()
    const password = String(req.body.password || '')
    const role = String(req.body.role || '').toUpperCase()
    const storeId = req.body.storeId ? Number(req.body.storeId) : null

    if (!username || !password || !validRole(role)) {
      return res.status(400).json({ message: 'username, password and role (ADMIN/OWNER) are required' })
    }
    if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' })
    if (role === 'OWNER' && !storeId) return res.status(400).json({ message: 'storeId is required for OWNER' })

    if (role === 'OWNER') {
      const store = await query('SELECT id, status FROM stores WHERE id=$1', [storeId])
      if (!store.rowCount || store.rows[0].status !== 'ACTIVE') {
        return res.status(400).json({ message: 'Store not found or not active' })
      }
    }

    const hash = await bcrypt.hash(password, 12)
    const result = await query(`
      INSERT INTO users(username,password_hash,role,store_id,is_active)
      VALUES($1,$2,$3,$4,true)
      RETURNING id, username, role, store_id, is_active, created_at`,
      [username, hash, role, role === 'OWNER' ? storeId : null])

    res.status(201).json({ user: result.rows[0] })
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ message: 'Username already exists' })
    next(e)
  }
}

export async function updateUserStatus(req, res, next) {
  try {
    const id = Number(req.params.id)
    const isActive = Boolean(req.body.isActive)
    if (id === Number(req.user.sub) && !isActive) return res.status(400).json({ message: 'You cannot deactivate your own account' })
    const result = await query('UPDATE users SET is_active=$1, updated_at=NOW() WHERE id=$2 AND role IN (\'ADMIN\',\'OWNER\') RETURNING id,username,role,store_id,is_active', [isActive,id])
    if (!result.rowCount) return res.status(404).json({ message: 'User not found' })
    res.json({ user: result.rows[0] })
  } catch (e) { next(e) }
}

export async function updateUserPermissions(req, res, next) {
  const client = await pool.connect()
  try {
    const userId = Number(req.params.id)
    const permissions = Array.isArray(req.body.permissions) ? [...new Set(req.body.permissions)] : []
    const valid = await client.query('SELECT permission_key FROM permissions WHERE permission_key = ANY($1::text[])', [permissions])
    const allowed = valid.rows.map(r => r.permission_key)

    await client.query('BEGIN')
    await client.query('DELETE FROM user_permissions WHERE user_id=$1', [userId])
    for (const key of allowed) await client.query('INSERT INTO user_permissions(user_id,permission_key) VALUES($1,$2) ON CONFLICT DO NOTHING', [userId,key])
    await client.query('COMMIT')
    res.json({ userId, permissions: allowed })
  } catch (e) {
    await client.query('ROLLBACK')
    next(e)
  } finally { client.release() }
}
