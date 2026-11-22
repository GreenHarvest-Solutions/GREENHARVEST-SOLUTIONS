const { pool } = require("../config/db");
const logger = require("../utils/logger");
const intelligenceService = require("./intelligenceService");
const riskAdminModel = require("../models/riskAdminModel");

// Prohibited terms across prohibited chemicals, contraband, weapons, and non-agricultural products
const BANNED_KEYWORDS = [
  "ddt",
  "endosulfan",
  "paraquat",
  "aldrin",
  "dieldrin",
  "chlordane",
  "heptachlor",
  "methyl parathion",
  "monocrotophos",
  "glyphosate banned",
  "cyanide",
  "strychnine",
  "weapon",
  "gun",
  "rifle",
  "ammunition",
  "explosive",
  "bomb",
  "cannabis",
  "marijuana",
  "weed",
  "hashish",
  "opium",
  "heroin",
  "cocaine",
  "narcotic",
  "khat illegal",
  "prescription",
  "pharmaceutical",
  "counterfeit",
  "fake",
  "stolen",
  "ivory",
  "rhino horn",
  "cheetah skin",
  "endangered wildlife",
  "crypto",
  "bitcoin",
  "forex",
  "gambling",
  "lottery",
];

/**
 * Deterministic Hybrid Moderation Engine
 * Evaluates listing completeness, prohibited content, price corridor deviation,
 * duplicate listings, and seller trust level.
 *
 * @param {Object} product Listing attributes to evaluate
 * @param {number} farmerId User ID of the seller
 * @returns {Promise<Object>} { decision, status, moderation_status, is_published, risk_score, flags, reason }
 */
