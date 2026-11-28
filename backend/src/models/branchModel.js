const { pool } = require("../config/db");

const DEFAULT_OPERATING_HOURS = {
  mon: { open: "06:00", close: "19:00", closed: false },
  tue: { open: "06:00", close: "19:00", closed: false },
  wed: { open: "06:00", close: "19:00", closed: false },
  thu: { open: "06:00", close: "19:00", closed: false },
  fri: { open: "06:00", close: "19:00", closed: false },
  sat: { open: "07:00", close: "17:00", closed: false },
  sun: { open: "08:00", close: "14:00", closed: false },
};

const ensureFarmerBusinessAndPrimaryBranch = async (farmerId, client = pool) => {
  const userRes = await client.query(
    `SELECT u.id, u.name, u.email, u.phone, u.address, u.kyc_status, u.account_status,
            fp.farm_name, fp.region, fp.woreda, fp.kebele, fp.pickup_address, fp.farm_location,
            fp.bank_name, fp.bank_account_number, fp.pickup_instructions
     FROM users u
     LEFT JOIN farmer_profiles fp ON fp.user_id = u.id
     WHERE u.id = $1 LIMIT 1`,
    [farmerId]
  );
  if (userRes.rows.length === 0) return null;
  const u = userRes.rows[0];

  const bizRes = await client.query(
    `INSERT INTO farmer_businesses (
       farmer_id, business_name, verification_status, operating_status,
       payout_bank_name, payout_account_number, payout_account_holder
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (farmer_id) DO UPDATE SET updated_at = NOW()
     RETURNING *`,
    [
      farmerId,
      u.farm_name || `${u.name} Agricultural Business`,
      u.kyc_status === "rejected" ? "rejected" : "verified",
      ["suspended", "banned"].includes(u.account_status) ? "suspended" : "active",
      u.bank_name || null,
      u.bank_account_number || null,
      u.name,
    ]
  );
  const business = bizRes.rows[0];

  const brCheck = await client.query(
    `SELECT * FROM farmer_branches WHERE farmer_id = $1 ORDER BY is_primary DESC, id ASC`,
    [farmerId]
  );

  if (brCheck.rows.length === 0) {
    const code = `BR-${farmerId}-MAIN`;
    const addr = u.pickup_address || u.farm_location || u.address || "Ethiopia Central Hub";
    const newBr = await client.query(
      `INSERT INTO farmer_branches (
         business_id, farmer_id, branch_code, name, branch_type, physical_address,
         region, woreda, kebele, contact_name, contact_phone, contact_email,
         verification_status, operational_status, is_primary, is_preferred, verified_at, special_instructions
       ) VALUES ($1,$2,$3,$4,'main_farm',$5,$6,$7,$8,$9,$10,$11,'verified',$12,TRUE,TRUE,NOW(),$13)
       RETURNING *`,
      [
        business.id,
        farmerId,
        code,
        `${u.farm_name || u.name} - Main Farm`,
        addr,
        u.region || "Oromia",
        u.woreda || null,
        u.kebele || null,
        u.name,
        u.phone || null,
        u.email || null,
        ["suspended", "banned"].includes(u.account_status) ? "suspended" : "active",
        u.pickup_instructions || null,
      ]
    );
    return { business, primaryBranch: newBr.rows[0] };
  }

  return { business, primaryBranch: brCheck.rows[0] };
};

const getBusinessByFarmerId = async (farmerId, client = pool) => {
  await ensureFarmerBusinessAndPrimaryBranch(farmerId, client);
  const res = await client.query(`SELECT * FROM farmer_businesses WHERE farmer_id = $1`, [farmerId]);
  return res.rows[0] || null;
};

