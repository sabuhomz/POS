import bcrypt from 'bcryptjs'
import { createManagedAccount } from '../services/adminAccounts.js'
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
      WHERE s.status <> 'DELETED'
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
    if (name.length > 150) return res.status(400).json({ message: 'ชื่อร้านต้องไม่เกิน 150 ตัวอักษร' })
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
    if (username.length > 100) return res.status(400).json({ message: 'Username ต้องไม่เกิน 100 ตัวอักษร' })
    if (role === 'OWNER' && (!Number.isSafeInteger(storeId) || storeId < 1)) return res.status(400).json({ message: 'storeId is required for OWNER' })

    const hash = await bcrypt.hash(password, 12)
    const user = await createManagedAccount(pool, {
      username, passwordHash: hash, role, storeId
    })

    res.status(201).json({ user })
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ message: 'Username already exists' })
    next(e)
  }
}

export async function updateUserStatus(req, res, next) {
  try {
    const id = Number(req.params.id)
    if (typeof req.body.isActive !== 'boolean') return res.status(400).json({ message: 'isActive ต้องเป็น true หรือ false' })
    const isActive = req.body.isActive
    if (id === Number(req.user.sub) && !isActive) return res.status(400).json({ message: 'You cannot deactivate your own account' })
    const result = await query('UPDATE users SET is_active=$1, updated_at=NOW() WHERE id=$2 AND role IN (\'ADMIN\',\'OWNER\') RETURNING id,username,role,store_id,is_active', [isActive,id])
    if (!result.rowCount) return res.status(404).json({ message: 'User not found' })
    res.json({ user: result.rows[0] })
  } catch (e) { next(e) }
}