const evaluateListing = async (product, farmerId) => {
  const flags = [];
  let riskScore = 0.0;

  // 1. Completeness Validation
  const missingFields = [];
  if (!product.name || product.name.trim().length < 3) {
    missingFields.push("product name (min 3 characters)");
  }
  if (product.price === undefined || product.price === null || Number(product.price) <= 0) {
    missingFields.push("price (must be greater than 0)");
  }
  if (product.stock === undefined || product.stock === null || Number(product.stock) < 0) {
    missingFields.push("stock (cannot be negative)");
  }
  if (!product.description || product.description.trim().length < 15) {
    missingFields.push("description (min 15 characters)");
  }
  if (!product.image_url && (!product.images || product.images.length === 0)) {
    missingFields.push("product image");
  }

  if (missingFields.length > 0) {
    return {
      decision: "rejected",
      status: "draft",
      moderation_status: "rejected",
      is_published: false,
      risk_score: 100.0,
      flags: ["INCOMPLETE_LISTING"],
      reason: `Listing incomplete: missing ${missingFields.join(", ")}`,
    };
  }

  // 2. Prohibited Content Screen
  const textCorpus = `${product.name} ${product.description || ""} ${product.farm_location || ""}`.toLowerCase();
  const matchedBannedWords = BANNED_KEYWORDS.filter((term) => {
    // Word boundary or exact substring check
    const regex = new RegExp(`\\b${term}\\b`, "i");
    return regex.test(textCorpus);
  });

  if (matchedBannedWords.length > 0) {
    return {
      decision: "rejected",
      status: "draft",
      moderation_status: "rejected",
      is_published: false,
      risk_score: 100.0,
      flags: ["PROHIBITED_CONTENT"],
      reason: `Listing rejected: contains prohibited terms (${matchedBannedWords.join(", ")})`,
    };
  }

  // 3. Price Corridor Outlier Screen
  const price = Number(product.price);
  try {
    const corridorsRes = await pool.query(
      `SELECT * FROM price_corridors 
       WHERE $1 ILIKE ('%' || commodity_name || '%')
       ORDER BY (region = $2) DESC, id ASC 
       LIMIT 1`,
      [product.name, product.region || product.farm_location || ""]
    );

    if (corridorsRes.rows.length > 0) {
      const corridor = corridorsRes.rows[0];
      const threshold = Number(corridor.deviation_threshold_pct || 25.0) / 100.0;
      const minAllowed = Number(corridor.min_price) * (1.0 - threshold);
      const maxAllowed = Number(corridor.max_price) * (1.0 + threshold);

      if (price > maxAllowed || price < minAllowed) {
        flags.push("PRICE_OUTLIER");
        riskScore += 35.0;
        logger.info("Price corridor outlier detected", {
          productId: product.id,
          price,
          corridor: { min: corridor.min_price, max: corridor.max_price, commodity: corridor.commodity_name },
        });

        // Record high severity risk flag in risk_flags if product.id exists
        if (product.id) {
          try {
            await riskAdminModel.createRiskFlag({
              entity_type: "product",
              entity_id: product.id,
              flag_type: "price_outlier",
              severity: "high",
              flag_reason: `Price ETB ${price} deviates from corridor benchmark [${corridor.min_price} - ${corridor.max_price}] for ${corridor.commodity_name}`,
              evidence: {
                price,
                min_price: corridor.min_price,
                max_price: corridor.max_price,
                threshold_pct: corridor.deviation_threshold_pct,
              },
              confidence_score: 90.0,
            });
          } catch (flagErr) {
            logger.warn("Failed to create price outlier risk flag", { message: flagErr.message });
          }
        }
      }
    }
  } catch (err) {
    logger.warn("Price corridor check skipped due to query error", { message: err.message });
  }

  // 4. Duplicate Listing Check (Name / Content)
  try {
    const dupRes = await pool.query(
      `SELECT id FROM products 
       WHERE farmer_id = $1 
         AND LOWER(name) = LOWER($2) 
         AND deleted_at IS NULL 
         ${product.id ? `AND id != ${Number(product.id)}` : ""}
       LIMIT 1`,
      [farmerId, product.name.trim()]
    );

    if (dupRes.rows.length > 0) {
      flags.push("DUPLICATE_LISTING");
      riskScore += 25.0;
    }
  } catch (err) {
    logger.warn("Duplicate listing check skipped", { message: err.message });
  }

  // 4b. Perceptual Image Hash Duplicate Screen
  try {
    const imageSource = product.image_url || (product.images && product.images[0]);
    const imgHash = product.image_hash || (imageSource ? intelligenceService.computeImageHash(imageSource) : null);
    if (imgHash) {
      product.image_hash = imgHash;
      const imgDup = await intelligenceService.checkProductImageDuplicates({
        imageHash: imgHash,
        currentProductId: product.id || null,
      });

      if (imgDup.is_duplicate) {
        flags.push("IMAGE_DUPLICATE");
        riskScore += 30.0;
        logger.info("Duplicate product image detected via perceptual hash", {
          productId: product.id,
          matchedProductId: imgDup.matches[0]?.product_id,
          distance: imgDup.matches[0]?.distance,
        });

        if (product.id) {
          try {
            await riskAdminModel.createRiskFlag({
              entity_type: "product",
              entity_id: product.id,
              flag_type: "duplicate_image",
              severity: "medium",
              flag_reason: `Perceptual image hash matches existing product #${imgDup.matches[0].product_id} (Hamming distance: ${imgDup.matches[0].distance})`,
              evidence: {
                image_hash: imgHash,
                matches: imgDup.matches,
              },
              confidence_score: 95.0,
            });
          } catch (flagErr) {
            logger.warn("Failed to create image duplicate risk flag", { message: flagErr.message });
          }
        }
      }
    }
  } catch (err) {
    logger.warn("Perceptual image duplicate check skipped", { message: err.message });
  }

  // 5. Seller Trust Level Check (Authoritative Business Policy)
  const userRes = await pool.query(
    `SELECT id, kyc_status, kyc_tier, is_verified, account_status FROM users WHERE id = $1`,
    [farmerId]
  );
  const seller = userRes.rows[0] || {};

  // If seller is suspended / deactivated -> cannot publish
  if (["suspended", "banned", "deactivated"].includes(seller.account_status)) {
    return {
      decision: "rejected",
      status: "deactivated",
      moderation_status: "rejected",
      is_published: false,
      risk_score: 100.0,
      flags: ["SELLER_SUSPENDED"],
      reason: "Seller account is suspended or deactivated",
    };
  }

  const isVerifiedSeller = seller.kyc_status === "approved" && seller.is_verified === true;

  // RULE A: Provisional / Unverified Farmer
  // Newly submitted listings require manual administrator approval before publication.
  if (!isVerifiedSeller) {
    riskScore = Math.max(riskScore, 40.0);
    return {
      decision: "human_review_required",
      status: "pending",
      moderation_status: "pending",
      is_published: false,
      risk_score: riskScore,
      flags: flags.concat("PROVISIONAL_SELLER"),
      reason: "Provisional seller listing — manual administrator review required before marketplace publication",
    };
  }

  // RULE B: Verified Farmer with Outliers or Flags -> Human Review
  if (flags.length > 0) {
    return {
      decision: "human_review_required",
      status: "pending",
      moderation_status: "pending",
      is_published: false,
      risk_score: riskScore,
      flags,
      reason: `Listing flagged for moderation review: ${flags.join(", ")}`,
    };
  }

  // RULE C: Verified Farmer with Clean Listing -> Auto-Approved
  return {
    decision: "auto_approved",
    status: "active",
    moderation_status: "approved",
    is_published: true,
    risk_score: 0.0,
    flags: [],
    reason: "Automated hybrid approval: verified producer, within price corridor, passed content screening",
  };
};

module.exports = {
  evaluateListing,
  BANNED_KEYWORDS,
};

