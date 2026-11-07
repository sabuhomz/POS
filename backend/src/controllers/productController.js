import { query } from '../config/database.js'

function productInput(body = {}) {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const sku = typeof body.sku === 'string' ? body.sku.trim() : ''
  const category = typeof body.category === 'string' ? body.category.trim() : ''
  const rawPrice = body.price
  const price = Number(rawPrice)
  const reorderPoint = Number(body.reorderPoint ?? 10)
  if (!name || !sku || name.length > 200 || sku.length > 100 || category.length > 100) {
    const error = new Error('กรุณาระบุชื่อสินค้าและ SKU โดยชื่อไม่เกิน 200 และ SKU/หมวดหมู่ไม่เกิน 100 ตัวอักษร')
    error.status = 400
    throw error
  }
  if (!['string', 'number'].includes(typeof rawPrice) || String(rawPrice).trim() === '' || !Number.isFinite(price) || price < 0 || price > 9999999999.99 || !Number.isInteger(reorderPoint) || reorderPoint < 0 || reorderPoint > 2147483647) {
    const error = new Error('ราคาและจุดแจ้งเตือนสต็อกไม่ถูกต้อง กรุณาระบุตัวเลขที่ไม่ติดลบ')
    error.status = 400
    throw error
  }
  return { name, sku, category, price, reorderPoint }
}

export async function listProducts(req, res, next) {
  try {
    const result = await query('SELECT * FROM products WHERE store_id=$1 ORDER BY id DESC', [req.user.storeId])
    res.json(result.rows)
  } catch (error) { next(error) }
}

export async function getProduct(req, res, next) {
  try {
    const result = await query('SELECT * FROM products WHERE id=$1 AND store_id=$2', [req.params.id, req.user.storeId])
    if (!result.rowCount) return res.status(404).json({ message: 'ไม่พบสินค้าในร้านนี้' })
    res.json(result.rows[0])
  } catch (error) { next(error) }
}

export async function createProduct(req, res, next) {
  try {
    const { name, sku, category, price, reorderPoint } = productInput(req.body)
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : (req.body.imageUrl || '')
    const result = await query(`INSERT INTO products(store_id,name,sku,category,price,reorder_point,image_url)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [req.user.storeId, name, sku, category, price, reorderPoint, imageUrl])
    res.status(201).json(result.rows[0])
  } catch (error) { next(error) }
}

export async function updateProduct(req, res, next) {
  try {
    const { name, sku, category, price, reorderPoint } = productInput(req.body)
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : (req.body.imageUrl || null)
    const result = await query(`UPDATE products SET name=$1,sku=$2,category=$3,price=$4,reorder_point=$5,
      image_url=COALESCE($6,image_url),updated_at=NOW() WHERE id=$7 AND store_id=$8 RETURNING *`,
    [name, sku, category, price, reorderPoint, imageUrl, req.params.id, req.user.storeId])
    if (!result.rowCount) return res.status(404).json({ message: 'ไม่พบสินค้าในร้านนี้' })
    res.json(result.rows[0])
  } catch (error) { next(error) }
}

export async function deleteProduct(req, res, next) {
  try {
    const result = await query('DELETE FROM products WHERE id=$1 AND store_id=$2 RETURNING id', [req.params.id, req.user.storeId])
    if (!result.rowCount) return res.status(404).json({ message: 'ไม่พบสินค้าในร้านนี้' })
    res.status(204).send()
  } catch (error) { next(error) }
}
