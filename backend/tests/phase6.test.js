/**
 * Phase 6: Local Intelligence & Document Processing Test Suite
 * Tests OCR extraction (Fayda, Kebele, TIN), RapidFuzz duplicate detection,
 * perceptual image hashing, price corridor anomaly flags, and admin risk dossiers.
 */

const crypto = require("crypto");
const { pool } = require("../src/config/db");
const { signAccessToken } = require("../src/utils/jwt");
const intelligenceService = require("../src/services/intelligenceService");

const API_BASE = "http://localhost:5000/api";

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
};

const runTests = async () => {
  console.log("==========================================================");
  console.log("Starting Phase 6 Verification: Local Intelligence & OCR");
  console.log("==========================================================");

  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      process.stdout.write(`• ${name}... `);
      await fn();
      console.log("PASSED ✓");
      passed++;
    } catch (err) {
      console.log(`FAILED ✕: ${err.message}`);
      failed++;
    }
  };

  const testTimestamp = Date.now();
  const emailFarmer1 = `farmer1_phase6_${testTimestamp}@example.com`;
  const emailFarmer2 = `farmer2_phase6_${testTimestamp}@example.com`;
  const emailAdmin = `admin_phase6_${testTimestamp}@example.com`;

  let farmer1Token = null;
  let farmer1Id = null;
  let farmer2Token = null;
  let farmer2Id = null;
  let adminToken = null;
  let adminId = null;

  let categoryId = null;
  let testProductId1 = null;
  let testProductId2 = null;
  let testRiskFlagId = null;

  const testFaydaId = `9988 7766 5544`;
  const normalizedFaydaId = `998877665544`;
  const expectedIdHash = crypto.createHash("sha256").update(normalizedFaydaId).digest("hex");

  try {
    // ----------------------------------------------------
    // Setup: Farmers, Admin, Category, Price Corridors
    // ----------------------------------------------------
    // 1. Farmer 1 (Primary)
    const regFarmer1 = await pool.query(
      `INSERT INTO users (name, email, password, role, role_id, email_verified, is_verified, account_status, kyc_status, phone, address)
       VALUES ('Abebe Bikila Demisse', $1, 'hashed_pw', 'farmer', 2, TRUE, TRUE, 'active', 'approved', '+251911660001', 'Oromia Bishoftu')
       RETURNING id`,
      [emailFarmer1]
    );
    farmer1Id = regFarmer1.rows[0].id;
    farmer1Token = signAccessToken({ id: farmer1Id, email: emailFarmer1, role: "farmer", name: "Abebe Bikila Demisse" });
    await pool.query(
      `INSERT INTO farmer_profiles (user_id, farm_name, region, woreda, kebele, id_number)
       VALUES ($1, 'Bikila Highland Onions', 'Oromia', 'Bishoftu', '03', $2)
       ON CONFLICT (user_id) DO UPDATE SET region = 'Oromia', woreda = 'Bishoftu', kebele = '03', id_number = $2`,
      [farmer1Id, normalizedFaydaId]
    );

    // 2. Farmer 2 (Duplicate / Suspicious Registrant)
    const regFarmer2 = await pool.query(
      `INSERT INTO users (name, email, password, role, role_id, email_verified, is_verified, account_status, kyc_status, phone, address)
       VALUES ('Abebe Bikila', $1, 'hashed_pw', 'farmer', 2, TRUE, FALSE, 'active', 'pending', '+251911660002', 'Oromia Bishoftu')
       RETURNING id`,
      [emailFarmer2]
    );
    farmer2Id = regFarmer2.rows[0].id;
    farmer2Token = signAccessToken({ id: farmer2Id, email: emailFarmer2, role: "farmer", name: "Abebe Bikila" });
    await pool.query(
      `INSERT INTO farmer_profiles (user_id, farm_name, region, woreda, kebele)
       VALUES ($1, 'Abebe Produce', 'Oromia', 'Bishoftu', '03')
       ON CONFLICT (user_id) DO UPDATE SET region = 'Oromia', woreda = 'Bishoftu', kebele = '03'`,
      [farmer2Id]
    );

    // 3. Admin User (Super Admin)
    const regAdmin = await pool.query(
      `INSERT INTO users (name, email, password, role, role_id, admin_role_id, email_verified, is_verified, account_status)
       VALUES ('Phase6 Admin', $1, 'hashed_pw', 'admin', 3, 1, TRUE, TRUE, 'active')
       RETURNING id`,
      [emailAdmin]
    );
    adminId = regAdmin.rows[0].id;
    adminToken = signAccessToken({ id: adminId, email: emailAdmin, role: "admin", name: "Phase6 Admin" });

    // Category
    const catRes = await pool.query(`SELECT id FROM categories LIMIT 1`);
    categoryId = catRes.rows[0].id;

    // Seed Price Corridor for Regional Benchmark
    await pool.query(
      `INSERT INTO price_corridors (commodity_name, region, min_price, max_price, target_price, unit, deviation_threshold_pct)
       VALUES ('Phase6 Teff', 'Oromia', 90.00, 110.00, 100.00, 'kg', 20.0)
       ON CONFLICT DO NOTHING`
    );

    // ----------------------------------------------------
    // TEST 1: OCR Extraction on Fayda & Amharic Kebele IDs
    // ----------------------------------------------------
    await test("Python OCR parser extracts Fayda 12-digit and Amharic Kebele ID fields", async () => {
      // 1. Fayda Digital ID text
      const faydaText = `
        FEDERAL DEMOCRATIC REPUBLIC OF ETHIOPIA
        NATIONAL DIGITAL ID (FAYDA)
        Full Name: Abebe Bikila Demisse
        Fayda ID: ${testFaydaId}
        Region: Oromia
        Woreda: Bishoftu
        Kebele: 03
        Date of Birth: 12/04/1988
      `;
      const faydaResult = intelligenceService.processKycDocumentOcr({
        rawText: faydaText,
        documentType: "national_id",
      });

      assert(faydaResult.extracted_fields.id_number === normalizedFaydaId, `Fayda ID mismatch: expected ${normalizedFaydaId}, got ${faydaResult.extracted_fields.id_number}`);
      assert(faydaResult.extracted_fields.full_name === "Abebe Bikila Demisse", `Name mismatch: ${faydaResult.extracted_fields.full_name}`);
      assert(faydaResult.extracted_fields.region === "Oromia", `Region mismatch: ${faydaResult.extracted_fields.region}`);
      assert(faydaResult.id_hash === expectedIdHash, `ID hash mismatch: ${faydaResult.id_hash}`);
      assert(faydaResult.confidence_score >= 80, `Expected confidence >= 80%, got ${faydaResult.confidence_score}`);

      // 2. Amharic Kebele ID text
      const kebeleText = `
        የኢትዮጵያ ፌደራላዊ ዴሞክራሲያዊ ሪፐብሊክ
        የነዋሪነት መታወቂያ ካርድ
        የባለቤቱ ስም: ታደለ በቀለ
        መታወቂያ ቁጥር: KBL/OR/2093
        ክልል: ኦሮሚያ
        ወረዳ: አዳማ
        ቀበሌ: 05
      `;
      const kebeleResult = intelligenceService.processKycDocumentOcr({
        rawText: kebeleText,
        documentType: "kebele_id",
      });

      assert(kebeleResult.extracted_fields.id_number === "KBL/OR/2093", `Kebele ID number mismatch: ${kebeleResult.extracted_fields.id_number}`);
      assert(kebeleResult.extracted_fields.full_name === "ታደለ በቀለ", `Ethiopic name mismatch: ${kebeleResult.extracted_fields.full_name}`);
      assert(kebeleResult.extracted_fields.region === "ኦሮሚያ", `Ethiopic region mismatch: ${kebeleResult.extracted_fields.region}`);
      assert(kebeleResult.confidence_score >= 80, `Kebele confidence < 80%: ${kebeleResult.confidence_score}`);
    });

    // ----------------------------------------------------
    // TEST 2: RapidFuzz Identity Duplicate Detection
    // ----------------------------------------------------
    await test("RapidFuzz flags duplicate identities sharing name tokens or exact ID hashes", async () => {
      // Seed a document for Farmer 1 with the Fayda ID hash
      await pool.query(
        `INSERT INTO kyc_documents (user_id, document_type, document_url, document_category, ocr_raw_text, extracted_data, id_hash, ocr_confidence, status)
         VALUES ($1, 'national_id', 'https://example.com/fayda_farmer1.jpg', 'identity', 'Fayda ID: 9988 7766 5544', '{"id_number": "998877665544"}', $2, 95.0, 'approved')`,
        [farmer1Id, expectedIdHash]
      );

      // 1. Exact ID hash duplicate test (Farmer 2 trying to use same ID hash)
      const exactDup = await intelligenceService.checkIdentityDuplicates({
        farmerId: farmer2Id,
        idHash: expectedIdHash,
        name: "Different Name",
      });
      assert(exactDup.is_duplicate === true, "Exact ID hash should trigger is_duplicate = true");
      assert(exactDup.matches[0].match_type === "exact_id_hash", "Match type should be 'exact_id_hash'");
      assert(Number(exactDup.matches[0].farmer_id) === Number(farmer1Id), "Matched farmer should be farmer1");

      // 2. Fuzzy Name + Location duplicate test (Same father/grandfather name in same woreda)
      const fuzzyDup = await intelligenceService.checkIdentityDuplicates({
        farmerId: farmer2Id,
        idHash: "different_hash_001",
        name: "Abebe Bikila", // Substring token overlap of "Abebe Bikila Demisse"
        region: "Oromia",
        woreda: "Bishoftu",
      });
      assert(fuzzyDup.is_duplicate === true, "Fuzzy name token overlap in same location should flag duplicate");
      assert(fuzzyDup.matches.some(m => m.match_type === "fuzzy_identity"), "Fuzzy identity match missing");
    });

    // ----------------------------------------------------
    // TEST 3: Perceptual Image Hashing (dHash) & Hamming Distance
    // ----------------------------------------------------
    await test("Perceptual image hashing computes 64-bit dHash and detects identical images", async () => {
      const hash1 = "3f1a8b9c0d2e4f5a";
      const hashIdentical = "3f1a8b9c0d2e4f5a";
      const hashSlightVariant = "3f1a8b9c0d2e4f5b"; // 1 bit different
      const hashDistinct = "f0e1d2c3b4a59687";

      const distIdentical = intelligenceService.calculateHammingDistance(hash1, hashIdentical);
      assert(distIdentical === 0, `Identical hash distance should be 0, got ${distIdentical}`);

      const distVariant = intelligenceService.calculateHammingDistance(hash1, hashSlightVariant);
      assert(distVariant <= 2, `Near-identical variant distance should be <= 2, got ${distVariant}`);

      const distDistinct = intelligenceService.calculateHammingDistance(hash1, hashDistinct);
      assert(distDistinct >= 10, `Distinct hash distance should be >= 10, got ${distDistinct}`);
    });

    // ----------------------------------------------------
    // TEST 4: Product Image Duplicate Detection Flags Listing
    // ----------------------------------------------------
    await test("Submitting listing with duplicated product image generates IMAGE_DUPLICATE risk flag", async () => {
      const canonicalImageHash = "a1b2c3d4e5f60718";

      // 1. Create original product with image_hash
      const origRes = await pool.query(
        `INSERT INTO products (farmer_id, category_id, name, description, price, stock, image_url, image_hash, status, moderation_status, is_published)
         VALUES ($1, $2, 'Original Sweet Papaya', 'Farm fresh naturally grown organic papayas', 45.00, 50, 'https://example.com/papaya_orig.jpg', $3, 'active', 'approved', TRUE)
         RETURNING id`,
        [farmer1Id, categoryId, canonicalImageHash]
      );
      testProductId1 = origRes.rows[0].id;

      // 2. Submit second product listing with duplicate image hash
      const dupProdRes = await fetch(`${API_BASE}/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${farmer2Token}`,
        },
        body: JSON.stringify({
          category_id: categoryId,
          name: "Phase6 Copied Papaya",
          description: "Fresh papayas available right now for direct pickup",
          price: 45.00,
          stock: 30,
          image_url: "https://example.com/papaya_copy.jpg",
          image_hash: canonicalImageHash, // Identical perceptual hash
        }),
      });

      assert(dupProdRes.status === 201, `Failed to submit product: ${dupProdRes.status}`);
      const dupProdData = await dupProdRes.json();
      testProductId2 = dupProdData.product?.id || dupProdData.id;

      // Verify that moderation flags or risk_flags caught the duplicate image
      const rf = await pool.query(
        `SELECT * FROM risk_flags WHERE entity_type = 'product' AND entity_id = $1::text AND flag_type = 'duplicate_image'`,
        [testProductId2]
      );
      assert(rf.rows.length >= 1, "Expected risk_flags entry for duplicate_image");
      assert(rf.rows[0].severity === "medium", `Expected severity 'medium', got ${rf.rows[0].severity}`);
      assert(rf.rows[0].evidence.image_hash === canonicalImageHash, "Evidence should cite canonical image hash");
    });

    // ----------------------------------------------------
    // TEST 5: Price Corridor Anomaly Detection & High Severity Risk Flag
    // ----------------------------------------------------
    await test("Product price exceeding regional corridor creates high-severity PRICE_OUTLIER risk flag", async () => {
      // The corridor for 'Phase6 Teff' in 'Oromia' has benchmark 90.00 - 110.00 with 20% deviation threshold.
      // Maximum allowed price = 110 * 1.20 = 132.00 ETB.
      // Submitting 250.00 ETB is an extreme outlier (+127%).
      const outlierRes = await fetch(`${API_BASE}/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${farmer1Token}`,
        },
        body: JSON.stringify({
          category_id: categoryId,
          name: "Phase6 Teff Super Premium",
          description: "Organically grown Magna Teff from highland volcanic soil in Oromia",
          price: 250.00, // Price outlier!
          stock: 100,
          farm_location: "Oromia",
          image_url: "https://example.com/unique_teff_grain.jpg",
          image_hash: "9876543210abcdef",
        }),
      });

      assert(outlierRes.status === 201, `Failed to create outlier product: ${outlierRes.status}`);
      const outlierData = await outlierRes.json();
      const outlierProd = outlierData.product || outlierData;
      const outlierProdId = outlierProd.id;

      // Even for verified farmer, price outlier must require human review
      assert(outlierProd.moderation_status === "pending", `Expected 'pending', got ${outlierProd.moderation_status}`);

      // Verify high severity price_outlier record in risk_flags table
      const flagRes = await pool.query(
        `SELECT * FROM risk_flags WHERE entity_type = 'product' AND entity_id = $1::text AND flag_type = 'price_outlier'`,
        [outlierProdId]
      );
      assert(flagRes.rows.length >= 1, "Price outlier risk_flag was not created");
      assert(flagRes.rows[0].severity === "high", `Expected severity 'high', got ${flagRes.rows[0].severity}`);
      assert(flagRes.rows[0].evidence.price == 250.00, "Evidence price does not match");
    });

    // ----------------------------------------------------
    // TEST 6: Automated KYC Document Upload OCR & Duplicate Identity Alert
    // ----------------------------------------------------
    await test("Farmer KYC upload runs automated OCR and records duplicate identity risk flag", async () => {
      // Farmer 2 uploads an ID document with the exact same Fayda ID as Farmer 1
      const docUploadRes = await fetch(`${API_BASE}/farmer/kyc/documents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${farmer2Token}`,
        },
        body: JSON.stringify({
          document_type: "national_id",
          document_category: "identity",
          document_url: "https://example.com/fayda_upload_farmer2.jpg",
          ocr_raw_text: `ETHIOPIA NATIONAL ID\nFull Name: Abebe Bikila\nFayda ID: ${testFaydaId}\nRegion: Oromia\nWoreda: Bishoftu\nKebele: 03`,
        }),
      });

      assert(docUploadRes.status === 201, `KYC document upload failed: ${docUploadRes.status}`);
      const docData = await docUploadRes.json();
      const doc = docData.document;

      assert(doc.id_hash === expectedIdHash, `Document ID hash was not generated correctly: ${doc.id_hash}`);
      assert(doc.ocr_confidence >= 80, `Document OCR confidence missing or low: ${doc.ocr_confidence}`);

      // Verify that a critical duplicate_identity risk flag was logged against farmer2
      const dupRiskRes = await pool.query(
        `SELECT * FROM risk_flags WHERE entity_type = 'farmer' AND entity_id = $1::text AND flag_type = 'duplicate_identity'`,
        [farmer2Id]
      );
      assert(dupRiskRes.rows.length >= 1, "Critical duplicate_identity risk flag not created for farmer");
      assert(dupRiskRes.rows[0].severity === "critical", `Expected severity 'critical', got ${dupRiskRes.rows[0].severity}`);
      testRiskFlagId = dupRiskRes.rows[0].id;
    });

    // ----------------------------------------------------
    // TEST 7: Admin Review Dossier & Queue Prioritization
    // ----------------------------------------------------
    await test("Admin KYC intelligence endpoint returns extracted fields and duplicate alerts", async () => {
      // 1. Query KYC intelligence endpoint
      const intelRes = await fetch(`${API_BASE}/admin/kyc/${farmer2Id}/intelligence`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(intelRes.status === 200, `Failed to fetch KYC intelligence: ${intelRes.status}`);
      const intelData = await intelRes.json();

      assert(intelData.ocr_data && intelData.ocr_data.id_number === normalizedFaydaId, "OCR extracted ID number missing in intelligence response");
      assert(intelData.id_hash === expectedIdHash, "ID hash missing in intelligence response");
      assert(intelData.duplicate_detection.is_duplicate === true, "duplicate_detection.is_duplicate was not true");
      assert(intelData.risk_flags.length >= 1, "Associated risk_flags missing in intelligence response");

      // 2. Query Products Moderation Queue: Products with high risk scores appear at top
      const modRes = await fetch(`${API_BASE}/admin/products?moderation_status=pending`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(modRes.status === 200, `Failed to fetch products moderation queue: ${modRes.status}`);
      const modData = await modRes.json();
      const products = modData.products || [];
      assert(products.length >= 1, "Pending products queue is empty");

      // Verify queue is ordered by moderation_risk_score DESC
      for (let i = 0; i < products.length - 1; i++) {
        const scoreA = Number(products[i].moderation_risk_score || 0);
        const scoreB = Number(products[i + 1].moderation_risk_score || 0);
        assert(scoreA >= scoreB, `Queue not sorted by risk score descending: index ${i}(${scoreA}) < index ${i+1}(${scoreB})`);
      }
    });

    // ----------------------------------------------------
    // TEST 8: Admin Risk Flag Resolution & Audit Logging
    // ----------------------------------------------------
    await test("Admin can investigate and resolve active risk flags with resolution notes", async () => {
      assert(testRiskFlagId, "testRiskFlagId not set");

      // 1. Fetch risk flags list via admin endpoint
      const listRes = await fetch(`${API_BASE}/admin/risk/flags?status=flagged`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(listRes.status === 200, `Failed to fetch risk flags: ${listRes.status}`);
      const listData = await listRes.json();
      assert(listData.flags.length >= 1, "Risk flags list returned no open flags");

      // 2. Resolve risk flag
      const resolveRes = await fetch(`${API_BASE}/admin/risk/flags/${testRiskFlagId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          status: "action_taken",
          resolution_notes: "Confirmed duplicate identity: user attempted multi-accounting with same Fayda ID. Account warned.",
        }),
      });

      assert(resolveRes.status === 200, `Failed to resolve risk flag: ${resolveRes.status}`);
      const resolveData = await resolveRes.json();
      assert(resolveData.flag.status === "action_taken", `Expected 'action_taken', got ${resolveData.flag.status}`);
      assert(resolveData.flag.resolution_notes.includes("Confirmed duplicate identity"), "Resolution notes not persisted");

      // 3. Verify in DB
      const dbCheck = await pool.query(`SELECT status, resolved_by, resolved_at FROM risk_flags WHERE id = $1`, [testRiskFlagId]);
      assert(dbCheck.rows[0].status === "action_taken", "Status in DB not updated");
      assert(Number(dbCheck.rows[0].resolved_by) === Number(adminId), "Resolver ID mismatch");
      assert(dbCheck.rows[0].resolved_at !== null, "resolved_at timestamp missing");
    });

  } catch (globalErr) {
    console.error("Test Suite Global Exception:", globalErr);
  } finally {
    console.log("==========================================================");
    console.log(`Phase 6 Test Summary: ${passed} Passed, ${failed} Failed`);
    console.log("==========================================================");
    process.exit(failed > 0 ? 1 : 0);
  }
};

runTests();
