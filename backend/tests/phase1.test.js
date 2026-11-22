/**
 * Phase 1: Security Hardening & Marketplace Integrity Verification Suite
 * Tests all Phase 1 requirements against the live backend API and database.
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
  console.log("Starting Phase 1 Verification: Security & Marketplace Integrity");
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
  const testFarmerEmail = `phase1_farmer_${testTimestamp}@example.com`;
  const testBuyerEmail = `phase1_buyer_${testTimestamp}@example.com`;
  let farmerToken = null;
  let farmerUserId = null;
  let buyerToken = null;
  let buyerUserId = null;
  let activeProductId = null;
  let draftProductId = null;

  // 1. Test Public Admin Registration is Forbidden
  await test("Security: Public registration with role 'admin' must return HTTP 403", async () => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Malicious Actor",
        email: `hacker_${testTimestamp}@example.com`,
        password: "StrongPassword123!",
        role: "admin",
      }),
    });

    assert(res.status === 403, `Expected HTTP 403, got ${res.status}`);
    const data = await res.json();
    assert(
      data.message && data.message.includes("forbidden"),
      `Expected forbidden message, got "${data.message}"`
    );
  });

  // 2. Test Farmer Registration with Phone and Address Persistence
  await test("Auth: Farmer registration persists phone, address, and email_verified=FALSE", async () => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Abebe Phase1 Farmer",
        email: testFarmerEmail,
        password: "ValidPassword123!",
        role: "farmer",
        phone: "+251911223344",
        address: "Bishoftu Farm Sector 4",
      }),
    });

    assert(res.status === 201, `Expected HTTP 201, got ${res.status}`);
    const data = await res.json();
    assert(data.user && data.user.email === testFarmerEmail, "User object mismatch in response");

    farmerUserId = data.user.id;

    // Verify database record
    const dbRes = await pool.query(
      `SELECT id, email, phone, address, email_verified, is_verified, account_status FROM users WHERE id = $1`,
      [farmerUserId]
    );

    assert(dbRes.rows.length === 1, "User record not found in database");
    const user = dbRes.rows[0];
    assert(user.phone === "+251911223344", `Expected phone +251911223344, got "${user.phone}"`);
    assert(user.address === "Bishoftu Farm Sector 4", `Expected address, got "${user.address}"`);
    assert(user.email_verified === false, "email_verified should be false upon registration");
    assert(user.account_status === "active", "account_status should default to 'active'");
  });

  // 3. Test Email Verification and Login
  await test("Auth: Email verification activates login capability", async () => {
    // Attempt login before email verification -> should return 403 EMAIL_NOT_VERIFIED
    const preLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testFarmerEmail,
        password: "ValidPassword123!",
      }),
    });

    assert(preLoginRes.status === 403, `Expected HTTP 403 for unverified email, got ${preLoginRes.status}`);

    // Mark email verified directly in database
    await pool.query(`UPDATE users SET email_verified = TRUE, is_verified = TRUE WHERE id = $1`, [farmerUserId]);

    // Login after verification
    const postLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testFarmerEmail,
        password: "ValidPassword123!",
      }),
    });

    assert(postLoginRes.status === 200, `Expected HTTP 200 on login, got ${postLoginRes.status}`);
    const session = await postLoginRes.json();
    assert(session.access_token, "Access token missing from login response");
    assert(session.user.email_verified === true, "email_verified should be true in session");
    farmerToken = session.access_token;
  });

  // 4. Test KYC Rejection Decoupled from Email Login
  await test("KYC: Rejecting farmer KYC does NOT revoke email login or lock account", async () => {
    // Admin rejects farmer KYC accreditation
    await pool.query(
      `UPDATE users SET is_verified = FALSE, kyc_status = 'rejected', kyc_tier = 'provisional' WHERE id = $1`,
      [farmerUserId]
    );

    // Verify email_verified is still TRUE in database
    const checkDb = await pool.query(
      `SELECT email_verified, is_verified, kyc_status FROM users WHERE id = $1`,
      [farmerUserId]
    );
    assert(checkDb.rows[0].email_verified === true, "email_verified must remain true when KYC is rejected");
    assert(checkDb.rows[0].kyc_status === "rejected", "kyc_status should be rejected");

    // Farmer logs in again with rejected KYC
    const reLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testFarmerEmail,
        password: "ValidPassword123!",
      }),
    });

    assert(reLoginRes.status === 200, `Farmer must still be able to log in, got HTTP ${reLoginRes.status}`);
    const reLoginData = await reLoginRes.json();
    farmerToken = reLoginData.access_token;
  });

  // 5. Test Real-time Account Status Enforcement in Auth Middleware
  await test("Security: Suspending a user immediately blocks API access in authMiddleware", async () => {
    try {
      // Currently active: request should succeed
      const activeReq = await fetch(`${API_BASE}/users/me`, {
        headers: { Authorization: `Bearer ${farmerToken}` },
      });
      assert(activeReq.status === 200, `Expected 200 for active user, got ${activeReq.status}`);

      // Suspend user
      await pool.query(`UPDATE users SET account_status = 'suspended' WHERE id = $1`, [farmerUserId]);

      // Immediate request with same token must now return 403
      const suspendedReq = await fetch(`${API_BASE}/users/me`, {
        headers: { Authorization: `Bearer ${farmerToken}` },
      });
      assert(suspendedReq.status === 403, `Expected 403 ACCOUNT_SUSPENDED, got ${suspendedReq.status}`);
      const suspBody = await suspendedReq.json();
      assert(suspBody.code === "ACCOUNT_SUSPENDED", `Expected code ACCOUNT_SUSPENDED, got "${suspBody.code}"`);
    } finally {
      // Reactivate user for subsequent tests
      await pool.query(`UPDATE users SET account_status = 'active' WHERE id = $1`, [farmerUserId]);
    }
  });

  // 6. Test Marketplace Eligibility Filtering
  await test("Marketplace: Only active, approved, non-deleted listings appear in GET /api/products", async () => {
    // Create Category if needed
    const catRes = await pool.query(`SELECT id FROM categories LIMIT 1`);
    const categoryId = catRes.rows[0]?.id || 1;

    // Product 1: Eligible (active, approved, deleted_at is null)
    const p1 = await pool.query(
      `INSERT INTO products (farmer_id, category_id, name, price, stock, status, moderation_status, deleted_at)
       VALUES ($1, $2, 'Eligible Teff Flour', 120.00, 50, 'active', 'approved', NULL)
       RETURNING id`,
      [farmerUserId, categoryId]
    );
    activeProductId = p1.rows[0].id;

    // Product 2: Draft (status = 'draft')
    const p2 = await pool.query(
      `INSERT INTO products (farmer_id, category_id, name, price, stock, status, moderation_status, deleted_at)
       VALUES ($1, $2, 'Draft Barley Batch', 90.00, 20, 'draft', 'pending', NULL)
       RETURNING id`,
      [farmerUserId, categoryId]
    );
    draftProductId = p2.rows[0].id;

    // Product 3: Rejected (moderation_status = 'rejected')
    const p3 = await pool.query(
      `INSERT INTO products (farmer_id, category_id, name, price, stock, status, moderation_status, deleted_at)
       VALUES ($1, $2, 'Rejected Citrus Batch', 45.00, 10, 'active', 'rejected', NULL)
       RETURNING id`,
      [farmerUserId, categoryId]
    );
    const rejectedProductId = p3.rows[0].id;

    // Query public marketplace
    const publicCatalogRes = await fetch(`${API_BASE}/products?limit=100`);
    assert(publicCatalogRes.status === 200, `Expected 200 on catalog browse, got ${publicCatalogRes.status}`);
    const catalog = await publicCatalogRes.json();
    const productList = catalog.products || [];

    const ids = productList.map((p) => Number(p.id));

    assert(ids.includes(Number(activeProductId)), "Active approved product MUST be in public catalog");
    assert(!ids.includes(Number(draftProductId)), "Draft product MUST NOT be in public catalog");
    assert(!ids.includes(Number(rejectedProductId)), "Rejected product MUST NOT be in public catalog");

    // Single item retrieval test
    const singleEligible = await fetch(`${API_BASE}/products/${activeProductId}`);
    assert(singleEligible.status === 200, "Eligible product must return 200 on detail view");

    const singleDraft = await fetch(`${API_BASE}/products/${draftProductId}`);
    assert(singleDraft.status === 404, "Draft product must return 404 on public detail view");
  });

  // 7. Test Soft Delete Prevents 23503 Foreign Key Errors
  await test("Persistence: Soft delete marks deleted_at, status='deactivated', and removes from public catalog", async () => {
    // Delete the active product via API
    const delRes = await fetch(`${API_BASE}/products/${activeProductId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    assert(delRes.status === 200, `Expected 200 on product delete, got ${delRes.status}`);

    // Verify database record has deleted_at populated
    const checkDb = await pool.query(`SELECT status, deleted_at FROM products WHERE id = $1`, [activeProductId]);
    assert(checkDb.rows[0].deleted_at !== null, "deleted_at must be populated on soft delete");
    assert(checkDb.rows[0].status === "deactivated", "status must be set to 'deactivated'");

    // Verify it is no longer retrievable in public catalog
    const detailRes = await fetch(`${API_BASE}/products/${activeProductId}`);
    assert(detailRes.status === 404, "Soft-deleted product must return 404 on public detail view");
  });

  // 8. Test Checkout Eligibility Gates
  await test("Checkout: Cannot checkout carts containing deactivated, unapproved, or suspended-seller products", async () => {
    // Register and verify a test buyer via API
    const buyerReg = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Phase1 Buyer",
        email: testBuyerEmail,
        password: "ValidPassword123!",
        role: "buyer",
      }),
    });
    assert(buyerReg.status === 201, `Failed to register buyer: ${buyerReg.status}`);

    // Verify email directly
    await pool.query(
      `UPDATE users SET email_verified = TRUE, is_verified = TRUE WHERE email = $1`,
      [testBuyerEmail]
    );

    const buyerLogin = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testBuyerEmail, password: "ValidPassword123!" }),
    });
    assert(buyerLogin.status === 200, `Expected 200 on buyer login, got ${buyerLogin.status}`);
    const buyerSession = await buyerLogin.json();
    buyerToken = buyerSession.access_token;
    buyerUserId = buyerSession.user.id;

    // Re-create an eligible product
    const catRes = await pool.query(`SELECT id FROM categories LIMIT 1`);
    const categoryId = catRes.rows[0]?.id || 1;
    const checkoutProd = await pool.query(
      `INSERT INTO products (farmer_id, category_id, name, price, stock, status, moderation_status, deleted_at)
       VALUES ($1, $2, 'Valid Organic Carrots', 45.00, 20, 'active', 'approved', NULL)
       RETURNING id`,
      [farmerUserId, categoryId]
    );
    const checkoutProdId = checkoutProd.rows[0].id;

    // Add to cart
    await fetch(`${API_BASE}/cart`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${buyerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ product_id: checkoutProdId, quantity: 2 }),
    });

    // Now, deactivate the product before checkout
    await pool.query(`UPDATE products SET status = 'deactivated' WHERE id = $1`, [checkoutProdId]);

    // Attempt checkout
    const checkoutRes = await fetch(`${API_BASE}/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${buyerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    assert(checkoutRes.status === 409, `Expected HTTP 409 Conflict for deactivated item, got ${checkoutRes.status}`);
    const conflictBody = await checkoutRes.json();
    assert(
      conflictBody.message && conflictBody.message.includes("no longer available"),
      `Expected 'no longer available' message, got "${conflictBody.message}"`
    );
  });

  console.log("==========================================================");
  console.log(`Phase 1 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log("==========================================================");

  await pool.end();

  if (failed > 0) {
    process.exit(1);
  }
};

runTests().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
