const adminModel = require("../models/adminModel");
const auditService = require("./auditService");

const getDashboardAnalytics = async () => {
	const [summary, topSellingProducts, pendingFarmersData, moderationProductsData, disputesData, regionalAnalytics] = await Promise.all([
		adminModel.getSummaryMetrics(),
		adminModel.getTopSellingProducts(10),
		adminModel.getPendingFarmers({ page: 1, limit: 10 }),
		adminModel.getProductsForModeration({ page: 1, limit: 10 }),
		adminModel.getDisputes({ page: 1, limit: 10 }),
		adminModel.getRegionalAnalytics(10),
	]);

	return {
		total_users: summary.total_users,
		total_farmers: summary.total_farmers,
		total_orders: summary.total_orders,
		total_revenue: summary.total_revenue,
		active_today: summary.active_today,
		fulfillment_rate: summary.fulfillment_rate,
		active_fleet_trucks: summary.active_fleet_trucks,
		cold_chain_compliance: summary.cold_chain_compliance,
		avg_speed_kmh: summary.avg_speed_kmh,
		kyc_pending_count: summary.kyc_pending_count,
		moderation_pending_count: summary.moderation_pending_count,
		disputes_open_count: summary.disputes_open_count,
		fleet_breaches_count: summary.fleet_breaches_count,
		top_selling_products: topSellingProducts,
		pending_farmers: pendingFarmersData.farmers,
		product_moderation: moderationProductsData.products,
		disputes: disputesData.disputes,
		regional_analytics: regionalAnalytics,
	};
};

const getAdminMe = async (userId) => {
	return adminModel.getAdminMe(userId);
};

const getPendingFarmers = async (options) => {
	return adminModel.getPendingFarmers(options);
};

const verifyFarmer = async (farmerId, isVerified, actorId = null, reason = null) => {
	return adminModel.verifyFarmer(farmerId, isVerified, actorId, reason);
};

const getProductsForModeration = async (options) => {
	return adminModel.getProductsForModeration(options);
};

const moderateProduct = async (productId, status, actorId = null, reason = null) => {
	return adminModel.moderateProduct(productId, status, actorId, reason);
};

const getDisputes = async (options) => {
	return adminModel.getDisputes(options);
};

const resolveDispute = async (disputeId, action, actorId = null, reason = null) => {
	return adminModel.resolveDispute(disputeId, action, actorId, reason);
};

const broadcastAnnouncement = async (adminUserId, message, targetAudience = "all", title = "Platform Advisory") => {
	return adminModel.broadcastAnnouncement(adminUserId, message, targetAudience, title);
};

const getFleetShipments = async (filters) => {
	return adminModel.getFleetShipments(filters);
};

const assignDispatchBatch = async (data, actorId = null) => {
	return adminModel.assignDispatchBatch(data, actorId);
};

const emergencyRerouteTruck = async (id, data, actorId = null) => {
	return adminModel.emergencyRerouteTruck(id, data, actorId);
};

const getRegionalAnalytics = async (limit = 10) => {
	return adminModel.getRegionalAnalytics(limit);
};

const updateUserStatus = async (userId, status, actorId = null, reason = null) => {
	return adminModel.updateUserStatus(userId, status, actorId, reason);
};

const getPlatformSettings = async () => {
	return adminModel.getPlatformSettings();
};

const updatePlatformSettings = async (settings, actorId = null) => {
	return adminModel.updatePlatformSettings(settings, actorId);
};

const getSettingsHistory = async (limit = 50) => {
	return adminModel.getSettingsHistory(limit);
};

const getAuditLogs = async (query) => {
	return auditService.getAuditLogs(query);
};

const getAdminTeam = async () => {
	return adminModel.getAdminTeam();
};

const getAdminRoles = async () => {
	return adminModel.getAdminRoles();
};

const updateAdminRole = async (userId, adminRoleId, actorId = null) => {
	return adminModel.updateAdminRole(userId, adminRoleId, actorId);
};

// --- Phase 1: KYC Services ---
const getKycQueue = async (options) => {
	return adminModel.getKycQueue(options);
};

