-- Migration: 022_support_and_announcements.sql
-- Description: Creates support_tickets, ticket_messages, notification_templates, enhances announcements, and seeds initial data.

BEGIN;

-- 1. Create Granular Permissions for Support & Announcements
INSERT INTO permissions (code, name, category, description)
VALUES
  ('support.tickets.read', 'View Support Tickets', 'Engagement', 'Access customer, farmer, and carrier support tickets and inquiry queues'),
  ('support.tickets.manage', 'Manage Support Tickets', 'Engagement', 'Triage, update priority/status, reply to customers, and resolve tickets'),
  ('support.tickets.assign', 'Assign Support Tickets', 'Engagement', 'Assign tickets to specific administrative agents'),
  ('announcements.manage', 'Manage System Announcements', 'Engagement', 'Draft, schedule, and configure platform-wide broadcast announcements'),
  ('templates.manage', 'Manage Notification Templates', 'Engagement', 'Create, update, and configure reusable system notification templates')
ON CONFLICT (code) DO NOTHING;

-- Grant permissions to Super Admin and Support roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT ar.id, p.id
FROM admin_roles ar
CROSS JOIN permissions p
WHERE ar.name IN ('super_admin', 'support', 'operations')
  AND p.code IN (
    'support.tickets.read',
    'support.tickets.manage',
    'support.tickets.assign',
    'announcements.manage',
    'templates.manage'
  )
ON CONFLICT DO NOTHING;

