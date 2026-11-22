-- 025_farmer_onboarding_kyc.sql
-- Database extensions for progressive farmer onboarding, extended profiles, and KYC Verification Center

-- 1. Extend farmer_profiles table
ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS region VARCHAR(100);
ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS woreda VARCHAR(100);
ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS kebele VARCHAR(100);
ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS gps_coordinates VARCHAR(100);
ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS farm_size_hectares NUMERIC(10,2);
ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS farming_type VARCHAR(50);
ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS primary_crops TEXT[];
ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS id_number VARCHAR(100);
ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS id_type VARCHAR(50);
ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);
ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(100);
ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS pickup_address TEXT;
ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS pickup_instructions TEXT;
ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Extend kyc_documents table
ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS document_category VARCHAR(50) DEFAULT 'identity';
ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS ocr_raw_text TEXT;
ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS extracted_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS id_hash VARCHAR(64);
ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_kyc_docs_user_type ON kyc_documents(user_id, document_type);
CREATE INDEX IF NOT EXISTS idx_kyc_docs_category ON kyc_documents(document_category);

-- 3. Update users table kyc_status constraint to include 'changes_requested' and 'field_visit'
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_kyc_status_check') THEN
    ALTER TABLE users DROP CONSTRAINT users_kyc_status_check;
  END IF;
  ALTER TABLE users ADD CONSTRAINT users_kyc_status_check
    CHECK (kyc_status IN ('not_submitted', 'pending', 'under_review', 'approved', 'rejected', 'changes_requested', 'reverification_required', 'field_visit'));
END $$;