const getKycDossier = async (farmerId) => {
	return adminModel.getKycDossier(farmerId);
};

const addKycDocument = async (data) => {
	return adminModel.addKycDocument(data);
};

const deleteKycDocument = async (data) => {
	return adminModel.deleteKycDocument(data);
};

const addFieldVisit = async (data) => {
	return adminModel.addFieldVisit(data);
};

const reviewKyc = async (data) => {
	return adminModel.reviewKyc(data);
};

const getKycHistory = async (farmerId) => {
	return adminModel.getKycHistory(farmerId);
};

// --- Phase 1: User 360 Services ---
const getUser360 = async (userId) => {
	return adminModel.getUser360(userId);
};

const performUserAction = async (data) => {
	return adminModel.performUserAction(data);
};

// --- Phase 1: Product Moderation & Governance Services ---
const getProductsAdmin = async (options) => {
	return adminModel.getProductsAdmin(options);
};

const getProductDossier = async (productId) => {
	return adminModel.getProductDossier(productId);
};

const moderateProductAdmin = async (data) => {
	return adminModel.moderateProduct(data);
};

const bulkModerateProducts = async (data) => {
	return adminModel.bulkModerateProducts(data);
};

const getProductModerationHistory = async (productId) => {
	return adminModel.getProductModerationHistory(productId);
};

const getCategoriesAdmin = async () => {
	return adminModel.getCategoriesAdmin();
};

const createCategoryAdmin = async (data) => {
	return adminModel.createCategoryAdmin(data);
};

const updateCategoryAdmin = async (data) => {
	return adminModel.updateCategoryAdmin(data);
};

const deleteCategoryAdmin = async (id, actorId) => {
	return adminModel.deleteCategoryAdmin(id, actorId);
};

const getReviewsAdmin = async (options) => {
	return adminModel.getReviewsAdmin(options);
};

const moderateReviewAdmin = async (data) => {
	return adminModel.moderateReviewAdmin(data);
};

const getCampaignsAdmin = async (options) => {
	return adminModel.getCampaignsAdmin(options);
};

const moderateCampaignAdmin = async (data) => {
	return adminModel.moderateCampaignAdmin(data);
};

const getPriceCorridors = async (options) => {
	return adminModel.getPriceCorridors(options);
};

const upsertPriceCorridor = async (data) => {
	return adminModel.upsertPriceCorridor(data);
};

const getPriceOutliers = async () => {
	return adminModel.getPriceOutliers();
};

const evaluateProductPricing = async (productId) => {
	return adminModel.evaluateProductPricing(productId);
};

// --- Phase 2: Commerce, Orders, Payments, Escrow, Disputes Services ---
const getOrdersAdmin = async (options) => {
	return adminModel.getOrdersAdmin(options);
};

const getOrderDossier = async (orderId) => {
	return adminModel.getOrderDossier(orderId);
};

const updateOrderStatus = async (orderId, newStatus, reason, actorId, ipAddress, userAgent) => {
	return adminModel.updateOrderStatus(orderId, newStatus, reason, actorId, ipAddress, userAgent);
};

const refundOrder = async (orderId, data, actorId, ipAddress, userAgent) => {
	return adminModel.refundOrder(orderId, data, actorId, ipAddress, userAgent);
};

const getActiveEscrowLedger = async (options) => {
	return adminModel.getActiveEscrowLedger(options);
};

const releaseEscrow = async (escrowId, data, actorId, ipAddress, userAgent) => {
	return adminModel.releaseEscrow(escrowId, data, actorId, ipAddress, userAgent);
};

const holdEscrow = async (escrowId, data, actorId, ipAddress, userAgent) => {
	return adminModel.holdEscrow(escrowId, data, actorId, ipAddress, userAgent);
};

const getDisputesAdmin = async (options) => {
	return adminModel.getDisputesAdmin(options);
};

const getDisputeDossier = async (disputeId) => {
	return adminModel.getDisputeDossier(disputeId);
};

