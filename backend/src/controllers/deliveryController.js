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
			confirmation_code: req.body.confirmation_code,
			pickup_code: req.body.pickup_code,
		});

		return res.status(200).json({
			message: result.message || "Delivery transit status updated",
			...result,
		});
	} catch (error) {
		return handleControllerError(res, "Update partner status failed", error, {
			userId: req.user && req.user.id,
			params: req.params,
		});
	}
};

const estimateCheckoutDelivery = async (req, res) => {
	try {
		const result = await deliveryService.estimateCheckoutDelivery({
			buyer_id: req.user.id,
			delivery_address: req.body?.delivery_address,
			fulfillment_selections: req.body?.fulfillment_selections || {},
		});
		return res.status(200).json(result);
	} catch (error) {
		return handleControllerError(res, "Estimate delivery failed", error, {
			userId: req.user && req.user.id,
		});
	}
};

const getMyPartnerProfile = async (req, res) => {
	try {
		const profile = await deliveryService.getMyPartnerProfile(req.user);
		return res.status(200).json({ profile });
	} catch (error) {
		return handleControllerError(res, "Fetch partner profile failed", error, {
			userId: req.user && req.user.id,
		});
	}
};

const submitMyPartnerProfile = async (req, res) => {
	try {
		const profile = await deliveryService.submitMyPartnerProfile({
			actor: req.user,
			payload: req.body || {},
		});
		return res.status(200).json({
			message: "Verification details submitted for Admin approval",
			profile,
		});
	} catch (error) {
		return handleControllerError(res, "Submit partner profile failed", error, {
			userId: req.user && req.user.id,
		});
	}
};

const postCheckpoint = async (req, res) => {
	try {
		const result = await deliveryService.postDeliveryCheckpoint({
			actor: req.user,
			suborder_id: req.params.id,
			location_name: req.body?.location_name,
			latitude: req.body?.latitude ?? null,
			longitude: req.body?.longitude ?? null,
			estimated_time: req.body?.estimated_time || null,
			notes: req.body?.notes || null,
		});
		return res.status(200).json({
			message: "Route checkpoint logged",
			...result,
		});
	} catch (error) {
		return handleControllerError(res, "Post checkpoint failed", error, {
			userId: req.user && req.user.id,
			params: req.params,
		});
	}
};

const rateSuborderDelivery = async (req, res) => {
	try {
		const result = await deliveryService.rateSuborderDelivery({
			actor: req.user,
			suborder_id: req.params.id,
			rating: req.body?.rating,
			feedback: req.body?.feedback,
		});
		return res.status(200).json(result);
	} catch (error) {
		return handleControllerError(res, "Rate delivery failed", error, {
			userId: req.user && req.user.id,
			params: req.params,
		});
	}
};

// Tracking & Legacy Handlers
const trackSuborderDelivery = async (req, res) => {
	try {
		const delivery = await deliveryService.trackSuborderDelivery(req.params.id, req.user);
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
	estimateCheckoutDelivery,
	getAssignedDeliveries,
	getDeliveryPool,
	getMyPartnerProfile,
	markReadyForPickup,
	postCheckpoint,
	rateSuborderDelivery,
	submitMyPartnerProfile,
	trackDelivery,
	trackSuborderDelivery,
	updateDeliveryStatus,
	updatePartnerStatus,
};
