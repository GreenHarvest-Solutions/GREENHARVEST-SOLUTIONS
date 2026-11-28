-- 032_multi_branch_logistics_enterprise.sql
-- GreenHarvest Master Prompt Extension:
-- Multi-Branch Farmer Businesses, Staff RBAC, Branch-Level Inventory & Transfers,
-- Freshness Batches, Geographic Delivery Zones, Configurable Versioned Pricing Rules,
-- Delivery Quotes, Allocation Strategies, Time Slots, Substitutions, Exceptions & Comms.

BEGIN;

-- ============================================================
-- 1. FARMER BUSINESSES & MULTI-BRANCH STRUCTURE
-- ============================================================

CREATE TABLE IF NOT EXISTS farmer_businesses (
  id BIGSERIAL PRIMARY KEY,
  farmer_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  business_name VARCHAR(255) NOT NULL,
  legal_name VARCHAR(255),
  tin_number VARCHAR(100),
  verification_status VARCHAR(40) NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'under_review', 'verified', 'rejected', 'suspended')),
  operating_status VARCHAR(40) NOT NULL DEFAULT 'active'
    CHECK (operating_status IN ('active', 'suspended', 'deactivated')),
  payout_bank_name VARCHAR(120),
  payout_account_number VARCHAR(120),
  payout_account_holder VARCHAR(150),
  default_allocation_preference VARCHAR(40) NOT NULL DEFAULT 'optimized',
  allow_auto_split BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS farmer_branches (
  id BIGSERIAL PRIMARY KEY,
  business_id BIGINT REFERENCES farmer_businesses(id) ON DELETE CASCADE,
  farmer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  branch_type VARCHAR(50) NOT NULL DEFAULT 'main_farm'
    CHECK (branch_type IN ('main_farm', 'agricultural_farm', 'warehouse', 'distribution_center', 'collection_center', 'retail_branch', 'other')),
  physical_address TEXT NOT NULL,
  region VARCHAR(100),
  zone_area VARCHAR(120),
  city VARCHAR(120),
  woreda VARCHAR(120),
  kebele VARCHAR(120),
  landmark TEXT,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  contact_name VARCHAR(150),
  contact_phone VARCHAR(50),
  contact_email VARCHAR(180),
  operating_hours JSONB NOT NULL DEFAULT '{
    "mon": {"open": "06:00", "close": "19:00", "closed": false},
    "tue": {"open": "06:00", "close": "19:00", "closed": false},
    "wed": {"open": "06:00", "close": "19:00", "closed": false},
    "thu": {"open": "06:00", "close": "19:00", "closed": false},
    "fri": {"open": "06:00", "close": "19:00", "closed": false},
    "sat": {"open": "07:00", "close": "17:00", "closed": false},
    "sun": {"open": "08:00", "close": "14:00", "closed": false}
  }'::jsonb,
  holiday_dates JSONB NOT NULL DEFAULT '[]'::jsonb,
  service_available BOOLEAN NOT NULL DEFAULT TRUE,
  verification_status VARCHAR(40) NOT NULL DEFAULT 'draft'
    CHECK (verification_status IN ('draft', 'submitted', 'under_review', 'verified', 'rejected', 'suspended', 'deactivated')),
  operational_status VARCHAR(40) NOT NULL DEFAULT 'active'
    CHECK (operational_status IN ('active', 'busy', 'at_capacity', 'temporarily_closed', 'suspended', 'deactivated')),
  supported_delivery_methods JSONB NOT NULL DEFAULT '["farmer_pickup", "farmer_delivery", "delivery_partner"]'::jsonb,
  delivery_radius_km INTEGER NOT NULL DEFAULT 50,
  farmer_delivery_base_fee NUMERIC(10,2),
  farmer_delivery_per_km_rate NUMERIC(10,2),
  storage_capacity_kg NUMERIC(12,2) DEFAULT 50000.00,
  current_storage_used_kg NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  max_daily_orders INTEGER NOT NULL DEFAULT 50,
  max_pickup_capacity_per_hour INTEGER NOT NULL DEFAULT 15,
  available_delivery_staff INTEGER NOT NULL DEFAULT 2,
  available_vehicles INTEGER NOT NULL DEFAULT 1,
  handling_capabilities JSONB NOT NULL DEFAULT '{"cold_chain": false, "bulk_quintal": true, "fragile_produce": true}'::jsonb,
  special_instructions TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  is_preferred BOOLEAN NOT NULL DEFAULT FALSE,
  verified_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  suspension_reason TEXT,
  closure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_farmer_branches_farmer ON farmer_branches(farmer_id);
