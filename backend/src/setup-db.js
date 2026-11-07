import { readFile } from 'node:fs/promises'
import { pool } from './config/database.js'

let client
try {
  client = await pool.connect()
  await client.query('BEGIN')
  for (const name of ['schema.sql', 'promotion.sql']) {
    const sql = await readFile(new URL(`../database/${name}`, import.meta.url), 'utf8')
    // Both schema files run atomically; schema.sql also supports standalone psql.
    await client.query(sql.replace(/^BEGIN;\s*$/gm, '').replace(/^COMMIT;\s*$/gm, ''))
  }
  await client.query('COMMIT')
  console.log('Database schema ready. Existing accounts and store data are preserved.')
} catch (error) {
  await client?.query('ROLLBACK').catch(() => {})
  console.error('Database setup failed:', error.code || 'UNKNOWN', error.message)
  process.exitCode = 1
} finally {
  client?.release()
  await pool.end()
}
