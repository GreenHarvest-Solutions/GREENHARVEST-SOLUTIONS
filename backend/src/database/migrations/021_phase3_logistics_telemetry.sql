-- 021_phase3_logistics_telemetry.sql
-- Migration for Phase 3: Cold-Chain Logistics, Carriers, Fleet Telemetry, and Incidents

-- 1. Add granular permissions for Carriers, Hubs, and Incidents
INSERT INTO permissions (code, name, category, description)
VALUES
  ('logistics.carriers.read', 'View Carrier Partners', 'Logistics', 'Inspect freight carrier registries, fleet sizes, and cold-chain compliance'),
  ('logistics.carriers.manage', 'Manage Carrier Partners', 'Logistics', 'Onboard, suspend, or update fleet carrier contracts and SLAs'),
  ('logistics.hubs.read', 'View Logistics Hubs', 'Logistics', 'Inspect cold storage hubs, depot capacities, and regional nodes'),
  ('logistics.hubs.manage', 'Manage Logistics Hubs', 'Logistics', 'Create and configure cold-chain consolidation facilities'),
  ('logistics.incidents.read', 'View Logistics Incidents', 'Logistics', 'Review temperature breaches, mechanical alerts, and route deviations'),
  ('logistics.incidents.resolve', 'Resolve Logistics Incidents', 'Logistics', 'Authorize incident root-cause resolutions and corrective actions')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description;

-- Grant all logistics permissions to super_admin (role_id = 1)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, p.id FROM permissions p
WHERE p.code IN (
  'logistics.carriers.read', 'logistics.carriers.manage',
  'logistics.hubs.read', 'logistics.hubs.manage',
  'logistics.incidents.read', 'logistics.incidents.resolve'
)
ON CONFLICT DO NOTHING;

-- Grant logistics permissions to logistics role (role_id = 5)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 5, p.id FROM permissions p
WHERE p.code IN (
  'logistics.read', 'logistics.manage',
  'logistics.carriers.read', 'logistics.carriers.manage',
  'logistics.hubs.read', 'logistics.hubs.manage',
  'logistics.incidents.read', 'logistics.incidents.resolve'
)
ON CONFLICT DO NOTHING;

-- Grant read-only access to operations (role_id = 2) and analyst (role_id = 6)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM admin_roles r
CROSS JOIN permissions p
WHERE r.id IN (2, 6) AND p.code IN ('logistics.carriers.read', 'logistics.hubs.read', 'logistics.incidents.read')
ON CONFLICT DO NOTHING;

