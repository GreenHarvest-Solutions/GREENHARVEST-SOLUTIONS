const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { execFileSync } = require("child_process");
const { pool } = require("../config/db");
const logger = require("../utils/logger");
const riskAdminModel = require("../models/riskAdminModel");

// Locate Python venv executable
const VENV_PYTHON = path.resolve(__dirname, "../../../services/document-processor/venv/bin/python");
const SYSTEM_PYTHON = "python3";
const PROCESSOR_SCRIPT = path.resolve(__dirname, "../../../services/document-processor/processor.py");

const getPythonBin = () => {
  if (fs.existsSync(VENV_PYTHON)) {
    return VENV_PYTHON;
  }
  return SYSTEM_PYTHON;
};

/**
 * Execute a command on processor.py with JSON response parsing and graceful fallback
 */
const runPythonCommand = (command, args = [], inputPayload = null) => {
  const pythonBin = getPythonBin();
  try {
    const cmdArgs = [PROCESSOR_SCRIPT, command, ...args];
    const execOptions = {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      timeout: 10000,
    };
    if (inputPayload !== null) {
      execOptions.input = typeof inputPayload === "string" ? inputPayload : JSON.stringify(inputPayload);
    }
    const output = execFileSync(pythonBin, cmdArgs, execOptions);
    return JSON.parse(output.trim());
  } catch (err) {
    logger.warn(`Python processor error for command '${command}': ${err.message}`);
    return null;
  }
};

/**
 * Pure JavaScript Hamming Distance between two hex strings (64-bit difference hash)
 */
const calculateHammingDistance = (hash1, hash2) => {
  if (!hash1 || !hash2) return 64;
  try {
    const maxLen = Math.max(hash1.length, hash2.length);
    const b1 = BigInt("0x" + hash1.padEnd(maxLen, "0"));
    const b2 = BigInt("0x" + hash2.padEnd(maxLen, "0"));
    let xor = b1 ^ b2;
    let dist = 0;
    while (xor > 0n) {
      if (xor & 1n) dist++;
      xor >>= 1n;
    }
    return dist;
  } catch {
    let diff = 0;
    for (let i = 0; i < Math.max(hash1.length, hash2.length); i++) {
      if (hash1[i] !== hash2[i]) diff++;
    }
    return diff;
  }
};

/**
 * Pure JS fallback for basic document field parsing
 */
