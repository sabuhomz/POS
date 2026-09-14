import { query } from '../config/database.js'

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden' })
    }
    next()
  }
}

export function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      if (req.user.role === 'ADMIN') return next()

      const result = await query(
        `SELECT 1 FROM user_permissions WHERE user_id=$1 AND permission_key=$2`,
        [req.user.sub, permission]
      )

      if (!result.rowCount) {
        return res.status(403).json({ message: 'Forbidden', permission })
      }

      next()
    } catch (error) {
      next(error)
    }
  }
}
