const addressModel = require("../models/addressModel");
const deliveryPricingService = require("./deliveryPricingService");

const createServiceError = (message, statusCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const validateCoordinatesAndZone = async ({ latitude, longitude, region, city, subcity, landmark, line1 }) => {
  let verification_status = "unverified";
  let latNum = null;
  let lngNum = null;

  if (latitude !== undefined && latitude !== null && latitude !== "") {
    latNum = Number(latitude);
    lngNum = Number(longitude);
    if (
      Number.isNaN(latNum) ||
      Number.isNaN(lngNum) ||
      latNum < -90 ||
      latNum > 90 ||
      lngNum < -180 ||
      lngNum > 180 ||
      (latNum === 0 && lngNum === 0)
    ) {
      throw createServiceError("Invalid GPS coordinates provided", 400);
    }
    // Check Ethiopia realistic bounding box (approx lat 3..15, lng 33..48)
    if (latNum < 3 || latNum > 15.5 || lngNum < 32.5 || lngNum > 48.5) {
      verification_status = "outside_service_area";
    } else {
      verification_status = "verified";
    }
  } else if (city || region || landmark || line1) {
    verification_status = "verified";
  }

  const addressText = [landmark, subcity, city, region, line1].filter(Boolean).join(", ");
  const zoneMatch = await deliveryPricingService.resolveDestinationZone({
    addressText,
    latitude: latNum,
    longitude: lngNum,
  });

  if (zoneMatch && zoneMatch.operational_status === "temporarily_restricted") {
    verification_status = "outside_service_area";
  }

  return { latNum, lngNum, verification_status, zoneMatch };
};

const listMyAddresses = async (actor) => {
  return addressModel.listBuyerAddresses(Number(actor.id));
};

const createMyAddress = async ({ actor, payload }) => {
  const city = String(payload.city || payload.zone_area || "").trim();
  const line1 = String(payload.line1 || payload.landmark || "").trim();
  if (!city && !line1) {
    throw createServiceError("At least city/town or landmark/street address is required", 400);
  }

  const { latNum, lngNum, verification_status, zoneMatch } = await validateCoordinatesAndZone({
    latitude: payload.latitude,
    longitude: payload.longitude,
    region: payload.region,
    city,
    subcity: payload.subcity,
    landmark: payload.landmark,
    line1,
  });

  const address = await addressModel.createAddress({
    user_id: Number(actor.id),
    label: String(payload.label || "Delivery Address").trim(),
    line1: line1 || city,
    line2: payload.line2 || null,
    city: city || "Addis Ababa",
    state: payload.region || payload.state || null,
    region: payload.region || null,
    zone_area: payload.zone_area || null,
    subcity: payload.subcity || null,
    woreda: payload.woreda || null,
    landmark: payload.landmark || null,
    latitude: latNum,
    longitude: lngNum,
    delivery_instructions: payload.delivery_instructions || null,
    contact_name: payload.contact_name || actor.name || null,
    contact_phone: payload.contact_phone || null,
    verification_status,
    is_default: Boolean(payload.is_default),
  });

  return { address, detected_zone: zoneMatch };
};

const updateMyAddress = async ({ actor, addressId, payload }) => {
  const existing = await addressModel.getAddressById(Number(addressId));
  if (!existing) throw createServiceError("Address not found", 404);
  if (Number(existing.user_id) !== Number(actor.id)) {
    throw createServiceError("Forbidden: you can only modify your own saved addresses", 403);
  }

  const { latNum, lngNum, verification_status } = await validateCoordinatesAndZone({
    latitude: payload.latitude !== undefined ? payload.latitude : existing.latitude,
    longitude: payload.longitude !== undefined ? payload.longitude : existing.longitude,
    region: payload.region !== undefined ? payload.region : existing.region,
    city: payload.city !== undefined ? payload.city : existing.city,
    subcity: payload.subcity !== undefined ? payload.subcity : existing.subcity,
    landmark: payload.landmark !== undefined ? payload.landmark : existing.landmark,
    line1: payload.line1 !== undefined ? payload.line1 : existing.line1,
  });

  const updated = await addressModel.updateAddress(Number(addressId), Number(actor.id), {
    ...payload,
    latitude: latNum !== null ? latNum : undefined,
    longitude: lngNum !== null ? lngNum : undefined,
    verification_status,
  });
  return updated;
};

const deleteMyAddress = async ({ actor, addressId }) => {
  const existing = await addressModel.getAddressById(Number(addressId));
  if (!existing) throw createServiceError("Address not found", 404);
  if (Number(existing.user_id) !== Number(actor.id)) {
    throw createServiceError("Forbidden: cannot delete another user's address", 403);
  }
  await addressModel.deleteAddress(Number(addressId), Number(actor.id));
  return { deleted: true, address_id: Number(addressId) };
};

module.exports = {
  createMyAddress,
  deleteMyAddress,
  listMyAddresses,
  updateMyAddress,
  validateCoordinatesAndZone,
};
