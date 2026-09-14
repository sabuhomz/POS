import { pool } from '../config/database.js'

export async function getSalesHistory(req, res, next) {
  try {
    const storeId = Number(req.user.storeId)

    if (!Number.isInteger(storeId) || storeId <= 0) {
      return res.status(400).json({ message: 'Invalid store' })
    }

    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1)
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100)
    const offset = (page - 1) * limit
    const search = String(req.query.search || '').trim()
    const paymentMethod = String(req.query.paymentMethod || '').trim()
    const from = String(req.query.from || '').trim()
    const to = String(req.query.to || '').trim()

    const where = ['s.store_id = $1']
    const params = [storeId]
    let index = 2

    if (search) {
      where.push(`(
        s.receipt_number ILIKE $${index}
        OR COALESCE(u.username, '') ILIKE $${index}
        OR EXISTS (
          SELECT 1
          FROM sale_items sx
          WHERE sx.sale_id = s.id
            AND sx.product_name_snapshot ILIKE $${index}
        )
      )`)
      params.push(`%${search}%`)
      index += 1
    }

    if (paymentMethod) {
      where.push(`s.payment_method = $${index}`)
      params.push(paymentMethod)
      index += 1
    }

    if (from) {
      where.push(`s.created_at >= $${index}::date`)
      params.push(from)
      index += 1
    }

    if (to) {
      where.push(`s.created_at < ($${index}::date + INTERVAL '1 day')`)
      params.push(to)
      index += 1
    }

    const whereSql = where.join(' AND ')

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM sales s
       LEFT JOIN users u ON u.id = s.employee_id
       WHERE ${whereSql}`,
      params
    )

    const dataParams = [...params, limit, offset]
    const dataResult = await pool.query(
      `SELECT
         s.id,
         s.receipt_number AS "receiptNumber",
         s.subtotal,
         s.discount,
         s.tax,
         s.total,
         s.payment_method AS "paymentMethod",
         s.created_at AS "createdAt",
         u.username AS "employeeUsername",
         COALESCE(
           json_agg(
             json_build_object(
               'id', si.id,
               'productId', si.product_id,
               'productName', si.product_name_snapshot,
               'quantity', si.quantity,
               'unitPrice', si.unit_price,
               'discount', si.discount,
               'subtotal', si.subtotal
             ) ORDER BY si.id
           ) FILTER (WHERE si.id IS NOT NULL),
           '[]'::json
         ) AS items
       FROM sales s
       LEFT JOIN users u ON u.id = s.employee_id
       LEFT JOIN sale_items si ON si.sale_id = s.id
       WHERE ${whereSql}
       GROUP BY s.id, u.username
       ORDER BY s.created_at DESC, s.id DESC
       LIMIT $${index} OFFSET $${index + 1}`,
      dataParams
    )

    const total = countResult.rows[0]?.total || 0

    res.json({
      sales: dataResult.rows.map(row => ({
        ...row,
        subtotal: Number(row.subtotal || 0),
        discount: Number(row.discount || 0),
        tax: Number(row.tax || 0),
        total: Number(row.total || 0),
        items: (row.items || []).map(item => ({
          ...item,
          quantity: Number(item.quantity || 0),
          unitPrice: Number(item.unitPrice || 0),
          discount: Number(item.discount || 0),
          subtotal: Number(item.subtotal || 0)
        }))
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    next(error)
  }
}
