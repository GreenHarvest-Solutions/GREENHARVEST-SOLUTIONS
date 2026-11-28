// Enterprise Configurable Geographic Delivery Pricing, Zone Serviceability,
// Routing Provider (+ Honest Fallback), Driver Compensation & Quotation Engine
const crypto = require("crypto");
const { pool } = require("../config/db");

const ETHIOPIAN_HUB_COORDS = [
  { names: ["addis ababa", "addis", "bole", "kirkos", "yeka", "arada", "kolfe", "akaki", "kality", "sarbet", "mercato", "nifas silk", "lafto", "gullele", "lideta"], lat: 9.0054, lng: 38.7636, label: "Addis Ababa", zone_code: "ZONE-ADD-URBAN" },
  { names: ["bishoftu", "debre zeit", "debrezeit"], lat: 8.7522, lng: 38.9785, label: "Bishoftu", zone_code: "ZONE-ORO-SUB" },
  { names: ["mojo", "modjo"], lat: 8.5868, lng: 39.1211, label: "Mojo", zone_code: "ZONE-ORO-SUB" },
  { names: ["adama", "nazret", "nazareth"], lat: 8.54, lng: 39.27, label: "Adama", zone_code: "ZONE-ORO-SUB" },
  { names: ["sebeta", "burayu", "sululta", "dukem", "gelan", "legetafo"], lat: 8.92, lng: 38.65, label: "Sheger Metro", zone_code: "ZONE-ORO-SUB" },
  { names: ["debre birhan", "debre berhan"], lat: 9.6795, lng: 39.5326, label: "Debre Birhan", zone_code: "ZONE-REG-RURAL" },
  { names: ["ziway", "batu", "zeway"], lat: 7.934, lng: 38.719, label: "Batu (Ziway)", zone_code: "ZONE-REG-RURAL" },
  { names: ["shashamane", "shashemene"], lat: 7.2, lng: 38.6, label: "Shashamane", zone_code: "ZONE-REG-RURAL" },
  { names: ["hawassa", "awasa"], lat: 7.0621, lng: 38.4763, label: "Hawassa", zone_code: "ZONE-REG-RURAL" },
  { names: ["ambo"], lat: 8.9833, lng: 37.85, label: "Ambo", zone_code: "ZONE-REG-RURAL" },
  { names: ["jimma"], lat: 7.6734, lng: 36.8344, label: "Jimma", zone_code: "ZONE-REG-RURAL" },
  { names: ["bahir dar", "bahirdar"], lat: 11.5742, lng: 37.3614, label: "Bahir Dar", zone_code: "ZONE-REG-RURAL" },
  { names: ["gondar", "gonder"], lat: 12.6, lng: 37.4667, label: "Gondar", zone_code: "ZONE-REG-RURAL" },
  { names: ["dire dawa", "diredawa"], lat: 9.6009, lng: 41.8501, label: "Dire Dawa", zone_code: "ZONE-REG-RURAL" },
  { names: ["harar"], lat: 9.3139, lng: 42.1182, label: "Harar", zone_code: "ZONE-REG-RURAL" },
  { names: ["mekelle", "mekele"], lat: 13.4967, lng: 39.4753, label: "Mekelle", zone_code: "ZONE-REG-RURAL" },
  { names: ["dessie", "desse"], lat: 11.1333, lng: 39.6333, label: "Dessie", zone_code: "ZONE-REG-RURAL" },
  { names: ["arba minch", "arbaminch"], lat: 6.0333, lng: 37.55, label: "Arba Minch", zone_code: "ZONE-REG-RURAL" },
  { names: ["awash", "metehara"], lat: 8.9833, lng: 40.1667, label: "Awash Basin", zone_code: "ZONE-REG-RURAL" },
  { names: ["koka", "lake koka"], lat: 8.4667, lng: 39.0667, label: "Lake Koka", zone_code: "ZONE-REG-RURAL" },
  { names: ["borena", "somali", "afar", "gambela", "benishangul", "remote", "frontier"], lat: 6.5, lng: 41.2, label: "Remote Corridor", zone_code: "ZONE-REMOTE-HL" },
  { names: ["oromia", "central ethiopia"], lat: 8.75, lng: 38.85, label: "Oromia Corridor", zone_code: "ZONE-ORO-SUB" },
  { names: ["amhara"], lat: 11.5, lng: 37.8, label: "Amhara Region", zone_code: "ZONE-REG-RURAL" },
  { names: ["sidama"], lat: 6.9, lng: 38.45, label: "Sidama Region", zone_code: "ZONE-REG-RURAL" },
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

const haversineKm = (a, b, multiplier = 1.28) => {
  const R = 6371;
  const dLat = toRadians(Number(b.lat) - Number(a.lat));
  const dLng = toRadians(Number(b.lng) - Number(a.lng));
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRadians(Number(a.lat))) * Math.cos(toRadians(Number(b.lat))) * sinDLng * sinDLng;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) * multiplier * 10) / 10;
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

