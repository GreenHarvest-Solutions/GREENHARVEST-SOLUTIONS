-- Migration 015: Enhance Farmer Experience (Farmer profiles and extended product agricultural attributes)

-- 1) Extend farmer_profiles table
ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS farm_location VARCHAR(200);
ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS farm_size VARCHAR(100);
ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS experience_years INTEGER;

-- 2) Extend products table with agricultural logistics and batching columns
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit VARCHAR(50) DEFAULT 'kg';
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_order_quantity NUMERIC(10, 2) DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS harvest_date DATE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS shelf_life_days INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_organic BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS images TEXT[];

-- Update existing products default images array from image_url if images is null
UPDATE products
SET images = ARRAY[image_url]
WHERE (images IS NULL OR cardinality(images) = 0) AND image_url IS NOT NULL;
