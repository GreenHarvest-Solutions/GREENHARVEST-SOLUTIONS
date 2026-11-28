-- 031_production_delivery_hardening.sql
-- Production Delivery Hardening: Partner Verification & Trust Accountability,
-- Distance/Weight Pricing Breakdown, and Live Delivery Events Timeline.

-- 1. Upgrade delivery_profiles for Partner Vetting & Accountability Metrics
ALTER TABLE delivery_profiles
  ADD COLUMN IF NOT EXISTS vehicle_plate VARCHAR(50),
  ADD COLUMN IF NOT EXISTS vehicle_capacity_kg INTEGER DEFAULT 500,
  ADD COLUMN IF NOT EXISTS operating_region VARCHAR(120),
  ADD COLUMN IF NOT EXISTS national_id_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS license_document_url TEXT,
  ADD COLUMN IF NOT EXISTS id_document_url TEXT,
  ADD COLUMN IF NOT EXISTS verification_status VARCHAR(40) NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verification_notes TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trust_score NUMERIC(3,2) NOT NULL DEFAULT 5.00,
  ADD COLUMN IF NOT EXISTS completed_deliveries INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancelled_deliveries INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_sum INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE delivery_profiles
  DROP CONSTRAINT IF EXISTS chk_delivery_profile_verif;
ALTER TABLE delivery_profiles
  ADD CONSTRAINT chk_delivery_profile_verif CHECK (
    verification_status IN ('unverified', 'pending_review', 'verified', 'suspended')
  );

-- 2. Upgrade deliveries with distance/weight telemetry, fee breakdown, and buyer rating
ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS distance_km NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS total_weight_kg NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS fee_breakdown JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS vehicle_plate VARCHAR(50),
  ADD COLUMN IF NOT EXISTS current_checkpoint VARCHAR(255),
  ADD COLUMN IF NOT EXISTS last_latitude NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS last_longitude NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS buyer_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS buyer_rating INTEGER,
  ADD COLUMN IF NOT EXISTS buyer_feedback TEXT;

-- 3. Immutable Delivery Tracking Events Timeline
CREATE TABLE IF NOT EXISTS delivery_events (
  id BIGSERIAL PRIMARY KEY,
  delivery_id BIGINT REFERENCES deliveries(id) ON DELETE CASCADE,
  suborder_id BIGINT REFERENCES suborders(id) ON DELETE CASCADE,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_type VARCHAR(60) NOT NULL,
  status VARCHAR(50),
  title VARCHAR(180) NOT NULL,
  description TEXT,
  location_name VARCHAR(255),
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  actor_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  actor_role VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_events_order ON delivery_events(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_events_suborder ON delivery_events(suborder_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_events_delivery ON delivery_events(delivery_id, created_at DESC);