const updateBusiness = async (farmerId, fields) => {
  await ensureFarmerBusinessAndPrimaryBranch(farmerId);
  const res = await pool.query(
    `UPDATE farmer_businesses
     SET business_name = COALESCE($1, business_name),
         legal_name = COALESCE($2, legal_name),
         tin_number = COALESCE($3, tin_number),
         payout_bank_name = COALESCE($4, payout_bank_name),
         payout_account_number = COALESCE($5, payout_account_number),
         payout_account_holder = COALESCE($6, payout_account_holder),
         default_allocation_preference = COALESCE($7, default_allocation_preference),
         allow_auto_split = COALESCE($8, allow_auto_split),
         updated_at = NOW()
     WHERE farmer_id = $9
     RETURNING *`,
    [
      fields.business_name ?? null,
      fields.legal_name ?? null,
      fields.tin_number ?? null,
      fields.payout_bank_name ?? null,
      fields.payout_account_number ?? null,
      fields.payout_account_holder ?? null,
      fields.default_allocation_preference ?? null,
      fields.allow_auto_split ?? null,
      farmerId,
    ]
  );
  return res.rows[0];
};

const createBranch = async ({
  business_id,
  farmer_id,
  name,
  branch_type = "agricultural_farm",
  physical_address,
  region = null,
  zone_area = null,
  city = null,
  woreda = null,
  kebele = null,
  landmark = null,
  latitude = null,
  longitude = null,
  contact_name = null,
  contact_phone = null,
  contact_email = null,
  operating_hours = null,
  supported_delivery_methods = null,
  delivery_radius_km = 50,
  farmer_delivery_base_fee = null,
  farmer_delivery_per_km_rate = null,
  storage_capacity_kg = 50000,
  max_daily_orders = 50,
  max_pickup_capacity_per_hour = 15,
  available_delivery_staff = 2,
  available_vehicles = 1,
  handling_capabilities = null,
  special_instructions = null,
  is_primary = false,
  is_preferred = false,
  verification_status = "draft",
  operational_status = "active",
}) => {
  const branchCode = `BR-${farmer_id}-${Date.now().toString().slice(-5)}-${Math.floor(10 + Math.random() * 89)}`;
  const res = await pool.query(
    `INSERT INTO farmer_branches (
       business_id, farmer_id, branch_code, name, branch_type, physical_address,
       region, zone_area, city, woreda, kebele, landmark, latitude, longitude,
       contact_name, contact_phone, contact_email, operating_hours,
       supported_delivery_methods, delivery_radius_km, farmer_delivery_base_fee,
       farmer_delivery_per_km_rate, storage_capacity_kg, max_daily_orders,
       max_pickup_capacity_per_hour, available_delivery_staff, available_vehicles,
       handling_capabilities, special_instructions, is_primary, is_preferred,
       verification_status, operational_status, verified_at
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,
       $19::jsonb,$20,$21,$22,$23,$24,$25,$26,$27,$28::jsonb,$29,$30,$31,$32::varchar,$33,
       CASE WHEN $32::varchar = 'verified' THEN NOW() ELSE NULL END
     )
     RETURNING *`,
    [
      business_id,
      farmer_id,
      branchCode,
      name,
      branch_type,
      physical_address,
      region,
      zone_area,
      city,
      woreda,
      kebele,
      landmark,
      latitude,
      longitude,
      contact_name,
      contact_phone,
      contact_email,
      JSON.stringify(operating_hours || DEFAULT_OPERATING_HOURS),
      JSON.stringify(supported_delivery_methods || ["farmer_pickup", "farmer_delivery", "delivery_partner"]),
      Number(delivery_radius_km || 50),
      farmer_delivery_base_fee,
      farmer_delivery_per_km_rate,
      Number(storage_capacity_kg || 50000),
      Number(max_daily_orders || 50),
      Number(max_pickup_capacity_per_hour || 15),
      Number(available_delivery_staff || 2),
      Number(available_vehicles || 1),
      JSON.stringify(handling_capabilities || { cold_chain: false, bulk_quintal: true, fragile_produce: true }),
      special_instructions,
      Boolean(is_primary),
      Boolean(is_preferred),
      verification_status,
      operational_status,
    ]
  );
  return res.rows[0];
};

