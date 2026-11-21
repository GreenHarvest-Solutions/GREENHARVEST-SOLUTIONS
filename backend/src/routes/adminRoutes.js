const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const permissionMiddleware = require("../middleware/permissionMiddleware");

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

// User Governance
router.patch("/users/:id/status", permissionMiddleware("users.manage"), updateUserStatus);

// Farmer KYC & Accreditation
router.get("/farmers/kyc", permissionMiddleware("kyc.read"), getFarmersKYC);
router.patch("/farmers/:id/verify", permissionMiddleware("kyc.manage"), verifyFarmer);

// Product Moderation
router.get("/products/moderation", permissionMiddleware("products.read"), getProductsModeration);
router.patch("/products/:id/moderate", permissionMiddleware("products.moderate"), moderateProduct);

// Escrow Disputes & Resolutions
router.get("/disputes", permissionMiddleware("disputes.read"), getDisputes);
router.patch("/disputes/:id/resolve", permissionMiddleware("disputes.resolve"), resolveDispute);

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
