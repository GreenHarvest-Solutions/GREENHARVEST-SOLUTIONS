const ROLE_ALIASES = {
  admin: "admin",
  administrator: "admin",
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
const ALLOWED_PUBLIC_REGISTRATION_ROLES = ["farmer", "buyer", "delivery_partner"];
const PUBLIC_REGISTRATION_ROLES = ALLOWED_PUBLIC_REGISTRATION_ROLES;

const normalizeRole = (role) => {
  if (role === undefined || role === null) {
    return null;
  }

  const rawRole = String(role).trim().toLowerCase();
  return ROLE_ALIASES[rawRole] || null;
};

const isAllowedRole = (role) => {
  return ALLOWED_ROLES.includes(normalizeRole(role));
};

const isAllowedPublicRegistrationRole = (role) => {
  return ALLOWED_PUBLIC_REGISTRATION_ROLES.includes(normalizeRole(role));
};

const isPublicRegistrationRole = isAllowedPublicRegistrationRole;

module.exports = {
  ALLOWED_ROLES,
  ALLOWED_PUBLIC_REGISTRATION_ROLES,
  PUBLIC_REGISTRATION_ROLES,
  isAllowedRole,
  isAllowedPublicRegistrationRole,
  isPublicRegistrationRole,
  normalizeRole,
};
