import { query, pool } from '../config/database.js'

function normalizeBarcodes(value) {
  if (!Array.isArray(value)) return []

  return [
    ...new Set(
      value
        .map((barcode) => String(barcode || '').trim())
        .filter(Boolean)
    )
  ]
}


// ======================================================
// EMPLOYEE
// สร้างคำขอเติม Stock ด้วย Barcode ใหม่
// ======================================================

export async function createRestockRequest(req, res, next) {
  const client = await pool.connect()

  try {
    if (req.user.role !== 'EMPLOYEE') {
      return res.status(403).json({
        message: 'Only EMPLOYEE can create restock requests'
      })
    }

    const storeId = req.user.storeId
    const employeeId = req.user.sub
    const productId = Number(req.body.product_id)
    const barcodes = normalizeBarcodes(req.body.barcodes)

    if (!Number.isInteger(productId)) {
      return res.status(400).json({
        message: 'Invalid product_id'
      })
    }

    if (!barcodes.length) {
      return res.status(400).json({
        message: 'กรุณาสแกน Barcode อย่างน้อย 1 รายการ'
      })
    }

    await client.query('BEGIN')

    // ตรวจว่าสินค้าเป็นของร้านนี้
    const productResult = await client.query(
      `
      SELECT
        id,
        name,
        sku
      FROM products
      WHERE id = $1
        AND store_id = $2
      FOR UPDATE
      `,
      [productId, storeId]
    )

    if (!productResult.rowCount) {
      await client.query('ROLLBACK')

      return res.status(404).json({
        message: 'ไม่พบสินค้า'
      })
    }

    const product = productResult.rows[0]

    // ตรวจ Barcode ว่าถูกใช้ไปแล้วหรือยัง
    const duplicateResult = await client.query(
      `
      SELECT barcode
      FROM product_items
      WHERE barcode = ANY($1::varchar[])
      `,
      [barcodes]
    )

    if (duplicateResult.rowCount) {
      await client.query('ROLLBACK')

      return res.status(409).json({
        message: 'มี Barcode ที่ถูกใช้แล้ว',
        duplicateBarcodes: duplicateResult.rows.map(
          (row) => row.barcode
        )
      })
    }

    // สร้าง Restock Request
    const requestResult = await client.query(
      `
      INSERT INTO restock_requests (
        store_id,
        product_id,
        employee_id,
        quantity,
        status
      )
      VALUES ($1, $2, $3, $4, 'PENDING')
      RETURNING *
      `,
      [
        storeId,
        productId,
        employeeId,
        barcodes.length
      ]
    )

    const request = requestResult.rows[0]

    // สร้างสินค้าแต่ละชิ้น
    for (const barcode of barcodes) {
      const itemResult = await client.query(
        `
        INSERT INTO product_items (
          store_id,
          product_id,
          barcode,
          status
        )
        VALUES ($1, $2, $3, 'PENDING')
        RETURNING id
        `,
        [
          storeId,
          productId,
          barcode
        ]
      )

      await client.query(
        `
        INSERT INTO restock_request_items (
          restock_request_id,
          product_item_id,
          barcode
        )
        VALUES ($1, $2, $3)
        `,
        [
          request.id,
          itemResult.rows[0].id,
          barcode
        ]
      )
    }

    await client.query('COMMIT')

    return res.status(201).json({
      message: 'ส่งคำขอเติม Stock แล้ว',
      request: {
        id: request.id,
        product_id: product.id,
        product_name: product.name,
        sku: product.sku,
        quantity: barcodes.length,
        status: 'PENDING',
        barcodes
      }
    })
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {}

    next(error)
  } finally {
    client.release()
  }
}


// ======================================================
// OWNER
// เพิ่ม Stock โดยตรง
// ======================================================

