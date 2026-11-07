export function buildDatabaseConfig(env) {
  const ssl = String(env.DB_SSL).toLowerCase() === 'true'
    ? { rejectUnauthorized: false }
    : false
  const common = {
    ssl,
    max: Number(env.DB_POOL_MAX || 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  }
  if (env.DATABASE_URL) return { ...common, connectionString: env.DATABASE_URL }

  const password = env.DB_PASSWORD ?? env.PGPASSWORD
  if (typeof password !== 'string' || password.length === 0) {
    const error = new Error('กรุณาตั้งค่า DB_PASSWORD ใน backend/.env เป็นรหัสผ่าน PostgreSQL ของ DB_USER แล้วรีสตาร์ต Backend')
    error.code = 'DB_CONFIG_MISSING_PASSWORD'
    error.status = 503
    throw error
  }
  return {
    ...common,
    host: env.DB_HOST || '127.0.0.1',
    port: Number(env.DB_PORT || 5432),
    database: env.DB_NAME || 'pos_database',
    user: env.DB_USER || 'postgres',
    password
  }
}
