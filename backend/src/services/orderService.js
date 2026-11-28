// Order service that manages order creation, totals, inventory updates, and status changes.
const { pool } = require("../config/db");
const logger = require("../utils/logger");
const notificationModel = require("../models/notificationModel");
const orderModel = require("../models/orderModel");
const deliveryModel = require("../models/deliveryModel");
const deliveryPricingService = require("./deliveryPricingService");
const inventoryModel = require("../models/inventoryModel");
const inventoryService = require("./inventoryService");
const { normalizeRole } = require("../utils/roles");
const { isPositiveInteger } = require("../utils/validators");

const allowedOrderStatuses = ["pending", "confirmed", "collected", "in_transit", "delivered", "returned"];
const allowedPaymentStatuses = ["pending", "paid", "failed", "refunded"];
const allowedDeliveryStatuses = [
	"pending",
	"assigned",
	"processing",
	"shipped",
	"out for delivery",
	"delivered",
	"cancelled",
];

const createServiceError = (message, statusCode, extra = {}) => {
	const error = new Error(message);
	error.statusCode = statusCode;
	Object.assign(error, extra);
	return error;
};

const emitOrderCreatedNotification = async ({ order }) => {
	if (!order || !order.id || !order.buyer_id) {
		return;
	}

	try {
		await notificationModel.createNotificationForUser({
			user_id: Number(order.buyer_id),
			title: "Order created",
			message: `Your order #${order.id} was created successfully.`,
			type: "order",
		});
	} catch (error) {
		logger.warn("Order notification emit failed", {
			order_id: order.id,
			buyer_id: order.buyer_id,
			message: error.message,
			code: error.code,
		});
	}
};

const getOrdersForBuyer = async (buyer_id, order_id = null) => {
	return orderModel.getOrdersForBuyer(buyer_id, order_id);
};

const orderStatusTransitions = {
	pending: ["confirmed", "cancelled"],
	confirmed: ["collected", "in_transit", "cancelled"],
	collected: ["in_transit"],
	in_transit: ["delivered"],
	delivered: ["returned"],
	returned: [],
	cancelled: [],
};

const roleAllowedStatuses = {
	admin: ["pending", "confirmed", "collected", "in_transit", "delivered", "returned", "cancelled"],
	buyer: ["cancelled"],
	field_agent: ["confirmed", "collected"],
	delivery_partner: ["in_transit", "delivered"],
	farmer: ["confirmed", "collected", "in_transit", "delivered", "returned", "cancelled"],
};

const validateOrderStatusUpdate = ({ actor, order, nextStatus }) => {
	const actorRole = normalizeRole(actor && actor.role);
	const allowedStatuses = roleAllowedStatuses[actorRole];

	if (!allowedStatuses) {
		throw createServiceError("You are not authorized to update order status", 403);
	}

	if (!allowedOrderStatuses.includes(nextStatus)) {
		throw createServiceError("Invalid order status value", 400);
	}

	if (!allowedStatuses.includes(nextStatus)) {
		throw createServiceError(`Role ${actorRole} cannot set order status to ${nextStatus}`, 403);
	}

	if (actorRole === "buyer") {
		if (Number(actor.id) !== Number(order.buyer_id)) {
			throw createServiceError("You can only cancel your own orders", 403);
		}
		if (!["pending", "confirmed"].includes(order.order_status)) {
			throw createServiceError("Only pending or confirmed orders can be cancelled", 400);
		}
	}

	if (
		actorRole === "field_agent" &&
		Number(actor.id) !== Number(order.field_agent_id)
	) {
		throw createServiceError("You are not assigned to this order as field agent", 403);
	}

	if (
		actorRole === "delivery_partner" &&
		Number(actor.id) !== Number(order.delivery_partner_id)
	) {
		throw createServiceError("You are not assigned to this order as delivery partner", 403);
	}

	if (actorRole === 'farmer') {
		const isFarmerOfOrder = 
			(Array.isArray(order.farmer_ids) && order.farmer_ids.map(Number).includes(Number(actor.id))) ||
			Number(actor.id) === Number(order.farmer_id);

		if (!isFarmerOfOrder) {
			throw createServiceError('You are not authorized to update this order', 403);
		}
	}

	const currentStatus = order.order_status;
	const allowedNextStatuses = orderStatusTransitions[currentStatus] || [];

	if (!allowedNextStatuses.includes(nextStatus)) {
		throw createServiceError(
			`Invalid order status transition from ${currentStatus} to ${nextStatus}`,
			400
		);
	}
};

