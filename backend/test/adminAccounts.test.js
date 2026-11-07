import test from 'node:test'
import assert from 'node:assert/strict'
import { createManagedAccount } from '../src/services/adminAccounts.js'

function database({ active = true, failGrant = false } = {}) {
  const state = { users: [], permissions: [], released: false }
  const catalog = ['product.view', 'product.create', 'product.edit', 'inventory.edit', 'employee.create', 'sale.view', 'report.view']
  let pending
  const client = {
    async query(sql, args) {
      if (sql === 'BEGIN') { pending = { users: [], permissions: [] }; return {} }
      if (sql === 'COMMIT') { state.users = pending.users; state.permissions = pending.permissions; return {} }
      if (sql === 'ROLLBACK') { pending = undefined; return {} }
      if (sql.includes('FROM stores')) return { rowCount: 1, rows: [{ id: args[0], status: active ? 'ACTIVE' : 'SUSPENDED' }] }
      if (sql.includes('INSERT INTO users')) {
        const user = { id: 123, username: args[0], role: args[2], store_id: args[3] }
        pending.users.push(user)
        return { rows: [user] }
      }
      if (sql.includes('INSERT INTO user_permissions')) {
        if (failGrant) throw new Error('permission write failed')
        assert.match(sql, /SELECT \$1, permission_key FROM permissions/)
        pending.permissions = catalog.map(key => ({ userId: args[0], key }))
        return {}
      }
      throw new Error('Unexpected SQL: ' + sql)
    },
    release() { state.released = true }
  }
  return { state, catalog, pool: { async connect() { return client } } }
}
const owner = { username: 'shop-owner', passwordHash: 'hashed', role: 'OWNER', storeId: 7 }

test('new owner receives all catalog permissions and retains selected store', async () => {
  const db = database()
  const user = await createManagedAccount(db.pool, owner)
  assert.equal(user.store_id, 7)
  assert.deepEqual(db.state.permissions.map(p => p.key), db.catalog)
  assert.ok(db.state.permissions.every(p => p.userId === user.id && p.key !== '*'))
  assert.equal(db.state.released, true)
})
test('permission failure rolls back account creation', async () => {
  const db = database({ failGrant: true })
  await assert.rejects(createManagedAccount(db.pool, owner), /permission write failed/)
  assert.deepEqual(db.state.users, [])
  assert.deepEqual(db.state.permissions, [])
  assert.equal(db.state.released, true)
})
test('inactive store cannot receive a new owner', async () => {
  const db = database({ active: false })
  await assert.rejects(createManagedAccount(db.pool, owner), error => error.status === 400)
  assert.deepEqual(db.state.users, [])
  assert.equal(db.state.released, true)
})
test('admin creation keeps existing role behavior without store permissions', async () => {
  const db = database()
  const user = await createManagedAccount(db.pool, { ...owner, role: 'ADMIN' })
  assert.equal(user.store_id, null)
  assert.deepEqual(db.state.permissions, [])
  assert.equal(db.state.released, true)
})
