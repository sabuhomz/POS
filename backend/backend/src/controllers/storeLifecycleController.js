import { pool, query } from '../config/database.js'
import { unlink } from 'node:fs/promises'
import path from 'node:path'

export async function updateStoreStatus(req, res, next) {
  try {
    const id = Number(req.params.id)
    const status = String(req.body.status || '').toUpperCase()
    if (!['ACTIVE', 'SUSPENDED'].includes(status)) return res.status(400).json({ message: 'status must be ACTIVE or SUSPENDED' })
    const result = await query('UPDATE stores SET status=$1, updated_at=NOW() WHERE id=$2 AND status <> \'DELETED\' RETURNING id,name,status,created_at,updated_at', [status, id])
    if (!result.rowCount) return res.status(404).json({ message: 'Store not found' })
    res.json({ store: result.rows[0] })
  } catch (e) { next(e) }
}

export async function listDeleteRequests(req, res, next) {
  try {
    const result = await query(`SELECT r.id,r.store_id,r.reason,r.status,r.created_at,r.decided_at,r.restored_at,
      s.name AS store_name,s.deleted_at,s.retention_until,
      u.username AS owner_username,
      (SELECT COUNT(*) FROM users e WHERE e.store_id=s.id AND e.role='EMPLOYEE') AS employee_count,
      (SELECT COUNT(*) FROM products p WHERE p.store_id=s.id) AS product_count
      FROM store_deletion_requests r
      JOIN stores s ON s.id=r.store_id
      LEFT JOIN users u ON u.id=r.owner_id
      ORDER BY CASE WHEN r.status='PENDING' THEN 0 ELSE 1 END, r.created_at DESC`)
    res.json({ requests: result.rows })
  } catch (e) { next(e) }
}

export async function requestStoreDeletion(req, res, next) {
  try {
    const storeId = Number(req.user.storeId)
    if (!storeId) return res.status(400).json({ message: 'Owner is not assigned to a store' })
    
    const store = await query('SELECT id,name,status FROM stores WHERE id=$1', [storeId])
    if (!store.rowCount || store.rows[0].status === 'DELETED') return res.status(404).json({ message: 'Store not found' })
    
    const pending = await query("SELECT id FROM store_deletion_requests WHERE store_id=$1 AND status='PENDING' LIMIT 1", [storeId])
    if (pending.rowCount) return res.status(409).json({ message: 'คุณมีคำขอที่กำลังรอตรวจสอบอยู่แล้ว' })
    
    const reason = String(req.body.reason || '').trim()
    
    const rejected = await query("SELECT id FROM store_deletion_requests WHERE store_id=$1 AND status='REJECTED' ORDER BY created_at DESC LIMIT 1", [storeId])
    
    if (rejected.rowCount > 0) {
      // Reuse only a rejected request; retain approved request history.
      const updateResult = await query(
        "UPDATE store_deletion_requests SET status='PENDING', reason=$1, created_at=NOW(), decided_at=NULL, account_states='[]'::jsonb, restored_at=NULL WHERE id=$2 RETURNING *",
        [reason, rejected.rows[0].id]
      )
      return res.status(201).json({ request: updateResult.rows[0] })
    } else {
      // สร้างคำขอใหม่
      const insertResult = await query(
        'INSERT INTO store_deletion_requests(store_id,owner_id,reason) VALUES($1,$2,$3) RETURNING *', 
        [storeId, req.user.sub, reason]
      )
      return res.status(201).json({ request: insertResult.rows[0] })
    }
  } catch (e) { 
    console.error("🔥 Error in requestStoreDeletion:", e);
    // บังคับส่ง Error จากฐานข้อมูลกลับไปแสดงที่หน้าเว็บ
    return res.status(500).json({ message: `Backend Error: ${e.message}` });
  }
}

export async function getMyDeleteRequest(req, res, next) {
  try {
    const result = await query('SELECT id,store_id,reason,status,created_at,decided_at,restored_at FROM store_deletion_requests WHERE store_id=$1 ORDER BY created_at DESC LIMIT 1', [Number(req.user.storeId)])
    if (!result.rowCount) return res.status(404).json({ message: 'No deletion request found' })
    res.json({ request: result.rows[0] })
  } catch (e) { next(e) }
}