const listFarmerBranches = async (farmerId) => {
  await ensureFarmerBusinessAndPrimaryBranch(farmerId);
  const res = await pool.query(
    `SELECT fb.*,
            (SELECT COUNT(*)::int FROM suborders s WHERE s.branch_id = fb.id AND s.created_at >= CURRENT_DATE AND s.fulfillment_status NOT IN ('cancelled')) AS today_orders_count,
            (SELECT COALESCE(SUM(bi.available_quantity), 0)::numeric(12,2) FROM branch_inventory bi WHERE bi.branch_id = fb.id) AS total_available_stock,
            (SELECT COUNT(*)::int FROM branch_staff bs WHERE bs.branch_id = fb.id AND bs.is_active = TRUE) AS active_staff_count
     FROM farmer_branches fb
     WHERE fb.farmer_id = $1
     ORDER BY fb.is_primary DESC, fb.is_preferred DESC, fb.id ASC`,
    [farmerId]
  );
  return res.rows;
};

const getBranchById = async (branchId, client = pool) => {
  const res = await client.query(
    `SELECT fb.*,
            u.name AS farmer_owner_name,
            u.email AS farmer_owner_email,
            (SELECT COUNT(*)::int FROM suborders s WHERE s.branch_id = fb.id AND s.created_at >= CURRENT_DATE AND s.fulfillment_status NOT IN ('cancelled')) AS today_orders_count
     FROM farmer_branches fb
     JOIN users u ON u.id = fb.farmer_id
     WHERE fb.id = $1`,
    [branchId]
  );
  return res.rows[0] || null;
};

const updateBranch = async (branchId, fields, client = pool) => {
  const res = await client.query(
    `UPDATE farmer_branches
     SET name = COALESCE($1, name),
         branch_type = COALESCE($2, branch_type),
         physical_address = COALESCE($3, physical_address),
         region = COALESCE($4, region),
         zone_area = COALESCE($5, zone_area),
         city = COALESCE($6, city),
         woreda = COALESCE($7, woreda),
         kebele = COALESCE($8, kebele),
         landmark = COALESCE($9, landmark),
         latitude = COALESCE($10, latitude),
         longitude = COALESCE($11, longitude),
         contact_name = COALESCE($12, contact_name),
         contact_phone = COALESCE($13, contact_phone),
         contact_email = COALESCE($14, contact_email),
         operating_hours = COALESCE($15::jsonb, operating_hours),
         holiday_dates = COALESCE($16::jsonb, holiday_dates),
         service_available = COALESCE($17, service_available),
         operational_status = COALESCE($18, operational_status),
         supported_delivery_methods = COALESCE($19::jsonb, supported_delivery_methods),
         delivery_radius_km = COALESCE($20, delivery_radius_km),
         farmer_delivery_base_fee = COALESCE($21, farmer_delivery_base_fee),
         farmer_delivery_per_km_rate = COALESCE($22, farmer_delivery_per_km_rate),
         storage_capacity_kg = COALESCE($23, storage_capacity_kg),
         max_daily_orders = COALESCE($24, max_daily_orders),
         max_pickup_capacity_per_hour = COALESCE($25, max_pickup_capacity_per_hour),
         available_delivery_staff = COALESCE($26, available_delivery_staff),
         available_vehicles = COALESCE($27, available_vehicles),
         handling_capabilities = COALESCE($28::jsonb, handling_capabilities),
         special_instructions = COALESCE($29, special_instructions),
         is_preferred = COALESCE($30, is_preferred),
         closure_reason = COALESCE($31, closure_reason),
         updated_at = NOW()
     WHERE id = $32
     RETURNING *`,
    [
      fields.name ?? null,
      fields.branch_type ?? null,
      fields.physical_address ?? null,
      fields.region ?? null,
      fields.zone_area ?? null,
      fields.city ?? null,
      fields.woreda ?? null,
      fields.kebele ?? null,
      fields.landmark ?? null,
      fields.latitude ?? null,
      fields.longitude ?? null,
      fields.contact_name ?? null,
      fields.contact_phone ?? null,
      fields.contact_email ?? null,
      fields.operating_hours ? JSON.stringify(fields.operating_hours) : null,
      fields.holiday_dates ? JSON.stringify(fields.holiday_dates) : null,
      fields.service_available ?? null,
      fields.operational_status ?? null,
      fields.supported_delivery_methods ? JSON.stringify(fields.supported_delivery_methods) : null,
      fields.delivery_radius_km ?? null,
      fields.farmer_delivery_base_fee ?? null,
      fields.farmer_delivery_per_km_rate ?? null,
      fields.storage_capacity_kg ?? null,
      fields.max_daily_orders ?? null,
      fields.max_pickup_capacity_per_hour ?? null,
      fields.available_delivery_staff ?? null,
      fields.available_vehicles ?? null,
      fields.handling_capabilities ? JSON.stringify(fields.handling_capabilities) : null,
      fields.special_instructions ?? null,
      fields.is_preferred ?? null,
      fields.closure_reason ?? null,
      branchId,
    ]
  );
  return res.rows[0] || null;
};

