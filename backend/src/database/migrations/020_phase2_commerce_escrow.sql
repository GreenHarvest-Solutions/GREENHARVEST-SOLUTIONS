-- 020_phase2_commerce_escrow.sql
-- Migration for Phase 2: Commerce, Payments, Escrow, Disputes, and Returns

-- 1. Add granular permissions for Commerce, Payments, Escrow, and Returns
INSERT INTO permissions (code, name, category, description)
VALUES
  ('orders.read', 'View Orders', 'Commerce', 'Access order lists, invoices, and fulfillment details'),
  ('orders.manage', 'Manage Orders', 'Commerce', 'Override order statuses, cancel orders, update delivery links'),
  ('orders.refund', 'Issue Refunds', 'Commerce', 'Authorize full or partial refunds on customer orders'),
  ('payments.read', 'View Payments & Ledger', 'Commerce', 'Inspect payment transaction logs, gateway slips, and reconciliations'),
  ('payments.manage', 'Reconcile Payments', 'Commerce', 'Mark transactions reconciled, dispute gateway settlements'),
  ('escrow.read', 'View Escrow Balances', 'Commerce', 'Access held balances, release countdowns, and clearinghouse ledgers'),
  ('escrow.release', 'Release Escrow Payouts', 'Commerce', 'Approve and trigger escrow disbursements to farmers and cooperatives'),
  ('returns.read', 'View Returns', 'Commerce', 'Inspect return shipments, restock logs, and return claims'),
  ('returns.manage', 'Manage Returns', 'Commerce', 'Update return warehouse inspection states and restock inventory')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description;

-- Grant all permissions to super_admin (role_id = 1)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, p.id FROM permissions p
WHERE p.code IN (
  'orders.read', 'orders.manage', 'orders.refund',
  'payments.read', 'payments.manage',
  'escrow.read', 'escrow.release',
  'returns.read', 'returns.manage'
)
ON CONFLICT DO NOTHING;

-- Grant commerce & escrow permissions to finance role (role_id = 3)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 3, p.id FROM permissions p
WHERE p.code IN (
  'orders.read', 'orders.refund',
  'payments.read', 'payments.manage',
  'escrow.read', 'escrow.release',
  'disputes.read', 'disputes.resolve',
  'returns.read'
)
ON CONFLICT DO NOTHING;

-- Grant read and return inspection permissions to operations role (role_id = 2)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 2, p.id FROM permissions p
WHERE p.code IN (
  'orders.read', 'disputes.read', 'returns.read', 'returns.manage'
)
ON CONFLICT DO NOTHING;

-- 2. Enhance Orders Table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS refund_reason TEXT,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS refunded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 3. Enhance Payments Table
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS reference_number VARCHAR(128),
  ADD COLUMN IF NOT EXISTS gateway_name VARCHAR(64) DEFAULT 'telebirr',
  ADD COLUMN IF NOT EXISTS gateway_response JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS reconciled_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS refund_status VARCHAR(32) DEFAULT 'none';