-- 2. Create Carriers Table
CREATE TABLE IF NOT EXISTS carriers (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  code VARCHAR(64) NOT NULL UNIQUE,
  contact_person VARCHAR(150),
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(150),
  status VARCHAR(32) NOT NULL DEFAULT 'active', -- 'active', 'suspended', 'under_review'
  total_fleet_count INT NOT NULL DEFAULT 0,
  cold_chain_sla_score NUMERIC(5,2) NOT NULL DEFAULT 98.50,
  license_number VARCHAR(128),
  insurance_policy_number VARCHAR(128),
  coverage_regions JSONB DEFAULT '["Oromia", "Addis Ababa", "Sidama"]'::jsonb,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create Logistics Hubs & Cold Storage Depots Table
CREATE TABLE IF NOT EXISTS logistics_hubs (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  code VARCHAR(64) NOT NULL UNIQUE,
  region VARCHAR(100) NOT NULL,
  city VARCHAR(100) NOT NULL,
  address TEXT NOT NULL,
  hub_type VARCHAR(64) NOT NULL DEFAULT 'cold_storage_depot', -- 'cold_storage_depot', 'dry_port', 'farm_gate_hub', 'central_distribution_center'
  cold_storage_capacity_m3 NUMERIC(10,2) NOT NULL DEFAULT 500.00,
  current_utilization_pct NUMERIC(5,2) NOT NULL DEFAULT 65.00,
  temp_zone_min NUMERIC(4,1) NOT NULL DEFAULT 0.0,
  temp_zone_max NUMERIC(4,1) NOT NULL DEFAULT 4.0,
  manager_name VARCHAR(150),
  manager_phone VARCHAR(50),
  is_operational BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create Logistics Incidents & SLA Breaches Table
CREATE TABLE IF NOT EXISTS logistics_incidents (
  id BIGSERIAL PRIMARY KEY,
  shipment_id VARCHAR(50) REFERENCES fleet_shipments(id) ON DELETE CASCADE,
  incident_type VARCHAR(64) NOT NULL, -- 'temperature_spike', 'route_deviation', 'delay', 'mechanical_failure'
  severity VARCHAR(32) NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  description TEXT NOT NULL,
  recorded_temp NUMERIC(4,1),
  checkpoint VARCHAR(255),
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  corrective_action TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Create Temperature Logs Table (Time-Series for Cold-Chain Graphs)
CREATE TABLE IF NOT EXISTS temperature_logs (
  id BIGSERIAL PRIMARY KEY,
  shipment_id VARCHAR(50) NOT NULL REFERENCES fleet_shipments(id) ON DELETE CASCADE,
  temp_celsius NUMERIC(4,1) NOT NULL,
  humidity_pct NUMERIC(4,1) DEFAULT 85.0,
  battery_pct INT DEFAULT 95,
  speed_kmh INT DEFAULT 50,
  lat NUMERIC(9,6),
  lng NUMERIC(9,6),
  location_name VARCHAR(255),
  alert_flag BOOLEAN DEFAULT FALSE,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_temp_logs_shipment ON temperature_logs(shipment_id, recorded_at);

-- 6. Link deliveries and fleet_shipments
ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS shipment_id VARCHAR(50) REFERENCES fleet_shipments(id) ON DELETE SET NULL;

ALTER TABLE fleet_shipments
  ADD COLUMN IF NOT EXISTS order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS carrier_id BIGINT REFERENCES carriers(id) ON DELETE SET NULL;

-- 7. Seed Initial Carrier Partners
INSERT INTO carriers (name, code, contact_person, phone, email, status, total_fleet_count, cold_chain_sla_score, coverage_regions, notes)
VALUES
('Ethio Cold-Chain Logistics', 'ECL-01', 'Kassahun Worku', '+251 91 148 1920', 'ops@ethiocoldchain.com', 'active', 24, 99.20, '["Oromia", "Addis Ababa", "Sidama"]'::jsonb, 'Primary carrier on the Addis-Adama expressway corridor.'),
('Abyssinia Agro-Freight', 'AAF-02', 'Girma Tilahun', '+251 92 882 9101', 'dispatch@abyssiniafreight.et', 'active', 18, 97.80, '["Amhara", "Oromia", "Afar"]'::jsonb, 'Specializes in bulk avocado and horticultural haulage.'),
('Rift Valley Reefer Transport', 'RVR-03', 'Mesfin Desta', '+251 93 193 0212', 'cargo@riftvalleyreefer.com', 'active', 14, 98.40, '["SNNPR", "Sidama", "Oromia"]'::jsonb, 'Equipped with dual-temperature reefers for dairy and potato seeds.'),
('East African Coldline Express', 'EAC-04', 'Biruk Assefa', '+251 91 991 4455', 'ops@eastafricacoldline.com', 'under_review', 12, 94.60, '["Addis Ababa", "Dire Dawa", "Harari"]'::jsonb, 'Under review following recent Mojo temperature breach audit.'),
('Awash Agro-Fleet Logistics', 'AFL-05', 'Yared Bekele', '+251 94 671 2003', 'info@awashfleet.et', 'active', 20, 99.00, '["Afar", "Somali", "Oromia"]'::jsonb, 'Long-haul fresh fruit transportation.')
ON CONFLICT (code) DO NOTHING;

-- 8. Seed Initial Logistics Hubs
INSERT INTO logistics_hubs (name, code, region, city, address, hub_type, cold_storage_capacity_m3, current_utilization_pct, temp_zone_min, temp_zone_max, manager_name, manager_phone)
VALUES
('Addis Ababa Bole Cargo Depository', 'HUB-ADD-01', 'Addis Ababa', 'Addis Ababa', 'Bole Cargo Apron Terminal 2', 'central_distribution_center', 2500.00, 74.50, 0.0, 4.0, 'Ephrem Kebede', '+251 91 100 1122'),
('Mojo Dry Port Cold Intermodal Terminal', 'HUB-MOJ-02', 'Oromia', 'Mojo', 'Ethio-Djibouti Railway Intermodal Compound', 'dry_port', 4000.00, 82.00, -2.0, 4.0, 'Tadesse Lemma', '+251 91 222 3344'),
('Debre Zeit Cold Hub Depot', 'HUB-BFT-03', 'Oromia', 'Bishoftu', 'Expressway Km 42 Agro-Zone', 'cold_storage_depot', 1200.00, 55.00, 2.0, 6.0, 'Hanna Girma', '+251 91 333 4455'),
('Hawassa Agro-Industrial Cold Facility', 'HUB-HAW-04', 'Sidama', 'Hawassa', 'Hawassa Industrial Park Zone C', 'cold_storage_depot', 1800.00, 60.00, 2.0, 8.0, 'Dawit Alemu', '+251 91 444 5566'),
('Adama Regional Consolidation Hub', 'HUB-ADA-05', 'Oromia', 'Adama', 'Adama Expressway Interchange East', 'central_distribution_center', 2200.00, 68.00, 0.0, 5.0, 'Getachew Belay', '+251 91 555 6677'),
('Ambo Regional Agro-Warehouse', 'HUB-AMB-06', 'Oromia', 'Ambo', 'Guder Highway Km 8', 'farm_gate_hub', 1000.00, 45.00, 2.0, 6.0, 'Bikila Tolosa', '+251 91 666 7788')
ON CONFLICT (code) DO NOTHING;

-- 9. Link fleet_shipments to carriers and orders
UPDATE fleet_shipments SET carrier_id = (SELECT id FROM carriers WHERE code = 'ECL-01'), order_id = 1 WHERE id = 'FL-201';
UPDATE fleet_shipments SET carrier_id = (SELECT id FROM carriers WHERE code = 'AAF-02'), order_id = 2 WHERE id = 'FL-202';
UPDATE fleet_shipments SET carrier_id = (SELECT id FROM carriers WHERE code = 'RVR-03'), order_id = 3 WHERE id = 'FL-203';
UPDATE fleet_shipments SET carrier_id = (SELECT id FROM carriers WHERE code = 'ECL-01'), order_id = 4 WHERE id = 'FL-204';
UPDATE fleet_shipments SET carrier_id = (SELECT id FROM carriers WHERE code = 'EAC-04'), order_id = 5 WHERE id = 'FL-205';
UPDATE fleet_shipments SET carrier_id = (SELECT id FROM carriers WHERE code = 'AAF-02'), order_id = 6 WHERE id = 'FL-206';

-- Link deliveries to fleet shipments
UPDATE deliveries SET shipment_id = 'FL-201' WHERE order_id = 1;
UPDATE deliveries SET shipment_id = 'FL-202' WHERE order_id = 2;
UPDATE deliveries SET shipment_id = 'FL-203' WHERE order_id = 3;

-- 10. Seed Time-Series Temperature Logs for FL-201 and FL-205 (for cold chain telemetry charts)
INSERT INTO temperature_logs (shipment_id, temp_celsius, humidity_pct, battery_pct, speed_kmh, lat, lng, location_name, alert_flag, recorded_at)
VALUES
-- FL-201: Optimal cold run
('FL-201', 3.8, 88.0, 98, 48, 8.7512, 38.9812, 'Bishoftu Valley Farm Gate', FALSE, NOW() - INTERVAL '3 hours'),
('FL-201', 3.6, 87.0, 97, 56, 8.8124, 38.9321, 'Bishoftu Toll Gate Km 12', FALSE, NOW() - INTERVAL '2 hours 30 mins'),
('FL-201', 3.4, 86.5, 96, 54, 8.8741, 38.8910, 'Expressway Km 24 Checkpoint', FALSE, NOW() - INTERVAL '2 hours'),
('FL-201', 3.5, 87.2, 95, 52, 8.9210, 38.8450, 'Dukem Overpass', FALSE, NOW() - INTERVAL '1 hour 30 mins'),
('FL-201', 3.4, 86.8, 94, 55, 8.9642, 38.8123, 'Akaki Toll Plaza', FALSE, NOW() - INTERVAL '1 hour'),
('FL-201', 3.4, 86.0, 93, 45, 8.9912, 38.7890, 'Kality Ring Road Checkpoint', FALSE, NOW() - INTERVAL '30 mins'),
('FL-201', 3.5, 85.5, 92, 38, 9.0123, 38.7654, 'Bole Cargo Corridor Approaches', FALSE, NOW()),

-- FL-205: Breached cold run with critical alert
('FL-205', 4.1, 85.0, 95, 50, 8.4210, 39.0123, 'Lake Koka Greenhouse', FALSE, NOW() - INTERVAL '2 hours 30 mins'),
('FL-205', 4.8, 84.0, 94, 52, 8.4980, 39.0754, 'Mojo South Junction', FALSE, NOW() - INTERVAL '2 hours'),
('FL-205', 5.9, 81.0, 92, 48, 8.5621, 39.1120, 'Mojo Interchange East', FALSE, NOW() - INTERVAL '1 hour 30 mins'),
('FL-205', 6.8, 79.0, 90, 46, 8.6012, 39.1450, 'Mojo Overpass Km 14', TRUE, NOW() - INTERVAL '1 hour'),
('FL-205', 7.2, 77.0, 89, 44, 8.6340, 39.1670, 'Debre Zeit Boundary Km 32', TRUE, NOW() - INTERVAL '30 mins'),
('FL-205', 7.4, 76.0, 88, 40, 8.6650, 39.1890, 'Mojo Dry Port Diverted Gate', TRUE, NOW())
ON CONFLICT DO NOTHING;

-- 11. Seed Initial Logistics Incidents
INSERT INTO logistics_incidents (shipment_id, incident_type, severity, description, recorded_temp, checkpoint, is_resolved, created_at)
VALUES
('FL-205', 'temperature_spike', 'critical', 'Reefer compressor cycling failure caused cargo compartment temperature to breach upper threshold (7.4°C vs max 6.0°C). Emergency diversion to Mojo cold store initiated.', 7.4, 'Debre Zeit Boundary Km 32', FALSE, NOW() - INTERVAL '45 mins'),
('FL-202', 'route_deviation', 'low', 'Driver detoured 4.2 km off designated expressway artery due to local road surface repairs near Zeway.', 4.1, 'Zeway Bypass Km 88', TRUE, NOW() - INTERVAL '4 hours')
ON CONFLICT DO NOTHING;

