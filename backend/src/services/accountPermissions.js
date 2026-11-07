export function ownsStore(user) {
  return user.role === 'OWNER' && Boolean(user.storeId ?? user.store_id)
}

export async function accountPermissions(query, user) {
  if (user.role === 'ADMIN') return ['*']
  if (ownsStore(user)) {
    return (await query('SELECT permission_key FROM permissions ORDER BY permission_key')).rows.map(r => r.permission_key)
  }
  return (await query('SELECT permission_key FROM user_permissions WHERE user_id=$1', [user.id ?? user.sub])).rows.map(r => r.permission_key)
}

export function createPermissionGuard(query) {
  return permission => async (req, res, next) => {
    try {
      if (req.user.role === 'ADMIN') return next()
      const result = ownsStore(req.user)
        ? await query('SELECT 1 FROM permissions WHERE permission_key=$1', [permission])
        : await query('SELECT 1 FROM user_permissions WHERE user_id=$1 AND permission_key=$2', [req.user.sub, permission])
      if (!result.rowCount) return res.status(403).json({ message: 'Forbidden', permission })
      next()
    } catch (error) { next(error) }
  }
}
