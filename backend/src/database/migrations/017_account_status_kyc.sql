-- 017_account_status_kyc.sql
-- Add users account_status, kyc_status, kyc_tier, suspension tracking, and KYC models.

-- 1. Extend users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(30) NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(30) NOT NULL DEFAULT 'not_submitted';
ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_tier VARCHAR(50) DEFAULT 'provisional';
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

-- Safely add constraints if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_account_status_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_account_status_check
      CHECK (account_status IN ('active', 'pending', 'suspended', 'banned', 'deactivated'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_kyc_status_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_kyc_status_check
      CHECK (kyc_status IN ('not_submitted', 'pending', 'under_review', 'approved', 'rejected', 'reverification_required'));
  END IF;
END $$;

-- Backfill kyc_status and kyc_tier based on existing data
UPDATE users
SET
  kyc_status = CASE
    WHEN role = 'farmer' AND is_verified = TRUE THEN 'approved'
    WHEN role = 'farmer' AND (is_verified = FALSE OR is_verified IS NULL) THEN 'pending'
    ELSE 'approved'
  END,
  kyc_tier = CASE
    WHEN role = 'farmer' AND is_verified = TRUE THEN 'tier_1'
    ELSE 'provisional'
  END
WHERE kyc_status = 'not_submitted' OR kyc_status IS NULL;

-- 2. KYC Documents
CREATE TABLE IF NOT EXISTS kyc_documents (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type VARCHAR(100) NOT NULL,
  document_url TEXT NOT NULL,
  public_id VARCHAR(255),
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  reviewer_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kyc_documents_user ON kyc_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_status ON kyc_documents(status);

-- 3. KYC Reviews
CREATE TABLE IF NOT EXISTS kyc_reviews (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewer_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  decision VARCHAR(50) NOT NULL CHECK (decision IN ('approve', 'reject', 'request_info')),
  tier VARCHAR(50),
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kyc_reviews_user ON kyc_reviews(user_id);

-- 4. Field Visits
CREATE TABLE IF NOT EXISTS field_visits (
  id BIGSERIAL PRIMARY KEY,
  farmer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  findings TEXT,
  gps_coordinates VARCHAR(100),
  verified_crops TEXT[],
  recommendation VARCHAR(50) CHECK (recommendation IN ('approve', 'reject', 'follow_up')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_field_visits_farmer ON field_visits(farmer_id);

