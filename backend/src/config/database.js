import './environment.js'
import pg from 'pg'
import { buildDatabaseConfig } from './databaseConfig.js'

const { Pool } = pg
export const pool = new Pool(buildDatabaseConfig(process.env))

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error)
})

export async function query(text, params) {
  return pool.query(text, params)
}

export async function testDatabaseConnection() {
  const result = await pool.query('SELECT NOW() AS now')
  return result.rows[0]
}
