import { validateDateRange } from '../middleware/validateRequest.js'
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
    if (!Number.isSafeInteger(page) || !Number.isSafeInteger(offset)) return res.status(400).json({ message: 'หมายเลขหน้าไม่ถูกต้อง' })
    const search = String(req.query.search || '').trim()
    const paymentMethod = String(req.query.paymentMethod || '').trim()
    const from = String(req.query.from || '').trim()
    const to = String(req.query.to || '').trim()
    validateDateRange(from, to)

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
         s.correction_status AS "correctionStatus",
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


/**
 * Daily sales history for one product in the authenticated owner's store.
 * Only active receipts contribute; sale_items snapshots keep historical prices.
 */
export async function getProductSalesHistory(req, res, next) {
  try {
    if (req.user.role !== 'OWNER' || !req.user.storeId) {
      return res.status(403).json({ message: 'เฉพาะเจ้าของร้านเท่านั้น' })
    }
    const storeId = Number(req.user.storeId)
    const productId = Number(req.query.productId)
    if (!Number.isSafeInteger(productId) || productId <= 0) {
      return res.status(400).json({ message: 'กรุณาเลือกสินค้า' })
    }
    const from = String(req.query.from || '').trim()
    const to = String(req.query.to || '').trim()
    if (!from || !to) return res.status(400).json({ message: 'กรุณาเลือกวันที่เริ่มต้นและสิ้นสุด' })
    validateDateRange(from, to)
    const product = await pool.query(
      'SELECT id,name,sku FROM products WHERE id=$1 AND store_id=$2',
      [productId, storeId]
    )
    if (!product.rowCount) return res.status(404).json({ message: 'ไม่พบสินค้านี้ในร้าน' })
    const history = await pool.query(`
      SELECT TO_CHAR(s.created_at AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD') AS day,
        COALESCE(SUM(si.quantity), 0)::int AS quantity,
        COALESCE(SUM(si.subtotal), 0) AS revenue,
        COUNT(DISTINCT s.id)::int AS orders
      FROM sale_items si
      JOIN sales s ON s.id=si.sale_id
      WHERE s.store_id=$1 AND si.product_id=$2 AND s.correction_status='ACTIVE'
        AND (s.created_at AT TIME ZONE 'Asia/Bangkok')::date >= $3::date
        AND (s.created_at AT TIME ZONE 'Asia/Bangkok')::date <= $4::date
      GROUP BY day ORDER BY day ASC
    `, [storeId, productId, from, to])
    const rows = history.rows.map(row => ({
      day: row.day, quantity: Number(row.quantity),
      revenue: Number(row.revenue), orders: Number(row.orders)
    }))
    res.json({
      product: product.rows[0],
      from, to, rows,
      summary: {
        quantity: rows.reduce((sum, row) => sum + row.quantity, 0),
        revenue: rows.reduce((sum, row) => sum + row.revenue, 0),
        orders: rows.reduce((sum, row) => sum + row.orders, 0)
      }
    })
  } catch (error) { next(error) }
}