const settleDisputeSplit = async (disputeId, data, actorId, ipAddress, userAgent) => {
	return adminModel.settleDisputeSplit(disputeId, data, actorId, ipAddress, userAgent);
};

const getReturnsAdmin = async (options) => {
	return adminModel.getReturnsAdmin(options);
};

const updateReturnStatus = async (returnId, data, actorId, ipAddress, userAgent) => {
	return adminModel.updateReturnStatus(returnId, data, actorId, ipAddress, userAgent);
};

const getPaymentsAdmin = async (options) => {
	return adminModel.getPaymentsAdmin(options);
};

const getPaymentDossier = async (paymentId) => {
	return adminModel.getPaymentDossier(paymentId);
};

const reconcilePayment = async (paymentId, data, actorId, ipAddress, userAgent) => {
	return adminModel.reconcilePayment(paymentId, data, actorId, ipAddress, userAgent);
};

// --- Phase 3: Cold-Chain Logistics, Carriers, Hubs, Incidents Services ---
const getFleetShipmentsAdmin = async (options) => {
	return adminModel.getFleetShipmentsAdmin(options);
};

const getShipmentDossier = async (shipmentId) => {
	return adminModel.getShipmentDossier(shipmentId);
};

const getCarriersAdmin = async (options) => {
	return adminModel.getCarriersAdmin(options);
};

const createCarrierAdmin = async (data, actorId, ipAddress, userAgent) => {
	return adminModel.createCarrierAdmin(data, actorId, ipAddress, userAgent);
};

const updateCarrierAdmin = async (id, data, actorId, ipAddress, userAgent) => {
	return adminModel.updateCarrierAdmin(id, data, actorId, ipAddress, userAgent);
};

const getHubsAdmin = async (options) => {
	return adminModel.getHubsAdmin(options);
};

const upsertHubAdmin = async (data, actorId, ipAddress, userAgent) => {
	return adminModel.upsertHubAdmin(data, actorId, ipAddress, userAgent);
};

const getIncidentsAdmin = async (options) => {
	return adminModel.getIncidentsAdmin(options);
};

const resolveIncident = async (incidentId, data, actorId, ipAddress, userAgent) => {
	return adminModel.resolveIncident(incidentId, data, actorId, ipAddress, userAgent);
};

// Phase 4: Support & Broadcast Communications
const getTicketsAdmin = async (options) => {
	return adminModel.getTicketsAdmin(options);
};

const getTicketDossier = async (id) => {
	return adminModel.getTicketDossier(id);
};

const createTicketAdmin = async (data, actorId, ipAddress, userAgent) => {
	const ticket = await adminModel.createTicketAdmin({ ...data, creator_id: actorId });
	await auditService.record({
		actorId,
		action: "SUPPORT_TICKET_CREATED",
		entityType: "support_tickets",
		entityId: ticket.id,
		beforeValues: null,
		afterValues: ticket,
		reason: `Ticket ${ticket.ticket_number} created`,
		ipAddress,
		userAgent,
	});
	return ticket;
};

const updateTicketAdmin = async (id, data, actorId, ipAddress, userAgent) => {
	const existing = await adminModel.getTicketDossier(id);
	const updated = await adminModel.updateTicketAdmin(id, data);
	await auditService.record({
		actorId,
		action: "SUPPORT_TICKET_UPDATED",
		entityType: "support_tickets",
		entityId: id,
		beforeValues: existing?.ticket || null,
		afterValues: updated,
		reason: `Updated status to ${data.status || 'current'}, priority to ${data.priority || 'current'}`,
		ipAddress,
		userAgent,
	});
	return updated;
};

const addTicketMessage = async (ticketId, data, actorId, ipAddress, userAgent) => {
	const msg = await adminModel.addTicketMessage({
		ticket_id: ticketId,
		sender_id: actorId,
		sender_type: "admin",
		message: data.message,
		is_internal: Boolean(data.is_internal),
		attachments: data.attachments || [],
	});
	await auditService.record({
		actorId,
		action: data.is_internal ? "SUPPORT_INTERNAL_NOTE_ADDED" : "SUPPORT_CUSTOMER_REPLY_ADDED",
		entityType: "ticket_messages",
		entityId: msg.id,
		beforeValues: null,
		afterValues: { ticket_id: ticketId, is_internal: data.is_internal },
		reason: data.is_internal ? "Internal operator note" : "Customer response delivered",
		ipAddress,
		userAgent,
	});
	return msg;
};

