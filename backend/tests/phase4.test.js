/**
 * Phase 4: Authoritative Inventory & Multi-Vendor Order Architecture Test Suite
 * Tests all Phase 4 requirements against the live backend API and database.
 */

const { pool } = require("../src/config/db");
const { signAccessToken } = require("../src/utils/jwt");
const inventoryService = require("../src/services/inventoryService");

const API_BASE = "http://localhost:5000/api";

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
};

const runTests = async () => {
  console.log("==========================================================");
  console.log("Starting Phase 4 Verification: Inventory & Multi-Vendor Orders");
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
  const emailFarmerA = `farmer_phase4_a_${testTimestamp}@example.com`;
  const emailFarmerB = `farmer_phase4_b_${testTimestamp}@example.com`;
  const emailBuyer1 = `buyer_phase4_1_${testTimestamp}@example.com`;
  const emailBuyer2 = `buyer_phase4_2_${testTimestamp}@example.com`;

  let farmerAToken = null;
  let farmerAId = null;
  let farmerBToken = null;
  let farmerBId = null;
  let buyer1Token = null;
  let buyer1Id = null;
  let buyer2Token = null;
  let buyer2Id = null;

  let categoryId = null;
  let productAId = null;
  let productBId = null;
  let productLimitedId = null;
  let testOrderId = null;
  let testSuborderAId = null;

  try {
    // ----------------------------------------------------
    // Setup: Category, Test Farmers, Test Buyers
    // ----------------------------------------------------
    const catRes = await pool.query(`SELECT id FROM categories LIMIT 1`);
    if (catRes.rows.length > 0) {
      categoryId = catRes.rows[0].id;
    } else {
      const newCat = await pool.query(
        `INSERT INTO categories (name, description) VALUES ('Phase 4 Produce', 'Category for Phase 4') RETURNING id`
      );
      categoryId = newCat.rows[0].id;
    }

    // Farmer A
    const regFarmerA = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Farmer Alpha",
        email: emailFarmerA,
        password: "Password123!",
        role: "farmer",
        phone: "+251911440001",
        address: "Hawassa Farm",
      }),
    });
    assert(regFarmerA.status === 201, `Failed to register Farmer A: ${regFarmerA.status}`);
    const farmerAData = await regFarmerA.json();
    farmerAId = farmerAData.user.id;
    await pool.query(
      `UPDATE users SET email_verified = TRUE, is_verified = TRUE, kyc_status = 'approved', kyc_tier = 'verified' WHERE id = $1`,
      [farmerAId]
    );
    farmerAToken = signAccessToken({
      id: farmerAId,
      email: emailFarmerA,
      role: "farmer",
      name: "Farmer Alpha",
    });

    // Farmer B
    const regFarmerB = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Farmer Beta",
        email: emailFarmerB,
        password: "Password123!",
        role: "farmer",
        phone: "+251911440002",
        address: "Jimma Coffee Estate",
      }),
    });
    assert(regFarmerB.status === 201, `Failed to register Farmer B: ${regFarmerB.status}`);
    const farmerBData = await regFarmerB.json();
    farmerBId = farmerBData.user.id;
    await pool.query(
      `UPDATE users SET email_verified = TRUE, is_verified = TRUE, kyc_status = 'approved', kyc_tier = 'verified' WHERE id = $1`,
      [farmerBId]
    );
    farmerBToken = signAccessToken({
      id: farmerBId,
      email: emailFarmerB,
      role: "farmer",
      name: "Farmer Beta",
    });

    // Buyer 1
    const regBuyer1 = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Buyer One",
        email: emailBuyer1,
        password: "Password123!",
        role: "buyer",
        phone: "+251911440003",
        address: "Addis Ababa Bole",
      }),
    });
    assert(regBuyer1.status === 201, `Failed to register Buyer 1: ${regBuyer1.status}`);
    const buyer1Data = await regBuyer1.json();
    buyer1Id = buyer1Data.user.id;
    await pool.query(`UPDATE users SET email_verified = TRUE WHERE id = $1`, [buyer1Id]);
    buyer1Token = signAccessToken({
      id: buyer1Id,
      email: emailBuyer1,
      role: "buyer",
      name: "Buyer One",
    });

    // Buyer 2
    const regBuyer2 = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Buyer Two",
        email: emailBuyer2,
        password: "Password123!",
        role: "buyer",
        phone: "+251911440004",
        address: "Addis Ababa Kazanchis",
      }),
    });
    assert(regBuyer2.status === 201, `Failed to register Buyer 2: ${regBuyer2.status}`);
    const buyer2Data = await regBuyer2.json();
    buyer2Id = buyer2Data.user.id;
    await pool.query(`UPDATE users SET email_verified = TRUE WHERE id = $1`, [buyer2Id]);
    buyer2Token = signAccessToken({
      id: buyer2Id,
      email: emailBuyer2,
      role: "buyer",
      name: "Buyer Two",
    });

    // Insert Products directly with verified status and authoritative inventory
    // Product A from Farmer A: Price 100, Stock 50
    const prodARes = await pool.query(
      `INSERT INTO products (
        farmer_id, category_id, name, description, price, stock, unit, status, moderation_status, is_published
       ) VALUES ($1, $2, 'Phase4 Teff Harvest', 'Premium Grade Teff', 100.00, 50, 'kg', 'active', 'approved', TRUE)
       RETURNING id`,
      [farmerAId, categoryId]
    );
    productAId = prodARes.rows[0].id;
    await pool.query(
      `INSERT INTO inventory (product_id, farmer_id, quantity) VALUES ($1, $2, 50)
       ON CONFLICT (product_id) DO UPDATE SET quantity = 50`,
      [productAId, farmerAId]
    );

    // Product B from Farmer B: Price 250, Stock 20
    const prodBRes = await pool.query(
      `INSERT INTO products (
        farmer_id, category_id, name, description, price, stock, unit, status, moderation_status, is_published
       ) VALUES ($1, $2, 'Phase4 Wild Honey', 'Pure Forest Honey', 250.00, 20, 'jar', 'active', 'approved', TRUE)
       RETURNING id`,
      [farmerBId, categoryId]
    );
    productBId = prodBRes.rows[0].id;
    await pool.query(
      `INSERT INTO inventory (product_id, farmer_id, quantity) VALUES ($1, $2, 20)
       ON CONFLICT (product_id) DO UPDATE SET quantity = 20`,
      [productBId, farmerBId]
    );

    // Product Limited from Farmer A: Stock 1 (for concurrency testing)
    const prodLimRes = await pool.query(
      `INSERT INTO products (
        farmer_id, category_id, name, description, price, stock, unit, status, moderation_status, is_published
       ) VALUES ($1, $2, 'Phase4 Rare Saffron', 'Exclusive Harvest', 500.00, 1, 'gram', 'active', 'approved', TRUE)
       RETURNING id`,
      [farmerAId, categoryId]
    );
    productLimitedId = prodLimRes.rows[0].id;
    await pool.query(
      `INSERT INTO inventory (product_id, farmer_id, quantity) VALUES ($1, $2, 1)
       ON CONFLICT (product_id) DO UPDATE SET quantity = 1`,
      [productLimitedId, farmerAId]
    );

    // ----------------------------------------------------
    // TEST 1: Multi-Vendor Checkout Splitting (1 parent, 2 suborders)
    // ----------------------------------------------------
    await test("Multi-Vendor Checkout creates 1 parent order and 2 distinct suborders", async () => {
      // Buyer 1 adds Product A (qty 2 = 200 ETB) and Product B (qty 1 = 250 ETB) to cart
      const addA = await fetch(`${API_BASE}/cart`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${buyer1Token}`,
        },
        body: JSON.stringify({ product_id: productAId, quantity: 2 }),
      });
      assert(addA.status === 200, `Failed to add product A to cart: ${addA.status}`);

      const addB = await fetch(`${API_BASE}/cart`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${buyer1Token}`,
        },
        body: JSON.stringify({ product_id: productBId, quantity: 1 }),
      });
      assert(addB.status === 200, `Failed to add product B to cart: ${addB.status}`);

      // Perform checkout
      const checkoutRes = await fetch(`${API_BASE}/orders/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${buyer1Token}`,
        },
        body: JSON.stringify({}),
      });
      assert(checkoutRes.status === 201, `Checkout failed: ${checkoutRes.status}`);
      const checkoutData = await checkoutRes.json();
      testOrderId = checkoutData.order.id;

      // Verify parent order in DB
      const orderDb = await pool.query(`SELECT * FROM orders WHERE id = $1`, [testOrderId]);
      assert(orderDb.rows.length === 1, "Parent order record missing in database");
      assert(orderDb.rows[0].order_number.startsWith("ORD-"), "Parent order lacks ORD- prefix");
      assert(Number(orderDb.rows[0].total_amount) === 450.00, `Expected total 450, got ${orderDb.rows[0].total_amount}`);

      // Verify suborders in DB
      const subordersDb = await pool.query(
        `SELECT * FROM suborders WHERE parent_order_id = $1 ORDER BY farmer_id ASC`,
        [testOrderId]
      );
      assert(subordersDb.rows.length === 2, `Expected 2 suborders, got ${subordersDb.rows.length}`);

      const subA = subordersDb.rows.find((s) => Number(s.farmer_id) === Number(farmerAId));
      const subB = subordersDb.rows.find((s) => Number(s.farmer_id) === Number(farmerBId));
      assert(subA, "Suborder for Farmer A missing");
      assert(subB, "Suborder for Farmer B missing");
      assert(Number(subA.subtotal) === 200.00, `Farmer A subtotal expected 200, got ${subA.subtotal}`);
      assert(Number(subB.subtotal) === 250.00, `Farmer B subtotal expected 250, got ${subB.subtotal}`);
      assert(subA.pickup_code && subA.pickup_code.startsWith("GH-"), "Farmer A pickup code missing or invalid");
      assert(subB.pickup_code && subB.pickup_code.startsWith("GH-"), "Farmer B pickup code missing or invalid");
      testSuborderAId = subA.id;
    });

    // ----------------------------------------------------
    // TEST 2: Authoritative Inventory & Stock Reservations
    // ----------------------------------------------------
    await test("Authoritative inventory decrements and stock_reservations logged with TTL", async () => {
      // Product A had stock 50, reserved 2 -> inventory should be 48
      const invA = await pool.query(`SELECT quantity FROM inventory WHERE product_id = $1`, [productAId]);
      assert(Number(invA.rows[0].quantity) === 48, `Expected inventory 48, got ${invA.rows[0].quantity}`);

      // Product B had stock 20, reserved 1 -> inventory should be 19
      const invB = await pool.query(`SELECT quantity FROM inventory WHERE product_id = $1`, [productBId]);
      assert(Number(invB.rows[0].quantity) === 19, `Expected inventory 19, got ${invB.rows[0].quantity}`);

      // products.stock should be synchronized via trigger trg_sync_product_stock
      const prodA = await pool.query(`SELECT stock FROM products WHERE id = $1`, [productAId]);
      assert(Number(prodA.rows[0].stock) === 48, `Expected products.stock 48, got ${prodA.rows[0].stock}`);

      // Check stock_reservations table
      const resv = await pool.query(
        `SELECT * FROM stock_reservations WHERE order_id = $1 ORDER BY product_id ASC`,
        [testOrderId]
      );
      assert(resv.rows.length === 2, `Expected 2 stock reservations, got ${resv.rows.length}`);
      assert(resv.rows[0].status === "reserved", `Expected status 'reserved', got ${resv.rows[0].status}`);
      assert(new Date(resv.rows[0].expires_at) > new Date(), "Reservation expires_at should be in the future");
    });

    // ----------------------------------------------------
    // TEST 3: Concurrency Protection (SELECT FOR UPDATE -> 409 Conflict)
    // ----------------------------------------------------
    await test("Concurrent checkouts for last item result in exactly 1 success and 1 HTTP 409", async () => {
      // ProductLimited has stock 1. Add it to Buyer 1 and Buyer 2 carts
      await fetch(`${API_BASE}/cart`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${buyer1Token}`,
        },
        body: JSON.stringify({ product_id: productLimitedId, quantity: 1 }),
      });

      await fetch(`${API_BASE}/cart`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${buyer2Token}`,
        },
        body: JSON.stringify({ product_id: productLimitedId, quantity: 1 }),
      });

      // Fire concurrent checkouts simultaneously
      const [res1, res2] = await Promise.all([
        fetch(`${API_BASE}/orders/checkout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${buyer1Token}`,
          },
          body: JSON.stringify({}),
        }),
        fetch(`${API_BASE}/orders/checkout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${buyer2Token}`,
          },
          body: JSON.stringify({}),
        }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      assert(
        statuses[0] === 201 && statuses[1] === 409,
        `Expected statuses [201, 409], but got [${res1.status}, ${res2.status}]`
      );

      // Verify inventory for limited item is 0 and NEVER negative
      const invLim = await pool.query(`SELECT quantity FROM inventory WHERE product_id = $1`, [productLimitedId]);
      assert(Number(invLim.rows[0].quantity) === 0, `Expected inventory 0, got ${invLim.rows[0].quantity}`);
    });

    // ----------------------------------------------------
    // TEST 4: Reservation Expiry Sweeper & Auto-Restoration
    // ----------------------------------------------------
    await test("Reservation sweeper releases expired reservations and restores inventory", async () => {
      // Artificially create an expired order and reservation
      const expiredOrderNumber = `ORD-EXPIRED-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const dummyOrder = await pool.query(
        `INSERT INTO orders (order_number, buyer_id, total_amount, total_price, order_status, payment_status, delivery_status)
         VALUES ($1, $2, 100.00, 100.00, 'pending', 'pending', 'pending')
         RETURNING id`,
        [expiredOrderNumber, buyer1Id]
      );
      const expiredOrderId = dummyOrder.rows[0].id;

      // Current Product A inventory is 48. Let's decrement by 5 to 43 and log an expired reservation
      await pool.query(`UPDATE inventory SET quantity = quantity - 5 WHERE product_id = $1`, [productAId]);
      await pool.query(
        `INSERT INTO stock_reservations (order_id, product_id, quantity, status, expires_at)
         VALUES ($1, $2, 5, 'reserved', NOW() - INTERVAL '10 minutes')`,
        [expiredOrderId, productAId]
      );

      // Verify it was 43
      const preInv = await pool.query(`SELECT quantity FROM inventory WHERE product_id = $1`, [productAId]);
      assert(Number(preInv.rows[0].quantity) === 43, `Expected pre-sweep inventory 43, got ${preInv.rows[0].quantity}`);

      // Run sweeper
      const sweepResult = await inventoryService.releaseExpiredReservations();
      assert(sweepResult.released_count >= 1, `Expected at least 1 released reservation, got ${sweepResult.released_count}`);

      // Verify stock was restored by +5 to 48
      const postInv = await pool.query(`SELECT quantity FROM inventory WHERE product_id = $1`, [productAId]);
      assert(Number(postInv.rows[0].quantity) === 48, `Expected restored inventory 48, got ${postInv.rows[0].quantity}`);

      // Verify reservation status is 'released'
      const resvDb = await pool.query(
        `SELECT status FROM stock_reservations WHERE order_id = $1`,
        [expiredOrderId]
      );
      assert(resvDb.rows[0].status === "released", `Expected reservation status 'released', got ${resvDb.rows[0].status}`);

      // Verify expired order was marked 'cancelled'
      const ordDb = await pool.query(`SELECT order_status FROM orders WHERE id = $1`, [expiredOrderId]);
      assert(ordDb.rows[0].order_status === "cancelled", `Expected order status 'cancelled', got ${ordDb.rows[0].order_status}`);
    });

    // ----------------------------------------------------
    // TEST 5: Frozen Snapshot Integrity
    // ----------------------------------------------------
    await test("Order items preserve frozen snapshots even when farmer edits product", async () => {
      // In Test 1, Product A was purchased as "Phase4 Teff Harvest" at 100.00 ETB
      // Farmer A now modifies Product A to "Super Altered Teff" at 999.00 ETB
      await pool.query(
        `UPDATE products SET name = 'Super Altered Teff', price = 999.00 WHERE id = $1`,
        [productAId]
      );

      // Buyer 1 queries their orders
      const buyerOrdersRes = await fetch(`${API_BASE}/orders`, {
        headers: { Authorization: `Bearer ${buyer1Token}` },
      });
      assert(buyerOrdersRes.status === 200, `Failed to fetch buyer orders: ${buyerOrdersRes.status}`);
      const buyerOrdersData = await buyerOrdersRes.json();

      const matchedOrder = buyerOrdersData.orders.find((o) => Number(o.id) === Number(testOrderId));
      assert(matchedOrder, "Target order not found in buyer orders");

      const itemA = matchedOrder.items.find((i) => Number(i.product_id) === Number(productAId));
      assert(itemA, "Item A not found in order items");
      assert(
        itemA.product_name === "Phase4 Teff Harvest",
        `Snapshot broken! Expected 'Phase4 Teff Harvest', got '${itemA.product_name}'`
      );
      assert(
        Number(itemA.price) === 100.00,
        `Snapshot broken! Expected price 100.00, got ${itemA.price}`
      );
      assert(
        Number(matchedOrder.total_amount) === 450.00,
        `Order total corrupted! Expected 450.00, got ${matchedOrder.total_amount}`
      );
    });

    // ----------------------------------------------------
    // TEST 6: Farmer Suborder Isolation
    // ----------------------------------------------------
    await test("Farmer orders endpoint isolates suborders by farmer_id", async () => {
      // Farmer A queries /api/dashboard/farmer/orders
      const farmerARes = await fetch(`${API_BASE}/dashboard/farmer/orders`, {
        headers: { Authorization: `Bearer ${farmerAToken}` },
      });
      assert(farmerARes.status === 200, `Failed to fetch Farmer A orders: ${farmerARes.status}`);
      const farmerAOrders = await farmerARes.json();

      const matchedSubA = farmerAOrders.orders.find((o) => Number(o.order_id) === Number(testOrderId));
      assert(matchedSubA, "Farmer A cannot see their suborder");
      assert(
        Number(matchedSubA.total_amount) === 200.00,
        `Farmer A should only see their portion (200.00), got ${matchedSubA.total_amount}`
      );
      assert(matchedSubA.items.length === 1, `Farmer A should only see their 1 product, got ${matchedSubA.items.length}`);
      assert(matchedSubA.items[0].product_name === "Phase4 Teff Harvest", "Farmer A product mismatch");

      // Farmer B queries /api/dashboard/farmer/orders
      const farmerBRes = await fetch(`${API_BASE}/dashboard/farmer/orders`, {
        headers: { Authorization: `Bearer ${farmerBToken}` },
      });
      assert(farmerBRes.status === 200, `Failed to fetch Farmer B orders: ${farmerBRes.status}`);
      const farmerBOrders = await farmerBRes.json();

      const matchedSubB = farmerBOrders.orders.find((o) => Number(o.order_id) === Number(testOrderId));
      assert(matchedSubB, "Farmer B cannot see their suborder");
      assert(
        Number(matchedSubB.total_amount) === 250.00,
        `Farmer B should only see their portion (250.00), got ${matchedSubB.total_amount}`
      );
      assert(matchedSubB.items.length === 1, `Farmer B should only see their 1 product, got ${matchedSubB.items.length}`);
      assert(matchedSubB.items[0].product_name === "Phase4 Wild Honey", "Farmer B product mismatch");
    });

    // ----------------------------------------------------
    // TEST 7: Suborder Status Transitions
    // ----------------------------------------------------
    await test("Farmer updates suborder status through fulfillment lifecycle", async () => {
      // Transition from pending -> packed
      const packRes = await fetch(`${API_BASE}/dashboard/farmer/suborders/${testSuborderAId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${farmerAToken}`,
        },
        body: JSON.stringify({ status: "packed" }),
      });
      assert(packRes.status === 200, `Failed to pack suborder: ${packRes.status}`);
      const packData = await packRes.json();
      assert(packData.suborder.fulfillment_status === "packed", `Expected 'packed', got ${packData.suborder.fulfillment_status}`);

      // Transition from packed -> dispatched
      const dispatchRes = await fetch(`${API_BASE}/dashboard/farmer/suborders/${testSuborderAId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${farmerAToken}`,
        },
        body: JSON.stringify({ status: "dispatched" }),
      });
      assert(dispatchRes.status === 200, `Failed to dispatch suborder: ${dispatchRes.status}`);
      const dispatchData = await dispatchRes.json();
      assert(dispatchData.suborder.fulfillment_status === "dispatched", `Expected 'dispatched', got ${dispatchData.suborder.fulfillment_status}`);

      // Unauthorized check: Farmer B cannot update Farmer A's suborder
      const unauthRes = await fetch(`${API_BASE}/dashboard/farmer/suborders/${testSuborderAId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${farmerBToken}`,
        },
        body: JSON.stringify({ status: "delivered" }),
      });
      assert(unauthRes.status === 404 || unauthRes.status === 403, `Farmer B should not be able to modify Farmer A's suborder: ${unauthRes.status}`);
    });

    // ----------------------------------------------------
    // TEST 8: Stock Reservation Consumption
    // ----------------------------------------------------
    await test("Successful payment/confirmation consumes stock reservations", async () => {
      // Call confirmReservation for testOrderId
      const confirmedCount = await inventoryService.confirmReservation(testOrderId);
      assert(confirmedCount >= 2, `Expected at least 2 reservations confirmed, got ${confirmedCount}`);

      const resvDb = await pool.query(
        `SELECT status FROM stock_reservations WHERE order_id = $1`,
        [testOrderId]
      );
      assert(resvDb.rows.length === 2, "Expected 2 reservations");
      resvDb.rows.forEach((r) => {
        assert(r.status === "consumed", `Expected status 'consumed', got ${r.status}`);
      });
    });

  } catch (globalErr) {
    console.error("Global Test Error:", globalErr);
  } finally {
    console.log("==========================================================");
    console.log(`Phase 4 Test Summary: ${passed} Passed, ${failed} Failed`);
    console.log("==========================================================");
    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
};

runTests();
