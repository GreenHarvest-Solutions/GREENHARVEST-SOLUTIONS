// Moved from routes/orderRoutes.js during the structure refactor.
// Import paths updated to use src/controllers and src/middleware.
const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");
const {
  assignDeliveryPartner,
  createOrder,
  getUserOrders,
  getOrderById,
  updateOrderStatus,
} = require("../controllers/orderController");

const router = express.Router();

router.use(authMiddleware);

router.post("/", requireRole("buyer", "admin"), createOrder);
router.post("/checkout", requireRole("buyer", "admin"), createOrder);
router.get("/", getUserOrders);
router.get("/:id", getOrderById);
router.put("/:id/assign-delivery", requireRole("admin"), assignDeliveryPartner);
router.patch("/:id/status", requireRole("farmer", "delivery_partner", "admin", "field_agent"), updateOrderStatus);

module.exports = router;
