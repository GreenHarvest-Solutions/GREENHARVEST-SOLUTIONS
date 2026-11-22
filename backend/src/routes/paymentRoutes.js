const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");
const {
  getPaymentHistory,
  handleChapaWebhook,
  handleWebhook,
  initializeChapaPayment,
  initiatePayment,
  processPayment,
  verifyChapaPayment,
  verifyPayment,
} = require("../controllers/paymentController");

const router = express.Router();

// 1. PUBLIC Webhook Endpoints (Enforces cryptographic HMAC signature verification)
router.post("/webhook/:provider", handleWebhook);
router.post("/webhook", handleWebhook);
router.post("/chapa/webhook", handleChapaWebhook);

// 2. AUTHENTICATED Endpoints (Require valid user session)
router.use(authMiddleware);

router.post("/initiate", initiatePayment);
router.post("/verify", verifyPayment);
router.post("/process", processPayment);
router.get("/history", getPaymentHistory);

// Legacy aliases for existing frontend routes
router.post("/chapa/initialize", initializeChapaPayment);
router.post("/chapa/verify", verifyChapaPayment);
router.post("/", processPayment);
router.get("/", getPaymentHistory);

module.exports = router;