const jsFallbackExtract = (text, docType) => {
  const cleaned = (text || "").replace(/\r/g, " ").trim();
  const extracted = {
    id_number: null,
    full_name: null,
    region: null,
    woreda: null,
    kebele: null,
    tin: null,
    id_type_detected: null,
  };
  let confidence = 0.0;

  // Fayda 12-digit
  const fayda = cleaned.match(/\b(\d{4})[ -]?(\d{4})[ -]?(\d{4})\b/);
  if (fayda) {
    extracted.id_number = `${fayda[1]}${fayda[2]}${fayda[3]}`;
    extracted.id_type_detected = "fayda_national_id";
    confidence += 40.0;
  }

  // TIN 10-digit
  const tin = cleaned.match(/(?:TIN|ግብር)[:.\s]*(\d{10})\b|\b(\d{10})\b/i);
  if (tin) {
    extracted.tin = tin[1] || tin[2];
    if (!extracted.id_number) {
      extracted.id_number = extracted.tin;
      extracted.id_type_detected = "tax_id";
    }
    confidence += 20.0;
  }

  // Kebele ID
  if (!extracted.id_number) {
    const kebele = cleaned.match(/(?:ID\s*(?:NO|Number|ቁጥር)?|Card\s*(?:No|Number)?|(?:መታወቂያ\s*(?:ቁጥር)?)|ቁጥር)[:.\s]*([A-Z0-9/\-]{4,20})/i);
    if (kebele) {
      extracted.id_number = kebele[1].trim();
      extracted.id_type_detected = "kebele_id";
      confidence += 35.0;
    }
  }

  // Name
  const nameMatch = cleaned.match(/(?:Full\s*Name|Name|ስም|የባለቤቱ\s*ስም)[:.\s]+([A-Za-z\u1200-\u137F\s]{3,40}?)(?=[,\n]|\s{2,}|ID|Fayda|DOB|ፆታ|$)/i);
  if (nameMatch) {
    extracted.full_name = nameMatch[1].trim();
    confidence += 30.0;
  }

  // Region
  const regions = ["Oromia", "ኦሮሚያ", "Amhara", "አማራ", "Sidama", "ሲዳማ", "Tigray", "ትግራይ", "Somali", "ሶማሌ", "Addis Ababa", "አዲስ አበባ", "Dire Dawa", "ድሬዳዋ"];
  for (const reg of regions) {
    if (cleaned.toLowerCase().includes(reg.toLowerCase())) {
      extracted.region = reg;
      confidence += 15.0;
      break;
    }
  }

  // Woreda / Kebele
  const woreda = cleaned.match(/(?:Woreda|ወረዳ)[:.\s]*([A-Za-z0-9\u1200-\u137F\s]+?)(?=[,\n]|Kebele|ቀበሌ|$)/i);
  if (woreda) {
    extracted.woreda = woreda[1].trim();
    confidence += 7.5;
  }
  const keb = cleaned.match(/(?:Kebele|ቀበሌ)[:.\s]*([A-Za-z0-9\u1200-\u137F\s]+?)(?=[,\n]|ID|ቁጥር|$)/i);
  if (keb) {
    extracted.kebele = keb[1].trim();
    confidence += 7.5;
  }

  let idHash = null;
  if (extracted.id_number) {
    idHash = crypto.createHash("sha256").update(extracted.id_number.trim().toUpperCase()).digest("hex");
  }

  return {
    raw_text: cleaned,
    extracted_fields: extracted,
    id_hash: idHash,
    confidence_score: Math.min(100.0, Math.round(confidence)),
  };
};

/**
 * Compute 64-bit difference hash (dHash) for an image file
 */
const computeImageHash = (imagePath) => {
  if (!imagePath) return "0000000000000000";

  // Try python worker first
  if (fs.existsSync(imagePath)) {
    const res = runPythonCommand("image_hash", [imagePath]);
    if (res && res.image_hash) {
      return res.image_hash;
    }
  }

  // Fallback: SHA-256 fingerprint truncated to 16 hex chars (64 bits)
  try {
    if (fs.existsSync(imagePath)) {
      const buf = fs.readFileSync(imagePath);
      return crypto.createHash("sha256").update(buf).digest("hex").slice(0, 16);
    }
  } catch {
    // URL or string hash
  }

  return crypto.createHash("sha256").update(String(imagePath)).digest("hex").slice(0, 16);
};

/**
 * Process KYC document OCR and regex extraction
 */
const processKycDocumentOcr = ({ filePath = null, rawText = null, documentType = "national_id" }) => {
  if (filePath && fs.existsSync(filePath)) {
    const pyRes = runPythonCommand("ocr_parse", [filePath, documentType]);
    if (pyRes && !pyRes.error && pyRes.extracted_fields) {
      return pyRes;
    }
  }

  if (rawText) {
    const pyRes = runPythonCommand("ocr_text", [], { text: rawText, document_type: documentType });
    if (pyRes && !pyRes.error && pyRes.extracted_fields) {
      return pyRes;
    }
    return jsFallbackExtract(rawText, documentType);
  }

  return {
    raw_text: "",
    extracted_fields: {},
    id_hash: null,
    confidence_score: 0.0,
  };
};

/**
 * Check for duplicate identities against database using RapidFuzz and exact SHA-256 ID hashes
 */
