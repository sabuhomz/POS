import { Router } from 'express'
import { pool } from '../config/database.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()
router.use(authenticate)
function failure(message, status = 400) {
  const error = new Error(message)
  error.status = status
  return error
}
function money(value) {
  if (typeof value !== 'string' || !/^\d{1,10}\.\d{2}$/.test(value)) throw failure('กรุณาระบุยอดเงินใหม่เป็นทศนิยม 2 ตำแหน่ง')
  return value
}
async function allowed(client, userId, permission) {
  const result = await client.query('SELECT 1 FROM user_permissions WHERE user_id=$1 AND permission_key=$2', [userId, permission])
  return result.rowCount > 0
}
async function snapshot(client, saleId) {
  const rows = await client.query('SELECT id, product_id, product_name_snapshot, quantity, unit_price, discount, subtotal FROM sale_items WHERE sale_id=$1 ORDER BY id', [saleId])
  return rows.rows
}

async function applyRequest(client, change, actorId) {
  const locked = await client.query('SELECT * FROM sales WHERE id=$1 AND store_id=$2 FOR UPDATE', [change.sale_id, change.store_id])
  const sale = locked.rows[0]
  if (!sale) throw failure('ไม่พบใบเสร็จในร้านนี้', 404)
  if (sale.correction_status !== 'ACTIVE') throw failure('ใบเสร็จถูกยกเลิกแล้ว', 409)
  if (Number(sale.total) !== Number(change.previous_total) || Number(sale.discount) !== Number(change.previous_discount)) {
    throw failure('ยอดใบเสร็จเปลี่ยนไปแล้ว กรุณาส่งคำขอใหม่', 409)
  }
  if (change.action === 'VOID') {
    const lines = await client.query('SELECT product_id, quantity FROM sale_items WHERE sale_id=$1', [sale.id])
    const count = lines.rows.reduce((sum, row) => sum + Number(row.quantity), 0)
    const links = await client.query(`SELECT l.product_item_id, pi.product_id, pi.store_id, pi.status
      FROM sale_unit_links l JOIN product_items pi ON pi.id=l.product_item_id
      WHERE l.sale_id=$1 ORDER BY pi.product_id,pi.id`, [sale.id])
    const expected = new Map()
    for (const line of lines.rows) expected.set(Number(line.product_id), (expected.get(Number(line.product_id)) || 0) + Number(line.quantity))
    const actual = new Map()
    for (const link of links.rows) actual.set(Number(link.product_id), (actual.get(Number(link.product_id)) || 0) + 1)
    const mismatch = links.rowCount !== count || !count || expected.size !== actual.size ||
      [...expected].some(([id, quantity]) => actual.get(id) !== quantity)
    if (mismatch) {
      throw failure('ใบเสร็จนี้ไม่มีข้อมูลบาร์โค้ดขายครบ จึงไม่สามารถคืนสต็อกอัตโนมัติได้ กรุณาให้ผู้ดูแลตรวจสอบ', 409)
    }
    if (links.rows.some(row => row.status !== 'SOLD' || Number(row.store_id) !== Number(change.store_id))) {
      throw failure('สถานะสินค้าถูกเปลี่ยนแล้ว ไม่สามารถยกเลิกบิลได้', 409)
    }
    const productIds = [...new Set(links.rows.map(row => Number(row.product_id)))].sort((a,b) => a-b)
    await client.query('SELECT id FROM products WHERE id=ANY($1::bigint[]) AND store_id=$2 ORDER BY id FOR UPDATE', [productIds, change.store_id])
    const ids = links.rows.map(row => row.product_item_id)
    const restored = await client.query(`UPDATE product_items SET status='IN_STOCK', updated_at=NOW()
      WHERE id=ANY($1::bigint[]) AND store_id=$2 AND status='SOLD' RETURNING id`, [ids, change.store_id])
    if (restored.rowCount !== count) throw failure('คืนสต็อกไม่ครบ', 409)
    const quantities = new Map()
    for (const row of links.rows) quantities.set(Number(row.product_id), (quantities.get(Number(row.product_id)) || 0) + 1)
    for (const [productId, quantity] of quantities) {
      await client.query('UPDATE products SET stock=stock+$1, updated_at=NOW() WHERE id=$2 AND store_id=$3', [quantity, productId, change.store_id])
    }
    await client.query("UPDATE sales SET correction_status='VOID' WHERE id=$1", [sale.id])
  } else {
    const requested = money(String(change.requested_total))
    const subtotalCents = BigInt(Math.round(Number(sale.subtotal) * 100))
    const totalCents = BigInt(Math.round(Number(requested) * 100))
    if (totalCents > subtotalCents) throw failure('ยอดแก้ไขต้องไม่เกินยอดก่อนหักส่วนลด', 400)
    const discountCents = subtotalCents - totalCents
    const rows = await client.query('SELECT id, quantity, unit_price FROM sale_items WHERE sale_id=$1 ORDER BY id FOR UPDATE', [sale.id])
    const gross = rows.rows.map(r => BigInt(Math.round(Number(r.unit_price) * 100)) * BigInt(r.quantity))
    const lineGross = gross.reduce((sum, v) => sum + v, 0n)
    let allocated = 0n
    for (let i=0;i<rows.rowCount;i++) {
      const share = i===rows.rowCount-1 ? discountCents - allocated : (lineGross ? discountCents * gross[i] / lineGross : 0n)
      allocated += share
      const discounted = gross[i] - share
      const formatted = cents => (Number(cents)/100).toFixed(2)
      await client.query('UPDATE sale_items SET discount=$1, subtotal=$2 WHERE id=$3', [formatted(share), formatted(discounted), rows.rows[i].id])
    }
    await client.query('UPDATE sales SET total=$1,discount=$2 WHERE id=$3', [requested, (Number(discountCents)/100).toFixed(2), sale.id])
  }
  await client.query("UPDATE receipt_change_requests SET status='APPLIED',decided_by=$1,decided_at=NOW() WHERE id=$2", [actorId, change.id])
}

