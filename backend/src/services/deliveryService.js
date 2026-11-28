const { pool } = require("../config/db");
const logger = require("../utils/logger");
const deliveryModel = require("../models/deliveryModel");
const notificationModel = require("../models/notificationModel");
const orderModel = require("../models/orderModel");
const deliveryPricingService = require("./deliveryPricingService");
const { normalizeRole } = require("../utils/roles");
const { isPositiveInteger } = require("../utils/validators");

const allowedDeliveryStatuses = [
  "pending",
  "assigned",
  "ready_for_pickup",
  "picked_up",
  "processing",
  "shipped",
  "out for delivery",
  "in_transit",
  "delivered",
  "cancelled",
];

const createServiceError = (message, statusCode, extra = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  Object.assign(error, extra);
  return error;
};

// ==========================================
// Delivery Pricing Estimator (Checkout)
// ==========================================

const estimateCheckoutDelivery = async ({
  buyer_id,
  delivery_address = "",
  destination_lat = null,
  destination_lng = null,
  fulfillment_selections = {},
  branch_selections = {},
  allocation_strategy = null,
  allow_split = false,
  enable_consolidation = false,
  is_same_day = false,
  create_quotes = false,
}) => {
  const branchAllocationService = require("./branchAllocationService");
  const cartResult = await pool.query(
    `
      SELECT
        ci.product_id,
        ci.quantity,
        p.name,
        p.farmer_id,
        p.unit,
        p.cold_chain_required,
        p.farm_location,
        COALESCE(p.pickup_available, TRUE) AS pickup_available,
        COALESCE(p.farmer_delivery_available, FALSE) AS farmer_delivery_available,
        COALESCE(p.delivery_radius_km, 0) AS delivery_radius_km,
        u.name AS farmer_name,
        u.address AS farmer_address
      FROM carts c
      JOIN cart_items ci ON ci.cart_id = c.cart_id
      JOIN products p ON p.id = ci.product_id
      JOIN users u ON u.id = p.farmer_id
      WHERE c.user_id = $1
    `,
    [buyer_id]
  );

  const buyerRes = await pool.query(`SELECT address FROM users WHERE id = $1 LIMIT 1`, [buyer_id]);
  const destination =
    String(delivery_address || "").trim() || (buyerRes.rows[0] && buyerRes.rows[0].address) || "";

  const zoneInfo = await deliveryPricingService.resolveDestinationZone({
    addressText: destination,
    latitude: destination_lat,
    longitude: destination_lng,
  });

  const itemsByFarmer = new Map();
  for (const row of cartResult.rows) {
    const fId = String(row.farmer_id);
    if (!itemsByFarmer.has(fId)) itemsByFarmer.set(fId, []);
    itemsByFarmer.get(fId).push(row);
  }

  const estimatesByFarmer = {};
  const allocatedPackages = [];
  const generatedQuotes = {};
  let totalShippingFee = 0;

  for (const [fId, items] of itemsByFarmer.entries()) {
    const chosenMode = fulfillment_selections[fId] || "farmer_pickup";
    const preferredBranchId = branch_selections[fId] || null;
    let splitRequiredInfo = null;
    let allocationResult = null;

    try {
      allocationResult = await branchAllocationService.allocateFarmerItemsToBranches({
        farmerId: Number(fId),
        farmerItems: items,
        requestedDeliveryMethod: chosenMode,
        destinationAddress: destination,
        destinationLat: destination_lat,
        destinationLng: destination_lng,
        strategyOverride: allocation_strategy,
        preferredBranchId,
        allowSplit: Boolean(allow_split),
        isSameDay: Boolean(is_same_day),
      });
    } catch (allocErr) {
      if (allocErr.requires_split_approval) {
        splitRequiredInfo = allocErr.proposed_packages;
        allocationResult = await branchAllocationService.allocateFarmerItemsToBranches({
          farmerId: Number(fId),
          farmerItems: items,
          requestedDeliveryMethod: chosenMode,
          destinationAddress: destination,
          destinationLat: destination_lat,
          destinationLng: destination_lng,
          strategyOverride: allocation_strategy,
          preferredBranchId,
          allowSplit: true,
          isSameDay: Boolean(is_same_day),
        });
      } else {
        estimatesByFarmer[fId] = {
          farmer_id: Number(fId),
          farmer_name: items[0]?.farmer_name || "Producer",
          serviceable: false,
          error: allocErr.message,
          selected_mode: chosenMode,
          selected_fee: 0,
        };
        continue;
      }
    }

    const primaryPkg = allocationResult.packages[0];
    const selectedBranch = primaryPkg.branch;

    // Also compute 3-mode comparison on primary selected branch so buyer can toggle freely
    const [pickupEst, directEst, courierEst] = await Promise.all([
      deliveryPricingService.estimateBranchDeliveryAsync({ branch: selectedBranch, delivery_method: "farmer_pickup", destination_address: destination, destination_lat, destination_lng, items, is_same_day }),
      deliveryPricingService.estimateBranchDeliveryAsync({ branch: selectedBranch, delivery_method: "farmer_delivery", destination_address: destination, destination_lat, destination_lng, items, is_same_day }),
      deliveryPricingService.estimateBranchDeliveryAsync({ branch: selectedBranch, delivery_method: "delivery_partner", destination_address: destination, destination_lat, destination_lng, items, is_same_day }),
    ]);

    const pkgShippingSum = allocationResult.packages.reduce((s, p) => s + Number(p.estimate.shipping_fee || 0), 0);
    totalShippingFee += pkgShippingSum;

    for (const pkg of allocationResult.packages) {
      allocatedPackages.push(pkg);
      if (create_quotes) {
        const { quote } = await deliveryPricingService.generateAndSaveDeliveryQuote({
          buyer_id,
          branch: pkg.branch,
          delivery_method: pkg.fulfillment_type,
          destination_address: destination,
          destination_lat,
          destination_lng,
          items: pkg.items,
          is_same_day,
        });
        generatedQuotes[`${fId}:${pkg.branch.id}`] = quote;
      }
    }

    estimatesByFarmer[fId] = {
      farmer_id: Number(fId),
      farmer_name: items[0]?.farmer_name || "Producer",
      selected_branch: {
        id: selectedBranch.id,
        branch_code: selectedBranch.branch_code,
        name: selectedBranch.name,
        branch_type: selectedBranch.branch_type,
        physical_address: selectedBranch.physical_address,
        region: selectedBranch.region,
      },
      candidate_branches: (allocationResult.candidate_branches || []).map((c) => ({
        branch_id: c.branch.id,
        name: c.branch.name,
        region: c.branch.region,
        physical_address: c.branch.physical_address,
        serviceable: c.serviceable,
        can_cover_all_items: c.can_cover_all_items,
        total_available_for_items: c.total_available_for_items,
        distance_km: c.estimate.distance_km,
        shipping_fee: c.estimate.shipping_fee,
        unserviceable_reason: c.estimate.unserviceable_reason,
      })),
      was_split: allocationResult.was_split,
      requires_split_approval: Boolean(splitRequiredInfo),
      split_packages: allocationResult.packages.map((p) => ({
        branch_id: p.branch.id,
        branch_name: p.branch.name,
        physical_address: p.branch.physical_address,
        shipping_fee: p.estimate.shipping_fee,
        distance_km: p.estimate.distance_km,
        total_weight_kg: p.estimate.total_weight_kg,
        items: p.items.map((it) => ({ product_id: it.product_id, name: it.name, quantity: it.quantity })),
      })),
      origin_address: selectedBranch.physical_address,
      total_weight_kg: primaryPkg.estimate.total_weight_kg,
      distance_km: primaryPkg.estimate.distance_km,
      distance_source: primaryPkg.estimate.distance_source,
      is_estimated_fallback: primaryPkg.estimate.is_estimated_fallback,
      route_disclaimer: primaryPkg.estimate.route_disclaimer,
      modes: {
        farmer_pickup: pickupEst,
        farmer_delivery: directEst,
        delivery_partner: courierEst,
      },
      selected_mode: chosenMode,
      selected_fee: pkgShippingSum,
      serviceable: true,
    };
  }

  const consolidationPlan = branchAllocationService.evaluateConsolidationPlan(allocatedPackages);
  const netShippingFee =
    enable_consolidation && consolidationPlan.consolidation_eligible
      ? Math.max(0, Math.round((totalShippingFee - consolidationPlan.estimated_savings) * 100) / 100)
      : totalShippingFee;

  return {
    destination_address: destination,
    detected_zone: zoneInfo,
    total_shipping_fee: netShippingFee,
    original_shipping_fee: totalShippingFee,
    consolidation: consolidationPlan,
    quotes: generatedQuotes,
    packages: estimatesByFarmer,
  };
};

