/**
 * Phase 2: Farmer Onboarding, Progressive Profiles & KYC Verification Center Test Suite
 * Tests all Phase 2 requirements against the live backend API and database.
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
  console.log("Starting Phase 2 Verification: Farmer Onboarding & KYC Center");
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
  const testFarmerEmail = `phase2_farmer_${testTimestamp}@example.com`;
  const testAdminEmail = `phase2_admin_${testTimestamp}@example.com`;

  let farmerToken = null;
  let farmerUserId = null;
  let adminToken = null;
  let adminUserId = null;
  let uploadedDocId = null;

  // Setup: Register and prepare test farmer and admin accounts
  // 1. Farmer
  const farmerReg = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Chala Phase2 Farmer",
      email: testFarmerEmail,
      password: "ValidPassword123!",
      role: "farmer",
      phone: "+251922334455",
      address: "Bishoftu Zone",
    }),
  });
  assert(farmerReg.status === 201, `Failed to register farmer: ${farmerReg.status}`);
  const farmerData = await farmerReg.json();
  farmerUserId = farmerData.user.id;

  // Mark farmer email verified in DB
  await pool.query(
    `UPDATE users SET email_verified = TRUE, is_verified = FALSE, kyc_status = 'not_submitted', kyc_tier = 'provisional' WHERE id = $1`,
    [farmerUserId]
  );

  const farmerLogin = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testFarmerEmail, password: "ValidPassword123!" }),
  });
  const farmerSession = await farmerLogin.json();
  farmerToken = farmerSession.access_token;

  // 2. Admin
  await pool.query(
    `INSERT INTO users (name, email, password, role, role_id, admin_role_id, email_verified, is_verified, account_status)
     VALUES ('Phase2 Admin', $1, '$2b$10$1Y8g4lG0rX/qYQv0H0o90.87F4nJ84tE7e.1kL1Z4pQeQfVp1G2uS', 'admin', 3, 1, TRUE, TRUE, 'active')
     ON CONFLICT (email) DO UPDATE SET admin_role_id = 1
     RETURNING id`,
    [testAdminEmail]
  );
  const adminDb = await pool.query(`SELECT id FROM users WHERE email = $1`, [testAdminEmail]);
  adminUserId = adminDb.rows[0].id;

  // Clear permission cache if any
  const { invalidateUserPermissionCache } = require("../src/middleware/permissionMiddleware");
  invalidateUserPermissionCache(adminUserId);

  // Generate Admin JWT directly
  const { signAccessToken } = require("../src/utils/jwt");
  adminToken = signAccessToken({
    id: adminUserId,
    email: testAdminEmail,
    role: "admin",
    name: "Phase2 Admin",
  });

  // TEST 1: Progressive Profile Completeness Calculation
  await test("Profile: Farmer profile progress starts with personal info and computes completeness", async () => {
    const res = await fetch(`${API_BASE}/users/farmer/profile-progress`, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();

    assert(typeof data.score === "number", "score must be a number");
    assert(data.sections && data.sections.personal === true, "personal section must be true");
    assert(data.sections.crops === false, "crops section should initially be false");
    assert(data.sections.payout === false, "payout section should initially be false");
  });

  // TEST 2: Progressive Profile Extended Updates
  await test("Profile: Farmer can incrementally save location, production, crops, and banking", async () => {
    const updatePayload = {
      region: "Oromia",
      woreda: "Ada'a",
      kebele: "Kebele 04",
      gps_coordinates: "8.7523, 38.9812",
      farm_name: "Chala Teff & Grain Estate",
      farm_size_hectares: 12.5,
      farming_type: "commercial",
      primary_crops: ["White Teff", "Chickpeas", "Wheat"],
      pickup_address: "Main Debre Zeit Highway Km 45",
      pickup_instructions: "Gate 2 behind grain warehouse",
      bank_name: "Commercial Bank of Ethiopia",
      bank_account_number: "1000123456789",
    };

    const res = await fetch(`${API_BASE}/users/farmer/profile-extended`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${farmerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updatePayload),
    });

    assert(res.status === 200, `Expected 200 on profile update, got ${res.status}`);
    const data = await res.json();
    assert(data.score === 100, `Expected 100% completeness score, got ${data.score}%`);
    assert(data.sections.farm_info === true, "farm_info should be true");
    assert(data.sections.location === true, "location should be true");
    assert(data.sections.crops === true, "crops should be true");
    assert(data.sections.payout === true, "payout should be true");
  });

  // TEST 3: Farmer Verification Center Status
  await test("KYC: Farmer can retrieve self-service verification status and allowed actions", async () => {
    const res = await fetch(`${API_BASE}/farmer/kyc`, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();

    assert(data.kyc_status === "not_submitted", `Expected 'not_submitted', got '${data.kyc_status}'`);
    assert(data.kyc_tier === "provisional", `Expected 'provisional', got '${data.kyc_tier}'`);
    assert(Array.isArray(data.allowed_actions), "allowed_actions must be an array");
    assert(data.allowed_actions.includes("upload_document"), "Must allow document upload");
  });

  // TEST 4: Document Upload Advances Status to Pending
  await test("KYC: Document upload advances farmer kyc_status to 'pending' and records document", async () => {
    const uploadRes = await fetch(`${API_BASE}/farmer/kyc/documents`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${farmerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        document_type: "National ID Card",
        document_category: "identity",
        document_url: "https://res.cloudinary.com/greenharvest/image/upload/v123456/sample_national_id.jpg",
        public_id: "greenharvest/kyc_documents/sample_national_id",
      }),
    });

    assert(uploadRes.status === 201, `Expected 201 on doc upload, got ${uploadRes.status}`);
    const data = await uploadRes.json();
    assert(data.document && data.document.id, "Document record missing from response");
    uploadedDocId = data.document.id;

    // Verify user kyc_status in DB
    const checkDb = await pool.query(`SELECT kyc_status FROM users WHERE id = $1`, [farmerUserId]);
    assert(checkDb.rows[0].kyc_status === "pending", `Expected 'pending', got '${checkDb.rows[0].kyc_status}'`);
  });

  // TEST 5: Document Deletion by Farmer
  await test("KYC: Farmer can remove uploaded document before submission", async () => {
    const delRes = await fetch(`${API_BASE}/farmer/kyc/documents/${uploadedDocId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    assert(delRes.status === 200, `Expected 200 on doc delete, got ${delRes.status}`);

    // Re-upload a document for subsequent submission tests
    const reUpload = await fetch(`${API_BASE}/farmer/kyc/documents`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${farmerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        document_type: "Kebele Resident ID",
        document_category: "identity",
        document_url: "https://res.cloudinary.com/greenharvest/image/upload/v123456/sample_kebele_id.jpg",
      }),
    });
    assert(reUpload.status === 201, "Failed to re-upload document");
  });

  // TEST 6: Submit Verification Application
  await test("KYC: Formally submitting application transitions status to 'under_review'", async () => {
    const subRes = await fetch(`${API_BASE}/farmer/kyc/submit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    assert(subRes.status === 200, `Expected 200 on submit, got ${subRes.status}`);
    const data = await subRes.json();
    assert(data.kyc_status === "under_review", `Expected 'under_review', got '${data.kyc_status}'`);

    const checkDb = await pool.query(`SELECT kyc_status FROM users WHERE id = $1`, [farmerUserId]);
    assert(checkDb.rows[0].kyc_status === "under_review", "DB must reflect 'under_review'");
  });

  // TEST 7: Admin Request Info / Changes Requested Workflow
  await test("Admin: Compliance officer requesting changes updates status to 'changes_requested' with feedback notes", async () => {
    const reviewRes = await fetch(`${API_BASE}/admin/kyc/${farmerUserId}/review`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        decision: "request_info",
        reason: "Document unreadable",
        notes: "Please upload a clearer color scan of your ID card without glare on the photo.",
      }),
    });

    assert(reviewRes.status === 200, `Expected 200 on admin review, got ${reviewRes.status}`);
    const reviewData = await reviewRes.json();
    const currentKycStatus = reviewData.result?.kyc_status || reviewData.kyc_status;
    assert(
      currentKycStatus === "changes_requested",
      `Expected 'changes_requested', got '${currentKycStatus}'`
    );

    // Farmer retrieves status and sees feedback
    const farmerCheck = await fetch(`${API_BASE}/farmer/kyc`, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    const statusData = await farmerCheck.json();
    assert(statusData.kyc_status === "changes_requested", "Farmer status must be changes_requested");
    assert(statusData.latest_review !== null, "latest_review must be populated");
    assert(
      statusData.latest_review.notes.includes("clearer color scan"),
      "Reviewer note must match instruction"
    );
  });

  // TEST 8: Admin Approval Sets Tier 1 and Verified Status
  await test("Admin: Approving farmer KYC sets kyc_status='approved', tier='tier_1', and is_verified=TRUE", async () => {
    const approveRes = await fetch(`${API_BASE}/admin/kyc/${farmerUserId}/review`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        decision: "approve",
        tier: "tier_1",
        notes: "Accredited following successful credentials validation.",
      }),
    });

    assert(approveRes.status === 200, `Expected 200 on approval, got ${approveRes.status}`);

    // Verify DB user record
    const userDb = await pool.query(
      `SELECT kyc_status, kyc_tier, is_verified, email_verified FROM users WHERE id = $1`,
      [farmerUserId]
    );
    const user = userDb.rows[0];
    assert(user.kyc_status === "approved", `Expected 'approved', got '${user.kyc_status}'`);
    assert(user.kyc_tier === "tier_1", `Expected 'tier_1', got '${user.kyc_tier}'`);
    assert(user.is_verified === true, "is_verified must be TRUE for approved farmer");
    assert(user.email_verified === true, "email_verified must remain TRUE");
  });

  console.log("==========================================================");
  console.log(`Phase 2 Test Results: ${passed} Passed, ${failed} Failed`);
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
