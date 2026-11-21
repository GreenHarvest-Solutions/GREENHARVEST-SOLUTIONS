-- ============================================================================
-- Migration 019: Phase 1 Marketplace Governance, Product Moderation, Price Corridors
-- ============================================================================

-- 1. Product Moderation & Quality Attributes
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(32) DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS moderation_reason TEXT,
  ADD COLUMN IF NOT EXISTS moderated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS grade VARCHAR(32) DEFAULT 'Grade A',
  ADD COLUMN IF NOT EXISTS quality_notes TEXT,
  ADD COLUMN IF NOT EXISTS cold_chain_required BOOLEAN DEFAULT false;

-- Create product moderation history log
CREATE TABLE IF NOT EXISTS product_moderation_actions (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  admin_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(32) NOT NULL, -- 'approve', 'reject', 'request_changes', 'deactivate'
  previous_status VARCHAR(32),
  new_status VARCHAR(32),
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prod_mod_product_id ON product_moderation_actions(product_id);
CREATE INDEX IF NOT EXISTS idx_prod_mod_admin_id ON product_moderation_actions(admin_id);
CREATE INDEX IF NOT EXISTS idx_products_moderation_status ON products(moderation_status);

-- 2. Category Attributes & Hierarchical Schema
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS icon VARCHAR(64),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS attributes JSONB DEFAULT '[]'::jsonb;

-- 3. Review Moderation Attributes
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS hidden_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS hidden_reason TEXT,
  ADD COLUMN IF NOT EXISTS flagged_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_reviews_is_hidden ON reviews(is_hidden);

-- 4. Campaign Governance Attributes
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS approved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS budget_cap NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 5. Regional Price Corridors & Benchmark Tolerance
CREATE TABLE IF NOT EXISTS price_corridors (
  id BIGSERIAL PRIMARY KEY,
  commodity_name VARCHAR(128) NOT NULL,
  region VARCHAR(128) NOT NULL,
  min_price NUMERIC(12,2) NOT NULL,
  max_price NUMERIC(12,2) NOT NULL,
  target_price NUMERIC(12,2) NOT NULL,
  unit VARCHAR(32) DEFAULT 'kg',
  deviation_threshold_pct NUMERIC(5,2) DEFAULT 15.00,
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_price_corridor_commodity_region UNIQUE (commodity_name, region)
);

CREATE INDEX IF NOT EXISTS idx_price_corridors_commodity ON price_corridors(commodity_name);
CREATE INDEX IF NOT EXISTS idx_price_corridors_region ON price_corridors(region);

-- Seed initial price corridors for major Ethiopian regions
INSERT INTO price_corridors (commodity_name, region, min_price, max_price, target_price, unit, deviation_threshold_pct)
VALUES 
  ('White Teff', 'Oromia', 80.00, 115.00, 95.00, 'kg', 15.00),
  ('White Teff', 'Amhara', 82.00, 120.00, 98.00, 'kg', 15.00),
  ('Red Teff', 'Oromia', 65.00, 90.00, 78.00, 'kg', 15.00),
  ('Hass Avocado', 'Sidama', 45.00, 75.00, 60.00, 'kg', 20.00),
  ('Hass Avocado', 'SNNPR', 40.00, 70.00, 55.00, 'kg', 20.00),
  ('Red Onion', 'Amhara', 50.00, 85.00, 68.00, 'kg', 15.00),
  ('Red Onion', 'Oromia', 48.00, 80.00, 65.00, 'kg', 15.00),
  ('Shashemene Tomato', 'Oromia', 35.00, 60.00, 48.00, 'kg', 25.00),
  ('Harar Coffee (Grade 1)', 'Oromia', 320.00, 480.00, 400.00, 'kg', 15.00),
  ('Sidamo Coffee (Grade 2)', 'Sidama', 280.00, 420.00, 350.00, 'kg', 15.00)
ON CONFLICT (commodity_name, region) DO NOTHING;
