import { pool, query } from '../config/database.js'

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
    const result = await query(`SELECT r.id,r.store_id,r.reason,r.status,r.created_at,r.decided_at,
      s.name AS store_name,u.username AS owner_username
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
    
    const existing = await query("SELECT id FROM store_deletion_requests WHERE store_id=$1", [storeId])
    
    if (existing.rowCount > 0) {
      // อัปเดตคำขอเดิมที่เคยโดน Reject
      const updateResult = await query(
        "UPDATE store_deletion_requests SET status='PENDING', reason=$1, created_at=NOW(), decided_at=NULL WHERE store_id=$2 RETURNING *",
        [reason, storeId]
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
    const result = await query('SELECT id,store_id,reason,status,created_at,decided_at FROM store_deletion_requests WHERE store_id=$1 ORDER BY created_at DESC LIMIT 1', [Number(req.user.storeId)])
    if (!result.rowCount) return res.status(404).json({ message: 'No deletion request found' })
    res.json({ request: result.rows[0] })
  } catch (e) { next(e) }
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
        SET status = 'REJECTED'
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

    // 1. ลบ User ของร้านนี้ทั้งหมด
    await client.query(
      `
      DELETE FROM users
      WHERE store_id = $1
      `,
      [storeId]
    )

    // 2. ลบข้อมูลคำขอลบของร้าน
    await client.query(
      `
      DELETE FROM store_deletion_requests
      WHERE store_id = $1
      `,
      [storeId]
    )

    // 3. ลบ Store
    await client.query(
      `
      DELETE FROM stores
      WHERE id = $1
      `,
      [storeId]
    )

    await client.query('COMMIT')

    return res.json({
      message: 'ลบร้านและ User ของร้านสำเร็จ',
      store_id: storeId,
      store_name: request.store_name
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