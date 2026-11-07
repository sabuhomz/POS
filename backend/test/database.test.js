import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDatabaseConfig } from '../src/config/databaseConfig.js'
import { errorHandler } from '../src/middleware/errorHandler.js'

test('missing PostgreSQL password fails before an authentication query', () => {
  for (const env of [{}, { DB_PASSWORD: '' }]) {
    assert.throws(() => buildDatabaseConfig(env),
      error => error.code === 'DB_CONFIG_MISSING_PASSWORD' && /DB_PASSWORD/.test(error.message))
  }
})
test('local credentials retain special characters and support libpq password', () => {
  const password = ' pass # with spaces '
  assert.equal(buildDatabaseConfig({ DB_PASSWORD: password }).password, password)
  assert.equal(buildDatabaseConfig({ PGPASSWORD: password }).password, password)
  assert.equal(buildDatabaseConfig({ DB_PASSWORD: password, DB_NAME: 'pos_db' }).database, 'pos_db')
})
test('DATABASE_URL does not require separate DB_PASSWORD', () => {
  const url = 'postgresql://user:password@localhost:5432/pos_db'
  assert.equal(buildDatabaseConfig({ DATABASE_URL: url }).connectionString, url)
})
test('database connection failures give actionable 503 without leaking secrets', () => {
  const original = console.error
  console.error = () => {}
  try {
    for (const code of ['28P01', '28000', '3D000', 'ECONNREFUSED', 'ETIMEDOUT', '57P03']) {
      let status, body
      const res = { status(value) { status = value; return this }, json(value) { body = value } }
      errorHandler(Object.assign(new Error('secret-password-and-sql'), { code }), {}, res, () => {})
      assert.equal(status, 503)
      assert.ok(body.message.length)
      assert.ok(!body.message.includes('secret-password-and-sql'))
    }
  } finally { console.error = original }
})
test('unexpected application errors remain 500 and explicit client errors keep status', () => {
  const original = console.error
  console.error = () => {}
  try {
    let status, body
    const res = { status(value) { status = value; return this }, json(value) { body = value } }
    errorHandler(new Error('private internals'), {}, res, () => {})
    assert.equal(status, 500)
    assert.equal(body.message, 'Internal server error')
    errorHandler(Object.assign(new Error('Invalid input'), { status: 400 }), {}, res, () => {})
    assert.equal(status, 400)
    assert.equal(body.message, 'Invalid input')
  } finally { console.error = original }
})
