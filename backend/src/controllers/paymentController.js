// Payment controller delegates business logic to the payment service.
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

    return res.status(200).json({
      ...history,
    });
  } catch (error) {
    return handleControllerError(res, "Fetch payment history failed", error, {
      userId: req.user && req.user.id,
    });
  }
};

const initializeChapaPayment = async (req, res) => {
  try {
    const { order_id, return_url } = req.body;

    if (!order_id || !return_url) {
      return res.status(400).json({ message: "order_id and return_url are required" });
    }

    const CHAPA_SECRET_KEY = process.env.CHAPA_SECRET_KEY;
    if (!CHAPA_SECRET_KEY) {
      return res.status(500).json({ message: "Chapa secret key is not configured on the server" });
    }

    const order = await orderModel.findOrderById(Number(order_id));
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (Number(order.buyer_id) !== Number(req.user.id)) {
      return res.status(403).json({ message: "You don't have permission to pay for this order" });
    }

    const tx_ref = `tx-${order_id}-${crypto.randomBytes(8).toString("hex")}`;

    // Store pending payment record so tx_ref is bound to order in DB
    await paymentModel.createOrUpdatePayment(pool, {
      order_id: Number(order_id),
      payment_method: "chapa",
      amount: Number(order.total_amount),
      payment_status: "pending",
      transaction_id: tx_ref,
    });

    const chapaPayload = {
      amount: order.total_amount,
      currency: "ETB",
      email: req.user.email || "customer@greenharvest.com",
      first_name: req.user.first_name || req.user.name || "Customer",
      last_name: req.user.last_name || "",
      tx_ref: tx_ref,
      callback_url: process.env.CHAPA_CALLBACK_URL || "https://webhook.site/placeholder",
      return_url: `${return_url}?tx_ref=${tx_ref}&order_id=${order_id}`,
      customization: {
        title: "GreenHarvest Order Payment",
        description: `Payment for order #${order_id}`,
      },
    };

    const response = await fetch("https://api.chapa.co/v1/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CHAPA_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(chapaPayload),
    });

    const data = await response.json();

    if (data.status !== "success") {
      logger.error("Chapa initialization failed", { data });
      return res.status(400).json({ message: "Failed to initialize payment gateway", details: data });
    }

    return res.status(200).json({
      message: "Payment initialized successfully",
      checkout_url: data.data.checkout_url,
      tx_ref,
    });
  } catch (error) {
    return handleControllerError(res, "Initialize payment failed", error, {
      userId: req.user && req.user.id,
      body: req.body,
    });
  }
};

