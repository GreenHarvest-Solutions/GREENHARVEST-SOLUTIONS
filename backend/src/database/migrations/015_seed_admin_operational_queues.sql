-- Migration: 015_seed_admin_operational_queues.sql
-- Seed pending farmer KYC records, pending produce batches, and active dispute records in PostgreSQL

-- 1. Insert Pending Farmers (is_verified = false)
INSERT INTO users (name, email, password, role, role_id, is_verified, phone, address, created_at, updated_at, mfa_enabled)
VALUES 
('Alemayehu Tadesse', 'alemayehu@bishoftuorganics.et', '$2b$10$rC815qYpEfg90dDkW2nQseFzT8zWj1vT2yS1L0Oq8kQ7q1aB2c3d4', 'farmer', 2, false, '+251 91 148 1920', 'Bishoftu, Oromia', NOW() - INTERVAL '2 hours', NOW(), false),
('Marta Haile', 'marta@awashorchards.com', '$2b$10$rC815qYpEfg90dDkW2nQseFzT8zWj1vT2yS1L0Oq8kQ7q1aB2c3d4', 'farmer', 2, false, '+251 92 882 9101', 'Awash Basin, Afar', NOW() - INTERVAL '5 hours', NOW(), false),
('Dawit Bekele', 'dawit@kokagreenhouse.et', '$2b$10$rC815qYpEfg90dDkW2nQseFzT8zWj1vT2yS1L0Oq8kQ7q1aB2c3d4', 'farmer', 2, false, '+251 93 193 0212', 'Lake Koka Region', NOW() - INTERVAL '1 day', NOW(), false)
ON CONFLICT (email) DO NOTHING;

-- Associate profiles
INSERT INTO farmer_profiles (user_id, farm_name, farm_type, bio)
SELECT id, 'Bishoftu Valley Organics', 'Highland Vegetables & Herbs', 'Specializing in export-grade highland kale, carrots, and organic herbs.'
FROM users WHERE email = 'alemayehu@bishoftuorganics.et'
ON CONFLICT DO NOTHING;

INSERT INTO farmer_profiles (user_id, farm_name, farm_type, bio)
SELECT id, 'Awash Rift Orchards', 'Citrus, Papayas & Melons', 'Irrigated commercial fruit orchard located along the Awash River.'
FROM users WHERE email = 'marta@awashorchards.com'
ON CONFLICT DO NOTHING;

INSERT INTO farmer_profiles (user_id, farm_name, farm_type, bio)
SELECT id, 'Koka Greenhouse Produce', 'Hydroponic Tomatoes & Peppers', 'Controlled environment greenhouse producer with international standard certifications.'
FROM users WHERE email = 'dawit@kokagreenhouse.et'
ON CONFLICT DO NOTHING;

-- 2. Insert Pending Produce Batches (status = 'draft')
INSERT INTO products (name, description, price, stock, category_id, farmer_id, status, created_at)
SELECT 'Grade-A Export Red Onions', 'Crisp, export-standard red onions packed in 25kg ventilated mesh bags.', 65.00, 2500, 1, id, 'draft', NOW() - INTERVAL '1 hour'
FROM users WHERE email = 'alemayehu@bishoftuorganics.et'
ON CONFLICT DO NOTHING;

INSERT INTO products (name, description, price, stock, category_id, farmer_id, status, created_at)
SELECT 'Certified Organic Strawberries', 'Highland hand-picked strawberries with continuous cold-chain requirement.', 180.00, 800, 2, id, 'draft', NOW() - INTERVAL '3 hours'
FROM users WHERE email = 'alemayehu@bishoftuorganics.et'
ON CONFLICT DO NOTHING;

INSERT INTO products (name, description, price, stock, category_id, farmer_id, status, created_at)
SELECT 'Bulk Hass Avocados (Class 1)', 'Commercial bulk order export-grade Hass avocados ready for distribution.', 95.00, 4000, 2, id, 'draft', NOW() - INTERVAL '6 hours'
FROM users WHERE email = 'marta@awashorchards.com'
ON CONFLICT DO NOTHING;

-- 3. Insert Active Returns / Disputes
INSERT INTO returns (order_id, farmer_id, buyer_id, reason, status, refund_status, created_at)
SELECT 2, 7, 4, 'Temperature fluctuation during transit resulted in bruised produce boxes.', 'pending', 'pending', NOW() - INTERVAL '4 hours'
WHERE EXISTS (SELECT 1 FROM orders WHERE id = 2)
ON CONFLICT DO NOTHING;

INSERT INTO returns (order_id, farmer_id, buyer_id, reason, status, refund_status, created_at)
SELECT 3, 6, 4, 'Weight discrepancy: 450kg received vs 500kg invoiced at delivery.', 'pending', 'none', NOW() - INTERVAL '8 hours'
WHERE EXISTS (SELECT 1 FROM orders WHERE id = 3)
ON CONFLICT DO NOTHING;
