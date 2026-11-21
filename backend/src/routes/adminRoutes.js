const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const permissionMiddleware = require("../middleware/permissionMiddleware");
const { kycUpload } = require("../config/cloudinary");

const {
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
} = require("../controllers/adminController");

const router = express.Router();

// Enforce authentication and administrative role baseline across all /api/admin routes
router.use(authMiddleware);
router.use(roleMiddleware("admin"));

// Profile & Permissions verification
router.get("/me", getAdminMe);

// Dashboard Telemetry & Regional Analytics
router.get("/dashboard", permissionMiddleware("dashboard.read"), getAdminDashboard);
router.get("/analytics", permissionMiddleware("analytics.read"), getRegionalAnalytics);

// User Governance & User 360
router.get("/users/:id", permissionMiddleware("users.read"), getUser360);
router.post("/users/:id/action", permissionMiddleware("users.manage"), performUserAction);
router.patch("/users/:id/status", permissionMiddleware("users.manage"), updateUserStatus);

// Farmer KYC & Accreditation (Phase 1)
router.get("/kyc", permissionMiddleware("kyc.read"), getKycQueue);
router.get("/kyc/:id", permissionMiddleware("kyc.read"), getKycDossier);
router.post("/kyc/:id/documents", permissionMiddleware("kyc.manage"), (req, res, next) => {
	kycUpload.single("document")(req, res, (err) => {
		if (err) {
			return res.status(400).json({ status: "error", message: err.message });
		}
		next();
	});
}, addKycDocument);
router.delete("/kyc/:id/documents/:documentId", permissionMiddleware("kyc.manage"), deleteKycDocument);
router.post("/kyc/:id/field-visits", permissionMiddleware("kyc.manage"), addFieldVisit);
router.post("/kyc/:id/review", permissionMiddleware("kyc.manage"), reviewKyc);
router.get("/kyc/:id/history", permissionMiddleware("kyc.read"), getKycHistory);

// Legacy Farmer KYC aliases for backward compatibility
router.get("/farmers/kyc", permissionMiddleware("kyc.read"), getFarmersKYC);
router.patch("/farmers/:id/verify", permissionMiddleware("kyc.manage"), verifyFarmer);

// Product Catalog Moderation & Governance (Phase 1)
router.get("/products", permissionMiddleware("products.read"), getProductsAdmin);
router.get("/products/:id", permissionMiddleware("products.read"), getProductDossier);
router.patch("/products/:id/moderate", permissionMiddleware("products.moderate"), moderateProductAdmin);
router.post("/products/bulk-moderate", permissionMiddleware("products.moderate"), bulkModerateProducts);
router.get("/products/:id/history", permissionMiddleware("products.read"), getProductModerationHistory);

// Legacy Product Moderation alias for backward compatibility
router.get("/products/moderation", permissionMiddleware("products.read"), getProductsModeration);

// Categories Governance
router.get("/categories", permissionMiddleware("products.read"), getCategoriesAdmin);
router.post("/categories", permissionMiddleware("products.moderate"), createCategoryAdmin);
router.put("/categories/:id", permissionMiddleware("products.moderate"), updateCategoryAdmin);
router.delete("/categories/:id", permissionMiddleware("products.moderate"), deleteCategoryAdmin);

// Reviews Moderation
router.get("/reviews", permissionMiddleware("products.read"), getReviewsAdmin);
router.patch("/reviews/:id", permissionMiddleware("products.moderate"), moderateReviewAdmin);

// Campaigns Governance
router.get("/campaigns", permissionMiddleware("products.read"), getCampaignsAdmin);
router.patch("/campaigns/:id", permissionMiddleware("products.moderate"), moderateCampaignAdmin);

// Price Corridors & Benchmark Tolerance
router.get("/pricing/corridors", permissionMiddleware("products.read"), getPriceCorridors);
router.post("/pricing/corridors", permissionMiddleware("products.moderate"), upsertPriceCorridor);
router.get("/pricing/outliers", permissionMiddleware("products.read"), getPriceOutliers);
router.post("/pricing/evaluate/:id", permissionMiddleware("products.read"), evaluateProductPricing);

// ==========================================
// Phase 2: Orders & Payments Oversight
// ==========================================
router.get("/orders", permissionMiddleware("orders.read"), getOrders);
router.get("/orders/:id", permissionMiddleware("orders.read"), getOrderById);
router.patch("/orders/:id/status", permissionMiddleware("orders.manage"), updateOrderStatus);
router.post("/orders/:id/refund", permissionMiddleware("orders.refund"), refundOrder);

router.get("/payments", permissionMiddleware("payments.read"), getPayments);
router.get("/payments/:id", permissionMiddleware("payments.read"), getPaymentById);
router.post("/payments/:id/reconcile", permissionMiddleware("payments.manage"), reconcilePayment);

// ==========================================
// Phase 2: Escrow Management & Release Clearinghouse
// ==========================================
router.get("/escrow/active", permissionMiddleware("escrow.read"), getActiveEscrow);
router.post("/escrow/:id/release", permissionMiddleware("escrow.release"), releaseEscrow);
router.post("/escrow/:id/hold", permissionMiddleware("escrow.manage"), holdEscrow);

// ==========================================
// Phase 2: Disputes & Returns Arbitration
// ==========================================
router.get("/disputes", permissionMiddleware("disputes.read"), getDisputesAdmin);
router.get("/disputes/:id", permissionMiddleware("disputes.read"), getDisputeById);
router.post("/disputes/:id/settle", permissionMiddleware("disputes.resolve"), settleDisputeSplit);
router.patch("/disputes/:id/resolve", permissionMiddleware("disputes.resolve"), resolveDispute);

router.get("/returns", permissionMiddleware("returns.read"), getReturnsAdmin);
router.patch("/returns/:id/status", permissionMiddleware("returns.manage"), updateReturnStatus);

// Targeted Platform Broadcasts
router.post("/broadcast", permissionMiddleware("broadcast.send"), broadcastAnnouncement);

// Cold-Chain Logistics & Reefer Telemetry
router.get("/logistics/fleet", permissionMiddleware("logistics.read"), getFleetShipments);
router.post("/logistics/assign", permissionMiddleware("logistics.manage"), assignDispatchBatch);
router.patch("/logistics/:id/reroute", permissionMiddleware("logistics.manage"), emergencyRerouteTruck);

// Platform Global Settings
router.get("/settings", permissionMiddleware("settings.read"), getPlatformSettings);
router.put("/settings", permissionMiddleware("settings.manage"), updatePlatformSettings);
router.get("/settings/history", permissionMiddleware("settings.read"), getSettingsHistory);

// System Audit Logs
router.get("/audit-logs", permissionMiddleware("audit.read"), getAuditLogs);

// Admin Team Governance
router.get("/team", permissionMiddleware("team.manage"), getAdminTeam);
router.get("/team/roles", permissionMiddleware("team.manage"), getAdminRoles);
router.patch("/team/:id/role", permissionMiddleware("team.manage"), updateAdminRole);

module.exports = router;
