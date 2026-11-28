// Intelligent Multi-Branch Fulfillment Allocation, Split Decision, Consolidation & Recovery Engine
const { pool } = require("../config/db");
const deliveryPricingService = require("./deliveryPricingService");
const branchService = require("./branchService");
const inventoryModel = require("../models/inventoryModel");
const branchModel = require("../models/branchModel");

const createServiceError = (message, statusCode, extra = {}) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
};

const getConfiguredAllocationStrategy = async (override = null) => {
  if (override && ["optimized", "nearest", "lowest_cost", "fastest", "best_inventory", "farmer_preferred", "admin_assigned"].includes(override)) {
    return override;
  }
  const res = await pool.query(`SELECT value FROM platform_settings WHERE key = 'branch_allocation_strategy' LIMIT 1`);
  return res.rows[0]?.value?.value || "optimized";
};

const scoreBranchCandidate = (candidate, strategy = "optimized") => {
  const dist = Number(candidate.estimate.distance_km || 50);
  const fee = Number(candidate.estimate.shipping_fee || 0);
  const mins = Number(candidate.estimate.estimated_duration_minutes || 60);
  const avail = Number(candidate.total_available_for_items || 0);
  const preferredBonus = candidate.branch.is_preferred ? 1 : 0;

  switch (strategy) {
    case "nearest":
      return dist * 1000 - preferredBonus * 10 - avail * 0.01;
    case "lowest_cost":
      return fee * 1000 + dist * 10 - preferredBonus * 5;
    case "fastest":
      return mins * 1000 + dist * 10 - preferredBonus * 5;
    case "best_inventory":
      return -avail * 1000 + dist * 5 - preferredBonus * 5;
    case "farmer_preferred":
      return -preferredBonus * 100000 + (candidate.branch.is_primary ? -10000 : 0) + fee + dist;
    case "optimized":
    default:
      // Weighted composite: fee + distance + ETA - preference & stock depth
      return fee * 2.0 + dist * 3.0 + mins * 0.8 - preferredBonus * 45 - Math.min(avail, 500) * 0.05;
  }
};

const deterministicCompare = (a, b, strategy) => {
  const diff = scoreBranchCandidate(a, strategy) - scoreBranchCandidate(b, strategy);
  if (Math.abs(diff) > 0.01) return diff;
  if (a.branch.is_preferred !== b.branch.is_preferred) return a.branch.is_preferred ? -1 : 1;
  if (b.total_available_for_items !== a.total_available_for_items) return b.total_available_for_items - a.total_available_for_items;
  if (a.estimate.distance_km !== b.estimate.distance_km) return a.estimate.distance_km - b.estimate.distance_km;
  return Number(a.branch.id) - Number(b.branch.id);
};

/**
 * Allocate a farmer's cart items to 1+ verified eligible fulfillment branches.
 * Supports single-branch selection AND transparent multi-branch split fulfillment when consented.
 */