const recordVerificationDecision = async (client, { branch_id, previous_status, new_status, decision_notes, actor_id, actor_role }) => {
  await client.query(
    `INSERT INTO branch_verification_history (branch_id, previous_status, new_status, decision_notes, actor_id, actor_role)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [branch_id, previous_status, new_status, decision_notes || null, actor_id || null, actor_role || null]
  );
};

const updateBranchVerificationStatus = async (client, { branch_id, verification_status, decision_notes = null, actor_id = null, actor_role = null }) => {
  const operationalPatch =
    verification_status === "suspended"
      ? "suspended"
      : verification_status === "deactivated"
      ? "deactivated"
      : verification_status === "verified"
      ? "active"
      : null;

  const res = await client.query(
    `UPDATE farmer_branches
     SET verification_status = $1::varchar,
         operational_status = COALESCE($2::varchar, operational_status),
         verified_by = CASE WHEN $1::varchar = 'verified' THEN COALESCE($3::bigint, verified_by) ELSE verified_by END,
         verified_at = CASE WHEN $1::varchar = 'verified' THEN NOW() ELSE verified_at END,
         rejection_reason = CASE WHEN $1::varchar = 'rejected' THEN $4::text ELSE rejection_reason END,
         suspension_reason = CASE WHEN $1::varchar = 'suspended' THEN $4::text ELSE suspension_reason END,
         updated_at = NOW()
     WHERE id = $5
     RETURNING *`,
    [verification_status, operationalPatch, actor_id, decision_notes, branch_id]
  );
  return res.rows[0] || null;
};

const getBranchVerificationHistory = async (branchId) => {
  const res = await pool.query(
    `SELECT bvh.*, u.name AS actor_name
     FROM branch_verification_history bvh
     LEFT JOIN users u ON u.id = bvh.actor_id
     WHERE bvh.branch_id = $1
     ORDER BY bvh.created_at DESC`,
    [branchId]
  );
  return res.rows;
};

const listBranchesAdmin = async ({ verification_status = null, operational_status = null, search = null, page = 1, limit = 25 }) => {
  const params = [];
  const conds = [];
  if (verification_status && verification_status !== "all") {
    params.push(verification_status);
    conds.push(`fb.verification_status = $${params.length}`);
  }
  if (operational_status && operational_status !== "all") {
    params.push(operational_status);
    conds.push(`fb.operational_status = $${params.length}`);
  }
  if (search && search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`);
    const idx = params.length;
    conds.push(`(LOWER(fb.name) LIKE $${idx} OR LOWER(fb.branch_code) LIKE $${idx} OR LOWER(fb.physical_address) LIKE $${idx} OR LOWER(u.name) LIKE $${idx})`);
  }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const offset = (Number(page) - 1) * Number(limit);

  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS total FROM farmer_branches fb JOIN users u ON u.id = fb.farmer_id ${where}`,
    params
  );

  const dataParams = [...params, Number(limit), offset];
  const dataRes = await pool.query(
    `SELECT fb.*, u.name AS farmer_name, u.email AS farmer_email, u.phone AS farmer_phone,
            (SELECT COUNT(*)::int FROM suborders s WHERE s.branch_id = fb.id) AS total_orders,
            (SELECT COUNT(*)::int FROM branch_inventory bi WHERE bi.branch_id = fb.id) AS stocked_products
     FROM farmer_branches fb
     JOIN users u ON u.id = fb.farmer_id
     ${where}
     ORDER BY CASE WHEN fb.verification_status IN ('submitted','under_review') THEN 1 ELSE 2 END, fb.updated_at DESC
     LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
    dataParams
  );

  return {
    branches: dataRes.rows,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: countRes.rows[0]?.total || 0,
      total_pages: Math.ceil((countRes.rows[0]?.total || 0) / Number(limit)) || 1,
    },
  };
};

