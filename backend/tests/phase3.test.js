/**
 * Phase 3: Product Lifecycle, Draft Management & Hybrid Moderation Test Suite
 * Tests all Phase 3 requirements against the live backend API and database.
 */

const { pool } = require("../src/config/db");

const API_BASE = "http://localhost:5000/api";

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
};

const runTests = async () => {
  console.log("==========================================================");
  console.log("Starting Phase 3 Verification: Product Lifecycle & Moderation");
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
  const testProvisionalEmail = `phase3_prov_${testTimestamp}@example.com`;
  const testVerifiedEmail = `phase3_verif_${testTimestamp}@example.com`;
  const testAdminEmail = `phase3_admin_${testTimestamp}@example.com`;

  let provFarmerToken = null;
  let provFarmerId = null;
  let verifFarmerToken = null;
  let verifFarmerId = null;
  let adminToken = null;
  let adminUserId = null;

  let testCategoryId = null;
  let draftProductId = null;
  let verifiedProductId = null;
  let outlierProductId = null;
  let pendingRevisionId = null;

  // ----------------------------------------------------
  // Setup: Categories, Price Corridors, Test Users
  // ----------------------------------------------------
  // Ensure a category exists
  const catRes = await pool.query(`SELECT id FROM categories LIMIT 1`);
  if (catRes.rows.length > 0) {
    testCategoryId = catRes.rows[0].id;
  } else {
    const newCat = await pool.query(
      `INSERT INTO categories (name, description) VALUES ('Cereals & Grains', 'High quality grains') RETURNING id`
    );
    testCategoryId = newCat.rows[0].id;
  }

  // Ensure price corridor exists for Phase3 Wheat
  await pool.query(
    `INSERT INTO price_corridors (commodity_name, min_price, max_price, target_price, deviation_threshold_pct, region)
     VALUES ('Phase3 Wheat', 100.00, 200.00, 150.00, 25.00, 'Oromia')
     ON CONFLICT DO NOTHING`
  );

  // 1. Provisional Farmer (email verified, KYC not submitted / provisional)
  const regProv = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Provisional Farmer Phase3",
      email: testProvisionalEmail,
      password: "Password123!",
      role: "farmer",
      phone: "+251911110001",
      address: "Bishoftu",
    }),
  });
  assert(regProv.status === 201, `Failed to register prov farmer: ${regProv.status}`);
  const provData = await regProv.json();
  provFarmerId = provData.user.id;
  await pool.query(
    `UPDATE users SET email_verified = TRUE, is_verified = FALSE, kyc_status = 'not_submitted', kyc_tier = 'provisional' WHERE id = $1`,
    [provFarmerId]
  );
  const loginProv = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testProvisionalEmail, password: "Password123!" }),
  });
  provFarmerToken = (await loginProv.json()).access_token;

  // 2. Verified Farmer (email verified, is_verified = TRUE, kyc_status = 'approved')
  const regVerif = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Verified Producer Phase3",
      email: testVerifiedEmail,
      password: "Password123!",
      role: "farmer",
      phone: "+251911110002",
      address: "Debre Zeit",
    }),
  });
  assert(regVerif.status === 201, `Failed to register verif farmer: ${regVerif.status}`);
  const verifData = await regVerif.json();
  verifFarmerId = verifData.user.id;
  await pool.query(
    `UPDATE users SET email_verified = TRUE, is_verified = TRUE, kyc_status = 'approved', kyc_tier = 'tier2' WHERE id = $1`,
    [verifFarmerId]
  );
  const loginVerif = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testVerifiedEmail, password: "Password123!" }),
  });
  verifFarmerToken = (await loginVerif.json()).access_token;

  // 3. Admin User (inserted directly as public admin registration is disabled)
  await pool.query(
    `INSERT INTO users (name, email, password, role, role_id, admin_role_id, email_verified, is_verified, account_status)
     VALUES ('Phase3 Admin', $1, '$2b$10$1Y8g4lG0rX/qYQv0H0o90.87F4nJ84tE7e.1kL1Z4pQeQfVp1G2uS', 'admin', 3, 1, TRUE, TRUE, 'active')
     ON CONFLICT (email) DO UPDATE SET admin_role_id = 1
     RETURNING id`,
    [testAdminEmail]
  );
  const adminDb = await pool.query(`SELECT id FROM users WHERE email = $1`, [testAdminEmail]);
  adminUserId = adminDb.rows[0].id;

  const { invalidateUserPermissionCache } = require("../src/middleware/permissionMiddleware");
  invalidateUserPermissionCache(adminUserId);

  const { signAccessToken } = require("../src/utils/jwt");
  adminToken = signAccessToken({
    id: adminUserId,
    email: testAdminEmail,
    role: "admin",
    name: "Phase3 Admin",
  });

  // ----------------------------------------------------
  // TEST SUITE
  // ----------------------------------------------------

  await test("Test 1: Provisional farmer can create and save an incomplete product draft", async () => {
    const res = await fetch(`${API_BASE}/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provFarmerToken}`,
      },
      body: JSON.stringify({
        name: "Provisional Draft Teff",
        status: "draft",
        is_draft: true,
      }),
    });

    assert(res.status === 201, `Expected 201, got ${res.status}`);
    const data = await res.json();
    assert(data.product && data.product.id, "Expected created product object");
    assert(data.product.status === "draft", `Expected status 'draft', got '${data.product.status}'`);
    assert(data.product.is_published === false, "Draft product must have is_published = false");
    draftProductId = data.product.id;
  });

  await test("Test 2: Incomplete draft does not appear in public marketplace", async () => {
    // Public marketplace list
    const res = await fetch(`${API_BASE}/products`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    const foundInMarketplace = data.products.some((p) => p.id === draftProductId);
    assert(!foundInMarketplace, "Draft product MUST NOT be visible in public marketplace");

    // Anonymous detail lookup should return 404
    const anonRes = await fetch(`${API_BASE}/products/${draftProductId}`);
    assert(anonRes.status === 404, `Expected 404 for anonymous draft view, got ${anonRes.status}`);

    // Owner farmer can view their own draft
    const ownerRes = await fetch(`${API_BASE}/products/${draftProductId}`, {
      headers: { Authorization: `Bearer ${provFarmerToken}` },
    });
    assert(ownerRes.status === 200, `Expected 200 for owner view, got ${ownerRes.status}`);
    const ownerData = await ownerRes.json();
    assert(ownerData.product.id === draftProductId, "Owner should see their own draft product");
  });

  await test("Test 3: Submitting complete listing by provisional farmer enters admin queue", async () => {
    // First, complete the draft listing details
    const updateRes = await fetch(`${API_BASE}/products/${draftProductId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provFarmerToken}`,
      },
      body: JSON.stringify({
        name: "Provisional Premium Teff Harvest",
        price: 130,
        stock: 50,
        category_id: testCategoryId,
        description: "Freshly harvested organic high-yield brown teff grain from Bishoftu farm.",
        image_url: "https://example.com/teff.jpg",
      }),
    });
    assert(updateRes.status === 200, `Failed to update draft: ${updateRes.status}`);

    // Now submit the product for moderation
    const submitRes = await fetch(`${API_BASE}/products/${draftProductId}/submit`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provFarmerToken}`,
      },
    });
    assert(submitRes.status === 200, `Expected 200, got ${submitRes.status}`);
    const submitData = await submitRes.json();

    assert(
      submitData.evaluation.decision === "human_review_required",
      `Expected human_review_required for provisional seller, got ${submitData.evaluation.decision}`
    );
    assert(
      submitData.product.status === "pending",
      `Expected status 'pending', got '${submitData.product.status}'`
    );
    assert(
      submitData.product.moderation_status === "pending",
      `Expected moderation_status 'pending', got '${submitData.product.moderation_status}'`
    );
    assert(
      submitData.product.is_published === false,
      "Provisional submitted product must NOT be published automatically"
    );
  });

  await test("Test 4: Submitting valid listing by verified farmer auto-publishes", async () => {
    const res = await fetch(`${API_BASE}/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${verifFarmerToken}`,
      },
      body: JSON.stringify({
        name: "Verified Magna White Teff",
        price: 100,
        stock: 100,
        category_id: testCategoryId,
        description: "Certified Grade-A Ethiopian white teff from our Debre Zeit cooperative fields.",
        image_url: "https://example.com/white-teff.jpg",
        status: "active",
      }),
    });

    assert(res.status === 201, `Expected 201, got ${res.status}`);
    const data = await res.json();
    verifiedProductId = data.product.id;

    assert(
      data.product.status === "active",
      `Expected status 'active', got '${data.product.status}'`
    );
    assert(
      data.product.moderation_status === "approved",
      `Expected moderation_status 'approved', got '${data.product.moderation_status}'`
    );
    assert(
      data.product.is_published === true,
      `Expected is_published = true, got ${data.product.is_published}`
    );

    // Verify it is visible in the public marketplace immediately
    const publicRes = await fetch(`${API_BASE}/products`);
    const publicData = await publicRes.json();
    const found = publicData.products.some((p) => p.id === verifiedProductId);
    assert(found, "Auto-approved verified product MUST appear immediately in public marketplace");
  });

  await test("Test 5: Submitting listing with banned keyword (e.g. paraquat) is rejected by moderation engine", async () => {
    const res = await fetch(`${API_BASE}/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${verifFarmerToken}`,
      },
      body: JSON.stringify({
        name: "Crop Defense Paraquat Herbicide Blend",
        price: 150,
        stock: 50,
        category_id: testCategoryId,
        description: "Fast-acting paraquat pesticide formula for weeds and crops control.",
        image_url: "https://example.com/herbicide.jpg",
      }),
    });

    assert(res.status === 201, `Expected 201, got ${res.status}`);
    const data = await res.json();
    assert(
      data.product.moderation_status === "rejected",
      `Expected moderation_status 'rejected', got '${data.product.moderation_status}'`
    );
    assert(
      data.product.is_published === false,
      "Product with banned keywords must NOT be published"
    );
    assert(
      data.product.moderation_reason && data.product.moderation_reason.toLowerCase().includes("prohibited"),
      `Expected moderation reason to mention prohibited terms, got '${data.product.moderation_reason}'`
    );
  });

  await test("Test 6: Price corridor outlier routes to admin review even for verified farmer", async () => {
    // Corridor for 'Phase3 Wheat' has max_price: 200, threshold: 25% (max allowed = 250)
    // Listing at 350 is an extreme outlier (+75%)
    const res = await fetch(`${API_BASE}/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${verifFarmerToken}`,
      },
      body: JSON.stringify({
        name: "Phase3 Wheat Certified Premium Grain",
        price: 350,
        stock: 40,
        category_id: testCategoryId,
        farm_location: "Oromia",
        description: "Certified organically grown Phase3 Wheat from high-altitude farm plots.",
        image_url: "https://example.com/wheat.jpg",
      }),
    });

    assert(res.status === 201, `Expected 201, got ${res.status}`);
    const data = await res.json();
    outlierProductId = data.product.id;

    assert(
      data.product.moderation_status === "pending",
      `Expected moderation_status 'pending' for outlier, got '${data.product.moderation_status}'`
    );
    assert(
      data.product.is_published === false,
      "Price outlier listing must NOT be auto-published"
    );
    assert(
      data.product.moderation_risk_score > 0,
      `Expected elevated risk score, got ${data.product.moderation_risk_score}`
    );
  });

  await test("Test 7: Significant edit to live active product creates product_revisions record while original stays live", async () => {
    // Original product: verifiedProductId ("Verified Magna White Teff", price: 100, live on public marketplace)
    // Perform significant edit: change title and increase price by 100% (from 100 to 200)
    const editRes = await fetch(`${API_BASE}/products/${verifiedProductId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${verifFarmerToken}`,
      },
      body: JSON.stringify({
        name: "Revised Super Luxury White Teff Deluxe",
        price: 200,
      }),
    });

    assert(editRes.status === 200, `Expected 200, got ${editRes.status}`);
    const editData = await editRes.json();

    assert(
      editData.product.is_revision_pending === true,
      "Expected is_revision_pending = true on significant live edit"
    );
    assert(
      editData.product.pending_revision_id,
      "Expected pending_revision_id in response"
    );
    pendingRevisionId = editData.product.pending_revision_id;

    // CRITICAL: Public marketplace check: Original listing must remain live and UNCHANGED
    const publicRes = await fetch(`${API_BASE}/products/${verifiedProductId}`);
    assert(publicRes.status === 200, "Public view must succeed");
    const publicProduct = (await publicRes.json()).product;

    assert(
      publicProduct.name === "Verified Magna White Teff",
      `Expected original name 'Verified Magna White Teff', got '${publicProduct.name}'`
    );
    assert(
      Number(publicProduct.price) === 100,
      `Expected original price 100, got ${publicProduct.price}`
    );
    assert(
      publicProduct.is_published === true,
      "Original product listing MUST remain published and live"
    );
  });

  await test("Test 8: Admin approves revision, updating live product attributes", async () => {
    // Admin reviews and approves the revision
    const reviewRes = await fetch(
      `${API_BASE}/admin/products/revisions/${pendingRevisionId}/review`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          decision: "approve",
          feedback: "Price increase and rebranding justified by certified organic grading.",
        }),
      }
    );

    assert(reviewRes.status === 200, `Expected 200, got ${reviewRes.status}`);
    const reviewData = await reviewRes.json();
    assert(
      reviewData.result.status === "approved",
      `Expected revision status 'approved', got '${reviewData.result.status}'`
    );

    // Verify live product on public marketplace now reflects approved updates!
    const updatedRes = await fetch(`${API_BASE}/products/${verifiedProductId}`);
    assert(updatedRes.status === 200, "Public fetch after approved revision must succeed");
    const updatedProduct = (await updatedRes.json()).product;

    assert(
      updatedProduct.name === "Revised Super Luxury White Teff Deluxe",
      `Expected updated name, got '${updatedProduct.name}'`
    );
    assert(
      Number(updatedProduct.price) === 200,
      `Expected updated price 200, got ${updatedProduct.price}`
    );
    assert(
      updatedProduct.is_published === true,
      "Product remains published after revision approval"
    );
  });

  console.log("==========================================================");
  console.log(`Phase 3 Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log("==========================================================");

  if (failed > 0) {
    process.exit(1);
  }
};

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test execution fatal error:", err);
    process.exit(1);
  });
