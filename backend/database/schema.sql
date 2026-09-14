-- POS Store Management - PostgreSQL schema
-- Designed for Google Cloud SQL for PostgreSQL.

BEGIN;

CREATE TABLE IF NOT EXISTS stores (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DELETED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL
    CHECK (role IN ('ADMIN', 'OWNER', 'EMPLOYEE')),
  store_id BIGINT REFERENCES stores(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
  permission_key VARCHAR(100) PRIMARY KEY,
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS user_permissions (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_key VARCHAR(100) NOT NULL REFERENCES permissions(permission_key) ON DELETE CASCADE,
  PRIMARY KEY (user_id, permission_key)
);

CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  store_id BIGINT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  sku VARCHAR(100) NOT NULL,
  category VARCHAR(100),
  price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  reorder_point INTEGER NOT NULL DEFAULT 10 CHECK (reorder_point >= 0),
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, sku)
);

CREATE TABLE IF NOT EXISTS promotions (
  id BIGSERIAL PRIMARY KEY,
  store_id BIGINT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('PERCENT', 'FIXED')),
  discount_value NUMERIC(12,2) NOT NULL CHECK (discount_value >= 0),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales (
  id BIGSERIAL PRIMARY KEY,
  store_id BIGINT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  receipt_number VARCHAR(100) NOT NULL,
  employee_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(30),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, receipt_number)
);

CREATE TABLE IF NOT EXISTS sale_items (
  id BIGSERIAL PRIMARY KEY,
  sale_id BIGINT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
  product_name_snapshot VARCHAR(200) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  discount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  subtotal NUMERIC(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS restock_requests (
  id BIGSERIAL PRIMARY KEY,
  store_id BIGINT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  employee_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ
);

-- Indexes for common POS/report queries.
CREATE INDEX IF NOT EXISTS idx_users_store_id ON users(store_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(store_id, category);
CREATE INDEX IF NOT EXISTS idx_sales_store_created_at ON sales(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_restock_store_status ON restock_requests(store_id, status);

CREATE TABLE IF NOT EXISTS product_items (
  id BIGSERIAL PRIMARY KEY,

  store_id BIGINT NOT NULL
    REFERENCES stores(id)
    ON DELETE CASCADE,

  product_id BIGINT NOT NULL
    REFERENCES products(id)
    ON DELETE CASCADE,

  barcode VARCHAR(150) NOT NULL,

  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN (
      'PENDING',
      'IN_STOCK',
      'SOLD',
      'CANCELLED'
    )),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (barcode)
);

CREATE INDEX IF NOT EXISTS idx_product_items_store
  ON product_items(store_id);

CREATE INDEX IF NOT EXISTS idx_product_items_product
  ON product_items(product_id);

CREATE INDEX IF NOT EXISTS idx_product_items_status
  ON product_items(store_id, status);

CREATE INDEX IF NOT EXISTS idx_product_items_barcode
  ON product_items(barcode);

  CREATE TABLE IF NOT EXISTS restock_request_items (
  id BIGSERIAL PRIMARY KEY,

  restock_request_id BIGINT NOT NULL
    REFERENCES restock_requests(id)
    ON DELETE CASCADE,

  product_item_id BIGINT NOT NULL
    REFERENCES product_items(id)
    ON DELETE RESTRICT,

  barcode VARCHAR(150) NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (restock_request_id, product_item_id),
  UNIQUE (restock_request_id, barcode)
);

CREATE INDEX IF NOT EXISTS idx_restock_request_items_request
  ON restock_request_items(restock_request_id);

CREATE INDEX IF NOT EXISTS idx_restock_request_items_barcode
  ON restock_request_items(barcode);

-- Permission catalog used by the Vue permission-checkbox screen.
INSERT INTO permissions (permission_key, description) VALUES
('product.view', 'View products'),
('product.create', 'Create products'),
('product.edit', 'Edit products'),
('product.delete', 'Delete products'),
('product.price', 'Change product prices'),
('product.image', 'Manage product images'),
('inventory.view', 'View inventory'),
('inventory.edit', 'Edit inventory'),
('inventory.restock.approve', 'Approve restock requests'),
('employee.view', 'View employees'),
('employee.create', 'Create employees'),
('employee.edit', 'Edit employees'),
('employee.delete', 'Delete employees'),
('promotion.view', 'View promotions'),
('promotion.create', 'Create promotions'),
('promotion.edit', 'Edit promotions'),
('promotion.delete', 'Delete promotions'),
('sale.create', 'Create sales'),
('sale.view', 'View sales'),
('report.view', 'View dashboard'),
('report.daily', 'Daily sales report'),
('report.trend', 'Product sales trend'),
('report.top-products', 'Top-selling products'),
('report.weekly', 'Weekly sales report'),
('inventory.restock.request', 'Request stock using unique barcodes'),
('inventory.restock.view', 'View restock requests'),
('inventory.restock.approve', 'Approve restock requests'),
('inventory.restock.reject', 'Reject restock requests')
ON CONFLICT (permission_key) DO UPDATE
SET description = EXCLUDED.description;


-- Store deletion requests: Owner requests, Admin approves/rejects.
CREATE TABLE IF NOT EXISTS store_deletion_requests (
  id BIGSERIAL PRIMARY KEY,
  store_id BIGINT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  owner_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_store_deletion_requests_status ON store_deletion_requests(status);
CREATE INDEX IF NOT EXISTS idx_store_deletion_requests_store ON store_deletion_requests(store_id);

COMMIT;