// Removed resolveOrderSupplyChain entirely as it does not match DB schema

const resolveFulfillmentMode = (requestedMode, farmerItems) => {
	const normalized = String(requestedMode || "").trim().toLowerCase();
	if (normalized === "delivery_partner") return "delivery_partner";
	if (normalized === "farmer_delivery") {
		const supported = farmerItems.every((it) => it.farmer_delivery_available !== false);
		return supported ? "farmer_delivery" : "delivery_partner";
	}
	if (normalized === "farmer_pickup") {
		const supported = farmerItems.every((it) => it.pickup_available !== false);
		return supported ? "farmer_pickup" : "delivery_partner";
	}
	return "farmer_pickup";
};

const createOrder = async (buyer_id, payload = {}) => {
	const client = await pool.connect();

	try {
		await client.query("BEGIN");

		const address_id =
			payload.address_id === undefined || payload.address_id === null
				? null
				: Number(payload.address_id);

		if (address_id !== null && !isPositiveInteger(address_id)) {
			throw createServiceError("address_id must be a valid integer", 400);
		}

		const buyerRes = await client.query(
			`SELECT address FROM users WHERE id = $1 LIMIT 1`,
			[buyer_id]
		);
		const buyerShippingAddress =
			(payload.delivery_address && String(payload.delivery_address).trim()) ||
			(buyerRes.rows[0] && buyerRes.rows[0].address) ||
			"Standard Buyer Delivery Address";

		const cartResult = await client.query(
			`
				SELECT
					ci.cart_item_id AS id,
					ci.product_id,
					ci.quantity,
					p.name,
					p.price,
					p.stock,
					p.status,
					p.moderation_status,
					p.deleted_at,
					p.farmer_id,
					p.unit,
					p.image_url,
					p.farm_location,
					COALESCE(p.pickup_available, TRUE) AS pickup_available,
					COALESCE(p.farmer_delivery_available, FALSE) AS farmer_delivery_available,
					COALESCE(p.delivery_radius_km, 0) AS delivery_radius_km,
					u.name AS farmer_name,
					u.address AS farmer_address,
					u.account_status,
					c.cart_id
				FROM carts c
				JOIN cart_items ci ON ci.cart_id = c.cart_id
				JOIN products p ON p.id = ci.product_id
				JOIN users u ON u.id = p.farmer_id
				WHERE c.user_id = $1
				ORDER BY ci.cart_item_id ASC
				FOR UPDATE OF ci
			`,
			[buyer_id]
		);

		if (cartResult.rows.length === 0) {
			throw createServiceError("Cart is empty", 400);
		}

		let items_subtotal = 0;

		// 1. Eligibility & Stock Concurrency Verification
		for (const item of cartResult.rows) {
			// Eligibility Gate: Product must be non-deleted, active, and approved
			if (item.deleted_at || item.status !== "active" || item.moderation_status !== "approved") {
				throw createServiceError(
					`Product "${item.name}" is no longer available for purchase`,
					409
				);
			}

			// Eligibility Gate: Seller must be active (not suspended or banned)
			if (item.account_status && ["suspended", "banned", "deactivated"].includes(item.account_status)) {
				throw createServiceError(
					`The seller for "${item.name}" is currently unable to fulfill orders`,
					409
				);
			}

			// Authoritative Row-Level Lock on Inventory
			const inv = await inventoryModel.findInventoryForUpdate(client, item.product_id);
			const availableStock = inv ? Number(inv.quantity) : Number(item.stock || 0);

			if (availableStock < item.quantity) {
				throw createServiceError(
					`Insufficient stock for product: ${item.name}`,
					409
				);
			}

			items_subtotal += Number(item.price) * item.quantity;
		}

		// Group items by farmer_id and pre-compute per-suborder shipping fees
		const itemsByFarmer = new Map();
		for (const item of cartResult.rows) {
			const fId = Number(item.farmer_id);
			if (!itemsByFarmer.has(fId)) {
				itemsByFarmer.set(fId, []);
			}
			itemsByFarmer.get(fId).push(item);
		}

		const fulfillmentSelections =
			payload.fulfillment_selections && typeof payload.fulfillment_selections === "object"
				? payload.fulfillment_selections
				: {};

		let totalShippingFee = 0;
		const suborderPlan = [];
		for (const [farmerId, farmerItems] of itemsByFarmer.entries()) {
			const requestedMode =
				fulfillmentSelections[String(farmerId)] ||
				fulfillmentSelections[farmerId] ||
				payload.fulfillment_type ||
				"farmer_pickup";
			const fulfillmentType = resolveFulfillmentMode(requestedMode, farmerItems);
			const originAddress =
				farmerItems[0]?.farm_location || farmerItems[0]?.farmer_address || "";
			const maxRadius = farmerItems.reduce(
				(max, it) => Math.max(max, Number(it.delivery_radius_km || 0)),
				0
			);
			const estimate = deliveryPricingService.estimateSuborderDeliveryFee({
				fulfillment_type: fulfillmentType,
				origin_address: originAddress,
				destination_address: buyerShippingAddress,
				items: farmerItems,
				delivery_radius_km: maxRadius,
			});
			totalShippingFee += estimate.shipping_fee;
			suborderPlan.push({
				farmerId,
				farmerItems,
				fulfillmentType,
				shippingFee: estimate.shipping_fee,
				estimate,
				originAddress,
			});
		}

		const grandTotal = items_subtotal + totalShippingFee;

		// 2. Create Parent Order
		const orderNumber = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
		const order = await orderModel.createOrderRecord(client, {
			buyer_id,
			total_amount: grandTotal.toFixed(2),
			address_id,
			order_number: orderNumber,
		});

		// 3. Multi-Vendor Suborders + Deliveries Seed + Initial Event Timeline
		let suborderIndex = 1;
		for (const {
			farmerId,
			farmerItems,
			fulfillmentType,
			shippingFee,
			estimate,
			originAddress,
		} of suborderPlan) {
			const farmerSubtotal = farmerItems.reduce(
				(sum, it) => sum + Number(it.price) * it.quantity,
				0
			);
			const suborderTotal = farmerSubtotal + shippingFee;
			const suborderNumber = `SUB-${order.id}-${farmerId}-${suborderIndex++}`;
			const pickupCode =
				fulfillmentType === "farmer_pickup"
					? `GH-${Math.floor(100000 + Math.random() * 900000)}`
					: `PKP-${Math.floor(100000 + Math.random() * 900000)}`;
			const buyerConfirmationCode = `DEL-${Math.floor(100000 + Math.random() * 900000)}`;

			const suborder = await orderModel.createSuborderRecord(client, {
				parent_order_id: order.id,
				farmer_id: farmerId,
				suborder_number: suborderNumber,
				subtotal: farmerSubtotal.toFixed(2),
				shipping_fee: shippingFee.toFixed(2),
				total_amount: suborderTotal.toFixed(2),
				fulfillment_type: fulfillmentType,
				pickup_code: pickupCode,
				notes: payload.notes ? String(payload.notes).trim() : null,
			});

			const pickupOrigin = originAddress || "Farm Gate";

			const deliveryRecord = await deliveryModel.upsertSuborderDelivery(client, {
				order_id: order.id,
				suborder_id: suborder.id,
				fulfillment_type: fulfillmentType,
				status: "pending",
				pickup_verification_code: pickupCode,
				delivery_confirmation_code: buyerConfirmationCode,
				pickup_location: pickupOrigin,
				delivery_location: buyerShippingAddress,
				estimated_time: estimate.estimated_eta,
				distance_km: estimate.distance_km,
				total_weight_kg: estimate.total_weight_kg,
				fee_breakdown: estimate.breakdown,
				current_checkpoint: `${pickupOrigin} (Awaiting farmer acceptance)`,
			});

			await deliveryModel.recordDeliveryEvent(client, {
				delivery_id: deliveryRecord.id,
				suborder_id: suborder.id,
				order_id: order.id,
				event_type: "order_placed",
				status: "pending",
				title: "Order Placed & Inventory Reserved",
				description: `Fulfillment mode: ${fulfillmentType.replace(/_/g, " ")} (${estimate.total_weight_kg} kg · ~${estimate.distance_km} km)`,
				location_name: pickupOrigin,
				actor_id: buyer_id,
				actor_role: "buyer",
			});

			for (const item of farmerItems) {
				// Record order_item with frozen immutable product snapshot
				await orderModel.createOrderItemRecord(client, {
					order_id: order.id,
					suborder_id: suborder.id,
					product_id: item.product_id,
					quantity: item.quantity,
					price: item.price,
					product_name: item.name,
					product_image_url: item.image_url,
					unit: item.unit || "kg",
					unit_price: item.price,
					farmer_id: item.farmer_id,
					farmer_name: item.farmer_name,
				});

				// Decrement authoritative inventory stock
				await inventoryModel.decrementInventoryStock(client, item.product_id, item.quantity);

				// Create 15-minute stock reservation
				await inventoryModel.createStockReservation(client, {
					orderId: order.id,
					productId: item.product_id,
					quantity: item.quantity,
					ttlMinutes: 15,
				});
			}
		}

		// 4. Clear Cart
		await client.query(
			`
				DELETE FROM cart_items ci
				USING carts c
				WHERE ci.cart_id = c.cart_id AND c.user_id = $1
			`,
			[buyer_id]
		);

		await client.query("COMMIT");

		logger.info("Multi-vendor order created with suborders and stock reservations", {
			order_id: order.id,
			order_number: order.order_number,
			buyer_id,
			suborders_count: itemsByFarmer.size,
		});

		const createdOrders = await getOrdersForBuyer(buyer_id, order.id);
		const createdOrder = createdOrders[0];

		await emitOrderCreatedNotification({ order: createdOrder });

		return createdOrder;
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	} finally {
		client.release();
	}
};

