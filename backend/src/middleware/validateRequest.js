export function validateId(req, res, next, value) {
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) {
    return res.status(400).json({ message: 'รหัสรายการต้องเป็นจำนวนเต็มที่มากกว่า 0' })
  }
  next()
}

export function normalizeBody(req, res, next) {
  if (req.body !== undefined && (req.body === null || Array.isArray(req.body) || typeof req.body !== 'object')) {
    return res.status(400).json({ message: 'ข้อมูลที่ส่งมาต้องเป็น JSON object' })
  }
  // Multipart fields will be populated later by multer.
  if (!req.is('multipart/form-data') && req.body === undefined) req.body = {}
  next()
}

export function validateDateRange(from, to) {
  for (const value of [from, to]) {
    if (!value) continue
    const date = new Date(`${value}T00:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      const error = new Error('วันที่ต้องถูกต้องและอยู่ในรูปแบบ YYYY-MM-DD')
      error.status = 400
      throw error
    }
  }
  if (from && to && from > to) {
    const error = new Error('วันเริ่มต้นต้องไม่มากกว่าวันสิ้นสุด')
    error.status = 400
    throw error
  }
}
