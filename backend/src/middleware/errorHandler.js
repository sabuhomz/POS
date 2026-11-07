export function errorHandler(err, _req, res, _next) {
  console.error(err)
  const databaseMessages = {
    '28P01': 'รหัสผ่าน PostgreSQL ไม่ถูกต้อง กรุณาตรวจสอบ DB_USER และ DB_PASSWORD ใน backend/.env',
    '28000': 'PostgreSQL ไม่อนุญาตการเชื่อมต่อ กรุณาตรวจสอบบัญชีและการตั้งค่าฐานข้อมูล',
    '3D000': 'ไม่พบฐานข้อมูล กรุณาตรวจสอบ DB_NAME ใน backend/.env',
    ECONNREFUSED: 'เชื่อมต่อ PostgreSQL ไม่ได้ กรุณาเปิดบริการและตรวจสอบ DB_HOST กับ DB_PORT',
    ETIMEDOUT: 'เชื่อมต่อ PostgreSQL หมดเวลา กรุณาตรวจสอบบริการฐานข้อมูล',
    '57P03': 'PostgreSQL ยังไม่พร้อมใช้งาน กรุณาลองอีกครั้ง',
    DB_CONFIG_MISSING_PASSWORD: 'กรุณาตั้งค่า DB_PASSWORD ใน backend/.env แล้วรีสตาร์ต Backend'
  }
  const message = databaseMessages[err.code]
  if (message) return res.status(503).json({ message })
  res.status(err.status || 500).json({
    message: err.status ? err.message : 'Internal server error'
  })
}
