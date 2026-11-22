const crypto = require("crypto");

class BasePaymentAdapter {
  constructor(name) {
    this.name = name;
  }

  async initiatePayment({ order, amount, returnUrl, user }) {
    throw new Error(`initiatePayment not implemented for ${this.name}`);
  }

  verifyWebhookSignature({ headers, body, rawBody, secret }) {
    throw new Error(`verifyWebhookSignature not implemented for ${this.name}`);
  }

  async verifyTransaction({ reference }) {
    throw new Error(`verifyTransaction not implemented for ${this.name}`);
  }

  timingSafeCompare(a, b) {
    if (!a || !b) return false;
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }
}

module.exports = BasePaymentAdapter;
