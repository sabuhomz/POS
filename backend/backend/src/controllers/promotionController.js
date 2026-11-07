import { query } from '../config/database.js'

const PROMOTION_TYPES = [
  'BUNDLE_PRICE',
  'PERCENT_DISCOUNT',
  'FIXED_DISCOUNT',
  'QUANTITY_PRICE',
  'QUANTITY_PERCENT',
  'QUANTITY_FIXED',
  'AMOUNT_PERCENT',
  'AMOUNT_FIXED'
]

function normalizePromotionType(type) {
  return String(type || '').trim().toUpperCase()
}

function validatePromotionPayload(body) {
  const {
    name,
    promotion_type,
    start_at,
    end_at,
    products,
    rule
  } = body

  const type = normalizePromotionType(promotion_type)

  if (!name || !String(name).trim()) {
    return 'กรุณาระบุชื่อโปรโมชั่น'
  }

  if (!PROMOTION_TYPES.includes(type)) {
    return 'ประเภทโปรโมชั่นไม่ถูกต้อง'
  }

  if (!Array.isArray(products) || products.length === 0) {
    return 'กรุณาเลือกสินค้าอย่างน้อย 1 รายการ'
  }

  for (const item of products) {
    if (!item.product_id) {
      return 'ข้อมูลสินค้าไม่ถูกต้อง'
    }

    const quantity = Number(item.required_quantity ?? 1)

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return 'จำนวนสินค้าต้องมากกว่า 0'
    }
  }

  if (start_at && end_at) {
    const start = new Date(start_at)
    const end = new Date(end_at)

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime())
    ) {
      return 'วันที่โปรโมชั่นไม่ถูกต้อง'
    }

    if (end <= start) {
      return 'วันสิ้นสุดต้องมากกว่าวันเริ่มต้น'
    }
  }

  const numericFields = [
    'min_quantity',
    'min_amount',
    'discount_percent',
    'discount_amount',
    'special_price',
    'bundle_quantity'
  ]

  for (const field of numericFields) {
    if (
      rule?.[field] !== undefined &&
      rule?.[field] !== null &&
      rule?.[field] !== ''
    ) {
      const value = Number(rule[field])

      if (!Number.isFinite(value) || value < 0) {
        return `${field} ไม่ถูกต้อง`
      }
    }
  }

  if (
    type === 'PERCENT_DISCOUNT' ||
    type === 'QUANTITY_PERCENT' ||
    type === 'AMOUNT_PERCENT'
  ) {
    const percent = Number(rule?.discount_percent)

    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
      return 'ส่วนลดเปอร์เซ็นต์ต้องมากกว่า 0 และไม่เกิน 100'
    }
  }

  if (
    type === 'FIXED_DISCOUNT' ||
    type === 'QUANTITY_FIXED' ||
    type === 'AMOUNT_FIXED'
  ) {
    const amount = Number(rule?.discount_amount)

    if (!Number.isFinite(amount) || amount <= 0) {
      return 'จำนวนเงินส่วนลดต้องมากกว่า 0'
    }
  }

  if (
    type === 'BUNDLE_PRICE' ||
    type === 'QUANTITY_PRICE'
  ) {
    const price = Number(rule?.special_price)

    if (!Number.isFinite(price) || price < 0) {
      return 'ราคาพิเศษไม่ถูกต้อง'
    }
  }

  if (type === 'QUANTITY_PRICE' ||
      type === 'QUANTITY_PERCENT' ||
      type === 'QUANTITY_FIXED') {
    const minQuantity = Number(rule?.min_quantity)

    if (!Number.isInteger(minQuantity) || minQuantity <= 0) {
      return 'กรุณาระบุจำนวนขั้นต่ำ'
    }
  }

  if (
    type === 'AMOUNT_PERCENT' ||
    type === 'AMOUNT_FIXED'
  ) {
    const minAmount = Number(rule?.min_amount)

    if (!Number.isFinite(minAmount) || minAmount <= 0) {
      return 'กรุณาระบุยอดขั้นต่ำ'
    }
  }

  if (type === 'BUNDLE_PRICE') {
    const bundleQuantity = Number(rule?.bundle_quantity)

    if (!Number.isInteger(bundleQuantity) || bundleQuantity <= 0) {
      return 'กรุณาระบุจำนวนชุด'
    }
  }

  return null
}


/*
|--------------------------------------------------------------------------
| LIST
|--------------------------------------------------------------------------
*/