router.post('/:id/corrections', async (req, res, next) => {
  let client
  try {
    const saleId = Number(req.params.id)
    if (!Number.isSafeInteger(saleId) || saleId<1) throw failure('รหัสใบเสร็จไม่ถูกต้อง')
    const {action, reason} = req.body || {}
    if (!['VOID','ADJUST'].includes(action)) throw failure('ประเภทการแก้ไขไม่ถูกต้อง')
    if (typeof reason !== 'string' || reason.trim().length < 5 || reason.trim().length > 500) throw failure('กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร ไม่เกิน 500 ตัวอักษร')
    const newTotal = action==='ADJUST' ? money(req.body.newTotal) : null
    if (!['OWNER','EMPLOYEE'].includes(req.user.role)) throw failure('ไม่มีสิทธิ์',403)
    client = await pool.connect()
    await client.query('BEGIN')
    const owner = req.user.role==='OWNER'
    const direct = owner || await allowed(client, req.user.sub, 'sale.correction.direct')
    const request = direct || await allowed(client, req.user.sub, 'sale.correction.request')
    if (!request) throw failure('เจ้าของร้านยังไม่ได้เปิดสิทธิ์แก้ไขใบเสร็จ', 403)
    const saleResult = await client.query('SELECT * FROM sales WHERE id=$1 AND store_id=$2 FOR UPDATE', [saleId, req.user.storeId])
    const sale = saleResult.rows[0]
    if (!sale) throw failure('ไม่พบใบเสร็จ',404)
    if (sale.correction_status!=='ACTIVE') throw failure('ใบเสร็จถูกยกเลิกแล้ว',409)
    const pending=await client.query("SELECT id FROM receipt_change_requests WHERE sale_id=$1 AND status='PENDING'",[saleId])
    if (pending.rowCount) throw failure('มีคำขอของใบเสร็จนี้รออนุมัติอยู่แล้ว',409)
    if (action==='ADJUST' && (Number(newTotal)>Number(sale.subtotal) || Number(newTotal)===Number(sale.total))) {
      throw failure('ยอดใหม่ต้องไม่เกินยอดก่อนลด และต้องต่างจากยอดปัจจุบัน')
    }
    const items=await snapshot(client,saleId)
    const inserted=await client.query(`INSERT INTO receipt_change_requests
      (store_id,sale_id,action,reason,requested_total,previous_total,previous_discount,before_snapshot,requested_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9) RETURNING *`,
      [req.user.storeId,saleId,action,reason.trim(),newTotal,sale.total,sale.discount,
       JSON.stringify({receiptNumber:sale.receipt_number, subtotal:sale.subtotal, total:sale.total, discount:sale.discount, items}),req.user.sub])
    if (direct) await applyRequest(client,inserted.rows[0],req.user.sub)
    await client.query('COMMIT')
    res.status(201).json({message:direct?'ดำเนินการเรียบร้อย':'ส่งคำขอให้เจ้าของร้านแล้ว',status:direct?'APPLIED':'PENDING'})
  } catch(error) { if(client)await client.query('ROLLBACK').catch(()=>{});next(error) }
  finally { client?.release() }
})

