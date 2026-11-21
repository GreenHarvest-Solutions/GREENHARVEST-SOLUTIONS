const adminModel = require("../models/adminModel");

const getDashboardAnalytics = async () => {
	const [summary, topSellingProducts, pendingFarmers, moderationProducts, disputes, regionalAnalytics] = await Promise.all([
		adminModel.getSummaryMetrics(),
		adminModel.getTopSellingProducts(10),
		adminModel.getPendingFarmers(10),
		adminModel.getProductsForModeration(10),
		adminModel.getDisputes(10),
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
		pending_farmers: pendingFarmers,
		product_moderation: moderationProducts,
		disputes: disputes,
		regional_analytics: regionalAnalytics,
	};
};

const getPendingFarmers = async () => {
	return adminModel.getPendingFarmers();
};

const verifyFarmer = async (farmerId, isVerified) => {
	return adminModel.verifyFarmer(farmerId, isVerified);
};

const getProductsForModeration = async () => {
	return adminModel.getProductsForModeration();
};

const moderateProduct = async (productId, status) => {
	return adminModel.moderateProduct(productId, status);
};

const getDisputes = async () => {
	return adminModel.getDisputes();
};

const resolveDispute = async (disputeId, action) => {
	return adminModel.resolveDispute(disputeId, action);
};

const broadcastAnnouncement = async (adminUserId, message) => {
	return adminModel.broadcastAnnouncement(adminUserId, message);
};

const getFleetShipments = async (filters) => {
	return adminModel.getFleetShipments(filters);
};

const assignDispatchBatch = async (data) => {
	return adminModel.assignDispatchBatch(data);
};

const emergencyRerouteTruck = async (id, data) => {
	return adminModel.emergencyRerouteTruck(id, data);
};

const getRegionalAnalytics = async (limit = 10) => {
	return adminModel.getRegionalAnalytics(limit);
};

const updateUserStatus = async (userId, status) => {
	return adminModel.updateUserStatus(userId, status);
};

module.exports = {
	getDashboardAnalytics,
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
};