export async function ownerAddStock(req, res, next) {
  const client = await pool.connect()

  try {
    if (req.user.role !== 'OWNER' && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        message: 'เฉพาะ OWNER เท่านั้นที่เพิ่ม Stock โดยตรงได้'
      })
    }

    const storeId = req.user.storeId
    const productId = Number(req.body.product_id)
    const barcodes = normalizeBarcodes(req.body.barcodes)

    if (!Number.isInteger(productId)) {
      return res.status(400).json({
        message: 'Invalid product_id'
      })
    }

    if (!barcodes.length) {
      return res.status(400).json({
        message: 'กรุณาสแกน Barcode อย่างน้อย 1 รายการ'
      })
    }

    await client.query('BEGIN')

    // Lock สินค้า
    const productResult = await client.query(
      `
      SELECT
        id,
        name,
        sku,
        stock
      FROM products
      WHERE id = $1
        AND store_id = $2
      FOR UPDATE
      `,
      [productId, storeId]
    )

    if (!productResult.rowCount) {
      await client.query('ROLLBACK')

      return res.status(404).json({
        message: 'ไม่พบสินค้า'
      })
    }

    // ตรวจ Barcode ซ้ำ
    const duplicateResult = await client.query(
      `
      SELECT barcode
      FROM product_items
      WHERE barcode = ANY($1::varchar[])
      `,
      [barcodes]
    )

    if (duplicateResult.rowCount) {
      await client.query('ROLLBACK')

      return res.status(409).json({
        message: 'มี Barcode ที่ถูกใช้แล้ว',
        duplicateBarcodes: duplicateResult.rows.map(
          (row) => row.barcode
        )
      })
    }

    // เพิ่มสินค้ารายชิ้นเป็น IN_STOCK ทันที
    for (const barcode of barcodes) {
      await client.query(
        `
        INSERT INTO product_items (
          store_id,
          product_id,
          barcode,
          status
        )
        VALUES ($1, $2, $3, 'IN_STOCK')
        `,
        [
          storeId,
          productId,
          barcode
        ]
      )
    }

    // เพิ่ม Stock รวม
    await client.query(
      `
      UPDATE products
      SET
        stock = stock + $1,
        updated_at = NOW()
      WHERE id = $2
        AND store_id = $3
      `,
      [
        barcodes.length,
        productId,
        storeId
      ]
    )

    await client.query('COMMIT')

    return res.status(201).json({
      message: 'เพิ่ม Stock สำเร็จ',
      product_id: productId,
      added_quantity: barcodes.length,
      barcodes
    })
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {}

    next(error)
  } finally {
    client.release()
  }
}


// ======================================================
// ดู Restock Requests
// ======================================================

export async function listRestockRequests(req, res, next) {
  try {
    const result = await query(
      `
      SELECT
        rr.id,
        rr.product_id,
        p.name AS product_name,
        p.sku,

        rr.employee_id,
        u.username AS employee_username,

        rr.quantity,
        rr.status,
        rr.created_at,
        rr.decided_at,
        rr.decided_by,

        du.username AS decided_by_username,

        COALESCE(
          json_agg(
            json_build_object(
              'id', rri.product_item_id,
              'barcode', rri.barcode
            )
            ORDER BY rri.id
          )
          FILTER (WHERE rri.id IS NOT NULL),
          '[]'
        ) AS items

      FROM restock_requests rr

      JOIN products p
        ON p.id = rr.product_id

      LEFT JOIN users u
        ON u.id = rr.employee_id

      LEFT JOIN users du
        ON du.id = rr.decided_by

      LEFT JOIN restock_request_items rri
        ON rri.restock_request_id = rr.id

      WHERE rr.store_id = $1

      GROUP BY
        rr.id,
        p.name,
        p.sku,
        u.username,
        du.username

      ORDER BY rr.id DESC
      `,
      [req.user.storeId]
    )

    return res.json(result.rows)
  } catch (error) {
    next(error)
  }
}


// ======================================================
// OWNER
// Approve Restock
// ======================================================

