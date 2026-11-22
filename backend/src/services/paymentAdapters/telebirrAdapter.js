const crypto = require("crypto");
const BasePaymentAdapter = require("./baseAdapter");
const logger = require("../../utils/logger");

class TelebirrAdapter extends BasePaymentAdapter {
  constructor() {
    super("telebirr");
    this.appId = process.env.TELEBIRR_APP_ID || "telebirr_app_001";
    this.appKey = process.env.TELEBIRR_APP_KEY || "telebirr_test_key";
    this.webhookSecret = process.env.TELEBIRR_WEBHOOK_SECRET || this.appKey;
  }

  async initiatePayment({ order, amount, returnUrl, user }) {
    const outTradeNo = `tb-${order.id}-${crypto.randomBytes(6).toString("hex")}`;
    const timestamp = Date.now().toString();

    const payload = {
      appId: this.appId,
      outTradeNo,
      totalAmount: Number(amount).toFixed(2),
      subject: `Order ${order.order_number || order.id}`,
      notifyUrl: process.env.TELEBIRR_NOTIFY_URL || "https://api.greenharvest.com/api/payments/webhook/telebirr",
      returnUrl: `${returnUrl}?outTradeNo=${outTradeNo}&order_id=${order.id}&provider=telebirr`,
      timestamp,
      buyerPhone: user.phone || "+251911000000",
    };

    // Calculate request signature
    const stringToSign = `appId=${payload.appId}&notifyUrl=${payload.notifyUrl}&outTradeNo=${payload.outTradeNo}&returnUrl=${payload.returnUrl}&subject=${payload.subject}&timestamp=${payload.timestamp}&totalAmount=${payload.totalAmount}&key=${this.appKey}`;
    const sign = crypto.createHash("sha256").update(stringToSign).digest("hex");
    payload.sign = sign;

    const checkoutUrl = `${returnUrl || "/buyer/checkout/payment/mock"}?outTradeNo=${outTradeNo}&order_id=${order.id}&provider=telebirr&status=success`;

    return {
      checkout_url: checkoutUrl,
      transaction_id: outTradeNo,
      provider: "telebirr",
      payload,
    };
  }

  verifyWebhookSignature({ headers, body, rawBody, secret }) {
    const signature = headers["telebirr-signature"] || headers["x-telebirr-signature"];
    if (!signature) {
      return false;
    }

    const key = secret || this.webhookSecret;
    const content = rawBody ? rawBody.toString("utf8") : JSON.stringify(body);
    const expected = crypto.createHmac("sha256", key).update(content).digest("hex");

    return this.timingSafeCompare(signature, expected);
  }

  async verifyTransaction({ reference }) {
    // In production, queries Telebirr trade query endpoint
    return false;
  }
}

module.exports = TelebirrAdapter;