export async function cancelStoreDeletionRequest(req, res, next) {
  try {
    const storeId = Number(req.user.storeId)
    if (!storeId) return res.status(400).json({ message: 'Owner is not assigned to a store' })

    const result = await query(
      `UPDATE store_deletion_requests
       SET status='CANCELLED', decided_at=NOW()
       WHERE store_id=$1 AND status='PENDING'
       RETURNING id,store_id,reason,status,created_at,decided_at,restored_at`,
      [storeId]
    )
    if (!result.rowCount) {
      return res.status(409).json({ message: 'ไม่พบคำขอที่รออนุมัติให้ยกเลิก' })
    }
    return res.json({ message: 'ยกเลิกคำขอสำเร็จ', request: result.rows[0] })
  } catch (error) {
    next(error)
  }
}

// Admin approve/reject store deletion request
export async function reviewDeleteRequest(req, res) {
  const client = await pool.connect()

  try {
    const { id } = req.params
    const { decision } = req.body

    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      return res.status(400).json({
        message: 'decision ต้องเป็น APPROVED หรือ REJECTED'
      })
    }

    await client.query('BEGIN')

    // หา request + store
    const requestResult = await client.query(
      `
      SELECT
        sdr.id,
        sdr.store_id,
        sdr.status AS request_status,
        s.id AS store_id,
        s.name AS store_name,
        s.status AS store_status
      FROM store_deletion_requests sdr
      JOIN stores s ON s.id = sdr.store_id
      WHERE sdr.id = $1
      FOR UPDATE
      `,
      [id]
    )

    if (requestResult.rows.length === 0) {
      await client.query('ROLLBACK')

      return res.status(404).json({
        message: 'ไม่พบคำขอลบร้าน'
      })
    }

    const request = requestResult.rows[0]

    if (request.request_status !== 'PENDING') {
      await client.query('ROLLBACK')

      return res.status(400).json({
        message: 'คำขอนี้ถูกดำเนินการไปแล้ว'
      })
    }

    // =========================
    // REJECT
    // =========================
    if (decision === 'REJECTED') {
      await client.query(
        `
        UPDATE store_deletion_requests
        SET status = 'REJECTED', decided_at=NOW()
        WHERE id = $1
        `,
        [id]
      )

      await client.query('COMMIT')

      return res.json({
        message: 'ปฏิเสธคำขอลบร้านสำเร็จ'
      })
    }

    // =========================
    // APPROVE
    // =========================

    const storeId = request.store_id

    // Keep all store data for three months, but remember and disable accounts
    // that were active so they can be restored accurately if the store is recovered.
    const accountStates = await client.query(
      `SELECT COALESCE(json_agg(id), '[]'::json) AS active_user_ids
       FROM users WHERE store_id=$1 AND is_active=TRUE`,
      [storeId]
    )

    const retention = await client.query(
      `UPDATE store_deletion_requests
       SET status='APPROVED', decided_at=NOW(),
           account_states=$2::jsonb, restored_at=NULL
       WHERE id=$1
       RETURNING decided_at + INTERVAL '3 months' AS retention_until`,
      [id, JSON.stringify(accountStates.rows[0].active_user_ids)]
    )

    const retentionUntil = retention.rows[0].retention_until

    await client.query(
      `UPDATE stores
       SET status='DELETED', deleted_at=NOW(), retention_until=$2, updated_at=NOW()
       WHERE id=$1`,
      [storeId, retentionUntil]
    )

    // Revoke access while retaining every employee/owner row for recovery.
    await client.query(
      `
      UPDATE users SET is_active=FALSE, updated_at=NOW()
      WHERE store_id = $1
      `,
      [storeId]
    )

    await client.query('COMMIT')

    return res.json({
      message: 'อนุมัติปิดร้านแล้ว ข้อมูลจะเก็บไว้ 3 เดือน',
      store_id: storeId,
      store_name: request.store_name,
      retention_until: retentionUntil
    })

  } catch (error) {
    await client.query('ROLLBACK')

    console.error('reviewDeleteRequest error:', error)

    return res.status(500).json({
      message: 'ลบร้านไม่สำเร็จ',
      error: error.message
    })
  } finally {
    client.release()
  }
}