-- 4. Create Escrow Ledger Table
CREATE TABLE IF NOT EXISTS escrow_ledger (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  buyer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  farmer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  escrow_amount NUMERIC(12,2) NOT NULL,
  platform_fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  farmer_payout_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  buyer_refund_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  hold_until TIMESTAMP WITH TIME ZONE,
  release_status VARCHAR(32) NOT NULL DEFAULT 'held', -- 'held', 'cleared', 'refunded', 'split_settled', 'disputed'
  released_at TIMESTAMP WITH TIME ZONE,
  released_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  maker_checker_approved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_escrow_amounts CHECK (
    escrow_amount >= 0 AND platform_fee_amount >= 0 AND farmer_payout_amount >= 0 AND buyer_refund_amount >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_escrow_order_id ON escrow_ledger(order_id);
CREATE INDEX IF NOT EXISTS idx_escrow_farmer_id ON escrow_ledger(farmer_id);
CREATE INDEX IF NOT EXISTS idx_escrow_release_status ON escrow_ledger(release_status);

-- 5. Enhance Returns & Disputes Table
ALTER TABLE returns
  ADD COLUMN IF NOT EXISTS dispute_category VARCHAR(64) DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS evidence_image_urls JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS weighbridge_slip_url TEXT,
  ADD COLUMN IF NOT EXISTS settlement_split JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS settled_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS arbitration_notes TEXT,
  ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(128),
  ADD COLUMN IF NOT EXISTS carrier_name VARCHAR(128),
  ADD COLUMN IF NOT EXISTS return_received_at TIMESTAMP WITH TIME ZONE;

-- Expand returns_status_check to support warehouse return processing
ALTER TABLE returns DROP CONSTRAINT IF EXISTS returns_status_check;
ALTER TABLE returns ADD CONSTRAINT returns_status_check CHECK (status::text = ANY (ARRAY['pending', 'accepted', 'rejected', 'received', 'restocked']));

-- 6. Seed Escrow Records & Payments for Existing Orders if empty
DO $$
DECLARE
  ord RECORD;
  v_farmer_id BIGINT;
  v_escrow_amt NUMERIC(12,2);
  v_fee_amt NUMERIC(12,2);
  v_payout_amt NUMERIC(12,2);
BEGIN
  FOR ord IN SELECT id, buyer_id, total_price, order_status, payment_status, created_at FROM orders LOOP
    -- Find farmer from order items or default to 7
    SELECT COALESCE(p.farmer_id, 7) INTO v_farmer_id
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ord.id
    LIMIT 1;

    IF v_farmer_id IS NULL THEN
      v_farmer_id := 7;
    END IF;

    v_escrow_amt := COALESCE(ord.total_price, 200.00);
    v_fee_amt := ROUND(v_escrow_amt * 0.05, 2); -- 5% platform fee
    v_payout_amt := v_escrow_amt - v_fee_amt;

    -- Insert payment if missing
    IF NOT EXISTS (SELECT 1 FROM payments WHERE order_id = ord.id) THEN
      INSERT INTO payments (order_id, payment_method, amount, payment_status, transaction_id, reference_number, gateway_name, created_at)
      VALUES (
        ord.id,
        CASE WHEN ord.id % 2 = 0 THEN 'telebirr' ELSE 'chapa' END,
        v_escrow_amt,
        CASE WHEN ord.order_status = 'refunded' THEN 'refunded' ELSE 'paid' END,
        'TXN-' || ord.id || '-' || FLOOR(RANDOM() * 899999 + 100000)::text,
        'ET-REF-' || LPAD(ord.id::text, 6, '0'),
        CASE WHEN ord.id % 2 = 0 THEN 'telebirr' ELSE 'chapa' END,
        ord.created_at
      );
    END IF;

    -- Insert escrow ledger if missing
    IF NOT EXISTS (SELECT 1 FROM escrow_ledger WHERE order_id = ord.id) THEN
      INSERT INTO escrow_ledger (
        order_id, buyer_id, farmer_id, escrow_amount, platform_fee_amount,
        farmer_payout_amount, buyer_refund_amount, hold_until, release_status,
        released_at, created_at
      )
      VALUES (
        ord.id,
        ord.buyer_id,
        v_farmer_id,
        v_escrow_amt,
        v_fee_amt,
        CASE WHEN ord.order_status = 'refunded' THEN 0.00 ELSE v_payout_amt END,
        CASE WHEN ord.order_status = 'refunded' THEN v_escrow_amt ELSE 0.00 END,
        ord.created_at + INTERVAL '7 days',
        CASE
          WHEN ord.order_status = 'refunded' THEN 'refunded'
          WHEN ord.id IN (2, 3) THEN 'disputed'
          WHEN ord.id > 6 THEN 'held'
          ELSE 'cleared'
        END,
        CASE WHEN ord.id <= 6 AND ord.order_status != 'refunded' THEN ord.created_at + INTERVAL '3 days' ELSE NULL END,
        ord.created_at
      );
    END IF;
  END LOOP;
END $$;

-- 7. Backfill Dispute Categories & Rich Evidence for Existing Returns
UPDATE returns
SET
  dispute_category = CASE
    WHEN id = 1 THEN 'transit_spoilage'
    WHEN id = 2 THEN 'weight_shortage'
    WHEN id = 3 THEN 'transit_spoilage'
    WHEN id = 4 THEN 'weight_shortage'
    ELSE 'grade_mismatch'
  END,
  weighbridge_slip_url = CASE
    WHEN id IN (2, 4) THEN 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&q=80'
    ELSE NULL
  END,
  evidence_image_urls = CASE
    WHEN id = 1 THEN '["https://images.unsplash.com/photo-1528750997573-59b89d56f4f7?w=800&q=80", "https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&q=80"]'::jsonb
    WHEN id = 2 THEN '["https://images.unsplash.com/photo-1519162584292-56dfc9eb5db4?w=800&q=80"]'::jsonb
    WHEN id = 3 THEN '["https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=800&q=80"]'::jsonb
    WHEN id = 4 THEN '["https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&q=80"]'::jsonb
    ELSE '[]'::jsonb
  END,
  tracking_number = CASE
    WHEN id = 1 THEN 'GH-RET-AA-9921'
    WHEN id = 2 THEN 'GH-RET-DZ-4102'
    WHEN id = 3 THEN 'GH-RET-BD-7819'
    WHEN id = 4 THEN 'GH-RET-HW-3301'
    ELSE 'GH-RET-000'
  END,
  carrier_name = 'Ethio Post Agro-Logistics'
WHERE tracking_number IS NULL;