CREATE INDEX IF NOT EXISTS idx_farmer_branches_verif_op ON farmer_branches(verification_status, operational_status);

CREATE TABLE IF NOT EXISTS branch_verification_history (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES farmer_branches(id) ON DELETE CASCADE,
  previous_status VARCHAR(40),
  new_status VARCHAR(40) NOT NULL,
  decision_notes TEXT,
  actor_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  actor_role VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_branch_verif_hist_branch ON branch_verification_history(branch_id, created_at DESC);

CREATE TABLE IF NOT EXISTS branch_staff (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES farmer_branches(id) ON DELETE CASCADE,
  farmer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  staff_name VARCHAR(150) NOT NULL,
  staff_email VARCHAR(200),
  staff_phone VARCHAR(50),
  role VARCHAR(50) NOT NULL DEFAULT 'branch_manager'
    CHECK (role IN ('farmer_owner', 'branch_manager', 'inventory_manager', 'fulfillment_staff', 'branch_delivery_staff')),
  permissions JSONB NOT NULL DEFAULT '{
    "manage_inventory": true,
    "manage_orders": true,
    "manage_transfers": true,
    "manage_branch_settings": false,
    "manage_financials": false,
    "manage_staff": false
  }'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  assigned_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_branch_staff_unique_user ON branch_staff(branch_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_branch_staff_user ON branch_staff(user_id);

CREATE TABLE IF NOT EXISTS branch_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES farmer_branches(id) ON DELETE CASCADE,
  actor_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  actor_role VARCHAR(50),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(60),
  entity_id VARCHAR(64),
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_branch_audit_branch ON branch_audit_logs(branch_id, created_at DESC);

-- ============================================================
-- 2. GEOGRAPHIC DELIVERY ZONES & SERVICEABILITY
-- ============================================================

CREATE TABLE IF NOT EXISTS delivery_zones (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  zone_type VARCHAR(40) NOT NULL DEFAULT 'urban'
    CHECK (zone_type IN ('urban', 'suburban', 'rural', 'remote', 'restricted')),
  region VARCHAR(100),
  city_keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  center_lat NUMERIC(9,6),
  center_lng NUMERIC(9,6),
  radius_km NUMERIC(8,2) DEFAULT 30.00,
  polygon_geojson JSONB,
  supported_delivery_methods JSONB NOT NULL DEFAULT '["farmer_pickup", "farmer_delivery", "delivery_partner"]'::jsonb,
  base_fee_override NUMERIC(10,2),
  per_km_rate_override NUMERIC(10,2),
  min_fee NUMERIC(10,2) DEFAULT 40.00,
  max_fee NUMERIC(10,2) DEFAULT 3000.00,
  remote_surcharge NUMERIC(10,2) DEFAULT 0.00,
  operational_status VARCHAR(40) NOT NULL DEFAULT 'active'
    CHECK (operational_status IN ('active', 'temporarily_restricted', 'inactive')),
  schedule_config JSONB DEFAULT '{"same_day_cutoff": "15:00", "weekend_service": true}'::jsonb,
  special_conditions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS branch_service_areas (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES farmer_branches(id) ON DELETE CASCADE,
  zone_id BIGINT REFERENCES delivery_zones(id) ON DELETE CASCADE,
  zone_name VARCHAR(150),
  supported_methods JSONB NOT NULL DEFAULT '["farmer_pickup", "farmer_delivery", "delivery_partner"]'::jsonb,
  max_distance_km INTEGER,
  custom_base_fee NUMERIC(10,2),
  custom_per_km_rate NUMERIC(10,2),
  is_serviceable BOOLEAN NOT NULL DEFAULT TRUE,
  restrictions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_branch_service_unique ON branch_service_areas(branch_id, zone_id) WHERE zone_id IS NOT NULL;

-- ============================================================
-- 3. CONFIGURABLE PRICING RULES & DELIVERY QUOTES
-- ============================================================

CREATE TABLE IF NOT EXISTS delivery_pricing_rules (
  id BIGSERIAL PRIMARY KEY,
  rule_name VARCHAR(160) NOT NULL,
  delivery_method VARCHAR(50) NOT NULL
    CHECK (delivery_method IN ('farmer_pickup', 'farmer_delivery', 'delivery_partner')),
  zone_id BIGINT REFERENCES delivery_zones(id) ON DELETE SET NULL,
  zone_type VARCHAR(40),
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_to TIMESTAMPTZ,
  base_fee NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  per_km_rate NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  min_fee NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  max_fee NUMERIC(10,2) NOT NULL DEFAULT 5000.00,
  free_distance_km NUMERIC(8,2) NOT NULL DEFAULT 0.00,
  free_weight_kg NUMERIC(10,2) NOT NULL DEFAULT 20.00,
  per_kg_rate NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  per_m3_rate NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  fragile_surcharge NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  cold_chain_surcharge NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  packaging_fee NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  special_handling_fee NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  remote_area_surcharge NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  same_day_surcharge NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  waiting_fee_per_hour NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  reattempt_fee NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  return_delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  farmer_min_fee_policy NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  farmer_max_fee_policy NUMERIC(10,2) NOT NULL DEFAULT 2500.00,
  driver_base_payout NUMERIC(10,2) NOT NULL DEFAULT 35.00,
  driver_per_km_payout NUMERIC(10,2) NOT NULL DEFAULT 1.60,
  driver_per_kg_payout NUMERIC(10,2) NOT NULL DEFAULT 0.50,
  driver_zone_bonus NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  platform_logistics_share_pct NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  disclosure_note TEXT,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pricing_rules_lookup ON delivery_pricing_rules(delivery_method, is_active, effective_from DESC);

CREATE TABLE IF NOT EXISTS delivery_quotes (
  id BIGSERIAL PRIMARY KEY,
  quote_code VARCHAR(64) NOT NULL UNIQUE,
  buyer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id BIGINT REFERENCES farmer_branches(id) ON DELETE SET NULL,
  farmer_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  zone_id BIGINT REFERENCES delivery_zones(id) ON DELETE SET NULL,
  delivery_method VARCHAR(50) NOT NULL,
  origin_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  destination_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  items_fingerprint VARCHAR(128),
  distance_km NUMERIC(8,2) NOT NULL DEFAULT 0.00,
  estimated_duration_minutes INTEGER NOT NULL DEFAULT 60,
  distance_source VARCHAR(50) NOT NULL DEFAULT 'corridor_fallback',
  is_estimated_fallback BOOLEAN NOT NULL DEFAULT TRUE,
  total_weight_kg NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  total_volume_m3 NUMERIC(10,3) NOT NULL DEFAULT 0.000,
  item_count INTEGER NOT NULL DEFAULT 1,
  special_handling_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  fee_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  driver_payout_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  driver_compensation_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  platform_logistics_fee NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  total_delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(10) NOT NULL DEFAULT 'ETB',
  pricing_rule_id BIGINT REFERENCES delivery_pricing_rules(id) ON DELETE SET NULL,
  pricing_rule_version INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(30) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'accepted', 'expired', 'superseded', 'cancelled')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_quotes_buyer ON delivery_quotes(buyer_id, status, expires_at DESC);

-- ============================================================
-- 4. EXTEND BUYER ADDRESSES (ETHIOPIAN GEOGRAPHY + MAP PINS)
-- ============================================================

ALTER TABLE addresses
  ADD COLUMN IF NOT EXISTS region VARCHAR(100),
  ADD COLUMN IF NOT EXISTS zone_area VARCHAR(120),
  ADD COLUMN IF NOT EXISTS subcity VARCHAR(120),
  ADD COLUMN IF NOT EXISTS woreda VARCHAR(120),
  ADD COLUMN IF NOT EXISTS landmark TEXT,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS delivery_instructions TEXT,
  ADD COLUMN IF NOT EXISTS contact_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS verification_status VARCHAR(40) NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'verified', 'invalid_coordinates', 'outside_service_area')),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ============================================================
-- 5. BRANCH-LEVEL INVENTORY, BATCHES, MOVEMENTS & TRANSFERS
-- ============================================================

CREATE TABLE IF NOT EXISTS branch_inventory (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES farmer_branches(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  farmer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  branch_price_override NUMERIC(10,2),
  on_hand_quantity NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (on_hand_quantity >= 0),
  reserved_quantity NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  committed_quantity NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (committed_quantity >= 0),
  damaged_quantity NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (damaged_quantity >= 0),
  expired_quantity NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (expired_quantity >= 0),
  returned_quantity NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (returned_quantity >= 0),
  in_transit_out_quantity NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (in_transit_out_quantity >= 0),
  in_transit_in_quantity NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (in_transit_in_quantity >= 0),
  available_quantity NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (available_quantity >= 0),
  allocation_policy VARCHAR(20) NOT NULL DEFAULT 'fifo' CHECK (allocation_policy IN ('fifo', 'fefo', 'none')),
  batch_traceability_required BOOLEAN NOT NULL DEFAULT FALSE,
  freshness_grade VARCHAR(40),
  storage_conditions VARCHAR(120),
  handling_instructions TEXT,
  harvest_date DATE,
  expiry_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (branch_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_branch_inv_product ON branch_inventory(product_id, is_available);
CREATE INDEX IF NOT EXISTS idx_branch_inv_branch ON branch_inventory(branch_id);

CREATE TABLE IF NOT EXISTS inventory_batches (
  id BIGSERIAL PRIMARY KEY,
  branch_inventory_id BIGINT NOT NULL REFERENCES branch_inventory(id) ON DELETE CASCADE,
  branch_id BIGINT NOT NULL REFERENCES farmer_branches(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  batch_code VARCHAR(80) NOT NULL,
  harvest_date DATE,
  expiry_date DATE,
  freshness_grade VARCHAR(40),
  storage_conditions VARCHAR(120),
  quality_inspection_status VARCHAR(40) NOT NULL DEFAULT 'passed'
    CHECK (quality_inspection_status IN ('pending', 'passed', 'quarantined', 'expired', 'failed')),
  handling_instructions TEXT,
  initial_quantity NUMERIC(12,2) NOT NULL CHECK (initial_quantity >= 0),
  available_quantity NUMERIC(12,2) NOT NULL CHECK (available_quantity >= 0),
  reserved_quantity NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  damaged_quantity NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (damaged_quantity >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (branch_id, product_id, batch_code)
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES farmer_branches(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  batch_id BIGINT REFERENCES inventory_batches(id) ON DELETE SET NULL,
  movement_type VARCHAR(50) NOT NULL,
  quantity_delta NUMERIC(12,2) NOT NULL,
  bucket VARCHAR(40) NOT NULL DEFAULT 'available',
  reference_type VARCHAR(50),
  reference_id BIGINT,
  reason TEXT,
  actor_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_movements_branch_prod ON inventory_movements(branch_id, product_id, created_at DESC);

CREATE TABLE IF NOT EXISTS inventory_transfers (
  id BIGSERIAL PRIMARY KEY,
  transfer_number VARCHAR(64) NOT NULL UNIQUE,
  farmer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_branch_id BIGINT NOT NULL REFERENCES farmer_branches(id) ON DELETE RESTRICT,
  destination_branch_id BIGINT NOT NULL REFERENCES farmer_branches(id) ON DELETE RESTRICT,
  status VARCHAR(40) NOT NULL DEFAULT 'requested'
    CHECK (status IN (
      'requested', 'approved', 'stock_reserved', 'dispatched',
      'in_transit', 'received', 'partially_received', 'verified',
      'completed', 'delayed', 'rejected', 'cancelled'
    )),
  requested_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  approved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  dispatched_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  received_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  verified_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  delay_reason TEXT,
  discrepancy_notes TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  dispatched_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_diff_transfer_branches CHECK (source_branch_id <> destination_branch_id)
);

CREATE TABLE IF NOT EXISTS inventory_transfer_items (
  id BIGSERIAL PRIMARY KEY,
  transfer_id BIGINT NOT NULL REFERENCES inventory_transfers(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  batch_id BIGINT REFERENCES inventory_batches(id) ON DELETE SET NULL,
  requested_quantity NUMERIC(12,2) NOT NULL CHECK (requested_quantity > 0),
  dispatched_quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  received_quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  damaged_quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  missing_quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  verified_quantity NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- Extend stock_reservations to tie each reservation to an exact branch (+ optional batch)
ALTER TABLE stock_reservations
  ADD COLUMN IF NOT EXISTS branch_id BIGINT REFERENCES farmer_branches(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS suborder_id BIGINT REFERENCES suborders(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS batch_id BIGINT REFERENCES inventory_batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stock_res_branch_prod ON stock_reservations(branch_id, product_id, status);

-- ============================================================
-- 6. EXTEND SUBORDERS, ORDER ITEMS, DELIVERIES, ESCROW & RETURNS
-- ============================================================

ALTER TABLE suborders
  ADD COLUMN IF NOT EXISTS branch_id BIGINT REFERENCES farmer_branches(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS branch_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS allocation_strategy VARCHAR(50) DEFAULT 'optimized',
  ADD COLUMN IF NOT EXISTS delivery_quote_id BIGINT REFERENCES delivery_quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS driver_compensation_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS platform_logistics_fee NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS consolidation_group_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS time_slot_id BIGINT,
  ADD COLUMN IF NOT EXISTS sla_accept_by TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_pack_by TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_pickup_by TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_deliver_by TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_breached BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_suborders_branch ON suborders(branch_id);

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS branch_id BIGINT REFERENCES farmer_branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS batch_id BIGINT REFERENCES inventory_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS branch_name VARCHAR(200);

ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS branch_id BIGINT REFERENCES farmer_branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_quote_id BIGINT REFERENCES delivery_quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS zone_id BIGINT REFERENCES delivery_zones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS driver_compensation_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS platform_logistics_fee NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS pricing_rule_version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS distance_source VARCHAR(50) DEFAULT 'corridor_fallback',
  ADD COLUMN IF NOT EXISTS is_estimated_fallback BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS consolidation_group_id VARCHAR(64);

ALTER TABLE escrow_ledger
  ADD COLUMN IF NOT EXISTS branch_id BIGINT REFERENCES farmer_branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS product_subtotal NUMERIC(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS buyer_delivery_fee NUMERIC(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS driver_payout_amount NUMERIC(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS platform_logistics_fee NUMERIC(12,2) DEFAULT 0.00;

CREATE INDEX IF NOT EXISTS idx_escrow_branch ON escrow_ledger(branch_id);

-- Driver Payout Ledger (strictly separate from buyer fee & farmer payout)
CREATE TABLE IF NOT EXISTS driver_payout_ledger (
  id BIGSERIAL PRIMARY KEY,
  delivery_id BIGINT REFERENCES deliveries(id) ON DELETE CASCADE,
  suborder_id BIGINT REFERENCES suborders(id) ON DELETE CASCADE,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  driver_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id BIGINT REFERENCES farmer_branches(id) ON DELETE SET NULL,
  buyer_paid_delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  driver_base_payout NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  driver_distance_payout NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  driver_weight_payout NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  driver_zone_bonus NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  driver_total_earning NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  platform_logistics_revenue NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'eligible', 'released', 'held_dispute', 'forfeited')),
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (suborder_id, driver_id)
);

-- Returns Quarantine & Branch Inspection Extension
ALTER TABLE returns
  ADD COLUMN IF NOT EXISTS suborder_id BIGINT REFERENCES suborders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS branch_id BIGINT REFERENCES farmer_branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quarantine_status VARCHAR(40) DEFAULT 'quarantined'
    CHECK (quarantine_status IN ('quarantined', 'inspected_restockable', 'inspected_damaged', 'disposed'));

-- ============================================================
-- 7. SCHEDULING, SUBSTITUTIONS, EXCEPTIONS, CONSOLIDATION & COMMS
-- ============================================================

CREATE TABLE IF NOT EXISTS delivery_time_slots (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT REFERENCES farmer_branches(id) ON DELETE CASCADE,
  zone_id BIGINT REFERENCES delivery_zones(id) ON DELETE CASCADE,
  slot_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_type VARCHAR(30) NOT NULL DEFAULT 'delivery' CHECK (slot_type IN ('pickup', 'delivery')),
  max_capacity INTEGER NOT NULL DEFAULT 10 CHECK (max_capacity > 0),
  booked_count INTEGER NOT NULL DEFAULT 0 CHECK (booked_count >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_slot_capacity CHECK (booked_count <= max_capacity)
);

CREATE TABLE IF NOT EXISTS product_substitutions (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  suborder_id BIGINT NOT NULL REFERENCES suborders(id) ON DELETE CASCADE,
  original_product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  original_branch_id BIGINT REFERENCES farmer_branches(id) ON DELETE SET NULL,
  substitution_type VARCHAR(40) NOT NULL
    CHECK (substitution_type IN ('other_branch', 'alternative_product', 'partial_fulfillment', 'cancel_item')),
  proposed_branch_id BIGINT REFERENCES farmer_branches(id) ON DELETE SET NULL,
  proposed_product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
  proposed_quantity NUMERIC(12,2),
  price_delta NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  delivery_fee_delta NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(30) NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'approved', 'rejected', 'expired')),
  reason TEXT,
  proposed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  responded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS delivery_exceptions (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  suborder_id BIGINT REFERENCES suborders(id) ON DELETE CASCADE,
  delivery_id BIGINT REFERENCES deliveries(id) ON DELETE CASCADE,
  branch_id BIGINT REFERENCES farmer_branches(id) ON DELETE SET NULL,
  exception_type VARCHAR(60) NOT NULL
    CHECK (exception_type IN (
      'branch_closure_pre_dispatch', 'branch_closure_post_dispatch',
      'address_change_after_checkout', 'sla_breach',
      'failed_delivery_attempt', 'route_blocked', 'damaged_in_transit',
      'capacity_exceeded', 'other'
    )),
  severity VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending_buyer_approval', 'escalated', 'resolved', 'closed')),
  description TEXT NOT NULL,
  proposed_resolution JSONB DEFAULT '{}'::jsonb,
  additional_cost NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  cost_absorbed_by VARCHAR(30) DEFAULT 'none',
  requires_buyer_approval BOOLEAN NOT NULL DEFAULT FALSE,
  buyer_approved BOOLEAN,
  escalated_to_admin BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_communications (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  suborder_id BIGINT REFERENCES suborders(id) ON DELETE CASCADE,
  dispute_id BIGINT REFERENCES returns(id) ON DELETE SET NULL,
  sender_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_role VARCHAR(50) NOT NULL,
  recipient_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  channel VARCHAR(50) NOT NULL
    CHECK (channel IN ('buyer_farmer', 'buyer_driver', 'farmer_driver', 'branch_owner', 'admin_support')),
  message TEXT NOT NULL,
  masked_phone_notice BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_comms_order ON order_communications(order_id, suborder_id, created_at ASC);

-- ============================================================
-- 8. SEED PLATFORM SETTINGS, ZONES & CONFIGURABLE PRICING RULES
-- ============================================================

INSERT INTO platform_settings (key, value, updated_at) VALUES
  ('branch_allocation_strategy', '{"value": "optimized", "allowed": ["optimized", "nearest", "lowest_cost", "fastest", "best_inventory", "farmer_preferred"], "description": "Default marketplace algorithm for selecting fulfillment branches"}'::jsonb, NOW()),
  ('sla_deadlines_hours', '{"accept": 6, "pack": 12, "pickup": 24, "deliver": 48, "dispute_report": 48, "payout_release": 48}'::jsonb, NOW()),
  ('quote_ttl_minutes', '{"value": 30}'::jsonb, NOW())
ON CONFLICT (key) DO NOTHING;

INSERT INTO delivery_zones (code, name, zone_type, region, city_keywords, center_lat, center_lng, radius_km, min_fee, max_fee, remote_surcharge, operational_status)
VALUES
  ('ZONE-ADD-URBAN', 'Addis Ababa Urban Metro', 'urban', 'Addis Ababa', '["addis ababa","addis","bole","kirkos","yeka","arada","kolfe","lideta","lafto","nifas silk","gullele","akaki","kality","sarbet","mercato"]'::jsonb, 9.0054, 38.7636, 30.00, 50.00, 1200.00, 0.00, 'active'),
  ('ZONE-ORO-SUB', 'Sheger & Expressway Suburban Corridor', 'suburban', 'Oromia', '["bishoftu","debre zeit","debrezeit","mojo","modjo","adama","nazret","sebeta","burayu","sululta","gelan","dukem","legetafo"]'::jsonb, 8.6800, 39.0200, 55.00, 60.00, 1800.00, 15.00, 'active'),
  ('ZONE-REG-RURAL', 'Regional Agricultural Corridors', 'rural', 'Oromia', '["ambo","ziway","batu","shashamane","hawassa","awasa","bahir dar","jimma","dessie","arba minch","koka","debre birhan","debre berhan"]'::jsonb, 8.2000, 38.6000, 120.00, 80.00, 3000.00, 35.00, 'active'),
  ('ZONE-REMOTE-HL', 'Remote Highland & Pastoral Frontier', 'remote', 'National', '["remote","pastoral","highland","frontier","borena","somali","afar","gambela","benishangul"]'::jsonb, 8.5000, 40.5000, 300.00, 140.00, 5000.00, 90.00, 'active')
ON CONFLICT (code) DO NOTHING;

-- Seed baseline active pricing rules (v1) preserving 0 ETB for Farm Gate Pickup and realistic defaults
INSERT INTO delivery_pricing_rules (
  rule_name, delivery_method, zone_type, version, is_active,
  base_fee, per_km_rate, min_fee, max_fee, free_weight_kg, per_kg_rate,
  fragile_surcharge, cold_chain_surcharge, packaging_fee, remote_area_surcharge,
  same_day_surcharge, driver_base_payout, driver_per_km_payout, driver_per_kg_payout,
  platform_logistics_share_pct, disclosure_note
)
SELECT * FROM (VALUES
  ('Farm Gate Pickup Standard v1', 'farmer_pickup', NULL, 1, TRUE, 0.00, 0.00, 0.00, 0.00, 99999.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 'Free pickup directly at verified farmer branch'),
  ('Farmer Direct Delivery Default v1', 'farmer_delivery', NULL, 1, TRUE, 35.00, 1.50, 50.00, 2500.00, 25.00, 0.65, 15.00, 25.00, 10.00, 45.00, 25.00, 0.00, 0.00, 0.00, 0.00, 'Calculated from origin branch distance, cargo weight above 25 kg, and handling tier'),
  ('GreenHarvest Courier Fleet Default v1', 'delivery_partner', NULL, 1, TRUE, 45.00, 2.20, 65.00, 4500.00, 20.00, 0.90, 20.00, 35.00, 15.00, 60.00, 35.00, 35.00, 1.60, 0.60, 22.00, 'Transparent distance + cargo weight + zone handling rate; courier earnings ledgered separately'),
  ('Courier Urban Addis Rate v1', 'delivery_partner', 'urban', 1, TRUE, 40.00, 2.50, 60.00, 1800.00, 20.00, 0.85, 15.00, 30.00, 10.00, 0.00, 30.00, 32.00, 1.80, 0.55, 20.00, 'Addis Ababa Metro courier rate')
) AS v(
  rule_name, delivery_method, zone_type, version, is_active,
  base_fee, per_km_rate, min_fee, max_fee, free_weight_kg, per_kg_rate,
  fragile_surcharge, cold_chain_surcharge, packaging_fee, remote_area_surcharge,
  same_day_surcharge, driver_base_payout, driver_per_km_payout, driver_per_kg_payout,
  platform_logistics_share_pct, disclosure_note
)
WHERE NOT EXISTS (SELECT 1 FROM delivery_pricing_rules LIMIT 1);

-- ============================================================
-- 9. BACKFILL EXISTING FARMERS, INVENTORY, SUBORDERS & ESCROW
-- ============================================================

-- A. Ensure every existing farmer has a farmer_businesses row
INSERT INTO farmer_businesses (farmer_id, business_name, verification_status, operating_status, payout_bank_name, payout_account_number, payout_account_holder)
SELECT
  u.id,
  COALESCE(fp.farm_name, u.name || ' Agricultural Business'),
  CASE
    WHEN u.kyc_status IN ('approved', 'verified') THEN 'verified'
    WHEN u.kyc_status IN ('rejected') THEN 'rejected'
    WHEN u.kyc_status IN ('under_review') THEN 'under_review'
    ELSE 'verified'
  END,
  CASE WHEN u.account_status IN ('suspended', 'banned') THEN 'suspended' ELSE 'active' END,
  fp.bank_name,
  fp.bank_account_number,
  u.name
FROM users u
LEFT JOIN farmer_profiles fp ON fp.user_id = u.id
WHERE u.role = 'farmer'
ON CONFLICT (farmer_id) DO NOTHING;

-- B. Ensure every existing farmer has a primary verified Main Farm branch
INSERT INTO farmer_branches (
  business_id, farmer_id, branch_code, name, branch_type,
  physical_address, region, woreda, kebele, contact_name, contact_phone, contact_email,
  verification_status, operational_status, is_primary, is_preferred, verified_at, special_instructions
)
SELECT
  fb.id,
  u.id,
  'BR-' || u.id || '-MAIN',
  COALESCE(fp.farm_name, u.name) || ' - Main Farm',
  'main_farm',
  COALESCE(NULLIF(fp.pickup_address, ''), NULLIF(fp.farm_location, ''), NULLIF(u.address, ''), 'Ethiopia Central Hub'),
  COALESCE(fp.region, 'Oromia'),
  fp.woreda,
  fp.kebele,
  u.name,
  u.phone,
  u.email,
  'verified',
  CASE WHEN u.account_status IN ('suspended', 'banned') THEN 'suspended' ELSE 'active' END,
  TRUE,
  TRUE,
  NOW(),
  fp.pickup_instructions
FROM users u
JOIN farmer_businesses fb ON fb.farmer_id = u.id
LEFT JOIN farmer_profiles fp ON fp.user_id = u.id
WHERE u.role = 'farmer'
  AND NOT EXISTS (SELECT 1 FROM farmer_branches br WHERE br.farmer_id = u.id AND br.is_primary = TRUE);

-- C. Backfill branch_inventory from existing global inventory rows into each farmer's primary branch
INSERT INTO branch_inventory (
  branch_id, product_id, farmer_id, is_available,
  on_hand_quantity, available_quantity, harvest_date, freshness_grade, updated_at
)
SELECT
  br.id,
  inv.product_id,
  inv.farmer_id,
  TRUE,
  COALESCE(inv.quantity, 0),
  COALESCE(inv.quantity, 0),
  p.harvest_date,
  p.grade,
  NOW()
FROM inventory inv
JOIN products p ON p.id = inv.product_id
JOIN farmer_branches br ON br.farmer_id = inv.farmer_id AND br.is_primary = TRUE
ON CONFLICT (branch_id, product_id) DO NOTHING;

-- D. Link historical suborders, order_items, deliveries & escrow_ledger to primary branch without erasing history
UPDATE suborders s
SET
  branch_id = br.id,
  branch_snapshot = jsonb_build_object(
    'branch_id', br.id,
    'branch_code', br.branch_code,
    'branch_name', br.name,
    'physical_address', br.physical_address,
    'region', br.region
  )
FROM farmer_branches br
WHERE br.farmer_id = s.farmer_id
  AND br.is_primary = TRUE
  AND s.branch_id IS NULL;

UPDATE order_items oi
SET
  branch_id = so.branch_id,
  branch_name = br.name
FROM suborders so
LEFT JOIN farmer_branches br ON br.id = so.branch_id
WHERE oi.suborder_id = so.id
  AND oi.branch_id IS NULL;

UPDATE deliveries d
SET branch_id = so.branch_id
FROM suborders so
WHERE d.suborder_id = so.id
  AND d.branch_id IS NULL;

UPDATE escrow_ledger el
SET branch_id = so.branch_id
FROM suborders so
WHERE el.suborder_id = so.id
  AND el.branch_id IS NULL;

-- E. Sync branch_inventory changes automatically to aggregate inventory -> products.stock
CREATE OR REPLACE FUNCTION sync_aggregate_inventory_from_branches()
RETURNS TRIGGER AS $$
DECLARE
  v_product_id BIGINT;
  v_farmer_id BIGINT;
  v_total NUMERIC(12,2);
BEGIN
  v_product_id := COALESCE(NEW.product_id, OLD.product_id);
  v_farmer_id := COALESCE(NEW.farmer_id, OLD.farmer_id);

  -- Skip aggregate upsert if parent product is currently being cascade-deleted
  IF NOT EXISTS (SELECT 1 FROM products WHERE id = v_product_id) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(SUM(bi.available_quantity), 0)
  INTO v_total
  FROM branch_inventory bi
  JOIN farmer_branches fb ON fb.id = bi.branch_id
  WHERE bi.product_id = v_product_id
    AND bi.is_available = TRUE
    AND fb.verification_status = 'verified'
    AND fb.operational_status IN ('active', 'busy')
    AND fb.service_available = TRUE;

  INSERT INTO inventory (product_id, farmer_id, quantity, last_updated)
  VALUES (v_product_id, v_farmer_id, GREATEST(0, FLOOR(v_total))::int, NOW())
  ON CONFLICT (product_id) DO UPDATE
    SET quantity = GREATEST(0, FLOOR(v_total))::int,
        last_updated = NOW();

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_aggregate_branch_inventory ON branch_inventory;
CREATE TRIGGER trg_sync_aggregate_branch_inventory
AFTER INSERT OR UPDATE OR DELETE ON branch_inventory
FOR EACH ROW
EXECUTE FUNCTION sync_aggregate_inventory_from_branches();

COMMIT;
