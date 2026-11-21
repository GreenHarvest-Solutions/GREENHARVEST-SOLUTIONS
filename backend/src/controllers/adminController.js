const logger = require("../utils/logger");
const adminService = require("../services/adminService");

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

const getAdminDashboard = async (req, res) => {
	try {
		const analytics = await adminService.getDashboardAnalytics();

		return res.status(200).json({
			metrics: analytics,
		});
	} catch (error) {
		return handleControllerError(res, "Get admin dashboard failed", error, {
			userId: req.user && req.user.id,
		});
	}
};

const getFarmersKYC = async (req, res) => {
	try {
		const farmers = await adminService.getPendingFarmers();
		return res.status(200).json({ farmers });
	} catch (error) {
		return handleControllerError(res, "Get farmers KYC failed", error);
	}
};

const verifyFarmer = async (req, res) => {
	try {
		const { id } = req.params;
		const { is_verified } = req.body;
		const updated = await adminService.verifyFarmer(id, is_verified !== false);

		return res.status(200).json({
			message: is_verified !== false ? "Farmer store verified successfully" : "Farmer store verification rejected",
			farmer: updated,
		});
	} catch (error) {
		return handleControllerError(res, "Verify farmer failed", error);
	}
};

const getProductsModeration = async (req, res) => {
	try {
		const products = await adminService.getProductsForModeration();
		return res.status(200).json({ products });
	} catch (error) {
		return handleControllerError(res, "Get products for moderation failed", error);
	}
};

const moderateProduct = async (req, res) => {
	try {
		const { id } = req.params;
		const { status } = req.body;
		const updated = await adminService.moderateProduct(id, status);

		return res.status(200).json({
			message: `Product status updated to ${status}`,
			product: updated,
		});
	} catch (error) {
		return handleControllerError(res, "Moderate product failed", error);
	}
};

const getDisputes = async (req, res) => {
	try {
		const disputes = await adminService.getDisputes();
		return res.status(200).json({ disputes });
	} catch (error) {
		return handleControllerError(res, "Get disputes failed", error);
	}
};

const resolveDispute = async (req, res) => {
	try {
		const { id } = req.params;
		const { action } = req.body;
		const updated = await adminService.resolveDispute(id, action);

		return res.status(200).json({
			message: action === 'refund' || action === 'accept' ? "Refund approved and escrow released" : "Dispute resolved without refund",
			dispute: updated,
		});
	} catch (error) {
		return handleControllerError(res, "Resolve dispute failed", error);
	}
};

const broadcastAnnouncement = async (req, res) => {
	try {
		const { message } = req.body;
		if (!message || !message.trim()) {
			return res.status(400).json({ message: "Broadcast message is required" });
		}

		const result = await adminService.broadcastAnnouncement(req.user.id, message.trim());
		return res.status(200).json({
			message: "Notice broadcasted successfully to all platform participants",
			delivered_count: result.delivered_count,
		});
	} catch (error) {
		return handleControllerError(res, "Broadcast announcement failed", error);
	}
};

const getFleetShipments = async (req, res) => {
	try {
		const shipments = await adminService.getFleetShipments(req.query);
		return res.status(200).json({ shipments });
	} catch (error) {
		return handleControllerError(res, "Get fleet shipments failed", error);
	}
};

const assignDispatchBatch = async (req, res) => {
	try {
		const newShipment = await adminService.assignDispatchBatch(req.body);
		return res.status(201).json({
			message: "Produce batch assigned and dispatched to refrigerated carrier successfully",
			shipment: newShipment,
		});
	} catch (error) {
		return handleControllerError(res, "Assign dispatch batch failed", error);
	}
};

const emergencyRerouteTruck = async (req, res) => {
	try {
		const { id } = req.params;
		const rerouted = await adminService.emergencyRerouteTruck(id, req.body);
		return res.status(200).json({
			message: `Emergency cold-chain diversion executed for ${id}. Driver notified.`,
			shipment: rerouted,
		});
	} catch (error) {
		return handleControllerError(res, "Emergency reroute truck failed", error);
	}
};

module.exports = {
	getAdminDashboard,
	getFarmersKYC,
	verifyFarmer,
	getProductsModeration,
	moderateProduct,
	getDisputes,
	resolveDispute,
	broadcastAnnouncement,
	getFleetShipments,
	assignDispatchBatch,
	emergencyRerouteTruck,
};
