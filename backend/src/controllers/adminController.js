const logger = require("../utils/logger");
const adminService = require("../services/adminService");
const intelligenceService = require("../services/intelligenceService");

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
		const { status, carrier, temp_status, search, page, limit } = req.query;
		const result = await adminService.getFleetShipmentsAdmin({
			status,
			carrier,
			temp_status,
			search,
			page: parseInt(page) || 1,
			limit: parseInt(limit) || 20,
		});
		return res.status(200).json(result);
	} catch (error) {
		return handleControllerError(res, "Get fleet shipments failed", error);
	}
};

const getShipmentById = async (req, res) => {
	try {
		const { id } = req.params;
		const dossier = await adminService.getShipmentDossier(id);
		if (!dossier) {
			return res.status(404).json({ status: "error", message: `Shipment #${id} not found` });
		}
		return res.status(200).json({ shipment: dossier });
	} catch (error) {
		return handleControllerError(res, "Get shipment telemetry dossier failed", error);
	}
};

const assignDispatchBatch = async (req, res) => {
	try {
		const newShipment = await adminService.assignDispatchBatch(
			req.body,
			req.user.id,
			req.ip || req.headers["x-forwarded-for"],
			req.headers["user-agent"]
		);
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
		const rerouted = await adminService.emergencyRerouteTruck(
			id,
			req.body,
			req.user.id,
			req.ip || req.headers["x-forwarded-for"],
			req.headers["user-agent"]
		);
		if (!rerouted) {
			return res.status(404).json({ status: "error", message: `Shipment #${id} not found` });
		}
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

// ============================================================================
// Phase 1 Controllers: KYC, User 360, Products, Categories, Reviews, Pricing
// ============================================================================

const getKycQueue = async (req, res) => {
	try {
		const { page, limit, status, search, tier, region } = req.query;
		const result = await adminService.getKycQueue({
			page: page ? parseInt(page, 10) : 1,
			limit: limit ? parseInt(limit, 10) : 20,
			status: status || "all",
			search: search || "",
			tier: tier || "all",
			region: region || "all",
		});
		return res.status(200).json(result);
	} catch (error) {
		return handleControllerError(res, "Get KYC queue failed", error);
	}
};

const getKycDossier = async (req, res) => {
	try {
		const { id } = req.params;
		const dossier = await adminService.getKycDossier(id);
		if (!dossier) {
			return res.status(404).json({ status: "error", message: `Farmer #${id} not found` });
		}
		return res.status(200).json(dossier);
	} catch (error) {
		return handleControllerError(res, "Get KYC dossier failed", error);
	}
};

const getKycIntelligence = async (req, res) => {
	try {
		const { id } = req.params;
		const dossier = await adminService.getKycDossier(id);
		if (!dossier || !dossier.farmer) {
			return res.status(404).json({ status: "error", message: `Farmer #${id} not found` });
		}

		const { farmer, documents = [] } = dossier;
		const identityDoc = documents.find(
			(d) => d.document_category === "identity" || d.document_type === "national_id" || d.id_hash
		) || documents[0];

		const duplicateDetection = await intelligenceService.checkIdentityDuplicates({
			farmerId: farmer.id,
			name: farmer.name,
			idNumber: farmer.id_number || identityDoc?.extracted_data?.id_number,
			idHash: identityDoc?.id_hash,
			region: farmer.region,
			woreda: farmer.woreda,
			kebele: farmer.kebele,
		});

		return res.status(200).json({
			farmer_id: farmer.id,
			name: farmer.name,
			ocr_data: identityDoc?.extracted_data || {},
			ocr_raw_text: identityDoc?.ocr_raw_text || null,
			ocr_confidence: identityDoc?.ocr_confidence || 0,
			id_hash: identityDoc?.id_hash || null,
			duplicate_detection: duplicateDetection,
			risk_flags: dossier.riskFlags || [],
		});
	} catch (error) {
		return handleControllerError(res, "Get KYC intelligence failed", error);
	}
};

const addKycDocument = async (req, res) => {
	try {
		const { id } = req.params;
		const { document_type, expires_at } = req.body;

		let documentUrl = req.body.document_url;
		let publicId = req.body.public_id || null;

		if (req.file) {
			documentUrl = req.file.path;
			publicId = req.file.filename;
		}

		if (!documentUrl) {
			return res.status(400).json({ status: "error", message: "Document file or document_url is required" });
		}

		if (!document_type) {
			return res.status(400).json({ status: "error", message: "document_type is required" });
		}

		const doc = await adminService.addKycDocument({
			userId: id,
			documentType: document_type,
			documentUrl,
			publicId,
			expiresAt: expires_at || null,
			reviewerId: req.user.id,
			actorId: req.user.id,
			ipAddress: req.ip || req.headers["x-forwarded-for"],
			userAgent: req.headers["user-agent"],
		});

		return res.status(201).json({ message: "Document attached successfully", document: doc });
	} catch (error) {
		return handleControllerError(res, "Add KYC document failed", error);
	}
};

const deleteKycDocument = async (req, res) => {
	try {
		const { documentId } = req.params;
		const deleted = await adminService.deleteKycDocument({
			documentId,
			actorId: req.user.id,
			ipAddress: req.ip || req.headers["x-forwarded-for"],
			userAgent: req.headers["user-agent"],
		});

		if (!deleted) {
			return res.status(404).json({ status: "error", message: "Document not found" });
		}

		return res.status(200).json({ message: "Document deleted successfully", document: deleted });
	} catch (error) {
		return handleControllerError(res, "Delete KYC document failed", error);
	}
};

const addFieldVisit = async (req, res) => {
	try {
		const { id } = req.params;
		const { findings, visit_date, gps_coordinates, verified_crops, recommendation } = req.body;

		if (!findings) {
			return res.status(400).json({ status: "error", message: "findings are required" });
		}

		const visit = await adminService.addFieldVisit({
			farmerId: id,
			agentId: req.user.id,
			visitDate: visit_date || new Date(),
			findings,
			gpsCoordinates: gps_coordinates || null,
			verifiedCrops: verified_crops || null,
			recommendation: recommendation || "approve",
			actorId: req.user.id,
			ipAddress: req.ip || req.headers["x-forwarded-for"],
			userAgent: req.headers["user-agent"],
		});

		return res.status(201).json({ message: "Field visit recorded successfully", visit });
	} catch (error) {
		return handleControllerError(res, "Add field visit failed", error);
	}
};

const reviewKyc = async (req, res) => {
	try {
		const { id } = req.params;
		const { decision, tier, reason, notes } = req.body;

		const validDecisions = ["approve", "reject", "request_info", "under_review"];
		if (!validDecisions.includes(decision)) {
			return res.status(400).json({
				status: "error",
				message: `Invalid decision. Must be one of: ${validDecisions.join(", ")}`,
			});
		}

		if ((decision === "reject" || decision === "request_info") && !reason && !notes) {
			return res.status(400).json({
				status: "error",
				message: "A reason or notes must be provided when rejecting or requesting info",
			});
		}

		const result = await adminService.reviewKyc({
			farmerId: id,
			decision,
			tier: tier || "tier_1",
			reason,
			notes,
			actorId: req.user.id,
			ipAddress: req.ip || req.headers["x-forwarded-for"],
			userAgent: req.headers["user-agent"],
		});

		return res.status(200).json({
			message: `Farmer KYC ${decision} action applied successfully`,
			result,
		});
	} catch (error) {
		return handleControllerError(res, "Review KYC failed", error);
	}
};

const getKycHistory = async (req, res) => {
	try {
		const { id } = req.params;
		const history = await adminService.getKycHistory(id);
		return res.status(200).json({ history });
	} catch (error) {
		return handleControllerError(res, "Get KYC history failed", error);
	}
};

const getUser360 = async (req, res) => {
	try {
		const { id } = req.params;
		const user360 = await adminService.getUser360(id);
		if (!user360) {
			return res.status(404).json({ status: "error", message: `User #${id} not found` });
		}
		return res.status(200).json(user360);
	} catch (error) {
		return handleControllerError(res, "Get User 360 failed", error);
	}
};

const performUserAction = async (req, res) => {
	try {
		const { id } = req.params;
		const { action, payload } = req.body;

		if (!action) {
			return res.status(400).json({ status: "error", message: "action is required" });
		}

		const result = await adminService.performUserAction({
			userId: id,
			action,
			payload: payload || {},
			actorId: req.user.id,
			ipAddress: req.ip || req.headers["x-forwarded-for"],
			userAgent: req.headers["user-agent"],
		});

		return res.status(200).json(result);
	} catch (error) {
		return handleControllerError(res, "Perform user action failed", error);
	}
};

const getProductsAdmin = async (req, res) => {
	try {
		const { page, limit, search, status, moderation_status, category, farmer, min_price, max_price } = req.query;
		const result = await adminService.getProductsAdmin({
			page: page ? parseInt(page, 10) : 1,
			limit: limit ? parseInt(limit, 10) : 20,
			search: search || "",
			status: status || "",
			moderation_status: moderation_status || "all",
			category: category || "",
			farmer: farmer || "",
			min_price: min_price || null,
			max_price: max_price || null,
		});
		return res.status(200).json(result);
	} catch (error) {
		return handleControllerError(res, "Get products admin failed", error);
	}
};

const getProductDossier = async (req, res) => {
	try {
		const { id } = req.params;
		const dossier = await adminService.getProductDossier(id);
		if (!dossier) {
			return res.status(404).json({ status: "error", message: `Product #${id} not found` });
		}
		return res.status(200).json(dossier);
	} catch (error) {
		return handleControllerError(res, "Get product dossier failed", error);
	}
};

const moderateProductAdmin = async (req, res) => {
	try {
		const { id } = req.params;
		const { action, reason, notes, grade, cold_chain_required } = req.body;

		const validActions = ["approve", "reject", "request_changes", "deactivate"];
		if (!validActions.includes(action)) {
			return res.status(400).json({
				status: "error",
				message: `Invalid action. Must be one of: ${validActions.join(", ")}`,
			});
		}

		if ((action === "reject" || action === "request_changes") && !reason && !notes) {
			return res.status(400).json({
				status: "error",
				message: "A reason or notes must be provided when rejecting or requesting changes",
			});
		}

		const result = await adminService.moderateProductAdmin({
			productId: id,
			action,
			reason,
			notes,
			grade,
			cold_chain_required,
			actorId: req.user.id,
			ipAddress: req.ip || req.headers["x-forwarded-for"],
			userAgent: req.headers["user-agent"],
		});

		return res.status(200).json({
			message: `Product ${action} action applied successfully`,
			result,
		});
	} catch (error) {
		return handleControllerError(res, "Moderate product failed", error);
	}
};

const bulkModerateProducts = async (req, res) => {
	try {
		const { product_ids, action, reason, notes } = req.body;

		if (!Array.isArray(product_ids) || product_ids.length === 0) {
			return res.status(400).json({ status: "error", message: "product_ids array is required" });
		}

		const validActions = ["approve", "reject", "deactivate"];
		if (!validActions.includes(action)) {
			return res.status(400).json({
				status: "error",
				message: `Invalid action for bulk moderation: ${action}`,
			});
		}

		const result = await adminService.bulkModerateProducts({
			productIds: product_ids,
			action,
			reason,
			notes,
			actorId: req.user.id,
			ipAddress: req.ip || req.headers["x-forwarded-for"],
			userAgent: req.headers["user-agent"],
		});

		return res.status(200).json(result);
	} catch (error) {
		return handleControllerError(res, "Bulk moderate products failed", error);
	}
};

const getProductModerationHistory = async (req, res) => {
	try {
		const { id } = req.params;
		const history = await adminService.getProductModerationHistory(id);
		return res.status(200).json({ history });
	} catch (error) {
		return handleControllerError(res, "Get product moderation history failed", error);
	}
};

const getProductRevisionsAdmin = async (req, res) => {
	try {
		const { id } = req.params;
		const revisions = await adminService.getProductRevisions(id);
		return res.status(200).json({ revisions });
	} catch (error) {
		return handleControllerError(res, "Get product revisions failed", error);
	}
};

const reviewProductRevisionAdmin = async (req, res) => {
	try {
		const { revisionId } = req.params;
		const { decision, feedback } = req.body;
		if (!["approve", "reject"].includes(decision)) {
			return res.status(400).json({ status: "error", message: "Decision must be 'approve' or 'reject'" });
		}
		const result = await adminService.reviewProductRevision({
			revisionId,
			decision,
			feedback,
			reviewerId: req.user.id,
		});
		return res.status(200).json({
			message: `Revision ${decision}d successfully`,
			result,
		});
	} catch (error) {
		return handleControllerError(res, "Review product revision failed", error);
	}
};

const getCategoriesAdmin = async (req, res) => {
	try {
		const categories = await adminService.getCategoriesAdmin();
		return res.status(200).json({ categories });
	} catch (error) {
		return handleControllerError(res, "Get categories failed", error);
	}
};

const createCategoryAdmin = async (req, res) => {
	try {
		const { name, description, icon, attributes } = req.body;
		if (!name || name.trim() === "") {
			return res.status(400).json({ status: "error", message: "Category name is required" });
		}

		const category = await adminService.createCategoryAdmin({
			name: name.trim(),
			description: description || null,
			icon: icon || null,
			attributes: Array.isArray(attributes) ? attributes : [],
			actorId: req.user.id,
		});

		return res.status(201).json({ message: "Category created successfully", category });
	} catch (error) {
		return handleControllerError(res, "Create category failed", error);
	}
};

const updateCategoryAdmin = async (req, res) => {
	try {
		const { id } = req.params;
		const { name, description, icon, is_active, attributes } = req.body;

		const category = await adminService.updateCategoryAdmin({
			id,
			name,
			description,
			icon,
			is_active,
			attributes,
			actorId: req.user.id,
		});

		return res.status(200).json({ message: "Category updated successfully", category });
	} catch (error) {
		return handleControllerError(res, "Update category failed", error);
	}
};

const deleteCategoryAdmin = async (req, res) => {
	try {
		const { id } = req.params;
		const result = await adminService.deleteCategoryAdmin(id, req.user.id);
		return res.status(200).json({ message: "Category deleted successfully", result });
	} catch (error) {
		return handleControllerError(res, "Delete category failed", error);
	}
};

const getReviewsAdmin = async (req, res) => {
	try {
		const { page, limit, search, is_hidden, rating } = req.query;
		const result = await adminService.getReviewsAdmin({
			page: page ? parseInt(page, 10) : 1,
			limit: limit ? parseInt(limit, 10) : 20,
			search: search || "",
			is_hidden: is_hidden !== undefined ? is_hidden : null,
			rating: rating || null,
		});
		return res.status(200).json(result);
	} catch (error) {
		return handleControllerError(res, "Get reviews failed", error);
	}
};

const moderateReviewAdmin = async (req, res) => {
	try {
		const { id } = req.params;
		const { is_hidden, reason } = req.body;

		if (is_hidden === undefined) {
			return res.status(400).json({ status: "error", message: "is_hidden boolean is required" });
		}

		const review = await adminService.moderateReviewAdmin({
			reviewId: id,
			is_hidden,
			reason: reason || null,
			actorId: req.user.id,
		});

		return res.status(200).json({ message: "Review updated successfully", review });
	} catch (error) {
		return handleControllerError(res, "Moderate review failed", error);
	}
};

const getCampaignsAdmin = async (req, res) => {
	try {
		const { page, limit, status, search } = req.query;
		const result = await adminService.getCampaignsAdmin({
			page: page ? parseInt(page, 10) : 1,
			limit: limit ? parseInt(limit, 10) : 20,
			status: status || "all",
			search: search || "",
		});
		return res.status(200).json(result);
	} catch (error) {
		return handleControllerError(res, "Get campaigns failed", error);
	}
};

const moderateCampaignAdmin = async (req, res) => {
	try {
		const { id } = req.params;
		const { action, reason, budget_cap } = req.body;

		const validActions = ["approve", "reject", "pause"];
		if (!validActions.includes(action)) {
			return res.status(400).json({
				status: "error",
				message: `Invalid campaign action. Must be one of: ${validActions.join(", ")}`,
			});
		}

		const campaign = await adminService.moderateCampaignAdmin({
			campaignId: id,
			action,
			reason,
			budget_cap: budget_cap ? parseFloat(budget_cap) : null,
			actorId: req.user.id,
		});

		return res.status(200).json({ message: `Campaign ${action} action applied successfully`, campaign });
	} catch (error) {
		return handleControllerError(res, "Moderate campaign failed", error);
	}
};

const getPriceCorridors = async (req, res) => {
	try {
		const { region, commodity } = req.query;
		const corridors = await adminService.getPriceCorridors({ region, commodity });
		return res.status(200).json({ corridors });
	} catch (error) {
		return handleControllerError(res, "Get price corridors failed", error);
	}
};

const upsertPriceCorridor = async (req, res) => {
	try {
		const { commodity_name, region, min_price, max_price, target_price, unit, deviation_threshold_pct } = req.body;

		if (!commodity_name || !region || min_price === undefined || max_price === undefined || target_price === undefined) {
			return res.status(400).json({
				status: "error",
				message: "commodity_name, region, min_price, max_price, and target_price are required",
			});
		}

		const corridor = await adminService.upsertPriceCorridor({
			commodity_name,
			region,
			min_price: parseFloat(min_price),
			max_price: parseFloat(max_price),
			target_price: parseFloat(target_price),
			unit: unit || "kg",
			deviation_threshold_pct: deviation_threshold_pct ? parseFloat(deviation_threshold_pct) : 15.0,
			actorId: req.user.id,
		});

		return res.status(200).json({ message: "Price corridor saved successfully", corridor });
	} catch (error) {
		return handleControllerError(res, "Upsert price corridor failed", error);
	}
};

const getPriceOutliers = async (req, res) => {
	try {
		const outliers = await adminService.getPriceOutliers();
		return res.status(200).json({ outliers });
	} catch (error) {
		return handleControllerError(res, "Get price outliers failed", error);
	}
};

const evaluateProductPricing = async (req, res) => {
	try {
		const { id } = req.params;
		const result = await adminService.evaluateProductPricing(id);
		return res.status(200).json(result);
	} catch (error) {
		return handleControllerError(res, "Evaluate product pricing failed", error);
	}
};

// ==========================================
// --- Phase 2: Commerce, Orders, Payments, Escrow, Disputes Controllers ---
// ==========================================

const getOrders = async (req, res) => {
	try {
		const { status, payment_status, delivery_status, search, from, to, page, limit } = req.query;
		const result = await adminService.getOrdersAdmin({
			status,
			payment_status,
			delivery_status,
			search,
			from,
			to,
			page: parseInt(page) || 1,
			limit: parseInt(limit) || 20,
		});
		return res.status(200).json(result);
	} catch (error) {
		return handleControllerError(res, "Get orders failed", error);
	}
};

const getOrderById = async (req, res) => {
	try {
		const { id } = req.params;
		const dossier = await adminService.getOrderDossier(id);
		if (!dossier) {
			return res.status(404).json({ status: "error", message: `Order #${id} not found` });
		}
		return res.status(200).json({ order: dossier });
	} catch (error) {
		return handleControllerError(res, "Get order details failed", error);
	}
};

const updateOrderStatus = async (req, res) => {
	try {
		const { id } = req.params;
		const { status, reason } = req.body;

		if (!status) {
			return res.status(400).json({ status: "error", message: "status is required" });
		}
		if (!reason || !reason.trim()) {
			return res.status(400).json({ status: "error", message: "A justification reason is required for administrative status override" });
		}

		const validStatuses = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"];
		if (!validStatuses.includes(status)) {
			return res.status(400).json({
				status: "error",
				message: `Invalid order status. Must be one of: ${validStatuses.join(", ")}`,
			});
		}

		const updated = await adminService.updateOrderStatus(
			id,
			status,
			reason,
			req.user.id,
			req.ip || req.headers["x-forwarded-for"],
			req.headers["user-agent"]
		);

		if (!updated) {
			return res.status(404).json({ status: "error", message: `Order #${id} not found` });
		}

		return res.status(200).json({ message: "Order status overridden successfully", order: updated });
	} catch (error) {
		return handleControllerError(res, "Update order status failed", error);
	}
};

const refundOrder = async (req, res) => {
	try {
		const { id } = req.params;
		const { amount, reason, idempotencyKey, refundFull } = req.body;

		if (!reason || !reason.trim()) {
			return res.status(400).json({ status: "error", message: "A mandatory refund justification reason is required" });
		}

		if (!refundFull && (!amount || Number(amount) <= 0)) {
			return res.status(400).json({ status: "error", message: "Valid positive refund amount is required" });
		}

		const result = await adminService.refundOrder(
			id,
			{ amount, reason, idempotencyKey, refundFull: Boolean(refundFull) },
			req.user.id,
			req.ip || req.headers["x-forwarded-for"],
			req.headers["user-agent"]
		);

		if (!result.success) {
			return res.status(400).json({ status: "error", message: result.error });
		}

		return res.status(200).json({
			message: `Refund of ETB ${result.refundAmount.toFixed(2)} processed successfully`,
			result,
		});
	} catch (error) {
		return handleControllerError(res, "Order refund failed", error);
	}
};

const getPayments = async (req, res) => {
	try {
		const { status, method, from, to, search, page, limit } = req.query;
		const result = await adminService.getPaymentsAdmin({
			status,
			method,
			from,
			to,
			search,
			page: parseInt(page) || 1,
			limit: parseInt(limit) || 20,
		});
		return res.status(200).json(result);
	} catch (error) {
		return handleControllerError(res, "Get payments failed", error);
	}
};

const getPaymentById = async (req, res) => {
	try {
		const { id } = req.params;
		const dossier = await adminService.getPaymentDossier(id);
		if (!dossier) {
			return res.status(404).json({ status: "error", message: `Payment transaction #${id} not found` });
		}
		return res.status(200).json({ payment: dossier });
	} catch (error) {
		return handleControllerError(res, "Get payment details failed", error);
	}
};

const reconcilePayment = async (req, res) => {
	try {
		const { id } = req.params;
		const { status, notes } = req.body;

		const updated = await adminService.reconcilePayment(
			id,
			{ status: status || "reconciled", notes },
			req.user.id,
			req.ip || req.headers["x-forwarded-for"],
			req.headers["user-agent"]
		);

		if (!updated) {
			return res.status(404).json({ status: "error", message: `Payment #${id} not found` });
		}

		return res.status(200).json({ message: "Payment reconciliation recorded successfully", payment: updated });
	} catch (error) {
		return handleControllerError(res, "Reconcile payment failed", error);
	}
};

const getActiveEscrow = async (req, res) => {
	try {
		const { release_status, search, page, limit } = req.query;
		const result = await adminService.getActiveEscrowLedger({
			release_status,
			search,
			page: parseInt(page) || 1,
			limit: parseInt(limit) || 20,
		});
		return res.status(200).json(result);
	} catch (error) {
		return handleControllerError(res, "Get escrow clearinghouse failed", error);
	}
};

const releaseEscrow = async (req, res) => {
	try {
		const { id } = req.params;
		const { notes, makerCheckerApproved } = req.body;

		const result = await adminService.releaseEscrow(
			id,
			{ notes, makerCheckerApproved: Boolean(makerCheckerApproved) },
			req.user.id,
			req.ip || req.headers["x-forwarded-for"],
			req.headers["user-agent"]
		);

		if (!result.success) {
			return res.status(400).json({ status: "error", message: result.error });
		}

		return res.status(200).json({ message: "Escrow funds released to farmer successfully", escrow: result.escrow });
	} catch (error) {
		return handleControllerError(res, "Release escrow payout failed", error);
	}
};

const holdEscrow = async (req, res) => {
	try {
		const { id } = req.params;
		const { reason, holdDays } = req.body;

		if (!reason || !reason.trim()) {
			return res.status(400).json({ status: "error", message: "A freeze reason must be provided" });
		}

		const result = await adminService.holdEscrow(
			id,
			{ reason, holdDays: holdDays ? parseInt(holdDays) : 14 },
			req.user.id,
			req.ip || req.headers["x-forwarded-for"],
			req.headers["user-agent"]
		);

		if (!result.success) {
			return res.status(400).json({ status: "error", message: result.error });
		}

		return res.status(200).json({ message: "Escrow release frozen successfully", escrow: result.escrow });
	} catch (error) {
		return handleControllerError(res, "Freeze escrow hold failed", error);
	}
};

const getDisputesAdmin = async (req, res) => {
	try {
		const { status, category, search, page, limit } = req.query;
		const result = await adminService.getDisputesAdmin({
			status,
			category,
			search,
			page: parseInt(page) || 1,
			limit: parseInt(limit) || 20,
		});
		return res.status(200).json(result);
	} catch (error) {
		return handleControllerError(res, "Get disputes queue failed", error);
	}
};

const getDisputeById = async (req, res) => {
	try {
		const { id } = req.params;
		const dossier = await adminService.getDisputeDossier(id);
		if (!dossier) {
			return res.status(404).json({ status: "error", message: `Dispute claim #${id} not found` });
		}
		return res.status(200).json({ dispute: dossier });
	} catch (error) {
		return handleControllerError(res, "Get dispute dossier failed", error);
	}
};

const settleDisputeSplit = async (req, res) => {
	try {
		const { id } = req.params;
		const { buyer_refund, farmer_payout, platform_fee, admin_notes } = req.body;

		if (buyer_refund === undefined || farmer_payout === undefined) {
			return res.status(400).json({
				status: "error",
				message: "buyer_refund and farmer_payout amounts are required for split settlement",
			});
		}

		const result = await adminService.settleDisputeSplit(
			id,
			{
				buyer_refund: parseFloat(buyer_refund),
				farmer_payout: parseFloat(farmer_payout),
				platform_fee: platform_fee !== undefined ? parseFloat(platform_fee) : undefined,
				admin_notes,
			},
			req.user.id,
			req.ip || req.headers["x-forwarded-for"],
			req.headers["user-agent"]
		);

		if (!result.success) {
			return res.status(400).json({ status: "error", message: result.error });
		}

		return res.status(200).json({
			message: "Dispute split settlement executed and escrow balance adjusted successfully",
			settlement: result.settlement,
			dispute: result.dispute,
		});
	} catch (error) {
		return handleControllerError(res, "Settle dispute split failed", error);
	}
};

const getReturnsAdmin = async (req, res) => {
	try {
		const { status, search, page, limit } = req.query;
		const result = await adminService.getReturnsAdmin({
			status,
			search,
			page: parseInt(page) || 1,
			limit: parseInt(limit) || 20,
		});
		return res.status(200).json(result);
	} catch (error) {
		return handleControllerError(res, "Get returns tracking failed", error);
	}
};

const updateReturnStatus = async (req, res) => {
	try {
		const { id } = req.params;
		const { status, restock_quantity, notes } = req.body;

		if (!status) {
			return res.status(400).json({ status: "error", message: "status is required" });
		}

		const updated = await adminService.updateReturnStatus(
			id,
			{
				status,
				restock_quantity: restock_quantity !== undefined ? parseInt(restock_quantity) : null,
				notes,
			},
			req.user.id,
			req.ip || req.headers["x-forwarded-for"],
			req.headers["user-agent"]
		);

		if (!updated) {
			return res.status(404).json({ status: "error", message: `Return shipment #${id} not found` });
		}

		return res.status(200).json({ message: "Return shipment status updated successfully", return_record: updated });
	} catch (error) {
		return handleControllerError(res, "Update return status failed", error);
	}
};

// ==========================================
// --- Phase 3: Carriers, Hubs, and Incidents Controllers ---
// ==========================================

const getCarriers = async (req, res) => {
	try {
		const { status, search, page, limit } = req.query;
		const result = await adminService.getCarriersAdmin({
			status,
			search,
			page: parseInt(page) || 1,
			limit: parseInt(limit) || 20,
		});
		return res.status(200).json(result);
	} catch (error) {
		return handleControllerError(res, "Get carriers failed", error);
	}
};

const createCarrier = async (req, res) => {
	try {
		const { name, code, contact_person, phone, email, status, total_fleet_count, cold_chain_sla_score, coverage_regions, notes } = req.body;

		if (!name || !code || !phone) {
			return res.status(400).json({ status: "error", message: "name, code, and phone are required to onboard carrier" });
		}

		const carrier = await adminService.createCarrierAdmin(
			{ name, code, contact_person, phone, email, status, total_fleet_count, cold_chain_sla_score, coverage_regions, notes },
			req.user.id,
			req.ip || req.headers["x-forwarded-for"],
			req.headers["user-agent"]
		);

		return res.status(201).json({ message: "Freight carrier partner onboarded successfully", carrier });
	} catch (error) {
		return handleControllerError(res, "Create carrier failed", error);
	}
};

const updateCarrier = async (req, res) => {
	try {
		const { id } = req.params;
		const carrier = await adminService.updateCarrierAdmin(
			id,
			req.body,
			req.user.id,
			req.ip || req.headers["x-forwarded-for"],
			req.headers["user-agent"]
		);

		if (!carrier) {
			return res.status(404).json({ status: "error", message: `Carrier #${id} not found` });
		}

		return res.status(200).json({ message: "Carrier partner updated successfully", carrier });
	} catch (error) {
		return handleControllerError(res, "Update carrier failed", error);
	}
};

const getHubs = async (req, res) => {
	try {
		const { region, hub_type, search } = req.query;
		const result = await adminService.getHubsAdmin({ region, hub_type, search });
		return res.status(200).json(result);
	} catch (error) {
		return handleControllerError(res, "Get logistics hubs failed", error);
	}
};

const upsertHub = async (req, res) => {
	try {
		const { name, region, city, address } = req.body;
		if (!name || !region || !city || !address) {
			return res.status(400).json({ status: "error", message: "name, region, city, and address are required for logistics hub" });
		}

		const hub = await adminService.upsertHubAdmin(
			req.body,
			req.user.id,
			req.ip || req.headers["x-forwarded-for"],
			req.headers["user-agent"]
		);

		return res.status(200).json({ message: "Logistics hub saved successfully", hub });
	} catch (error) {
		return handleControllerError(res, "Upsert logistics hub failed", error);
	}
};

const getIncidents = async (req, res) => {
	try {
		const { severity, resolved, search, page, limit } = req.query;
		const result = await adminService.getIncidentsAdmin({
			severity,
			resolved,
			search,
			page: parseInt(page) || 1,
			limit: parseInt(limit) || 20,
		});
		return res.status(200).json(result);
	} catch (error) {
		return handleControllerError(res, "Get logistics incidents failed", error);
	}
};

const resolveIncident = async (req, res) => {
	try {
		const { id } = req.params;
		const { resolution_notes, corrective_action } = req.body;

		if (!resolution_notes || !resolution_notes.trim()) {
			return res.status(400).json({ status: "error", message: "resolution_notes are mandatory to resolve logistics incident" });
		}

		const resolved = await adminService.resolveIncident(
			id,
			{ resolution_notes, corrective_action },
			req.user.id,
			req.ip || req.headers["x-forwarded-for"],
			req.headers["user-agent"]
		);

		if (!resolved) {
			return res.status(404).json({ status: "error", message: `Incident #${id} not found` });
		}

		return res.status(200).json({ message: "Cold-chain SLA incident resolved successfully", incident: resolved });
	} catch (error) {
		return handleControllerError(res, "Resolve incident failed", error);
	}
};

// Phase 4: Support & Broadcast Communications Controllers

const getTickets = async (req, res) => {
	try {
		const { status, priority, category, assigned_to, search, page = 1, limit = 20 } = req.query;
		const result = await adminService.getTicketsAdmin({
			status,
			priority,
			category,
			assigned_to,
			search,
			page: parseInt(page, 10),
			limit: parseInt(limit, 10),
		});
		return res.status(200).json(result);
	} catch (error) {
		return handleControllerError(res, "Get tickets failed", error);
	}
};

const getTicketById = async (req, res) => {
	try {
		const { id } = req.params;
		const dossier = await adminService.getTicketDossier(id);
		if (!dossier) {
			return res.status(404).json({ status: "error", message: `Ticket #${id} not found` });
		}
		return res.status(200).json(dossier);
	} catch (error) {
		return handleControllerError(res, "Get ticket failed", error);
	}
};

const createTicket = async (req, res) => {
	try {
		const { user_id, subject, category, priority, initial_message, assigned_to, order_id, shipment_id } = req.body;
		if (!subject || !subject.trim()) {
			return res.status(400).json({ status: "error", message: "Ticket subject is required" });
		}
		const ticket = await adminService.createTicketAdmin(
			{ user_id, subject, category, priority, initial_message, assigned_to, order_id, shipment_id },
			req.user.id,
			req.ip || req.headers["x-forwarded-for"],
			req.headers["user-agent"]
		);
		return res.status(201).json({ message: "Support ticket created successfully", ticket });
	} catch (error) {
		return handleControllerError(res, "Create ticket failed", error);
	}
};

const updateTicket = async (req, res) => {
	try {
		const { id } = req.params;
		const { status, priority, category, assigned_to } = req.body;
		const updated = await adminService.updateTicketAdmin(
			id,
			{ status, priority, category, assigned_to },
			req.user.id,
			req.ip || req.headers["x-forwarded-for"],
			req.headers["user-agent"]
		);
		if (!updated) {
			return res.status(404).json({ status: "error", message: `Ticket #${id} not found` });
		}
		return res.status(200).json({ message: "Ticket updated successfully", ticket: updated });
	} catch (error) {
		return handleControllerError(res, "Update ticket failed", error);
	}
};

const addTicketMessage = async (req, res) => {
	try {
		const { id } = req.params;
		const { message, is_internal, attachments } = req.body;
		if (!message || !message.trim()) {
			return res.status(400).json({ status: "error", message: "Message content cannot be empty" });
		}
		const msg = await adminService.addTicketMessage(
			id,
			{ message, is_internal, attachments },
			req.user.id,
			req.ip || req.headers["x-forwarded-for"],
			req.headers["user-agent"]
		);
		return res.status(201).json({ message: "Message recorded successfully", ticket_message: msg });
	} catch (error) {
		return handleControllerError(res, "Add message failed", error);
	}
};

const assignTicket = async (req, res) => {
	try {
		const { id } = req.params;
		const { assigned_to } = req.body;
		if (!assigned_to) {
			return res.status(400).json({ status: "error", message: "Target assignee ID is required" });
		}
		const updated = await adminService.assignTicketAdmin(
			id,
			assigned_to,
			req.user.id,
			req.ip || req.headers["x-forwarded-for"],
			req.headers["user-agent"]
		);
		return res.status(200).json({ message: "Ticket assigned successfully", ticket: updated });
	} catch (error) {
		return handleControllerError(res, "Assign ticket failed", error);
	}
};

const escalateTicket = async (req, res) => {
	try {
		const { id } = req.params;
		const { reason } = req.body;
		const updated = await adminService.escalateTicketAdmin(
			id,
			{ reason },
			req.user.id,
			req.ip || req.headers["x-forwarded-for"],
			req.headers["user-agent"]
		);
		return res.status(200).json({ message: "Ticket escalated to urgent priority", ticket: updated });
	} catch (error) {
		return handleControllerError(res, "Escalate ticket failed", error);
	}
};

const getAnnouncements = async (req, res) => {
	try {
		const { status, category, priority, search, page = 1, limit = 20 } = req.query;
		const result = await adminService.getAnnouncementsAdmin({
			status,
			category,
			priority,
			search,
			page: parseInt(page, 10),
			limit: parseInt(limit, 10),
		});
		return res.status(200).json(result);
	} catch (error) {
		return handleControllerError(res, "Get announcements failed", error);
	}
};

const getAnnouncementById = async (req, res) => {
	try {
		const { id } = req.params;
		const dossier = await adminService.getAnnouncementDossier(id);
		if (!dossier) {
			return res.status(404).json({ status: "error", message: `Announcement #${id} not found` });
		}
		return res.status(200).json(dossier);
	} catch (error) {
		return handleControllerError(res, "Get announcement failed", error);
	}
};

const estimateAudienceReach = async (req, res) => {
	try {
		const { target_audience, target_filter } = req.body;
		const count = await adminService.estimateAudienceReach(target_audience, target_filter);
		return res.status(200).json({ estimated_reach: count });
	} catch (error) {
		return handleControllerError(res, "Estimate audience reach failed", error);
	}
};

const createAnnouncement = async (req, res) => {
	try {
		const { title, message, target_audience, target_filter, priority, category, channels, scheduled_at, expires_at, is_dismissible, status } = req.body;
		if (!title || !title.trim() || !message || !message.trim()) {
			return res.status(400).json({ status: "error", message: "Title and message content are required" });
		}
		const ann = await adminService.createAnnouncementAdmin(
			{ title, message, target_audience, target_filter, priority, category, channels, scheduled_at, expires_at, is_dismissible, status },
			req.user.id,
			req.ip || req.headers["x-forwarded-for"],
			req.headers["user-agent"]
		);
		return res.status(201).json({ message: "Announcement created successfully", announcement: ann });
	} catch (error) {
		return handleControllerError(res, "Create announcement failed", error);
	}
};

const updateAnnouncement = async (req, res) => {
	try {
		const { id } = req.params;
		const updated = await adminService.updateAnnouncementAdmin(
			id,
			req.body,
			req.user.id,
			req.ip || req.headers["x-forwarded-for"],
			req.headers["user-agent"]
		);
		if (!updated) {
			return res.status(404).json({ status: "error", message: `Announcement #${id} not found` });
		}
		return res.status(200).json({ message: "Announcement updated successfully", announcement: updated });
	} catch (error) {
		return handleControllerError(res, "Update announcement failed", error);
	}
};

const sendAnnouncement = async (req, res) => {
	try {
		const { id } = req.params;
		const result = await adminService.sendAnnouncementAdmin(
			id,
			req.user.id,
			req.ip || req.headers["x-forwarded-for"],
			req.headers["user-agent"]
		);
		return res.status(200).json({
			message: `Broadcast delivered successfully to ${result.deliveredCount} recipients`,
			announcement: result.announcement,
			delivered_count: result.deliveredCount,
		});
	} catch (error) {
		return handleControllerError(res, "Send announcement failed", error);
	}
};

const cancelAnnouncement = async (req, res) => {
	try {
		const { id } = req.params;
		const cancelled = await adminService.cancelAnnouncementAdmin(
			id,
			req.user.id,
			req.ip || req.headers["x-forwarded-for"],
			req.headers["user-agent"]
		);
		if (!cancelled) {
			return res.status(400).json({ status: "error", message: `Cannot cancel sent or non-existent announcement #${id}` });
		}
		return res.status(200).json({ message: "Announcement cancelled successfully", announcement: cancelled });
	} catch (error) {
		return handleControllerError(res, "Cancel announcement failed", error);
	}
};

const getNotificationTemplates = async (req, res) => {
	try {
		const templates = await adminService.getNotificationTemplatesAdmin();
		return res.status(200).json({ templates });
	} catch (error) {
		return handleControllerError(res, "Get notification templates failed", error);
	}
};

const createNotificationTemplate = async (req, res) => {
	try {
		const { title, code, channel, subject, body, variables } = req.body;
		if (!title || !code || !body) {
			return res.status(400).json({ status: "error", message: "Title, unique code, and template body are required" });
		}
		const tmpl = await adminService.createNotificationTemplateAdmin(
			{ title, code, channel, subject, body, variables },
			req.user.id,
			req.ip || req.headers["x-forwarded-for"],
			req.headers["user-agent"]
		);
		return res.status(201).json({ message: "Template created successfully", template: tmpl });
	} catch (error) {
		return handleControllerError(res, "Create template failed", error);
	}
};

const updateNotificationTemplate = async (req, res) => {
	try {
		const { id } = req.params;
		const updated = await adminService.updateNotificationTemplateAdmin(
			id,
			req.body,
			req.user.id,
			req.ip || req.headers["x-forwarded-for"],
			req.headers["user-agent"]
		);
		if (!updated) {
			return res.status(404).json({ status: "error", message: `Template #${id} not found` });
		}
		return res.status(200).json({ message: "Template updated successfully", template: updated });
	} catch (error) {
		return handleControllerError(res, "Update template failed", error);
	}
};

const deleteNotificationTemplate = async (req, res) => {
	try {
		const { id } = req.params;
		const deleted = await adminService.deleteNotificationTemplateAdmin(
			id,
			req.user.id,
			req.ip || req.headers["x-forwarded-for"],
			req.headers["user-agent"]
		);
		if (!deleted) {
			return res.status(404).json({ status: "error", message: `Template #${id} not found` });
		}
		return res.status(200).json({ message: "Template deleted successfully" });
	} catch (error) {
		return handleControllerError(res, "Delete template failed", error);
	}
};

// Phase 5: Risk, Reports & System Health Controllers

const getRiskRules = async (req, res) => {
	try {
		const rules = await adminService.getRiskRules();
		return res.status(200).json({ rules });
	} catch (error) {
		return handleControllerError(res, "Get risk rules failed", error);
	}
};

const createRiskRule = async (req, res) => {
	try {
		const { name, rule_type, description, severity, threshold_config, action } = req.body;
		if (!name || !rule_type) {
			return res.status(400).json({ status: "error", message: "Rule name and rule type are required" });
		}
		const rule = await adminService.createRiskRule(
			{ name, rule_type, description, severity, threshold_config, action },
			req.user.id,
			req.ip || req.headers["x-forwarded-for"],
			req.headers["user-agent"]
		);
		return res.status(201).json({ message: "Risk rule created successfully", rule });
	} catch (error) {
		return handleControllerError(res, "Create risk rule failed", error);
	}
};

const updateRiskRule = async (req, res) => {
	try {
		const { id } = req.params;
		const updated = await adminService.updateRiskRule(
			id,
			req.body,
			req.user.id,
			req.ip || req.headers["x-forwarded-for"],
			req.headers["user-agent"]
		);
		if (!updated) {
			return res.status(404).json({ status: "error", message: `Risk rule #${id} not found` });
		}
		return res.status(200).json({ message: "Risk rule updated successfully", rule: updated });
	} catch (error) {
		return handleControllerError(res, "Update risk rule failed", error);
	}
};

const getRiskFlags = async (req, res) => {
	try {
		const { status, severity, entity_type, search, page = 1, limit = 20 } = req.query;
		const result = await adminService.getRiskFlags({
			status,
			severity,
			entity_type,
			search,
			page: parseInt(page, 10),
			limit: parseInt(limit, 10),
		});
		return res.status(200).json(result);
	} catch (error) {
		return handleControllerError(res, "Get risk flags failed", error);
	}
};

const resolveRiskFlag = async (req, res) => {
	try {
		const { id } = req.params;
		const { status, resolution_notes } = req.body;
		if (!status || !resolution_notes || !resolution_notes.trim()) {
			return res.status(400).json({ status: "error", message: "Resolution status and investigation notes are required" });
		}
		const resolved = await adminService.resolveRiskFlag(
			id,
			{ status, resolution_notes },
			req.user.id,
			req.ip || req.headers["x-forwarded-for"],
			req.headers["user-agent"]
		);
		if (!resolved) {
			return res.status(404).json({ status: "error", message: `Risk flag #${id} not found` });
		}
		return res.status(200).json({ message: "Risk flag resolved successfully", flag: resolved });
	} catch (error) {
		return handleControllerError(res, "Resolve risk flag failed", error);
	}
};

const getReports = async (req, res) => {
	try {
		const { page = 1, limit = 15 } = req.query;
		const result = await adminService.getReportJobsAdmin({
			page: parseInt(page, 10),
			limit: parseInt(limit, 10),
		});
		return res.status(200).json(result);
	} catch (error) {
		return handleControllerError(res, "Get reports failed", error);
	}
};

const getReportJobById = async (req, res) => {
	try {
		const { id } = req.params;
		const job = await adminService.getReportJobById(id);
		if (!job) {
			return res.status(404).json({ status: "error", message: `Report job #${id} not found` });
		}
		return res.status(200).json({ job });
	} catch (error) {
		return handleControllerError(res, "Get report job failed", error);
	}
};

const exportReport = async (req, res) => {
	try {
		const { report_type, name, parameters, format = "csv" } = req.body;
		if (!report_type) {
			return res.status(400).json({ status: "error", message: "report_type is required" });
		}
		const result = await adminService.executeReportExport(
			{ report_type, name, parameters, format },
			req.user.id,
			req.ip || req.headers["x-forwarded-for"],
			req.headers["user-agent"]
		);

		// If client asked for raw CSV attachment directly via accept header or query param
		if (req.query.download === "true") {
			res.setHeader("Content-Type", "text/csv");
			res.setHeader("Content-Disposition", `attachment; filename="${report_type}_export.csv"`);
			return res.status(200).send(result.csv);
		}

		return res.status(200).json({
			message: "Report exported successfully",
			job: result.job,
			csv: result.csv,
			row_count: result.rowCount,
		});
	} catch (error) {
		return handleControllerError(res, "Export report failed", error);
	}
};

const getReportSchedules = async (req, res) => {
	try {
		const schedules = await adminService.getReportSchedulesAdmin();
		return res.status(200).json({ schedules });
	} catch (error) {
		return handleControllerError(res, "Get report schedules failed", error);
	}
};

const createReportSchedule = async (req, res) => {
	try {
		const { report_type, name, cadence, recipients, parameters } = req.body;
		if (!report_type || !name) {
			return res.status(400).json({ status: "error", message: "report_type and schedule name are required" });
		}
		const schedule = await adminService.createReportScheduleAdmin(
			{ report_type, name, cadence, recipients, parameters },
			req.user.id,
			req.ip || req.headers["x-forwarded-for"],
			req.headers["user-agent"]
		);
		return res.status(201).json({ message: "Report schedule created successfully", schedule });
	} catch (error) {
		return handleControllerError(res, "Create report schedule failed", error);
	}
};

const updateReportSchedule = async (req, res) => {
	try {
		const { id } = req.params;
		const updated = await adminService.updateReportScheduleAdmin(
			id,
			req.body,
			req.user.id,
			req.ip || req.headers["x-forwarded-for"],
			req.headers["user-agent"]
		);
		if (!updated) {
			return res.status(404).json({ status: "error", message: `Schedule #${id} not found` });
		}
		return res.status(200).json({ message: "Report schedule updated successfully", schedule: updated });
	} catch (error) {
		return handleControllerError(res, "Update report schedule failed", error);
	}
};

const deleteReportSchedule = async (req, res) => {
	try {
		const { id } = req.params;
		const deleted = await adminService.deleteReportScheduleAdmin(
			id,
			req.user.id,
			req.ip || req.headers["x-forwarded-for"],
			req.headers["user-agent"]
		);
		if (!deleted) {
			return res.status(404).json({ status: "error", message: `Schedule #${id} not found` });
		}
		return res.status(200).json({ message: "Report schedule deleted successfully" });
	} catch (error) {
		return handleControllerError(res, "Delete report schedule failed", error);
	}
};

const getSystemHealth = async (req, res) => {
	try {
		const health = await adminService.getSystemHealthAdmin();
		return res.status(200).json(health);
	} catch (error) {
		return handleControllerError(res, "Get system health failed", error);
	}
};

const getSystemEvents = async (req, res) => {
	try {
		const { event_type, severity, page = 1, limit = 20 } = req.query;
		const result = await adminService.getSystemEventsAdmin({
			event_type,
			severity,
			page: parseInt(page, 10),
			limit: parseInt(limit, 10),
		});
		return res.status(200).json(result);
	} catch (error) {
		return handleControllerError(res, "Get system events failed", error);
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
	// Phase 1 Controllers
	getKycQueue,
	getKycDossier,
	getKycIntelligence,
	addKycDocument,
	deleteKycDocument,
	addFieldVisit,
	reviewKyc,
	getKycHistory,
	getUser360,
	performUserAction,
	getProductsAdmin,
	getProductDossier,
	moderateProductAdmin,
	bulkModerateProducts,
	getProductModerationHistory,
	getProductRevisionsAdmin,
	reviewProductRevisionAdmin,
	getCategoriesAdmin,
	createCategoryAdmin,
	updateCategoryAdmin,
	deleteCategoryAdmin,
	getReviewsAdmin,
	moderateReviewAdmin,
	getCampaignsAdmin,
	moderateCampaignAdmin,
	getPriceCorridors,
	upsertPriceCorridor,
	getPriceOutliers,
	evaluateProductPricing,
	// Phase 2 Controllers
	getOrders,
	getOrderById,
	updateOrderStatus,
	refundOrder,
	getPayments,
	getPaymentById,
	reconcilePayment,
	getActiveEscrow,
	releaseEscrow,
	holdEscrow,
	getDisputesAdmin,
	getDisputeById,
	settleDisputeSplit,
	getReturnsAdmin,
	updateReturnStatus,
	// Phase 3 Controllers
	getShipmentById,
	getCarriers,
	createCarrier,
	updateCarrier,
	getHubs,
	upsertHub,
	getIncidents,
	resolveIncident,
	// Phase 4 Controllers
	getTickets,
	getTicketById,
	createTicket,
	updateTicket,
	addTicketMessage,
	assignTicket,
	escalateTicket,
	getAnnouncements,
	getAnnouncementById,
	estimateAudienceReach,
	createAnnouncement,
	updateAnnouncement,
	sendAnnouncement,
	cancelAnnouncement,
	getNotificationTemplates,
	createNotificationTemplate,
	updateNotificationTemplate,
	deleteNotificationTemplate,
	// Phase 5 Controllers
	getRiskRules,
	createRiskRule,
	updateRiskRule,
	getRiskFlags,
	resolveRiskFlag,
	getReports,
	getReportJobById,
	exportReport,
	getReportSchedules,
	createReportSchedule,
	updateReportSchedule,
	deleteReportSchedule,
	getSystemHealth,
	getSystemEvents,
};
