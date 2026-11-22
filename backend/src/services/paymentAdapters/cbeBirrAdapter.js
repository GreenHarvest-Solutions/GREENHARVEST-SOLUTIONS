const crypto = require("crypto");
const BasePaymentAdapter = require("./baseAdapter");

class CbeBirrAdapter extends BasePaymentAdapter {
  constructor() {
    super("cbe_birr");
    this.merchantId = process.env.CBE_MERCHANT_ID || "cbe_merchant_001";
    this.apiKey = process.env.CBE_API_KEY || "cbe_test_key";
    this.webhookSecret = process.env.CBE_WEBHOOK_SECRET || this.apiKey;
  }

  async initiatePayment({ order, amount, returnUrl, user }) {
    const billReference = `cbe-${order.id}-${crypto.randomBytes(6).toString("hex")}`;
    const payload = {
      merchantId: this.merchantId,
      billReference,
      amount: Number(amount).toFixed(2),
      currency: "ETB",
      orderId: order.id,
      buyerPhone: user.phone || "+251911000000",
      returnUrl: `${returnUrl}?ref=${billReference}&order_id=${order.id}&provider=cbe_birr`,
      callbackUrl: process.env.CBE_CALLBACK_URL || "https://api.greenharvest.com/api/payments/webhook/cbe_birr",
    };

    const checkoutUrl = `${returnUrl || "/buyer/checkout/payment/mock"}?ref=${billReference}&order_id=${order.id}&provider=cbe_birr&status=success`;

    return {
      checkout_url: checkoutUrl,
      transaction_id: billReference,
      provider: "cbe_birr",
      payload,
    };
  }

  verifyWebhookSignature({ headers, body, rawBody, secret }) {
    const signature = headers["cbebirr-signature"] || headers["x-cbe-signature"] || headers["cbe-signature"];
    if (!signature) {
      return false;
    }

    const key = secret || this.webhookSecret;
    const content = rawBody ? rawBody.toString("utf8") : JSON.stringify(body);
    const expected = crypto.createHmac("sha256", key).update(content).digest("hex");

    return this.timingSafeCompare(signature, expected);
  }

  async verifyTransaction({ reference }) {
    return false;
  }
}

module.exports = CbeBirrAdapter;