const checkIdentityDuplicates = async ({
  farmerId = null,
  name = null,
  idNumber = null,
  idHash = null,
  region = null,
  woreda = null,
  kebele = null,
}) => {
  // Query all other farmers from database
  const query = `
    SELECT 
      u.id,
      u.name,
      fp.region,
      fp.woreda,
      fp.kebele,
      fp.id_number,
      kd.id_hash
    FROM users u
    LEFT JOIN farmer_profiles fp ON fp.user_id = u.id
    LEFT JOIN kyc_documents kd ON kd.user_id = u.id AND kd.id_hash IS NOT NULL
    WHERE u.role = 'farmer'
      ${farmerId ? `AND u.id != ${Number(farmerId)}` : ""}
    ORDER BY u.created_at DESC
    LIMIT 200
  `;
  const res = await pool.query(query);
  const candidates = res.rows;

  const target = {
    id: farmerId,
    name: name || "",
    id_number: idNumber || "",
    id_hash: idHash || null,
    region: region || "",
    woreda: woreda || "",
    kebele: kebele || "",
  };

  // Try python RapidFuzz worker
  const pyRes = runPythonCommand("check_duplicate", [], {
    target,
    candidates,
    threshold: 85.0,
  });

  if (pyRes && pyRes.is_duplicate !== undefined) {
    return pyRes;
  }

  // Pure JS Fallback
  const matches = [];
  for (const cand of candidates) {
    if (target.id_hash && cand.id_hash && target.id_hash === cand.id_hash) {
      matches.push({
        farmer_id: cand.id,
        name: cand.name,
        match_type: "exact_id_hash",
        similarity: 100.0,
        details: "Identical National ID / Fayda document hash already registered",
      });
      continue;
    }

    if (target.id_number && cand.id_number && target.id_number.toUpperCase() === cand.id_number.toUpperCase()) {
      matches.push({
        farmer_id: cand.id,
        name: cand.name,
        match_type: "exact_id_number",
        similarity: 100.0,
        details: `Identical ID Number '${cand.id_number}' already registered`,
      });
      continue;
    }

    // Token set overlap
    if (target.name && cand.name) {
      const tWords = new Set(target.name.toLowerCase().split(/\s+/));
      const cWords = new Set(cand.name.toLowerCase().split(/\s+/));
      const common = [...tWords].filter((w) => cWords.has(w));
      if (common.length >= 2) {
        matches.push({
          farmer_id: cand.id,
          name: cand.name,
          match_type: "fuzzy_identity",
          similarity: 90.0,
          details: `Matching name tokens (${common.join(", ")})`,
        });
      }
    }
  }

  return {
    is_duplicate: matches.length > 0,
    match_count: matches.length,
    matches,
    highest_risk: matches[0] || null,
  };
};

/**
 * Check for duplicate product images using perceptual hash Hamming distance
 */
const checkProductImageDuplicates = async ({ imageHash, currentProductId = null }) => {
  if (!imageHash || imageHash === "0000000000000000") {
    return { is_duplicate: false, matches: [] };
  }

  const query = `
    SELECT id, name, farmer_id, image_hash, image_url
    FROM products
    WHERE image_hash IS NOT NULL
      AND deleted_at IS NULL
      ${currentProductId ? `AND id != ${Number(currentProductId)}` : ""}
    ORDER BY created_at DESC
    LIMIT 200
  `;
  const res = await pool.query(query);

  const matches = [];
  for (const row of res.rows) {
    const dist = calculateHammingDistance(imageHash, row.image_hash);
    if (dist < 5) {
      matches.push({
        product_id: row.id,
        name: row.name,
        farmer_id: row.farmer_id,
        image_hash: row.image_hash,
        distance: dist,
      });
    }
  }

  return {
    is_duplicate: matches.length > 0,
    matches,
  };
};

/**
 * Evaluate price corridor anomaly against regional benchmarks
 */