const computeItemsCharacteristics = (items = []) => {
  let totalWeightKg = 0;
  let totalVolumeM3 = 0;
  let itemCount = 0;
  let requiresColdChain = false;
  let hasFragileProduce = false;

  for (const item of items) {
    const qty = Number(item.quantity || 1);
    const weightKg = computeItemWeightKg(item);
    totalWeightKg += weightKg;
    // Approximate agricultural crate/bag packing volume: ~0.0018 m3 per kg
    totalVolumeM3 += weightKg * 0.0018;
    itemCount += qty;
    if (item.cold_chain_required) requiresColdChain = true;
    const nameLower = String(item.name || item.product_name || "").toLowerCase();
    if (["tomato", "avocado", "strawberry", "mango", "banana", "dairy", "egg", "lettuce"].some((w) => nameLower.includes(w))) {
      hasFragileProduce = true;
    }
  }

  return {
    total_weight_kg: Math.round(totalWeightKg * 10) / 10,
    total_volume_m3: Math.round(totalVolumeM3 * 1000) / 1000,
    item_count: Math.max(1, Math.round(itemCount)),
    cold_chain_required: requiresColdChain,
    fragile_produce: hasFragileProduce,
  };
};

const validateGpsPair = (lat, lng) => {
  if (lat === undefined || lat === null || lat === "" || lng === undefined || lng === null || lng === "") {
    return { provided: false, valid: false };
  }
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (
    Number.isNaN(latNum) ||
    Number.isNaN(lngNum) ||
    latNum < -90 ||
    latNum > 90 ||
    lngNum < -180 ||
    lngNum > 180 ||
    (latNum === 0 && lngNum === 0)
  ) {
    return { provided: true, valid: false, reason: "GPS coordinates out of valid geographic bounds" };
  }
  const inEthiopia = latNum >= 3.0 && latNum <= 15.5 && lngNum >= 32.5 && lngNum <= 48.5;
  return { provided: true, valid: true, in_service_country: inEthiopia, lat: latNum, lng: lngNum };
};

/**
 * Routing abstraction: uses external OSRM / configurable provider if enabled & reachable,
 * otherwise uses clear, honestly flagged fallback estimates.
 */
const computeRouteDistance = async ({
  origin_address = "",
  origin_lat = null,
  origin_lng = null,
  destination_address = "",
  destination_lat = null,
  destination_lng = null,
  routingProviderUrl = process.env.ROUTING_PROVIDER_URL || null,
}) => {
  const oGps = validateGpsPair(origin_lat, origin_lng);
  const dGps = validateGpsPair(destination_lat, destination_lng);

  if (dGps.provided && !dGps.valid) {
    return {
      valid_destination: false,
      error_reason: dGps.reason || "Invalid buyer GPS coordinates",
      distance_km: 0,
      estimated_duration_minutes: 0,
      distance_source: "invalid_coordinates",
      is_estimated_fallback: true,
      route_disclaimer: "Buyer destination GPS coordinates are invalid",
    };
  }

  if (dGps.provided && !dGps.in_service_country) {
    return {
      valid_destination: true,
      outside_country: true,
      distance_km: 0,
      estimated_duration_minutes: 0,
      distance_source: "outside_service_area",
      is_estimated_fallback: true,
      route_disclaimer: "Destination GPS falls outside Ethiopian serviceable geography",
    };
  }

  const originHub = resolveLocationCoord(origin_address);
  const destHub = resolveLocationCoord(destination_address);

  const effectiveOriginCoord = oGps.valid ? { lat: oGps.lat, lng: oGps.lng, label: originHub?.label || "Branch Pin" } : originHub;
  const effectiveDestCoord = dGps.valid ? { lat: dGps.lat, lng: dGps.lng, label: destHub?.label || "Buyer Pin" } : destHub;

  // 1. Live External Routing Provider (e.g. OSRM) if configured AND coordinates available
  if (routingProviderUrl && oGps.valid && dGps.valid) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const url = `${routingProviderUrl.replace(/\/$/, "")}/route/v1/driving/${oGps.lng},${oGps.lat};${dGps.lng},${dGps.lat}?overview=false`;
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (resp.ok) {
        const data = await resp.json();
        const route = data?.routes?.[0];
        if (route && Number(route.distance) >= 0) {
          const km = Math.max(1, Math.round((Number(route.distance) / 1000) * 10) / 10);
          const mins = Math.max(15, Math.round(Number(route.duration || km * 90) / 60));
          return {
            valid_destination: true,
            distance_km: km,
            estimated_duration_minutes: mins,
            origin_hub: effectiveOriginCoord.label,
            dest_hub: effectiveDestCoord.label,
            distance_source: "routing_provider",
            is_estimated_fallback: false,
            route_disclaimer: "Calculated from road routing provider",
          };
        }
      }
    } catch (_) {
      // Routing provider unavailable -> graceful explicit fallback below
    }
  }

  // 2. GPS Haversine Fallback (when both sides have GPS pins but routing provider unavailable)
  if (oGps.valid && dGps.valid) {
    const km = Math.max(3, haversineKm(oGps, dGps, 1.28));
    return {
      valid_destination: true,
      distance_km: km,
      estimated_duration_minutes: Math.max(25, Math.round((km / 38) * 60)),
      origin_hub: effectiveOriginCoord.label,
      dest_hub: effectiveDestCoord.label,
      distance_source: "gps_haversine_fallback",
      is_estimated_fallback: true,
      route_disclaimer: "Estimated road distance using GPS road factor (routing provider unavailable)",
    };
  }

  // 3. Corridor Hub Fallback
  if (effectiveOriginCoord && effectiveDestCoord) {
    const samePlace = effectiveOriginCoord.label === effectiveDestCoord.label;
    const km = samePlace ? 12 : Math.max(8, haversineKm(effectiveOriginCoord, effectiveDestCoord, 1.28));
    return {
      valid_destination: true,
      distance_km: km,
      estimated_duration_minutes: Math.max(30, Math.round((km / 36) * 60)),
      origin_hub: effectiveOriginCoord.label,
      dest_hub: effectiveDestCoord.label,
      distance_source: "corridor_fallback",
      is_estimated_fallback: true,
      route_disclaimer: "Estimated distance between Ethiopian hub coordinates (not exact road telemetry)",
    };
  }

  // 4. Generic Regional Fallback (unmatched free-text address without coordinates)
  const normA = String(origin_address || "").trim().toLowerCase();
  const normB = String(destination_address || "").trim().toLowerCase();
  const km = normA && normB && normA === normB ? 10 : 28;
  return {
    valid_destination: true,
    distance_km: km,
    estimated_duration_minutes: Math.round((km / 30) * 60),
    origin_hub: originHub?.label || "Branch Origin",
    dest_hub: destHub?.label || "Destination",
    distance_source: "regional_fallback",
    is_estimated_fallback: true,
    route_disclaimer: "Fallback corridor estimate used due to missing GPS/town match",
  };
};

