// Payment service supporting multi-provider local payments, webhook verification, and escrow integration
const crypto = require("crypto");
const { pool } = require("../config/db");
const logger = require("../utils/logger");
const notificationModel = require("../models/notificationModel");
const paymentModel = require("../models/paymentModel");
const inventoryService = require("./inventoryService");
const { getAdapter } = require("./paymentAdapters");
const { isPositiveInteger } = require("../utils/validators");

const allowedPaymentStatuses = ["pending", "paid", "failed", "refunded"];

const createServiceError = (message, statusCode, extra = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  Object.assign(error, extra);
  return error;
};

const emitPaymentSucceededNotification = async ({ user_id, order_id, order_number }) => {
  if (!user_id || !order_id) return;

  try {
    await notificationModel.createNotificationForUser({
      user_id: Number(user_id),
      title: "Payment confirmed",
      message: `Your payment for order ${order_number || `#${order_id}`} was confirmed successfully.`,
      type: "payment",
    });
  } catch (error) {
    logger.warn("Payment notification emit failed", {
      order_id,
      user_id,
      message: error.message,
    });
  }
};

/**
 * Initiate an online payment with a local Ethiopian provider (Chapa, Telebirr, CBE Birr)
 */
const initiatePayment = async ({ user_id, order_id, payment_method = "chapa", return_url }) => {
  const parsedOrderId = Number(order_id);
  if (!isPositiveInteger(parsedOrderId)) {
    throw createServiceError("Valid order_id is required", 400);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const order = await paymentModel.findOrderByIdForUpdate(client, parsedOrderId);
    if (!order) {
      throw createServiceError("Order not found", 404);
    }

    if (Number(order.buyer_id) !== Number(user_id)) {
      throw createServiceError("You can only pay for your own orders", 403);
    }

    if (order.payment_status === "paid") {
      throw createServiceError("Order has already been paid", 409);
    }

    // Lookup user details
    const userRes = await client.query(`SELECT id, name, email, phone FROM users WHERE id = $1`, [user_id]);
    const user = userRes.rows[0] || {};

    const adapter = getAdapter(payment_method);
    const returnUrl = return_url || `/buyer/checkout/payment/verify`;

    const gatewaySession = await adapter.initiatePayment({
      order,
      amount: order.total_amount,
      returnUrl,
      user,
    });

    // Record pending payment in payments table
    await paymentModel.createPaymentRecord(client, {
      order_id: parsedOrderId,
      payment_method,
      amount: order.total_amount,
      payment_status: "pending",
      transaction_id: gatewaySession.transaction_id,
      reference_number: gatewaySession.transaction_id,
      gateway_name: adapter.name,
      gateway_response: gatewaySession.payload || {},
      currency: "ETB",
    });

    await client.query("COMMIT");

    return {
      order_id: parsedOrderId,
      order_number: order.order_number,
      total_amount: order.total_amount,
      provider: adapter.name,
      transaction_id: gatewaySession.transaction_id,
      checkout_url: gatewaySession.checkout_url,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Process incoming server-side webhook from a payment provider with HMAC cryptographic verification
 */
const processWebhook = async ({ provider, headers, body, rawBody }) => {
  const adapter = getAdapter(provider);

  // 1. Verify HMAC Signature
  const isValidSignature = adapter.verifyWebhookSignature({
    headers,
    body,
    rawBody,
  });

  if (!isValidSignature) {
    logger.warn("Invalid webhook signature rejected", { provider, headers });
    throw createServiceError(`Invalid HMAC signature for ${provider} webhook`, 401);
  }

  // 2. Extract transaction identifiers from webhook payload
  const reference =
    body.reference ||
    body.tx_ref ||
    body.outTradeNo ||
    body.billReference ||
    body.transaction_id ||
    body.id;

  const orderId = body.order_id || (reference && reference.includes("-") ? Number(reference.split("-")[2] || reference.split("-")[1]) : null);
  const status = (body.status || body.tradeStatus || "success").toLowerCase();
  const idempotencyKey = headers["idempotency-key"] || body.idempotency_key || reference;

  if (!reference && !orderId) {
    throw createServiceError("Webhook payload missing reference and order_id", 400);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 3. Idempotency Check: if this idempotency_key or reference is already processed, do not duplicate
    if (idempotencyKey) {
      const existingPayment = await paymentModel.findPaymentByIdempotency(client, idempotencyKey);
      if (existingPayment && existingPayment.payment_status === "paid") {
        await client.query("COMMIT");
        logger.info("Webhook duplicate ignored (idempotent)", { idempotencyKey, reference });
        return {
          already_processed: true,
          payment_id: existingPayment.id,
          message: "Transaction already settled",
        };
      }
    }

    if (reference) {
      const existingRefPayment = await paymentModel.findPaymentByReference(client, reference);
      if (existingRefPayment && existingRefPayment.payment_status === "paid") {
        await client.query("COMMIT");
        logger.info("Webhook duplicate ignored (reference already paid)", { reference });
        return {
          already_processed: true,
          payment_id: existingRefPayment.id,
          message: "Transaction already settled",
        };
      }
    }

    // 4. Resolve Target Order
    let order = null;
    if (orderId && isPositiveInteger(orderId)) {
      order = await paymentModel.findOrderByIdForUpdate(client, orderId);
    } else if (reference) {
      const p = await paymentModel.findPaymentByReference(client, reference);
      if (p) {
        order = await paymentModel.findOrderByIdForUpdate(client, p.order_id);
      }
    }

    if (!order) {
      throw createServiceError(`Order not found for webhook reference: ${reference}`, 404);
    }

    // Check if payment was successful or failed
    const isSuccess = ["success", "paid", "completed", "trade_success"].includes(status);
    const finalPaymentStatus = isSuccess ? "paid" : "failed";

    // 5. Insert or Update Payment Record
    const payment = await paymentModel.createPaymentRecord(client, {
      order_id: order.id,
      payment_method: adapter.name,
      amount: order.total_amount,
      payment_status: finalPaymentStatus,
      transaction_id: reference || `tx-${Date.now()}`,
      reference_number: reference,
      gateway_name: adapter.name,
      gateway_response: body,
      idempotency_key: idempotencyKey,
      currency: "ETB",
    });

    if (isSuccess) {
      // 6. Update Order Status
      await client.query(
        `UPDATE orders
         SET payment_status = 'paid',
             order_status = CASE WHEN order_status = 'pending' THEN 'confirmed' ELSE order_status END
         WHERE id = $1`,
        [order.id]
      );

      // 7. Consume Authoritative Stock Reservations
      await inventoryService.confirmReservation(order.id, client);

      // 8. Update Suborders & Settle Escrow
      const suborders = await paymentModel.findSubordersForOrder(client, order.id);

      for (const sub of suborders) {
        // Advance suborder fulfillment status if still pending
        await client.query(
          `UPDATE suborders
           SET fulfillment_status = CASE WHEN fulfillment_status = 'pending' THEN 'accepted' ELSE fulfillment_status END
           WHERE id = $1`,
          [sub.id]
        );

        // Check if escrow already recorded for this suborder
        const existingEscrow = await client.query(
          `SELECT id FROM escrow_ledger WHERE suborder_id = $1`,
          [sub.id]
        );

        if (existingEscrow.rows.length === 0) {
          await paymentModel.createEscrowEntry(client, {
            order_id: order.id,
            suborder_id: sub.id,
            buyer_id: order.buyer_id,
            farmer_id: sub.farmer_id,
            escrow_amount: sub.total_amount,
            platform_fee_pct: 0.05,
            notes: `Auto-escrow held on ${adapter.name} settlement for suborder ${sub.suborder_number}`,
          });
        }
      }
    }

    await client.query("COMMIT");

    if (isSuccess) {
      await emitPaymentSucceededNotification({
        user_id: order.buyer_id,
        order_id: order.id,
        order_number: order.order_number,
      });
    }

    logger.info("Payment webhook settled successfully", {
      order_id: order.id,
      provider,
      reference,
      status: finalPaymentStatus,
    });

    return {
      success: isSuccess,
      order_id: order.id,
      payment_id: payment.id,
      payment_status: finalPaymentStatus,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Server-side transaction verification called by return/redirect page
 * Enforces server-side provider query rather than trusting client parameters
 */
const verifyPayment = async ({ user_id, order_id, provider = "chapa", reference }) => {
  const parsedOrderId = Number(order_id);
  if (!isPositiveInteger(parsedOrderId)) {
    throw createServiceError("Valid order_id is required", 400);
  }

  const client = await pool.connect();
  try {
    const order = await paymentModel.findOrderByIdForUpdate(client, parsedOrderId);
    if (!order) {
      throw createServiceError("Order not found", 404);
    }

    if (Number(order.buyer_id) !== Number(user_id)) {
      throw createServiceError("You can only verify your own orders", 403);
    }

    // If order is already settled via webhook, return immediately
    if (order.payment_status === "paid") {
      return {
        order_id: parsedOrderId,
        payment_status: "paid",
        message: "Order payment verified and settled",
      };
    }

    // Query provider directly via adapter to verify transaction
    const adapter = getAdapter(provider);
    const isVerifiedByProvider = await adapter.verifyTransaction({
      reference: reference || `tx-${provider}-${order.id}`,
    });

    if (isVerifiedByProvider) {
      // Settle payment server-to-server
      client.release();
      return processWebhook({
        provider: adapter.name,
        headers: { "idempotency-key": `verify-${parsedOrderId}-${reference}` },
        body: {
          order_id: parsedOrderId,
          reference: reference || `tx-${provider}-${order.id}`,
          status: "success",
        },
        rawBody: null,
      });
    }

    // Do NOT trust unverified redirect parameters!
    return {
      order_id: parsedOrderId,
      payment_status: order.payment_status,
      message: "Payment is pending verification with provider",
    };
  } finally {
    client.release();
  }
};

/**
 * Legacy processPayment (for direct/cash-on-delivery flows)
 */
const processPayment = async ({ user_id, order_id, payment_method, amount }) => {
  return processWebhook({
    provider: payment_method || "chapa",
    headers: {
      "idempotency-key": `direct-${order_id}-${Date.now()}`,
      "chapa-signature": crypto
        .createHmac("sha256", process.env.CHAPA_WEBHOOK_SECRET || process.env.CHAPA_SECRET_KEY || "chapa_test_secret")
        .update(JSON.stringify({ order_id, amount, status: "success" }))
        .digest("hex"),
    },
    body: {
      order_id,
      amount,
      status: "success",
    },
  });
};

const getPaymentHistory = async (user_id) => {
  const payments = await paymentModel.getPaymentHistoryByBuyer(user_id);
  return {
    payments,
    transactions: payments,
  };
};

module.exports = {
  allowedPaymentStatuses,
  getPaymentHistory,
  initiatePayment,
  processPayment,
  processWebhook,
  verifyPayment,
};
