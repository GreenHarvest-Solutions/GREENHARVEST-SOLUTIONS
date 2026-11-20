const ROLE_ALIASES = {
  admin: "admin",
  farmer: "farmer",
  buyer: "buyer",
  deliverypartner: "delivery_partner",
  delivery_partner: "delivery_partner",
  "delivery partner": "delivery_partner",
  delivery: "delivery_partner",
  driver: "delivery_partner",
  fieldagent: "field_agent",
  field_agent: "field_agent",
  "field agent": "field_agent",
};

const ALLOWED_ROLES = ["admin", "farmer", "buyer", "delivery_partner", "field_agent"];
const PUBLIC_REGISTRATION_ROLES = ["farmer", "buyer", "delivery_partner"];

const normalizeRole = (role) => {
  if (role === undefined || role === null) {
    return "";
  }

  const normalized = String(role).trim();

  if (!normalized) {
    return "";
  }

  const key = normalized.toLowerCase().replace(/[\s-]+/g, "_");
  return ROLE_ALIASES[key] || key;
};

const isAllowedRole = (role) => {
  return ALLOWED_ROLES.includes(normalizeRole(role));
};

const isPublicRegistrationRole = (role) => {
  return PUBLIC_REGISTRATION_ROLES.includes(normalizeRole(role));
};

module.exports = {
  ALLOWED_ROLES,
  PUBLIC_REGISTRATION_ROLES,
  isAllowedRole,
  isPublicRegistrationRole,
  normalizeRole,
};
