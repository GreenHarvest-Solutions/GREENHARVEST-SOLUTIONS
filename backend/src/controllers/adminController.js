const logger = require("../utils/logger");
const adminService = require("../services/adminService");

const handleControllerError = (res, context, error, meta = {}) => {
	logger.error(context, {
		message: error.message,
		code: error.code,
		stack: error.stack,
		...meta,
	});

	const statusCode = error.statusCode || 500;
	return res.status(statusCode).json({
		status: "error",
		message: error.message || "Internal server error",
	});
};

const getAdminMe = async (req, res) => {
	try {
		const profile = await adminService.getAdminMe(req.user.user_id || req.user.id);
		if (!profile) {
			return res.status(404).json({
				status: "error",
				message: "Admin profile not found",
			});
		}

		return res.status(200).json({
			status: "success",
			admin: profile,
		});
	} catch (error) {
		return handleControllerError(res, "Get admin profile failed", error, {
			userId: req.user?.id,
		});
	}
};

const getAdminDashboard = async (req, res) => {
	try {
		const analytics = await adminService.getDashboardAnalytics();

		return res.status(200).json({
			metrics: analytics,
		});
	} catch (error) {
		return handleControllerError(res, "Get admin dashboard failed", error, {
			userId: req.user?.id,
		});
	}
};

const getFarmersKYC = async (req, res) => {
	try {
		const { page, limit, search } = req.query;
		const result = await adminService.getPendingFarmers({
			page: page ? parseInt(page, 10) : 1,
			limit: limit ? parseInt(limit, 10) : 20,
			search: search || "",
		});
		return res.status(200).json(result);
	} catch (error) {
		return handleControllerError(res, "Get farmers KYC failed", error);
	}
};

const verifyFarmer = async (req, res) => {
	try {
		const { id } = req.params;
		const { is_verified, reason } = req.body;
		if (is_verified === undefined) {
			return res.status(400).json({
				status: "error",
				message: "is_verified boolean parameter is required",
			});
		}

		const updated = await adminService.verifyFarmer(
			id,
			Boolean(is_verified),
			req.user.id,
			reason
		);

		return res.status(200).json({
			message: Boolean(is_verified)
				? "Farmer store verified successfully"
				: "Farmer store verification rejected",
			farmer: updated,
		});
	} catch (error) {
		return handleControllerError(res, "Verify farmer failed", error);
	}
};

const getProductsModeration = async (req, res) => {
	try {
		const { page, limit, search, status } = req.query;
		const result = await adminService.getProductsForModeration({
			page: page ? parseInt(page, 10) : 1,
			limit: limit ? parseInt(limit, 10) : 20,
			search: search || "",
			status: status || "all",
		});
		return res.status(200).json(result);
	} catch (error) {
		return handleControllerError(res, "Get products for moderation failed", error);
	}
};

const moderateProduct = async (req, res) => {
	try {
		const { id } = req.params;
		const { status, reason } = req.body;
		const validStatuses = ["active", "draft", "deactivated"];

		if (!status || !validStatuses.includes(status)) {
			return res.status(400).json({
				status: "error",
				message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
			});
		}

		const updated = await adminService.moderateProduct(
			id,
			status,
			req.user.id,
			reason
		);

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
		const { page, limit, search, status } = req.query;
		const result = await adminService.getDisputes({
			page: page ? parseInt(page, 10) : 1,
			limit: limit ? parseInt(limit, 10) : 20,
			search: search || "",
			status: status || "all",
		});
		return res.status(200).json(result);
	} catch (error) {
		return handleControllerError(res, "Get disputes failed", error);
	}
};

const resolveDispute = async (req, res) => {
	try {
		const { id } = req.params;
		const { action, reason } = req.body;
		const validActions = ["refund", "accept", "resolve", "reject"];

		if (!action || !validActions.includes(action)) {
			return res.status(400).json({
				status: "error",
				message: `Invalid resolution action. Must be one of: ${validActions.join(", ")}`,
			});
		}

		const updated = await adminService.resolveDispute(
			id,
			action,
			req.user.id,
			reason
		);

		if (!updated) {
			return res.status(404).json({
				status: "error",
				message: `Dispute case ${id} not found`,
			});
		}

		return res.status(200).json({
			message:
				action === "refund" || action === "accept"
					? "Refund approved and escrow released"
					: "Dispute resolved without refund",
			dispute: updated,
		});
	} catch (error) {
		return handleControllerError(res, "Resolve dispute failed", error);
	}
};

