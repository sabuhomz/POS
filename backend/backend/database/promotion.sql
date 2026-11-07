-- =========================================================
-- PROMOTION SYSTEM
-- =========================================================

CREATE TABLE IF NOT EXISTS promotions (
  id BIGSERIAL PRIMARY KEY,

  store_id BIGINT NOT NULL
    REFERENCES stores(id)
    ON DELETE CASCADE,

  name VARCHAR(200) NOT NULL,

  -- BUNDLE_PRICE
  -- PERCENT_DISCOUNT
  -- FIXED_DISCOUNT
  -- QUANTITY_PRICE
  -- QUANTITY_PERCENT
  -- QUANTITY_FIXED
  -- AMOUNT_PERCENT
  -- AMOUNT_FIXED
  promotion_type VARCHAR(40) NOT NULL
    CHECK (
      promotion_type IN (
        'BUNDLE_PRICE',
        'PERCENT_DISCOUNT',
        'FIXED_DISCOUNT',
        'QUANTITY_PRICE',
        'QUANTITY_PERCENT',
        'QUANTITY_FIXED',
        'AMOUNT_PERCENT',
        'AMOUNT_FIXED'
      )
    ),

  description TEXT,

  start_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_at TIMESTAMPTZ,

  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  priority INTEGER NOT NULL DEFAULT 0,

  created_by BIGINT
    REFERENCES users(id)
    ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (end_at IS NULL OR end_at > start_at)
);

-- Upgrade older databases that stored only discount_type/discount_value.
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS promotion_type VARCHAR(40) NOT NULL DEFAULT 'FIXED_DISCOUNT';
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 0;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS created_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE promotions ALTER COLUMN name TYPE VARCHAR(200);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='promotions' AND column_name='discount_type') THEN
    EXECUTE $q$UPDATE promotions SET promotion_type=CASE WHEN discount_type='PERCENT' THEN 'PERCENT_DISCOUNT' ELSE 'FIXED_DISCOUNT' END$q$;
    EXECUTE $q$ALTER TABLE promotions ALTER COLUMN discount_type SET DEFAULT 'FIXED'$q$;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='promotions' AND column_name='discount_value') THEN
    EXECUTE $q$ALTER TABLE promotions ALTER COLUMN discount_value SET DEFAULT 0$q$;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='promotions' AND column_name='starts_at') THEN
    EXECUTE $q$UPDATE promotions SET start_at=COALESCE(starts_at,start_at)$q$;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='promotions' AND column_name='ends_at') THEN
    EXECUTE $q$UPDATE promotions SET end_at=COALESCE(ends_at,end_at)$q$;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_promotions_store
  ON promotions(store_id);

CREATE INDEX IF NOT EXISTS idx_promotions_active
  ON promotions(store_id, is_active);

CREATE INDEX IF NOT EXISTS idx_promotions_dates
  ON promotions(store_id, start_at, end_at);


-- =========================================================
-- PRODUCTS USED BY A PROMOTION
-- =========================================================

CREATE TABLE IF NOT EXISTS promotion_products (
  id BIGSERIAL PRIMARY KEY,

  promotion_id BIGINT NOT NULL
    REFERENCES promotions(id)
    ON DELETE CASCADE,

  product_id BIGINT NOT NULL
    REFERENCES products(id)
    ON DELETE CASCADE,

  required_quantity INTEGER NOT NULL DEFAULT 1
    CHECK (required_quantity > 0),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (promotion_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_promotion_products_promotion
  ON promotion_products(promotion_id);

CREATE INDEX IF NOT EXISTS idx_promotion_products_product
  ON promotion_products(product_id);


-- =========================================================
-- PROMOTION RULE
-- =========================================================

CREATE TABLE IF NOT EXISTS promotion_rules (
  id BIGSERIAL PRIMARY KEY,

  promotion_id BIGINT NOT NULL
    REFERENCES promotions(id)
    ON DELETE CASCADE,

  min_quantity INTEGER
    CHECK (min_quantity IS NULL OR min_quantity > 0),

  min_amount NUMERIC(12,2)
    CHECK (min_amount IS NULL OR min_amount >= 0),

  discount_percent NUMERIC(7,2)
    CHECK (
      discount_percent IS NULL
      OR (
        discount_percent >= 0
        AND discount_percent <= 100
      )
    ),

  discount_amount NUMERIC(12,2)
    CHECK (
      discount_amount IS NULL
      OR discount_amount >= 0
    ),

  special_price NUMERIC(12,2)
    CHECK (
      special_price IS NULL
      OR special_price >= 0
    ),

  bundle_quantity INTEGER
    CHECK (
      bundle_quantity IS NULL
      OR bundle_quantity > 0
    ),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (promotion_id)
);


-- =========================================================
-- UPDATE TIMESTAMP
-- =========================================================

CREATE OR REPLACE FUNCTION update_promotion_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


DROP TRIGGER IF EXISTS trg_promotions_updated_at
ON promotions;

CREATE TRIGGER trg_promotions_updated_at
BEFORE UPDATE ON promotions
FOR EACH ROW
EXECUTE FUNCTION update_promotion_updated_at();


DROP TRIGGER IF EXISTS trg_promotion_rules_updated_at
ON promotion_rules;

CREATE TRIGGER trg_promotion_rules_updated_at
BEFORE UPDATE ON promotion_rules
FOR EACH ROW
EXECUTE FUNCTION update_promotion_updated_at();
