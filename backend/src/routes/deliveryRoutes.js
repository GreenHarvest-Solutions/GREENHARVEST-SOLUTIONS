// Moved from routes/deliveryRoutes.js during the structure refactor.
// Import paths updated to use src/controllers and src/middleware.
const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");
const {
  assignDeliveryPartner,
  getAssignedDeliveries,
  updateDeliveryStatus,
  trackDelivery,
} = require("../controllers/deliveryController");

const router = express.Router();

router.use(authMiddleware);

router.post("/assign", requireRole("admin", "field_agent"), assignDeliveryPartner);
router.get("/assigned", requireRole("delivery_partner", "admin"), getAssignedDeliveries);
router.put("/update-status", requireRole("delivery_partner", "admin"), updateDeliveryStatus);
router.patch("/:id/status", requireRole("delivery_partner", "admin"), updateDeliveryStatus);
router.get("/track/:orderId", trackDelivery);
router.get("/:order_id", trackDelivery);

module.exports = router;
