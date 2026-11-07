BEGIN;
INSERT INTO permissions(permission_key, description) VALUES
 ('sale.correction.request','Request receipt correction'),
 ('sale.correction.direct','Direct receipt correction')
ON CONFLICT(permission_key) DO NOTHING;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS correction_status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE';
CREATE TABLE IF NOT EXISTS sale_unit_links(
 sale_id BIGINT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
 product_item_id BIGINT NOT NULL REFERENCES product_items(id) ON DELETE RESTRICT,
 PRIMARY KEY(sale_id,product_item_id)
);
-- A returned barcode can be sold again and linked to a later receipt.
-- Keep the original VOID receipt link as an immutable audit trail.
ALTER TABLE sale_unit_links DROP CONSTRAINT IF EXISTS sale_unit_links_product_item_id_key;
CREATE TABLE IF NOT EXISTS receipt_change_requests(
 id BIGSERIAL PRIMARY KEY,
 store_id BIGINT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
 sale_id BIGINT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
 action VARCHAR(12) NOT NULL CHECK(action IN ('VOID','ADJUST')),
 reason VARCHAR(500) NOT NULL,
 requested_total NUMERIC(12,2) CHECK(requested_total>=0),
 previous_total NUMERIC(12,2) NOT NULL,
 previous_discount NUMERIC(12,2) NOT NULL,
 before_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
 status VARCHAR(12) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPLIED','REJECTED')),
 requested_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
 decided_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
 requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 decided_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS receipt_one_pending_per_sale ON receipt_change_requests(sale_id) WHERE status='PENDING';
CREATE INDEX IF NOT EXISTS receipt_requests_by_store ON receipt_change_requests(store_id,requested_at DESC);
COMMIT;