const logger = require("../utils/logger");
const deliveryService = require("../services/deliveryService");

const handleControllerError = (res, context, error, meta = {}) => {
	logger.error(context, {
		message: error.message,
		code: error.code,
		stack: error.stack,
		...meta,
	});

	return res.status(error.statusCode || 500).json({
		message: error.statusCode ? error.message : "Internal server error",
	});
};

// Mode A: Farmer Pickup Handlers
const markReadyForPickup = async (req, res) => {
	try {
		const result = await deliveryService.markSuborderReadyForPickup({
			actor: req.user,
			suborder_id: req.params.id,
			pickup_location: req.body.pickup_location,
			farmer_notes: req.body.farmer_notes,
		});

		return res.status(200).json({
			message: "Suborder marked ready for pickup",
			...result,
		});
	} catch (error) {
		return handleControllerError(res, "Mark ready for pickup failed", error, {
			userId: req.user && req.user.id,
			params: req.params,
		});
	}
};

const confirmPickup = async (req, res) => {
	try {
		const result = await deliveryService.confirmSuborderPickup({
			actor: req.user,
			suborder_id: req.params.id,
			pickup_code: req.body.pickup_code,
		});

		return res.status(200).json({
			message: "Pickup confirmed successfully",
			...result,
		});
	} catch (error) {
		return handleControllerError(res, "Confirm pickup failed", error, {
			userId: req.user && req.user.id,
			params: req.params,
		});
	}
};

// Mode B: Farmer Delivery Handlers
const dispatchFarmerDelivery = async (req, res) => {
	try {
		const result = await deliveryService.dispatchFarmerDelivery({
			actor: req.user,
			suborder_id: req.params.id,
			estimated_time: req.body.estimated_time,
			vehicle_info: req.body.vehicle_info,
			farmer_notes: req.body.farmer_notes,
		});

		return res.status(200).json({
			message: "Farmer delivery dispatched successfully",
			...result,
		});
	} catch (error) {
		return handleControllerError(res, "Dispatch farmer delivery failed", error, {
			userId: req.user && req.user.id,
			params: req.params,
		});
	}
};

const confirmFarmerDelivery = async (req, res) => {
	try {
		const result = await deliveryService.confirmFarmerDelivery({
			actor: req.user,
			suborder_id: req.params.id,
			confirmation_code: req.body.confirmation_code,
		});

		return res.status(200).json({
			message: "Delivery confirmed successfully",
			...result,
		});
	} catch (error) {
		return handleControllerError(res, "Confirm delivery failed", error, {
			userId: req.user && req.user.id,
			params: req.params,
		});
	}
};

// Mode C: Delivery Partner Pool Handlers
const getDeliveryPool = async (req, res) => {
	try {
		const poolItems = await deliveryService.getDeliveryPool();
		return res.status(200).json({
			pool: poolItems,
			count: poolItems.length,
		});
	} catch (error) {
		return handleControllerError(res, "Fetch delivery pool failed", error);
	}
};

const claimPoolDelivery = async (req, res) => {
	try {
		const result = await deliveryService.claimPoolDelivery({
			actor: req.user,
			suborder_id: req.params.id,
			estimated_time: req.body.estimated_time,
		});

		return res.status(200).json({
			message: "Delivery claimed successfully",
			...result,
		});
	} catch (error) {
		return handleControllerError(res, "Claim delivery failed", error, {
			userId: req.user && req.user.id,
			params: req.params,
		});
	}
};

const updatePartnerStatus = async (req, res) => {
	try {
		const result = await deliveryService.updatePartnerTransitStatus({
			actor: req.user,
			suborder_id: req.params.id,
			status: req.body.status,
			proof_image: req.body.proof_of_delivery_image_url || req.body.proof_image,
			notes: req.body.notes,
		});

		return res.status(200).json({
			message: "Delivery transit status updated",
			...result,
		});
	} catch (error) {
		return handleControllerError(res, "Update partner status failed", error, {
			userId: req.user && req.user.id,
			params: req.params,
		});
	}
};

// Tracking & Legacy Handlers
const trackSuborderDelivery = async (req, res) => {
	try {
		const delivery = await deliveryService.trackSuborderDelivery(req.params.id);
		return res.status(200).json({ delivery });
	} catch (error) {
		return handleControllerError(res, "Track suborder delivery failed", error, {
			params: req.params,
		});
	}
};

const assignDeliveryPartner = async (req, res) => {
	try {
		const delivery = await deliveryService.assignDelivery({
			actor: req.user,
			payload: req.body || {},
		});

		return res.status(201).json({
			message: "Delivery partner assigned successfully",
			delivery,
		});
	} catch (error) {
		return handleControllerError(res, "Assign delivery failed", error, {
			userId: req.user && req.user.id,
			body: req.body,
		});
	}
};

const updateDeliveryStatus = async (req, res) => {
	try {
		const payload = {
			...(req.body || {}),
			order_id: req.body && req.body.order_id ? req.body.order_id : undefined,
			delivery_id: req.params.id,
		};

		const delivery = await deliveryService.updateDeliveryStatus({
			actor: req.user,
			payload,
		});

		return res.status(200).json({
			message: "Delivery status updated successfully",
			delivery,
		});
	} catch (error) {
		return handleControllerError(res, "Update delivery status failed", error, {
			userId: req.user && req.user.id,
			params: req.params,
			body: req.body,
		});
	}
};

const trackDelivery = async (req, res) => {
	try {
		const order_id = req.params.order_id || req.params.orderId;
		const deliveries = await deliveryService.trackDelivery({
			actor: req.user,
			order_id,
		});

		return res.status(200).json({
			deliveries,
			delivery: Array.isArray(deliveries) ? deliveries[0] : deliveries,
		});
	} catch (error) {
		return handleControllerError(res, "Track delivery failed", error, {
			userId: req.user && req.user.id,
			params: req.params,
		});
	}
};

const getAssignedDeliveries = async (req, res) => {
	try {
		const deliveries = await deliveryService.getAssignedDeliveries({
			actor: req.user,
		});

		return res.status(200).json({
			deliveries,
		});
	} catch (error) {
		return handleControllerError(res, "Get assigned deliveries failed", error, {
			userId: req.user && req.user.id,
		});
	}
};

module.exports = {
	assignDeliveryPartner,
	claimPoolDelivery,
	confirmFarmerDelivery,
	confirmPickup,
	dispatchFarmerDelivery,
	getAssignedDeliveries,
	getDeliveryPool,
	markReadyForPickup,
	trackDelivery,
	trackSuborderDelivery,
	updateDeliveryStatus,
	updatePartnerStatus,
};
