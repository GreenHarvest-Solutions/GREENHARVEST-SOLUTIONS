const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");
const {
  processPayment,
  getPaymentHistory,
  initializeChapaPayment,
  verifyChapaPayment,
  handleChapaWebhook,
} = require("../controllers/paymentController");

const router = express.Router();

// Public webhook endpoint for Chapa server-to-server notifications
router.post("/chapa/webhook", handleChapaWebhook);

// Protected routes
router.use(authMiddleware);

router.post("/process", processPayment);
router.get("/history", getPaymentHistory);
router.post("/chapa/initialize", initializeChapaPayment);
router.post("/chapa/verify", verifyChapaPayment);

router.post("/", processPayment);
router.get("/", getPaymentHistory);

module.exports = router;
