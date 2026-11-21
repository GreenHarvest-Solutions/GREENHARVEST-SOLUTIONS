const { pool } = require("../config/db");
const auditService = require("../services/auditService");

/**
 * Fetch paginated fleet shipments with real-time IoT cold-chain compliance metrics
 */
const getFleetShipmentsAdmin = async ({
  status = null,
  carrier = null,
  temp_status = null,
  search = null,
  page = 1,
  limit = 20,
}) => {
  const conditions = [];
  const params = [];

  if (status && status !== "all") {
    params.push(status);
    conditions.push(`s.status = $${params.length}`);
  }

  if (carrier && carrier !== "all") {
    params.push(carrier);
    conditions.push(`(s.carrier_partner = $${params.length} OR CAST(s.carrier_id AS TEXT) = $${params.length})`);
  }

  if (temp_status && temp_status !== "all") {
    params.push(temp_status);
    conditions.push(`s.compliance_status = $${params.length}`);
  }

  if (search && search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`);
    const sIndex = params.length;
    conditions.push(`(
      LOWER(s.id) LIKE $${sIndex} OR
      LOWER(s.vehicle_plate) LIKE $${sIndex} OR
      LOWER(s.driver_name) LIKE $${sIndex} OR
      LOWER(s.cargo_batch) LIKE $${sIndex} OR
      LOWER(s.origin_hub) LIKE $${sIndex} OR
      LOWER(s.destination_hub) LIKE $${sIndex} OR
      LOWER(s.current_checkpoint) LIKE $${sIndex}
    )`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  // Telemetry Operational Metrics
  const metricsRes = await pool.query(`
    SELECT
      COUNT(*)::int AS total_shipments,
      COUNT(*) FILTER (WHERE status = 'in_transit' OR status = 'temp_breach')::int AS active_trucks,
      COUNT(*) FILTER (WHERE compliance_status = 'optimal')::int AS optimal_count,
      COUNT(*) FILTER (WHERE compliance_status = 'elevated')::int AS elevated_count,
      COUNT(*) FILTER (WHERE compliance_status = 'breached' OR status = 'temp_breach')::int AS breached_count,
      ROUND(COALESCE(AVG(speed_kmh) FILTER (WHERE status = 'in_transit'), 0), 1)::numeric AS avg_speed_kmh,
      ROUND(COALESCE((COUNT(*) FILTER (WHERE compliance_status = 'optimal')::numeric / NULLIF(COUNT(*), 0)) * 100, 100), 1)::numeric AS cold_chain_compliance_pct,
      COALESCE(SUM(cargo_weight_kg) FILTER (WHERE status = 'in_transit'), 0)::numeric(10,2) AS active_cargo_weight_kg
    FROM fleet_shipments
  `);

  // Count total
  const countRes = await pool.query(
    `
      SELECT COUNT(*)::int AS total
      FROM fleet_shipments s
      ${whereClause}
    `,
    params
  );
  const total = countRes.rows[0]?.total || 0;

  const offset = (Number(page) - 1) * Number(limit);
  const queryParams = [...params, Number(limit), offset];

  const dataRes = await pool.query(
    `
      SELECT
        s.id,
        s.vehicle_plate,
        s.truck_type,
        s.driver_name,
        s.driver_phone,
        s.carrier_partner,
        s.carrier_id,
        s.cargo_batch,
        s.cargo_weight_kg::numeric(10,2) AS cargo_weight_kg,
        s.origin_hub,
        s.destination_hub,
        s.current_checkpoint,
        s.reefer_temp_celsius::numeric(4,1) AS reefer_temp_celsius,
        s.target_temp_min::numeric(4,1) AS target_temp_min,
        s.target_temp_max::numeric(4,1) AS target_temp_max,
        s.compliance_status,
        s.status,
        s.speed_kmh,
        s.eta,
        s.nearest_cold_hub,
        s.notes,
        s.order_id,
        s.created_at,
        s.updated_at,
        c.cold_chain_sla_score,
        inc.open_incidents_count
      FROM fleet_shipments s
      LEFT JOIN carriers c ON c.id = s.carrier_id
      LEFT JOIN LATERAL (
        SELECT COUNT(li.id)::int AS open_incidents_count
        FROM logistics_incidents li
        WHERE li.shipment_id = s.id AND li.is_resolved = FALSE
      ) inc ON TRUE
      ${whereClause}
      ORDER BY
        CASE WHEN s.compliance_status = 'breached' OR s.status = 'temp_breach' THEN 1
             WHEN s.status = 'in_transit' THEN 2
             ELSE 3 END,
        s.created_at DESC
      LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
    `,
    queryParams
  );

  return {
    shipments: dataRes.rows,
    metrics: metricsRes.rows[0] || {},
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      total_pages: Math.ceil(total / Number(limit)) || 1,
    },
  };
};

/**
 * Fetch detailed Shipment Telemetry Dossier with full time-series temperature graph logs
 */
const getShipmentDossier = async (shipmentId) => {
  const shipRes = await pool.query(
    `
      SELECT
        s.*,
        c.name AS carrier_name,
        c.phone AS carrier_phone,
        c.cold_chain_sla_score,
        o.order_status,
        o.total_price AS order_total_price
      FROM fleet_shipments s
      LEFT JOIN carriers c ON c.id = s.carrier_id
      LEFT JOIN orders o ON o.id = s.order_id
      WHERE s.id = $1
    `,
    [shipmentId]
  );

  if (shipRes.rows.length === 0) {
    return null;
  }

  const shipment = shipRes.rows[0];

  // 1. Time-series temperature logs for line charts
  const logsRes = await pool.query(
    `
      SELECT
        id,
        temp_celsius::numeric(4,1) AS temp_celsius,
        humidity_pct::numeric(4,1) AS humidity_pct,
        battery_pct,
        speed_kmh,
        lat,
        lng,
        location_name,
        alert_flag,
        recorded_at
      FROM temperature_logs
      WHERE shipment_id = $1
      ORDER BY recorded_at ASC
    `,
    [shipmentId]
  );

  // 2. Incident logs
  const incidentsRes = await pool.query(
    `
      SELECT
        li.*,
        u.name AS resolver_name
      FROM logistics_incidents li
      LEFT JOIN users u ON u.id = li.resolved_by
      WHERE li.shipment_id = $1
      ORDER BY li.created_at DESC
    `,
    [shipmentId]
  );

  // 3. Audit trail
  const auditRes = await pool.query(
    `
      SELECT
        a.id,
        a.action,
        a.reason,
        a.before_state,
        a.after_state,
        a.created_at,
        u.name AS actor_name
      FROM audit_logs a
      LEFT JOIN users u ON u.id = a.actor_id
      WHERE a.entity_type = 'shipment' AND a.entity_id = $1
      ORDER BY a.created_at DESC
      LIMIT 50
    `,
    [shipmentId]
  );

  return {
    ...shipment,
    temperature_logs: logsRes.rows,
    incidents: incidentsRes.rows,
    audit_trail: auditRes.rows,
  };
};

/**
 * Assign and dispatch new refrigerated shipment
 */
const assignDispatchBatch = async (data, actorId = null, ipAddress = null, userAgent = null) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const shipmentId = data.id || `FL-${Math.floor(100 + Math.random() * 900)}`;

    const insertResult = await client.query(
      `
        INSERT INTO fleet_shipments (
          id, vehicle_plate, truck_type, driver_name, driver_phone,
          carrier_partner, cargo_batch, cargo_weight_kg, origin_hub,
          destination_hub, current_checkpoint, reefer_temp_celsius,
          target_temp_min, target_temp_max, compliance_status, status,
          speed_kmh, eta, nearest_cold_hub, notes, order_id, carrier_id,
          created_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22,
          NOW(), NOW()
        )
        RETURNING *
      `,
      [
        shipmentId,
        data.vehicle_plate,
        data.truck_type || "10-Ton Refrigerated Reefer",
        data.driver_name,
        data.driver_phone,
        data.carrier_partner || "Ethio Cold-Chain Logistics",
        data.cargo_batch,
        data.cargo_weight_kg || 1000.0,
        data.origin_hub,
        data.destination_hub,
        data.current_checkpoint || data.origin_hub,
        data.reefer_temp_celsius || 3.5,
        data.target_temp_min || 2.0,
        data.target_temp_max || 6.0,
        data.compliance_status || "optimal",
        data.status || "in_transit",
        data.speed_kmh || 50,
        data.eta || "45 mins",
        data.nearest_cold_hub || "Debre Zeit Cold Hub Depot",
        data.notes || "Dispatched under cold-chain compliance oversight",
        data.order_id || null,
        data.carrier_id || null,
      ]
    );

    const shipment = insertResult.rows[0];

    // Seed initial temperature log entry
    await client.query(
      `
        INSERT INTO temperature_logs (
          shipment_id, temp_celsius, humidity_pct, speed_kmh, location_name, recorded_at
        )
        VALUES ($1, $2, 85.0, $3, $4, NOW())
      `,
      [shipment.id, shipment.reefer_temp_celsius, shipment.speed_kmh, shipment.origin_hub]
    );

    // If linked to an order, update order delivery_status
    if (data.order_id) {
      await client.query(
        `UPDATE orders SET delivery_status = 'in_transit' WHERE id = $1`,
        [data.order_id]
      );
    }

    await auditService.record({
      actorId,
      action: "logistics.dispatch_batch",
      entityType: "shipment",
      entityId: shipment.id,
      beforeState: null,
      afterState: shipment,
      reason: `Dispatched Reefer ${shipment.vehicle_plate} along corridor ${shipment.origin_hub} → ${shipment.destination_hub}`,
      ipAddress,
      userAgent,
      client,
    });

    await client.query("COMMIT");
    return shipment;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Execute emergency cold-chain diversion/reroute
 */
const emergencyRerouteTruck = async (id, data, actorId = null, ipAddress = null, userAgent = null) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const checkRes = await client.query("SELECT * FROM fleet_shipments WHERE id = $1 FOR UPDATE", [id]);
    if (checkRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    const before = checkRes.rows[0];
    const diversionHub = data.diversion_hub || data.destination_hub || "Mojo Dry Port Refrigerated Facility";
    const notes = data.admin_notes || "Emergency diversion executed to prevent cold-chain spoilage";

    const updateRes = await client.query(
      `
        UPDATE fleet_shipments
        SET destination_hub = $1,
            current_checkpoint = 'Diverting to Emergency Cold Depot',
            status = 'rerouted',
            notes = $2,
            updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `,
      [diversionHub, notes, id]
    );

    const rerouted = updateRes.rows[0];

    // Log incident if temperature breached
    if (before.compliance_status === "breached" || before.reefer_temp_celsius > before.target_temp_max) {
      await client.query(
        `
          INSERT INTO logistics_incidents (
            shipment_id, incident_type, severity, description, recorded_temp, checkpoint, is_resolved, created_at
          )
          VALUES ($1, 'temperature_spike', 'critical', $2, $3, $4, FALSE, NOW())
        `,
        [id, notes, before.reefer_temp_celsius, before.current_checkpoint]
      );
    }

    await auditService.record({
      actorId,
      action: "logistics.emergency_reroute",
      entityType: "shipment",
      entityId: id,
      beforeState: before,
      afterState: rerouted,
      reason: notes,
      ipAddress,
      userAgent,
      client,
    });

    await client.query("COMMIT");
    return rerouted;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Carriers CRUD & Compliance
 */
const getCarriersAdmin = async ({ status = null, search = null, page = 1, limit = 20 }) => {
  const conditions = [];
  const params = [];

  if (status && status !== "all") {
    params.push(status);
    conditions.push(`c.status = $${params.length}`);
  }

  if (search && search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`);
    const sIndex = params.length;
    conditions.push(`(
      LOWER(c.name) LIKE $${sIndex} OR
      LOWER(c.code) LIKE $${sIndex} OR
      LOWER(COALESCE(c.contact_person, '')) LIKE $${sIndex} OR
      LOWER(c.phone) LIKE $${sIndex}
    )`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS total FROM carriers c ${whereClause}`,
    params
  );
  const total = countRes.rows[0]?.total || 0;

  const offset = (Number(page) - 1) * Number(limit);
  const queryParams = [...params, Number(limit), offset];

  const dataRes = await pool.query(
    `
      SELECT
        c.*,
        COALESCE(ship_stats.active_shipments, 0)::int AS active_shipments
      FROM carriers c
      LEFT JOIN LATERAL (
        SELECT COUNT(fs.id) AS active_shipments
        FROM fleet_shipments fs
        WHERE fs.carrier_id = c.id AND (fs.status = 'in_transit' OR fs.status = 'temp_breach')
      ) ship_stats ON TRUE
      ${whereClause}
      ORDER BY c.cold_chain_sla_score DESC, c.name ASC
      LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
    `,
    queryParams
  );

  return {
    carriers: dataRes.rows,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      total_pages: Math.ceil(total / Number(limit)) || 1,
    },
  };
};

const createCarrierAdmin = async (data, actorId = null, ipAddress = null, userAgent = null) => {
  const result = await pool.query(
    `
      INSERT INTO carriers (
        name, code, contact_person, phone, email, status,
        total_fleet_count, cold_chain_sla_score, coverage_regions, notes,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING *
    `,
    [
      data.name,
      data.code,
      data.contact_person || null,
      data.phone,
      data.email || null,
      data.status || "active",
      data.total_fleet_count ? parseInt(data.total_fleet_count) : 0,
      data.cold_chain_sla_score ? parseFloat(data.cold_chain_sla_score) : 98.5,
      JSON.stringify(data.coverage_regions || ["Oromia", "Addis Ababa"]),
      data.notes || null,
    ]
  );

  const created = result.rows[0];

  await auditService.record({
    actorId,
    action: "carrier.onboard",
    entityType: "carrier",
    entityId: created.id,
    beforeState: null,
    afterState: created,
    reason: `Onboarded freight partner ${created.name}`,
    ipAddress,
    userAgent,
  });

  return created;
};

const updateCarrierAdmin = async (id, data, actorId = null, ipAddress = null, userAgent = null) => {
  const checkRes = await pool.query("SELECT * FROM carriers WHERE id = $1", [id]);
  if (checkRes.rows.length === 0) return null;
  const before = checkRes.rows[0];

  const updateRes = await pool.query(
    `
      UPDATE carriers
      SET name = COALESCE($1, name),
          contact_person = COALESCE($2, contact_person),
          phone = COALESCE($3, phone),
          email = COALESCE($4, email),
          status = COALESCE($5, status),
          total_fleet_count = COALESCE($6, total_fleet_count),
          cold_chain_sla_score = COALESCE($7, cold_chain_sla_score),
          notes = COALESCE($8, notes),
          updated_at = NOW()
      WHERE id = $9
      RETURNING *
    `,
    [
      data.name,
      data.contact_person,
      data.phone,
      data.email,
      data.status,
      data.total_fleet_count,
      data.cold_chain_sla_score,
      data.notes,
      id,
    ]
  );

  const after = updateRes.rows[0];

  await auditService.record({
    actorId,
    action: "carrier.update",
    entityType: "carrier",
    entityId: id,
    beforeState: before,
    afterState: after,
    reason: data.reason || `Updated carrier partner ${after.name}`,
    ipAddress,
    userAgent,
  });

  return after;
};

/**
 * Logistics Hubs & Cold Storage Depots
 */
const getHubsAdmin = async ({ region = null, hub_type = null, search = null }) => {
  const conditions = [];
  const params = [];

  if (region && region !== "all") {
    params.push(region);
    conditions.push(`h.region = $${params.length}`);
  }

  if (hub_type && hub_type !== "all") {
    params.push(hub_type);
    conditions.push(`h.hub_type = $${params.length}`);
  }

  if (search && search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`);
    const sIndex = params.length;
    conditions.push(`(
      LOWER(h.name) LIKE $${sIndex} OR
      LOWER(h.code) LIKE $${sIndex} OR
      LOWER(h.city) LIKE $${sIndex} OR
      LOWER(h.region) LIKE $${sIndex}
    )`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await pool.query(
    `
      SELECT
        h.*,
        ROUND((h.cold_storage_capacity_m3 * h.current_utilization_pct / 100), 1)::numeric AS utilized_m3
      FROM logistics_hubs h
      ${whereClause}
      ORDER BY h.cold_storage_capacity_m3 DESC
    `,
    params
  );

  return { hubs: result.rows };
};

const upsertHubAdmin = async (data, actorId = null, ipAddress = null, userAgent = null) => {
  let result;
  if (data.id) {
    result = await pool.query(
      `
        UPDATE logistics_hubs
        SET name = COALESCE($1, name),
            region = COALESCE($2, region),
            city = COALESCE($3, city),
            address = COALESCE($4, address),
            hub_type = COALESCE($5, hub_type),
            cold_storage_capacity_m3 = COALESCE($6, cold_storage_capacity_m3),
            current_utilization_pct = COALESCE($7, current_utilization_pct),
            temp_zone_min = COALESCE($8, temp_zone_min),
            temp_zone_max = COALESCE($9, temp_zone_max),
            manager_name = COALESCE($10, manager_name),
            manager_phone = COALESCE($11, manager_phone),
            is_operational = COALESCE($12, is_operational),
            updated_at = NOW()
        WHERE id = $13
        RETURNING *
      `,
      [
        data.name,
        data.region,
        data.city,
        data.address,
        data.hub_type,
        data.cold_storage_capacity_m3,
        data.current_utilization_pct,
        data.temp_zone_min,
        data.temp_zone_max,
        data.manager_name,
        data.manager_phone,
        data.is_operational,
        data.id,
      ]
    );
  } else {
    const code = data.code || `HUB-${data.city?.substring(0, 3).toUpperCase() || "ETH"}-${Math.floor(10 + Math.random() * 90)}`;
    result = await pool.query(
      `
        INSERT INTO logistics_hubs (
          name, code, region, city, address, hub_type,
          cold_storage_capacity_m3, current_utilization_pct, temp_zone_min, temp_zone_max,
          manager_name, manager_phone, is_operational, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
        RETURNING *
      `,
      [
        data.name,
        code,
        data.region,
        data.city,
        data.address,
        data.hub_type || "cold_storage_depot",
        data.cold_storage_capacity_m3 || 500.0,
        data.current_utilization_pct || 50.0,
        data.temp_zone_min || 0.0,
        data.temp_zone_max || 4.0,
        data.manager_name,
        data.manager_phone,
        data.is_operational !== undefined ? data.is_operational : true,
      ]
    );
  }

  const hub = result.rows[0];

  await auditService.record({
    actorId,
    action: data.id ? "hub.update" : "hub.create",
    entityType: "hub",
    entityId: hub.id,
    beforeState: null,
    afterState: hub,
    reason: `Configured logistics hub ${hub.name}`,
    ipAddress,
    userAgent,
  });

  return hub;
};

/**
 * Logistics Incidents & SLA Resolution
 */
const getIncidentsAdmin = async ({
  severity = null,
  resolved = null,
  search = null,
  page = 1,
  limit = 20,
}) => {
  const conditions = [];
  const params = [];

  if (severity && severity !== "all") {
    params.push(severity);
    conditions.push(`li.severity = $${params.length}`);
  }

  if (resolved !== null && resolved !== undefined && resolved !== "all") {
    params.push(resolved === "true" || resolved === true);
    conditions.push(`li.is_resolved = $${params.length}`);
  }

  if (search && search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`);
    const sIndex = params.length;
    conditions.push(`(
      LOWER(li.shipment_id) LIKE $${sIndex} OR
      LOWER(li.incident_type) LIKE $${sIndex} OR
      LOWER(li.description) LIKE $${sIndex} OR
      LOWER(COALESCE(li.checkpoint, '')) LIKE $${sIndex} OR
      LOWER(fs.vehicle_plate) LIKE $${sIndex}
    )`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  // Summary Metrics
  const metricsRes = await pool.query(`
    SELECT
      COUNT(*)::int AS total_incidents,
      COUNT(*) FILTER (WHERE is_resolved = FALSE)::int AS unresolved_count,
      COUNT(*) FILTER (WHERE severity = 'critical' AND is_resolved = FALSE)::int AS critical_unresolved,
      COUNT(*) FILTER (WHERE incident_type = 'temperature_spike')::int AS temperature_breaches,
      COUNT(*) FILTER (WHERE incident_type = 'route_deviation')::int AS route_deviations,
      COUNT(*) FILTER (WHERE incident_type = 'mechanical_failure')::int AS mechanical_failures
    FROM logistics_incidents
  `);

  const countRes = await pool.query(
    `
      SELECT COUNT(*)::int AS total
      FROM logistics_incidents li
      LEFT JOIN fleet_shipments fs ON fs.id = li.shipment_id
      ${whereClause}
    `,
    params
  );
  const total = countRes.rows[0]?.total || 0;

  const offset = (Number(page) - 1) * Number(limit);
  const queryParams = [...params, Number(limit), offset];

  const dataRes = await pool.query(
    `
      SELECT
        li.*,
        fs.vehicle_plate,
        fs.driver_name,
        fs.driver_phone,
        fs.carrier_partner,
        fs.origin_hub,
        fs.destination_hub,
        u.name AS resolver_name
      FROM logistics_incidents li
      LEFT JOIN fleet_shipments fs ON fs.id = li.shipment_id
      LEFT JOIN users u ON u.id = li.resolved_by
      ${whereClause}
      ORDER BY (li.is_resolved = FALSE) DESC, li.created_at DESC
      LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
    `,
    queryParams
  );

  return {
    incidents: dataRes.rows,
    metrics: metricsRes.rows[0] || {},
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      total_pages: Math.ceil(total / Number(limit)) || 1,
    },
  };
};

const resolveIncident = async (incidentId, { resolution_notes, corrective_action }, actorId = null, ipAddress = null, userAgent = null) => {
  const checkRes = await pool.query("SELECT * FROM logistics_incidents WHERE id = $1", [incidentId]);
  if (checkRes.rows.length === 0) return null;
  const before = checkRes.rows[0];

  const updateRes = await pool.query(
    `
      UPDATE logistics_incidents
      SET is_resolved = TRUE,
          resolved_at = NOW(),
          resolved_by = $1,
          resolution_notes = $2,
          corrective_action = $3,
          updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `,
    [actorId, resolution_notes, corrective_action || "Root cause verified and logged", incidentId]
  );

  const after = updateRes.rows[0];

  await auditService.record({
    actorId,
    action: "logistics.incident.resolve",
    entityType: "incident",
    entityId: incidentId,
    beforeState: before,
    afterState: after,
    reason: resolution_notes || "Resolved cold-chain logistics incident",
    ipAddress,
    userAgent,
  });

  return after;
};

module.exports = {
  getFleetShipmentsAdmin,
  getShipmentDossier,
  assignDispatchBatch,
  emergencyRerouteTruck,
  getCarriersAdmin,
  createCarrierAdmin,
  updateCarrierAdmin,
  getHubsAdmin,
  upsertHubAdmin,
  getIncidentsAdmin,
  resolveIncident,
};

