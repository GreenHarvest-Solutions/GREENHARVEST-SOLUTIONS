const ChapaAdapter = require("./chapaAdapter");
const TelebirrAdapter = require("./telebirrAdapter");
const CbeBirrAdapter = require("./cbeBirrAdapter");

const adapters = {
  chapa: new ChapaAdapter(),
  telebirr: new TelebirrAdapter(),
  cbe_birr: new CbeBirrAdapter(),
  cbebirr: new CbeBirrAdapter(),
  cbe: new CbeBirrAdapter(),
};

const getAdapter = (providerName) => {
  if (!providerName) {
    throw new Error("Payment provider name is required");
  }
  const key = String(providerName).trim().toLowerCase();
  const adapter = adapters[key];
  if (!adapter) {
    throw new Error(`Unsupported payment provider: ${providerName}. Supported: chapa, telebirr, cbe_birr`);
  }
  return adapter;
};

module.exports = {
  getAdapter,
  adapters,
};