// Synchronous helper maintained for quick inline estimation & backward compatibility
const estimateDistanceKm = (originText, destinationText) => {
  const originCoord = resolveLocationCoord(originText);
  const destCoord = resolveLocationCoord(destinationText);
  if (originCoord && destCoord) {
    if (originCoord.label === destCoord.label) {
      return { distance_km: 12, origin_hub: originCoord.label, dest_hub: destCoord.label, matched: true, is_estimated_fallback: true };
    }
    return {
      distance_km: Math.max(8, haversineKm(originCoord, destCoord)),
      origin_hub: originCoord.label,
      dest_hub: destCoord.label,
      matched: true,
      is_estimated_fallback: true,
    };
  }
  return {
    distance_km: 25,
    origin_hub: originCoord?.label || "Regional Origin",
    dest_hub: destCoord?.label || "Destination",
    matched: false,
    is_estimated_fallback: true,
  };
};

// Zone detection from delivery_zones table
const resolveDestinationZone = async ({ addressText = "", latitude = null, longitude = null }) => {
  const zonesRes = await pool.query(`SELECT * FROM delivery_zones ORDER BY id ASC`);
  const zones = zonesRes.rows;
  const textLower = String(addressText || "").toLowerCase();

  // Check explicit GPS rejection / non-Ethiopia
  const gps = validateGpsPair(latitude, longitude);
  if (gps.provided && (!gps.valid || !gps.in_service_country)) {
    return {
      id: null,
      code: "OUTSIDE_BOUNDS",
      name: "Outside Ethiopian Serviceable Coordinates",
      zone_type: "restricted",
      operational_status: "temporarily_restricted",
      serviceable: false,
      reason: gps.reason || "Coordinates lie outside national delivery coverage",
    };
  }

  // 1. Match keyword in active/restricted zones first (most explicit signal)
  for (const z of zones) {
    const keywords = Array.isArray(z.city_keywords) ? z.city_keywords : [];
    if (keywords.some((kw) => kw && textLower.includes(String(kw).toLowerCase()))) {
      return {
        ...z,
        serviceable: z.zone_type !== "restricted" && z.operational_status === "active",
      };
    }
  }

  // 2. Match GPS circle radius if coordinates provided
  if (gps.valid) {
    let bestZone = null;
    let bestDist = Infinity;
    for (const z of zones) {
      if (z.center_lat !== null && z.center_lng !== null) {
        const dist = haversineKm(gps, { lat: z.center_lat, lng: z.center_lng }, 1.0);
        if (dist <= Number(z.radius_km || 50) && dist < bestDist) {
          bestDist = dist;
          bestZone = z;
        }
      }
    }
    if (bestZone) {
      return {
        ...bestZone,
        serviceable: bestZone.zone_type !== "restricted" && bestZone.operational_status === "active",
      };
    }
    // Unmatched Ethiopia GPS falls back to remote highland frontier
    const remote = zones.find((z) => z.zone_type === "remote");
    if (remote) {
      return { ...remote, serviceable: remote.operational_status === "active" };
    }
  }

  // 3. Corridor label heuristic fallback
  const coord = resolveLocationCoord(addressText);
  if (coord?.zone_code) {
    const matchedZone = zones.find((z) => z.code === coord.zone_code);
    if (matchedZone) {
      return {
        ...matchedZone,
        serviceable: matchedZone.zone_type !== "restricted" && matchedZone.operational_status === "active",
      };
    }
  }

  // Fallback default zone
  const suburban = zones.find((z) => z.code === "ZONE-ORO-SUB") || zones[0] || null;
  if (!suburban) return null;
  return {
    ...suburban,
    serviceable: suburban.zone_type !== "restricted" && suburban.operational_status === "active",
  };
};