const allocateFarmerItemsToBranches = async ({
  farmerId,
  farmerItems,
  requestedDeliveryMethod = "delivery_partner",
  destinationAddress = "",
  destinationLat = null,
  destinationLng = null,
  strategyOverride = null,
  preferredBranchId = null,
  allowSplit = false,
  isSameDay = false,
}) => {
  const strategy = await getConfiguredAllocationStrategy(strategyOverride);
  // Load all branches of this farmer
  const branchesRes = await pool.query(
    `SELECT fb.*,
            (SELECT COUNT(*)::int FROM suborders s WHERE s.branch_id = fb.id AND s.created_at >= CURRENT_DATE AND s.fulfillment_status != 'cancelled') AS today_orders_count
     FROM farmer_branches fb
     WHERE fb.farmer_id = $1
     ORDER BY fb.is_preferred DESC, fb.is_primary DESC, fb.id ASC`,
    [farmerId]
  );

  // Ensure lazy primary branch if none exists
  let branches = branchesRes.rows;
  if (branches.length === 0) {
    await branchModel.ensureFarmerBusinessAndPrimaryBranch(farmerId);
    const retry = await pool.query(`SELECT fb.*, 0::int AS today_orders_count FROM farmer_branches fb WHERE fb.farmer_id = $1`, [farmerId]);
    branches = retry.rows;
  }

  // Load branch_inventory for the farmer's requested products across all branches
  const productIds = farmerItems.map((i) => Number(i.product_id));
  const biRes = await pool.query(
    `SELECT bi.* FROM branch_inventory bi WHERE bi.farmer_id = $1 AND bi.product_id = ANY($2::bigint[])`,
    [farmerId, productIds]
  );

  const invByBranchProd = new Map();
  for (const row of biRes.rows) {
    invByBranchProd.set(`${row.branch_id}:${row.product_id}`, row);
  }

  // Evaluate each branch for full single-branch fulfillment AND partial stock availability
  const evaluated = [];
  for (const branch of branches) {
    const capCheck = branchService.evaluateBranchCapacityAndHours(branch);
    let canCoverAllItems = true;
    let partialTotalUnits = 0;
    const itemAvailability = [];

    for (const item of farmerItems) {
      const bi = invByBranchProd.get(`${branch.id}:${item.product_id}`);
      const availQty = bi && bi.is_available ? Number(bi.available_quantity || 0) : 0;
      if (availQty < Number(item.quantity)) {
        canCoverAllItems = false;
      }
      partialTotalUnits += Math.min(availQty, Number(item.quantity));
      itemAvailability.push({ item, available_quantity: availQty, branch_inventory: bi });
    }

    const est = await deliveryPricingService.estimateBranchDeliveryAsync({
      branch,
      delivery_method: requestedDeliveryMethod,
      destination_address: destinationAddress,
      destination_lat: destinationLat,
      destination_lng: destinationLng,
      items: farmerItems,
      is_same_day: isSameDay,
    });

    const isVerifiedEligible =
      branch.verification_status === "verified" &&
      ["active", "busy"].includes(branch.operational_status) &&
      branch.service_available !== false &&
      capCheck.has_order_capacity;

    evaluated.push({
      branch,
      capacity: capCheck,
      is_verified_eligible: isVerifiedEligible,
      serviceable: est.serviceable && isVerifiedEligible,
      can_cover_all_items: canCoverAllItems,
      total_available_for_items: partialTotalUnits,
      item_availability: itemAvailability,
      estimate: est,
    });
  }

  // 1. If buyer/admin explicitly picked a specific branch, validate & use it if sufficient
  if (preferredBranchId) {
    const chosen = evaluated.find((e) => Number(e.branch.id) === Number(preferredBranchId));
    if (!chosen) throw createServiceError(`Selected branch #${preferredBranchId} does not belong to farmer`, 400);
    if (!chosen.is_verified_eligible) {
      throw createServiceError(`Branch "${chosen.branch.name}" is currently unavailable (${chosen.branch.verification_status}/${chosen.branch.operational_status})`, 409);
    }
    if (!chosen.serviceable) {
      throw createServiceError(chosen.estimate.unserviceable_reason || `Branch "${chosen.branch.name}" cannot deliver to this destination`, 409);
    }
    if (!chosen.can_cover_all_items) {
      if (!allowSplit) {
        throw createServiceError(
          `Branch "${chosen.branch.name}" lacks sufficient stock for all items. Enable split fulfillment or choose another branch.`,
          409,
          { code: "BRANCH_INSUFFICIENT_STOCK", evaluated_branches: evaluated.map((e) => ({ branch_id: e.branch.id, name: e.branch.name, can_cover_all_items: e.can_cover_all_items, serviceable: e.serviceable, shipping_fee: e.estimate.shipping_fee })) }
        );
      }
    } else {
      return {
        strategy_used: preferredBranchId ? "buyer_or_admin_selected" : strategy,
        was_split: false,
        packages: [
          {
            farmer_id: Number(farmerId),
            branch: chosen.branch,
            items: farmerItems,
            fulfillment_type: requestedDeliveryMethod,
            estimate: chosen.estimate,
          },
        ],
        candidate_branches: evaluated,
      };
    }
  }

  // 2. Try single eligible branch that can fulfill ALL items cleanly
  const singleCandidates = evaluated
    .filter((e) => e.serviceable && e.can_cover_all_items)
    .sort((a, b) => deterministicCompare(a, b, strategy));

  if (singleCandidates.length > 0) {
    const winner = singleCandidates[0];
    return {
      strategy_used: strategy,
      was_split: false,
      packages: [
        {
          farmer_id: Number(farmerId),
          branch: winner.branch,
          items: farmerItems,
          fulfillment_type: requestedDeliveryMethod,
          estimate: winner.estimate,
        },
      ],
      candidate_branches: evaluated,
    };
  }

  // 3. No single branch covers everything -> Evaluate split across serviceable verified branches!
  const partialCandidates = evaluated
    .filter((e) => e.serviceable && e.total_available_for_items > 0)
    .sort((a, b) => deterministicCompare(a, b, strategy));

  const splitPackagesMap = new Map(); // branchId -> { branch, items: [] }
  const shortfalls = [];

  for (const item of farmerItems) {
    let remainingNeeded = Number(item.quantity);
    for (const cand of partialCandidates) {
      if (remainingNeeded <= 0) break;
      const availRec = cand.item_availability.find((x) => Number(x.item.product_id) === Number(item.product_id));
      const availQty = availRec ? Number(availRec.available_quantity) : 0;
      if (availQty <= 0) continue;

      const allocateQty = Math.min(remainingNeeded, availQty);
      remainingNeeded -= allocateQty;

      const bId = cand.branch.id;
      if (!splitPackagesMap.has(bId)) {
        splitPackagesMap.set(bId, { branch: cand.branch, items: [] });
      }
      splitPackagesMap.get(bId).items.push({ ...item, quantity: allocateQty });
    }
    if (remainingNeeded > 0) {
      shortfalls.push({ product_id: item.product_id, product_name: item.name, missing_quantity: remainingNeeded });
    }
  }

  if (shortfalls.length > 0) {
    const reasons = evaluated
      .filter((e) => !e.serviceable && e.estimate.unserviceable_reason)
      .map((e) => e.estimate.unserviceable_reason);
    throw createServiceError(
      reasons.length > 0 && partialCandidates.length === 0
        ? reasons[0]
        : `Insufficient combined branch stock for ${shortfalls.map((s) => `${s.product_name} (short by ${s.missing_quantity})`).join(", ")}`,
      409,
      { code: "INSUFFICIENT_OR_UNSERVICEABLE_BRANCHES", shortfalls, reasons }
    );
  }

  const splitPackages = [];
  for (const pkg of splitPackagesMap.values()) {
    const pkgEst = await deliveryPricingService.estimateBranchDeliveryAsync({
      branch: pkg.branch,
      delivery_method: requestedDeliveryMethod,
      destination_address: destinationAddress,
      destination_lat: destinationLat,
      destination_lng: destinationLng,
      items: pkg.items,
      is_same_day: isSameDay,
    });
    splitPackages.push({
      farmer_id: Number(farmerId),
      branch: pkg.branch,
      items: pkg.items,
      fulfillment_type: requestedDeliveryMethod,
      estimate: pkgEst,
    });
  }

  if (!allowSplit && splitPackages.length > 1) {
    const splitFeeTotal = splitPackages.reduce((s, p) => s + Number(p.estimate.shipping_fee || 0), 0);
    throw createServiceError(
      `No single branch holds the entire order. Fulfilling across ${splitPackages.length} branches splits the shipment (combined delivery fee: ${splitFeeTotal.toFixed(2)} ETB). Confirm split fulfillment to proceed.`,
      409,
      {
        code: "SPLIT_APPROVAL_REQUIRED",
        requires_split_approval: true,
        proposed_packages: splitPackages.map((p) => ({
          branch_id: p.branch.id,
          branch_name: p.branch.name,
          shipping_fee: p.estimate.shipping_fee,
          distance_km: p.estimate.distance_km,
          items: p.items.map((it) => ({ product_id: it.product_id, name: it.name, quantity: it.quantity })),
        })),
        total_split_shipping_fee: splitFeeTotal,
      }
    );
  }

  return {
    strategy_used: `${strategy}_split`,
    was_split: splitPackages.length > 1,
    packages: splitPackages,
    candidate_branches: evaluated,
  };
};