export async function listPromotions(req, res, next) {
  try {
    const result = await query(
      `
      SELECT
        p.id,
        p.name,
        p.promotion_type,
        p.description,
        p.start_at,
        p.end_at,
        p.is_active,
        p.priority,
        p.created_at,
        p.updated_at,

        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', pp.id,
              'product_id', pp.product_id,
              'required_quantity', pp.required_quantity,
              'product_name', pr.name,
              'sku', pr.sku,
              'price', pr.price
            )
          ) FILTER (WHERE pp.id IS NOT NULL),
          '[]'
        ) AS products,

        MAX(prule.min_quantity) AS min_quantity,
        MAX(prule.min_amount) AS min_amount,
        MAX(prule.discount_percent) AS discount_percent,
        MAX(prule.discount_amount) AS discount_amount,
        MAX(prule.special_price) AS special_price,
        MAX(prule.bundle_quantity) AS bundle_quantity

      FROM promotions p

      LEFT JOIN promotion_products pp
        ON pp.promotion_id = p.id

      LEFT JOIN products pr
        ON pr.id = pp.product_id

      LEFT JOIN promotion_rules prule
        ON prule.promotion_id = p.id

      WHERE p.store_id = $1

      GROUP BY p.id

      ORDER BY p.priority DESC, p.id DESC
      `,
      [req.user.storeId]
    )

    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}


/*
|--------------------------------------------------------------------------
| GET ONE
|--------------------------------------------------------------------------
*/

export async function getPromotion(req, res, next) {
  try {
    const result = await query(
      `
      SELECT
        p.id,
        p.name,
        p.promotion_type,
        p.description,
        p.start_at,
        p.end_at,
        p.is_active,
        p.priority,

        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'product_id', pp.product_id,
              'required_quantity', pp.required_quantity,
              'product_name', pr.name,
              'sku', pr.sku,
              'price', pr.price
            )
          ) FILTER (WHERE pp.id IS NOT NULL),
          '[]'
        ) AS products,

        MAX(prule.min_quantity) AS min_quantity,
        MAX(prule.min_amount) AS min_amount,
        MAX(prule.discount_percent) AS discount_percent,
        MAX(prule.discount_amount) AS discount_amount,
        MAX(prule.special_price) AS special_price,
        MAX(prule.bundle_quantity) AS bundle_quantity

      FROM promotions p

      LEFT JOIN promotion_products pp
        ON pp.promotion_id = p.id

      LEFT JOIN products pr
        ON pr.id = pp.product_id

      LEFT JOIN promotion_rules prule
        ON prule.promotion_id = p.id

      WHERE p.id = $1
        AND p.store_id = $2

      GROUP BY p.id
      `,
      [req.params.id, req.user.storeId]
    )

    if (!result.rowCount) {
      return res.status(404).json({
        message: 'Promotion not found'
      })
    }

    res.json(result.rows[0])
  } catch (error) {
    next(error)
  }
}


/*
|--------------------------------------------------------------------------
| CREATE
|--------------------------------------------------------------------------
*/

export async function createPromotion(req, res, next) {
  const client = await req.app.locals.dbPool.connect()

  try {
    const body = req.body

    const validationError = validatePromotionPayload(body)

    if (validationError) {
      return res.status(400).json({
        message: validationError
      })
    }

    const type = normalizePromotionType(body.promotion_type)

    await client.query('BEGIN')

    const promotionResult = await client.query(
      `
      INSERT INTO promotions (
        store_id,
        name,
        promotion_type,
        description,
        start_at,
        end_at,
        is_active,
        priority,
        created_by
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        COALESCE($5, NOW()),
        $6,
        COALESCE($7, TRUE),
        COALESCE($8, 0),
        $9
      )
      RETURNING *
      `,
      [
        req.user.storeId,
        String(body.name).trim(),
        type,
        body.description || null,
        body.start_at || null,
        body.end_at || null,
        body.is_active !== false,
        Number(body.priority || 0),
        req.user.sub
      ]
    )

    const promotion = promotionResult.rows[0]

    for (const item of body.products) {
      await client.query(
        `
        INSERT INTO promotion_products (
          promotion_id,
          product_id,
          required_quantity
        )
        SELECT
          $1,
          p.id,
          $3
        FROM products p
        WHERE p.id = $2
          AND p.store_id = $4
        `,
        [
          promotion.id,
          item.product_id,
          Number(item.required_quantity ?? 1),
          req.user.storeId
        ]
      )
    }

    const rule = body.rule || {}

    await client.query(
      `
      INSERT INTO promotion_rules (
        promotion_id,
        min_quantity,
        min_amount,
        discount_percent,
        discount_amount,
        special_price,
        bundle_quantity
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7
      )
      `,
      [
        promotion.id,
        rule.min_quantity ?? null,
        rule.min_amount ?? null,
        rule.discount_percent ?? null,
        rule.discount_amount ?? null,
        rule.special_price ?? null,
        rule.bundle_quantity ?? null
      ]
    )

    await client.query('COMMIT')

    res.status(201).json({
      message: 'สร้างโปรโมชั่นสำเร็จ',
      promotion_id: promotion.id
    })
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
}


/*
|--------------------------------------------------------------------------
| UPDATE
|--------------------------------------------------------------------------
*/

export async function updatePromotion(req, res, next) {
  const client = await req.app.locals.dbPool.connect()

  try {
    const body = req.body

    const validationError = validatePromotionPayload(body)

    if (validationError) {
      return res.status(400).json({
        message: validationError
      })
    }

    const type = normalizePromotionType(body.promotion_type)

    await client.query('BEGIN')

    const promotionResult = await client.query(
      `
      UPDATE promotions
      SET
        name = $1,
        promotion_type = $2,
        description = $3,
        start_at = COALESCE($4, start_at),
        end_at = $5,
        is_active = $6,
        priority = $7,
        updated_at = NOW()
      WHERE id = $8
        AND store_id = $9
      RETURNING *
      `,
      [
        String(body.name).trim(),
        type,
        body.description || null,
        body.start_at || null,
        body.end_at || null,
        body.is_active !== false,
        Number(body.priority || 0),
        req.params.id,
        req.user.storeId
      ]
    )

    if (!promotionResult.rowCount) {
      await client.query('ROLLBACK')

      return res.status(404).json({
        message: 'Promotion not found'
      })
    }

    await client.query(
      `
      DELETE FROM promotion_products
      WHERE promotion_id = $1
      `,
      [req.params.id]
    )

    for (const item of body.products) {
      await client.query(
        `
        INSERT INTO promotion_products (
          promotion_id,
          product_id,
          required_quantity
        )
        SELECT
          $1,
          p.id,
          $3
        FROM products p
        WHERE p.id = $2
          AND p.store_id = $4
        `,
        [
          req.params.id,
          item.product_id,
          Number(item.required_quantity ?? 1),
          req.user.storeId
        ]
      )
    }

    await client.query(
      `
      DELETE FROM promotion_rules
      WHERE promotion_id = $1
      `,
      [req.params.id]
    )

    const rule = body.rule || {}

    await client.query(
      `
      INSERT INTO promotion_rules (
        promotion_id,
        min_quantity,
        min_amount,
        discount_percent,
        discount_amount,
        special_price,
        bundle_quantity
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7
      )
      `,
      [
        req.params.id,
        rule.min_quantity ?? null,
        rule.min_amount ?? null,
        rule.discount_percent ?? null,
        rule.discount_amount ?? null,
        rule.special_price ?? null,
        rule.bundle_quantity ?? null
      ]
    )

    await client.query('COMMIT')

    res.json({
      message: 'แก้ไขโปรโมชั่นสำเร็จ'
    })
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
}


/*
|--------------------------------------------------------------------------
| DELETE
|--------------------------------------------------------------------------
*/

export async function deletePromotion(req, res, next) {
  try {
    const result = await query(
      `
      DELETE FROM promotions
      WHERE id = $1
        AND store_id = $2
      RETURNING id
      `,
      [req.params.id, req.user.storeId]
    )

    if (!result.rowCount) {
      return res.status(404).json({
        message: 'Promotion not found'
      })
    }

    res.status(204).send()
  } catch (error) {
    next(error)
  }
}


/*
|--------------------------------------------------------------------------
| TOGGLE
|--------------------------------------------------------------------------
*/

export async function togglePromotion(req, res, next) {
  try {
    const result = await query(
      `
      UPDATE promotions
      SET
        is_active = NOT is_active,
        updated_at = NOW()
      WHERE id = $1
        AND store_id = $2
      RETURNING id, is_active
      `,
      [req.params.id, req.user.storeId]
    )

    if (!result.rowCount) {
      return res.status(404).json({
        message: 'Promotion not found'
      })
    }

    res.json(result.rows[0])
  } catch (error) {
    next(error)
  }
}


/*
|--------------------------------------------------------------------------
| ACTIVE PROMOTIONS FOR RPI4 / SALES APP
|--------------------------------------------------------------------------
*/

export async function listActivePromotions(req, res, next) {
  try {
    const result = await query(
      `
      SELECT
        p.id,
        p.name,
        p.promotion_type,
        p.start_at,
        p.end_at,
        p.priority,

        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'product_id', pp.product_id,
              'required_quantity', pp.required_quantity
            )
          ) FILTER (WHERE pp.id IS NOT NULL),
          '[]'
        ) AS products,

        MAX(pr.min_quantity) AS min_quantity,
        MAX(pr.min_amount) AS min_amount,
        MAX(pr.discount_percent) AS discount_percent,
        MAX(pr.discount_amount) AS discount_amount,
        MAX(pr.special_price) AS special_price,
        MAX(pr.bundle_quantity) AS bundle_quantity

      FROM promotions p

      LEFT JOIN promotion_products pp
        ON pp.promotion_id = p.id

      LEFT JOIN promotion_rules pr
        ON pr.promotion_id = p.id

      WHERE p.store_id = $1
        AND p.is_active = TRUE
        AND p.start_at <= NOW()
        AND (p.end_at IS NULL OR p.end_at >= NOW())

      GROUP BY p.id

      ORDER BY p.priority DESC, p.id DESC
      `,
      [req.user.storeId]
    )

    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}