const getActivePricingRule = async ({ delivery_method, zone = null }) => {
  const res = await pool.query(
    `SELECT *
     FROM delivery_pricing_rules
     WHERE delivery_method = $1
       AND is_active = TRUE
       AND effective_from <= NOW()
       AND (effective_to IS NULL OR effective_to > NOW())
     ORDER BY
       CASE WHEN zone_id = $2 THEN 1
            WHEN zone_type = $3 THEN 2
            WHEN zone_id IS NULL AND zone_type IS NULL THEN 3
            ELSE 4 END,
       version DESC,
       effective_from DESC
     LIMIT 1`,
    [delivery_method, zone?.id || null, zone?.zone_type || null]
  );
  if (res.rows[0]) return res.rows[0];

  // Fallback defaults if rules table wasn't seeded for some custom method
  if (delivery_method === "farmer_pickup") {
    return { id: null, version: 1, base_fee: 0, per_km_rate: 0, min_fee: 0, max_fee: 0, free_distance_km: 999, free_weight_kg: 99999, per_kg_rate: 0, per_m3_rate: 0, fragile_surcharge: 0, cold_chain_surcharge: 0, packaging_fee: 0, special_handling_fee: 0, remote_area_surcharge: 0, same_day_surcharge: 0, farmer_min_fee_policy: 0, farmer_max_fee_policy: 0, driver_base_payout: 0, driver_per_km_payout: 0, driver_per_kg_payout: 0, driver_zone_bonus: 0, platform_logistics_share_pct: 0, disclosure_note: "Free Farm Gate Pickup" };
  }
  if (delivery_method === "farmer_delivery") {
    return { id: null, version: 1, base_fee: 35, per_km_rate: 1.5, min_fee: 50, max_fee: 2500, free_distance_km: 0, free_weight_kg: 25, per_kg_rate: 0.65, per_m3_rate: 0, fragile_surcharge: 15, cold_chain_surcharge: 25, packaging_fee: 10, special_handling_fee: 0, remote_area_surcharge: 45, same_day_surcharge: 25, farmer_min_fee_policy: 0, farmer_max_fee_policy: 2500, driver_base_payout: 0, driver_per_km_payout: 0, driver_per_kg_payout: 0, driver_zone_bonus: 0, platform_logistics_share_pct: 0, disclosure_note: "Farmer Direct Policy Default" };
  }
  return { id: null, version: 1, base_fee: 45, per_km_rate: 2.2, min_fee: 65, max_fee: 4500, free_distance_km: 0, free_weight_kg: 20, per_kg_rate: 0.9, per_m3_rate: 0, fragile_surcharge: 20, cold_chain_surcharge: 35, packaging_fee: 15, special_handling_fee: 0, remote_area_surcharge: 60, same_day_surcharge: 35, farmer_min_fee_policy: 0, farmer_max_fee_policy: 4500, driver_base_payout: 35, driver_per_km_payout: 1.6, driver_per_kg_payout: 0.6, driver_zone_bonus: 0, platform_logistics_share_pct: 22, disclosure_note: "Courier Fleet Configurable Default" };
};

/**
 * Validate branch & zone serviceability for a specific delivery method & destination
 */
const checkBranchServiceability = async ({ branch, zone, route, delivery_method }) => {
  if (!branch) return { serviceable: false, reason: "Fulfillment branch not found" };
  if (branch.verification_status !== "verified") {
    return { serviceable: false, reason: `Branch "${branch.name}" is ${branch.verification_status} and cannot fulfill orders` };
  }
  if (!["active", "busy"].includes(branch.operational_status) || branch.service_available === false) {
    return { serviceable: false, reason: `Branch "${branch.name}" is currently ${branch.operational_status}` };
  }
  if (!route.valid_destination || route.outside_country) {
    return { serviceable: false, reason: route.route_disclaimer || "Destination coordinates are invalid or outside service region" };
  }
  if (zone && !zone.serviceable) {
    return { serviceable: false, reason: `Destination zone "${zone.name}" is ${zone.operational_status || "restricted"}` };
  }

  const supportedMethods = Array.isArray(branch.supported_delivery_methods)
    ? branch.supported_delivery_methods
    : ["farmer_pickup", "farmer_delivery", "delivery_partner"];

  if (!supportedMethods.includes(delivery_method)) {
    return { serviceable: false, reason: `Branch "${branch.name}" does not support ${delivery_method}` };
  }

  if (zone && Array.isArray(zone.supported_delivery_methods) && !zone.supported_delivery_methods.includes(delivery_method)) {
    return { serviceable: false, reason: `Delivery method "${delivery_method}" is not available in zone "${zone.name}"` };
  }

  // Check branch-specific service area restriction if configured for that branch
  if (zone?.id) {
    const bsaRes = await pool.query(
      `SELECT * FROM branch_service_areas WHERE branch_id = $1 AND zone_id = $2 LIMIT 1`,
      [branch.id, zone.id]
    );
    if (bsaRes.rows.length > 0) {
      const bsa = bsaRes.rows[0];
      if (!bsa.is_serviceable) {
        return { serviceable: false, reason: bsa.restrictions || `Branch "${branch.name}" does not deliver to ${zone.name}` };
      }
      if (bsa.max_distance_km && route.distance_km > Number(bsa.max_distance_km)) {
        return { serviceable: false, reason: `Destination exceeds branch zone limit (${bsa.max_distance_km} km)` };
      }
      if (Array.isArray(bsa.supported_methods) && !bsa.supported_methods.includes(delivery_method)) {
        return { serviceable: false, reason: `Branch service area excludes ${delivery_method}` };
      }
    }
  }

  // Farmer Direct radius enforcement
  if (delivery_method === "farmer_delivery") {
    const radius = Number(branch.delivery_radius_km || 0);
    if (radius > 0 && route.distance_km > radius) {
      return {
        serviceable: false,
        within_farmer_radius: false,
        reason: `Destination (${route.distance_km} km) exceeds farmer direct delivery coverage (${radius} km)`,
      };
    }
  }

  return { serviceable: true, within_farmer_radius: true };
};

/**
 * Full async enterprise estimation per branch & method backed by DB rules + zone + routing + driver compensation
 */
