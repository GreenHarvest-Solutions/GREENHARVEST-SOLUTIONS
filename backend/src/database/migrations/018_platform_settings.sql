-- 018_platform_settings.sql
-- Global platform settings with change history and auditability.

-- 1. Platform Settings Key-Value Table
CREATE TABLE IF NOT EXISTS platform_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Platform Settings History (audit trail of all config mutations)
CREATE TABLE IF NOT EXISTS settings_history (
  id BIGSERIAL PRIMARY KEY,
  key VARCHAR(100) NOT NULL,
  old_value JSONB,
  new_value JSONB NOT NULL,
  changed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settings_history_key ON settings_history(key);
CREATE INDEX IF NOT EXISTS idx_settings_history_created_at ON settings_history(created_at DESC);

-- 3. Seed Default Platform Settings
INSERT INTO platform_settings (key, value, updated_at) VALUES
  ('commission_rate', '{"value": 5.0, "unit": "%", "description": "Platform marketplace commission on completed orders"}'::jsonb, NOW()),
  ('escrow_hold_hours', '{"value": 48, "unit": "hours", "description": "Buyer inspection hold window prior to automated farmer release"}'::jsonb, NOW()),
  ('auto_verify_farmers', '{"value": false, "description": "Automated verification for provisional smallholder producers"}'::jsonb, NOW()),
  ('maintenance_mode', '{"value": false, "description": "Platform global maintenance switch"}'::jsonb, NOW()),
  ('cold_chain_temp_min', '{"value": 2.0, "unit": "celsius", "description": "Standard refrigerated reefer lower thermal boundary"}'::jsonb, NOW()),
  ('cold_chain_temp_max', '{"value": 6.0, "unit": "celsius", "description": "Standard refrigerated reefer upper thermal boundary"}'::jsonb, NOW())
ON CONFLICT (key) DO NOTHING;
