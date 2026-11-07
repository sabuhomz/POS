import test from 'node:test'
import assert from 'node:assert/strict'
import { accountPermissions, createPermissionGuard } from '../src/services/accountPermissions.js'

test('existing owner with no stored grants receives full current catalog at login and me', async () => {
  const query = async sql => {
    assert.ok(sql.includes('FROM permissions '))
    return { rows: [{ permission_key: 'product.create' }, { permission_key: 'report.view' }] }
  }
  assert.deepEqual(await accountPermissions(query, { role: 'OWNER', store_id: 7 }), ['product.create', 'report.view'])
})
test('employee still receives only assigned permissions', async () => {
  const query = async (sql, args) => {
    assert.ok(sql.includes('FROM user_permissions'))
    assert.deepEqual(args, [24])
    return { rows: [{ permission_key: 'sale.create' }] }
  }
  assert.deepEqual(await accountPermissions(query, { id: 24, role: 'EMPLOYEE', store_id: 7 }), ['sale.create'])
})
test('owner middleware ignores obsolete grants but only accepts catalog permissions', async () => {
  const guard = createPermissionGuard(async (sql, args) => {
    assert.ok(sql.includes('FROM permissions '))
    return { rowCount: args[0] === 'product.create' ? 1 : 0 }
  })
  let passed = false, status
  const res = { status(n) { status = n; return this }, json() {} }
  const req = { user: { role: 'OWNER', storeId: 7, sub: '12' } }
  await guard('product.create')(req, res, () => { passed = true })
  assert.equal(passed, true)
  passed = false
  await guard('admin.manage')(req, res, () => { passed = true })
  assert.equal(passed, false)
  assert.equal(status, 403)
})
test('employee and owner without a store cannot use automatic store grants', async () => {
  for (const user of [{ role: 'EMPLOYEE', storeId: 7, sub: '24' }, { role: 'OWNER', storeId: null, sub: '25' }]) {
    let status
    const guard = createPermissionGuard(async (sql, args) => {
      assert.ok(sql.includes('FROM user_permissions'))
      assert.deepEqual(args, [user.sub, 'product.delete'])
      return { rowCount: 0 }
    })
    await guard('product.delete')({ user }, { status(n) { status = n; return this }, json() {} },
      () => assert.fail('must not grant permission'))
    assert.equal(status, 403)
  }
})