export async function approveRestockRequest(req, res, next) {
  const client = await pool.connect()

  try {
    if (req.user.role !== 'OWNER' && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        message: 'เฉพาะ OWNER เท่านั้น'
      })
    }

    const requestId = Number(req.params.id)

    if (!Number.isInteger(requestId)) {
      return res.status(400).json({
        message: 'Invalid request id'
      })
    }

    await client.query('BEGIN')

    // Lock request
    const requestResult = await client.query(
      `
      SELECT *
      FROM restock_requests
      WHERE id = $1
        AND store_id = $2
      FOR UPDATE
      `,
      [
        requestId,
        req.user.storeId
      ]
    )

    if (!requestResult.rowCount) {
      await client.query('ROLLBACK')

      return res.status(404).json({
        message: 'ไม่พบคำขอ'
      })
    }

    const request = requestResult.rows[0]

    if (request.status !== 'PENDING') {
      await client.query('ROLLBACK')

      return res.status(409).json({
        message: 'คำขอนี้ถูกดำเนินการไปแล้ว'
      })
    }

    // Lock item ทั้งหมด
    const itemsResult = await client.query(
      `
      SELECT
        rri.product_item_id,
        rri.barcode,
        pi.status,
        pi.product_id,
        pi.store_id
      FROM restock_request_items rri

      JOIN product_items pi
        ON pi.id = rri.product_item_id

      WHERE rri.restock_request_id = $1

      FOR UPDATE
      `,
      [requestId]
    )

    if (!itemsResult.rowCount) {
      await client.query('ROLLBACK')

      return res.status(409).json({
        message: 'คำขอนี้ไม่มี Barcode'
      })
    }

    // ตรวจว่าทุก item ยัง PENDING
    const invalidItems = itemsResult.rows.filter(
      (item) =>
        item.status !== 'PENDING' ||
        Number(item.product_id) !== Number(request.product_id) ||
        Number(item.store_id) !== Number(req.user.storeId)
    )

    if (invalidItems.length) {
      await client.query('ROLLBACK')

      return res.status(409).json({
        message: 'มีสินค้าในคำขอที่ไม่สามารถอนุมัติได้'
      })
    }

    const itemIds = itemsResult.rows.map(
      (item) => item.product_item_id
    )

    // เปลี่ยน PENDING -> IN_STOCK
    await client.query(
      `
      UPDATE product_items
      SET
        status = 'IN_STOCK',
        updated_at = NOW()
      WHERE id = ANY($1::bigint[])
        AND store_id = $2
        AND status = 'PENDING'
      `,
      [
        itemIds,
        req.user.storeId
      ]
    )

    // เพิ่ม Stock ตามจำนวน Barcode
    await client.query(
      `
      UPDATE products
      SET
        stock = stock + $1,
        updated_at = NOW()
      WHERE id = $2
        AND store_id = $3
      `,
      [
        itemsResult.rowCount,
        request.product_id,
        req.user.storeId
      ]
    )

    // ปิด Request
    await client.query(
      `
      UPDATE restock_requests
      SET
        status = 'APPROVED',
        decided_at = NOW(),
        decided_by = $1
      WHERE id = $2
      `,
      [
        req.user.sub,
        requestId
      ]
    )

    await client.query('COMMIT')

    return res.json({
      message: 'อนุมัติคำขอเติม Stock แล้ว',
      request_id: requestId,
      approved_quantity: itemsResult.rowCount,
      approved_by: req.user.sub
    })
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {}

    next(error)
  } finally {
    client.release()
  }
}


// ======================================================
// OWNER
// Reject Restock
// ======================================================

export async function rejectRestockRequest(req, res, next) {
  const client = await pool.connect()

  try {
    if (req.user.role !== 'OWNER' && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        message: 'เฉพาะ OWNER เท่านั้น'
      })
    }

    const requestId = Number(req.params.id)

    if (!Number.isInteger(requestId)) {
      return res.status(400).json({
        message: 'Invalid request id'
      })
    }

    await client.query('BEGIN')

    const requestResult = await client.query(
      `
      SELECT *
      FROM restock_requests
      WHERE id = $1
        AND store_id = $2
      FOR UPDATE
      `,
      [
        requestId,
        req.user.storeId
      ]
    )

    if (!requestResult.rowCount) {
      await client.query('ROLLBACK')

      return res.status(404).json({
        message: 'ไม่พบคำขอ'
      })
    }

    const request = requestResult.rows[0]

    if (request.status !== 'PENDING') {
      await client.query('ROLLBACK')

      return res.status(409).json({
        message: 'คำขอนี้ถูกดำเนินการไปแล้ว'
      })
    }

    // PENDING -> CANCELLED
    await client.query(
      `
      UPDATE product_items
      SET
        status = 'CANCELLED',
        updated_at = NOW()
      WHERE id IN (
        SELECT product_item_id
        FROM restock_request_items
        WHERE restock_request_id = $1
      )
      AND store_id = $2
      AND status = 'PENDING'
      `,
      [
        requestId,
        req.user.storeId
      ]
    )

    // ปิด Request
    await client.query(
      `
      UPDATE restock_requests
      SET
        status = 'REJECTED',
        decided_at = NOW(),
        decided_by = $1
      WHERE id = $2
      `,
      [
        req.user.sub,
        requestId
      ]
    )

    await client.query('COMMIT')

    return res.json({
      message: 'ปฏิเสธคำขอแล้ว',
      request_id: requestId,
      rejected_by: req.user.sub
    })
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {}

    next(error)
  } finally {
    client.release()
  }
}