const broadcastAnnouncement = async (req, res) => {
	try {
		const { message, targetAudience = "all", title = "Platform Advisory" } = req.body;
		if (!message || !message.trim()) {
			return res.status(400).json({
				status: "error",
				message: "Broadcast message is required",
			});
		}

		const validAudiences = ["all", "farmers", "buyers", "logistics"];
		if (!validAudiences.includes(targetAudience)) {
			return res.status(400).json({
				status: "error",
				message: `Invalid target audience. Allowed: ${validAudiences.join(", ")}`,
			});
		}

		const result = await adminService.broadcastAnnouncement(
			req.user.id,
			message.trim(),
			targetAudience,
			title
		);

		return res.status(200).json({
			message: `Notice broadcasted successfully to ${targetAudience} audience`,
			delivered_count: result.delivered_count,
			announcement: result,
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
		const newShipment = await adminService.assignDispatchBatch(req.body, req.user.id);
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
		const rerouted = await adminService.emergencyRerouteTruck(id, req.body, req.user.id);
		return res.status(200).json({
			message: `Emergency cold-chain diversion executed for ${id}. Driver notified.`,
			shipment: rerouted,
		});
	} catch (error) {
		return handleControllerError(res, "Emergency reroute truck failed", error);
	}
};

const getRegionalAnalytics = async (req, res) => {
	try {
		const analytics = await adminService.getRegionalAnalytics(
			req.query.limit ? parseInt(req.query.limit, 10) : 10
		);
		return res.status(200).json({ analytics });
	} catch (error) {
		return handleControllerError(res, "Get regional analytics failed", error);
	}
};

const updateUserStatus = async (req, res) => {
	try {
		const { id } = req.params;
		const { status, reason } = req.body;
		const validStatuses = ["active", "pending", "suspended", "banned", "deactivated"];

		if (!status || !validStatuses.includes(status)) {
			return res.status(400).json({
				status: "error",
				message: `Invalid account status: ${status}. Must be one of: ${validStatuses.join(", ")}`,
			});
		}

		const updated = await adminService.updateUserStatus(
			id,
			status,
			req.user.id,
			reason
		);

		return res.status(200).json({
			message: `User ${id} status updated to ${status} successfully`,
			user: updated,
		});
	} catch (error) {
		return handleControllerError(res, "Update user status failed", error);
	}
};

// ════════════════ Platform Settings ════════════════

const getPlatformSettings = async (req, res) => {
	try {
		const data = await adminService.getPlatformSettings();
		return res.status(200).json(data);
	} catch (error) {
		return handleControllerError(res, "Get platform settings failed", error);
	}
};

const updatePlatformSettings = async (req, res) => {
	try {
		const settings = req.body;
		if (!settings || typeof settings !== "object" || Object.keys(settings).length === 0) {
			return res.status(400).json({
				status: "error",
				message: "Valid settings payload is required",
			});
		}

		const updated = await adminService.updatePlatformSettings(settings, req.user.id);
		return res.status(200).json({
			message: "Platform settings updated successfully",
			...updated,
		});
	} catch (error) {
		return handleControllerError(res, "Update platform settings failed", error);
	}
};

const getSettingsHistory = async (req, res) => {
	try {
		const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
		const history = await adminService.getSettingsHistory(limit);
		return res.status(200).json({ history });
	} catch (error) {
		return handleControllerError(res, "Get settings history failed", error);
	}
};

// ════════════════ Audit Logs ════════════════

const getAuditLogs = async (req, res) => {
	try {
		const {
			actor_id,
			action,
			entity_type,
			entity_id,
			search,
			from,
			to,
			page,
			limit,
		} = req.query;

		const result = await adminService.getAuditLogs({
			actorId: actor_id,
			action,
			entityType: entity_type,
			entityId: entity_id,
			search,
			fromDate: from,
			toDate: to,
			page: page ? parseInt(page, 10) : 1,
			limit: limit ? parseInt(limit, 10) : 20,
		});

		return res.status(200).json(result);
	} catch (error) {
		return handleControllerError(res, "Get audit logs failed", error);
	}
};

// ════════════════ Admin Team & Roles ════════════════

const getAdminTeam = async (req, res) => {
	try {
		const team = await adminService.getAdminTeam();
		return res.status(200).json({ team });
	} catch (error) {
		return handleControllerError(res, "Get admin team failed", error);
	}
};

const getAdminRoles = async (req, res) => {
	try {
		const roles = await adminService.getAdminRoles();
		return res.status(200).json({ roles });
	} catch (error) {
		return handleControllerError(res, "Get admin roles failed", error);
	}
};

const updateAdminRole = async (req, res) => {
	try {
		const { id } = req.params;
		const { admin_role_id } = req.body;

		if (!admin_role_id) {
			return res.status(400).json({
				status: "error",
				message: "admin_role_id is required",
			});
		}

		const updated = await adminService.updateAdminRole(
			id,
			parseInt(admin_role_id, 10),
			req.user.id
		);

		return res.status(200).json({
			message: `Admin user role updated successfully`,
			user: updated,
		});
	} catch (error) {
		return handleControllerError(res, "Update admin role failed", error);
	}
};

module.exports = {
	getAdminMe,
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
	getRegionalAnalytics,
	updateUserStatus,
	getPlatformSettings,
	updatePlatformSettings,
	getSettingsHistory,
	getAuditLogs,
	getAdminTeam,
	getAdminRoles,
	updateAdminRole,
};
