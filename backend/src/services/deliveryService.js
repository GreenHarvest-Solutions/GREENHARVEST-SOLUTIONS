const crypto = require("crypto");
const { pool } = require("../config/db");
const logger = require("../utils/logger");
const deliveryModel = require("../models/deliveryModel");
const notificationModel = require("../models/notificationModel");
const orderModel = require("../models/orderModel");
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

    // Ensure pickup code exists on suborder
    const pickupCode = suborder.pickup_code || `GH-${Math.floor(100000 + Math.random() * 900000)}`;

    await client.query(
      `UPDATE suborders
       SET fulfillment_status = 'ready_for_pickup',
           pickup_code = $1
       WHERE id = $2`,
      [pickupCode, parsedSuborderId]
    );

    const delivery = await deliveryModel.upsertSuborderDelivery(client, {
      order_id: suborder.parent_order_id,
      suborder_id: parsedSuborderId,
      fulfillment_type: "farmer_pickup",
      status: "ready_for_pickup",
      pickup_verification_code: pickupCode,
      pickup_location: pickup_location || suborder.farmer_address || "Farm Gate",
      farmer_notes: farmer_notes || "Package ready for buyer collection.",
    });

    await client.query("COMMIT");

    // Notify buyer
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

    // Verify pickup code (case-insensitive)
    const normalizedInput = String(pickup_code).trim().toUpperCase();
    const normalizedExpected = String(suborder.pickup_code || "").trim().toUpperCase();

    if (normalizedInput !== normalizedExpected) {
      throw createServiceError("Invalid pickup verification code", 400);
    }

    // Update suborder & delivery to delivered
    await client.query(
      `UPDATE suborders
       SET fulfillment_status = 'delivered'
       WHERE id = $1`,
      [parsedSuborderId]
    );

    await client.query(
      `UPDATE deliveries
       SET status = 'delivered',
           delivery_status = 'delivered',
           delivered_at = NOW()
       WHERE suborder_id = $1`,
      [parsedSuborderId]
    );

    // Release escrow for this suborder
    const releasedEscrow = await deliveryModel.releaseEscrowForSuborder(client, parsedSuborderId);

    // Check if entire parent order is completed
    await deliveryModel.checkAndCompleteParentOrder(client, suborder.parent_order_id);

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

    const deliveryCode = `DEL-${Math.floor(100000 + Math.random() * 900000)}`;

    await client.query(
      `UPDATE suborders
       SET fulfillment_status = 'in_transit'
       WHERE id = $1`,
      [parsedSuborderId]
    );

    const delivery = await deliveryModel.upsertSuborderDelivery(client, {
      order_id: suborder.parent_order_id,
      suborder_id: parsedSuborderId,
      fulfillment_type: "farmer_delivery",
      status: "in_transit",
      delivery_confirmation_code: deliveryCode,
      pickup_location: suborder.farmer_address || "Farm Gate",
      delivery_location: suborder.buyer_address || "Buyer Delivery Address",
      estimated_time: estimated_time || "Within 24 hours",
      farmer_notes: [vehicle_info, farmer_notes].filter(Boolean).join(" | "),
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

    // If farmer is confirming, confirmation_code from buyer is mandatory
    if (isFarmer && !isAdmin) {
      if (!confirmation_code) {
        throw createServiceError("Buyer confirmation code is required", 400);
      }
      const existingDel = await deliveryModel.findDeliveryBySuborderId(client, parsedSuborderId);
      const expectedCode = existingDel && existingDel.delivery_confirmation_code;
      if (String(confirmation_code).trim().toUpperCase() !== String(expectedCode || "").trim().toUpperCase()) {
        throw createServiceError("Invalid delivery confirmation code", 400);
      }
    }

    await client.query(
      `UPDATE suborders
       SET fulfillment_status = 'delivered'
       WHERE id = $1`,
      [parsedSuborderId]
    );

    await client.query(
      `UPDATE deliveries
       SET status = 'delivered',
           delivery_status = 'delivered',
           delivered_at = NOW()
       WHERE suborder_id = $1`,
      [parsedSuborderId]
    );

    const releasedEscrow = await deliveryModel.releaseEscrowForSuborder(client, parsedSuborderId);
    await deliveryModel.checkAndCompleteParentOrder(client, suborder.parent_order_id);

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
// Mode C: Delivery Partner Pool Workflows
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

    const suborder = await deliveryModel.findSuborderById(client, parsedSuborderId);
    if (!suborder) {
      throw createServiceError("Suborder not found", 404);
    }

    if (suborder.delivery_partner_id && Number(suborder.delivery_partner_id) !== Number(actor.id)) {
      throw createServiceError("This delivery has already been claimed by another partner", 409);
    }

    await client.query(
      `UPDATE suborders
       SET delivery_partner_id = $1,
           fulfillment_status = 'accepted'
       WHERE id = $2`,
      [actor.id, parsedSuborderId]
    );

    const delivery = await deliveryModel.upsertSuborderDelivery(client, {
      order_id: suborder.parent_order_id,
      suborder_id: parsedSuborderId,
      delivery_partner_id: actor.id,
      fulfillment_type: "delivery_partner",
      status: "assigned",
      pickup_location: suborder.farmer_address || "Farm Gate",
      delivery_location: suborder.buyer_address || "Customer Address",
      estimated_time: estimated_time || "4 hours",
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

const updatePartnerTransitStatus = async ({ actor, suborder_id, status, proof_image, notes }) => {
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

    const isDelivered = normalizedStatus === "delivered";

    await client.query(
      `UPDATE suborders
       SET fulfillment_status = $1
       WHERE id = $2`,
      [normalizedStatus, parsedSuborderId]
    );

    const delivery = await client.query(
      `UPDATE deliveries
       SET status = $1,
           delivery_status = $1,
           proof_of_delivery_image_url = COALESCE($2, proof_of_delivery_image_url),
           farmer_notes = COALESCE($3, farmer_notes),
           delivered_at = CASE WHEN $4 THEN NOW() ELSE delivered_at END
       WHERE suborder_id = $5
       RETURNING *`,
      [normalizedStatus, proof_image, notes, isDelivered, parsedSuborderId]
    );

    let releasedEscrow = [];
    if (isDelivered) {
      releasedEscrow = await deliveryModel.releaseEscrowForSuborder(client, parsedSuborderId);
      await deliveryModel.checkAndCompleteParentOrder(client, suborder.parent_order_id);
    }

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
// Tracking & Legacy Admin Methods
// ==========================================

const trackSuborderDelivery = async (suborder_id) => {
  const parsedSuborderId = Number(suborder_id);
  if (!isPositiveInteger(parsedSuborderId)) {
    throw createServiceError("Invalid suborder id", 400);
  }

  return deliveryModel.getDeliveryBySuborderId(parsedSuborderId);
};

const assignDelivery = async ({ actor, payload }) => {
  if (payload.suborder_id) {
    return claimPoolDelivery({
      actor: { id: payload.delivery_partner_id || payload.delivery_person_id, role: "delivery_partner" },
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

  const delivery = await deliveryModel.getDeliveryByOrderId(Number(order_id));

  if (!delivery || (Array.isArray(delivery) && delivery.length === 0)) {
    throw createServiceError("Delivery not found for this order", 404);
  }

  const deliveryRecord = Array.isArray(delivery) ? delivery[0] : delivery;
  const actorRole = normalizeRole(actor.role);

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

  return delivery;
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
  getAssignedDeliveries,
  getDeliveryPool,
  markSuborderReadyForPickup,
  trackDelivery,
  trackSuborderDelivery,
  updateDeliveryStatus,
  updatePartnerTransitStatus,
};
