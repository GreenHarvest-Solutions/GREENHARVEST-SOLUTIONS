-- Migration: 024_auth_security_refactor.sql
-- Description: Disentangles email verification from farmer KYC accreditation,
-- adds soft deletion for products to prevent order consistency failures,
-- establishes indexes for marketplace eligibility gating, and records the grandfathered catalog baseline.

-- 1. Disentangle email verification from users.is_verified
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: Any user who was marked as verified retains email verification
UPDATE users
SET email_verified = TRUE
WHERE is_verified = TRUE;

-- 2. Add soft deletion timestamp to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 3. Create performance indexes for marketplace and user security gating
CREATE INDEX IF NOT EXISTS idx_users_account_status ON users(account_status);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);
CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON products(deleted_at);
CREATE INDEX IF NOT EXISTS idx_products_eligibility ON products(status, moderation_status, deleted_at);

-- 4. Baseline Grandfathering for Existing Catalog Listings
-- Active products from active farmers remain approved and live
UPDATE products p
SET 
  status = 'active',
  moderation_status = 'approved',
  moderation_reason = COALESCE(p.moderation_reason, 'Grandfathered baseline catalog')
FROM users u
WHERE p.farmer_id = u.id
  AND p.deleted_at IS NULL
  AND u.account_status = 'active'
  AND (p.moderation_status IS NULL OR p.moderation_status = 'approved');

-- Inactive, rejected, or products belonging to suspended/banned farmers are deactivated
UPDATE products p
SET 
  status = 'deactivated',
  moderation_status = 'rejected',
  moderation_reason = COALESCE(p.moderation_reason, 'Restricted: Farmer account not in active standing')
FROM users u
WHERE p.farmer_id = u.id
  AND (u.account_status IN ('suspended', 'banned', 'deactivated') OR p.status = 'deactivated');
