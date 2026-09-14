import pg from 'pg'
import 'dotenv/config'


const { Pool } = pg

function getSslConfig() {
  if (String(process.env.DB_SSL).toLowerCase() !== 'true') return false
  return { rejectUnauthorized: false }
}

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: getSslConfig()
    }
  : {
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME || 'pos_database',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      ssl: getSslConfig(),
      max: Number(process.env.DB_POOL_MAX || 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    }

export const pool = new Pool(poolConfig)

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