const getFarmerSuborders = async ({ user, page = 1, limit = 10, status = null, search = null }) => {
	const farmerId = Number(user.id);
	return orderModel.getSubordersForFarmer(farmerId, { page, limit, status, search });
};

const updateSuborderStatus = async ({ user, suborderId, status }) => {
	const farmerId = Number(user.id);
	const updated = await orderModel.updateSuborderStatus(suborderId, status, farmerId);
	if (!updated) {
		throw createServiceError("Suborder not found or unauthorized", 404);
	}
	return updated;
};

const getOrderByIdForBuyer = async (buyer_id, order_id) => {
	if (!isPositiveInteger(order_id)) {
		throw createServiceError("Invalid order id", 400);
	}

	const orders = await getOrdersForBuyer(buyer_id, Number(order_id));

	if (orders.length === 0) {
		throw createServiceError("Order not found", 404);
	}

	return orders[0];
};

const updateOrderStatus = async ({ actor, order_id, status }) => {
	if (!actor) {
		throw createServiceError("Authentication is required", 401);
	}

	if (!isPositiveInteger(order_id)) {
		throw createServiceError("Invalid order id", 400);
	}

	if (!status || !String(status).trim()) {
		throw createServiceError("status is required", 400);
	}

	const nextStatus = String(status).trim().toLowerCase();
	const order = await orderModel.findOrderById(Number(order_id));

	if (!order) {
		throw createServiceError("Order not found", 404);
	}

	validateOrderStatusUpdate({
		actor,
		order,
		nextStatus,
	});

	if (nextStatus === "cancelled") {
		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			await inventoryModel.releaseReservationsByOrderId(client, Number(order_id));
			await client.query(
				`UPDATE suborders SET fulfillment_status = 'cancelled', updated_at = NOW() WHERE parent_order_id = $1`,
				[Number(order_id)]
			);
			await client.query(
				`UPDATE deliveries SET status = 'cancelled', delivery_status = 'cancelled' WHERE order_id = $1`,
				[Number(order_id)]
			);
			await client.query(
				`UPDATE orders SET order_status = 'cancelled', delivery_status = 'cancelled' WHERE id = $1`,
				[Number(order_id)]
			);
			await client.query("COMMIT");
			return orderModel.findOrderById(Number(order_id));
		} catch (err) {
			await client.query("ROLLBACK");
			throw err;
		} finally {
			client.release();
		}
	}

	return orderModel.updateOrderStatusById(Number(order_id), nextStatus);
};

module.exports = {
	allowedDeliveryStatuses,
	allowedOrderStatuses,
	allowedPaymentStatuses,
	createOrder,
	getFarmerSuborders,
	getOrderByIdForBuyer,
	getOrdersForBuyer,
	updateOrderStatus,
	updateSuborderStatus,
};