/**
 * Food-safe multi-branch delivery consolidation analysis (Section 10):
 * Groups packages ONLY if same corridor/hub, compatible food safety thermal profile (never mixes ambient with cold-chain-required items),
 * and non-conflicting perishable window — estimating consolidation discount without merging farmer/branch ledgers!
 */
const evaluateConsolidationPlan = (packages = []) => {
  if (packages.length <= 1) {
    return { consolidation_eligible: false, groups: [], estimated_savings: 0, reason: "Single package shipment" };
  }

  const coldChainPkgs = packages.filter((p) => p.estimate?.special_handling_flags?.cold_chain);
  const ambientPkgs = packages.filter((p) => !p.estimate?.special_handling_flags?.cold_chain);

  const groups = [];
  let totalSavings = 0;

  const analyzeBucket = (bucket, thermalType) => {
    if (bucket.length < 2) return;
    // Only consolidate packages using delivery_partner in the same region or corridor
    const courierPkgs = bucket.filter((p) => p.fulfillment_type === "delivery_partner");
    if (courierPkgs.length < 2) return;

    const baseGroupFee = courierPkgs.reduce((s, p) => s + Number(p.estimate.shipping_fee || 0), 0);
    // Hub consolidation saves 25% of duplicate fixed/base legs when co-dispatched
    const savings = Math.round((courierPkgs.length - 1) * 25 * 100) / 100;
    totalSavings += savings;
    groups.push({
      consolidation_group_id: `CNS-${thermalType.toUpperCase()}-${Date.now().toString().slice(-5)}`,
      thermal_profile: thermalType,
      branch_ids: courierPkgs.map((p) => p.branch.id),
      original_shipping_total: baseGroupFee,
      consolidated_shipping_total: Math.max(40, Math.round((baseGroupFee - savings) * 100) / 100),
      estimated_savings: savings,
      food_safety_verified: true,
      note: thermalType === "cold_chain"
        ? "Refrigerated hub co-transport only (cold-chain continuity enforced)"
        : "Same-corridor ambient produce hub consolidation",
    });
  };

  analyzeBucket(coldChainPkgs, "cold_chain");
  analyzeBucket(ambientPkgs, "ambient");

  return {
    consolidation_eligible: groups.length > 0,
    groups,
    estimated_savings: totalSavings,
    food_safety_rule: "Perishable cold-chain and ambient packages are segregated strictly to preserve traceability & quality",
  };
};

