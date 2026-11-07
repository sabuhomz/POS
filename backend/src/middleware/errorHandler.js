const databaseErrors = {
  '28P01': [503, 'DB_AUTH_FAILED', 'รหัสผ่าน PostgreSQL ไม่ถูกต้อง กรุณาตรวจสอบ DB_USER และ DB_PASSWORD ใน backend/.env'],
  '28000': [503, 'DB_AUTH_FAILED', 'PostgreSQL ไม่อนุญาตการเชื่อมต่อ กรุณาตรวจสอบบัญชีและ pg_hba.conf'],
  '3D000': [503, 'DB_NOT_FOUND', 'ไม่พบฐานข้อมูล กรุณาตรวจสอบ DB_NAME ใน backend/.env'],
  ECONNREFUSED: [503, 'DB_UNAVAILABLE', 'เชื่อมต่อ PostgreSQL ไม่ได้ กรุณาเปิดบริการและตรวจสอบ DB_HOST กับ DB_PORT'],
  ETIMEDOUT: [503, 'DB_UNAVAILABLE', 'เชื่อมต่อ PostgreSQL หมดเวลา กรุณาตรวจสอบบริการฐานข้อมูล'],
  ECONNRESET: [503, 'DB_UNAVAILABLE', 'การเชื่อมต่อ PostgreSQL ถูกตัด กรุณาลองอีกครั้ง'],
  '57P01': [503, 'DB_UNAVAILABLE', 'PostgreSQL กำลังหยุดหรือรีสตาร์ต กรุณาลองอีกครั้ง'],
  '57P03': [503, 'DB_UNAVAILABLE', 'PostgreSQL ยังไม่พร้อมใช้งาน กรุณาลองอีกครั้ง'],
  '53300': [503, 'DB_BUSY', 'ฐานข้อมูลมีการเชื่อมต่อเต็ม กรุณาลองอีกครั้ง'],
  '42P01': [503, 'DB_SCHEMA_OUTDATED', 'ตารางฐานข้อมูลยังไม่ครบ กรุณารัน npm run setup-db ในโฟลเดอร์ backend'],
  '42703': [503, 'DB_SCHEMA_OUTDATED', 'โครงสร้างฐานข้อมูลยังไม่ครบ กรุณารัน npm run setup-db ในโฟลเดอร์ backend'],
  '23505': [409, 'DUPLICATE_DATA', 'ข้อมูลนี้มีอยู่แล้ว กรุณาตรวจสอบชื่อผู้ใช้ รหัสสินค้า หรือบาร์โค้ดที่ซ้ำ'],
  '23503': [409, 'RELATED_DATA', 'รายการนี้ไม่มีอยู่แล้วหรือมีข้อมูลอื่นอ้างอิงอยู่ กรุณารีเฟรชแล้วตรวจสอบอีกครั้ง'],
  '23502': [400, 'REQUIRED_FIELD', 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน'],
  '23514': [400, 'INVALID_VALUE', 'ข้อมูลอยู่นอกเงื่อนไขที่อนุญาต กรุณาตรวจสอบจำนวน ราคา และวันที่'],
  '22P02': [400, 'INVALID_VALUE', 'รูปแบบข้อมูลไม่ถูกต้อง กรุณาตรวจสอบรหัสรายการและตัวเลข'],
  '22003': [400, 'VALUE_TOO_LARGE', 'ค่าตัวเลขสูงเกินขอบเขตที่ระบบรองรับ'],
  '22001': [400, 'VALUE_TOO_LONG', 'ข้อความหรือบาร์โค้ดยาวเกินขอบเขตที่ระบบรองรับ'],
  '22007': [400, 'INVALID_DATE', 'รูปแบบวันที่ไม่ถูกต้อง'],
  '22008': [400, 'INVALID_DATE', 'วันที่ไม่ถูกต้อง'],
  '40P01': [409, 'RETRY_TRANSACTION', 'ข้อมูลถูกแก้ไขพร้อมกัน กรุณาลองทำรายการใหม่'],
  '40001': [409, 'RETRY_TRANSACTION', 'ข้อมูลถูกแก้ไขพร้อมกัน กรุณาลองทำรายการใหม่'],
  DB_CONFIG_MISSING_PASSWORD: [503, 'DB_CONFIG_MISSING_PASSWORD', 'กรุณาตั้งค่า DB_PASSWORD หรือ DB_PASSWORDLESS ใน backend/.env แล้วรีสตาร์ต Backend'],
  AUTH_CONFIG_INVALID: [503, 'AUTH_CONFIG_INVALID', 'ระบบเข้าสู่ระบบยังตั้งค่าไม่ครบ กรุณาตรวจสอบ JWT_SECRET และ JWT_EXPIRES_IN ใน backend/.env']
}

export function errorHandler(err, _req, res, next) {
  if (res.headersSent) return next(err)
  console.error(err)
  let response = databaseErrors[err.code]
  if (!response && /SASL:.*password|password authentication|Connection terminated|connection timeout/i.test(err.message || '')) {
    response = [503, 'DB_AUTH_OR_CONNECTION_FAILED', 'เชื่อมต่อ PostgreSQL ไม่สำเร็จ ตรวจสอบรหัสผ่าน หรือ DB_PASSWORDLESS และกฎ trust ใน pg_hba.conf สำหรับ localhost']
  }
  if (!response && err.type === 'entity.parse.failed') response = [400, 'INVALID_JSON', 'รูปแบบ JSON ไม่ถูกต้อง']
  if (!response && (err.type === 'entity.too.large' || err.code === 'LIMIT_FILE_SIZE')) response = [413, 'UPLOAD_TOO_LARGE', 'ข้อมูลหรือรูปภาพมีขนาดใหญ่เกินไป รูปภาพต้องไม่เกิน 5 MB']
  if (!response && err.name === 'MulterError') response = [400, 'INVALID_UPLOAD', 'ข้อมูลอัปโหลดไม่ถูกต้อง กรุณาเลือกรูปภาพเพียงไฟล์เดียวในช่อง image']
  if (response) {
    const [status, code, message] = response
    return res.status(status).json({ message, code })
  }
  const explicitStatus = Number(err.status || err.statusCode)
  const status = Number.isInteger(explicitStatus) && explicitStatus >= 400 && explicitStatus < 600 ? explicitStatus : 500
  res.status(status).json({
    message: status < 500 || err.expose === true ? err.message : 'ไม่สามารถทำรายการได้ กรุณาลองใหม่หรือตรวจสอบบันทึก Backend',
    code: status < 500 ? 'INVALID_REQUEST' : 'UNEXPECTED_ERROR'
  })
}