const estimateBranchDeliveryAsync = async ({
  branch,
  delivery_method = "farmer_pickup",
  destination_address = "",
  destination_lat = null,
  destination_lng = null,
  items = [],
  is_same_day = false,
  routingProviderUrl = process.env.ROUTING_PROVIDER_URL || null,
}) => {
  const mode = String(delivery_method || "farmer_pickup").trim().toLowerCase();
  const originAddress = branch?.physical_address || branch?.farm_location || "";
  const chars = computeItemsCharacteristics(items);

  const [route, zone] = await Promise.all([
    computeRouteDistance({
      origin_address: originAddress,
      origin_lat: branch?.latitude ?? null,
      origin_lng: branch?.longitude ?? null,
      destination_address,
      destination_lat,
      destination_lng,
      routingProviderUrl,
    }),
    resolveDestinationZone({
      addressText: destination_address,
      latitude: destination_lat,
      longitude: destination_lng,
    }),
  ]);

  const serviceCheck = await checkBranchServiceability({ branch, zone, route, delivery_method: mode });
  const rule = await getActivePricingRule({ delivery_method: mode, zone });

  if (mode === "farmer_pickup") {
    return {
      fulfillment_type: "farmer_pickup",
      serviceable: serviceCheck.serviceable,
      unserviceable_reason: serviceCheck.reason || null,
      zone,
      branch_id: branch?.id || null,
      branch_name: branch?.name || "Main Farm",
      origin_address: originAddress,
      distance_km: route.distance_km,
      estimated_duration_minutes: route.estimated_duration_minutes,
      distance_source: route.distance_source,
      is_estimated_fallback: route.is_estimated_fallback,
      route_disclaimer: route.route_disclaimer,
      total_weight_kg: chars.total_weight_kg,
      total_volume_m3: chars.total_volume_m3,
      item_count: chars.item_count,
      special_handling_flags: { cold_chain: chars.cold_chain_required, fragile: chars.fragile_produce },
      estimated_eta: "Ready after branch packing",
      within_farmer_radius: true,
      route_label: `${branch?.name || route.origin_hub} (Farm Gate Pickup)`,
      pricing_rule_id: rule.id || null,
      pricing_rule_version: Number(rule.version || 1),
      shipping_fee: 0,
      driver_compensation_amount: 0,
      platform_logistics_fee: 0,
      breakdown: {
        base_fee: 0,
        distance_fee: 0,
        weight_fee: 0,
        handling_fee: 0,
        remote_surcharge: 0,
        same_day_surcharge: 0,
        service_tier: "Farm Gate Pickup (Zero Fee)",
        pricing_rule_version: Number(rule.version || 1),
      },
      driver_payout_breakdown: { base_payout: 0, distance_payout: 0, weight_payout: 0, zone_bonus: 0, total_driver_earning: 0 },
    };
  }

  // Configurable rule rates (allowing zone overrides & bounded farmer direct overrides)
  let baseFee = Number(zone?.base_fee_override ?? rule.base_fee ?? 0);
  let perKmRate = Number(zone?.per_km_rate_override ?? rule.per_km_rate ?? 0);

  if (mode === "farmer_delivery" && branch) {
    if (branch.farmer_delivery_base_fee !== null && branch.farmer_delivery_base_fee !== undefined) {
      baseFee = Number(branch.farmer_delivery_base_fee);
    }
    if (branch.farmer_delivery_per_km_rate !== null && branch.farmer_delivery_per_km_rate !== undefined) {
      perKmRate = Number(branch.farmer_delivery_per_km_rate);
    }
  }

  const billableKm = Math.max(0, route.distance_km - Number(rule.free_distance_km || 0));
  const distanceFee = Math.round(billableKm * perKmRate * 100) / 100;

  const billableWeightKg = Math.max(0, chars.total_weight_kg - Number(rule.free_weight_kg || 0));
  const weightFee = Math.round((billableWeightKg * Number(rule.per_kg_rate || 0)) * 100) / 100;
  const volumeFee = Math.round((chars.total_volume_m3 * Number(rule.per_m3_rate || 0)) * 100) / 100;

  const handlingFee =
    Math.round(
      ((chars.fragile_produce ? Number(rule.fragile_surcharge || 0) : 0) +
        (chars.cold_chain_required ? Number(rule.cold_chain_surcharge || 0) : 0) +
        Number(rule.packaging_fee || 0) +
        Number(rule.special_handling_fee || 0)) *
        100
    ) / 100;

  const isRemoteZone = zone && ["remote", "rural"].includes(zone.zone_type);
  const remoteSurcharge = isRemoteZone
    ? Number(zone?.remote_surcharge || 0) + (zone.zone_type === "remote" ? Number(rule.remote_area_surcharge || 0) : 0)
    : 0;
  const sameDayFee = is_same_day ? Number(rule.same_day_surcharge || 0) : 0;

  const rawTotal = baseFee + distanceFee + weightFee + volumeFee + handlingFee + remoteSurcharge + sameDayFee;
  const minPolicy =
    mode === "farmer_delivery"
      ? Math.max(Number(rule.min_fee || 0), Number(rule.farmer_min_fee_policy || 0))
      : Math.max(Number(rule.min_fee || 0), Number(zone?.min_fee || 0));
  const maxPolicy =
    mode === "farmer_delivery"
      ? Math.min(Number(rule.max_fee || 5000), Number(rule.farmer_max_fee_policy || 2500))
      : Math.min(Number(rule.max_fee || 5000), Number(zone?.max_fee || 5000));

  const totalDeliveryFee = Math.round(Math.min(maxPolicy, Math.max(minPolicy, rawTotal)) * 100) / 100;

  // Independent Driver Compensation vs Buyer Charge (for GreenHarvest Courier Fleet)
  let driverBasePayout = 0;
  let driverDistancePayout = 0;
  let driverWeightPayout = 0;
  let driverZoneBonus = 0;
  let driverTotal = 0;
  let platformLogisticsFee = 0;

  if (mode === "delivery_partner") {
    driverBasePayout = Number(rule.driver_base_payout || 35);
    driverDistancePayout = Math.round(route.distance_km * Number(rule.driver_per_km_payout || 1.6) * 100) / 100;
    driverWeightPayout = Math.round(chars.total_weight_kg * Number(rule.driver_per_kg_payout || 0.5) * 100) / 100;
    driverZoneBonus = isRemoteZone ? Number(rule.driver_zone_bonus || 15) : 0;
    driverTotal = Math.round((driverBasePayout + driverDistancePayout + driverWeightPayout + driverZoneBonus) * 100) / 100;
    // Cap or keep distinct platform logistics share
    if (driverTotal > totalDeliveryFee * 0.92) {
      driverTotal = Math.round(totalDeliveryFee * (1 - Number(rule.platform_logistics_share_pct || 20) / 100) * 100) / 100;
    }
    platformLogisticsFee = Math.round(Math.max(0, totalDeliveryFee - driverTotal) * 100) / 100;
  }

  return {
    fulfillment_type: mode,
    serviceable: serviceCheck.serviceable,
    unserviceable_reason: serviceCheck.reason || null,
    within_farmer_radius: serviceCheck.within_farmer_radius !== false,
    zone,
    branch_id: branch?.id || null,
    branch_name: branch?.name || "Origin Branch",
    origin_address: originAddress,
    distance_km: route.distance_km,
    estimated_duration_minutes: route.estimated_duration_minutes,
    distance_source: route.distance_source,
    is_estimated_fallback: route.is_estimated_fallback,
    route_disclaimer: route.route_disclaimer,
    total_weight_kg: chars.total_weight_kg,
    total_volume_m3: chars.total_volume_m3,
    item_count: chars.item_count,
    special_handling_flags: { cold_chain: chars.cold_chain_required, fragile: chars.fragile_produce, same_day: Boolean(is_same_day) },
    estimated_eta:
      route.distance_km <= 25
        ? "Same-day (2–4 hours)"
        : route.distance_km <= 110
        ? "Same-day / Next morning"
        : "24–48 hours Inter-city",
    route_label: `${branch?.name || route.origin_hub} → ${route.dest_hub}`,
    pricing_rule_id: rule.id || null,
    pricing_rule_version: Number(rule.version || 1),
    shipping_fee: totalDeliveryFee,
    driver_compensation_amount: driverTotal,
    platform_logistics_fee: platformLogisticsFee,
    breakdown: {
      base_fee: baseFee,
      distance_fee: distanceFee,
      weight_fee: weightFee,
      volume_fee: volumeFee,
      handling_fee: handlingFee,
      remote_surcharge: remoteSurcharge,
      same_day_surcharge: sameDayFee,
      service_tier: rule.disclosure_note || `${mode} (${zone?.name || "Standard Zone"})`,
      pricing_rule_version: Number(rule.version || 1),
      distance_source: route.distance_source,
      is_estimated_fallback: route.is_estimated_fallback,
    },
    driver_payout_breakdown: {
      base_payout: driverBasePayout,
      distance_payout: driverDistancePayout,
      weight_payout: driverWeightPayout,
      zone_bonus: driverZoneBonus,
      total_driver_earning: driverTotal,
      platform_logistics_revenue: platformLogisticsFee,
    },
  };
};

