// Payment controller coordinating multi-provider checkouts and server-side webhook reconciliation
const crypto = require("crypto");
const logger = require("../utils/logger");
const paymentService = require("../services/paymentService");
const orderModel = require("../models/orderModel");
const paymentModel = require("../models/paymentModel");
const { pool } = require("../config/db");

const handleControllerError = (res, context, error, meta = {}) => {
  logger.error(context, {
    message: error.message,
    code: error.code,
    stack: error.stack,
    ...meta,
  });

  return res.status(error.statusCode || 500).json({
    message: error.statusCode ? error.message : "Internal server error",
  });
};

const initiatePayment = async (req, res) => {
  try {
    const { order_id, payment_method, return_url } = req.body;
    const session = await paymentService.initiatePayment({
      user_id: req.user.id,
      order_id,
      payment_method,
      return_url,
    });

    return res.status(200).json({
      message: "Payment initialized successfully",
      ...session,
    });
  } catch (error) {
    return handleControllerError(res, "Payment initialization failed", error, {
      userId: req.user && req.user.id,
      body: req.body,
    });
  }
};

const handleWebhook = async (req, res) => {
  try {
    const provider = req.params.provider || "chapa";
    const result = await paymentService.processWebhook({
      provider,
      headers: req.headers,
      body: req.body,
      rawBody: req.rawBody,
    });

    return res.status(200).json({
      message: "Webhook processed successfully",
      ...result,
    });
  } catch (error) {
    return handleControllerError(res, "Webhook processing failed", error, {
      provider: req.params.provider,
      headers: req.headers,
    });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const { order_id, provider, reference, tx_ref } = req.body;
    const result = await paymentService.verifyPayment({
      user_id: req.user.id,
      order_id,
      provider: provider || "chapa",
      reference: reference || tx_ref,
    });

    return res.status(200).json({
      message: "Payment verification evaluated",
      ...result,
    });
  } catch (error) {
    return handleControllerError(res, "Payment verification failed", error, {
      userId: req.user && req.user.id,
      body: req.body,
    });
  }
};

const processPayment = async (req, res) => {
  try {
    const payment = await paymentService.processPayment({
      user_id: req.user.id,
      ...req.body,
    });

    return res.status(201).json({
      message: "Payment processed successfully",
      payment,
    });
  } catch (error) {
    return handleControllerError(res, "Process payment failed", error, {
      userId: req.user && req.user.id,
      body: req.body,
    });
  }
};

const getPaymentHistory = async (req, res) => {
  try {
    const history = await paymentService.getPaymentHistory(req.user.id);
    return res.status(200).json(history);
  } catch (error) {
    return handleControllerError(res, "Fetch payment history failed", error, {
      userId: req.user && req.user.id,
    });
  }
};

// Aliases for backward compatibility with existing frontend calls
const initializeChapaPayment = async (req, res) => {
  req.body.payment_method = "chapa";
  return initiatePayment(req, res);
};

const verifyChapaPayment = async (req, res) => {
  req.body.provider = "chapa";
  return verifyPayment(req, res);
};

const handleChapaWebhook = async (req, res) => {
  req.params.provider = "chapa";
  return handleWebhook(req, res);
};

module.exports = {
  getPaymentHistory,
  handleChapaWebhook,
  handleWebhook,
  initializeChapaPayment,
  initiatePayment,
  processPayment,
  verifyChapaPayment,
  verifyPayment,
};