// ==========================================
// Delivery Partner Verification & Profile
// ==========================================

const getMyPartnerProfile = async (actor) => {
  return deliveryModel.getOrCreatePartnerProfile(pool, Number(actor.id));
};

const submitMyPartnerProfile = async ({ actor, payload }) => {
  const actorRole = normalizeRole(actor.role);
  if (actorRole !== "delivery_partner" && actorRole !== "admin") {
    throw createServiceError("Only delivery partners can submit courier verification", 403);
  }

  const vehicle_plate = String(payload.vehicle_plate || "").trim();
  const license_number = String(payload.license_number || "").trim();
  const national_id_number = String(payload.national_id_number || "").trim();
  const vehicle_type = String(payload.vehicle_type || "").trim();
  const operating_region = String(payload.operating_region || "").trim();

  if (!vehicle_plate || !license_number || !national_id_number || !vehicle_type) {
    throw createServiceError(
      "Vehicle type, license plate, driver's license number, and National ID are required for courier vetting",
      400
    );
  }

  return deliveryModel.upsertPartnerProfile(Number(actor.id), {
    vehicle_type,
    vehicle_plate,
    vehicle_capacity_kg: payload.vehicle_capacity_kg,
    license_number,
    national_id_number,
    operating_region: operating_region || "Addis Ababa & Surrounding",
    id_document_url: payload.id_document_url || null,
    license_document_url: payload.license_document_url || null,
  });
};

// ==========================================
// Mode A: Farmer Pickup Workflows
// ==========================================

