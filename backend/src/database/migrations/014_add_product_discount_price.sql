-- Migration 014: Add discount_price column to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS discount_price NUMERIC(10, 2);

COMMENT ON COLUMN products.discount_price IS 'Promotional discount price in ETB, must be less than regular price';