// Synchronous compatibility wrapper preserving legacy unit tests & callers
const estimateSuborderDeliveryFee = ({
  fulfillment_type = "farmer_pickup",
  origin_address = "",
  destination_address = "",
  items = [],
  delivery_radius_km = 0,
}) => {
  const mode = String(fulfillment_type || "farmer_pickup").trim().toLowerCase();
  const totalWeightKg = Math.round(items.reduce((sum, item) => sum + computeItemWeightKg(item), 0) * 10) / 10;
  const { distance_km, origin_hub, dest_hub, matched } = estimateDistanceKm(origin_address, destination_address);

  if (mode === "farmer_pickup") {
    return {
      fulfillment_type: "farmer_pickup",
      shipping_fee: 0,
      distance_km,
      total_weight_kg: totalWeightKg,
      estimated_eta: "Ready after farm packing",
      within_farmer_radius: true,
      route_label: `${origin_hub} Farm Gate`,
      breakdown: { base_fee: 0, distance_fee: 0, weight_fee: 0, service_tier: "Farm Gate Pickup (Free)" },
    };
  }
  if (mode === "farmer_delivery") {
    const baseFee = 35;
    const distanceFee = Math.round(distance_km * 1.5);
    const weightFee = totalWeightKg > 25 ? Math.round((totalWeightKg - 25) * 0.65) : 0;
    const totalFee = Math.min(2500, Math.max(50, baseFee + distanceFee + weightFee));
    const maxRadius = Number(delivery_radius_km || 0);
    return {
      fulfillment_type: "farmer_delivery",
      shipping_fee: totalFee,
      distance_km,
      total_weight_kg: totalWeightKg,
      estimated_eta: distance_km <= 30 ? "Within 6–12 hours" : "Within 24–48 hours",
      within_farmer_radius: maxRadius <= 0 || distance_km <= maxRadius,
      route_label: `${origin_hub} → ${dest_hub}`,
      breakdown: { base_fee: baseFee, distance_fee: distanceFee, weight_fee: weightFee, service_tier: matched ? "Distance & Weight Direct Rate" : "Standard Regional Direct Rate" },
    };
  }
  const baseFee = 45;
  const distanceFee = Math.round(distance_km * 2.2);
  const weightFee = totalWeightKg > 20 ? Math.round((totalWeightKg - 20) * 0.9) : 0;
  const totalFee = Math.min(4500, Math.max(65, baseFee + distanceFee + weightFee));
  return {
    fulfillment_type: "delivery_partner",
    shipping_fee: totalFee,
    distance_km,
    total_weight_kg: totalWeightKg,
    estimated_eta: distance_km <= 25 ? "Same-day (2–4 hours)" : distance_km <= 120 ? "Same-day / Next morning" : "24–48 hours Inter-city",
    within_farmer_radius: true,
    route_label: `${origin_hub} → ${dest_hub}`,
    breakdown: { base_fee: baseFee, distance_fee: distanceFee, weight_fee: weightFee, service_tier: matched ? "Courier Fleet Distance + Cargo Rate" : "Standard Courier Fleet Rate" },
  };
};

