const { pool } = require("../config/db");
const deliveryPricingService = require("./deliveryPricingService");
const branchAllocationService = require("./branchAllocationService");
const branchService = require("./branchService");
const branchModel = require("../models/branchModel");
const inventoryModel = require("../models/inventoryModel");
const { normalizeRole } = require("../utils/roles");

const createServiceError = (message, statusCode, extra = {}) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
};

// Mask phone numbers in operational messages to protect privacy
const maskPrivatePhoneNumbers = (text) => {
  return String(text || "").replace(/(?:\+?251|0)?[\s.-]?9\d{2}[\s.-]?\d{3}[\s.-]?\d{3}/g, "[Phone Masked — Use GreenHarvest Chat]");
};

// 1. Quotes & Post-Checkout Exceptions
const createDeliveryQuote = async ({ buyer_id, payload }) => {
  const branchId = Number(payload.branch_id);
  const deliveryMethod = String(payload.delivery_method || "delivery_partner").trim().toLowerCase();
  const branch = await branchModel.getBranchById(branchId);
  if (!branch) throw createServiceError("Branch not found", 404);

  const items = Array.isArray(payload.items) ? payload.items : [];
  if (items.length === 0) throw createServiceError("At least one item is required for quotation", 400);

  return deliveryPricingService.generateAndSaveDeliveryQuote({
    buyer_id,
    branch,
    delivery_method: deliveryMethod,
    destination_address: payload.destination_address || "",
    destination_lat: payload.destination_lat ?? null,
    destination_lng: payload.destination_lng ?? null,
    items,
    is_same_day: Boolean(payload.is_same_day),
    ttlMinutes: payload.ttl_minutes ?? null,
  });
};

const respondToDeliveryException = async ({ actor, exceptionId, decision, resolutionNotes = "" }) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const exRes = await client.query(`SELECT * FROM delivery_exceptions WHERE id = $1 FOR UPDATE`, [Number(exceptionId)]);
    if (exRes.rows.length === 0) throw createServiceError("Exception not found", 404);
    const ex = exRes.rows[0];

    const oRes = await client.query(`SELECT buyer_id FROM orders WHERE id = $1`, [ex.order_id]);
    const isBuyer = oRes.rows[0] && Number(oRes.rows[0].buyer_id) === Number(actor.id);
    if (!isBuyer && normalizeRole(actor.role) !== "admin") {
      throw createServiceError("Forbidden: only the buyer or admin can respond to this exception", 403);
    }

    const approved = String(decision).toLowerCase() === "approve";
    const updated = await client.query(
      `UPDATE delivery_exceptions
       SET buyer_approved = $1,
           status = $2,
           resolved_by = $3,
           resolved_at = NOW(),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [approved, approved ? "resolved" : "closed", actor.id, ex.id]
    );

    if (approved && ex.exception_type === "address_change_after_checkout" && ex.proposed_resolution?.new_address) {
      const prop = ex.proposed_resolution;
      await client.query(
        `UPDATE deliveries SET delivery_location = $1, distance_km = COALESCE($2, distance_km) WHERE suborder_id = $3`,
        [prop.new_address, prop.new_fee ? undefined : undefined, ex.suborder_id]
      );
      if (prop.new_fee !== undefined) {
        await client.query(
          `UPDATE suborders SET shipping_fee = $1, total_amount = subtotal + $1, updated_at = NOW() WHERE id = $2`,
          [Number(prop.new_fee), ex.suborder_id]
        );
      }
    }

    await client.query("COMMIT");
    return updated.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

// 2. Time Slots (Prevent Overbooking)
const listTimeSlots = async ({ branch_id = null, zone_id = null, slot_date = null, slot_type = null }) => {
  const conds = ["is_active = TRUE", "booked_count < max_capacity"];
  const params = [];
  if (branch_id) {
    params.push(Number(branch_id));
    conds.push(`branch_id = $${params.length}`);
  }
  if (zone_id) {
    params.push(Number(zone_id));
    conds.push(`zone_id = $${params.length}`);
  }
  if (slot_date) {
    params.push(slot_date);
    conds.push(`slot_date = $${params.length}::date`);
  }
  if (slot_type) {
    params.push(slot_type);
    conds.push(`slot_type = $${params.length}`);
  }
  const res = await pool.query(`SELECT * FROM delivery_time_slots WHERE ${conds.join(" AND ")} ORDER BY slot_date ASC, start_time ASC`, params);
  return res.rows;
};

const createTimeSlot = async ({ actor, payload }) => {
  const branchId = payload.branch_id ? Number(payload.branch_id) : null;
  if (branchId) {
    await branchService.assertBranchAccess({ actor, branchId, requiredPermission: "manage_branch_settings" });
  } else if (normalizeRole(actor.role) !== "admin") {
    throw createServiceError("Only admins can create zone-wide slots without a branch_id", 403);
  }
  const res = await pool.query(
    `INSERT INTO delivery_time_slots (branch_id, zone_id, slot_date, start_time, end_time, slot_type, max_capacity)
     VALUES ($1,$2,$3::date,$4::time,$5::time,$6,$7)
     RETURNING *`,
    [
      branchId,
      payload.zone_id || null,
      payload.slot_date,
      payload.start_time,
      payload.end_time,
      payload.slot_type || "delivery",
      Number(payload.max_capacity || 10),
    ]
  );
  return res.rows[0];
};

// 3. Product Substitutions (Requires Buyer Approval Before Applying Financial Changes)
const proposeSubstitution = async ({ actor, suborderId, payload }) => {
  const sRes = await pool.query(`SELECT * FROM suborders WHERE id = $1`, [Number(suborderId)]);
  if (sRes.rows.length === 0) throw createServiceError("Suborder not found", 404);
  const sub = sRes.rows[0];

  if (normalizeRole(actor.role) !== "admin" && Number(sub.farmer_id) !== Number(actor.id)) {
    await branchService.assertBranchAccess({ actor, branchId: sub.branch_id, requiredPermission: "manage_orders" });
  }

  const res = await pool.query(
    `INSERT INTO product_substitutions (
       order_id, suborder_id, original_product_id, original_branch_id,
       substitution_type, proposed_branch_id, proposed_product_id,
       proposed_quantity, price_delta, delivery_fee_delta, reason, proposed_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      sub.parent_order_id,
      sub.id,
      Number(payload.original_product_id),
      sub.branch_id,
      payload.substitution_type,
      payload.proposed_branch_id || null,
      payload.proposed_product_id || null,
      payload.proposed_quantity ?? null,
      Number(payload.price_delta || 0),
      Number(payload.delivery_fee_delta || 0),
      payload.reason || "Stock adjustment proposal",
      actor.id,
    ]
  );
  return res.rows[0];
};

