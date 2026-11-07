import jwt from 'jsonwebtoken'
import { query } from '../config/database.js'

export async function authenticate(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ message: 'Authentication required' })
  try {
    if (!process.env.JWT_SECRET) {
      const error = new Error('Missing JWT_SECRET')
      error.code = 'AUTH_CONFIG_INVALID'
      return next(error)
    }
    req.user = jwt.verify(token, process.env.JWT_SECRET)
    const account = await query(
      'SELECT is_active,role,store_id FROM users WHERE id=$1',
      [req.user.sub]
    )
    if (!account.rowCount || !account.rows[0].is_active) {
      return res.status(401).json({ message: 'Account is inactive or no longer exists' })
    }

    req.user.role = account.rows[0].role
    req.user.storeId = account.rows[0].store_id

    if (req.user.storeId) {
      const store = await query('SELECT status FROM stores WHERE id=$1', [req.user.storeId])
      if (!store.rowCount || store.rows[0].status !== 'ACTIVE') {
        return res.status(403).json({ message: 'Store is not active' })
      }
    }
    next()
  } catch (error) {
    if (req.user) return next(error)
    res.status(401).json({ message: 'Invalid or expired token' })
  }
}