router.get('/mine', async (req,res,next) => {
  try {
    const result=await pool.query(`SELECT r.id,r.sale_id,r.action,r.reason,r.requested_total,r.status,r.requested_at,r.decided_at
      FROM receipt_change_requests r WHERE r.store_id=$1 AND r.requested_by=$2 ORDER BY r.id DESC LIMIT 60`,
      [req.user.storeId,req.user.sub])
    res.json({requests:result.rows})
  } catch(error){next(error)}
})

router.get('/owner/requests', async(req,res,next)=>{
  try {
    if(req.user.role!=='OWNER')throw failure('เฉพาะเจ้าของร้าน',403)
    const result=await pool.query(`SELECT r.id,r.sale_id,r.action,r.reason,r.requested_total,r.previous_total,
       r.status,r.requested_at,r.decided_at,r.before_snapshot,
       s.receipt_number AS "receiptNumber",s.correction_status,
       u.username AS "requestedBy",du.username AS "decidedBy"
       FROM receipt_change_requests r
       JOIN sales s ON s.id=r.sale_id AND s.store_id=r.store_id
       LEFT JOIN users u ON u.id=r.requested_by
       LEFT JOIN users du ON du.id=r.decided_by
       WHERE r.store_id=$1 ORDER BY (r.status='PENDING') DESC,r.id DESC LIMIT 150`,[req.user.storeId])
    res.json({requests:result.rows})
  }catch(error){next(error)}
=======
const fail = (message, status = 400) => Object.assign(new Error(message), { status })
const parseMoney = value => {
  if (typeof value !== 'string' || !/^\d{1,10}\.\d{2}$/.test(value)) throw fail('ยอดเงินต้องเป็นตัวเลขทศนิยม 2 ตำแหน่ง')
  return Math.round(Number(value) * 100)
}
const format = cents => (cents / 100).toFixed(2)
async function hasPermission(client, id, key) {
  const result = await client.query('SELECT 1 FROM user_permissions WHERE user_id=$1 AND permission_key=$2',[id,key])
  return !!result.rowCount
}
async function apply(client, change, actor) {
  const result = await client.query('SELECT * FROM sales WHERE id=$1 AND store_id=$2 FOR UPDATE',[change.sale_id,change.store_id])
  const sale = result.rows[0]
  if (!sale || sale.correction_status !== 'ACTIVE') throw fail('ใบเสร็จไม่พร้อมแก้ไข',409)
  if (Number(sale.total) !== Number(change.previous_total) ||
      Number(sale.discount) !== Number(change.previous_discount)) throw fail('ยอดใบเสร็จเปลี่ยนแล้ว กรุณาส่งคำขอใหม่',409)

  if (change.action === 'VOID') {
    const lines = await client.query('SELECT product_id,quantity FROM sale_items WHERE sale_id=$1',[sale.id])
    const expected = new Map()
    for (const line of lines.rows) expected.set(Number(line.product_id),(expected.get(Number(line.product_id))||0)+Number(line.quantity))
    const links = await client.query(`SELECT l.product_item_id,pi.product_id,pi.store_id,pi.status
      FROM sale_unit_links l JOIN product_items pi ON pi.id=l.product_item_id
      WHERE l.sale_id=$1 ORDER BY pi.product_id,pi.id`,[sale.id])
    const actual = new Map()
    for (const link of links.rows) actual.set(Number(link.product_id),(actual.get(Number(link.product_id))||0)+1)
    if (!links.rowCount || actual.size !== expected.size ||
        [...expected].some(([id,amount])=>actual.get(id)!==amount) ||
        links.rows.some(x=>x.status!=='SOLD'||Number(x.store_id)!==Number(change.store_id))) {
      throw fail('ไม่มีข้อมูลบาร์โค้ดที่ขายครบหรือสินค้าถูกเปลี่ยนสถานะแล้ว ไม่สามารถคืนสต็อกอัตโนมัติ',409)
    }
    const productIds = [...expected.keys()].sort((a,b)=>a-b)
    const locked = await client.query('SELECT id FROM products WHERE id=ANY($1::bigint[]) AND store_id=$2 ORDER BY id FOR UPDATE',[productIds,change.store_id])
    if (locked.rowCount!==productIds.length) throw fail('สินค้ามีการเปลี่ยนแปลง',409)
    const returned = await client.query(`UPDATE product_items SET status='IN_STOCK',updated_at=NOW()
      WHERE id=ANY($1::bigint[]) AND store_id=$2 AND status='SOLD' RETURNING id`,
      [links.rows.map(x=>x.product_item_id),change.store_id])
    if (returned.rowCount!==links.rowCount) throw fail('ไม่สามารถคืนสต็อกได้ครบ',409)
    for (const [id,quantity] of expected) {
      await client.query('UPDATE products SET stock=stock+$1,updated_at=NOW() WHERE id=$2 AND store_id=$3',[quantity,id,change.store_id])
    }
    await client.query("UPDATE sales SET correction_status='VOID' WHERE id=$1",[sale.id])
  } else {
    const nextTotal = parseMoney(String(change.requested_total))
    const subtotal = Math.round(Number(sale.subtotal)*100)
    if (nextTotal>subtotal) throw fail('ยอดใหม่เกินยอดก่อนส่วนลด',400)
    const discount = subtotal-nextTotal
    const lines = await client.query('SELECT id,quantity,unit_price FROM sale_items WHERE sale_id=$1 ORDER BY id FOR UPDATE',[sale.id])
    const gross = lines.rows.map(r=>Math.round(Number(r.unit_price)*100)*Number(r.quantity))
    const allGross = gross.reduce((a,b)=>a+b,0)
    if (allGross!==subtotal) throw fail('ข้อมูลยอดขายเดิมไม่ตรงกับรายการสินค้า ต้องให้ผู้ดูแลตรวจสอบ',409)
    let allocated = 0
    for(let i=0;i<lines.rows.length;i++) {
      const share = i===lines.rows.length-1 ? discount-allocated : Math.floor(discount*gross[i]/(allGross||1))
      allocated += share
      await client.query('UPDATE sale_items SET discount=$1,subtotal=$2 WHERE id=$3',
        [format(share),format(gross[i]-share),lines.rows[i].id])
    }
    await client.query('UPDATE sales SET total=$1,discount=$2 WHERE id=$3',
      [format(nextTotal),format(discount),sale.id])
  }
  await client.query("UPDATE receipt_change_requests SET status='APPLIED',decided_by=$1,decided_at=NOW() WHERE id=$2",[actor,change.id])
}
router.post('/:id/corrections',async(req,res,next)=>{
  let client
  try {
    const saleId=Number(req.params.id),{action,reason}=req.body||{}
    if(!Number.isSafeInteger(saleId)||saleId<1||!['VOID','ADJUST'].includes(action) ||
      typeof reason!=='string'||reason.trim().length<5||reason.trim().length>500) throw fail('ข้อมูลคำขอไม่ถูกต้อง')
    const newTotal=action==='ADJUST' ? format(parseMoney(req.body.newTotal)) : null
    if(!['OWNER','EMPLOYEE'].includes(req.user.role)) throw fail('ไม่มีสิทธิ์',403)
    client=await pool.connect();await client.query('BEGIN')
    const direct=req.user.role==='OWNER'||await hasPermission(client,req.user.sub,'sale.correction.direct')
    const request=direct||await hasPermission(client,req.user.sub,'sale.correction.request')
    if(!request) throw fail('ไม่มีสิทธิ์ยกเลิกหรือแก้ไขใบเสร็จ',403)
    const found=await client.query('SELECT * FROM sales WHERE id=$1 AND store_id=$2 FOR UPDATE',[saleId,req.user.storeId])
    const sale=found.rows[0]
    if(!sale) throw fail('ไม่พบใบเสร็จ',404)
    if(sale.correction_status!=='ACTIVE') throw fail('ใบเสร็จถูกยกเลิกไปแล้ว',409)
    const pending=await client.query("SELECT id FROM receipt_change_requests WHERE sale_id=$1 AND status='PENDING'",[saleId])
    if(pending.rowCount) throw fail('มีคำขอรออนุมัติอยู่แล้ว',409)
    if(action==='ADJUST'&&(Number(newTotal)>Number(sale.subtotal)||Number(newTotal)===Number(sale.total)))
      throw fail('ยอดใหม่ต้องต่างจากเดิมและไม่เกินยอดก่อนส่วนลด')
    const items=await client.query('SELECT * FROM sale_items WHERE sale_id=$1 ORDER BY id',[saleId])
    const created=await client.query(`INSERT INTO receipt_change_requests
      (store_id,sale_id,action,reason,requested_total,previous_total,previous_discount,before_snapshot,requested_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9) RETURNING *`,
      [req.user.storeId,saleId,action,reason.trim(),newTotal,sale.total,sale.discount,
        JSON.stringify({receiptNumber:sale.receipt_number,subtotal:sale.subtotal,total:sale.total,discount:sale.discount,items:items.rows}),req.user.sub])
    if(direct) await apply(client,created.rows[0],req.user.sub)
    await client.query('COMMIT')
    res.status(201).json({status:direct?'APPLIED':'PENDING',message:direct?'ดำเนินการสำเร็จ':'ส่งคำขอแล้ว'})
  }catch(e){if(client)await client.query('ROLLBACK').catch(()=>{});next(e)}finally{client?.release()}
})
router.get('/mine',async(req,res,next)=>{
  try {
    const result=await pool.query(`SELECT id,sale_id,action,reason,requested_total,status,requested_at,decided_at
      FROM receipt_change_requests WHERE store_id=$1 AND requested_by=$2 ORDER BY id DESC LIMIT 60`,
      [req.user.storeId,req.user.sub])
    res.json({requests:result.rows})
  }catch(e){next(e)}
})
router.get('/owner/requests',async(req,res,next)=>{
  try {
    if(req.user.role!=='OWNER')throw fail('เฉพาะเจ้าของร้าน',403)
    const result=await pool.query(`SELECT r.id,r.sale_id,r.action,r.reason,r.requested_total,r.previous_total,
      r.status,r.requested_at,r.decided_at,r.before_snapshot,
      s.receipt_number AS "receiptNumber",s.correction_status,
      u.username AS "requestedBy",du.username AS "decidedBy"
      FROM receipt_change_requests r
      JOIN sales s ON s.id=r.sale_id AND s.store_id=r.store_id
      LEFT JOIN users u ON u.id=r.requested_by
      LEFT JOIN users du ON du.id=r.decided_by
      WHERE r.store_id=$1 ORDER BY (r.status='PENDING') DESC,r.id DESC LIMIT 150`,[req.user.storeId])
    res.json({requests:result.rows})
  }catch(e){next(e)}
>>>>>>> 215b3aa444c891275e6be41db5105fe6b01fe3cc
})
router.patch('/owner/requests/:id/:decision',async(req,res,next)=>{
  let client
  try {
<<<<<<< HEAD
    if(req.user.role!=='OWNER')throw failure('เฉพาะเจ้าของร้าน',403)
    const id=Number(req.params.id)
    const decision=req.params.decision
    if(!Number.isSafeInteger(id)||!['approve','reject'].includes(decision))throw failure('ข้อมูลไม่ถูกต้อง')
    client=await pool.connect();await client.query('BEGIN')
    const result=await client.query('SELECT * FROM receipt_change_requests WHERE id=$1 AND store_id=$2 FOR UPDATE',[id,req.user.storeId])
    const change=result.rows[0]
    if(!change)throw failure('ไม่พบคำขอ',404)
    if(change.status!=='PENDING')throw failure('คำขอนี้ดำเนินการแล้ว',409)
    if(decision==='approve')await applyRequest(client,change,req.user.sub)
    else await client.query("UPDATE receipt_change_requests SET status='REJECTED',decided_by=$1,decided_at=NOW() WHERE id=$2",[req.user.sub,id])
    await client.query('COMMIT')
    res.json({message:decision==='approve'?'อนุมัติแล้ว':'ปฏิเสธแล้ว'})
  }catch(error){if(client)await client.query('ROLLBACK').catch(()=>{});next(error)}finally{client?.release()}
})

=======
    if(req.user.role!=='OWNER')throw fail('เฉพาะเจ้าของร้าน',403)
    const id=Number(req.params.id), decision=req.params.decision
    if(!Number.isSafeInteger(id)||id<1||!['approve','reject'].includes(decision))throw fail('คำขอไม่ถูกต้อง')
    client=await pool.connect();await client.query('BEGIN')
    const found=await client.query('SELECT * FROM receipt_change_requests WHERE id=$1 AND store_id=$2 FOR UPDATE',[id,req.user.storeId])
    const change=found.rows[0]
    if(!change)throw fail('ไม่พบคำขอ',404)
    if(change.status!=='PENDING')throw fail('คำขอนี้ถูกดำเนินการแล้ว',409)
    if(decision==='approve')await apply(client,change,req.user.sub)
    else await client.query("UPDATE receipt_change_requests SET status='REJECTED',decided_by=$1,decided_at=NOW() WHERE id=$2",[req.user.sub,id])
    await client.query('COMMIT')
    res.json({message:decision==='approve'?'อนุมัติแล้ว':'ปฏิเสธแล้ว'})
  }catch(e){if(client)await client.query('ROLLBACK').catch(()=>{});next(e)}finally{client?.release()}
})
>>>>>>> 215b3aa444c891275e6be41db5105fe6b01fe3cc
export default router