// ============================================================
// Delivery Quotes Persistence & Quote Stability Lifecycle
// ============================================================

const getQuoteTtlMinutes = async () => {
  const res = await pool.query(`SELECT value FROM platform_settings WHERE key = 'quote_ttl_minutes' LIMIT 1`);
  return Number(res.rows[0]?.value?.value || 30);
};

const generateAndSaveDeliveryQuote = async ({
  buyer_id,
  branch,
  delivery_method,
  destination_address,
  destination_lat = null,
  destination_lng = null,
  items = [],
  is_same_day = false,
  ttlMinutes = null,
}) => {
  const est = await estimateBranchDeliveryAsync({
    branch,
    delivery_method,
    destination_address,
    destination_lat,
    destination_lng,
    items,
    is_same_day,
  });

  if (!est.serviceable) {
    throw Object.assign(new Error(est.unserviceable_reason || "Destination or branch is not serviceable for this method"), { statusCode: 409 });
  }

  const quoteTtl = ttlMinutes !== null ? Number(ttlMinutes) : await getQuoteTtlMinutes();
  const quoteCode = `QT-${buyer_id}-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 899)}`;
  const fingerprint = crypto
    .createHash("sha256")
    .update(JSON.stringify({
      branch_id: branch.id,
      delivery_method,
      destination_address: String(destination_address || "").trim().toLowerCase(),
      items: items.map((i) => ({ id: i.product_id, q: i.quantity })).sort((a, b) => a.id - b.id),
    }))
    .digest("hex");

  const res = await pool.query(
    `INSERT INTO delivery_quotes (
       quote_code, buyer_id, branch_id, farmer_id, zone_id, delivery_method,
       origin_snapshot, destination_snapshot, items_fingerprint,
       distance_km, estimated_duration_minutes, distance_source, is_estimated_fallback,
       total_weight_kg, total_volume_m3, item_count, special_handling_flags,
       fee_breakdown, driver_payout_breakdown, driver_compensation_amount,
       platform_logistics_fee, total_delivery_fee, pricing_rule_id, pricing_rule_version,
       status, expires_at
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,
       $18::jsonb,$19::jsonb,$20,$21,$22,$23,$24,'active', NOW() + ($25 || ' minutes')::INTERVAL
     ) RETURNING *`,
    [
      quoteCode,
      buyer_id,
      branch.id,
      branch.farmer_id,
      est.zone?.id || null,
      est.fulfillment_type,
      JSON.stringify({ branch_id: branch.id, name: branch.name, address: branch.physical_address, region: branch.region, lat: branch.latitude, lng: branch.longitude }),
      JSON.stringify({ address: destination_address, lat: destination_lat, lng: destination_lng, zone_name: est.zone?.name || null }),
      fingerprint,
      est.distance_km,
      est.estimated_duration_minutes,
      est.distance_source,
      est.is_estimated_fallback,
      est.total_weight_kg,
      est.total_volume_m3,
      est.item_count,
      JSON.stringify(est.special_handling_flags),
      JSON.stringify(est.breakdown),
      JSON.stringify(est.driver_payout_breakdown),
      est.driver_compensation_amount,
      est.platform_logistics_fee,
      est.shipping_fee,
      est.pricing_rule_id,
      est.pricing_rule_version,
      quoteTtl,
    ]
  );

  return { quote: res.rows[0], estimate: est };
};

const validateAndAcceptQuoteForOrder = async (client, { quote_id, buyer_id, branch_id, delivery_method, destination_address }) => {
  const qRes = await client.query(`SELECT * FROM delivery_quotes WHERE id = $1 FOR UPDATE`, [Number(quote_id)]);
  if (qRes.rows.length === 0) {
    throw Object.assign(new Error("Delivery quote not found"), { statusCode: 404 });
  }
  const quote = qRes.rows[0];
  if (Number(quote.buyer_id) !== Number(buyer_id)) {
    throw Object.assign(new Error("Delivery quote does not belong to buyer"), { statusCode: 403 });
  }
  if (quote.status === "expired" || new Date(quote.expires_at).getTime() < Date.now()) {
    await client.query(`UPDATE delivery_quotes SET status = 'expired' WHERE id = $1`, [quote.id]);
    throw Object.assign(new Error("Delivery quote has expired before checkout; please refresh your quote"), { statusCode: 409 });
  }
  if (quote.status !== "active") {
    throw Object.assign(new Error(`Delivery quote cannot be reused (status: ${quote.status})`), { statusCode: 409 });
  }
  if (Number(quote.branch_id) !== Number(branch_id) || quote.delivery_method !== delivery_method) {
    throw Object.assign(new Error("Branch or delivery method changed since quotation; please request a new quote"), { statusCode: 409 });
  }
  const savedDest = String(quote.destination_snapshot?.address || "").trim().toLowerCase();
  const reqDest = String(destination_address || "").trim().toLowerCase();
  if (savedDest && reqDest && savedDest !== reqDest) {
    throw Object.assign(new Error("Destination address changed since quotation; please re-quote"), { statusCode: 409 });
  }

  const accRes = await client.query(
    `UPDATE delivery_quotes SET status = 'accepted', accepted_at = NOW() WHERE id = $1 RETURNING *`,
    [quote.id]
  );
  return accRes.rows[0];
};

