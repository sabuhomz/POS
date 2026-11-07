import { validateDateRange } from '../middleware/validateRequest.js'
import { query } from '../config/database.js'

export async function getCurrentShift(req, res, next) {
  try {
    const result = await query(
      `SELECT id, store_id AS "storeId", employee_username AS "employeeUsername",
              started_at AS "startedAt", ended_at AS "endedAt"
       FROM employee_shifts
       WHERE employee_id=$1 AND store_id=$2 AND ended_at IS NULL
       ORDER BY started_at DESC LIMIT 1`,
      [req.user.sub, req.user.storeId]
    )
    res.json({ shift: result.rows[0] || null })
  } catch (error) { next(error) }
}

export async function startShift(req, res, next) {
  try {
    if (!req.user.storeId) return res.status(400).json({ message: 'บัญชีพนักงานยังไม่ได้ผูกร้านค้า' })
    const employee = await query('SELECT username FROM users WHERE id=$1 AND is_active=TRUE AND role=\'EMPLOYEE\'', [req.user.sub])
    if (!employee.rowCount) return res.status(403).json({ message: 'เฉพาะบัญชีพนักงานเท่านั้นที่เริ่มกะได้' })

    const result = await query(
      `INSERT INTO employee_shifts (store_id, employee_id, employee_username)
       VALUES ($1,$2,$3)
       RETURNING id, store_id AS "storeId", employee_username AS "employeeUsername",
                 started_at AS "startedAt", ended_at AS "endedAt"`,
      [req.user.storeId, req.user.sub, employee.rows[0].username]
    )
    res.status(201).json({ shift: result.rows[0], message: 'เริ่มกะแล้ว' })
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'มีกะที่ยังไม่จบอยู่ กรุณาจบกะเดิมก่อน' })
    next(error)
  }
}

export async function endShift(req, res, next) {
  try {
    const result = await query(
      `UPDATE employee_shifts SET ended_at=NOW()
       WHERE employee_id=$1 AND store_id=$2 AND ended_at IS NULL
       RETURNING id, store_id AS "storeId", employee_username AS "employeeUsername",
                 started_at AS "startedAt", ended_at AS "endedAt"`,
      [req.user.sub, req.user.storeId]
    )
    if (!result.rowCount) return res.status(404).json({ message: 'ไม่พบกะที่กำลังเปิดอยู่' })
    res.json({ shift: result.rows[0], message: 'จบกะแล้ว' })
  } catch (error) { next(error) }
}

export async function listStoreShifts(req, res, next) {
  try {
    const storeId = Number(req.user.storeId)
    if (!Number.isInteger(storeId) || storeId <= 0) return res.status(400).json({ message: 'ไม่พบร้านค้า' })
    const from = String(req.query.from || '').trim()
    const to = String(req.query.to || '').trim()
    validateDateRange(from, to)
    const where = ['sh.store_id=$1']
    const params = [storeId]
    let index = 2
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
      where.push(`sh.started_at >= $${index}::date`)
      params.push(from)
      index += 1
    }
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      where.push(`sh.started_at < ($${index}::date + INTERVAL '1 day')`)
      params.push(to)
      index += 1
    }

    const result = await query(
      `SELECT sh.id, sh.employee_id AS "employeeId",
              sh.employee_username AS "employeeUsername",
              sh.started_at AS "startedAt", sh.ended_at AS "endedAt",
              sales.order_count AS "orderCount", sales.total_sales AS "totalSales"
       FROM employee_shifts sh
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS order_count, COALESCE(SUM(s.total),0) AS total_sales
         FROM sales s
         WHERE s.store_id=sh.store_id
           AND s.correction_status='ACTIVE'
           AND s.employee_id=sh.employee_id
           AND s.created_at >= sh.started_at
           AND (sh.ended_at IS NULL OR s.created_at <= sh.ended_at)
       ) sales ON TRUE
       WHERE ${where.join(' AND ')}
       ORDER BY sh.started_at DESC
       LIMIT 300`,
      params
    )
    res.json({ shifts: result.rows.map((shift) => ({
      ...shift,
      orderCount: Number(shift.orderCount || 0),
      totalSales: Number(shift.totalSales || 0)
    })) })
  } catch (error) { next(error) }
}

