-- 016_admin_rbac_audit.sql
-- Role-based access control (RBAC), granular permissions, audit logging, and announcements.

-- 1. Admin Roles
CREATE TABLE IF NOT EXISTS admin_roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Granular Permissions
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Role Permissions Join Table
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- 4. User Admin Role Assignment
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_role_id INTEGER REFERENCES admin_roles(id) ON DELETE SET NULL;

-- 5. Audit Logs Table (immutable log of all administrative actions)
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(100),
  before_state JSONB,
  after_state JSONB,
  reason TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- 6. Announcements and Announcement Deliveries
CREATE TABLE IF NOT EXISTS announcements (
  id BIGSERIAL PRIMARY KEY,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(255),
  message TEXT NOT NULL,
  target_audience VARCHAR(50) NOT NULL DEFAULT 'all',
  target_filter JSONB,
  status VARCHAR(30) NOT NULL DEFAULT 'sent',
  delivered_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS announcement_deliveries (
  id BIGSERIAL PRIMARY KEY,
  announcement_id BIGINT NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel VARCHAR(30) NOT NULL DEFAULT 'in_app',
  status VARCHAR(30) NOT NULL DEFAULT 'delivered',
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcement_deliveries_user ON announcement_deliveries(user_id);

-- 7. Seed Admin Roles
INSERT INTO admin_roles (name, description) VALUES
  ('super_admin', 'Full platform operational governance and master security clearance'),
  ('operations', 'Farmer onboarding, product catalog moderation, campaigns, and review queues'),
  ('finance', 'Commerce settlements, escrow releases, refunds, payouts, and dispute mediation'),
  ('support', 'Customer tickets, platform notices, buyer inquiries, and user support'),
  ('logistics', 'Cold-chain telemetry, carrier fleet oversight, freight corridors, and incidents'),
  ('analyst', 'Read-only access to executive dashboards, regional analytics, and reports')
ON CONFLICT (name) DO NOTHING;

-- 8. Seed Granular Permissions
INSERT INTO permissions (code, name, category, description) VALUES
  ('dashboard.read', 'View Dashboard Telemetry', 'Telemetry', 'Access real-time command center KPIs'),
  ('analytics.read', 'View Platform Analytics', 'Telemetry', 'Access regional volume, GMV, and economic metrics'),
  ('users.read', 'View User Registry', 'Users', 'View registered farmers, commercial buyers, and carriers'),
  ('users.manage', 'Manage Users & Status', 'Users', 'Suspend, activate, or modify user accounts'),
  ('team.manage', 'Manage Admin Team', 'Users', 'Assign admin sub-roles and grant permissions'),
  ('kyc.read', 'View Farmer KYC', 'Governance', 'Access KYC applications and verification documents'),
  ('kyc.manage', 'Review & Approve KYC', 'Governance', 'Approve, reject, or request changes on farmer accreditation'),
  ('products.read', 'View Product Catalog', 'Governance', 'Access listings across agricultural categories'),
  ('products.moderate', 'Moderate Products', 'Governance', 'Approve, reject, or flag marketplace batches'),
  ('disputes.read', 'View Disputes', 'Commerce', 'View buyer-farmer quality and delivery claims'),
  ('disputes.resolve', 'Resolve Disputes', 'Commerce', 'Execute split refunds or dismiss escrow dispute claims'),
  ('escrow.manage', 'Manage Escrow & Payouts', 'Commerce', 'Release escrow funds or approve producer payouts'),
  ('logistics.read', 'View Logistics Fleet', 'Logistics', 'Monitor reefer truck sensors and cargo telemetry'),
  ('logistics.manage', 'Dispatch & Diversion', 'Logistics', 'Assign freight shipments or emergency divert reefer vehicles'),
  ('broadcast.send', 'Transmit Broadcasts', 'Engagement', 'Send broadcast advisories to targeted platform roles'),
  ('settings.read', 'View Platform Settings', 'System', 'Read commission rates, escrow windows, and governance rules'),
  ('settings.manage', 'Update Platform Settings', 'System', 'Modify platform commission fees, escrow policies, and system modes'),
  ('audit.read', 'View Audit Logs', 'System', 'Search immutable logs of all administrative actions')
ON CONFLICT (code) DO NOTHING;

-- 9. Map Permissions to Roles
-- super_admin gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT ar.id, p.id
FROM admin_roles ar
CROSS JOIN permissions p
WHERE ar.name = 'super_admin'
ON CONFLICT DO NOTHING;

-- operations
INSERT INTO role_permissions (role_id, permission_id)
SELECT ar.id, p.id
FROM admin_roles ar, permissions p
WHERE ar.name = 'operations' AND p.code IN (
  'dashboard.read', 'analytics.read', 'users.read', 'kyc.read', 'kyc.manage',
  'products.read', 'products.moderate', 'broadcast.send', 'settings.read'
)
ON CONFLICT DO NOTHING;

-- finance
INSERT INTO role_permissions (role_id, permission_id)
SELECT ar.id, p.id
FROM admin_roles ar, permissions p
WHERE ar.name = 'finance' AND p.code IN (
  'dashboard.read', 'analytics.read', 'disputes.read', 'disputes.resolve',
  'escrow.manage', 'settings.read'
)
ON CONFLICT DO NOTHING;

-- support
INSERT INTO role_permissions (role_id, permission_id)
SELECT ar.id, p.id
FROM admin_roles ar, permissions p
WHERE ar.name = 'support' AND p.code IN (
  'dashboard.read', 'users.read', 'disputes.read', 'broadcast.send'
)
ON CONFLICT DO NOTHING;

-- logistics
INSERT INTO role_permissions (role_id, permission_id)
SELECT ar.id, p.id
FROM admin_roles ar, permissions p
WHERE ar.name = 'logistics' AND p.code IN (
  'dashboard.read', 'logistics.read', 'logistics.manage', 'broadcast.send'
)
ON CONFLICT DO NOTHING;

-- analyst
INSERT INTO role_permissions (role_id, permission_id)
SELECT ar.id, p.id
FROM admin_roles ar, permissions p
WHERE ar.name = 'analyst' AND p.code IN (
  'dashboard.read', 'analytics.read', 'settings.read', 'audit.read'
)
ON CONFLICT DO NOTHING;

-- 10. Assign existing admin users to super_admin
UPDATE users
SET admin_role_id = (SELECT id FROM admin_roles WHERE name = 'super_admin')
WHERE (role = 'admin' OR role_id IN (SELECT role_id FROM roles WHERE role_name = 'admin'))
  AND (admin_role_id IS NULL);
