import { query } from '../config/database.js'

const DAY_MS = 24 * 60 * 60 * 1000
const MAX_RANGE_MS = 365 * DAY_MS
const TZ = 'Asia/Bangkok'

function parseRange(input) {
  const from = input.from
  const to = input.to
  const validDate = value => typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) &&
    Number.isFinite(Date.parse(value))
  if (!validDate(from) || !validDate(to)) return null
  const start = Date.parse(from)
  const end = Date.parse(to)
  const now = Date.now()
  if (start > end || start < now - MAX_RANGE_MS - 5 * 60 * 1000 ||
      end > now + 5 * 60 * 1000 || end - start > MAX_RANGE_MS + 5 * 60 * 1000) return null
  return { start: new Date(start).toISOString(), end: new Date(end).toISOString() }
}

export async function getOwnerSalesAnalytics(req, res, next) {
  try {
    if (req.user.role !== 'OWNER' || !req.user.storeId) {
      return res.status(403).json({ message: 'เฉพาะเจ้าของร้านเท่านั้น' })
    }
    const range = parseRange(req.query)
    if (!range) {
      return res.status(400).json({ message: 'ช่วงวันที่ต้องอยู่ใน 365 วันย้อนหลัง และวันเริ่มต้องไม่เกินวันสิ้นสุด' })
    }
    const storeId = req.user.storeId
    const params = [storeId, range.start, range.end]
    const grain = req.query.grain === 'month' ? 'month' : 'day'
    const dateExpression = grain === 'month'
      ? `TO_CHAR(s.created_at AT TIME ZONE '${TZ}', 'YYYY-MM')`
      : `TO_CHAR(s.created_at AT TIME ZONE '${TZ}', 'YYYY-MM-DD')`

    const [overview, products, employees, timeline, inventory] = await Promise.all([
      query(`
        SELECT COUNT(*)::int AS orders, COALESCE(SUM(total),0) AS revenue,
          COALESCE(SUM(subtotal),0) AS subtotal,
          COALESCE(SUM(discount),0) AS discount
        FROM sales WHERE store_id=$1 AND correction_status='ACTIVE' AND created_at >= $2 AND created_at <= $3
      `, params),
      query(`
        SELECT si.product_id AS "productId", si.product_name_snapshot AS name,
          COALESCE(SUM(si.quantity),0)::int AS quantity,
          COALESCE(SUM(si.subtotal),0) AS revenue,
          COALESCE(SUM(si.discount),0) AS discount
        FROM sale_items si
        JOIN sales s ON s.id=si.sale_id
        WHERE s.store_id=$1 AND s.correction_status='ACTIVE' AND s.created_at >= $2 AND s.created_at <= $3
        GROUP BY si.product_id, si.product_name_snapshot
        ORDER BY quantity DESC, revenue DESC, name ASC
      `, params),
      query(`
        SELECT s.employee_id AS "employeeId",
          COALESCE(u.username,'บัญชีที่ถูกลบ') AS username,
          COUNT(*)::int AS orders,
          COALESCE(SUM(s.total),0) AS revenue
        FROM sales s
        LEFT JOIN users u ON u.id=s.employee_id AND u.store_id=s.store_id
        WHERE s.store_id=$1 AND s.correction_status='ACTIVE' AND s.created_at >= $2 AND s.created_at <= $3
        GROUP BY s.employee_id, u.username
        ORDER BY revenue DESC, orders DESC, username ASC
      `, params),
      query(`
        SELECT ${dateExpression} AS period,
          COUNT(*)::int AS orders, COALESCE(SUM(s.total),0) AS revenue
        FROM sales s
        WHERE s.store_id=$1 AND s.correction_status='ACTIVE' AND s.created_at >= $2 AND s.created_at <= $3
        GROUP BY period ORDER BY period ASC
      `, params),
      query(`
        SELECT p.id, p.name, p.sku, p.stock, p.reorder_point,
          COALESCE(SUM(si.quantity),0)::int AS "soldQuantity"
        FROM products p
        LEFT JOIN (
          SELECT si.product_id, si.quantity
          FROM sale_items si JOIN sales s ON s.id=si.sale_id
          WHERE s.store_id=$1 AND s.correction_status='ACTIVE' AND s.created_at >= $2 AND s.created_at <= $3
        ) si ON si.product_id=p.id
        WHERE p.store_id=$1
        GROUP BY p.id
        ORDER BY p.name ASC
      `, params)
    ])

    const productRows = products.rows.map(row => ({
      productId: row.productId, name: row.name,
      quantity: Number(row.quantity), revenue: Number(row.revenue),
      discount: Number(row.discount)
    }))
    const employeesWithUnits = employees.rows.map(row => ({
      employeeId: row.employeeId, username: row.username,
      orders: Number(row.orders), revenue: Number(row.revenue), units: 0
    }))
    // Count employee units separately: joining sale_items to the sales summary
    // would otherwise multiply every sale amount by its item-line count.
    const unitRows = await query(`
      SELECT s.employee_id AS "employeeId", COALESCE(SUM(si.quantity),0)::int AS units
      FROM sales s JOIN sale_items si ON si.sale_id=s.id
      WHERE s.store_id=$1 AND s.correction_status='ACTIVE' AND s.created_at >= $2 AND s.created_at <= $3
      GROUP BY s.employee_id
    `, params)
    const unitMap = new Map(unitRows.rows.map(row => [String(row.employeeId), Number(row.units)]))
    for (const item of employeesWithUnits) item.units = unitMap.get(String(item.employeeId)) || 0

    const elapsedDays = Math.max(1, (Date.parse(range.end) - Date.parse(range.start)) / DAY_MS)
    const recommendations = inventory.rows.map(row => {
      const stock = Number(row.stock)
      const sold = Number(row.soldQuantity)
      const daily = sold / elapsedDays
      const projected7 = Math.ceil(daily * 7)
      const reorderPoint = Number(row.reorder_point || 0)
      let decision = 'ปกติ'
      let reason = 'จำนวนคงเหลือยังเหมาะกับอัตราการขายในช่วงที่เลือก'
      if (sold > 0 && stock <= Math.max(reorderPoint, projected7)) {
        decision = 'ควรสั่งเพิ่ม'
        reason = `คงเหลือ ${stock} ชิ้น ยอดขายเฉลี่ย ${daily.toFixed(2)} ชิ้น/วัน`
      } else if (sold === 0 && stock > 0) {
        decision = 'ชะลอสั่ง'
        reason = 'ไม่มีการขายในช่วงที่เลือก แต่ยังมีสินค้าคงเหลือ'
      } else if (sold > 0 && stock >= Math.max(5, Math.ceil(daily * 30))) {
        decision = 'ชะลอสั่ง'
        reason = 'สินค้าคงเหลือรองรับยอดขายเฉลี่ยมากกว่า 30 วัน'
      } else if (stock === 0 && sold === 0) {
        decision = 'ตรวจสอบ'
        reason = 'ไม่มีสต็อกและไม่มียอดขาย จึงยังประเมินความต้องการไม่ได้'
      }
      return {
        productId: row.id, name: row.name, sku: row.sku,
        stock, soldQuantity: sold, dailyRate: Number(daily.toFixed(2)),
        reorderPoint, projected7, decision, reason
      }
    }).sort((a, b) => {
      const priority = { 'ควรสั่งเพิ่ม': 0, 'ชะลอสั่ง': 1, 'ตรวจสอบ': 2, 'ปกติ': 3 }
      return priority[a.decision] - priority[b.decision] || b.soldQuantity - a.soldQuantity
    })

    res.json({
      range: { from: range.start, to: range.end, grain },
      summary: {
        orders: Number(overview.rows[0].orders),
        revenue: Number(overview.rows[0].revenue),
        subtotal: Number(overview.rows[0].subtotal),
        discount: Number(overview.rows[0].discount),
        units: productRows.reduce((total, row) => total + row.quantity, 0)
      },
      topProducts: productRows,
      employees: employeesWithUnits,
      timeline: timeline.rows.map(row => ({
        period: row.period, orders: Number(row.orders), revenue: Number(row.revenue)
      })),
      recommendations,
      recommendationNote: 'คำแนะนำเป็นเกณฑ์เบื้องต้นจากยอดขายและสต็อกในช่วงที่เลือก ไม่รวมฤดูกาล ระยะเวลารับสินค้า หรือสินค้าที่ขาดสต็อก'
    })
  } catch (error) { next(error) }
}