// Staff RBAC helpers
const addOrUpdateBranchStaff = async ({ branch_id, farmer_id, user_id = null, staff_name, staff_email = null, staff_phone = null, role = "branch_manager", permissions = null, assigned_by }) => {
  const defaultPerms = {
    manage_inventory: ["farmer_owner", "branch_manager", "inventory_manager"].includes(role),
    manage_orders: ["farmer_owner", "branch_manager", "fulfillment_staff", "branch_delivery_staff"].includes(role),
    manage_transfers: ["farmer_owner", "branch_manager", "inventory_manager"].includes(role),
    manage_branch_settings: ["farmer_owner", "branch_manager"].includes(role),
    manage_financials: role === "farmer_owner",
    manage_staff: role === "farmer_owner",
  };
  const mergedPerms = { ...defaultPerms, ...(permissions || {}), manage_financials: role === "farmer_owner" };

  if (user_id) {
    const res = await pool.query(
      `INSERT INTO branch_staff (branch_id, farmer_id, user_id, staff_name, staff_email, staff_phone, role, permissions, assigned_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
       ON CONFLICT (branch_id, user_id) WHERE user_id IS NOT NULL
       DO UPDATE SET staff_name = EXCLUDED.staff_name,
                     staff_email = COALESCE(EXCLUDED.staff_email, branch_staff.staff_email),
                     staff_phone = COALESCE(EXCLUDED.staff_phone, branch_staff.staff_phone),
                     role = EXCLUDED.role,
                     permissions = EXCLUDED.permissions,
                     is_active = TRUE,
                     updated_at = NOW()
       RETURNING *`,
      [branch_id, farmer_id, user_id, staff_name, staff_email, staff_phone, role, JSON.stringify(mergedPerms), assigned_by]
    );
    return res.rows[0];
  }

  const res = await pool.query(
    `INSERT INTO branch_staff (branch_id, farmer_id, staff_name, staff_email, staff_phone, role, permissions, assigned_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
     RETURNING *`,
    [branch_id, farmer_id, staff_name, staff_email, staff_phone, role, JSON.stringify(mergedPerms), assigned_by]
  );
  return res.rows[0];
};

const listBranchStaff = async (branchId) => {
  const res = await pool.query(
    `SELECT bs.*, u.email AS account_email
     FROM branch_staff bs
     LEFT JOIN users u ON u.id = bs.user_id
     WHERE bs.branch_id = $1 AND bs.is_active = TRUE
     ORDER BY bs.created_at ASC`,
    [branchId]
  );
  return res.rows;
};

const deactivateBranchStaff = async (staffId, branchId) => {
  const res = await pool.query(
    `UPDATE branch_staff SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND branch_id = $2 RETURNING *`,
    [staffId, branchId]
  );
  return res.rows[0] || null;
};

const getBranchStaffAccess = async (branchId, userId) => {
  const res = await pool.query(
    `SELECT * FROM branch_staff WHERE branch_id = $1 AND user_id = $2 AND is_active = TRUE LIMIT 1`,
    [branchId, userId]
  );
  return res.rows[0] || null;
};

const getStaffBranchesForUser = async (userId) => {
  const res = await pool.query(
    `SELECT bs.*, fb.name AS branch_name, fb.branch_code, fb.physical_address, fb.verification_status, fb.operational_status
     FROM branch_staff bs
     JOIN farmer_branches fb ON fb.id = bs.branch_id
     WHERE bs.user_id = $1 AND bs.is_active = TRUE
     ORDER BY fb.id ASC`,
    [userId]
  );
  return res.rows;
};