const assignTicketAdmin = async (ticketId, assignedTo, actorId, ipAddress, userAgent) => {
	const updated = await adminModel.assignTicketAdmin(ticketId, assignedTo, actorId);
	await auditService.record({
		actorId,
		action: "SUPPORT_TICKET_ASSIGNED",
		entityType: "support_tickets",
		entityId: ticketId,
		beforeValues: null,
		afterValues: { assigned_to: assignedTo },
		reason: `Assigned ticket to user ${assignedTo}`,
		ipAddress,
		userAgent,
	});
	return updated;
};

const escalateTicketAdmin = async (ticketId, data, actorId, ipAddress, userAgent) => {
	const updated = await adminModel.escalateTicketAdmin(ticketId, {
		reason: data.reason,
		actor_id: actorId,
	});
	await auditService.record({
		actorId,
		action: "SUPPORT_TICKET_ESCALATED",
		entityType: "support_tickets",
		entityId: ticketId,
		beforeValues: null,
		afterValues: { priority: "urgent" },
		reason: data.reason || "Operational escalation to urgent priority",
		ipAddress,
		userAgent,
	});
	return updated;
};

const getAnnouncementsAdmin = async (options) => {
	return adminModel.getAnnouncementsAdmin(options);
};

const getAnnouncementDossier = async (id) => {
	return adminModel.getAnnouncementDossier(id);
};

const estimateAudienceReach = async (targetAudience, targetFilter) => {
	return adminModel.estimateAudienceReach(targetAudience, targetFilter);
};

const createAnnouncementAdmin = async (data, actorId, ipAddress, userAgent) => {
	const ann = await adminModel.createAnnouncementAdmin({ ...data, created_by: actorId });
	await auditService.record({
		actorId,
		action: "ANNOUNCEMENT_CREATED",
		entityType: "announcements",
		entityId: ann.id,
		beforeValues: null,
		afterValues: ann,
		reason: `Created announcement: ${ann.title}`,
		ipAddress,
		userAgent,
	});
	return ann;
};

const updateAnnouncementAdmin = async (id, data, actorId, ipAddress, userAgent) => {
	const existing = await adminModel.getAnnouncementDossier(id);
	const updated = await adminModel.updateAnnouncementAdmin(id, data);
	await auditService.record({
		actorId,
		action: "ANNOUNCEMENT_UPDATED",
		entityType: "announcements",
		entityId: id,
		beforeValues: existing?.announcement || null,
		afterValues: updated,
		reason: `Updated announcement ${id}`,
		ipAddress,
		userAgent,
	});
	return updated;
};

const sendAnnouncementAdmin = async (id, actorId, ipAddress, userAgent) => {
	const result = await adminModel.sendAnnouncementAdmin(id, actorId);
	await auditService.record({
		actorId,
		action: "ANNOUNCEMENT_DISPATCHED",
		entityType: "announcements",
		entityId: id,
		beforeValues: null,
		afterValues: { delivered_count: result.deliveredCount },
		reason: `Dispatched announcement to ${result.deliveredCount} recipients`,
		ipAddress,
		userAgent,
	});
	return result;
};

const cancelAnnouncementAdmin = async (id, actorId, ipAddress, userAgent) => {
	const cancelled = await adminModel.cancelAnnouncementAdmin(id, actorId);
	await auditService.record({
		actorId,
		action: "ANNOUNCEMENT_CANCELLED",
		entityType: "announcements",
		entityId: id,
		beforeValues: null,
		afterValues: { status: "cancelled" },
		reason: `Cancelled broadcast announcement ${id}`,
		ipAddress,
		userAgent,
	});
	return cancelled;
};

