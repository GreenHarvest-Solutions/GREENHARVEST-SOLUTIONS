const adminModel = require("../models/adminModel");

const getDashboardAnalytics = async () => {
	const [summary, topSellingProducts, pendingFarmers, moderationProducts, disputes] = await Promise.all([
		adminModel.getSummaryMetrics(),
		adminModel.getTopSellingProducts(10),
		adminModel.getPendingFarmers(10),
		adminModel.getProductsForModeration(10),
		adminModel.getDisputes(10),
	]);

	return {
		total_users: summary.total_users,
		total_farmers: summary.total_farmers,
		total_orders: summary.total_orders,
		total_revenue: summary.total_revenue,
		top_selling_products: topSellingProducts,
		pending_farmers: pendingFarmers,
		product_moderation: moderationProducts,
		disputes: disputes,
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

module.exports = {
	getDashboardAnalytics,
	getPendingFarmers,
	verifyFarmer,
	getProductsForModeration,
	moderateProduct,
	getDisputes,
	resolveDispute,
	broadcastAnnouncement,
};
