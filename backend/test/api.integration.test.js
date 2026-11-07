import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import bcrypt from 'bcryptjs'

// Exercise the actual Express routes/controllers and PostgreSQL SQL engine without
// requiring the developer's PostgreSQL service or touching their databases.
process.env.DB_PASSWORDLESS = 'true'
process.env.DB_HOST = '127.0.0.1'
process.env.JWT_SECRET = 'integration-test-only-secret'
delete process.env.DATABASE_URL

const db = new PGlite()
const { pool } = await import('../src/config/database.js')
const originalQuery = pool.query.bind(pool)
const originalConnect = pool.connect.bind(pool)
const query = async (sql, params) => {
  const result = await db.query(sql, params)
  return { ...result, rowCount: result.rowCount }
}
pool.query = query
pool.connect = async () => ({ query, release() {} })
const { app } = await import('../src/app.js')
const server = app.listen(0, '127.0.0.1')
await new Promise(resolve => server.once('listening', resolve))
const base = `http://127.0.0.1:${server.address().port}/api`

async function request(method, path, body, token, expected = 200) {
  const response = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  })
  const data = response.status === 204 ? null : await response.json()
  assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(data)}`)
  return data
}
async function setup() {
  for (const name of ['schema.sql', 'promotion.sql']) {
    await db.exec(await readFile(new URL(`../database/${name}`, import.meta.url), 'utf8'))
  }
}

await test('full API flow, invalid inputs, store isolation, and database failures', async t => {
  t.after(async () => {
    await new Promise(resolve => server.close(resolve))
    pool.query = originalQuery
    pool.connect = originalConnect
    await pool.end()
    await db.close()
  })
  await setup()
  const hash = await bcrypt.hash('TestPassword123', 4)
  await query("INSERT INTO users(username,password_hash,role) VALUES('admin',$1,'ADMIN')", [hash])
  let admin, owner, employee, store, product, promotion, employeeId

  await t.test('admin login, store, owner creation and automatic permissions', async () => {
    admin = (await request('POST', '/auth/login', { username: 'admin', password: 'TestPassword123' })).accessToken
    store = (await request('POST', '/admin/stores', { name: 'Integration shop' }, admin, 201)).store
    await request('POST', '/admin/users', { username: 'owner', password: 'TestPassword123', role: 'OWNER', storeId: store.id }, admin, 201)
    owner = (await request('POST', '/auth/login', { username: 'owner', password: 'TestPassword123' })).accessToken
    await request('GET', '/auth/me', undefined, owner)
    await request('GET', '/admin/dashboard', undefined, admin)
    await request('GET', '/admin/users', undefined, admin)
    await request('POST', '/auth/login', { username: 'owner', password: 'wrong' }, undefined, 401)
    await request('GET', '/admin/users', undefined, owner, 403)
  })
  await t.test('product CRUD, duplicate SKU, invalid payload and missing detail route', async () => {
    product = await request('POST', '/products', { name: 'Milk', sku: 'MILK-1', price: 25, reorderPoint: 2 }, owner, 201)
    await request('GET', `/products/${product.id}`, undefined, owner)
    await request('GET', '/products', undefined, owner)
    await request('POST', '/products', { name: 'Milk', sku: 'MILK-1', price: 25 }, owner, 409)
    for (const body of [{}, { name: 'Milk', sku: 'NEW', price: -1 }, { name: 'Milk', sku: 'NEW', price: 'NaN' }]) {
      await request('POST', '/products', body, owner, 400)
    }
    await request('PUT', `/products/${product.id}`, { name: 'Milk edited', sku: 'MILK-1', price: 25, reorderPoint: 2 }, owner)
    await request('GET', '/products/not-a-number', undefined, owner, 400)
    await request('GET', '/products/99999999999999999999999', undefined, owner, 400)
    await request('POST', '/products', undefined, owner, 400)
  })
  await t.test('employee CRUD and status validation', async () => {
    const result = await request('POST', '/employees', { first_name: 'A', last_name: 'B', username: 'employee', password: 'TestPassword123' }, owner, 201)
    employeeId = result.employee.id
    employee = (await request('POST', '/auth/login', { username: 'employee', password: 'TestPassword123' })).accessToken
    await request('GET', '/employees', undefined, owner)
    await request('PUT', `/employees/${employeeId}`, { first_name: 'Updated' }, owner)
    await request('PATCH', `/employees/${employeeId}/status`, { is_active: 'false' }, owner, 400)
  })
  await t.test('stock, promotions including blank optional rules, and reports', async () => {
    await request('POST', '/restock/owner/add', { product_id: product.id, barcodes: ['BC-001', 'BC-002'] }, owner, 201)
    await request('POST', '/restock/owner/add', { product_id: product.id, barcodes: ['BC-001'] }, owner, 409)
    const payload = { name: 'Milk offer', promotion_type: 'FIXED_DISCOUNT', products: [{ product_id: product.id }], rule: { discount_amount: 5, min_quantity: '', special_price: '' } }
    promotion = await request('POST', '/promotions', payload, owner, 201)
    await request('GET', '/promotions', undefined, owner)
    await request('GET', '/promotions/active', undefined, owner)
    await request('GET', `/promotions/${promotion.promotion_id}`, undefined, owner)
    await request('PUT', `/promotions/${promotion.promotion_id}`, payload, owner)
    await request('POST', '/promotions', { ...payload, products: [null] }, owner, 400)
    await request('POST', '/promotions', { ...payload, products: [{ product_id: 999999 }] }, owner, 400)
    await request('POST', '/promotions', { ...payload, products: [...payload.products, ...payload.products] }, owner, 400)
    await request('POST', '/promotions', { ...payload, start_at: 'invalid' }, owner, 400)
    await request('GET', '/owner/dashboard', undefined, owner)
    await request('GET', '/owner/slow-moving-inventory', undefined, owner)
    await request('GET', '/owner/sales-history', undefined, owner)
    await request('GET', '/owner/shifts', undefined, owner)
    await request('GET', '/owner/sales-history?from=2026-02-30', undefined, owner, 400)
    await request('GET', '/owner/shifts?from=bad-date', undefined, owner, 400)
  })
  await t.test('employee restock approval, shift and actual sale', async () => {
    await query("INSERT INTO user_permissions SELECT $1, permission_key FROM permissions WHERE permission_key IN ('sale.create','inventory.restock.request')", [employeeId])
    const restock = await request('POST', '/restock/requests', { product_id: product.id, barcodes: ['BC-003'] }, employee, 201)
    await request('GET', '/restock/requests', undefined, owner)
    await request('PATCH', `/restock/requests/${restock.request.id}/approve`, {}, owner)
    await request('POST', '/shifts/start', {}, employee, 201)
    await request('GET', '/shifts/current', undefined, employee)
    await request('GET', '/sales/barcode/BC-001', undefined, employee)
    await request('POST', '/sales', { barcodes: ['BC-001'], paymentMethod: 'QR', paymentConfirmed: true }, employee, 201)
    await request('POST', '/sales', { barcodes: ['BC-001'], paymentMethod: 'QR', paymentConfirmed: true }, employee, 409)
    await request('POST', '/shifts/end', {}, employee)
    await request('GET', '/owner/sales-history', undefined, owner)
    await request('GET', '/owner/shifts', undefined, owner)
  })
  await t.test('other store remains inaccessible and existing owners need no saved grants', async () => {
    const other = (await query("INSERT INTO stores(name) VALUES('other') RETURNING id")).rows[0]
    const otherUser = (await query("INSERT INTO users(username,password_hash,role,store_id) VALUES('other',$1,'OWNER',$2) RETURNING id", [hash, other.id])).rows[0]
    const otherToken = (await request('POST', '/auth/login', { username: 'other', password: 'TestPassword123' })).accessToken
    await request('GET', `/products/${product.id}`, undefined, otherToken, 404)
    await request('DELETE', `/products/${product.id}`, undefined, otherToken, 404)
    const me = await request('GET', '/auth/me', undefined, otherToken)
    assert.ok(me.user.permissions.includes('product.delete'))
    assert.equal((await query('SELECT * FROM user_permissions WHERE user_id=$1', [otherUser.id])).rowCount, 0)
  })
  await t.test('store deletion request, approval and restore', async () => {
    const deletion = await request('POST', '/stores/delete-requests', { reason: 'Testing recovery' }, owner, 201)
    await request('GET', '/admin/store-delete-requests', undefined, admin)
    await request('PATCH', `/admin/store-delete-requests/${deletion.request.id}`, { decision: 'APPROVED' }, admin)
    await request('POST', `/admin/stores/${store.id}/restore`, {}, admin)
    await request('GET', '/owner/dashboard', undefined, owner)
  })
  await t.test('configuration and database failures preserve actionable response', async () => {
    delete process.env.JWT_SECRET
    await request('POST', '/auth/login', { username: 'owner', password: 'TestPassword123' }, undefined, 503)
    process.env.JWT_SECRET = 'integration-test-only-secret'
    const normal = pool.query
    pool.query = async () => { throw Object.assign(new Error('private connection details'), { code: 'ECONNREFUSED' }) }
    const response = await request('GET', '/products', undefined, owner, 503)
    assert.equal(response.code, 'DB_UNAVAILABLE')
    assert.ok(!JSON.stringify(response).includes('private connection details'))
    pool.query = normal
    await db.exec('ALTER TABLE users RENAME COLUMN recovery_email TO missing_recovery_email')
    const schemaError = await request('GET', '/auth/recovery-email', undefined, owner, 503)
    assert.equal(schemaError.code, 'DB_SCHEMA_OUTDATED')
    await db.exec('ALTER TABLE users RENAME COLUMN missing_recovery_email TO recovery_email')
  })
  await t.test('pool acquisition failure is handled without a second rollback error', async () => {
    const connect = pool.connect
    pool.connect = async () => { throw Object.assign(new Error('private connection'), { code: 'ECONNRESET' }) }
    try {
      const response = await request('POST', '/restock/owner/add', { product_id: product.id, barcodes: ['FAIL'] }, owner, 503)
      assert.equal(response.code, 'DB_UNAVAILABLE')
    } finally { pool.connect = connect }
  })
  await t.test('malformed JSON, unknown endpoint and bad upload', async () => {
    const response = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad-json' })
    assert.equal(response.status, 400)
    assert.equal((await response.json()).code, 'INVALID_JSON')
    await request('GET', '/not-an-endpoint', undefined, owner, 404)
    const form = new FormData()
    form.append('image', new Blob(['bad'], { type: 'text/plain' }), 'test.txt')
    const upload = await fetch(base + '/products', { method: 'POST', headers: { Authorization: `Bearer ${owner}` }, body: form })
    assert.equal(upload.status, 400)
  })
  await t.test('legacy promotion migration preserves edits on subsequent setup', async () => {
    await db.exec(`ALTER TABLE promotions ADD COLUMN discount_type text DEFAULT 'PERCENT';
      ALTER TABLE promotions ADD COLUMN discount_value numeric DEFAULT 10;
      ALTER TABLE promotions ADD COLUMN starts_at timestamptz DEFAULT '2026-01-01T00:00:00Z';
      ALTER TABLE promotions ADD COLUMN ends_at timestamptz DEFAULT '2026-12-31T00:00:00Z';
      ALTER TABLE promotions DROP COLUMN promotion_type;
      ALTER TABLE promotions DROP COLUMN start_at;
      ALTER TABLE promotions DROP COLUMN end_at;`)
    await setup()
    let result = (await query('SELECT promotion_type, start_at FROM promotions LIMIT 1')).rows[0]
    assert.equal(result.promotion_type, 'PERCENT_DISCOUNT')
    assert.equal(new Date(result.start_at).toISOString(), '2026-01-01T00:00:00.000Z')
    await query("UPDATE promotions SET promotion_type='FIXED_DISCOUNT', start_at='2026-06-01', end_at=NULL")
    await setup()
    result = (await query('SELECT promotion_type, start_at, end_at FROM promotions LIMIT 1')).rows[0]
    assert.equal(result.promotion_type, 'FIXED_DISCOUNT')
    assert.equal(new Date(result.start_at).toISOString(), '2026-06-01T00:00:00.000Z')
    assert.equal(result.end_at, null)
  })
  await t.test('setup scripts can be rerun without losing data', async () => {
    await setup()
    await request('GET', '/owner/dashboard', undefined, owner)
    assert.ok((await query('SELECT * FROM users')).rowCount >= 4)
    assert.equal((await query('SELECT * FROM sales')).rowCount, 1)
  })
})
