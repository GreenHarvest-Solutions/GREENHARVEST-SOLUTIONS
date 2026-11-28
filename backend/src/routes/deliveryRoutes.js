const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");
const {
  assignDeliveryPartner,
  claimPoolDelivery,
  confirmFarmerDelivery,
  confirmPickup,
  dispatchFarmerDelivery,
  estimateCheckoutDelivery,
  getAssignedDeliveries,
  getDeliveryPool,
  getMyPartnerProfile,
  markReadyForPickup,
  postCheckpoint,
  rateSuborderDelivery,
  submitMyPartnerProfile,
  trackDelivery,
  trackSuborderDelivery,
  updateDeliveryStatus,
  updatePartnerStatus,
} = require("../controllers/deliveryController");

const router = express.Router();

router.use(authMiddleware);

// Checkout Distance & Weight Delivery Pricing Estimator
router.post("/estimate", requireRole("buyer", "admin"), estimateCheckoutDelivery);

// Delivery Partner Onboarding & Verification Profile
router.get("/partner/profile", requireRole("delivery_partner", "deliveryPartner", "delivery", "admin"), getMyPartnerProfile);
router.put("/partner/profile", requireRole("delivery_partner", "deliveryPartner", "delivery", "admin"), submitMyPartnerProfile);

// Mode A: Farmer Pickup Routes
router.post("/suborders/:id/ready-pickup", requireRole("farmer", "admin"), markReadyForPickup);
router.post("/suborders/:id/confirm-pickup", requireRole("farmer", "admin"), confirmPickup);

// Mode B: Farmer Delivery Routes
router.post("/suborders/:id/dispatch-farmer", requireRole("farmer", "admin"), dispatchFarmerDelivery);
router.post("/suborders/:id/confirm-delivery", confirmFarmerDelivery);

// Mode C: Delivery Partner Pool Routes
router.get("/pool", requireRole("delivery_partner", "deliveryPartner", "delivery", "admin"), getDeliveryPool);
router.post("/pool/:id/claim", requireRole("delivery_partner", "deliveryPartner", "delivery", "admin"), claimPoolDelivery);
router.patch("/suborders/:id/partner-status", requireRole("delivery_partner", "deliveryPartner", "delivery", "admin"), updatePartnerStatus);

// Live Checkpoints & Buyer Accountability Ratings
router.post("/suborders/:id/checkpoint", requireRole("delivery_partner", "deliveryPartner", "delivery", "farmer", "admin"), postCheckpoint);
router.post("/suborders/:id/rate", requireRole("buyer", "admin"), rateSuborderDelivery);

// Tracking & Details
router.get("/suborders/:id", trackSuborderDelivery);

// Partner and Order Routes
router.get("/assigned", requireRole("delivery_partner", "deliveryPartner", "delivery", "admin"), getAssignedDeliveries);
router.get("/track/:orderId", trackDelivery);
router.get("/:order_id", trackDelivery);

// Legacy routes
router.post("/assign", requireRole("admin", "field_agent"), assignDeliveryPartner);
router.put("/update-status", requireRole("delivery_partner", "admin"), updateDeliveryStatus);
router.patch("/:id/status", requireRole("delivery_partner", "admin"), updateDeliveryStatus);

module.exports = router;