const verifyChapaPayment = async (req, res) => {
  try {
    const { tx_ref, order_id } = req.body;

    if (!tx_ref || !order_id) {
      return res.status(400).json({ message: "tx_ref and order_id are required" });
    }

    const CHAPA_SECRET_KEY = process.env.CHAPA_SECRET_KEY;
    if (!CHAPA_SECRET_KEY) {
      return res.status(500).json({ message: "Chapa secret key is not configured on the server" });
    }

    const order = await orderModel.findOrderById(Number(order_id));
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (Number(order.buyer_id) !== Number(req.user.id)) {
      return res.status(403).json({ message: "You don't have permission to verify this order" });
    }

    // Idempotency: if already marked paid, return success directly
    if (order.payment_status === "paid") {
      return res.status(200).json({ message: "Payment already verified", status: "success" });
    }

    const response = await fetch(`https://api.chapa.co/v1/transaction/verify/${tx_ref}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${CHAPA_SECRET_KEY}`,
      },
    });

    if (!response.ok) {
      logger.error("Chapa verification request failed", { status: response.status, tx_ref });
      return res.status(502).json({ message: "Failed to verify payment with Chapa", status: "failed" });
    }

    const data = await response.json();

    if (data.status === "success" && data.data.status === "success") {
      const chapaTxRef = data.data.tx_ref;
      const chapaAmount = Number(data.data.amount);
      const chapaCurrency = data.data.currency;

      // Anti-fraud: Verify tx_ref belongs to this order
      if (!chapaTxRef || !chapaTxRef.startsWith(`tx-${order_id}-`)) {
        logger.error("Chapa tx_ref mismatch fraud attempt", { chapaTxRef, order_id });
        return res.status(400).json({ message: "Transaction reference does not match this order", status: "failed" });
      }

      // Anti-fraud: Verify amount paid covers the order total
      if (chapaAmount < Number(order.total_amount)) {
        logger.error("Chapa underpayment fraud attempt", { chapaAmount, orderAmount: order.total_amount });
        return res.status(400).json({ message: "Transaction amount is less than order total", status: "failed" });
      }

      // Anti-fraud: Verify currency is ETB
      if (chapaCurrency && chapaCurrency.toUpperCase() !== "ETB") {
        logger.error("Chapa currency mismatch", { chapaCurrency });
        return res.status(400).json({ message: "Currency mismatch", status: "failed" });
      }

      // Atomic update of orders, payments, and transactions inside a single DB transaction
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        await client.query("UPDATE orders SET payment_status = 'paid' WHERE id = $1", [Number(order_id)]);

        await paymentModel.createOrUpdatePayment(client, {
          order_id: Number(order_id),
          payment_method: "chapa",
          amount: chapaAmount,
          payment_status: "paid",
          transaction_id: tx_ref,
        });

        await paymentModel.createTransaction(client, {
          order_id: Number(order_id),
          user_id: Number(order.buyer_id),
          amount: chapaAmount,
          payment_method: "chapa",
          status: "paid",
        });

        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }

      return res.status(200).json({ message: "Payment verified successfully", status: "success" });
    } else {
      return res.status(400).json({ message: "Payment not successful or pending", status: "failed" });
    }
  } catch (error) {
    return handleControllerError(res, "Verify payment failed", error, {
      userId: req.user && req.user.id,
      body: req.body,
    });
  }
};

const handleChapaWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-chapa-signature"];
    const secret = process.env.CHAPA_WEBHOOK_SECRET || process.env.CHAPA_SECRET_KEY;

    if (secret && signature) {
      const hash = crypto
        .createHmac("sha256", secret)
        .update(JSON.stringify(req.body))
        .digest("hex");

      if (hash !== signature) {
        logger.error("Chapa webhook signature mismatch");
        return res.status(401).json({ message: "Invalid webhook signature" });
      }
    }

    const { tx_ref, status, amount } = req.body || {};
    if (status === "success" && tx_ref) {
      const match = tx_ref.match(/^tx-(\d+)-/);
      if (match) {
        const orderId = Number(match[1]);
        const order = await orderModel.findOrderById(orderId);
        if (order && order.payment_status !== "paid") {
          const client = await pool.connect();
          try {
            await client.query("BEGIN");
            await client.query("UPDATE orders SET payment_status = 'paid' WHERE id = $1", [orderId]);

            await paymentModel.createOrUpdatePayment(client, {
              order_id: orderId,
              payment_method: "chapa",
              amount: Number(amount || order.total_amount),
              payment_status: "paid",
              transaction_id: tx_ref,
            });

            await paymentModel.createTransaction(client, {
              order_id: orderId,
              user_id: Number(order.buyer_id),
              amount: Number(amount || order.total_amount),
              payment_method: "chapa",
              status: "paid",
            });

            await client.query("COMMIT");
            logger.info("Chapa webhook processed order payment", { orderId, tx_ref });
          } catch (err) {
            await client.query("ROLLBACK");
            throw err;
          } finally {
            client.release();
          }
        }
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    logger.error("Chapa webhook error", { message: error.message });
    return res.status(500).json({ message: "Webhook handler failed" });
  }
};

module.exports = {
  processPayment,
  getPaymentHistory,
  initializeChapaPayment,
  verifyChapaPayment,
  handleChapaWebhook,
};