const respondToSubstitution = async ({ actor, substitutionId, decision }) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const pRes = await client.query(
      `SELECT ps.*, o.buyer_id FROM product_substitutions ps JOIN orders o ON o.id = ps.order_id WHERE ps.id = $1 FOR UPDATE`,
      [Number(substitutionId)]
    );
    if (pRes.rows.length === 0) throw createServiceError("Substitution proposal not found", 404);
    const subProp = pRes.rows[0];
    if (Number(subProp.buyer_id) !== Number(actor.id) && normalizeRole(actor.role) !== "admin") {
      throw createServiceError("Forbidden", 403);
    }
    if (subProp.status !== "proposed") {
      throw createServiceError(`Substitution already ${subProp.status}`, 409);
    }

    const approved = String(decision).toLowerCase() === "approve";
    const upd = await client.query(
      `UPDATE product_substitutions SET status = $1, responded_by = $2, responded_at = NOW() WHERE id = $3 RETURNING *`,
      [approved ? "approved" : "rejected", actor.id, subProp.id]
    );

    if (approved) {
      if (subProp.substitution_type === "other_branch" && subProp.proposed_branch_id) {
        await client.query("COMMIT");
        const realloc = await branchAllocationService.reallocateSuborderBranch({
          actor,
          suborderId: subProp.suborder_id,
          targetBranchId: subProp.proposed_branch_id,
          approveFeeDelta: true,
        });
        return { substitution: upd.rows[0], reallocation: realloc };
      }
      if (subProp.substitution_type === "cancel_item") {
        await client.query(
          `UPDATE suborders SET fulfillment_status = 'cancelled', notes = COALESCE(notes || '; ', '') || 'Cancelled via buyer-approved substitution', updated_at = NOW() WHERE id = $1`,
          [subProp.suborder_id]
        );
      }
    }

    await client.query("COMMIT");
    return { substitution: upd.rows[0] };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

