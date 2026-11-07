import { query } from '../config/database.js'

export async function getOwnerDashboard(req, res, next) {
  try {
    const storeId = req.user.storeId

    const summaryResult = await query(
      `SELECT
         COALESCE(SUM(total), 0) AS sales,
         COUNT(*) AS orders,
         COALESCE(AVG(total), 0) AS average_order
       FROM sales
       WHERE store_id = $1
         AND created_at::date = CURRENT_DATE`,
      [storeId]
    )

    const summary = summaryResult.rows[0]

    const topProductsResult = await query(
      `SELECT
         si.product_id AS "productId",
         si.product_name_snapshot AS name,
         SUM(si.quantity)::int AS quantity,
         COALESCE(SUM(si.subtotal), 0) AS "totalSales"
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       WHERE s.store_id = $1
       GROUP BY si.product_id, si.product_name_snapshot
       ORDER BY quantity DESC, "totalSales" DESC
       LIMIT 5`,
      [storeId]
    )

    const dailySalesResult = await query(
      `SELECT
         created_at::date AS date,
         COALESCE(SUM(total), 0) AS "totalSales"
       FROM sales
       WHERE store_id = $1
         AND created_at >= CURRENT_DATE - INTERVAL '28 days'
       GROUP BY created_at::date
       ORDER BY created_at::date`,
      [storeId]
    )

    const weeklyResult = await query(
      `SELECT
         TO_CHAR(date_trunc('week', created_at), 'DD Mon') AS label,
         COALESCE(SUM(total), 0) AS total
       FROM sales
       WHERE store_id = $1
         AND created_at >= CURRENT_DATE - INTERVAL '28 days'
       GROUP BY date_trunc('week', created_at)
       ORDER BY date_trunc('week', created_at)`,
      [storeId]
    )

    res.json({
      summary: {
        todaySales: Number(summary.sales),
        todayOrders: Number(summary.orders),
        averageOrderValue: Number(summary.average_order)
      },
      topProducts: topProductsResult.rows.map((item) => ({
        productId: item.productId,
        name: item.name,
        quantity: Number(item.quantity),
        totalSales: Number(item.totalSales)
      })),
      dailySales: dailySalesResult.rows.map((item) => ({
        date: item.date,
        totalSales: Number(item.totalSales)
      })),
      weekly: weeklyResult.rows.map((item) => ({
        label: item.label,
        total: Number(item.total)
      }))
    })
  } catch (error) {
    next(error)
  }
}

export async function getSlowMovingInventory(req, res, next) {
  try {
    const storeId = req.user.storeId
    const parsedDays = Number.parseInt(req.query.days, 10)
    const days = [30, 60, 90].includes(parsedDays) ? parsedDays : 30
    const result = await query(
      `SELECT
         p.id,
         p.name,
         p.sku,
         p.category,
         p.stock,
         p.price,
         latest.last_sold_at AS "lastSoldAt",
         COALESCE(latest.last_sold_at, p.created_at) AS "trackingSince",
         GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - COALESCE(latest.last_sold_at, p.created_at))) / 86400))::int AS "daysWithoutSale"
       FROM products p
       LEFT JOIN LATERAL (
         SELECT MAX(s.created_at) AS last_sold_at
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         WHERE si.product_id = p.id AND s.store_id = p.store_id
       ) latest ON TRUE
       WHERE p.store_id = $1
         AND p.stock > 0
         AND COALESCE(latest.last_sold_at, p.created_at) <= NOW() - ($2 * INTERVAL '1 day')
       ORDER BY "daysWithoutSale" DESC, p.stock DESC, p.name ASC`,
      [storeId, days]
    )

    res.json({
      days,
      products: result.rows.map((product) => ({
        ...product,
        stock: Number(product.stock),
        price: Number(product.price),
        daysWithoutSale: Number(product.daysWithoutSale)
      }))
    })
  } catch (error) {
    next(error)
  }
}