// Admin Pricing Configuration CRUD
const listPricingRulesAdmin = async () => {
  const res = await pool.query(
    `SELECT pr.*, dz.name AS zone_name, dz.code AS zone_code
     FROM delivery_pricing_rules pr
     LEFT JOIN delivery_zones dz ON dz.id = pr.zone_id
     ORDER BY pr.is_active DESC, pr.delivery_method ASC, pr.version DESC, pr.id DESC`
  );
  return res.rows;
};

const createPricingRuleVersion = async ({ actorId, payload }) => {
  const method = String(payload.delivery_method || "").trim().toLowerCase();
  if (!["farmer_pickup", "farmer_delivery", "delivery_partner"].includes(method)) {
    throw Object.assign(new Error("Valid delivery_method is required"), 400);
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const verRes = await client.query(
      `SELECT COALESCE(MAX(version), 0) AS max_ver FROM delivery_pricing_rules WHERE delivery_method = $1 AND COALESCE(zone_type, '') = COALESCE($2, '')`,
      [method, payload.zone_type || null]
    );
    const nextVersion = Number(verRes.rows[0]?.max_ver || 0) + 1;

    if (payload.deactivate_previous !== false) {
      await client.query(
        `UPDATE delivery_pricing_rules
         SET is_active = FALSE, effective_to = NOW(), updated_at = NOW()
         WHERE delivery_method = $1
           AND COALESCE(zone_type, '') = COALESCE($2, '')
           AND COALESCE(zone_id, 0) = COALESCE($3, 0)
           AND is_active = TRUE`,
        [method, payload.zone_type || null, payload.zone_id || null]
      );
    }

    const insertRes = await client.query(
      `INSERT INTO delivery_pricing_rules (
         rule_name, delivery_method, zone_id, zone_type, version, is_active,
         effective_from, base_fee, per_km_rate, min_fee, max_fee,
         free_distance_km, free_weight_kg, per_kg_rate, per_m3_rate,
         fragile_surcharge, cold_chain_surcharge, packaging_fee, special_handling_fee,
         remote_area_surcharge, same_day_surcharge, waiting_fee_per_hour, reattempt_fee,
         return_delivery_fee, farmer_min_fee_policy, farmer_max_fee_policy,
         driver_base_payout, driver_per_km_payout, driver_per_kg_payout, driver_zone_bonus,
         platform_logistics_share_pct, disclosure_note, created_by
       ) VALUES (
         $1,$2,$3,$4,$5,TRUE,COALESCE($6::timestamptz, NOW()),$7,$8,$9,$10,$11,$12,$13,$14,
         $15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32
       ) RETURNING *`,
      [
        payload.rule_name || `${method} v${nextVersion}`,
        method,
        payload.zone_id || null,
        payload.zone_type || null,
        nextVersion,
        payload.effective_from || null,
        Number(payload.base_fee ?? 45),
        Number(payload.per_km_rate ?? 2.2),
        Number(payload.min_fee ?? 50),
        Number(payload.max_fee ?? 4500),
        Number(payload.free_distance_km ?? 0),
        Number(payload.free_weight_kg ?? 20),
        Number(payload.per_kg_rate ?? 0.9),
        Number(payload.per_m3_rate ?? 0),
        Number(payload.fragile_surcharge ?? 15),
        Number(payload.cold_chain_surcharge ?? 25),
        Number(payload.packaging_fee ?? 10),
        Number(payload.special_handling_fee ?? 0),
        Number(payload.remote_area_surcharge ?? 60),
        Number(payload.same_day_surcharge ?? 35),
        Number(payload.waiting_fee_per_hour ?? 0),
        Number(payload.reattempt_fee ?? 0),
        Number(payload.return_delivery_fee ?? 0),
        Number(payload.farmer_min_fee_policy ?? 0),
        Number(payload.farmer_max_fee_policy ?? 2500),
        Number(payload.driver_base_payout ?? 35),
        Number(payload.driver_per_km_payout ?? 1.6),
        Number(payload.driver_per_kg_payout ?? 0.6),
        Number(payload.driver_zone_bonus ?? 0),
        Number(payload.platform_logistics_share_pct ?? 20),
        payload.disclosure_note || null,
        actorId || null,
      ]
    );

    await client.query("COMMIT");
    return insertRes.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  checkBranchServiceability,
  computeItemWeightKg,
  computeItemsCharacteristics,
  computeRouteDistance,
  createPricingRuleVersion,
  estimateBranchDeliveryAsync,
  estimateDistanceKm,
  estimateSuborderDeliveryFee,
  generateAndSaveDeliveryQuote,
  getActivePricingRule,
  listPricingRulesAdmin,
  resolveDestinationZone,
  resolveLocationCoord,
  validateAndAcceptQuoteForOrder,
  validateGpsPair,
};
