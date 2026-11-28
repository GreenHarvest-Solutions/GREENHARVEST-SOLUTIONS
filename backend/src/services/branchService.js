const { pool } = require("../config/db");
const branchModel = require("../models/branchModel");
const notificationModel = require("../models/notificationModel");
const { normalizeRole } = require("../utils/roles");

const createServiceError = (message, statusCode, extra = {}) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
};

const VALID_VERIFICATION_TRANSITIONS = {
  draft: ["submitted", "verified"], // admin may fast-verify if needed, farmer submits
  submitted: ["under_review", "verified", "rejected"],
  under_review: ["verified", "rejected"],
  verified: ["suspended", "deactivated", "under_review"],
  rejected: ["submitted", "under_review", "verified"],
  suspended: ["verified", "deactivated"],
  deactivated: ["submitted", "verified"],
};

/**
 * Authorize actor access to a specific branch with explicit action scope.
 * Prevents Branch A staff from modifying Branch B and prevents non-owners from mutating financials.
 */
const assertBranchAccess = async ({ actor, branchId, requiredPermission = "manage_orders", allowAdmin = true }) => {
  if (!actor) throw createServiceError("Authentication required", 401);
  const role = normalizeRole(actor.role);
  const branch = await branchModel.getBranchById(Number(branchId));
  if (!branch) throw createServiceError("Branch not found", 404);

  if (allowAdmin && role === "admin") {
    return { branch, accessLevel: "admin", staffRecord: null };
  }

  // Financial account modification is strictly restricted to farmer business owner (or admin)
  if (requiredPermission === "manage_financials") {
    if (Number(branch.farmer_id) !== Number(actor.id)) {
      throw createServiceError("Forbidden: only the farmer business owner can manage financial settings", 403);
    }
    return { branch, accessLevel: "farmer_owner", staffRecord: null };
  }

  if (Number(branch.farmer_id) === Number(actor.id)) {
    return { branch, accessLevel: "farmer_owner", staffRecord: null };
  }

  // Check scoped branch_staff assignment (strictly limited to THIS branchId)
  const staff = await branchModel.getBranchStaffAccess(Number(branchId), Number(actor.id));
  if (!staff) {
    throw createServiceError("Forbidden: you do not have access to this fulfillment branch", 403);
  }

  const perms = staff.permissions || {};
  if (requiredPermission && perms[requiredPermission] !== true && staff.role !== "farmer_owner") {
    throw createServiceError(
      `Forbidden: branch role "${staff.role}" lacks "${requiredPermission}" permission`,
      403
    );
  }

  return { branch, accessLevel: staff.role, staffRecord: staff };
};

const getMyBusinessAndBranches = async (actor) => {
  const role = normalizeRole(actor.role);
  if (role === "farmer") {
    const business = await branchModel.getBusinessByFarmerId(Number(actor.id));
    const branches = await branchModel.listFarmerBranches(Number(actor.id));
    return { business, branches, access_mode: "owner" };
  }
  // If user is branch staff assigned to specific branches
  const staffBranches = await branchModel.getStaffBranchesForUser(Number(actor.id));
  return { business: null, branches: staffBranches, access_mode: "staff" };
};

const updateMyBusiness = async ({ actor, payload }) => {
  const role = normalizeRole(actor.role);
  if (role !== "farmer" && role !== "admin") {
    throw createServiceError("Only farmer business owners can modify business profile & payouts", 403);
  }
  if (role !== "admin" && payload.farmer_id && Number(payload.farmer_id) !== Number(actor.id)) {
    throw createServiceError("Forbidden: branch staff cannot change farmer financial accounts", 403);
  }
  const targetFarmerId = role === "admin" && payload.farmer_id
    ? Number(payload.farmer_id)
    : Number(actor.id);

  // If caller is assigned as branch staff elsewhere and owns no business yet, deny financial mutation
  if (role !== "admin") {
    const ownedRes = await pool.query(`SELECT COUNT(*)::int AS cnt FROM farmer_branches WHERE farmer_id = $1`, [actor.id]);
    const staffRes = await pool.query(`SELECT COUNT(*)::int AS cnt FROM branch_staff WHERE user_id = $1 AND is_active = TRUE`, [actor.id]);
    if (ownedRes.rows[0].cnt === 0 && staffRes.rows[0].cnt > 0) {
      throw createServiceError("Forbidden: branch staff cannot change farmer financial accounts", 403);
    }
  }

  const updated = await branchModel.updateBusiness(targetFarmerId, payload);
  return updated;
};

