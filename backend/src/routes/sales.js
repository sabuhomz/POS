import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { pool } from '../config/database.js'
import { priceCart } from '../services/salePricing.js'
import { authenticate } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'

const router = Router()
router.use(authenticate)

// Every scanned unit corresponds to one physical product_items barcode.
router.get('/barcode/:barcode', requirePermission('sale.create'), async (req, res, next) => {
  try {
    const barcode = String(req.params.barcode || '').trim()
    if (!barcode || barcode.length > 150) return res.status(400).json({message:'บาร์โค้ดไม่ถูกต้อง'})
    const r = await pool.query(`SELECT pi.id AS "itemId",pi.barcode,pi.status,p.id AS "productId",p.name,p.price,p.stock
      FROM product_items pi JOIN products p ON p.id=pi.product_id AND p.store_id=pi.store_id
      WHERE pi.barcode=$1 AND pi.store_id=$2`,[barcode,req.user.storeId])
    if (!r.rowCount) return res.status(404).json({message:'ไม่พบบาร์โค้ดนี้ในร้าน'})
    if (r.rows[0].status !== 'IN_STOCK') return res.status(409).json({message:'บาร์โค้ดนี้ยังไม่พร้อมขาย (รออนุมัติ/ขายแล้ว)'})
    res.json(r.rows[0])
  } catch(e){ next(e) }
})

// Preview uses the same server-side pricing logic as the final sale.
router.post('/quote', requirePermission('sale.create'), async (req, res, next) => {
  try {
    const barcodes = req.body?.barcodes
    if (!Array.isArray(barcodes) || barcodes.length > 200 ||
        barcodes.some(x => typeof x !== 'string' || !x.trim() || x.length > 150) ||
        new Set(barcodes).size !== barcodes.length) {
      return res.status(400).json({ message: 'บาร์โค้ดไม่ถูกต้อง' })
    }
    if (!barcodes.length) {
      return res.json({
        subtotal: '0.00', discount: '0.00', total: '0.00',
        promotion: null, lines: []
      })
    }
    const result = await pool.query(`
      SELECT pi.barcode,pi.status,p.id AS product_id,p.name,p.price,p.stock
      FROM product_items pi
      JOIN products p ON p.id=pi.product_id AND p.store_id=pi.store_id
      WHERE pi.barcode=ANY($1::varchar[]) AND pi.store_id=$2
    `, [barcodes, req.user.storeId])
    if (result.rowCount !== barcodes.length ||
        result.rows.some(row => row.status !== 'IN_STOCK')) {
      return res.status(409).json({ message: 'มีสินค้าถูกขายแล้วหรือยังไม่พร้อมขาย กรุณาสแกนใหม่' })
    }
    const byProduct = new Map()
    for (const unit of result.rows) {
      const id = Number(unit.product_id)
      const current = byProduct.get(id) || {
        name: unit.name, price: unit.price, stock: Number(unit.stock), quantity: 0
      }
      current.quantity++
      byProduct.set(id, current)
    }
    if ([...byProduct.values()].some(p => p.quantity > p.stock)) {
      return res.status(409).json({ message: 'สต็อกสินค้าไม่เพียงพอ' })
    }
    res.json(await priceCart(pool.query.bind(pool), req.user.storeId, byProduct))
  } catch (error) { next(error) }
})