// 4. SLA Monitoring & Escalation (Detects overdue ops without blind auto-penalties)
const scanSlaViolations = async () => {
  const overdueRes = await pool.query(
    `SELECT id, parent_order_id, branch_id, fulfillment_status, sla_accept_by, sla_pack_by, sla_pickup_by, sla_deliver_by
     FROM suborders
     WHERE fulfillment_status NOT IN ('delivered', 'cancelled')
       AND sla_breached = FALSE
       AND (
         (fulfillment_status = 'pending' AND sla_accept_by < NOW()) OR
         (fulfillment_status IN ('accepted', 'packed') AND sla_pack_by < NOW()) OR
         (fulfillment_status IN ('in_transit', 'dispatched', 'picked_up') AND sla_deliver_by < NOW())
       )`
  );

  const flagged = [];
  for (const row of overdueRes.rows) {
    await pool.query(`UPDATE suborders SET sla_breached = TRUE, updated_at = NOW() WHERE id = $1`, [row.id]);
    const ex = await pool.query(
      `INSERT INTO delivery_exceptions (
         order_id, suborder_id, branch_id, exception_type, severity, status,
         description, escalated_to_admin
       ) VALUES ($1,$2,$3,'sla_breach','high','escalated',$4,TRUE)
       RETURNING *`,
      [
        row.parent_order_id,
        row.id,
        row.branch_id,
        `SLA deadline exceeded while suborder #${row.id} was in "${row.fulfillment_status}" state. Escalated to Admin review.`,
      ]
    );
    flagged.push(ex.rows[0]);
  }
  return { scanned_overdue_count: flagged.length, exceptions: flagged };
};

const listExceptionsAdmin = async ({ status = null } = {}) => {
  const where = status && status !== "all" ? `WHERE de.status = $1` : "";
  const params = status && status !== "all" ? [status] : [];
  const res = await pool.query(
    `SELECT de.*, fb.name AS branch_name, o.order_number, s.suborder_number
     FROM delivery_exceptions de
     LEFT JOIN farmer_branches fb ON fb.id = de.branch_id
     LEFT JOIN orders o ON o.id = de.order_id
     LEFT JOIN suborders s ON s.id = de.suborder_id
     ${where}
     ORDER BY de.created_at DESC
     LIMIT 100`,
    params
  );
  return res.rows;
};

