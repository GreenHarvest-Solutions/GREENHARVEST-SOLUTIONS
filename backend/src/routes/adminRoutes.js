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

// ==========================================
// Phase 3: Cold-Chain Logistics, Carriers, Fleet Telemetry, and Incidents
// ==========================================
router.get("/logistics/fleet", permissionMiddleware("logistics.read"), getFleetShipments);
router.get("/logistics/fleet/:id", permissionMiddleware("logistics.read"), getShipmentById);
router.post("/logistics/dispatch", permissionMiddleware("logistics.manage"), assignDispatchBatch);
router.post("/logistics/assign", permissionMiddleware("logistics.manage"), assignDispatchBatch);
router.patch("/logistics/shipments/:id/reroute", permissionMiddleware("logistics.manage"), emergencyRerouteTruck);
router.patch("/logistics/:id/reroute", permissionMiddleware("logistics.manage"), emergencyRerouteTruck);

// Carrier Governance
router.get("/logistics/carriers", permissionMiddleware("logistics.carriers.read"), getCarriers);
router.post("/logistics/carriers", permissionMiddleware("logistics.carriers.manage"), createCarrier);
router.patch("/logistics/carriers/:id", permissionMiddleware("logistics.carriers.manage"), updateCarrier);

// Cold Storage Hubs & Depots
router.get("/logistics/hubs", permissionMiddleware("logistics.hubs.read"), getHubs);
router.post("/logistics/hubs", permissionMiddleware("logistics.hubs.manage"), upsertHub);

// Incidents & SLA Resolution
router.get("/logistics/incidents", permissionMiddleware("logistics.incidents.read"), getIncidents);
router.post("/logistics/incidents/:id/resolve", permissionMiddleware("logistics.incidents.resolve"), resolveIncident);

// ==========================================
// Phase 4: Customer & Farmer Support Tickets
// ==========================================
router.get("/tickets", permissionMiddleware("support.tickets.read"), getTickets);
router.post("/tickets", permissionMiddleware("support.tickets.manage"), createTicket);
router.get("/tickets/:id", permissionMiddleware("support.tickets.read"), getTicketById);
router.patch("/tickets/:id", permissionMiddleware("support.tickets.manage"), updateTicket);
router.post("/tickets/:id/messages", permissionMiddleware("support.tickets.manage"), addTicketMessage);
router.post("/tickets/:id/assign", permissionMiddleware("support.tickets.assign"), assignTicket);
router.post("/tickets/:id/escalate", permissionMiddleware("support.tickets.manage"), escalateTicket);

// ==========================================
// Phase 4: Announcements & Targeted Broadcasts
// ==========================================
router.get("/announcements", permissionMiddleware("broadcast.send"), getAnnouncements);
router.post("/announcements", permissionMiddleware("announcements.manage"), createAnnouncement);
router.post("/announcements/estimate", permissionMiddleware("broadcast.send"), estimateAudienceReach);
router.get("/announcements/:id", permissionMiddleware("broadcast.send"), getAnnouncementById);
router.patch("/announcements/:id", permissionMiddleware("announcements.manage"), updateAnnouncement);
router.post("/announcements/:id/send", permissionMiddleware("broadcast.send"), sendAnnouncement);
router.post("/announcements/:id/cancel", permissionMiddleware("announcements.manage"), cancelAnnouncement);

// ==========================================
// Phase 4: Notification Templates
// ==========================================
router.get("/notification-templates", permissionMiddleware("templates.manage"), getNotificationTemplates);
router.post("/notification-templates", permissionMiddleware("templates.manage"), createNotificationTemplate);
router.patch("/notification-templates/:id", permissionMiddleware("templates.manage"), updateNotificationTemplate);
router.delete("/notification-templates/:id", permissionMiddleware("templates.manage"), deleteNotificationTemplate);

// ==========================================
// Phase 5: Risk & Fraud Governance
// ==========================================
router.get("/risk/rules", permissionMiddleware("risk.read"), getRiskRules);
router.post("/risk/rules", permissionMiddleware("risk.manage"), createRiskRule);
router.patch("/risk/rules/:id", permissionMiddleware("risk.manage"), updateRiskRule);
router.get("/risk/flags", permissionMiddleware("risk.read"), getRiskFlags);
router.patch("/risk/flags/:id", permissionMiddleware("risk.manage"), resolveRiskFlag);

// ==========================================
// Phase 5: Reports & Data Exports
// ==========================================
router.get("/reports", permissionMiddleware("reports.read"), getReports);
router.post("/reports/export", permissionMiddleware("reports.export"), exportReport);
router.get("/reports/jobs/:id", permissionMiddleware("reports.read"), getReportJobById);
router.get("/reports/schedules", permissionMiddleware("reports.read"), getReportSchedules);
router.post("/reports/schedules", permissionMiddleware("reports.export"), createReportSchedule);
router.patch("/reports/schedules/:id", permissionMiddleware("reports.export"), updateReportSchedule);
router.delete("/reports/schedules/:id", permissionMiddleware("reports.export"), deleteReportSchedule);

// ==========================================
// Phase 5: System Health & Diagnostics
// ==========================================
router.get("/system/health", permissionMiddleware("system.health.read"), getSystemHealth);
router.get("/system/events", permissionMiddleware("system.health.read"), getSystemEvents);

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
