/**
 * Phase 5: Local Payments & Three-Way Fulfillment Test Suite
 * Tests all Phase 5 requirements against the live backend API and database.
 */

const crypto = require("crypto");
const { pool } = require("../src/config/db");
const { signAccessToken } = require("../src/utils/jwt");

const API_BASE = "http://localhost:5000/api";

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
};

const runTests = async () => {
  console.log("==========================================================");
  console.log("Starting Phase 5 Verification: Local Payments & Fulfillment");
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
  const emailFarmer = `farmer_phase5_${testTimestamp}@example.com`;
  const emailBuyer = `buyer_phase5_${testTimestamp}@example.com`;
  const emailPartner = `partner_phase5_${testTimestamp}@example.com`;

  let farmerToken = null;
  let farmerId = null;
  let buyerToken = null;
  let buyerId = null;
  let partnerToken = null;
  let partnerId = null;

  let testOrderId = null;
  let testSuborderId = null;
  let testPickupSuborderId = null;
  let testFarmerDelivSuborderId = null;
  let testPartnerSuborderId = null;
  let testPickupCode = null;

  const webhookSecret = process.env.CHAPA_WEBHOOK_SECRET || process.env.CHAPA_SECRET_KEY || "chapa_test_secret";

  try {
    // ----------------------------------------------------
    // Setup: Farmer, Buyer, Delivery Partner, Products, Orders
    // ----------------------------------------------------
    // 1. Farmer
    const regFarmer = await pool.query(
      `INSERT INTO users (name, email, password, role, role_id, email_verified, is_verified, account_status, kyc_status, phone, address)
       VALUES ('Phase5 Farmer', $1, 'hashed_pw', 'farmer', 2, TRUE, TRUE, 'active', 'approved', '+251911550001', 'Bishoftu Onion Farm')
       RETURNING id`,
      [emailFarmer]
    );
    farmerId = regFarmer.rows[0].id;
    farmerToken = signAccessToken({ id: farmerId, email: emailFarmer, role: "farmer", name: "Phase5 Farmer" });

    // 2. Buyer
    const regBuyer = await pool.query(
      `INSERT INTO users (name, email, password, role, role_id, email_verified, is_verified, account_status, phone, address)
       VALUES ('Phase5 Buyer', $1, 'hashed_pw', 'buyer', 1, TRUE, TRUE, 'active', '+251911550002', 'Addis Ababa Sarbet')
       RETURNING id`,
      [emailBuyer]
    );
    buyerId = regBuyer.rows[0].id;
    buyerToken = signAccessToken({ id: buyerId, email: emailBuyer, role: "buyer", name: "Phase5 Buyer" });

    // 3. Delivery Partner
    const regPartner = await pool.query(
      `INSERT INTO users (name, email, password, role, role_id, email_verified, is_verified, account_status, phone)
       VALUES ('Phase5 Partner', $1, 'hashed_pw', 'delivery_partner', 4, TRUE, TRUE, 'active', '+251911550003')
       RETURNING id`,
      [emailPartner]
    );
    partnerId = regPartner.rows[0].id;
    partnerToken = signAccessToken({ id: partnerId, email: emailPartner, role: "delivery_partner", name: "Phase5 Partner" });

    // Category
    const catRes = await pool.query(`SELECT id FROM categories LIMIT 1`);
    const categoryId = catRes.rows[0].id;

    // Create Test Product
    const prodRes = await pool.query(
      `INSERT INTO products (farmer_id, category_id, name, description, price, stock, unit, status, moderation_status, is_published)
       VALUES ($1, $2, 'Phase5 Red Onions', 'Freshly Harvested', 80.00, 100, 'kg', 'active', 'approved', TRUE)
       RETURNING id`,
      [farmerId, categoryId]
    );
    const productId = prodRes.rows[0].id;
    await pool.query(
      `INSERT INTO inventory (product_id, farmer_id, quantity) VALUES ($1, $2, 100)
       ON CONFLICT (product_id) DO UPDATE SET quantity = 100`,
      [productId, farmerId]
    );

    // Create a Parent Order for Payment Testing
    const parentOrderRes = await pool.query(
      `INSERT INTO orders (order_number, buyer_id, total_amount, total_price, order_status, payment_status, delivery_status)
       VALUES ($1, $2, 400.00, 400.00, 'pending', 'pending', 'pending')
       RETURNING id, order_number`,
      [`ORD-P5-${testTimestamp}`, buyerId]
    );
    testOrderId = parentOrderRes.rows[0].id;

    // Create a Suborder for Farmer
    testPickupCode = `GH-778899`;
    const suborderRes = await pool.query(
      `INSERT INTO suborders (parent_order_id, farmer_id, suborder_number, subtotal, shipping_fee, total_amount, fulfillment_type, fulfillment_status, pickup_code)
       VALUES ($1, $2, $3, 400.00, 0.00, 400.00, 'farmer_pickup', 'pending', $4)
       RETURNING id`,
      [testOrderId, farmerId, `SUB-P5-${testOrderId}-${farmerId}`, testPickupCode]
    );
    testSuborderId = suborderRes.rows[0].id;

    // Create frozen order_items and reservation
    await pool.query(
      `INSERT INTO order_items (order_id, suborder_id, product_id, quantity, price, unit_price, unit, product_name, farmer_id, farmer_name)
       VALUES ($1, $2, $3, 5, 80.00, 80.00, 'kg', 'Phase5 Red Onions', $4, 'Phase5 Farmer')`,
      [testOrderId, testSuborderId, productId, farmerId]
    );
    await pool.query(
      `INSERT INTO stock_reservations (order_id, product_id, quantity, status, expires_at)
       VALUES ($1, $2, 5, 'reserved', NOW() + INTERVAL '15 minutes')`,
      [testOrderId, productId]
    );

    // ----------------------------------------------------
    // TEST 1: Provider-Independent Payment Initiation
    // ----------------------------------------------------
    await test("Initiating payment returns provider checkout session and records pending transaction", async () => {
      // Test Telebirr initiation
      const telRes = await fetch(`${API_BASE}/payments/initiate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${buyerToken}`,
        },
        body: JSON.stringify({
          order_id: testOrderId,
          payment_method: "telebirr",
          return_url: "http://localhost:3000/buyer/checkout/payment/verify",
        }),
      });
      assert(telRes.status === 200, `Telebirr init failed: ${telRes.status}`);
      const telData = await telRes.json();
      assert(telData.checkout_url && telData.checkout_url.includes("provider=telebirr"), "Telebirr checkout URL invalid");
      assert(telData.provider === "telebirr", `Expected provider 'telebirr', got ${telData.provider}`);

      // Verify pending payment record in DB
      const pDb = await pool.query(
        `SELECT * FROM payments WHERE order_id = $1 AND gateway_name = 'telebirr'`,
        [testOrderId]
      );
      assert(pDb.rows.length >= 1, "Pending payment record missing in payments table");
      assert(pDb.rows[0].payment_status === "pending", "Payment status should be 'pending'");

      // Test Chapa initiation
      const chapRes = await fetch(`${API_BASE}/payments/initiate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${buyerToken}`,
        },
        body: JSON.stringify({
          order_id: testOrderId,
          payment_method: "chapa",
          return_url: "http://localhost:3000/buyer/checkout/payment/verify",
        }),
      });
      assert(chapRes.status === 200, `Chapa init failed: ${chapRes.status}`);
      const chapData = await chapRes.json();
      assert(chapData.checkout_url && chapData.checkout_url.includes("provider=chapa"), "Chapa checkout URL invalid");
    });

    // ----------------------------------------------------
    // TEST 2: HMAC Cryptographic Webhook Security (Rejection of Invalid Signatures)
    // ----------------------------------------------------
    await test("Webhooks missing or bearing invalid HMAC signature are rejected with HTTP 401", async () => {
      const payload = {
        order_id: testOrderId,
        reference: `tx-chapa-${testOrderId}-invalid`,
        amount: "400.00",
        status: "success",
      };

      // 1. Missing signature
      const noSigRes = await fetch(`${API_BASE}/payments/webhook/chapa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      assert(noSigRes.status === 401, `Expected 401 for missing signature, got ${noSigRes.status}`);

      // 2. Tampered / wrong signature
      const badSigRes = await fetch(`${API_BASE}/payments/webhook/chapa`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "chapa-signature": "deadbeef0123456789abcdef0123456789abcdef0123456789abcdef01234567",
        },
        body: JSON.stringify(payload),
      });
      assert(badSigRes.status === 401, `Expected 401 for invalid signature, got ${badSigRes.status}`);

      // Verify order remains unpaid in DB
      const orderDb = await pool.query(`SELECT payment_status FROM orders WHERE id = $1`, [testOrderId]);
      assert(orderDb.rows[0].payment_status === "pending", "Order must remain unpaid after signature rejection");
    });

    // ----------------------------------------------------
    // TEST 3: Webhook Settlement & Escrow Holding
    // ----------------------------------------------------
    const webhookTxRef = `tx-chapa-${testOrderId}-${Date.now()}`;
    await test("Valid signed webhook settles order, consumes stock reservation, and holds escrow", async () => {
      const webhookPayload = {
        order_id: testOrderId,
        reference: webhookTxRef,
        amount: "400.00",
        status: "success",
      };
      const rawPayload = JSON.stringify(webhookPayload);
      const validSignature = crypto.createHmac("sha256", webhookSecret).update(rawPayload).digest("hex");

      const webhookRes = await fetch(`${API_BASE}/payments/webhook/chapa`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "chapa-signature": validSignature,
        },
        body: rawPayload,
      });

      assert(webhookRes.status === 200, `Webhook settlement failed: ${webhookRes.status}`);
      const webhookData = await webhookRes.json();
      assert(webhookData.payment_status === "paid", `Expected payment_status 'paid', got ${webhookData.payment_status}`);

      // Check Order DB status
      const ordDb = await pool.query(`SELECT payment_status, order_status FROM orders WHERE id = $1`, [testOrderId]);
      assert(ordDb.rows[0].payment_status === "paid", "Order payment_status is not 'paid'");
      assert(ordDb.rows[0].order_status === "confirmed", "Order order_status is not 'confirmed'");

      // Check Suborder DB status
      const subDb = await pool.query(`SELECT fulfillment_status FROM suborders WHERE id = $1`, [testSuborderId]);
      assert(subDb.rows[0].fulfillment_status === "accepted", "Suborder fulfillment_status not advanced to 'accepted'");

      // Check Stock Reservation consumed
      const resvDb = await pool.query(`SELECT status FROM stock_reservations WHERE order_id = $1`, [testOrderId]);
      assert(resvDb.rows[0].status === "consumed", `Stock reservation expected 'consumed', got ${resvDb.rows[0].status}`);

      // Check Escrow Ledger record created
      const escrowDb = await pool.query(
        `SELECT * FROM escrow_ledger WHERE suborder_id = $1`,
        [testSuborderId]
      );
      assert(escrowDb.rows.length === 1, "Escrow ledger entry missing for settled suborder");
      const escrow = escrowDb.rows[0];
      assert(Number(escrow.escrow_amount) === 400.00, `Escrow amount expected 400, got ${escrow.escrow_amount}`);
      assert(Number(escrow.platform_fee_amount) === 20.00, `5% fee expected 20, got ${escrow.platform_fee_amount}`);
      assert(Number(escrow.farmer_payout_amount) === 380.00, `Farmer payout expected 380, got ${escrow.farmer_payout_amount}`);
      assert(escrow.release_status === "held", `Escrow release_status expected 'held', got ${escrow.release_status}`);
    });

    // ----------------------------------------------------
    // TEST 4: Idempotent Webhook Processing (Duplicate Protection)
    // ----------------------------------------------------
    await test("Redelivered webhook is recognized as duplicate and does not duplicate escrow entries", async () => {
      const webhookPayload = {
        order_id: testOrderId,
        reference: webhookTxRef,
        amount: "400.00",
        status: "success",
      };
      const rawPayload = JSON.stringify(webhookPayload);
      const validSignature = crypto.createHmac("sha256", webhookSecret).update(rawPayload).digest("hex");

      const duplicateRes = await fetch(`${API_BASE}/payments/webhook/chapa`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "chapa-signature": validSignature,
        },
        body: rawPayload,
      });

      assert(duplicateRes.status === 200, `Duplicate webhook rejected: ${duplicateRes.status}`);
      const dupData = await duplicateRes.json();
      assert(dupData.already_processed === true, "Expected already_processed: true on redelivered webhook");

      // Verify escrow count did not duplicate
      const escrowCount = await pool.query(
        `SELECT COUNT(*)::int AS count FROM escrow_ledger WHERE suborder_id = $1`,
        [testSuborderId]
      );
      assert(escrowCount.rows[0].count === 1, `Expected exactly 1 escrow record, found ${escrowCount.rows[0].count}`);
    });

    // ----------------------------------------------------
    // TEST 5: Client-Side Redirect Spoof Protection
    // ----------------------------------------------------
    await test("Unverified redirect parameters cannot mark an unpaid order as paid", async () => {
      // Create a new unpaid test order
      const unpaidOrder = await pool.query(
        `INSERT INTO orders (order_number, buyer_id, total_amount, total_price, order_status, payment_status, delivery_status)
         VALUES ($1, $2, 200.00, 200.00, 'pending', 'pending', 'pending')
         RETURNING id`,
        [`ORD-UNPAID-${Date.now()}`, buyerId]
      );
      const unpaidOrderId = unpaidOrder.rows[0].id;

      // Buyer attempts to forge payment verification by claiming payment was successful
      const spoofRes = await fetch(`${API_BASE}/payments/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${buyerToken}`,
        },
        body: JSON.stringify({
          order_id: unpaidOrderId,
          provider: "chapa",
          reference: `fake-tx-spoofed-by-client`,
          status: "success",
        }),
      });

      assert(spoofRes.status === 200, `Verify request failed: ${spoofRes.status}`);
      const spoofData = await spoofRes.json();
      assert(
        spoofData.payment_status === "pending",
        `Order was fraudulently marked paid! Status: ${spoofData.payment_status}`
      );

      // Verify DB remains strictly pending
      const checkDb = await pool.query(`SELECT payment_status FROM orders WHERE id = $1`, [unpaidOrderId]);
      assert(checkDb.rows[0].payment_status === "pending", "Database order payment_status was compromised");
    });

    // ----------------------------------------------------
    // TEST 6: Mode A Fulfillment: Farmer Pickup & Escrow Release
    // ----------------------------------------------------
    await test("Mode A (Pickup): Farmer marks ready, confirms code, and escrow is released to cleared", async () => {
      // 1. Farmer marks ready for pickup
      const readyRes = await fetch(`${API_BASE}/deliveries/suborders/${testSuborderId}/ready-pickup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${farmerToken}`,
        },
        body: JSON.stringify({
          pickup_location: "Bishoftu Valley Farm Gate 2",
          farmer_notes: "Crates packed and stored in cold shade.",
        }),
      });
      assert(readyRes.status === 200, `Ready pickup failed: ${readyRes.status}`);
      const readyData = await readyRes.json();
      assert(readyData.fulfillment_status === "ready_for_pickup", "Fulfillment status not 'ready_for_pickup'");
      assert(readyData.pickup_code === testPickupCode, "Pickup verification code mismatch");

      // Verify Delivery record in DB
      const delivDb = await pool.query(`SELECT * FROM deliveries WHERE suborder_id = $1`, [testSuborderId]);
      assert(delivDb.rows.length === 1, "Delivery record missing");
      assert(delivDb.rows[0].status === "ready_for_pickup", "Delivery status not ready_for_pickup");
      assert(delivDb.rows[0].fulfillment_type === "farmer_pickup", "Fulfillment type not farmer_pickup");

      // 2. Farmer confirms pickup using buyer's code
      const confirmRes = await fetch(`${API_BASE}/deliveries/suborders/${testSuborderId}/confirm-pickup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${farmerToken}`,
        },
        body: JSON.stringify({
          pickup_code: testPickupCode,
        }),
      });
      assert(confirmRes.status === 200, `Confirm pickup failed: ${confirmRes.status}`);
      const confirmData = await confirmRes.json();
      assert(confirmData.fulfillment_status === "delivered", "Status not updated to 'delivered'");
      assert(confirmData.escrow_released === true, "Escrow release flag was not true");

      // Verify Escrow ledger is now 'cleared'
      const escrowAfter = await pool.query(`SELECT release_status, released_at FROM escrow_ledger WHERE suborder_id = $1`, [testSuborderId]);
      assert(escrowAfter.rows[0].release_status === "cleared", `Escrow expected 'cleared', got ${escrowAfter.rows[0].release_status}`);
      assert(escrowAfter.rows[0].released_at !== null, "Escrow released_at timestamp missing");
    });

    // ----------------------------------------------------
    // TEST 7: Mode B Fulfillment: Farmer Self-Delivery & Delivery Code
    // ----------------------------------------------------
    await test("Mode B (Farmer Delivery): Dispatches with ETA & code, confirm delivery clears escrow", async () => {
      // Create suborder with fulfillment_type = 'farmer_delivery'
      const subDelivRes = await pool.query(
        `INSERT INTO suborders (parent_order_id, farmer_id, suborder_number, subtotal, shipping_fee, total_amount, fulfillment_type, fulfillment_status)
         VALUES ($1, $2, $3, 300.00, 50.00, 350.00, 'farmer_delivery', 'accepted')
         RETURNING id`,
        [testOrderId, farmerId, `SUB-FD-${Date.now()}`]
      );
      testFarmerDelivSuborderId = subDelivRes.rows[0].id;

      // Seed escrow
      await pool.query(
        `INSERT INTO escrow_ledger (order_id, suborder_id, buyer_id, farmer_id, escrow_amount, platform_fee_amount, farmer_payout_amount, release_status)
         VALUES ($1, $2, $3, $4, 350.00, 17.50, 332.50, 'held')`,
        [testOrderId, testFarmerDelivSuborderId, buyerId, farmerId]
      );

      // Farmer dispatches delivery
      const dispatchRes = await fetch(`${API_BASE}/deliveries/suborders/${testFarmerDelivSuborderId}/dispatch-farmer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${farmerToken}`,
        },
        body: JSON.stringify({
          estimated_time: "2 hours",
          vehicle_info: "Isuzu Pickup Plate ET-2-9018",
          farmer_notes: "Driver contact +251911999888",
        }),
      });
      assert(dispatchRes.status === 200, `Farmer dispatch failed: ${dispatchRes.status}`);
      const dispatchData = await dispatchRes.json();
      assert(dispatchData.fulfillment_status === "in_transit", "Expected fulfillment_status 'in_transit'");
      const delivCode = dispatchData.delivery_confirmation_code;
      assert(delivCode && delivCode.startsWith("DEL-"), "Invalid delivery confirmation code");

      // Buyer confirms delivery
      const confirmDelivRes = await fetch(`${API_BASE}/deliveries/suborders/${testFarmerDelivSuborderId}/confirm-delivery`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${buyerToken}`,
        },
        body: JSON.stringify({
          confirmation_code: delivCode,
        }),
      });
      assert(confirmDelivRes.status === 200, `Confirm delivery failed: ${confirmDelivRes.status}`);
      const confirmDelivData = await confirmDelivRes.json();
      assert(confirmDelivData.fulfillment_status === "delivered", "Expected status 'delivered'");

      // Verify Escrow is cleared
      const escrowDb = await pool.query(`SELECT release_status FROM escrow_ledger WHERE suborder_id = $1`, [testFarmerDelivSuborderId]);
      assert(escrowDb.rows[0].release_status === "cleared", `Escrow status expected 'cleared', got ${escrowDb.rows[0].release_status}`);
    });

    // ----------------------------------------------------
    // TEST 8: Mode C Fulfillment: Delivery Partner Pool Claim & Transit
    // ----------------------------------------------------
    await test("Mode C (Partner): Delivery partner claims pool order, updates transit, and completes dropoff", async () => {
      // Create suborder for Delivery Partner fulfillment
      const subPartnerRes = await pool.query(
        `INSERT INTO suborders (parent_order_id, farmer_id, suborder_number, subtotal, shipping_fee, total_amount, fulfillment_type, fulfillment_status)
         VALUES ($1, $2, $3, 500.00, 75.00, 575.00, 'delivery_partner', 'accepted')
         RETURNING id`,
        [testOrderId, farmerId, `SUB-PARTNER-${Date.now()}`]
      );
      testPartnerSuborderId = subPartnerRes.rows[0].id;

      // Seed escrow
      await pool.query(
        `INSERT INTO escrow_ledger (order_id, suborder_id, buyer_id, farmer_id, escrow_amount, platform_fee_amount, farmer_payout_amount, release_status)
         VALUES ($1, $2, $3, $4, 575.00, 28.75, 546.25, 'held')`,
        [testOrderId, testPartnerSuborderId, buyerId, farmerId]
      );

      // Partner queries available delivery pool
      const poolRes = await fetch(`${API_BASE}/deliveries/pool`, {
        headers: { Authorization: `Bearer ${partnerToken}` },
      });
      assert(poolRes.status === 200, `Failed to fetch delivery pool: ${poolRes.status}`);
      const poolData = await poolRes.json();
      const poolItem = poolData.pool.find((p) => Number(p.suborder_id) === Number(testPartnerSuborderId));
      assert(poolItem, "Created suborder not found in delivery pool");

      // Partner claims delivery
      const claimRes = await fetch(`${API_BASE}/deliveries/pool/${testPartnerSuborderId}/claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${partnerToken}`,
        },
        body: JSON.stringify({ estimated_time: "3 hours" }),
      });
      assert(claimRes.status === 200, `Claim delivery failed: ${claimRes.status}`);
      const claimData = await claimRes.json();
      assert(Number(claimData.claimed_by) === Number(partnerId), "Claimed partner id mismatch");

      // Partner updates transit: picked_up -> in_transit -> delivered
      await fetch(`${API_BASE}/deliveries/suborders/${testPartnerSuborderId}/partner-status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${partnerToken}`,
        },
        body: JSON.stringify({ status: "picked_up" }),
      });

      const transitRes = await fetch(`${API_BASE}/deliveries/suborders/${testPartnerSuborderId}/partner-status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${partnerToken}`,
        },
        body: JSON.stringify({ status: "in_transit" }),
      });
      assert(transitRes.status === 200, `Transit update failed: ${transitRes.status}`);

      const deliverRes = await fetch(`${API_BASE}/deliveries/suborders/${testPartnerSuborderId}/partner-status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${partnerToken}`,
        },
        body: JSON.stringify({
          status: "delivered",
          proof_image: "https://example.com/proof-of-delivery.jpg",
          notes: "Handed directly to recipient at gate.",
        }),
      });
      assert(deliverRes.status === 200, `Deliver update failed: ${deliverRes.status}`);
      const deliverData = await deliverRes.json();
      assert(deliverData.status === "delivered", "Expected status 'delivered'");
      assert(deliverData.escrow_released === true, "Escrow release flag was not true");

      // Verify Escrow is cleared
      const escrowPartner = await pool.query(`SELECT release_status FROM escrow_ledger WHERE suborder_id = $1`, [testPartnerSuborderId]);
      assert(escrowPartner.rows[0].release_status === "cleared", `Expected 'cleared', got ${escrowPartner.rows[0].release_status}`);
    });

  } catch (globalErr) {
    console.error("Global Test Error:", globalErr);
  } finally {
    console.log("==========================================================");
    console.log(`Phase 5 Test Summary: ${passed} Passed, ${failed} Failed`);
    console.log("==========================================================");
    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
};

runTests();

