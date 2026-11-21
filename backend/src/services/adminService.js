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
};
