// Authoritative Distance + Weight-based Ethiopian Agricultural Delivery Fee Estimator

const ETHIOPIAN_HUB_COORDS = [
  { names: ["addis ababa", "addis", "bole", "kirkos", "yeka", "arada", "kolfe", "akaki", "kality", "sarbet", "mercato", "nifas silk", "lafto", "gullele", "lideta"], lat: 9.0054, lng: 38.7636, label: "Addis Ababa" },
  { names: ["bishoftu", "debre zeit", "debrezeit"], lat: 8.7522, lng: 38.9785, label: "Bishoftu" },
  { names: ["mojo", "modjo"], lat: 8.5868, lng: 39.1211, label: "Mojo" },
  { names: ["adama", "nazret", "nazareth"], lat: 8.54, lng: 39.27, label: "Adama" },
  { names: ["ziway", "batu", "zeway"], lat: 7.934, lng: 38.719, label: "Batu (Ziway)" },
  { names: ["shashamane", "shashemene"], lat: 7.2, lng: 38.6, label: "Shashamane" },
  { names: ["hawassa", "awasa"], lat: 7.0621, lng: 38.4763, label: "Hawassa" },
  { names: ["ambo"], lat: 8.9833, lng: 37.85, label: "Ambo" },
  { names: ["jimma"], lat: 7.6734, lng: 36.8344, label: "Jimma" },
  { names: ["bahir dar", "bahirdar"], lat: 11.5742, lng: 37.3614, label: "Bahir Dar" },
  { names: ["gondar", "gonder"], lat: 12.6, lng: 37.4667, label: "Gondar" },
  { names: ["dire dawa", "diredawa"], lat: 9.6009, lng: 41.8501, label: "Dire Dawa" },
  { names: ["harar"], lat: 9.3139, lng: 42.1182, label: "Harar" },
  { names: ["mekelle", "mekele"], lat: 13.4967, lng: 39.4753, label: "Mekelle" },
  { names: ["dessie", "desse"], lat: 11.1333, lng: 39.6333, label: "Dessie" },
  { names: ["arba minch", "arbaminch"], lat: 6.0333, lng: 37.55, label: "Arba Minch" },
  { names: ["awash", "metehara"], lat: 8.9833, lng: 40.1667, label: "Awash Basin" },
  { names: ["koka", "lake koka"], lat: 8.4667, lng: 39.0667, label: "Lake Koka" },
  { names: ["oromia", "central ethiopia"], lat: 8.75, lng: 38.85, label: "Oromia Corridor" },
  { names: ["amhara"], lat: 11.5, lng: 37.8, label: "Amhara Region" },
  { names: ["sidama"], lat: 6.9, lng: 38.45, label: "Sidama Region" },
];

const UNIT_WEIGHT_KG_MAP = {
  kg: 1,
  kilogram: 1,
  kilograms: 1,
  quintal: 100,
  qt: 100,
  crate: 25,
  box: 20,
  bag: 50,
  sack: 50,
  piece: 1,
  unit: 1,
};

const toRadians = (deg) => (deg * Math.PI) / 180;

const haversineDistanceKm = (a, b) => {
  const R = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * sinDLng * sinDLng;
  // Road factor 1.28x straight-line distance for realistic highway routing
  return Math.round(R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) * 1.28 * 10) / 10;
};

const resolveLocationCoord = (addressText) => {
  const text = String(addressText || "").toLowerCase();
  if (!text) return null;
  for (const hub of ETHIOPIAN_HUB_COORDS) {
    if (hub.names.some((n) => text.includes(n))) {
      return hub;
    }
  }
  return null;
};

const computeItemWeightKg = (item) => {
  const qty = Number(item.quantity || 1);
  const unitKey = String(item.unit || "kg").trim().toLowerCase();
  const multiplier = UNIT_WEIGHT_KG_MAP[unitKey] ?? 1;
  return Math.max(0.5, qty * multiplier);
};

