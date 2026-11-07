import { query } from '../config/database.js'
import { createPermissionGuard } from '../services/accountPermissions.js'

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden' })
    }
    next()
  }
}

export const requirePermission = createPermissionGuard(query)
