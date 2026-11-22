-- 028_fulfillment_workflows.sql
-- Phase 5: Local Payments & Three-Way Fulfillment Workflows

-- 1. Enhance deliveries table for Three-Way Fulfillment
ALTER TABLE deliveries
  DROP CONSTRAINT IF EXISTS deliveries_order_id_key,
  DROP CONSTRAINT IF EXISTS deliveries_delivery_status_check,
  DROP CONSTRAINT IF EXISTS deliveries_status_check;

ALTER TABLE deliveries
  ALTER COLUMN delivery_person_id DROP NOT NULL,
  ALTER COLUMN delivery_partner_id DROP NOT NULL,
  ALTER COLUMN delivery_address DROP NOT NULL,
  ALTER COLUMN delivery_location DROP NOT NULL;

ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS suborder_id BIGINT REFERENCES suborders(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS fulfillment_type VARCHAR(50) DEFAULT 'farmer_pickup',
  ADD COLUMN IF NOT EXISTS pickup_verification_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS delivery_confirmation_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS proof_of_delivery_image_url TEXT,
  ADD COLUMN IF NOT EXISTS farmer_notes TEXT,
  ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- Re-add flexible status constraint
ALTER TABLE deliveries
  ADD CONSTRAINT chk_delivery_status CHECK (
    status IN (
      'pending', 'assigned', 'ready_for_pickup', 'picked_up',
      'processing', 'shipped', 'out for delivery', 'in_transit',
      'delivered', 'cancelled'
    )
  );

CREATE INDEX IF NOT EXISTS idx_deliveries_suborder_id ON deliveries(suborder_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_fulfillment_type ON deliveries(fulfillment_type);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);

-- 2. Enhance payments table with idempotency & gateway metadata
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128),
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'ETB',
  ADD COLUMN IF NOT EXISTS suborder_id BIGINT REFERENCES suborders(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_idempotency_key
  ON payments(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_reference_number
  ON payments(reference_number);

-- 3. Enhance escrow_ledger with suborder support
ALTER TABLE escrow_ledger
  ADD COLUMN IF NOT EXISTS suborder_id BIGINT REFERENCES suborders(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_escrow_suborder_id ON escrow_ledger(suborder_id);

-- 4. Allow both snake_case and camelCase delivery roles in users
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (
  role IN ('buyer', 'farmer', 'admin', 'fieldAgent', 'field_agent', 'deliveryPartner', 'delivery_partner', 'delivery')
);