const createFarmerBranch = async ({ actor, payload }) => {
  const role = normalizeRole(actor.role);
  if (role !== "farmer" && role !== "admin") {
    throw createServiceError("Only farmer owners or admins can create new fulfillment branches", 403);
  }

  const farmerId = role === "admin" && payload.farmer_id ? Number(payload.farmer_id) : Number(actor.id);
  const { business } = await branchModel.ensureFarmerBusinessAndPrimaryBranch(farmerId);

  if (!payload.name || !String(payload.name).trim() || !payload.physical_address || !String(payload.physical_address).trim()) {
    throw createServiceError("Branch name and physical address are required", 400);
  }

  // New farmer-created branches begin as draft or submitted (never auto-verified bypassing review unless admin creates/approves)
  const initialVerification =
    role === "admin" && payload.verification_status === "verified"
      ? "verified"
      : payload.submit_for_review
      ? "submitted"
      : "draft";

  const created = await branchModel.createBranch({
    business_id: business.id,
    farmer_id: farmerId,
    name: String(payload.name).trim(),
    branch_type: payload.branch_type || "agricultural_farm",
    physical_address: String(payload.physical_address).trim(),
    region: payload.region || null,
    zone_area: payload.zone_area || null,
    city: payload.city || null,
    woreda: payload.woreda || null,
    kebele: payload.kebele || null,
    landmark: payload.landmark || null,
    latitude: payload.latitude !== undefined && payload.latitude !== "" ? Number(payload.latitude) : null,
    longitude: payload.longitude !== undefined && payload.longitude !== "" ? Number(payload.longitude) : null,
    contact_name: payload.contact_name || null,
    contact_phone: payload.contact_phone || null,
    contact_email: payload.contact_email || null,
    operating_hours: payload.operating_hours || null,
    supported_delivery_methods: payload.supported_delivery_methods || null,
    delivery_radius_km: payload.delivery_radius_km ?? 50,
    farmer_delivery_base_fee: payload.farmer_delivery_base_fee ?? null,
    farmer_delivery_per_km_rate: payload.farmer_delivery_per_km_rate ?? null,
    storage_capacity_kg: payload.storage_capacity_kg ?? 50000,
    max_daily_orders: payload.max_daily_orders ?? 50,
    max_pickup_capacity_per_hour: payload.max_pickup_capacity_per_hour ?? 15,
    available_delivery_staff: payload.available_delivery_staff ?? 2,
    available_vehicles: payload.available_vehicles ?? 1,
    handling_capabilities: payload.handling_capabilities || null,
    special_instructions: payload.special_instructions || null,
    is_primary: false,
    is_preferred: Boolean(payload.is_preferred),
    verification_status: initialVerification,
    operational_status: payload.operational_status || "active",
  });

  await branchModel.recordVerificationDecision(pool, {
    branch_id: created.id,
    previous_status: null,
    new_status: initialVerification,
    decision_notes: "Branch created",
    actor_id: actor.id,
    actor_role: role,
  });

  await branchModel.recordBranchAuditLog(pool, {
    branch_id: created.id,
    actor_id: actor.id,
    actor_role: role,
    action: "branch_created",
    entity_type: "farmer_branch",
    entity_id: created.id,
    details: { name: created.name, verification_status: initialVerification },
  });

  return created;
};

const updateFarmerBranch = async ({ actor, branchId, payload }) => {
  const { branch, accessLevel } = await assertBranchAccess({
    actor,
    branchId,
    requiredPermission: "manage_branch_settings",
  });

  const updated = await branchModel.updateBranch(branch.id, payload);

  await branchModel.recordBranchAuditLog(pool, {
    branch_id: branch.id,
    actor_id: actor.id,
    actor_role: accessLevel,
    action: "branch_updated",
    entity_type: "farmer_branch",
    entity_id: branch.id,
    details: { updated_fields: Object.keys(payload || {}) },
  });

  return updated;
};

