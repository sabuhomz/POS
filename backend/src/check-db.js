try {
  const { pool, testDatabaseConnection } = await import('./config/database.js')
  try {
    await testDatabaseConnection()
    console.log('PostgreSQL connected successfully')
  } finally {
    await pool.end()
  }
} catch (error) {
  console.error('Database check failed:', error.code || 'UNKNOWN')
  console.error('ตรวจสอบ DB_HOST, DB_PORT, DB_NAME, DB_USER และ DB_PASSWORD ใน backend/.env')
  process.exitCode = 1
}
