const crypto = require("crypto");
const BasePaymentAdapter = require("./baseAdapter");
const logger = require("../../utils/logger");

class ChapaAdapter extends BasePaymentAdapter {
  constructor() {
    super("chapa");
    this.secretKey = process.env.CHAPA_SECRET_KEY || "chapa_test_secret";
    this.webhookSecret = process.env.CHAPA_WEBHOOK_SECRET || this.secretKey;
  }

  async initiatePayment({ order, amount, returnUrl, user }) {
    const txRef = `tx-chapa-${order.id}-${crypto.randomBytes(6).toString("hex")}`;
    const payload = {
      amount: Number(amount).toFixed(2),
      currency: "ETB",
      email: user.email || "customer@greenharvest.com",
      first_name: user.name ? user.name.split(" ")[0] : "Customer",
      last_name: user.name && user.name.split(" ").length > 1 ? user.name.split(" ").slice(1).join(" ") : "Buyer",
      tx_ref: txRef,
      callback_url: process.env.CHAPA_CALLBACK_URL || "https://api.greenharvest.com/api/payments/webhook/chapa",
      return_url: `${returnUrl}?tx_ref=${txRef}&order_id=${order.id}&provider=chapa`,
      customization: {
        title: "GreenHarvest Payment",
        description: `Order ${order.order_number || order.id}`,
      },
    };

    // If a live/sandbox key is provided, attempt live API call
    if (this.secretKey && !this.secretKey.includes("test_secret") && !process.env.MOCK_PAYMENTS) {
      try {
        const response = await fetch("https://api.chapa.co/v1/transaction/initialize", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const data = await response.json();
        if (data.status === "success" && data.data?.checkout_url) {
          return {
            checkout_url: data.data.checkout_url,
            transaction_id: txRef,
            provider: "chapa",
            payload,
          };
        }
      } catch (err) {
        logger.warn("Chapa live initialization failed, falling back to simulated checkout", { err: err.message });
      }
    }

    // Default mock / test checkout URL
    const fallbackUrl = `${returnUrl || "/buyer/checkout/payment/mock"}?tx_ref=${txRef}&order_id=${order.id}&provider=chapa&status=success`;
    return {
      checkout_url: fallbackUrl,
      transaction_id: txRef,
      provider: "chapa",
      payload,
    };
  }

  verifyWebhookSignature({ headers, body, rawBody, secret }) {
    const signature = headers["chapa-signature"] || headers["x-chapa-signature"];
    if (!signature) {
      return false;
    }

    const key = secret || this.webhookSecret;
    const content = rawBody ? rawBody.toString("utf8") : JSON.stringify(body);
    const expected = crypto.createHmac("sha256", key).update(content).digest("hex");

    return this.timingSafeCompare(signature, expected);
  }

  async verifyTransaction({ reference }) {
    if (this.secretKey && !this.secretKey.includes("test_secret") && !process.env.MOCK_PAYMENTS) {
      try {
        const response = await fetch(`https://api.chapa.co/v1/transaction/verify/${reference}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          return data.status === "success" && data.data?.status === "success";
        }
      } catch (err) {
        logger.warn("Chapa transaction verification API call failed", { err: err.message });
      }
    }

    return false;
  }
}

module.exports = ChapaAdapter;
