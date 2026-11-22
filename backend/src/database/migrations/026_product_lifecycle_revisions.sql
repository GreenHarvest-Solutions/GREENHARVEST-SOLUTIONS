-- 026_product_lifecycle_revisions.sql
-- Extend products with publication flags, logistics attributes, quality scores, and create product_revisions

-- 1. Extend products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS quality_score NUMERIC(5,2) DEFAULT 0.00;
ALTER TABLE products ADD COLUMN IF NOT EXISTS moderation_risk_score NUMERIC(5,2) DEFAULT 0.00;
ALTER TABLE products ADD COLUMN IF NOT EXISTS harvest_date DATE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit VARCHAR(30) DEFAULT 'kg';
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_order_quantity NUMERIC(10,2) DEFAULT 1.00;
ALTER TABLE products ADD COLUMN IF NOT EXISTS pickup_available BOOLEAN DEFAULT TRUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS farmer_delivery_available BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS delivery_radius_km INTEGER DEFAULT 0;

-- 2. Update status constraint on products to allow 'pending' and 'under_revision'
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_status_check') THEN
    ALTER TABLE products DROP CONSTRAINT products_status_check;
  END IF;
  ALTER TABLE products ADD CONSTRAINT products_status_check
    CHECK (status IN ('active', 'draft', 'pending', 'deactivated', 'under_revision'));
END $$;

-- 3. Grandfather live active products
UPDATE products
SET is_published = TRUE
WHERE status = 'active' AND moderation_status = 'approved' AND deleted_at IS NULL;

-- 4. Create product_revisions table
CREATE TABLE IF NOT EXISTS product_revisions (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  farmer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  revision_data JSONB NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  reviewer_feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_prod_rev_product_id ON product_revisions(product_id);
CREATE INDEX IF NOT EXISTS idx_prod_rev_farmer_id ON product_revisions(farmer_id);
CREATE INDEX IF NOT EXISTS idx_prod_rev_status ON product_revisions(status);