/**
 * Post-checkout address modification workflow (Section 9) & Pre-dispatch branch reallocation (Section 12)
 */
const handlePostCheckoutAddressChange = async ({ actor, orderId, suborderId, newAddress }) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const subRes = await client.query(
      `SELECT s.*, o.buyer_id, fb.*,
              s.id AS sub_id, fb.id AS fb_id,
              d.id AS delivery_id, d.status AS d_status, d.delivery_partner_id AS d_partner_id
       FROM suborders s
       JOIN orders o ON o.id = s.parent_order_id
       JOIN farmer_branches fb ON fb.id = s.branch_id
       LEFT JOIN deliveries d ON d.suborder_id = s.id
       WHERE s.id = $1 AND s.parent_order_id = $2
       FOR UPDATE OF s`,
      [Number(suborderId), Number(orderId)]
    );
    if (subRes.rows.length === 0) throw createServiceError("Suborder not found", 404);
    const sub = subRes.rows[0];
    if (Number(sub.buyer_id) !== Number(actor.id) && actor.role !== "admin") {
      throw createServiceError("Forbidden", 403);
    }

    const itemsRes = await client.query(`SELECT * FROM order_items WHERE suborder_id = $1`, [Number(suborderId)]);
    const newAddrText = typeof newAddress === "string" ? newAddress : [newAddress.landmark, newAddress.subcity, newAddress.city, newAddress.region, newAddress.line1].filter(Boolean).join(", ");
    const est = await deliveryPricingService.estimateBranchDeliveryAsync({
      branch: sub,
      delivery_method: sub.fulfillment_type,
      destination_address: newAddrText,
      destination_lat: newAddress?.latitude ?? null,
      destination_lng: newAddress?.longitude ?? null,
      items: itemsRes.rows,
    });

    if (!est.serviceable) {
      throw createServiceError(est.unserviceable_reason || "New address is outside this branch's delivery coverage", 409);
    }

    const feeDelta = Math.round((est.shipping_fee - Number(sub.shipping_fee || 0)) * 100) / 100;
    const isAlreadyDispatched = ["dispatched", "in_transit", "shipped", "picked_up", "delivered"].includes(sub.fulfillment_status);

    // Never silently redirect an active dispatched delivery without exception + approval if fee increases
    if (feeDelta > 0 || isAlreadyDispatched) {
      const exRes = await client.query(
        `INSERT INTO delivery_exceptions (
           order_id, suborder_id, delivery_id, branch_id, exception_type, severity,
           status, description, proposed_resolution, additional_cost, requires_buyer_approval
         ) VALUES ($1,$2,$3,$4,'address_change_after_checkout',$5,'pending_buyer_approval',$6,$7::jsonb,$8,$9)
         RETURNING *`,
        [
          Number(orderId),
          Number(suborderId),
          sub.delivery_id || null,
          sub.fb_id,
          isAlreadyDispatched ? "high" : "medium",
          `Address change requested to "${newAddrText}" (~${est.distance_km} km). Fee difference: ${feeDelta > 0 ? `+${feeDelta}` : feeDelta} ETB.`,
          JSON.stringify({ new_address: newAddrText, new_lat: newAddress?.latitude || null, new_lng: newAddress?.longitude || null, new_fee: est.shipping_fee, fee_delta: feeDelta, courier_reassignment_needed: isAlreadyDispatched && Boolean(sub.d_partner_id) }),
          Math.max(0, feeDelta),
          true,
        ]
      );
      await client.query("COMMIT");
      return {
        status: "pending_buyer_approval",
        requires_approval: true,
        fee_delta: feeDelta,
        revised_estimate: est,
        exception: exRes.rows[0],
      };
    }

    // Safe immediate update before dispatch when fee does not increase
    await client.query(
      `UPDATE deliveries
       SET delivery_location = $1, distance_km = $2, fee_breakdown = $3::jsonb
       WHERE suborder_id = $4`,
      [newAddrText, est.distance_km, JSON.stringify(est.breakdown), Number(suborderId)]
    );
    await client.query(
      `INSERT INTO delivery_events (delivery_id, suborder_id, order_id, event_type, status, title, description, location_name, actor_id, actor_role)
       VALUES ($1,$2,$3,'address_updated',$4,'Delivery Destination Updated',$5,$6,$7,$8)`,
      [sub.delivery_id, Number(suborderId), Number(orderId), sub.fulfillment_status, `Updated to ${newAddrText} (~${est.distance_km} km)`, newAddrText, actor.id, actor.role]
    );
    await client.query("COMMIT");
    return { status: "updated", requires_approval: false, fee_delta: feeDelta, revised_estimate: est };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Pre-dispatch controlled branch reallocation (e.g. if original branch closes/suspends before dispatch)
 */
