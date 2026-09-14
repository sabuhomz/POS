import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { query } from '../config/database.js'

export async function login(req, res, next) {
  try {
    const username = String(req.body.username || '').trim()
    const password = String(req.body.password || '')
    if (!username || !password) return res.status(400).json({ message: 'Username and password are required' })

    const result = await query(`SELECT id, username, password_hash, role, store_id, is_active FROM users WHERE username=$1 LIMIT 1`, [username])
    const user = result.rows[0]
    if (!user || !user.is_active || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: 'Invalid username or password' })
    }
    if (user.role === 'OWNER') {
      const store = await query('SELECT status FROM stores WHERE id=$1', [user.store_id])
      if (!store.rowCount || store.rows[0].status !== 'ACTIVE') return res.status(403).json({ message: 'Store is not active' })
    }

    const permissions = user.role === 'ADMIN' ? ['*'] : (await query('SELECT permission_key FROM user_permissions WHERE user_id=$1', [user.id])).rows.map(r => r.permission_key)
    const payload = { sub: String(user.id), username: user.username, role: user.role, storeId: user.store_id, permissions }
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1h' })
    res.json({ accessToken, user: { id:user.id, username:user.username, role:user.role, storeId:user.store_id, permissions } })
  } catch (e) { next(e) }
}

export async function me(req, res, next) {
  try {
    const result = await query('SELECT id,username,role,store_id,is_active FROM users WHERE id=$1', [req.user.sub])
    if (!result.rowCount || !result.rows[0].is_active) return res.status(401).json({ message:'User inactive or not found' })
    const u=result.rows[0]
    const permissions=u.role==='ADMIN'?['*']:(await query('SELECT permission_key FROM user_permissions WHERE user_id=$1',[u.id])).rows.map(r=>r.permission_key)
    res.json({user:{id:u.id,username:u.username,role:u.role,storeId:u.store_id,permissions}})
  } catch(e){next(e)}
}