-- 2. Create support_tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
  id BIGSERIAL PRIMARY KEY,
  ticket_number VARCHAR(50) UNIQUE NOT NULL,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  subject VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'general',
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  status VARCHAR(30) NOT NULL DEFAULT 'open',
  assigned_to BIGINT REFERENCES users(id) ON DELETE SET NULL,
  order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
  shipment_id VARCHAR(50) REFERENCES fleet_shipments(id) ON DELETE SET NULL,
  dispute_id BIGINT REFERENCES returns(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to ON support_tickets(assigned_to);

-- 3. Create ticket_messages table
CREATE TABLE IF NOT EXISTS ticket_messages (
  id BIGSERIAL PRIMARY KEY,
  ticket_id BIGINT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  sender_type VARCHAR(20) NOT NULL DEFAULT 'admin',
  message TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT FALSE,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_created_at ON ticket_messages(created_at);

-- 4. Create notification_templates table
CREATE TABLE IF NOT EXISTS notification_templates (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  code VARCHAR(100) UNIQUE NOT NULL,
  channel VARCHAR(30) NOT NULL DEFAULT 'in_app',
  subject VARCHAR(255),
  body TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Enhance announcements table
ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS channels TEXT[] DEFAULT ARRAY['in_app']::TEXT[],
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_dismissible BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_announcements_status ON announcements(status);

-- 6. Seed Notification Templates
INSERT INTO notification_templates (title, code, channel, subject, body, variables, is_active)
VALUES
  (
    'Cold-Chain Temperature Warning',
    'COLD_CHAIN_TEMP_ALERT',
    'in_app',
    'Critical Reefer Temperature Alert for Shipment {shipment_id}',
    'Attention: Reefer truck {vehicle_plate} carrying your order {order_id} recorded a temperature breach at {temperature_c}°C near {checkpoint}. Our cold depot at {hub_name} has been notified.',
    '["shipment_id", "vehicle_plate", "order_id", "temperature_c", "checkpoint", "hub_name"]'::jsonb,
    TRUE
  ),
  (
    'Escrow Disbursement Confirmation',
    'ESCROW_PAYOUT_RELEASED',
    'in_app',
    'Escrow Payout of ETB {amount} Released',
    'Dear {farmer_name}, the escrow balance for Order #{order_id} has cleared inspection and ETB {amount} has been disbursed to your linked account via {payout_channel}.',
    '["farmer_name", "order_id", "amount", "payout_channel"]'::jsonb,
    TRUE
  ),
  (
    'Regional Frost & Weather Advisory',
    'REGIONAL_WEATHER_ADVISORY',
    'in_app',
    'Severe Weather Advisory for {region} Producers',
    'Meteorological Warning: Expected temperature drops and localized frost in {region} over the next 48 hours. Farmers are advised to harvest mature leafy produce and utilize insulated storage.',
    '["region"]'::jsonb,
    TRUE
  )
ON CONFLICT (code) DO NOTHING;

-- 7. Seed Initial System Announcements
INSERT INTO announcements (
  created_by,
  title,
  message,
  target_audience,
  target_filter,
  status,
  delivered_count,
  priority,
  category,
  channels,
  sent_at,
  created_at
)
SELECT
  u.id,
  'Mojo Dry Port Cold-Storage Facility Now Operational',
  'GreenHarvest is pleased to announce that our 5,000 m³ multi-temperature facility at Mojo Dry Port is officially open for regional aggregation and export consolidation. Reefer turnaround times reduced to under 35 minutes.',
  'all',
  '{"region": "all", "role": "all"}'::jsonb,
  'sent',
  142,
  'high',
  'system',
  ARRAY['in_app', 'email']::TEXT[],
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days'
FROM users u
WHERE u.role = 'admin'
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO announcements (
  created_by,
  title,
  message,
  target_audience,
  target_filter,
  status,
  delivered_count,
  priority,
  category,
  channels,
  sent_at,
  created_at
)
SELECT
  u.id,
  'Market Corridor Price Guard: Red Teff Fair Trade Index',
  'Effective immediately, the platform has instituted a minimum floor price of ETB 8,500/quintal for Grade-A Red Teff in Oromia to curb speculative intermediary price depression.',
  'farmers_only',
  '{"region": "Oromia", "role": "farmer"}'::jsonb,
  'sent',
  86,
  'normal',
  'market_update',
  ARRAY['in_app']::TEXT[],
  NOW() - INTERVAL '6 hours',
  NOW() - INTERVAL '6 hours'
FROM users u
WHERE u.role = 'admin'
LIMIT 1
ON CONFLICT DO NOTHING;

-- 8. Seed Initial Realistic Support Tickets and Messages
DO $$
DECLARE
  v_admin_id BIGINT;
  v_farmer_id BIGINT;
  v_buyer_id BIGINT;
  v_ticket_1 BIGINT;
  v_ticket_2 BIGINT;
  v_ticket_3 BIGINT;
  v_ticket_4 BIGINT;
BEGIN
  SELECT id INTO v_admin_id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1;
  SELECT id INTO v_farmer_id FROM users WHERE role = 'farmer' ORDER BY id ASC LIMIT 1;
  SELECT id INTO v_buyer_id FROM users WHERE role = 'buyer' ORDER BY id ASC LIMIT 1;

  IF v_farmer_id IS NOT NULL AND v_admin_id IS NOT NULL THEN
    -- Ticket 1: In transit cold-chain delay inquiry
    INSERT INTO support_tickets (ticket_number, user_id, subject, category, priority, status, assigned_to, created_at, updated_at)
    VALUES ('TICK-801', v_farmer_id, 'Shipment FL-201 temperature spike inquiry during Modjo transit', 'cold_chain_spoilage', 'high', 'open', v_admin_id, NOW() - INTERVAL '4 hours', NOW() - INTERVAL '1 hour')
    RETURNING id INTO v_ticket_1;

    INSERT INTO ticket_messages (ticket_id, sender_id, sender_type, message, is_internal, created_at)
    VALUES
      (v_ticket_1, v_farmer_id, 'customer', 'Hello support, our dispatch driver on truck ET-AA-4029 reported a sensor warning near Modjo toll gate. Has the cold depot verified the payload temperature?', FALSE, NOW() - INTERVAL '4 hours'),
      (v_ticket_1, v_admin_id, 'admin', 'We have pulled the IoT log for FL-201. The temperature peaked at 3.9°C which remains inside the 0–4°C acceptable envelope for avocados. The reefer compressor is running normally.', FALSE, NOW() - INTERVAL '3 hours'),
      (v_ticket_1, v_admin_id, 'admin', 'Internal note: Dispatch confirmed Modjo depot had secondary probe verify at 2.4°C upon arrival. Cargo is intact.', TRUE, NOW() - INTERVAL '1 hour');

    -- Ticket 2: Tier-2 KYC Accreditation Request
    INSERT INTO support_tickets (ticket_number, user_id, subject, category, priority, status, assigned_to, created_at, updated_at)
    VALUES ('TICK-802', v_farmer_id, 'Request for Tier-2 Cooperative Certification & higher order limits', 'kyc_verification', 'medium', 'in_progress', v_admin_id, NOW() - INTERVAL '1 day', NOW() - INTERVAL '2 hours')
    RETURNING id INTO v_ticket_2;

    INSERT INTO ticket_messages (ticket_id, sender_id, sender_type, message, is_internal, created_at)
    VALUES
      (v_ticket_2, v_farmer_id, 'customer', 'We uploaded our Oromia Cooperative Union trade license and pesticide clearance certificates. Kindly review so we can list 500 quintals of harvest.', FALSE, NOW() - INTERVAL '1 day'),
      (v_ticket_2, v_admin_id, 'admin', 'Internal note: Trade license verified against Ministry of Trade registry. Waiting on agronomist field audit verification.', TRUE, NOW() - INTERVAL '5 hours'),
      (v_ticket_2, v_admin_id, 'admin', 'Greetings, your documents have cleared preliminary validation. An authorized field verification agent will contact your cooperative coordinator for scheduled farm inspection.', FALSE, NOW() - INTERVAL '2 hours');
  END IF;

  IF v_buyer_id IS NOT NULL AND v_admin_id IS NOT NULL THEN
    -- Ticket 3: Escrow release inquiry after delivery receipt
    INSERT INTO support_tickets (ticket_number, user_id, subject, category, priority, status, assigned_to, created_at, updated_at)
    VALUES ('TICK-803', v_buyer_id, 'Escrow receipt confirmation for Order #ORD-8402', 'payment_escrow', 'normal', 'resolved', v_admin_id, NOW() - INTERVAL '2 days', NOW() - INTERVAL '6 hours')
    RETURNING id INTO v_ticket_3;

    INSERT INTO ticket_messages (ticket_id, sender_id, sender_type, message, is_internal, created_at)
    VALUES
      (v_ticket_3, v_buyer_id, 'customer', 'We confirmed acceptance of 40 quintals of potatoes at our warehouse in Addis Ababa. Please release the remaining escrow to the farmer.', FALSE, NOW() - INTERVAL '2 days'),
      (v_ticket_3, v_admin_id, 'admin', 'The escrow funds amounting to ETB 48,000.00 have been released to the producer wallet successfully. The transaction reference is TX-ESC-901.', FALSE, NOW() - INTERVAL '6 hours');

    -- Ticket 4: Damaged Produce Inspection & Return Dispute
    INSERT INTO support_tickets (ticket_number, user_id, subject, category, priority, status, assigned_to, created_at, updated_at)
    VALUES ('TICK-804', v_buyer_id, 'Damage report on pallet 4 of Roma Tomatoes from Ziway', 'quality_dispute', 'urgent', 'open', v_admin_id, NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '30 minutes')
    RETURNING id INTO v_ticket_4;

    INSERT INTO ticket_messages (ticket_id, sender_id, sender_type, message, is_internal, created_at)
    VALUES
      (v_ticket_4, v_buyer_id, 'customer', 'Upon unloading truck FL-205, pallet 4 exhibited crushing and heat discoloration. 20 crates are unmarketable. We request a partial refund arbitration.', FALSE, NOW() - INTERVAL '30 minutes'),
      (v_ticket_4, v_admin_id, 'admin', 'Internal note: Linked to incident #INC-2 (FL-205 temperature spike to 8.2°C). High validity claim for partial settlement under escrow balance.', TRUE, NOW() - INTERVAL '15 minutes');
  END IF;
END $$;

COMMIT;