// 5. Controlled Order Communications (Channel Scoped + Phone Masking)
const postOrderCommunication = async ({ actor, orderId, suborderId = null, channel, message, disputeId = null }) => {
  const role = normalizeRole(actor.role);
  const oRes = await pool.query(`SELECT buyer_id FROM orders WHERE id = $1`, [Number(orderId)]);
  if (oRes.rows.length === 0) throw createServiceError("Order not found", 404);
  const buyerId = oRes.rows[0].buyer_id;

  let authorized = role === "admin" || Number(buyerId) === Number(actor.id);
  if (!authorized && suborderId) {
    const sRes = await pool.query(`SELECT farmer_id, delivery_partner_id, branch_id FROM suborders WHERE id = $1`, [Number(suborderId)]);
    const sub = sRes.rows[0];
    if (sub && (Number(sub.farmer_id) === Number(actor.id) || Number(sub.delivery_partner_id) === Number(actor.id))) {
      authorized = true;
    } else if (sub?.branch_id) {
      const staff = await branchModel.getBranchStaffAccess(sub.branch_id, actor.id);
      if (staff) authorized = true;
    }
  }
  if (!authorized) throw createServiceError("Forbidden: not a participant in this package communication", 403);

  const sanitizedMsg = role === "admin" ? String(message || "").trim() : maskPrivatePhoneNumbers(String(message || "").trim());
  if (!sanitizedMsg) throw createServiceError("Message text is required", 400);

  const res = await pool.query(
    `INSERT INTO order_communications (order_id, suborder_id, dispute_id, sender_id, sender_role, channel, message, masked_phone_notice)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [Number(orderId), suborderId ? Number(suborderId) : null, disputeId ? Number(disputeId) : null, actor.id, role, channel || "buyer_farmer", sanitizedMsg, role !== "admin"]
  );
  return res.rows[0];
};

const listOrderCommunications = async ({ actor, orderId, suborderId = null }) => {
  const role = normalizeRole(actor.role);
  const oRes = await pool.query(`SELECT buyer_id FROM orders WHERE id = $1`, [Number(orderId)]);
  if (oRes.rows.length === 0) throw createServiceError("Order not found", 404);
  let authorized = role === "admin" || Number(oRes.rows[0].buyer_id) === Number(actor.id);
  if (!authorized && suborderId) {
    const sRes = await pool.query(`SELECT farmer_id, delivery_partner_id FROM suborders WHERE id = $1`, [Number(suborderId)]);
    const sub = sRes.rows[0];
    if (sub && (Number(sub.farmer_id) === Number(actor.id) || Number(sub.delivery_partner_id) === Number(actor.id))) authorized = true;
  }
  if (!authorized) throw createServiceError("Forbidden", 403);

  const res = await pool.query(
    `SELECT oc.*, u.name AS sender_name
     FROM order_communications oc
     JOIN users u ON u.id = oc.sender_id
     WHERE oc.order_id = $1 ${suborderId ? "AND (oc.suborder_id = $2 OR oc.suborder_id IS NULL)" : ""}
     ORDER BY oc.created_at ASC`,
    suborderId ? [Number(orderId), Number(suborderId)] : [Number(orderId)]
  );
  return res.rows;
};

// 6. Branch-Level Financial Reconciliation & Reporting (Sections 7, 15, 16)
const getBranchFinancialReconciliation = async ({ farmerId = null }) => {
  const params = [];
  let farmerFilter = "";
  if (farmerId) {
    params.push(Number(farmerId));
    farmerFilter = `WHERE fb.farmer_id = $1`;
  }

  const [branchSummary, orderReconcile, driverSummary] = await Promise.all([
    pool.query(
      `SELECT
         fb.id AS branch_id,
         fb.branch_code,
         fb.name AS branch_name,
         fb.farmer_id,
         u.name AS farmer_name,
         COUNT(s.id)::int AS suborders_count,
         COALESCE(SUM(s.subtotal), 0)::numeric(12,2) AS gross_produce_sales,
         COALESCE(SUM(s.shipping_fee), 0)::numeric(12,2) AS buyer_delivery_charges,
         COALESCE(SUM(el.platform_fee_amount), 0)::numeric(12,2) AS marketplace_commissions,
         COALESCE(SUM(el.farmer_payout_amount), 0)::numeric(12,2) AS net_farmer_payouts,
         COALESCE(SUM(el.driver_payout_amount), 0)::numeric(12,2) AS courier_payouts,
         COALESCE(SUM(el.platform_logistics_fee), 0)::numeric(12,2) AS platform_logistics_revenue
       FROM farmer_branches fb
       JOIN users u ON u.id = fb.farmer_id
       LEFT JOIN suborders s ON s.branch_id = fb.id AND s.fulfillment_status != 'cancelled'
       LEFT JOIN escrow_ledger el ON el.suborder_id = s.id
       ${farmerFilter}
       GROUP BY fb.id, fb.branch_code, fb.name, fb.farmer_id, u.name
       ORDER BY fb.farmer_id ASC, fb.is_primary DESC, fb.id ASC`,
      params
    ),
    pool.query(
      `SELECT
         o.id AS order_id,
         o.order_number,
         o.total_amount AS parent_total_amount,
         COALESCE(SUM(s.total_amount), 0)::numeric(12,2) AS suborders_sum_amount,
         ABS(o.total_amount - COALESCE(SUM(s.total_amount), 0))::numeric(12,2) AS reconciliation_diff
       FROM orders o
       LEFT JOIN suborders s ON s.parent_order_id = o.id
       WHERE o.order_status != 'cancelled'
       GROUP BY o.id
       HAVING COUNT(s.id) > 0
       ORDER BY o.id DESC
       LIMIT 50`
    ),
    pool.query(
      `SELECT
         COUNT(*)::int AS ledger_entries,
         COALESCE(SUM(buyer_paid_delivery_fee), 0)::numeric(12,2) AS total_buyer_delivery_fees,
         COALESCE(SUM(driver_total_earning), 0)::numeric(12,2) AS total_driver_earnings,
         COALESCE(SUM(platform_logistics_revenue), 0)::numeric(12,2) AS total_platform_logistics_revenue
       FROM driver_payout_ledger
       WHERE status != 'forfeited'`
    ),
  ]);

  return {
    branch_financial_summary: branchSummary.rows,
    parent_order_reconciliation: orderReconcile.rows,
    driver_compensation_summary: driverSummary.rows[0] || {},
  };
};

// Allocation strategy configuration
const getAllocationStrategySetting = async () => {
  const res = await pool.query(`SELECT value FROM platform_settings WHERE key = 'branch_allocation_strategy' LIMIT 1`);
  return res.rows[0]?.value || { value: "optimized", allowed: ["optimized", "nearest", "lowest_cost", "fastest", "best_inventory", "farmer_preferred"] };
};

const updateAllocationStrategySetting = async ({ actorId, strategy }) => {
  const allowed = ["optimized", "nearest", "lowest_cost", "fastest", "best_inventory", "farmer_preferred"];
  if (!allowed.includes(strategy)) throw createServiceError("Invalid branch allocation strategy", 400);
  const newVal = { value: strategy, allowed };
  const res = await pool.query(
    `INSERT INTO platform_settings (key, value, updated_by, updated_at)
     VALUES ('branch_allocation_strategy', $1::jsonb, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()
     RETURNING value`,
    [JSON.stringify(newVal), actorId]
  );
  return res.rows[0].value;
};

module.exports = {
  createDeliveryQuote,
  createTimeSlot,
  getAllocationStrategySetting,
  getBranchFinancialReconciliation,
  listExceptionsAdmin,
  listOrderCommunications,
  listTimeSlots,
  maskPrivatePhoneNumbers,
  postOrderCommunication,
  proposeSubstitution,
  respondToDeliveryException,
  respondToSubstitution,
  scanSlaViolations,
  updateAllocationStrategySetting,
};