const getNotificationTemplatesAdmin = async () => {
	return adminModel.getNotificationTemplatesAdmin();
};

const createNotificationTemplateAdmin = async (data, actorId, ipAddress, userAgent) => {
	const tmpl = await adminModel.createNotificationTemplateAdmin(data);
	await auditService.record({
		actorId,
		action: "NOTIFICATION_TEMPLATE_CREATED",
		entityType: "notification_templates",
		entityId: tmpl.id,
		beforeValues: null,
		afterValues: tmpl,
		reason: `Created template ${tmpl.code}`,
		ipAddress,
		userAgent,
	});
	return tmpl;
};

const updateNotificationTemplateAdmin = async (id, data, actorId, ipAddress, userAgent) => {
	const updated = await adminModel.updateNotificationTemplateAdmin(id, data);
	await auditService.record({
		actorId,
		action: "NOTIFICATION_TEMPLATE_UPDATED",
		entityType: "notification_templates",
		entityId: id,
		beforeValues: null,
		afterValues: updated,
		reason: `Updated template ${id}`,
		ipAddress,
		userAgent,
	});
	return updated;
};

const deleteNotificationTemplateAdmin = async (id, actorId, ipAddress, userAgent) => {
	const deleted = await adminModel.deleteNotificationTemplateAdmin(id);
	await auditService.record({
		actorId,
		action: "NOTIFICATION_TEMPLATE_DELETED",
		entityType: "notification_templates",
		entityId: id,
		beforeValues: null,
		afterValues: null,
		reason: `Deleted template ${id}`,
		ipAddress,
		userAgent,
	});
	return deleted;
};

// Phase 5: Risk, Reports & System Health
const getRiskRules = async () => {
	return adminModel.getRiskRules();
};

const createRiskRule = async (data, actorId, ipAddress, userAgent) => {
	const rule = await adminModel.createRiskRule(data);
	await auditService.record({
		actorId,
		action: "RISK_RULE_CREATED",
		entityType: "risk_rules",
		entityId: rule.id,
		beforeValues: null,
		afterValues: rule,
		reason: `Created heuristic risk rule ${rule.name}`,
		ipAddress,
		userAgent,
	});
	return rule;
};

const updateRiskRule = async (id, data, actorId, ipAddress, userAgent) => {
	const updated = await adminModel.updateRiskRule(id, data);
	await auditService.record({
		actorId,
		action: "RISK_RULE_UPDATED",
		entityType: "risk_rules",
		entityId: id,
		beforeValues: null,
		afterValues: updated,
		reason: `Updated risk rule ${id}`,
		ipAddress,
		userAgent,
	});
	return updated;
};

const getRiskFlags = async (options) => {
	return adminModel.getRiskFlags(options);
};

const resolveRiskFlag = async (id, data, actorId, ipAddress, userAgent) => {
	const resolved = await adminModel.resolveRiskFlag(id, { ...data, actor_id: actorId });
	await auditService.record({
		actorId,
		action: "RISK_FLAG_RESOLVED",
		entityType: "risk_flags",
		entityId: id,
		beforeValues: null,
		afterValues: resolved,
		reason: `Resolved risk flag: ${data.status}. Notes: ${data.resolution_notes}`,
		ipAddress,
		userAgent,
	});
	return resolved;
};

const getReportsCatalogAdmin = async () => {
	return adminModel.getReportsCatalogAdmin();
};

const getReportJobsAdmin = async (options) => {
	return adminModel.getReportJobsAdmin(options);
};

const getReportJobById = async (id) => {
	return adminModel.getReportJobById(id);
};

const executeReportExport = async (data, actorId, ipAddress, userAgent) => {
	const result = await adminModel.executeReportExport({ ...data, actor_id: actorId });
	await auditService.record({
		actorId,
		action: "REPORT_EXPORT_EXECUTED",
		entityType: "report_jobs",
		entityId: result.job?.id,
		beforeValues: null,
		afterValues: { report_type: data.report_type, row_count: result.rowCount },
		reason: `Exported ${data.report_type} report with ${result.rowCount} rows`,
		ipAddress,
		userAgent,
	});
	return result;
};