const evaluatePriceCorridorAnomaly = async ({ productName, farmLocation = "", price }) => {
  const numericPrice = Number(price);
  if (!numericPrice || numericPrice <= 0) {
    return { is_anomaly: false };
  }

  const corridorRes = await pool.query(
    `
      SELECT *
      FROM price_corridors
      WHERE $1 ILIKE ('%' || commodity_name || '%')
      ORDER BY (region = $2) DESC, id ASC
      LIMIT 1
    `,
    [productName, farmLocation || ""]
  );

  if (corridorRes.rows.length === 0) {
    return { is_anomaly: false, corridor: null };
  }

  const corridor = corridorRes.rows[0];
  const thresholdPct = Number(corridor.deviation_threshold_pct || 25.0);
  const threshold = thresholdPct / 100.0;
  const minAllowed = Number(corridor.min_price) * (1.0 - threshold);
  const maxAllowed = Number(corridor.max_price) * (1.0 + threshold);

  const isAnomaly = numericPrice < minAllowed || numericPrice > maxAllowed;
  const targetPrice = Number(corridor.target_price || (Number(corridor.min_price) + Number(corridor.max_price)) / 2);
  const deviationPct = Math.round(Math.abs((numericPrice - targetPrice) / targetPrice) * 100);

  return {
    is_anomaly: isAnomaly,
    corridor,
    deviation_pct: deviationPct,
    threshold_pct: thresholdPct,
    min_allowed: minAllowed,
    max_allowed: maxAllowed,
    target_price: targetPrice,
  };
};

/**
 * Full intelligence evaluation for a product listing
 * Checks perceptual image hash duplicates and price corridor anomalies; records risk flags.
 */
const evaluateProductIntelligence = async ({ product, farmerId }) => {
  const flags = [];
  const intelligenceReport = {
    image_hash: null,
    is_image_duplicate: false,
    image_duplicate_matches: [],
    is_price_anomaly: false,
    price_deviation_pct: 0,
    risk_flags_created: [],
  };

  // 1. Perceptual Image Hashing
  const imageSource = product.image_url || (product.images && product.images[0]);
  if (imageSource) {
    const hash = computeImageHash(imageSource);
    intelligenceReport.image_hash = hash;

    const dupCheck = await checkProductImageDuplicates({
      imageHash: hash,
      currentProductId: product.id || null,
    });

    if (dupCheck.is_duplicate) {
      intelligenceReport.is_image_duplicate = true;
      intelligenceReport.image_duplicate_matches = dupCheck.matches;
      flags.push("IMAGE_DUPLICATE");

      // Record Risk Flag
      if (product.id) {
        const flag = await riskAdminModel.createRiskFlag({
          entity_type: "product",
          entity_id: product.id,
          flag_type: "duplicate_image",
          severity: "medium",
          flag_reason: `Product image matches existing product #${dupCheck.matches[0].product_id} with Hamming distance ${dupCheck.matches[0].distance}`,
          evidence: {
            image_hash: hash,
            matches: dupCheck.matches,
          },
          confidence_score: 95.0,
        });
        intelligenceReport.risk_flags_created.push(flag);
      }
    }
  }

  // 2. Price Corridor Anomaly
  const priceEval = await evaluatePriceCorridorAnomaly({
    productName: product.name,
    farmLocation: product.farm_location || product.region || "",
    price: product.price,
  });

  if (priceEval.is_anomaly) {
    intelligenceReport.is_price_anomaly = true;
    intelligenceReport.price_deviation_pct = priceEval.deviation_pct;
    flags.push("PRICE_OUTLIER");

    // Record High Severity Risk Flag
    if (product.id) {
      const flag = await riskAdminModel.createRiskFlag({
        entity_type: "product",
        entity_id: product.id,
        flag_type: "price_outlier",
        severity: "high",
        flag_reason: `Price of ETB ${product.price} deviates by ${priceEval.deviation_pct}% from corridor benchmark for ${priceEval.corridor?.commodity_name}`,
        evidence: {
          price: product.price,
          target_price: priceEval.target_price,
          min_allowed: priceEval.min_allowed,
          max_allowed: priceEval.max_allowed,
          corridor_id: priceEval.corridor?.id,
          deviation_pct: priceEval.deviation_pct,
        },
        confidence_score: 90.0,
      });
      intelligenceReport.risk_flags_created.push(flag);
    }
  }

  return {
    flags,
    report: intelligenceReport,
  };
};

module.exports = {
  computeImageHash,
  calculateHammingDistance,
  processKycDocumentOcr,
  checkIdentityDuplicates,
  checkProductImageDuplicates,
  evaluatePriceCorridorAnomaly,
  evaluateProductIntelligence,
};
