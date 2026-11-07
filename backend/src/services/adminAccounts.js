// Account and initial permissions must either both be saved or both be rolled back.
export async function createManagedAccount(pool, { username, passwordHash, role, storeId }) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    if (role === 'OWNER') {
      const store = await client.query('SELECT id, status FROM stores WHERE id=$1 FOR SHARE', [storeId])
      if (!store.rowCount || store.rows[0].status !== 'ACTIVE') {
        const error = new Error('Store not found or not active')
        error.status = 400
        throw error
      }
    }
    const result = await client.query(`
      INSERT INTO users(username,password_hash,role,store_id,is_active)
      VALUES($1,$2,$3,$4,true)
      RETURNING id, username, role, store_id, is_active, created_at`,
      [username, passwordHash, role, role === 'OWNER' ? storeId : null])
    const user = result.rows[0]
    if (role === 'OWNER') {
      // Explicit catalog entries, not ADMIN's global wildcard.
      await client.query(`
        INSERT INTO user_permissions(user_id, permission_key)
        SELECT $1, permission_key FROM permissions
        ON CONFLICT DO NOTHING`, [user.id])
    }
    await client.query('COMMIT')
    return user
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
