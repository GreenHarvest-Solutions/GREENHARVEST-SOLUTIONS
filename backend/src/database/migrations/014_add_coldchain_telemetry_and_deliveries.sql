-- Migration: 014_add_coldchain_telemetry_and_deliveries.sql
-- Description: Create fleet_shipments table for IoT reefer telemetry, temperature compliance, and logistics dispatch

CREATE TABLE IF NOT EXISTS fleet_shipments (
    id VARCHAR(50) PRIMARY KEY,
    vehicle_plate VARCHAR(50) NOT NULL,
    truck_type VARCHAR(100) NOT NULL DEFAULT '10-Ton Refrigerated Reefer',
    driver_name VARCHAR(150) NOT NULL,
    driver_phone VARCHAR(50) NOT NULL,
    carrier_partner VARCHAR(150) NOT NULL DEFAULT 'Ethio Cold-Chain Logistics',
    cargo_batch VARCHAR(255) NOT NULL,
    cargo_weight_kg NUMERIC(10,2) NOT NULL DEFAULT 1000.00,
    origin_hub VARCHAR(255) NOT NULL,
    destination_hub VARCHAR(255) NOT NULL,
    current_checkpoint VARCHAR(255) NOT NULL,
    reefer_temp_celsius NUMERIC(4,1) NOT NULL DEFAULT 3.5,
    target_temp_min NUMERIC(4,1) NOT NULL DEFAULT 2.0,
    target_temp_max NUMERIC(4,1) NOT NULL DEFAULT 6.0,
    compliance_status VARCHAR(50) NOT NULL DEFAULT 'optimal',
    status VARCHAR(50) NOT NULL DEFAULT 'in_transit',
    speed_kmh INT NOT NULL DEFAULT 50,
    eta VARCHAR(50) NOT NULL DEFAULT '45 mins',
    nearest_cold_hub VARCHAR(255) NOT NULL DEFAULT 'Debre Zeit Cold Hub Depot',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed initial fleet shipments along Ethiopia's major agricultural trade arteries
INSERT INTO fleet_shipments (
    id, vehicle_plate, truck_type, driver_name, driver_phone, carrier_partner,
    cargo_batch, cargo_weight_kg, origin_hub, destination_hub, current_checkpoint,
    reefer_temp_celsius, target_temp_min, target_temp_max, compliance_status,
    status, speed_kmh, eta, nearest_cold_hub, notes
) VALUES
('FL-201', 'ET-3-48192', '10-Ton Refrigerated Reefer', 'Kassahun Worku', '+251 91 148 1920', 'Ethio Cold-Chain Logistics',
 'Grade-A Export Strawberries & Kale', 1200.00, 'Bishoftu Valley Hub', 'Addis Ababa (Bole Cargo Depository)', 'Expressway Toll Gate Km 24',
 3.4, 2.0, 6.0, 'optimal', 'in_transit', 54, '35 mins', 'Debre Zeit Cold Hub Depot', 'Continuous refrigeration active. Sensor ping normal.'),

('FL-202', 'ET-3-88291', '12-Ton Heavy Reefer', 'Girma Tilahun', '+251 92 882 9101', 'Abyssinia Agro-Freight',
 'Bulk Fresh Hass Avocados (Export Grade)', 4000.00, 'Mojo Dry Port Intermodal Terminal', 'Hawassa Agro-Industrial Park', 'Zeway Bypass Km 88',
 4.1, 2.0, 6.0, 'optimal', 'in_transit', 62, '1.6 hours', 'Batu Cold Consolidation Facility', 'Pre-cooling protocol verified before dispatch.'),

('FL-203', 'ET-3-19302', '8-Ton Insulated Reefer', 'Mesfin Desta', '+251 93 193 0212', 'Rift Valley Transport',
 'Red Highland Seed Potatoes & Carrots', 3500.00, 'Ambo Agricultural Aggregation Center', 'Addis Ababa (Mercato Central Wholesale)', 'Guder Junction Km 12',
 5.2, 2.0, 6.0, 'optimal', 'in_transit', 42, '2.1 hours', 'Ambo Regional Agro-Warehouse', 'Temperature steady within permissible range.'),

('FL-204', 'ET-3-67120', '5-Ton Insulated Van', 'Yared Bekele', '+251 94 671 2003', 'Ethio Cold-Chain Logistics',
 'Fresh Citrus, Papayas & Melons', 2800.00, 'Awash Basin Farm Gate', 'Adama Logistics Consolidation Hub', 'Awash Arba Weighbridge',
 3.8, 2.0, 6.0, 'optimal', 'loading', 0, 'Departing 14:00', 'Metehara Depot', 'Pallet loading in progress under cold canopy.'),

('FL-205', 'ET-3-99144', '10-Ton Refrigerated Reefer', 'Biruk Assefa', '+251 91 991 4455', 'East African Coldline',
 'Hydroponic Sweet Bell Peppers & Tomatoes', 2200.00, 'Lake Koka Greenhouse Compound', 'Addis Ababa (Sarbet Supermarket Depot)', 'Mojo Interchange East',
 7.2, 2.0, 6.0, 'breached', 'temp_breach', 46, '45 mins', 'Mojo Dry Port Refrigerated Facility', 'CRITICAL WARNING: Temperature spiked above 6.0°C. Immediate inspection or diversion recommended.'),

('FL-206', 'ET-3-22819', '6-Ton Refrigerated Reefer', 'Solomon Tesfaye', '+251 95 228 1944', 'Abyssinia Agro-Freight',
 'Certified Organic Blueberries & Herbs', 950.00, 'Debre Zeit Berries Co-op', 'Addis Ababa (Bole Medhanialem)', 'Bole Airport Cargo Terminal Gate 4',
 3.2, 2.0, 6.0, 'optimal', 'completed', 0, 'Delivered', 'Addis Central Cold Store', 'Consignment received and signed off with 100% cold compliance.')
ON CONFLICT (id) DO NOTHING;

