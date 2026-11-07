// Shared server-side promotion calculator for sale quotes and committed sales.
// Uses integer cents to keep checkout totals and QR amounts consistent.
const cents = value => {
  const [whole, fraction = ''] = String(value ?? '0').split('.')
  if (!/^-?\d+$/.test(whole) || !/^\d*$/.test(fraction)) throw new Error('Invalid money amount')
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0').slice(0, 2))
}
const display = amount => (amount / 100n).toString() + '.' + (amount % 100n).toString().padStart(2, '0')
const positive = value => Number.isFinite(Number(value)) && Number(value) > 0
const percentDiscount = (amount, percent) => {
  if (!positive(percent) || Number(percent) > 100) return 0n
  const p = Math.round(Number(percent) * 100)
  return (amount * BigInt(p) + 5000n) / 10000n
}
const cap = (discount, amount) => discount < 0n ? 0n : discount > amount ? amount : discount

export async function priceCart(query, storeId, byProduct) {
  const items = [...byProduct.entries()].map(([id, item]) => ({
    id: Number(id),
    quantity: Number(item.quantity),
    name: item.name,
    price: cents(item.price)
  }))
  const subtotal = items.reduce((sum, item) => sum + item.price * BigInt(item.quantity), 0n)
  const results = await query(`
    SELECT p.id,p.name,p.promotion_type,p.priority,
      r.min_quantity,r.min_amount,r.discount_percent,r.discount_amount,
      r.special_price,r.bundle_quantity,
      pp.product_id,pp.required_quantity
    FROM promotions p
    JOIN promotion_products pp ON pp.promotion_id=p.id
    JOIN products sp ON sp.id=pp.product_id AND sp.store_id=p.store_id
    LEFT JOIN promotion_rules r ON r.promotion_id=p.id
    WHERE p.store_id=$1 AND p.is_active=TRUE
      AND p.start_at<=NOW() AND (p.end_at IS NULL OR p.end_at>=NOW())
    ORDER BY p.priority DESC,p.id DESC,pp.product_id
  `, [storeId])
  const promotions = new Map()
  for (const row of results.rows) {
    if (!promotions.has(row.id)) promotions.set(row.id, {
      id: row.id, name: row.name, type: row.promotion_type,
      priority: row.priority, rule: row, products: []
    })
    promotions.get(row.id).products.push({
      id: Number(row.product_id),
      required: Math.max(1, Number(row.required_quantity || 1))
    })
  }
  let applied = null
  let best = 0n
  for (const promo of promotions.values()) {
    const eligible = items.filter(item => promo.products.some(p => p.id === item.id))
    if (!eligible.length) continue
    const amount = eligible.reduce((sum, item) => sum + item.price * BigInt(item.quantity), 0n)
    const quantity = eligible.reduce((sum, item) => sum + item.quantity, 0)
    const rule = promo.rule
    let discount = 0n
    if (promo.type === 'BUNDLE_PRICE') {
      const matched = promo.products.map(p => ({
        rule: p,
        item: eligible.find(item => item.id === p.id)
      }))
      if (matched.every(entry => entry.item && entry.item.quantity >= entry.rule.required)) {
        const sets = Math.min(...matched.map(entry => Math.floor(entry.item.quantity / entry.rule.required)))
        const minimum = Math.max(1, Number(rule.bundle_quantity || 1))
        const normalSet = matched.reduce((sum, entry) =>
          sum + entry.item.price * BigInt(entry.rule.required), 0n)
        if (sets >= minimum && rule.special_price != null) {
          discount = (normalSet - cents(rule.special_price)) * BigInt(sets)
        }
      }
    } else if (promo.type === 'PERCENT_DISCOUNT') {
      discount = percentDiscount(amount, rule.discount_percent)
    } else if (promo.type === 'FIXED_DISCOUNT' && positive(rule.discount_amount)) {
      discount = cents(rule.discount_amount)
    } else if (promo.type.startsWith('QUANTITY_') && positive(rule.min_quantity) &&
               quantity >= Number(rule.min_quantity)) {
      if (promo.type === 'QUANTITY_PERCENT') discount = percentDiscount(amount, rule.discount_percent)
      if (promo.type === 'QUANTITY_FIXED' && positive(rule.discount_amount)) discount = cents(rule.discount_amount)
      if (promo.type === 'QUANTITY_PRICE' && rule.special_price != null) discount = amount - cents(rule.special_price)
    } else if (promo.type.startsWith('AMOUNT_') && positive(rule.min_amount) &&
               amount >= cents(rule.min_amount)) {
      if (promo.type === 'AMOUNT_PERCENT') discount = percentDiscount(amount, rule.discount_percent)
      if (promo.type === 'AMOUNT_FIXED' && positive(rule.discount_amount)) discount = cents(rule.discount_amount)
    }
    discount = cap(discount, amount)
    // One promotion per receipt. Highest priority wins; at equal priority
    // use the greater saving and then the latest promotion ID.
    if (discount > 0n &&
        (!applied || Number(promo.priority) > Number(applied.priority) ||
         (Number(promo.priority) === Number(applied.priority) && discount > best))) {
      applied = promo
      best = discount
    }
  }
  // Allocate overall discount proportionally by line, adjusting the last line
  // so that sum of line totals equals the receipt total exactly.
  const lines = []
  let remainingDiscount = best
  let remainingGross = subtotal
  for (let index = 0; index < items.length; index++) {
    const item = items[index]
    const gross = item.price * BigInt(item.quantity)
    const share = index === items.length - 1 ? remainingDiscount :
      remainingGross > 0n ? (remainingDiscount * gross / remainingGross) : 0n
    lines.push({
      id: item.id, name: item.name, quantity: item.quantity,
      price: display(item.price), gross: display(gross),
      discount: display(share), total: display(gross - share)
    })
    remainingDiscount -= share
    remainingGross -= gross
  }
  return {
    subtotal: display(subtotal),
    discount: display(best),
    total: display(subtotal - best),
    promotion: applied ? { id: applied.id, name: applied.name } : null,
    lines
  }
}