const getReportSchedulesAdmin = async () => {
	return adminModel.getReportSchedulesAdmin();
};

const createReportScheduleAdmin = async (data, actorId, ipAddress, userAgent) => {
	const schedule = await adminModel.createReportScheduleAdmin({ ...data, created_by: actorId });
	await auditService.record({
		actorId,
		action: "REPORT_SCHEDULE_CREATED",
		entityType: "report_schedules",
		entityId: schedule.id,
		beforeValues: null,
		afterValues: schedule,
		reason: `Created ${schedule.cadence} schedule for ${schedule.report_type}`,
		ipAddress,
		userAgent,
	});
	return schedule;
};

const updateReportScheduleAdmin = async (id, data, actorId, ipAddress, userAgent) => {
	const updated = await adminModel.updateReportScheduleAdmin(id, data);
	await auditService.record({
		actorId,
		action: "REPORT_SCHEDULE_UPDATED",
		entityType: "report_schedules",
		entityId: id,
		beforeValues: null,
		afterValues: updated,
		reason: `Updated report schedule ${id}`,
		ipAddress,
		userAgent,
	});
	return updated;
};

const deleteReportScheduleAdmin = async (id, actorId, ipAddress, userAgent) => {
	const deleted = await adminModel.deleteReportScheduleAdmin(id);
	await auditService.record({
		actorId,
		action: "REPORT_SCHEDULE_DELETED",
		entityType: "report_schedules",
		entityId: id,
		beforeValues: null,
		afterValues: null,
		reason: `Deleted report schedule ${id}`,
		ipAddress,
		userAgent,
	});
	return deleted;
};

const getSystemHealthAdmin = async () => {
	return adminModel.getSystemHealthAdmin();
};

const getSystemEventsAdmin = async (options) => {
	return adminModel.getSystemEventsAdmin(options);
};

module.exports = {
	getDashboardAnalytics,
	getAdminMe,
	getPendingFarmers,
	verifyFarmer,
	getProductsForModeration,
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
	// Phase 1 exports
	getKycQueue,
	getKycDossier,
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
	// Phase 2 exports
	getOrdersAdmin,
	getOrderDossier,
	updateOrderStatus,
	refundOrder,
	getActiveEscrowLedger,
	releaseEscrow,
	holdEscrow,
	getDisputesAdmin,
	getDisputeDossier,
	settleDisputeSplit,
	getReturnsAdmin,
	updateReturnStatus,
	getPaymentsAdmin,
	getPaymentDossier,
	reconcilePayment,
	// Phase 3 exports
	getFleetShipmentsAdmin,
	getShipmentDossier,
	getCarriersAdmin,
	createCarrierAdmin,
	updateCarrierAdmin,
	getHubsAdmin,
	upsertHubAdmin,
	getIncidentsAdmin,
	resolveIncident,
	// Phase 4 exports
	getTicketsAdmin,
	getTicketDossier,
	createTicketAdmin,
	updateTicketAdmin,
	addTicketMessage,
	assignTicketAdmin,
	escalateTicketAdmin,
	getAnnouncementsAdmin,
	getAnnouncementDossier,
	estimateAudienceReach,
	createAnnouncementAdmin,
	updateAnnouncementAdmin,
	sendAnnouncementAdmin,
	cancelAnnouncementAdmin,
	getNotificationTemplatesAdmin,
	createNotificationTemplateAdmin,
	updateNotificationTemplateAdmin,
	deleteNotificationTemplateAdmin,
	// Phase 5 exports
	getRiskRules,
	createRiskRule,
	updateRiskRule,
	getRiskFlags,
	resolveRiskFlag,
	getReportsCatalogAdmin,
	getReportJobsAdmin,
	getReportJobById,
	executeReportExport,
	getReportSchedulesAdmin,
	createReportScheduleAdmin,
	updateReportScheduleAdmin,
	deleteReportScheduleAdmin,
	getSystemHealthAdmin,
	getSystemEventsAdmin,
};