const markSuborderReadyForPickup = async ({ actor, suborder_id, pickup_location, farmer_notes }) => {
  const parsedSuborderId = Number(suborder_id);
  if (!isPositiveInteger(parsedSuborderId)) {
    throw createServiceError("Valid suborder_id is required", 400);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const suborder = await deliveryModel.findSuborderById(client, parsedSuborderId);
    if (!suborder) {
      throw createServiceError("Suborder not found", 404);
    }

    const actorRole = normalizeRole(actor.role);
    if (actorRole !== "admin" && Number(actor.id) !== Number(suborder.farmer_id)) {
      throw createServiceError("You can only update your own suborders", 403);
    }

    const pickupCode = suborder.pickup_code || `GH-${Math.floor(100000 + Math.random() * 900000)}`;

    await client.query(
      `UPDATE suborders
       SET fulfillment_status = 'ready_for_pickup',
           pickup_code = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [pickupCode, parsedSuborderId]
    );

    const pickupSite = pickup_location || suborder.farmer_address || "Farm Gate";
    const delivery = await deliveryModel.upsertSuborderDelivery(client, {
      order_id: suborder.parent_order_id,
      suborder_id: parsedSuborderId,
      fulfillment_type: "farmer_pickup",
      status: "ready_for_pickup",
      pickup_verification_code: pickupCode,
      pickup_location: pickupSite,
      farmer_notes: farmer_notes || "Package ready for buyer collection.",
      current_checkpoint: `${pickupSite} · Ready for Buyer Pickup`,
    });

        await deliveryModel.recordDeliveryEvent(client, {
      delivery_id: delivery.id,
      suborder_id: parsedSuborderId,
      order_id: suborder.parent_order_id,
      event_type: "ready_for_pickup",
      status: "ready_for_pickup",
      title: "Ready for Farm Gate Pickup",
      description: `Farmer packed items at ${pickupSite}. Pickup code generated.`,
      location_name: pickupSite,
      actor_id: actor.id,
      actor_role: actorRole,
    });

    await client.query("COMMIT");

    try {
      await notificationModel.createNotificationForUser({
        user_id: suborder.buyer_id,
        title: "Order ready for pickup",
        message: `Your package from ${suborder.farmer_name} is ready for pickup. Your pickup verification code is ${pickupCode}.`,
        type: "order",
      });
    } catch (notifErr) {
      logger.warn("Notification error", { error: notifErr.message });
    }

    return {
      suborder_id: parsedSuborderId,
      suborder_number: suborder.suborder_number,
      fulfillment_status: "ready_for_pickup",
      pickup_code: pickupCode,
      delivery,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const confirmSuborderPickup = async ({ actor, suborder_id, pickup_code }) => {
  const parsedSuborderId = Number(suborder_id);
  if (!isPositiveInteger(parsedSuborderId)) {
    throw createServiceError("Valid suborder_id is required", 400);
  }

  if (!pickup_code || !String(pickup_code).trim()) {
    throw createServiceError("Pickup verification code is required", 400);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const suborder = await deliveryModel.findSuborderById(client, parsedSuborderId);
    if (!suborder) {
      throw createServiceError("Suborder not found", 404);
    }

    const actorRole = normalizeRole(actor.role);
    if (actorRole !== "admin" && Number(actor.id) !== Number(suborder.farmer_id)) {
      throw createServiceError("Only the fulfilling farmer can confirm buyer pickup", 403);
    }

    const normalizedInput = String(pickup_code).trim().toUpperCase();
    const normalizedExpected = String(suborder.pickup_code || "").trim().toUpperCase();

    if (normalizedInput !== normalizedExpected) {
      throw createServiceError("Invalid pickup verification code", 400);
    }

    await client.query(
      `UPDATE suborders SET fulfillment_status = 'delivered', updated_at = NOW() WHERE id = $1`,
      [parsedSuborderId]
    );

    const updatedDel = await client.query(
      `UPDATE deliveries
       SET status = 'delivered',
           delivery_status = 'delivered',
           delivered_at = NOW(),
           buyer_confirmed_at = NOW(),
           current_checkpoint = 'Collected by Buyer at Farm Gate'
       WHERE suborder_id = $1
       RETURNING id, pickup_location`,
      [parsedSuborderId]
    );

    const releasedEscrow = await deliveryModel.releaseEscrowForSuborder(client, parsedSuborderId);
    await deliveryModel.checkAndCompleteParentOrder(client, suborder.parent_order_id);

        await deliveryModel.recordDeliveryEvent(client, {
      delivery_id: updatedDel.rows[0]?.id || null,
      suborder_id: parsedSuborderId,
      order_id: suborder.parent_order_id,
      event_type: "pickup_confirmed",
      status: "delivered",
      title: "Farm Gate Pickup Verified & Escrow Released",
      description: `Buyer pickup code ${normalizedExpected} verified at handover.`,
      location_name: updatedDel.rows[0]?.pickup_location || "Farm Gate",
      actor_id: actor.id,
      actor_role: actorRole,
    });

    await client.query("COMMIT");

    return {
      suborder_id: parsedSuborderId,
      fulfillment_status: "delivered",
      escrow_released: releasedEscrow.length > 0,
      message: "Pickup confirmed and escrow released to farmer",
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

// ==========================================
// Mode B: Farmer Self-Delivery Workflows
// ==========================================

const dispatchFarmerDelivery = async ({ actor, suborder_id, estimated_time, vehicle_info, farmer_notes }) => {
  const parsedSuborderId = Number(suborder_id);
  if (!isPositiveInteger(parsedSuborderId)) {
    throw createServiceError("Valid suborder_id is required", 400);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const suborder = await deliveryModel.findSuborderById(client, parsedSuborderId);
    if (!suborder) {
      throw createServiceError("Suborder not found", 404);
    }

    const actorRole = normalizeRole(actor.role);
    if (actorRole !== "admin" && Number(actor.id) !== Number(suborder.farmer_id)) {
      throw createServiceError("Only the seller farmer can dispatch self-delivery", 403);
    }

    const existingDel = await deliveryModel.findDeliveryBySuborderId(client, parsedSuborderId);
    const deliveryCode =
      (existingDel && existingDel.delivery_confirmation_code) ||
      `DEL-${Math.floor(100000 + Math.random() * 900000)}`;

    await client.query(
      `UPDATE suborders SET fulfillment_status = 'in_transit', updated_at = NOW() WHERE id = $1`,
      [parsedSuborderId]
    );

    const dispatchNotes = [vehicle_info, farmer_notes].filter(Boolean).join(" | ");
    const origin = suborder.farmer_address || "Farm Gate";
    const delivery = await deliveryModel.upsertSuborderDelivery(client, {
      order_id: suborder.parent_order_id,
      suborder_id: parsedSuborderId,
      fulfillment_type: "farmer_delivery",
      status: "in_transit",
      delivery_confirmation_code: deliveryCode,
      pickup_location: origin,
      delivery_location: existingDel?.delivery_location || suborder.buyer_address || "Buyer Delivery Address",
      estimated_time: estimated_time || "Within 24 hours",
      farmer_notes: dispatchNotes,
      current_checkpoint: `Dispatched from ${origin}${vehicle_info ? ` (${vehicle_info})` : ""}`,
    });

    await client.query(`UPDATE deliveries SET dispatched_at = NOW() WHERE id = $1`, [delivery.id]);

        await deliveryModel.recordDeliveryEvent(client, {
      delivery_id: delivery.id,
      suborder_id: parsedSuborderId,
      order_id: suborder.parent_order_id,
      event_type: "farmer_dispatched",
      status: "in_transit",
      title: "Farmer Dispatched Direct Delivery",
      description: dispatchNotes || `Estimated arrival: ${estimated_time || "Within 24 hours"}`,
      location_name: origin,
      actor_id: actor.id,
      actor_role: actorRole,
    });

    await client.query("COMMIT");

    return {
      suborder_id: parsedSuborderId,
      fulfillment_status: "in_transit",
      delivery_confirmation_code: deliveryCode,
      estimated_time: estimated_time || "Within 24 hours",
      delivery,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const confirmFarmerDelivery = async ({ actor, suborder_id, confirmation_code }) => {
  const parsedSuborderId = Number(suborder_id);
  if (!isPositiveInteger(parsedSuborderId)) {
    throw createServiceError("Valid suborder_id is required", 400);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const suborder = await deliveryModel.findSuborderById(client, parsedSuborderId);
    if (!suborder) {
      throw createServiceError("Suborder not found", 404);
    }

    const actorRole = normalizeRole(actor.role);
    const isBuyer = Number(actor.id) === Number(suborder.buyer_id);
    const isFarmer = Number(actor.id) === Number(suborder.farmer_id);
    const isAdmin = actorRole === "admin";

    if (!isBuyer && !isFarmer && !isAdmin) {
      throw createServiceError("Unauthorized to confirm delivery", 403);
    }

    // Farmer confirming manually MUST present buyer's secret DEL-XXXXXX confirmation PIN
    if (isFarmer && !isAdmin) {
      if (!confirmation_code) {
        throw createServiceError("Buyer 6-digit confirmation code is required", 400);
      }
      const existingDel = await deliveryModel.findDeliveryBySuborderId(client, parsedSuborderId);
      const expectedCode = existingDel && existingDel.delivery_confirmation_code;
      if (String(confirmation_code).trim().toUpperCase() !== String(expectedCode || "").trim().toUpperCase()) {
        throw createServiceError("Invalid buyer delivery confirmation code", 400);
      }
    }

    await client.query(
      `UPDATE suborders SET fulfillment_status = 'delivered', updated_at = NOW() WHERE id = $1`,
      [parsedSuborderId]
    );

    const updatedDel = await client.query(
      `UPDATE deliveries
       SET status = 'delivered',
           delivery_status = 'delivered',
           delivered_at = NOW(),
           buyer_confirmed_at = NOW(),
           current_checkpoint = 'Delivered & Confirmed by Recipient'
       WHERE suborder_id = $1
       RETURNING id, delivery_location`,
      [parsedSuborderId]
    );

    const releasedEscrow = await deliveryModel.releaseEscrowForSuborder(client, parsedSuborderId);
    await deliveryModel.checkAndCompleteParentOrder(client, suborder.parent_order_id);

        await deliveryModel.recordDeliveryEvent(client, {
      delivery_id: updatedDel.rows[0]?.id || null,
      suborder_id: parsedSuborderId,
      order_id: suborder.parent_order_id,
      event_type: "delivery_confirmed",
      status: "delivered",
      title: isBuyer ? "Buyer Confirmed Package Received" : "Delivery Verified with Buyer PIN",
      description: "Escrow cleared and released to producer.",
      location_name: updatedDel.rows[0]?.delivery_location || "Buyer Address",
      actor_id: actor.id,
      actor_role: actorRole,
    });

    await client.query("COMMIT");

    return {
      suborder_id: parsedSuborderId,
      fulfillment_status: "delivered",
      escrow_released: releasedEscrow.length > 0,
      message: "Delivery confirmed and escrow released",
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

// ==========================================
// Mode C: Delivery Partner Pool Workflows (Vetted & Pin-Accountable)
// ==========================================

const getDeliveryPool = async () => {
  return deliveryModel.getAvailableDeliveryPool();
};

const claimPoolDelivery = async ({ actor, suborder_id, estimated_time }) => {
  const parsedSuborderId = Number(suborder_id);
  if (!isPositiveInteger(parsedSuborderId)) {
    throw createServiceError("Valid suborder_id is required", 400);
  }

  const actorRole = normalizeRole(actor.role);
  if (actorRole !== "delivery_partner" && actorRole !== "admin") {
    throw createServiceError("Only delivery partners can claim pool deliveries", 403);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Legitimacy Gate: Ensure courier has verified identity & vehicle before claiming harvest cargo
    let partnerProfile = null;
    if (actorRole !== "admin") {
      partnerProfile = await deliveryModel.getOrCreatePartnerProfile(client, Number(actor.id));
      if (partnerProfile.verification_status === "suspended") {
        throw createServiceError(
          "Your courier account is suspended due to accountability violations.",
          403
        );
      }
      if (partnerProfile.verification_status !== "verified") {
        throw createServiceError(
          "Courier verification required before claiming jobs. Please submit your vehicle plate, license, and National ID for Admin verification.",
          403
        );
      }
    }

    const suborder = await deliveryModel.findSuborderById(client, parsedSuborderId);
    if (!suborder) {
      throw createServiceError("Suborder not found", 404);
    }

    if (suborder.delivery_partner_id && Number(suborder.delivery_partner_id) !== Number(actor.id)) {
      throw createServiceError("This delivery has already been claimed by another partner", 409);
    }

    const existingDel = await deliveryModel.findDeliveryBySuborderId(client, parsedSuborderId);
    const pickupCode =
      (existingDel && existingDel.pickup_verification_code) ||
      suborder.pickup_code ||
      `PKP-${Math.floor(100000 + Math.random() * 900000)}`;
    const buyerPin =
      (existingDel && existingDel.delivery_confirmation_code) ||
      `DEL-${Math.floor(100000 + Math.random() * 900000)}`;

    await client.query(
      `UPDATE suborders
       SET delivery_partner_id = $1,
           fulfillment_status = 'accepted',
           pickup_code = COALESCE(pickup_code, $2),
           updated_at = NOW()
       WHERE id = $3`,
      [actor.id, pickupCode, parsedSuborderId]
    );

    const origin = existingDel?.pickup_location || suborder.farmer_address || "Farm Gate";
    const destination = existingDel?.delivery_location || suborder.buyer_address || "Customer Address";

    const delivery = await deliveryModel.upsertSuborderDelivery(client, {
      order_id: suborder.parent_order_id,
      suborder_id: parsedSuborderId,
      delivery_partner_id: actor.id,
      fulfillment_type: "delivery_partner",
      status: "assigned",
      pickup_verification_code: pickupCode,
      delivery_confirmation_code: buyerPin,
      pickup_location: origin,
      delivery_location: destination,
      estimated_time: estimated_time || existingDel?.estimated_time || "4 hours",
      vehicle_plate: partnerProfile?.vehicle_plate || null,
      current_checkpoint: `Assigned to ${partnerProfile?.name || "Verified Courier"} · En route to farm`,
    });

    await client.query(
      `INSERT INTO driver_payout_ledger (
         delivery_id, suborder_id, order_id, driver_id, branch_id,
         buyer_paid_delivery_fee, driver_total_earning, platform_logistics_revenue, status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending')
       ON CONFLICT (suborder_id, driver_id) DO UPDATE SET
         status = 'pending',
         driver_total_earning = EXCLUDED.driver_total_earning,
         platform_logistics_revenue = EXCLUDED.platform_logistics_revenue`,
      [
        delivery.id,
        parsedSuborderId,
        suborder.parent_order_id,
        actor.id,
        suborder.branch_id || null,
        Number(suborder.shipping_fee || 0),
        Number(suborder.driver_compensation_amount || existingDel?.driver_compensation_amount || 0),
        Number(suborder.platform_logistics_fee || existingDel?.platform_logistics_fee || 0),
      ]
    );

    await deliveryModel.recordDeliveryEvent(client, {
      delivery_id: delivery.id,
      suborder_id: parsedSuborderId,
      order_id: suborder.parent_order_id,
      event_type: "partner_claimed",
      status: "assigned",
      title: "Verified Courier Assigned",
      description: `${partnerProfile?.name || "Courier"} (${partnerProfile?.vehicle_plate || "Fleet"} · Trust ${partnerProfile?.trust_score || "5.0"}★) claimed this delivery.`,
      location_name: origin,
      actor_id: actor.id,
      actor_role: actorRole,
    });

    await client.query("COMMIT");

    return {
      suborder_id: parsedSuborderId,
      claimed_by: actor.id,
      fulfillment_status: "accepted",
      delivery,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const updatePartnerTransitStatus = async ({
  actor,
  suborder_id,
  status,
  proof_image,
  notes,
  confirmation_code,
  pickup_code,
}) => {
  const parsedSuborderId = Number(suborder_id);
  if (!isPositiveInteger(parsedSuborderId)) {
    throw createServiceError("Valid suborder_id is required", 400);
  }

  const validStatuses = ["picked_up", "in_transit", "delivered", "cancelled"];
  const normalizedStatus = String(status).trim().toLowerCase();
  if (!validStatuses.includes(normalizedStatus)) {
    throw createServiceError(`Invalid status. Allowed: ${validStatuses.join(", ")}`, 400);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const suborder = await deliveryModel.findSuborderById(client, parsedSuborderId);
    if (!suborder) {
      throw createServiceError("Suborder not found", 404);
    }

    const actorRole = normalizeRole(actor.role);
    if (actorRole !== "admin" && Number(suborder.delivery_partner_id) !== Number(actor.id)) {
      throw createServiceError("You are not assigned to deliver this suborder", 403);
    }

    const existingDel = await deliveryModel.findDeliveryBySuborderId(client, parsedSuborderId);
    const partnerId = Number(suborder.delivery_partner_id || actor.id);

    // 1. Accountability on Courier Cancellation -> Penalize trust score & immediately re-queue to Pool
    if (normalizedStatus === "cancelled") {
      await client.query(
        `
          UPDATE delivery_profiles
          SET cancelled_deliveries = COALESCE(cancelled_deliveries, 0) + 1,
              trust_score = GREATEST(1.00, COALESCE(trust_score, 5.00) - 0.35),
              updated_at = NOW()
          WHERE user_id = $1
        `,
        [partnerId]
      );

      await client.query(
        `
          UPDATE suborders
          SET delivery_partner_id = NULL,
              fulfillment_status = 'packed',
              updated_at = NOW()
          WHERE id = $1
        `,
        [parsedSuborderId]
      );

      await client.query(
        `
          UPDATE deliveries
          SET delivery_partner_id = NULL,
              delivery_person_id = NULL,
              status = 'pending',
              delivery_status = 'pending',
              current_checkpoint = 'Reopened to Courier Pool after driver release',
              farmer_notes = COALESCE($1, farmer_notes)
          WHERE suborder_id = $2
        `,
        [notes || "Previous courier released job; reopened in pool.", parsedSuborderId]
      );

      await client.query(
        `UPDATE driver_payout_ledger SET status = 'forfeited' WHERE suborder_id = $1 AND driver_id = $2`,
        [parsedSuborderId, partnerId]
      );

      await deliveryModel.recordDeliveryEvent(client, {
        delivery_id: existingDel?.id || null,
        suborder_id: parsedSuborderId,
        order_id: suborder.parent_order_id,
        event_type: "partner_released",
        status: "pending",
        title: "Courier Released Job · Requeued to Pool",
        description: notes || "Package automatically returned to Delivery Pool for another verified courier.",
        location_name: existingDel?.current_checkpoint || existingDel?.pickup_location || "En Route",
        actor_id: actor.id,
        actor_role: actorRole,
      });

      await client.query("COMMIT");

      return {
        suborder_id: parsedSuborderId,
        status: "packed",
        requeued: true,
        message: "Delivery released back to pool; courier reliability metrics updated.",
      };
    }

    // 2. Pickup Verification Check (if farmer pickup code exists and supplied, or optional check)
    if (normalizedStatus === "picked_up" && pickup_code && existingDel?.pickup_verification_code) {
      if (
        String(pickup_code).trim().toUpperCase() !==
        String(existingDel.pickup_verification_code).trim().toUpperCase()
      ) {
        throw createServiceError("Invalid farm handover pickup code", 400);
      }
    }

    // 3. Mandatory Buyer PIN Verification on Delivered (Stops Rogue Courier Escrow Fraud!)
    const isDelivered = normalizedStatus === "delivered";
    if (isDelivered && actorRole !== "admin") {
      const expectedBuyerPin = existingDel?.delivery_confirmation_code;
      if (expectedBuyerPin) {
        if (!confirmation_code || !String(confirmation_code).trim()) {
          throw createServiceError(
            "Buyer 6-digit handover PIN (DEL-XXXXXX) is required from the recipient to complete delivery",
            400
          );
        }
        if (
          String(confirmation_code).trim().toUpperCase() !==
          String(expectedBuyerPin).trim().toUpperCase()
        ) {
          throw createServiceError(
            "Incorrect buyer handover PIN. Ask the recipient for the DEL-XXXXXX code shown on their tracking page.",
            400
          );
        }
      }
    }

    const nextCheckpoint =
      normalizedStatus === "picked_up"
        ? `Picked up from ${existingDel?.pickup_location || "Farm Gate"}`
        : normalizedStatus === "in_transit"
        ? `In Transit towards ${existingDel?.delivery_location || "Buyer Destination"}`
        : `Delivered to ${existingDel?.delivery_location || "Recipient"}`;

    await client.query(
      `UPDATE suborders SET fulfillment_status = $1, updated_at = NOW() WHERE id = $2`,
      [normalizedStatus, parsedSuborderId]
    );

    const delivery = await client.query(
      `UPDATE deliveries
       SET status = $1::varchar,
           delivery_status = $1::varchar,
           proof_of_delivery_image_url = COALESCE($2, proof_of_delivery_image_url),
           farmer_notes = COALESCE($3, farmer_notes),
           current_checkpoint = $4,
           dispatched_at = CASE WHEN $1::varchar = 'in_transit' AND dispatched_at IS NULL THEN NOW() ELSE dispatched_at END,
           delivered_at = CASE WHEN $5::boolean THEN NOW() ELSE delivered_at END,
           buyer_confirmed_at = CASE WHEN $5::boolean THEN NOW() ELSE buyer_confirmed_at END
       WHERE suborder_id = $6
       RETURNING *`,
      [normalizedStatus, proof_image || null, notes || null, nextCheckpoint, isDelivered, parsedSuborderId]
    );

    let releasedEscrow = [];
    if (isDelivered) {
      await client.query(
        `
          UPDATE delivery_profiles
          SET completed_deliveries = COALESCE(completed_deliveries, 0) + 1,
              updated_at = NOW()
          WHERE user_id = $1
        `,
        [partnerId]
      );
      await client.query(
        `UPDATE driver_payout_ledger SET status = 'eligible', released_at = NOW() WHERE suborder_id = $1 AND driver_id = $2`,
        [parsedSuborderId, partnerId]
      );
      releasedEscrow = await deliveryModel.releaseEscrowForSuborder(client, parsedSuborderId);
      await deliveryModel.checkAndCompleteParentOrder(client, suborder.parent_order_id);
    }

        await deliveryModel.recordDeliveryEvent(client, {
      delivery_id: delivery.rows[0]?.id || null,
      suborder_id: parsedSuborderId,
      order_id: suborder.parent_order_id,
      event_type: `partner_${normalizedStatus}`,
      status: normalizedStatus,
      title:
        normalizedStatus === "picked_up"
          ? "Produce Picked Up from Farm"
          : normalizedStatus === "in_transit"
          ? "Courier En Route to Destination"
          : "Delivered & Verified with Buyer PIN",
      description: notes || nextCheckpoint,
      location_name: nextCheckpoint,
      actor_id: actor.id,
      actor_role: actorRole,
    });

    await client.query("COMMIT");

    return {
      suborder_id: parsedSuborderId,
      status: normalizedStatus,
      escrow_released: releasedEscrow.length > 0,
      delivery: delivery.rows[0],
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

// ==========================================
// Live Checkpoints & Buyer Accountability Rating
// ==========================================

const postDeliveryCheckpoint = async ({
  actor,
  suborder_id,
  location_name,
  latitude = null,
  longitude = null,
  estimated_time = null,
  notes = null,
}) => {
  const parsedSuborderId = Number(suborder_id);
  if (!isPositiveInteger(parsedSuborderId)) {
    throw createServiceError("Valid suborder_id is required", 400);
  }
  if (!location_name || !String(location_name).trim()) {
    throw createServiceError("Checkpoint location name is required", 400);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const suborder = await deliveryModel.findSuborderById(client, parsedSuborderId);
    if (!suborder) {
      throw createServiceError("Suborder not found", 404);
    }

    const actorRole = normalizeRole(actor.role);
    const isPartner = Number(actor.id) === Number(suborder.delivery_partner_id);
    const isFarmer = Number(actor.id) === Number(suborder.farmer_id);
    if (actorRole !== "admin" && !isPartner && !isFarmer) {
      throw createServiceError("Only assigned courier, farmer, or admin can post checkpoints", 403);
    }

    const cleanLocation = String(location_name).trim();
    const delRes = await client.query(
      `
        UPDATE deliveries
        SET current_checkpoint = $1,
            last_latitude = COALESCE($2, last_latitude),
            last_longitude = COALESCE($3, last_longitude),
            estimated_time = COALESCE($4, estimated_time),
            farmer_notes = COALESCE($5, farmer_notes)
        WHERE suborder_id = $6
        RETURNING *
      `,
      [cleanLocation, latitude, longitude, estimated_time, notes, parsedSuborderId]
    );

    const event = await deliveryModel.recordDeliveryEvent(client, {
      delivery_id: delRes.rows[0]?.id || null,
      suborder_id: parsedSuborderId,
      order_id: suborder.parent_order_id,
      event_type: "route_checkpoint",
      status: suborder.fulfillment_status,
      title: `Transit Checkpoint: ${cleanLocation}`,
      description: notes || (estimated_time ? `Updated ETA: ${estimated_time}` : "Live route scan logged"),
      location_name: cleanLocation,
      latitude,
      longitude,
      actor_id: actor.id,
      actor_role: actorRole,
    });

    await client.query("COMMIT");

    return {
      suborder_id: parsedSuborderId,
      current_checkpoint: cleanLocation,
      estimated_time: delRes.rows[0]?.estimated_time,
      event,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const rateSuborderDelivery = async ({ actor, suborder_id, rating, feedback = null }) => {
  const parsedSuborderId = Number(suborder_id);
  const parsedRating = Number(rating);
  if (!isPositiveInteger(parsedSuborderId)) {
    throw createServiceError("Valid suborder_id is required", 400);
  }
  if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
    throw createServiceError("Rating must be an integer between 1 and 5", 400);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const suborder = await deliveryModel.findSuborderById(client, parsedSuborderId);
    if (!suborder) {
      throw createServiceError("Suborder not found", 404);
    }

    if (normalizeRole(actor.role) !== "admin" && Number(actor.id) !== Number(suborder.buyer_id)) {
      throw createServiceError("Only the buyer can rate this delivery", 403);
    }

    if (suborder.fulfillment_status !== "delivered") {
      throw createServiceError("You can rate delivery after it has been completed", 400);
    }

    const del = await deliveryModel.findDeliveryBySuborderId(client, parsedSuborderId);
    if (del && del.buyer_rating) {
      throw createServiceError("Delivery has already been rated", 409);
    }

    await client.query(
      `UPDATE deliveries SET buyer_rating = $1, buyer_feedback = $2 WHERE suborder_id = $3`,
      [parsedRating, feedback ? String(feedback).trim() : null, parsedSuborderId]
    );

    if (suborder.delivery_partner_id) {
      await client.query(
        `
          UPDATE delivery_profiles
          SET rating_sum = COALESCE(rating_sum, 0) + $1,
              rating_count = COALESCE(rating_count, 0) + 1,
              trust_score = ROUND(
                (5.00 + COALESCE(rating_sum, 0) + $1)::numeric / (1 + COALESCE(rating_count, 0) + 1),
                2
              ),
              updated_at = NOW()
          WHERE user_id = $2
        `,
        [parsedRating, suborder.delivery_partner_id]
      );
    }

    await client.query("COMMIT");

    return {
      suborder_id: parsedSuborderId,
      rating: parsedRating,
      feedback,
      message: "Thank you for rating this delivery!",
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

// ==========================================
// Tracking & Legacy Admin Methods
// ==========================================

const trackSuborderDelivery = async (suborder_id, actor = null) => {
  const parsedSuborderId = Number(suborder_id);
  if (!isPositiveInteger(parsedSuborderId)) {
    throw createServiceError("Invalid suborder id", 400);
  }

  const actorRole = actor ? normalizeRole(actor.role) : "guest";
  const includeSecretCodes = actorRole !== "delivery_partner";

  const delivery = await deliveryModel.getDeliveryBySuborderId(parsedSuborderId, {
    includeSecretCodes,
  });
  if (!delivery) {
    throw createServiceError("Delivery not found for this suborder", 404);
  }

  if (actor) {
    const subRes = await pool.query(
      `SELECT s.farmer_id, s.delivery_partner_id, o.buyer_id
       FROM suborders s
       JOIN orders o ON o.id = s.parent_order_id
       WHERE s.id = $1 LIMIT 1`,
      [parsedSuborderId]
    );
    const ownership = subRes.rows[0];
    if (
      ownership &&
      actorRole !== "admin" &&
      actorRole !== "field_agent" &&
      Number(actor.id) !== Number(ownership.buyer_id) &&
      Number(actor.id) !== Number(ownership.farmer_id) &&
      Number(actor.id) !== Number(ownership.delivery_partner_id)
    ) {
      throw createServiceError("You are not allowed to view this suborder delivery", 403);
    }
  }

  const events = await deliveryModel.getEventsBySuborderId(parsedSuborderId);
  return { ...delivery, events };
};

const assignDelivery = async ({ actor, payload }) => {
  if (payload.suborder_id) {
    return claimPoolDelivery({
      actor: { id: payload.delivery_partner_id || payload.delivery_person_id, role: "admin" },
      suborder_id: payload.suborder_id,
      estimated_time: payload.estimated_time,
    });
  }

  const actorRole = normalizeRole(actor.role);
  if (actorRole !== "admin" && actorRole !== "field_agent") {
    throw createServiceError("Only admins or field agents can assign delivery partners", 403);
  }

  const order_id = Number(payload.order_id);
  const delivery_partner_id = Number(payload.delivery_partner_id || payload.delivery_person_id);

  if (!isPositiveInteger(order_id) || !isPositiveInteger(delivery_partner_id)) {
    throw createServiceError("order_id and delivery_partner_id are required", 400);
  }

  const delivery_location =
    payload.delivery_location || payload.delivery_address || payload.address;

  if (!delivery_location || !String(delivery_location).trim()) {
    throw createServiceError("delivery_location is required", 400);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const order = await deliveryModel.findOrderById(client, order_id);
    if (!order) {
      throw createServiceError("Order not found", 404);
    }

    const partner = await deliveryModel.findDeliveryPartnerById(client, delivery_partner_id);
    if (!partner) {
      throw createServiceError("delivery_partner_id must belong to a delivery partner", 400);
    }

    const existingDelivery = await deliveryModel.findDeliveryByOrderIdForUpdate(client, order_id);
    if (existingDelivery) {
      throw createServiceError("Delivery partner already assigned for this order", 409);
    }

    const delivery = await deliveryModel.createDelivery(client, {
      order_id,
      delivery_partner_id: partner.id,
      pickup_location: payload.pickup_location ? String(payload.pickup_location).trim() : null,
      delivery_location: String(delivery_location).trim(),
      status: "assigned",
      estimated_time: payload.estimated_time || null,
    });

    await deliveryModel.updateOrderDeliveryStatus(client, {
      order_id,
      status: "assigned",
    });

    await client.query("COMMIT");
    return delivery;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const assignDeliveryPartnerToOrder = async ({ actor, order_id, delivery_partner_id }) => {
  const actorRole = normalizeRole(actor.role);
  if (!actor || (actorRole !== "admin" && actorRole !== "field_agent")) {
    throw createServiceError("Only admins or field agents can assign delivery partners", 403);
  }

  const parsed_order_id = Number(order_id);
  const parsed_partner_id = Number(delivery_partner_id);

  if (!isPositiveInteger(parsed_order_id) || !isPositiveInteger(parsed_partner_id)) {
    throw createServiceError("order_id and delivery_partner_id are required", 400);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const order = await deliveryModel.findOrderById(client, parsed_order_id);
    if (!order) {
      throw createServiceError("Order not found", 404);
    }
    const partner = await deliveryModel.findDeliveryPartnerById(client, parsed_partner_id);
    if (!partner) {
      throw createServiceError("delivery_partner_id must belong to a delivery partner", 400);
    }
    const updatedOrder = await orderModel.assignDeliveryPartnerById(
      parsed_order_id,
      Number(partner.id),
      client
    );
    await client.query("COMMIT");
    return updatedOrder;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const updateDeliveryStatus = async ({ actor, payload }) => {
  if (payload.suborder_id) {
    return updatePartnerTransitStatus({
      actor,
      suborder_id: payload.suborder_id,
      status: payload.status || payload.delivery_status,
      proof_image: payload.proof_of_delivery_image_url || payload.proof_image,
      notes: payload.notes,
      confirmation_code: payload.confirmation_code,
    });
  }

  let order_id = payload.order_id;
  const delivery_id = payload.delivery_id;
  const status = payload.status || payload.delivery_status;

  if (!status) {
    throw createServiceError("status is required", 400);
  }

  if (order_id !== undefined && order_id !== null && !isPositiveInteger(order_id)) {
    throw createServiceError("order_id must be a valid integer", 400);
  }

  if (delivery_id !== undefined && delivery_id !== null && !isPositiveInteger(delivery_id)) {
    throw createServiceError("delivery_id must be a valid integer", 400);
  }

  if ((order_id === undefined || order_id === null) && (delivery_id === undefined || delivery_id === null)) {
    throw createServiceError("order_id or delivery_id is required", 400);
  }

  const normalizedStatus = String(status).trim().toLowerCase();
  if (!allowedDeliveryStatuses.includes(normalizedStatus)) {
    throw createServiceError("Invalid delivery status value", 400);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let existingDelivery = null;
    if (order_id !== undefined && order_id !== null) {
      existingDelivery = await deliveryModel.findDeliveryByOrderIdForUpdate(client, Number(order_id));
    } else {
      existingDelivery = await deliveryModel.findDeliveryByIdForUpdate(client, Number(delivery_id));
      if (existingDelivery) {
        order_id = existingDelivery.order_id;
      }
    }
    if (!existingDelivery) {
      throw createServiceError("Delivery not found for this order", 404);
    }
    const order = await deliveryModel.findOrderById(client, Number(order_id));
    if (!order) {
      throw createServiceError("Order not found", 404);
    }
    const actorRole = normalizeRole(actor.role);
    if (actorRole !== "delivery_partner" && actorRole !== "admin") {
      throw createServiceError("Only delivery partners or admins can update delivery status", 403);
    }
    if (
      actorRole !== "admin" &&
      Number(actor.id) !== Number(existingDelivery.delivery_partner_id) &&
      Number(actor.id) !== Number(existingDelivery.delivery_person_id)
    ) {
      throw createServiceError("You are not allowed to update this delivery", 403);
    }
    const delivery = await deliveryModel.updateDeliveryByOrderId(client, {
      order_id: Number(order_id),
      status: normalizedStatus,
      estimated_time: payload.estimated_time || null,
      pickup_location:
        payload.pickup_location !== undefined ? String(payload.pickup_location).trim() : undefined,
      delivery_location:
        payload.delivery_location !== undefined ? String(payload.delivery_location).trim() : undefined,
    });
    await deliveryModel.updateOrderDeliveryStatus(client, {
      order_id: Number(order_id),
      status: normalizedStatus,
    });
    await client.query("COMMIT");
    return delivery;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const trackDelivery = async ({ actor, order_id }) => {
  if (!isPositiveInteger(order_id)) {
    throw createServiceError("Invalid order id", 400);
  }

  const actorRole = normalizeRole(actor.role);
  const includeSecretCodes = actorRole !== "delivery_partner";

  const delivery = await deliveryModel.getDeliveryByOrderId(Number(order_id), {
    includeSecretCodes,
  });

  if (!delivery || (Array.isArray(delivery) && delivery.length === 0)) {
    throw createServiceError("Delivery not found for this order", 404);
  }

  const deliveryRecord = Array.isArray(delivery) ? delivery[0] : delivery;

  let isFarmerForOrder = false;
  if (actorRole === "farmer") {
    const orderItems = await pool.query(
      `SELECT 1 FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = $1 AND p.farmer_id = $2 LIMIT 1`,
      [Number(order_id), Number(actor.id)]
    );
    isFarmerForOrder = orderItems.rows.length > 0;
  }

  if (
    actorRole !== "admin" &&
    actorRole !== "field_agent" &&
    Number(actor.id) !== Number(deliveryRecord.buyer_id) &&
    Number(actor.id) !== Number(deliveryRecord.delivery_partner_id) &&
    !isFarmerForOrder
  ) {
    throw createServiceError("You are not allowed to view this delivery", 403);
  }

  const events = await deliveryModel.getEventsByOrderId(Number(order_id));
  return delivery.map((d) => ({
    ...d,
    events: events.filter((ev) => !d.suborder_id || Number(ev.suborder_id) === Number(d.suborder_id)),
  }));
};

const getAssignedDeliveries = async ({ actor }) => {
  const actorRole = normalizeRole(actor.role);
  if (actorRole !== "delivery_partner" && actorRole !== "admin") {
    throw createServiceError("Only delivery partners or admins can view assigned deliveries", 403);
  }
  return await deliveryModel.findDeliveriesByPartnerId(Number(actor.id));
};

module.exports = {
  allowedDeliveryStatuses,
  assignDelivery,
  assignDeliveryPartnerToOrder,
  claimPoolDelivery,
  confirmFarmerDelivery,
  confirmSuborderPickup,
  dispatchFarmerDelivery,
  estimateCheckoutDelivery,
  getAssignedDeliveries,
  getDeliveryPool,
  getMyPartnerProfile,
  markSuborderReadyForPickup,
  postDeliveryCheckpoint,
  rateSuborderDelivery,
  submitMyPartnerProfile,
  trackDelivery,
  trackSuborderDelivery,
  updateDeliveryStatus,
  updatePartnerTransitStatus,
};