export async function purgeExpiredDeletedStores() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const expired = await client.query(
      `SELECT id FROM stores
       WHERE status='DELETED' AND retention_until IS NOT NULL AND retention_until <= NOW()
       FOR UPDATE SKIP LOCKED`
    )
    const ids = expired.rows.map(row => row.id)
    if (!ids.length) {
      await client.query('COMMIT')
      return 0
    }

    const productImages = await client.query(
      "SELECT image_url FROM products WHERE store_id=ANY($1::bigint[]) AND image_url LIKE '/uploads/%'",
      [ids]
    )

    // Remove join rows that restrict cascading deletion of product items.
    const hasRestockRequestItems = await client.query(
      "SELECT to_regclass('public.restock_request_items') IS NOT NULL AS present"
    )
    if (hasRestockRequestItems.rows[0].present) {
      await client.query(
        `DELETE FROM restock_request_items item
         USING restock_requests request
         WHERE item.restock_request_id=request.id AND request.store_id=ANY($1::bigint[])`,
        [ids]
      )
    }
    await client.query('DELETE FROM users WHERE store_id=ANY($1::bigint[])', [ids])
    await client.query('DELETE FROM stores WHERE id=ANY($1::bigint[])', [ids])
    await client.query('COMMIT')

    const uploadsDirectory = path.resolve('uploads')
    for (const { image_url: imageUrl } of productImages.rows) {
      const filename = imageUrl.slice('/uploads/'.length)
      if (!filename || filename !== path.basename(filename)) continue
      const imagePath = path.resolve(uploadsDirectory, filename)
      if (!imagePath.startsWith(`${uploadsDirectory}${path.sep}`)) continue
      try {
        await unlink(imagePath)
      } catch (error) {
        if (error.code !== 'ENOENT') console.error('Could not remove expired store image:', error)
      }
    }

    return ids.length
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('purgeExpiredDeletedStores error:', error)
    throw error
  } finally {
    client.release()
  }
}

export async function restoreDeletedStore(req, res) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    const result = await client.query(
      `SELECT r.id AS request_id,r.account_states,s.id AS store_id,s.name,s.retention_until,s.status
       FROM stores s
       JOIN store_deletion_requests r ON r.store_id=s.id
       WHERE s.id=$1 AND s.status='DELETED' AND r.status='APPROVED'
         AND r.restored_at IS NULL AND s.retention_until > NOW()
       ORDER BY r.decided_at DESC LIMIT 1 FOR UPDATE OF s,r`,
      [req.params.id]
    )

    if (!result.rowCount) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'ไม่พบร้านที่กู้คืนได้ หรือหมดระยะเวลาเก็บข้อมูลแล้ว' })
    }

    const store = result.rows[0]
    const accountIds = Array.isArray(store.account_states) ? store.account_states : []
    await client.query(
      `UPDATE users SET is_active=TRUE,updated_at=NOW()
       WHERE store_id=$1 AND id=ANY($2::bigint[])`,
      [store.store_id, accountIds]
    )
    await client.query(
      "UPDATE stores SET status='ACTIVE',updated_at=NOW() WHERE id=$1",
      [store.store_id]
    )
    await client.query(
      'UPDATE store_deletion_requests SET restored_at=NOW() WHERE id=$1',
      [store.request_id]
    )

    await client.query('COMMIT')
    return res.json({ message: 'กู้คืนร้านสำเร็จ', store: { id: store.store_id, name: store.name } })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('restoreDeletedStore error:', error)
    return res.status(500).json({ message: 'กู้คืนร้านไม่สำเร็จ' })
  } finally {
    client.release()
  }
}
