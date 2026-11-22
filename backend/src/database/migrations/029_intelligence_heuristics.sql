-- ==============================================================================
-- Migration 029: Intelligence Heuristics, Image Hashing, and OCR Metadata
-- Supports Phase 6: Local Intelligence & Document Processing
-- ==============================================================================

-- 1. Extend kyc_documents with confidence and processing timestamps
ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS ocr_confidence NUMERIC(5,2);
ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS ocr_processed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_kyc_documents_id_hash ON kyc_documents(id_hash);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_ocr_processed ON kyc_documents(ocr_processed_at);

-- 2. Extend products with perceptual image hash and full text vector
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_hash VARCHAR(64);
ALTER TABLE products ADD COLUMN IF NOT EXISTS title_vector tsvector;
CREATE INDEX IF NOT EXISTS idx_products_image_hash ON products(image_hash);
CREATE INDEX IF NOT EXISTS idx_products_title_vector ON products USING gin(title_vector);

-- Automatically maintain title_vector on products
CREATE OR REPLACE FUNCTION update_products_title_vector() RETURNS trigger AS $$
BEGIN
    NEW.title_vector := to_tsvector('english', COALESCE(NEW.name, '') || ' ' || COALESCE(NEW.description, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_title_vector ON products;
CREATE TRIGGER trg_products_title_vector
    BEFORE INSERT OR UPDATE OF name, description ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_products_title_vector();

-- 3. Extend product_images with image hash
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS image_hash VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_product_images_image_hash ON product_images(image_hash);

-- 4. Extend risk_flags for automated intelligence heuristics
ALTER TABLE risk_flags ADD COLUMN IF NOT EXISTS flag_type VARCHAR(100);
ALTER TABLE risk_flags ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(5,2);
CREATE INDEX IF NOT EXISTS idx_risk_flags_entity ON risk_flags(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_risk_flags_severity_status ON risk_flags(severity, status);
CREATE INDEX IF NOT EXISTS idx_risk_flags_flag_type ON risk_flags(flag_type);

