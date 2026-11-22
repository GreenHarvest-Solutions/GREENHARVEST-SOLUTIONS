-- Migration: 023_risk_reports_system.sql
-- Description: Creates risk_rules, risk_flags, report_jobs, report_schedules, system_events, job_runs, and seeds baseline data.

BEGIN;

-- 1. Create Granular Permissions
INSERT INTO permissions (code, name, category, description)
VALUES
  ('risk.read', 'View Risk & Fraud Flags', 'Risk', 'Inspect platform risk flags, anomalies, and fraud detection queues'),
  ('risk.manage', 'Manage Risk Rules & Resolve Flags', 'Risk', 'Configure heuristic detection thresholds and resolve risk investigations'),
  ('reports.read', 'View Platform Reports', 'Analytics', 'Access commercial, cold-chain, and governance report summaries'),
  ('reports.export', 'Generate Data Exports', 'Analytics', 'Execute and download CSV/data export jobs across platform domains'),
  ('system.health.read', 'View System Health & Telemetry', 'System', 'Inspect database latency, queue backlogs, failed webhooks, and background worker jobs')
ON CONFLICT (code) DO NOTHING;

-- Grant permissions to Super Admin, Operations, Finance, Analyst
INSERT INTO role_permissions (role_id, permission_id)
SELECT ar.id, p.id
FROM admin_roles ar
CROSS JOIN permissions p
WHERE (
  (ar.name = 'super_admin') OR
  (ar.name = 'operations' AND p.code IN ('risk.read', 'risk.manage', 'reports.read', 'reports.export')) OR
  (ar.name = 'finance' AND p.code IN ('risk.read', 'reports.read', 'reports.export')) OR
  (ar.name = 'analyst' AND p.code IN ('reports.read', 'reports.export', 'system.health.read'))
)
ON CONFLICT DO NOTHING;

