const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const {
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
} = require("../controllers/adminController");

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware("admin"));

// Dashboard Telemetry
router.get("/dashboard", getAdminDashboard);

// Farmer KYC & Verification
router.get("/farmers/kyc", getFarmersKYC);
router.patch("/farmers/:id/verify", verifyFarmer);

// Product Moderation
router.get("/products/moderation", getProductsModeration);
router.patch("/products/:id/moderate", moderateProduct);

// Escrow Disputes & Refunds
router.get("/disputes", getDisputes);
router.patch("/disputes/:id/resolve", resolveDispute);

// Platform Broadcasts
router.post("/broadcast", broadcastAnnouncement);

// Cold-Chain Logistics & Reefer Telemetry
router.get("/logistics/fleet", getFleetShipments);
router.post("/logistics/assign", assignDispatchBatch);
router.patch("/logistics/:id/reroute", emergencyRerouteTruck);

module.exports = router;
