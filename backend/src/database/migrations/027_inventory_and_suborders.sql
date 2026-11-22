-- Migration 027: Authoritative Inventory, Stock Reservations & Multi-Vendor Suborders
-- Author: GreenHarvest Engineering
-- Purpose: Consolidate inventory into a single source of truth, add stock reservations with TTL,
--          implement multi-vendor suborders, and freeze immutable product snapshots on order_items.

BEGIN;

-- 1. Ensure inventory has records for all products
INSERT INTO inventory (product_id, farmer_id, quantity, last_updated)
SELECT p.id, p.farmer_id, COALESCE(p.stock, 0), NOW()
FROM products p
LEFT JOIN inventory i ON i.product_id = p.id
WHERE i.id IS NULL
ON CONFLICT (product_id) DO NOTHING;

-- 2. Real-time Inventory-to-Product Sync Trigger
CREATE OR REPLACE FUNCTION sync_product_stock_from_inventory()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE products
    SET stock = NEW.quantity
    WHERE id = NEW.product_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_product_stock ON inventory;
CREATE TRIGGER trg_sync_product_stock
AFTER INSERT OR UPDATE OF quantity ON inventory
FOR EACH ROW
EXECUTE FUNCTION sync_product_stock_from_inventory();

-- 3. Orders Table Extension: Human-readable order number
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS order_number VARCHAR(50) UNIQUE;

UPDATE orders
SET order_number = 'ORD-' || LPAD(id::text, 6, '0')
WHERE order_number IS NULL;

-- 4. Stock Reservations Table
CREATE TABLE IF NOT EXISTS stock_reservations (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    status VARCHAR(32) NOT NULL DEFAULT 'reserved', -- 'reserved', 'consumed', 'released'
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_res_status_exp ON stock_reservations(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_stock_res_order ON stock_reservations(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_res_product ON stock_reservations(product_id);

-- 5. Multi-Vendor Suborders Table (Farmer-Specific Fulfillment Units)
CREATE TABLE IF NOT EXISTS suborders (
    id BIGSERIAL PRIMARY KEY,
    parent_order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    farmer_id BIGINT NOT NULL REFERENCES users(id),
    suborder_number VARCHAR(50) NOT NULL UNIQUE,
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    shipping_fee NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    fulfillment_type VARCHAR(50) NOT NULL DEFAULT 'farmer_pickup', -- 'farmer_pickup', 'farmer_delivery', 'delivery_partner'
    fulfillment_status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'packed', 'dispatched', 'delivered', 'cancelled'
    pickup_code VARCHAR(20),
    delivery_partner_id BIGINT REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suborders_parent ON suborders(parent_order_id);
CREATE INDEX IF NOT EXISTS idx_suborders_farmer ON suborders(farmer_id);
CREATE INDEX IF NOT EXISTS idx_suborders_status ON suborders(fulfillment_status);

-- 6. Extend order_items for suborder linkage and immutable product snapshots
ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS suborder_id BIGINT REFERENCES suborders(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS product_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS product_image_url TEXT,
    ADD COLUMN IF NOT EXISTS unit VARCHAR(30) DEFAULT 'kg',
    ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS farmer_id BIGINT REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS farmer_name VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_order_items_suborder ON order_items(suborder_id);

-- 7. Backfill Historical Snapshots for Existing order_items
UPDATE order_items oi
SET
    product_name = COALESCE(oi.product_name, p.name, 'Agricultural Product'),
    product_image_url = COALESCE(oi.product_image_url, p.image_url),
    unit = COALESCE(oi.unit, p.unit, 'kg'),
    unit_price = COALESCE(oi.unit_price, oi.price),
    farmer_id = COALESCE(oi.farmer_id, p.farmer_id),
    farmer_name = COALESCE(oi.farmer_name, u.name, 'Producer')
FROM products p
LEFT JOIN users u ON u.id = p.farmer_id
WHERE p.id = oi.product_id;

-- 8. Backfill Suborders for Existing Historical Orders
INSERT INTO suborders (parent_order_id, farmer_id, suborder_number, subtotal, total_amount, fulfillment_status, created_at)
SELECT
    oi.order_id,
    COALESCE(oi.farmer_id, p.farmer_id),
    'SUB-' || oi.order_id || '-' || COALESCE(oi.farmer_id, p.farmer_id),
    SUM(oi.price * oi.quantity),
    SUM(oi.price * oi.quantity),
    'delivered',
    MIN(oi.created_at)
FROM order_items oi
LEFT JOIN products p ON p.id = oi.product_id
WHERE oi.suborder_id IS NULL AND (oi.farmer_id IS NOT NULL OR p.farmer_id IS NOT NULL)
GROUP BY oi.order_id, COALESCE(oi.farmer_id, p.farmer_id)
ON CONFLICT (suborder_number) DO NOTHING;

-- Link historical order_items to newly backfilled suborders
UPDATE order_items oi
SET suborder_id = s.id
FROM suborders s
WHERE s.parent_order_id = oi.order_id 
  AND s.farmer_id = oi.farmer_id 
  AND oi.suborder_id IS NULL;

COMMIT;