const estimateDistanceKm = (originText, destinationText) => {
  const originCoord = resolveLocationCoord(originText);
  const destCoord = resolveLocationCoord(destinationText);

  if (originCoord && destCoord) {
    if (originCoord.label === destCoord.label) {
      return { distance_km: 12, origin_hub: originCoord.label, dest_hub: destCoord.label, matched: true };
    }
    return {
      distance_km: Math.max(8, haversineDistanceKm(originCoord, destCoord)),
      origin_hub: originCoord.label,
      dest_hub: destCoord.label,
      matched: true,
    };
  }

  // Fallback corridor distance when free-form addresses don't match known towns
  const normalizedA = String(originText || "").trim().toLowerCase();
  const normalizedB = String(destinationText || "").trim().toLowerCase();
  if (normalizedA && normalizedB && normalizedA === normalizedB) {
    return { distance_km: 10, origin_hub: originCoord?.label || "Local Farm", dest_hub: destCoord?.label || "Local Dropoff", matched: false };
  }
  return { distance_km: 25, origin_hub: originCoord?.label || "Regional Origin", dest_hub: destCoord?.label || "Destination", matched: false };
};

const estimateSuborderDeliveryFee = ({
  fulfillment_type = "farmer_pickup",
  origin_address = "",
  destination_address = "",
  items = [],
  delivery_radius_km = 0,
}) => {
  const mode = String(fulfillment_type || "farmer_pickup").trim().toLowerCase();
  const totalWeightKg = Math.round(
    items.reduce((sum, item) => sum + computeItemWeightKg(item), 0) * 10
  ) / 10;

  const { distance_km, origin_hub, dest_hub, matched } = estimateDistanceKm(
    origin_address,
    destination_address
  );

  if (mode === "farmer_pickup") {
    return {
      fulfillment_type: "farmer_pickup",
      shipping_fee: 0,
      distance_km,
      total_weight_kg: totalWeightKg,
      estimated_eta: "Ready after farm packing",
      within_farmer_radius: true,
      route_label: `${origin_hub} Farm Gate`,
      breakdown: {
        base_fee: 0,
        distance_fee: 0,
        weight_fee: 0,
        service_tier: "Farm Gate Pickup (Free)",
      },
    };
  }

  if (mode === "farmer_delivery") {
    const baseFee = 30;
    const distanceFee = Math.round(distance_km * 1.4);
    const weightFee = totalWeightKg > 25 ? Math.round((totalWeightKg - 25) * 0.6) : 0;
    const totalFee = Math.min(850, Math.max(40, baseFee + distanceFee + weightFee));
    const maxRadius = Number(delivery_radius_km || 0);
    const withinRadius = maxRadius <= 0 || distance_km <= maxRadius;

    return {
      fulfillment_type: "farmer_delivery",
      shipping_fee: totalFee,
      distance_km,
      total_weight_kg: totalWeightKg,
      estimated_eta: distance_km <= 30 ? "Within 6–12 hours" : "Within 24–48 hours",
      within_farmer_radius: withinRadius,
      route_label: `${origin_hub} → ${dest_hub}`,
      breakdown: {
        base_fee: baseFee,
        distance_fee: distanceFee,
        weight_fee: weightFee,
        service_tier: matched ? "Distance & Weight Direct Rate" : "Standard Regional Direct Rate",
      },
    };
  }

  // delivery_partner (platform courier fleet)
  const baseFee = 45;
  const distanceFee = Math.round(distance_km * 2.1);
  const weightFee = totalWeightKg > 20 ? Math.round((totalWeightKg - 20) * 0.85) : 0;
  const totalFee = Math.min(1800, Math.max(60, baseFee + distanceFee + weightFee));

  return {
    fulfillment_type: "delivery_partner",
    shipping_fee: totalFee,
    distance_km,
    total_weight_kg: totalWeightKg,
    estimated_eta:
      distance_km <= 25
        ? "Same-day (2–4 hours)"
        : distance_km <= 120
        ? "Same-day / Next morning"
        : "24–48 hours Inter-city",
    within_farmer_radius: true,
    route_label: `${origin_hub} → ${dest_hub}`,
    breakdown: {
      base_fee: baseFee,
      distance_fee: distanceFee,
      weight_fee: weightFee,
      service_tier: matched ? "Courier Fleet Distance + Cargo Rate" : "Standard Courier Fleet Rate",
    },
  };
};

module.exports = {
  computeItemWeightKg,
  estimateDistanceKm,
  estimateSuborderDeliveryFee,
};