// The client confirms it saw the payment, but this endpoint does NOT independently verify payment.
router.post('/', requirePermission('sale.create'), async (req,res,next)=>{
  const storeId=Number(req.user.storeId),userId=Number(req.user.sub)
  const barcodes=req.body?.barcodes
  if (!Number.isSafeInteger(storeId)||storeId<1||!Number.isSafeInteger(userId)||userId<1||
      req.body?.paymentMethod!=='QR' || req.body?.paymentConfirmed!==true ||
      !Array.isArray(barcodes)||!barcodes.length||barcodes.length>200||
      barcodes.some(x=>typeof x!=='string'||!x.trim()||x.length>150)||
      new Set(barcodes).size!==barcodes.length ||
      typeof req.body?.expectedTotal!=='string' || !/^\d+\.\d{2}$/.test(req.body.expectedTotal))
    return res.status(400).json({message:'ข้อมูลการขายไม่ถูกต้อง ต้องเป็นบาร์โค้ดไม่ซ้ำและชำระแบบ QR เท่านั้น'})
  const client=await pool.connect()
  try {
    await client.query('BEGIN')
    const user=await client.query(`SELECT u.role FROM users u JOIN stores s ON s.id=u.store_id
      WHERE u.id=$1 AND u.store_id=$2 AND u.is_active=TRUE AND s.status='ACTIVE'`,[userId,storeId])
    if (!user.rowCount||!['OWNER','EMPLOYEE'].includes(user.rows[0].role)) {
      const e=new Error('บัญชีหรือร้านไม่พร้อมขาย');e.status=403;throw e
    }
    if(user.rows[0].role==='EMPLOYEE'){
      const sh=await client.query(`SELECT id FROM employee_shifts WHERE employee_id=$1 AND store_id=$2 AND ended_at IS NULL FOR UPDATE`,[userId,storeId])
      if(!sh.rowCount){const e=new Error('กรุณาเริ่มกะก่อนขาย');e.status=409;throw e}
    }
    // Lock product rows first, then individual barcodes, consistent with other stock operations.
    const ids=await client.query(`SELECT DISTINCT product_id FROM product_items WHERE barcode=ANY($1::varchar[]) AND store_id=$2 ORDER BY product_id`,[barcodes,storeId])
    const pids=ids.rows.map(x=>x.product_id)
    await client.query('SELECT id FROM products WHERE id=ANY($1::bigint[]) AND store_id=$2 ORDER BY id FOR UPDATE',[pids,storeId])
    const units=await client.query(`SELECT pi.id,pi.barcode,pi.status,p.id AS product_id,p.name,p.price,p.stock
      FROM product_items pi JOIN products p ON p.id=pi.product_id AND p.store_id=pi.store_id
      WHERE pi.barcode=ANY($1::varchar[]) AND pi.store_id=$2 ORDER BY pi.id FOR UPDATE OF pi`,[barcodes,storeId])
    if(units.rowCount!==barcodes.length||units.rows.some(x=>x.status!=='IN_STOCK')){
      const e=new Error('มีบาร์โค้ดที่ไม่พบ ถูกขายแล้ว หรือยังไม่อนุมัติ');e.status=409;throw e
    }
    const byProduct=new Map()
    for(const u of units.rows){const id=Number(u.product_id);const entry=byProduct.get(id)||{name:u.name,price:u.price,stock:Number(u.stock),quantity:0};entry.quantity++;byProduct.set(id,entry)}
    for(const e of byProduct.values())if(e.quantity>e.stock){const x=new Error(`สต็อก ${e.name} ไม่เพียงพอ`);x.status=409;throw x}
    const priced=await priceCart(client.query.bind(client),storeId,byProduct)
    if (priced.total!==req.body.expectedTotal) {
      const e=new Error('ยอดโปรโมชั่นเปลี่ยน กรุณากลับไปตรวจสอบยอดก่อนชำระ');e.status=409;throw e
    }
    const receipt=`POS-${Date.now()}-${randomUUID().slice(0,8)}`
    const sale=await client.query(`INSERT INTO sales(store_id,receipt_number,employee_id,subtotal,discount,tax,total,payment_method)
      VALUES($1,$2,$3,$4,$5,0,$6,'QR') RETURNING id`,
      [storeId,receipt,userId,priced.subtotal,priced.discount,priced.total])
    // Keep exact barcodes linked to the receipt for reliable stock restoration.
    for (const unit of units.rows) {
      await client.query('INSERT INTO sale_unit_links(sale_id,product_item_id) VALUES($1,$2)', [sale.rows[0].id,unit.id])
    }
    for(const [id,p] of byProduct){
      const line=priced.lines.find(item=>item.id===Number(id))
      await client.query(`INSERT INTO sale_items(sale_id,product_id,product_name_snapshot,quantity,unit_price,discount,subtotal)
        VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [sale.rows[0].id,id,p.name,p.quantity,p.price,line.discount,line.total])
      await client.query(`UPDATE products SET stock=stock-$1,updated_at=NOW() WHERE id=$2 AND store_id=$3`,[p.quantity,id,storeId])
    }
    const changed=await client.query(`UPDATE product_items SET status='SOLD',updated_at=NOW()
      WHERE id=ANY($1::bigint[]) AND store_id=$2 AND status='IN_STOCK' RETURNING id`,[units.rows.map(x=>x.id),storeId])
    if(changed.rowCount!==barcodes.length){const e=new Error('จำนวนบาร์โค้ดเปลี่ยนแปลง กรุณาลองใหม่');e.status=409;throw e}
    await client.query('COMMIT')
    res.status(201).json({saleId:sale.rows[0].id,receiptNumber:receipt,total:priced.total,subtotal:priced.subtotal,discount:priced.discount,promotion:priced.promotion,paymentMethod:'QR'})
  }catch(e){await client.query('ROLLBACK').catch(()=>{});next(e)}finally{client.release()}
})
export default router