const recordBranchAuditLog = async (clientOrPool, { branch_id, actor_id = null, actor_role = null, action, entity_type = null, entity_id = null, details = {} }) => {
  const db = clientOrPool || pool;
  await db.query(
    `INSERT INTO branch_audit_logs (branch_id, actor_id, actor_role, action, entity_type, entity_id, details)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
    [branch_id, actor_id, actor_role, action, entity_type, entity_id ? String(entity_id) : null, JSON.stringify(details || {})]
  );
};

const getBranchAuditLogs = async (branchId, limit = 50) => {
  const res = await pool.query(
    `SELECT bal.*, u.name AS actor_name
     FROM branch_audit_logs bal
     LEFT JOIN users u ON u.id = bal.actor_id
     WHERE bal.branch_id = $1
     ORDER BY bal.created_at DESC
     LIMIT $2`,
    [branchId, limit]
  );
  return res.rows;
};

// Delivery zones & service areas
const listDeliveryZones = async ({ includeInactive = false } = {}) => {
  const where = includeInactive ? "" : `WHERE operational_status != 'inactive'`;
  const res = await pool.query(`SELECT * FROM delivery_zones ${where} ORDER BY id ASC`);
  return res.rows;
};

const upsertDeliveryZone = async (payload) => {
  const {
    id = null,
    code,
    name,
    zone_type = "urban",
    region = null,
    city_keywords = [],
    center_lat = null,
    center_lng = null,
    radius_km = 30,
    polygon_geojson = null,
    supported_delivery_methods = ["farmer_pickup", "farmer_delivery", "delivery_partner"],
    base_fee_override = null,
    per_km_rate_override = null,
    min_fee = 40,
    max_fee = 3000,
    remote_surcharge = 0,
    operational_status = "active",
    schedule_config = { same_day_cutoff: "15:00", weekend_service: true },
    special_conditions = null,
  } = payload;

  if (id) {
    const res = await pool.query(
      `UPDATE delivery_zones
       SET name = COALESCE($1, name),
           zone_type = COALESCE($2, zone_type),
           region = COALESCE($3, region),
           city_keywords = COALESCE($4::jsonb, city_keywords),
           center_lat = COALESCE($5, center_lat),
           center_lng = COALESCE($6, center_lng),
           radius_km = COALESCE($7, radius_km),
           polygon_geojson = COALESCE($8::jsonb, polygon_geojson),
           supported_delivery_methods = COALESCE($9::jsonb, supported_delivery_methods),
           base_fee_override = $10,
           per_km_rate_override = $11,
           min_fee = COALESCE($12, min_fee),
           max_fee = COALESCE($13, max_fee),
           remote_surcharge = COALESCE($14, remote_surcharge),
           operational_status = COALESCE($15, operational_status),
           schedule_config = COALESCE($16::jsonb, schedule_config),
           special_conditions = COALESCE($17, special_conditions),
           updated_at = NOW()
       WHERE id = $18
       RETURNING *`,
      [
        name,
        zone_type,
        region,
        city_keywords ? JSON.stringify(city_keywords) : null,
        center_lat,
        center_lng,
        radius_km,
        polygon_geojson ? JSON.stringify(polygon_geojson) : null,
        supported_delivery_methods ? JSON.stringify(supported_delivery_methods) : null,
        base_fee_override,
        per_km_rate_override,
        min_fee,
        max_fee,
        remote_surcharge,
        operational_status,
        schedule_config ? JSON.stringify(schedule_config) : null,
        special_conditions,
        id,
      ]
    );
    return res.rows[0];
  }

  const res = await pool.query(
    `INSERT INTO delivery_zones (
       code, name, zone_type, region, city_keywords, center_lat, center_lng, radius_km,
       polygon_geojson, supported_delivery_methods, base_fee_override, per_km_rate_override,
       min_fee, max_fee, remote_surcharge, operational_status, schedule_config, special_conditions
     ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12,$13,$14,$15,$16,$17::jsonb,$18)
     ON CONFLICT (code) DO UPDATE SET
       name = EXCLUDED.name,
       zone_type = EXCLUDED.zone_type,
       region = EXCLUDED.region,
       city_keywords = EXCLUDED.city_keywords,
       center_lat = EXCLUDED.center_lat,
       center_lng = EXCLUDED.center_lng,
       radius_km = EXCLUDED.radius_km,
       supported_delivery_methods = EXCLUDED.supported_delivery_methods,
       base_fee_override = EXCLUDED.base_fee_override,
       per_km_rate_override = EXCLUDED.per_km_rate_override,
       min_fee = EXCLUDED.min_fee,
       max_fee = EXCLUDED.max_fee,
       remote_surcharge = EXCLUDED.remote_surcharge,
       operational_status = EXCLUDED.operational_status,
       special_conditions = EXCLUDED.special_conditions,
       updated_at = NOW()
     RETURNING *`,
    [
      code || `ZONE-${Date.now().toString().slice(-6)}`,
      name,
      zone_type,
      region,
      JSON.stringify(city_keywords || []),
      center_lat,
      center_lng,
      Number(radius_km || 30),
      polygon_geojson ? JSON.stringify(polygon_geojson) : null,
      JSON.stringify(supported_delivery_methods || ["farmer_pickup", "farmer_delivery", "delivery_partner"]),
      base_fee_override,
      per_km_rate_override,
      Number(min_fee || 40),
      Number(max_fee || 3000),
      Number(remote_surcharge || 0),
      operational_status,
      JSON.stringify(schedule_config || { same_day_cutoff: "15:00", weekend_service: true }),
      special_conditions,
    ]
  );
  return res.rows[0];
};

const listBranchServiceAreas = async (branchId) => {
  const res = await pool.query(
    `SELECT bsa.*, dz.name AS zone_title, dz.code AS zone_code, dz.zone_type, dz.operational_status AS zone_status
     FROM branch_service_areas bsa
     LEFT JOIN delivery_zones dz ON dz.id = bsa.zone_id
     WHERE bsa.branch_id = $1
     ORDER BY bsa.id ASC`,
    [branchId]
  );
  return res.rows;
};

const upsertBranchServiceArea = async ({ branch_id, zone_id, zone_name = null, supported_methods = null, max_distance_km = null, custom_base_fee = null, custom_per_km_rate = null, is_serviceable = true, restrictions = null }) => {
  const res = await pool.query(
    `INSERT INTO branch_service_areas (
       branch_id, zone_id, zone_name, supported_methods, max_distance_km,
       custom_base_fee, custom_per_km_rate, is_serviceable, restrictions
     ) VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9)
     ON CONFLICT (branch_id, zone_id) WHERE zone_id IS NOT NULL
     DO UPDATE SET
       zone_name = COALESCE(EXCLUDED.zone_name, branch_service_areas.zone_name),
       supported_methods = COALESCE(EXCLUDED.supported_methods, branch_service_areas.supported_methods),
       max_distance_km = COALESCE(EXCLUDED.max_distance_km, branch_service_areas.max_distance_km),
       custom_base_fee = EXCLUDED.custom_base_fee,
       custom_per_km_rate = EXCLUDED.custom_per_km_rate,
       is_serviceable = EXCLUDED.is_serviceable,
       restrictions = EXCLUDED.restrictions,
       updated_at = NOW()
     RETURNING *`,
    [
      branch_id,
      zone_id,
      zone_name,
      JSON.stringify(supported_methods || ["farmer_pickup", "farmer_delivery", "delivery_partner"]),
      max_distance_km,
      custom_base_fee,
      custom_per_km_rate,
      Boolean(is_serviceable),
      restrictions,
    ]
  );
  return res.rows[0];
};

module.exports = {
  addOrUpdateBranchStaff,
  createBranch,
  deactivateBranchStaff,
  ensureFarmerBusinessAndPrimaryBranch,
  getBranchAuditLogs,
  getBranchById,
  getBranchStaffAccess,
  getBranchVerificationHistory,
  getBusinessByFarmerId,
  getStaffBranchesForUser,
  listBranchServiceAreas,
  listBranchStaff,
  listBranchesAdmin,
  listDeliveryZones,
  listFarmerBranches,
  recordBranchAuditLog,
  recordVerificationDecision,
  updateBranch,
  updateBranchVerificationStatus,
  updateBusiness,
  upsertBranchServiceArea,
  upsertDeliveryZone,
};