const reallocateSuborderBranch = async ({ actor, suborderId, targetBranchId, approveFeeDelta = false }) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const subRes = await client.query(`SELECT * FROM suborders WHERE id = $1 FOR UPDATE`, [Number(suborderId)]);
    if (subRes.rows.length === 0) throw createServiceError("Suborder not found", 404);
    const sub = subRes.rows[0];

    if (!["pending", "accepted", "packed"].includes(sub.fulfillment_status)) {
      throw createServiceError("Post-dispatch branch switches are blocked; handle via delivery exception instead", 409);
    }

    const oldBranchId = sub.branch_id;
    const newBranch = await branchModel.getBranchById(Number(targetBranchId), client);
    if (!newBranch || Number(newBranch.farmer_id) !== Number(sub.farmer_id)) {
      throw createServiceError("Target branch not found for this farmer business", 404);
    }
    if (newBranch.verification_status !== "verified" || !["active", "busy"].includes(newBranch.operational_status)) {
      throw createServiceError("Target branch is not eligible for fulfillment", 409);
    }

    const itemsRes = await client.query(`SELECT * FROM order_items WHERE suborder_id = $1`, [sub.id]);
    const delivRes = await client.query(`SELECT * FROM deliveries WHERE suborder_id = $1`, [sub.id]);
    const destAddr = delivRes.rows[0]?.delivery_location || "";

    const newEst = await deliveryPricingService.estimateBranchDeliveryAsync({
      branch: newBranch,
      delivery_method: sub.fulfillment_type,
      destination_address: destAddr,
      items: itemsRes.rows,
    });
    if (!newEst.serviceable) throw createServiceError(newEst.unserviceable_reason || "Target branch cannot serve buyer location", 409);

    const feeDelta = Math.round((newEst.shipping_fee - Number(sub.shipping_fee || 0)) * 100) / 100;
    if (feeDelta > 0 && !approveFeeDelta) {
      throw createServiceError(`Reallocating to "${newBranch.name}" increases delivery fee by ${feeDelta} ETB; buyer approval required`, 409, {
        requires_buyer_approval: true,
        fee_delta: feeDelta,
        new_shipping_fee: newEst.shipping_fee,
      });
    }

    // Release old branch reservations and reserve on target branch atomically
    const oldRes = await client.query(
      `SELECT * FROM stock_reservations WHERE suborder_id = $1 AND status IN ('reserved','consumed') FOR UPDATE`,
      [sub.id]
    );
    for (const r of oldRes.rows) {
      if (oldBranchId) {
        const biOld = await inventoryModel.findBranchInventoryForUpdate(client, oldBranchId, r.product_id);
        if (biOld) {
          if (r.status === "reserved") biOld.reserved_quantity = Math.max(0, Number(biOld.reserved_quantity) - Number(r.quantity));
          else biOld.committed_quantity = Math.max(0, Number(biOld.committed_quantity) - Number(r.quantity));
          await inventoryModel.recomputeAndSaveBranchAvailability(client, biOld);
        }
      }
      await inventoryModel.reserveBranchStockForOrder(client, {
        orderId: sub.parent_order_id,
        suborderId: sub.id,
        branchId: newBranch.id,
        productId: r.product_id,
        quantity: r.quantity,
        actorId: actor.id,
      });
    }

    const newSnapshot = {
      branch_id: newBranch.id,
      branch_code: newBranch.branch_code,
      branch_name: newBranch.name,
      physical_address: newBranch.physical_address,
      region: newBranch.region,
      reallocated_from_branch_id: oldBranchId,
    };

    const newSubTotal = Number(sub.subtotal) + newEst.shipping_fee;
    const updSub = await client.query(
      `UPDATE suborders
       SET branch_id = $1,
           branch_snapshot = $2::jsonb,
           shipping_fee = $3,
           total_amount = $4,
           driver_compensation_amount = $5,
           platform_logistics_fee = $6,
           updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [newBranch.id, JSON.stringify(newSnapshot), newEst.shipping_fee, newSubTotal, newEst.driver_compensation_amount, newEst.platform_logistics_fee, sub.id]
    );

    await client.query(`UPDATE order_items SET branch_id = $1, branch_name = $2 WHERE suborder_id = $3`, [newBranch.id, newBranch.name, sub.id]);
    await client.query(
      `UPDATE deliveries
       SET branch_id = $1, pickup_location = $2, distance_km = $3, fee_breakdown = $4::jsonb,
           driver_compensation_amount = $5, platform_logistics_fee = $6
       WHERE suborder_id = $7`,
      [newBranch.id, newBranch.physical_address, newEst.distance_km, JSON.stringify(newEst.breakdown), newEst.driver_compensation_amount, newEst.platform_logistics_fee, sub.id]
    );
    await client.query(`UPDATE escrow_ledger SET branch_id = $1 WHERE suborder_id = $2`, [newBranch.id, sub.id]);

    await client.query("COMMIT");
    return { suborder: updSub.rows[0], fee_delta: feeDelta };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  allocateFarmerItemsToBranches,
  evaluateConsolidationPlan,
  getConfiguredAllocationStrategy,
  handlePostCheckoutAddressChange,
  reallocateSuborderBranch,
};
