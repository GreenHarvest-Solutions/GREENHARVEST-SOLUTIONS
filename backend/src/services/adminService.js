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
};