const submitBranchForVerification = async ({ actor, branchId, notes = null }) => {
  const { branch, accessLevel } = await assertBranchAccess({
    actor,
    branchId,
    requiredPermission: "manage_branch_settings",
  });

  if (!["draft", "rejected"].includes(branch.verification_status)) {
    throw createServiceError(`Branch in status "${branch.verification_status}" cannot be submitted again right now`, 409);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const updated = await branchModel.updateBranchVerificationStatus(client, {
      branch_id: branch.id,
      verification_status: "submitted",
      decision_notes: notes,
      actor_id: actor.id,
      actor_role: accessLevel,
    });
    await branchModel.recordVerificationDecision(client, {
      branch_id: branch.id,
      previous_status: branch.verification_status,
      new_status: "submitted",
      decision_notes: notes || "Submitted by farmer for admin verification",
      actor_id: actor.id,
      actor_role: accessLevel,
    });
    await branchModel.recordBranchAuditLog(client, {
      branch_id: branch.id,
      actor_id: actor.id,
      actor_role: accessLevel,
      action: "branch_submitted_for_verification",
      entity_type: "farmer_branch",
      entity_id: branch.id,
      details: { notes },
    });
    await client.query("COMMIT");
    return updated;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Admin Branch Verification Lifecycle + Operational Recovery on Suspension/Deactivation.
 * Preserves historical order & financial records and flags impacted active suborders.
 */
const reviewBranchVerificationAdmin = async ({ actor, branchId, nextStatus, decisionNotes = "" }) => {
  if (normalizeRole(actor.role) !== "admin") {
    throw createServiceError("Only admins can verify, reject, or suspend branches", 403);
  }
  const branch = await branchModel.getBranchById(Number(branchId));
  if (!branch) throw createServiceError("Branch not found", 404);

  const normalized = String(nextStatus || "").trim().toLowerCase();
  const allowedNext = VALID_VERIFICATION_TRANSITIONS[branch.verification_status] || [];
  if (!allowedNext.includes(normalized) && normalized !== branch.verification_status) {
    throw createServiceError(
      `Invalid branch verification transition from "${branch.verification_status}" to "${normalized}"`,
      400
    );
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const updated = await branchModel.updateBranchVerificationStatus(client, {
      branch_id: branch.id,
      verification_status: normalized,
      decision_notes: decisionNotes || null,
      actor_id: actor.id,
      actor_role: "admin",
    });

    await branchModel.recordVerificationDecision(client, {
      branch_id: branch.id,
      previous_status: branch.verification_status,
      new_status: normalized,
      decision_notes: decisionNotes || `Admin set status to ${normalized}`,
      actor_id: actor.id,
      actor_role: "admin",
    });

    await branchModel.recordBranchAuditLog(client, {
      branch_id: branch.id,
      actor_id: actor.id,
      actor_role: "admin",
      action: `branch_verification_${normalized}`,
      entity_type: "farmer_branch",
      entity_id: branch.id,
      details: { previous_status: branch.verification_status, new_status: normalized, decisionNotes },
    });

    let impactedExceptions = [];
    if (["suspended", "deactivated", "rejected"].includes(normalized)) {
      impactedExceptions = await flagImpactedSubordersOnBranchOutage(client, {
        branch,
        reason: decisionNotes || `Branch ${normalized} by administration`,
        actorId: actor.id,
      });
    }

    // Re-sync aggregate inventory for products stocked at this branch
    await client.query(
      `UPDATE branch_inventory SET updated_at = NOW() WHERE branch_id = $1`,
      [branch.id]
    );

    await client.query("COMMIT");

    try {
      await notificationModel.createNotificationForUser({
        user_id: branch.farmer_id,
        title: `Branch Verification: ${normalized.replace(/_/g, " ").toUpperCase()}`,
        message: `Branch "${branch.name}" (${branch.branch_code}) status updated to ${normalized}. ${decisionNotes || ""}`.trim(),
        type: "system",
      });
    } catch (_) {}

    return { branch: updated, impacted_exceptions_created: impactedExceptions.length, exceptions: impactedExceptions };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Branch Closure / Suspension Recovery (Section 12):
 * Preserves active & historical orders, flags pre-dispatch vs post-dispatch exceptions.
 */
const flagImpactedSubordersOnBranchOutage = async (client, { branch, reason, actorId }) => {
  const activeSubs = await client.query(
    `SELECT s.id, s.parent_order_id, s.fulfillment_status, o.buyer_id
     FROM suborders s
     JOIN orders o ON o.id = s.parent_order_id
     WHERE s.branch_id = $1
       AND s.fulfillment_status NOT IN ('delivered', 'cancelled')`,
    [branch.id]
  );

  const created = [];
  for (const sub of activeSubs.rows) {
    const isPreDispatch = ["pending", "accepted", "packed"].includes(sub.fulfillment_status);
    const exceptionType = isPreDispatch ? "branch_closure_pre_dispatch" : "branch_closure_post_dispatch";

    const exRes = await client.query(
      `INSERT INTO delivery_exceptions (
         order_id, suborder_id, branch_id, exception_type, severity, status,
         description, requires_buyer_approval, escalated_to_admin
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE)
       RETURNING *`,
      [
        sub.parent_order_id,
        sub.id,
        branch.id,
        exceptionType,
        isPreDispatch ? "high" : "critical",
        isPreDispatch ? "pending_buyer_approval" : "escalated",
        isPreDispatch
          ? `Branch "${branch.name}" became unavailable prior to dispatch (${reason}). Eligible alternative branches should be evaluated.`
          : `Branch "${branch.name}" closed/suspended post-dispatch (${reason}). Package preserved for safe routing/delivery without rewriting branch origin.`,
        isPreDispatch,
      ]
    );
    created.push(exRes.rows[0]);
  }
  return created;
};

const handleBranchOperationalClosure = async ({ actor, branchId, operationalStatus, closureReason = "" }) => {
  const allowed = ["active", "busy", "at_capacity", "temporarily_closed", "suspended", "deactivated"];
  if (!allowed.includes(operationalStatus)) {
    throw createServiceError("Invalid branch operational_status", 400);
  }
  const { branch, accessLevel } = await assertBranchAccess({
    actor,
    branchId,
    requiredPermission: "manage_branch_settings",
  });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const updated = await branchModel.updateBranch(
      branch.id,
      {
        operational_status: operationalStatus,
        service_available: !["temporarily_closed", "suspended", "deactivated"].includes(operationalStatus),
        closure_reason: closureReason || null,
      },
      client
    );

    let exceptions = [];
    if (["temporarily_closed", "suspended", "deactivated"].includes(operationalStatus)) {
      exceptions = await flagImpactedSubordersOnBranchOutage(client, {
        branch,
        reason: closureReason || `Operational status changed to ${operationalStatus}`,
        actorId: actor.id,
      });
    }

    // Touch branch inventory to trigger aggregate stock re-sync
    await client.query(`UPDATE branch_inventory SET updated_at = NOW() WHERE branch_id = $1`, [branch.id]);

    await branchModel.recordBranchAuditLog(client, {
      branch_id: branch.id,
      actor_id: actor.id,
      actor_role: accessLevel,
      action: `branch_operational_${operationalStatus}`,
      entity_type: "farmer_branch",
      entity_id: branch.id,
      details: { closureReason, impacted_suborders: exceptions.length },
    });

    await client.query("COMMIT");
    return { branch: updated, impacted_exceptions: exceptions };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

// Staff management (strictly Owner or Admin)
const assignBranchStaff = async ({ actor, branchId, payload }) => {
  const { branch } = await assertBranchAccess({
    actor,
    branchId,
    requiredPermission: "manage_staff",
  });

  if (normalizeRole(actor.role) !== "admin" && Number(branch.farmer_id) !== Number(actor.id)) {
    throw createServiceError("Only the farmer business owner or admin can manage branch staff", 403);
  }

  let resolvedUserId = payload.user_id ? Number(payload.user_id) : null;
  if (!resolvedUserId && payload.staff_email) {
    const uRes = await pool.query(`SELECT id, name, phone FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`, [
      String(payload.staff_email).trim(),
    ]);
    if (uRes.rows.length > 0) {
      resolvedUserId = uRes.rows[0].id;
    }
  }

  const staffName = String(payload.staff_name || payload.name || "").trim();
  if (!staffName) throw createServiceError("staff_name is required", 400);

  const staff = await branchModel.addOrUpdateBranchStaff({
    branch_id: branch.id,
    farmer_id: branch.farmer_id,
    user_id: resolvedUserId,
    staff_name: staffName,
    staff_email: payload.staff_email || null,
    staff_phone: payload.staff_phone || null,
    role: payload.role || "branch_manager",
    permissions: payload.permissions || null,
    assigned_by: actor.id,
  });

  await branchModel.recordBranchAuditLog(pool, {
    branch_id: branch.id,
    actor_id: actor.id,
    actor_role: normalizeRole(actor.role),
    action: "branch_staff_assigned",
    entity_type: "branch_staff",
    entity_id: staff.id,
    details: { staff_name: staff.staff_name, role: staff.role, user_id: resolvedUserId },
  });

  return staff;
};

const removeBranchStaffMember = async ({ actor, branchId, staffId }) => {
  const { branch } = await assertBranchAccess({
    actor,
    branchId,
    requiredPermission: "manage_staff",
  });
  if (normalizeRole(actor.role) !== "admin" && Number(branch.farmer_id) !== Number(actor.id)) {
    throw createServiceError("Only the farmer business owner or admin can remove branch staff", 403);
  }
  const removed = await branchModel.deactivateBranchStaff(Number(staffId), branch.id);
  if (!removed) throw createServiceError("Staff member not found on this branch", 404);
  return removed;
};

/**
 * Evaluate branch operating hours & daily capacity for eligibility/warnings
 */
const evaluateBranchCapacityAndHours = (branch, requestedDate = new Date()) => {
  const todayOrders = Number(branch.today_orders_count || 0);
  const maxDaily = Number(branch.max_daily_orders || 50);
  const hasOrderCapacity = todayOrders < maxDaily;

  const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const dayKey = dayNames[requestedDate.getDay()];
  const hours = branch.operating_hours || {};
  const daySpec = hours[dayKey];
  const isHoliday = Array.isArray(branch.holiday_dates) && branch.holiday_dates.includes(requestedDate.toISOString().slice(0, 10));

  let isWithinOperatingHours = true;
  if (isHoliday || (daySpec && daySpec.closed)) {
    isWithinOperatingHours = false;
  } else if (daySpec && daySpec.open && daySpec.close) {
    const hhmm = `${String(requestedDate.getHours()).padStart(2, "0")}:${String(requestedDate.getMinutes()).padStart(2, "0")}`;
    // Allow scheduling outside exact instant window, track live status transparently
    isWithinOperatingHours = hhmm >= daySpec.open && hhmm <= daySpec.close;
  }

  return {
    is_eligible_now:
      branch.verification_status === "verified" &&
      ["active", "busy"].includes(branch.operational_status) &&
      branch.service_available !== false &&
      hasOrderCapacity &&
      !isHoliday,
    has_order_capacity: hasOrderCapacity,
    remaining_daily_orders: Math.max(0, maxDaily - todayOrders),
    is_within_operating_hours: isWithinOperatingHours,
    is_holiday: isHoliday,
  };
};

module.exports = {
  assertBranchAccess,
  assignBranchStaff,
  createFarmerBranch,
  evaluateBranchCapacityAndHours,
  flagImpactedSubordersOnBranchOutage,
  getMyBusinessAndBranches,
  handleBranchOperationalClosure,
  removeBranchStaffMember,
  reviewBranchVerificationAdmin,
  submitBranchForVerification,
  updateFarmerBranch,
  updateMyBusiness,
};