-- 2. Create risk_rules table
CREATE TABLE IF NOT EXISTS risk_rules (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  rule_type VARCHAR(50) NOT NULL,
  description TEXT,
  severity VARCHAR(20) NOT NULL DEFAULT 'medium',
  threshold_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  action VARCHAR(50) DEFAULT 'flag_for_review',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_rules_type ON risk_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_risk_rules_active ON risk_rules(is_active);

-- 3. Create risk_flags table
CREATE TABLE IF NOT EXISTS risk_flags (
  id BIGSERIAL PRIMARY KEY,
  rule_id BIGINT REFERENCES risk_rules(id) ON DELETE SET NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'medium',
  flag_reason TEXT NOT NULL,
  evidence JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(30) NOT NULL DEFAULT 'flagged',
  resolution_notes TEXT,
  resolved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_flags_status ON risk_flags(status);
CREATE INDEX IF NOT EXISTS idx_risk_flags_severity ON risk_flags(severity);
CREATE INDEX IF NOT EXISTS idx_risk_flags_entity ON risk_flags(entity_type, entity_id);

-- 4. Create report_jobs table
CREATE TABLE IF NOT EXISTS report_jobs (
  id BIGSERIAL PRIMARY KEY,
  report_type VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  parameters JSONB DEFAULT '{}'::jsonb,
  format VARCHAR(20) NOT NULL DEFAULT 'csv',
  status VARCHAR(30) NOT NULL DEFAULT 'completed',
  row_count INTEGER DEFAULT 0,
  file_size_bytes INTEGER DEFAULT 0,
  download_url TEXT,
  data_preview JSONB DEFAULT '[]'::jsonb,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_jobs_type ON report_jobs(report_type);
CREATE INDEX IF NOT EXISTS idx_report_jobs_status ON report_jobs(status);

-- 5. Create report_schedules table
CREATE TABLE IF NOT EXISTS report_schedules (
  id BIGSERIAL PRIMARY KEY,
  report_type VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  cadence VARCHAR(20) NOT NULL DEFAULT 'weekly',
  recipients TEXT[] DEFAULT ARRAY[]::TEXT[],
  parameters JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create system_events table
CREATE TABLE IF NOT EXISTS system_events (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'info',
  source VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_events_type ON system_events(event_type);
CREATE INDEX IF NOT EXISTS idx_system_events_created ON system_events(created_at);

-- 7. Create job_runs table
CREATE TABLE IF NOT EXISTS job_runs (
  id BIGSERIAL PRIMARY KEY,
  job_name VARCHAR(100) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'completed',
  duration_ms INTEGER DEFAULT 0,
  records_processed INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_runs_name ON job_runs(job_name);

-- 8. Seed Risk Rules
INSERT INTO risk_rules (name, rule_type, description, severity, threshold_config, action, is_active)
VALUES
  (
    'Rapid Order Velocity Guard',
    'order_velocity',
    'Detects rapid burst purchases from a single buyer entity exceeding threshold velocity',
    'high',
    '{"max_orders_per_hour": 6, "min_aggregate_value_etb": 250000}'::jsonb,
    'flag_for_review',
    TRUE
  ),
  (
    'Corridor Price Anomaly Guard',
    'price_anomaly',
    'Flags agricultural product listings priced significantly above or below the official regional price band',
    'medium',
    '{"deviation_percentage_threshold": 35.0}'::jsonb,
    'flag_for_review',
    TRUE
  ),
  (
    'High Frequency Refund & Dispute Abuse',
    'refund_abuse',
    'Detects buyers with more than 3 return or dispute filings in a 14-day rolling window',
    'high',
    '{"max_refunds_window_days": 14, "max_disputes_count": 3}'::jsonb,
    'notify_compliance',
    TRUE
  ),
  (
    'Repeated Cold-Chain Thermal Breach',
    'repeated_cold_chain_breaches',
    'Flags carrier freight contractors experiencing more than 2 thermal excursions in 30 days',
    'critical',
    '{"max_breaches_allowed": 2, "evaluation_days": 30}'::jsonb,
    'flag_for_review',
    TRUE
  ),
  (
    'Duplicate Farmer KYC Signal',
    'duplicate_account',
    'Flags matching tax IDs, national IDs, or bank accounts across multiple farmer profiles',
    'critical',
    '{"match_fields": ["national_id", "phone", "bank_account"]}'::jsonb,
    'flag_for_review',
    TRUE
  ),
  (
    'Anomalous Review Velocity',
    'fake_review_signal',
    'Flags 5-star or 1-star ratings submitted within 60 seconds of consignment delivery completion',
    'low',
    '{"min_elapsed_seconds": 60}'::jsonb,
    'flag_for_review',
    TRUE
  )
ON CONFLICT DO NOTHING;

-- 9. Seed Initial Risk Flags
DO $$
DECLARE
  v_admin_id BIGINT;
  v_rule_1 BIGINT;
  v_rule_2 BIGINT;
  v_rule_3 BIGINT;
  v_rule_4 BIGINT;
BEGIN
  SELECT id INTO v_admin_id FROM users WHERE role = 'admin' LIMIT 1;
  SELECT id INTO v_rule_1 FROM risk_rules WHERE rule_type = 'order_velocity' LIMIT 1;
  SELECT id INTO v_rule_2 FROM risk_rules WHERE rule_type = 'price_anomaly' LIMIT 1;
  SELECT id INTO v_rule_3 FROM risk_rules WHERE rule_type = 'repeated_cold_chain_breaches' LIMIT 1;
  SELECT id INTO v_rule_4 FROM risk_rules WHERE rule_type = 'refund_abuse' LIMIT 1;

  INSERT INTO risk_flags (rule_id, entity_type, entity_id, severity, flag_reason, evidence, status, created_at)
  VALUES
    (
      v_rule_1,
      'order',
      'ORD-8402',
      'high',
      'Buyer placed 7 large-volume vegetable orders within 45 minutes amounting to ETB 385,000.',
      '{"buyer_id": 3, "orders_count": 7, "time_window_mins": 45, "total_value": 385000}'::jsonb,
      'flagged',
      NOW() - INTERVAL '3 hours'
    ),
    (
      v_rule_2,
      'product',
      'PROD-102',
      'medium',
      'Red Onion listed at ETB 145/kg, exceeding the Oromia ceiling benchmark of ETB 95/kg by 52.6%.',
      '{"listing_price": 145, "regional_cap": 95, "deviation_pct": 52.6, "region": "Oromia"}'::jsonb,
      'under_investigation',
      NOW() - INTERVAL '6 hours'
    ),
    (
      v_rule_3,
      'carrier',
      'FL-205',
      'critical',
      'Reefer truck ET-AA-9921 recorded second critical temperature spike (8.2°C) on Hawassa-Addis corridor.',
      '{"carrier_name": "Rift Valley Reefer Logistics", "vehicle_plate": "ET-AA-9921", "incidents_30d": 2}'::jsonb,
      'flagged',
      NOW() - INTERVAL '1 hour'
    );

  IF v_admin_id IS NOT NULL THEN
    INSERT INTO risk_flags (rule_id, entity_type, entity_id, severity, flag_reason, evidence, status, resolution_notes, resolved_by, resolved_at, created_at)
    VALUES
      (
        v_rule_4,
        'user',
        'USR-28',
        'medium',
        'Duplicate bank account IBAN detected across 2 unverified buyer accounts.',
        '{"bank_account": "1000293849182", "matched_user_ids": [28, 42]}'::jsonb,
        'resolved_safe',
        'Verified corporate parent cooperative operating secondary branch account legitimately.',
        v_admin_id,
        NOW() - INTERVAL '1 day',
        NOW() - INTERVAL '2 days'
      );
  END IF;
END $$;

-- 10. Seed Initial Report Jobs
INSERT INTO report_jobs (report_type, name, parameters, format, status, row_count, file_size_bytes, download_url, created_at, completed_at)
VALUES
  (
    'gmv_commission',
    'Consolidated Monthly GMV & Escrow Platform Take-Rate Report',
    '{"date_range": "2026-10-01 to 2026-11-20", "regions": "all"}'::jsonb,
    'csv',
    'completed',
    428,
    48200,
    '/api/admin/reports/jobs/1/download',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
  ),
  (
    'cold_chain_compliance',
    'National Fleet Thermal SLA Compliance & Reefer Breach Audit',
    '{"date_range": "Last 30 Days", "corridors": ["Addis-Hawassa", "Adama-Bole Cargo"]}'::jsonb,
    'csv',
    'completed',
    186,
    22400,
    '/api/admin/reports/jobs/2/download',
    NOW() - INTERVAL '12 hours',
    NOW() - INTERVAL '12 hours'
  ),
  (
    'kyc_aging',
    'Farmer Verification Aging & Tier-2 Accreditation Bottleneck Audit',
    '{"status": "all", "regions": "all"}'::jsonb,
    'csv',
    'completed',
    94,
    11500,
    '/api/admin/reports/jobs/3/download',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days'
  );

-- 11. Seed Initial Report Schedules
INSERT INTO report_schedules (report_type, name, cadence, recipients, is_active, last_run_at, next_run_at)
VALUES
  (
    'cold_chain_compliance',
    'Weekly Refrigerated Fleet Cold-Chain SLA Audit',
    'weekly',
    ARRAY['logistics-ops@greenharvest.et', 'compliance@greenharvest.et']::TEXT[],
    TRUE,
    NOW() - INTERVAL '4 days',
    NOW() + INTERVAL '3 days'
  ),
  (
    'gmv_commission',
    'Monthly Escrow Payouts & Take-Rate Financial Settlement',
    'monthly',
    ARRAY['finance-lead@greenharvest.et', 'executive@greenharvest.et']::TEXT[],
    TRUE,
    NOW() - INTERVAL '20 days',
    NOW() + INTERVAL '10 days'
  );

-- 12. Seed System Events & Background Job Runs
INSERT INTO system_events (event_type, severity, source, message, metadata, created_at)
VALUES
  ('failed_webhook', 'warning', 'payment_service', 'Telebirr webhook retry 1 for transaction TX-8921 timed out after 5000ms. Retrying via exponential backoff.', '{"tx_ref": "TX-8921", "retry_count": 1}'::jsonb, NOW() - INTERVAL '35 minutes'),
  ('db_latency_spike', 'info', 'api_gateway', 'Database query pool latency briefly rose to 84ms during 10:00 AM market open. Normal baseline 12ms restored.', '{"latency_ms": 84, "baseline_ms": 12}'::jsonb, NOW() - INTERVAL '4 hours'),
  ('worker_heartbeat', 'info', 'coldchain_iot_stream', 'Reefer IoT streaming worker verified 14 connected telematics hubs. Ingestion latency 22ms.', '{"hubs_connected": 14}'::jsonb, NOW() - INTERVAL '10 minutes');

INSERT INTO job_runs (job_name, status, duration_ms, records_processed, started_at, completed_at)
VALUES
  ('coldchain_telemetry_check', 'completed', 142, 18, NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '5 minutes'),
  ('escrow_settlement_sweeper', 'completed', 285, 42, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour'),
  ('price_index_calculator', 'completed', 620, 115, NOW() - INTERVAL '4 hours', NOW() - INTERVAL '4 hours'),
  ('kyc_expiry_sweeper', 'completed', 88, 6, NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours'),
  ('daily_report_generation', 'completed', 1420, 480, NOW() - INTERVAL '12 hours', NOW() - INTERVAL '12 hours');

COMMIT;

