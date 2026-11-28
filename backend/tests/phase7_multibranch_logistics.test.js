/**
 * Phase 7: Enterprise Multi-Branch Fulfillment, Geographic Pricing,
 * Split Allocation, Financial Reconciliation & Operational Recovery Test Suite
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { pool } = require("../src/config/db");
const { signAccessToken } = require("../src/utils/jwt");
const branchService = require("../src/services/branchService");
const inventoryService = require("../src/services/inventoryService");
const addressService = require("../src/services/addressService");
const deliveryPricingService = require("../src/services/deliveryPricingService");
const branchAllocationService = require("../src/services/branchAllocationService");
const orderService = require("../src/services/orderService");
const deliveryService = require("../src/services/deliveryService");
const paymentService = require("../src/services/paymentService");
const logisticsOperationsService = require("../src/services/logisticsOperationsService");
const returnsController = require("../src/controllers/returnsController");

const assert = (cond, msg) => {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
};

const runTests = async () => {
  console.log("===================================================================");
  console.log("Phase 7 Enterprise Multi-Branch, Pricing & Fulfillment Test Suite");
  console.log("===================================================================");

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
      if (process.env.DEBUG_STACK) console.error(err.stack);
      failed++;
    }
  };

  const ts = Date.now();
  let farmerId, buyer1Id, buyer2Id, staffAId, adminId, driverId, categoryId;
  let farmerActor, buyer1Actor, buyer2Actor, staffAActor, adminActor, driverActor;
  let branchAddisId, branchBishoftuId, branchHawassaId, draftBranchId;
  let prodMultiId, prodHawassaOnlyId, prodLastStockId, prodColdId;
  let createdRuleId;
  const createdOrderIds = [];

  try {
    // ------------------------------------------------------------------
    // SEED USERS & PRODUCTS
    // ------------------------------------------------------------------
    const uFarmer = await pool.query(
      `INSERT INTO users (name, email, password, role, role_id, email_verified, is_verified, account_status, kyc_status, phone, address)
       VALUES ('Highland Agro Enterprise', $1, 'pw', 'farmer', 2, TRUE, TRUE, 'active', 'approved', '+251911000111', 'Bishoftu') RETURNING *`,
      [`farmer_p7_${ts}@test.et`]
    );
    farmerId = uFarmer.rows[0].id;
    farmerActor = { id: farmerId, role: "farmer", name: "Highland Agro Enterprise" };

    const uBuyer1 = await pool.query(
      `INSERT INTO users (name, email, password, role, role_id, email_verified, is_verified, account_status, phone, address)
       VALUES ('Selam Market Buyer', $1, 'pw', 'buyer', 1, TRUE, TRUE, 'active', '+251911000222', 'Addis Ababa, Bole') RETURNING *`,
      [`buyer1_p7_${ts}@test.et`]
    );
    buyer1Id = uBuyer1.rows[0].id;
    buyer1Actor = { id: buyer1Id, role: "buyer", name: "Selam Market Buyer" };

    const uBuyer2 = await pool.query(
      `INSERT INTO users (name, email, password, role, role_id, email_verified, is_verified, account_status, phone, address)
       VALUES ('Merkato Wholesale', $1, 'pw', 'buyer', 1, TRUE, TRUE, 'active', '+251911000333', 'Addis Ababa, Merkato') RETURNING *`,
      [`buyer2_p7_${ts}@test.et`]
    );
    buyer2Id = uBuyer2.rows[0].id;
    buyer2Actor = { id: buyer2Id, role: "buyer", name: "Merkato Wholesale" };

    const uStaffA = await pool.query(
      `INSERT INTO users (name, email, password, role, role_id, email_verified, is_verified, account_status, phone)
       VALUES ('Branch A Inventory Clerk', $1, 'pw', 'farmer', 2, TRUE, TRUE, 'active', '+251911000444') RETURNING *`,
      [`staffA_p7_${ts}@test.et`]
    );
    staffAId = uStaffA.rows[0].id;
    staffAActor = { id: staffAId, role: "farmer", name: "Branch A Inventory Clerk" };

    const uAdmin = await pool.query(
      `INSERT INTO users (name, email, password, role, role_id, admin_role_id, email_verified, is_verified, account_status)
       VALUES ('Logistics SuperAdmin', $1, 'pw', 'admin', 3, 1, TRUE, TRUE, 'active') RETURNING *`,
      [`admin_p7_${ts}@test.et`]
    );
    adminId = uAdmin.rows[0].id;
    adminActor = { id: adminId, role: "admin", name: "Logistics SuperAdmin" };

    const uDriver = await pool.query(
      `INSERT INTO users (name, email, password, role, role_id, email_verified, is_verified, account_status, phone)
       VALUES ('Verified Fleet Driver', $1, 'pw', 'delivery_partner', 4, TRUE, TRUE, 'active', '+251911000555') RETURNING *`,
      [`driver_p7_${ts}@test.et`]
    );
    driverId = uDriver.rows[0].id;
    driverActor = { id: driverId, role: "delivery_partner", name: "Verified Fleet Driver" };
    await pool.query(
      `INSERT INTO delivery_profiles (user_id, vehicle_type, vehicle_plate, license_number, national_id_number, verification_status, trust_score)
       VALUES ($1, 'Cold Truck', 'ETH-3-99881', 'LIC-99881', 'NID-99881', 'verified', 5.00)`,
      [driverId]
    );

    const catRes = await pool.query(`SELECT id FROM categories LIMIT 1`);
    categoryId = catRes.rows[0].id;

    // Create products
    const insProd = async (name, price, coldChain = false) => {
      const r = await pool.query(
        `INSERT INTO products (farmer_id, category_id, name, description, price, stock, unit, status, moderation_status, is_published, pickup_available, farmer_delivery_available, delivery_radius_km, cold_chain_required)
         VALUES ($1,$2,$3,'Fresh test produce',$4,100,'kg','active','approved',TRUE,TRUE,TRUE,120,$5) RETURNING id`,
        [farmerId, categoryId, name, price, coldChain]
      );
      return r.rows[0].id;
    };
    prodMultiId = await insProd(`Phase7 Tomatoes ${ts}`, 65.0, false);
    prodHawassaOnlyId = await insProd(`Phase7 Avocado ${ts}`, 110.0, true);
    prodLastStockId = await insProd(`Phase7 Red Onion ${ts}`, 55.0, false);
    prodColdId = await insProd(`Phase7 Fresh Berries ${ts}`, 180.0, true);

    // ==================================================================
    // GROUP 1: MULTI-BRANCH SETUP, VERIFICATION & SCOPED STAFF RBAC
    // ==================================================================
    await test("1.1 Farmer creates 3 branches + Draft verification gate blocks unverified fulfillment", async () => {
      const init = await branchService.getMyBusinessAndBranches(farmerActor);
      assert(init.business && init.branches.length >= 1, "Farmer should have business + primary branch");
      branchBishoftuId = init.branches[0].id;

      // Update main farm as Bishoftu
      await branchService.updateFarmerBranch({
        actor: farmerActor,
        branchId: branchBishoftuId,
        payload: { name: "Bishoftu Main Farm", physical_address: "Bishoftu Agro Park", region: "Oromia", city: "Bishoftu", latitude: 8.7522, longitude: 38.9785 },
      });

      const brAddis = await branchService.createFarmerBranch({
        actor: farmerActor,
        payload: { name: "Addis Bole Warehouse", branch_type: "warehouse", physical_address: "Bole Bulbula, Addis Ababa", region: "Addis Ababa", city: "Addis Ababa", latitude: 8.995, longitude: 38.789, submit_for_review: true },
      });
      branchAddisId = brAddis.id;
      assert(brAddis.verification_status === "submitted", "New farmer branch must not bypass verification");

      const brHawassa = await branchService.createFarmerBranch({
        actor: farmerActor,
        payload: { name: "Hawassa Collection Center", branch_type: "collection_center", physical_address: "Hawassa Industrial Rd", region: "Sidama", city: "Hawassa", latitude: 7.0621, longitude: 38.4763, submit_for_review: true },
      });
      branchHawassaId = brHawassa.id;

      const brDraft = await branchService.createFarmerBranch({
        actor: farmerActor,
        payload: { name: "Unverified Draft Branch", branch_type: "retail_branch", physical_address: "Adama", region: "Oromia", city: "Adama", submit_for_review: false },
      });
      draftBranchId = brDraft.id;
      assert(brDraft.verification_status === "draft", "Draft branch stays draft");

      // Admin verifies Addis & Hawassa (leaving DraftBranch unverified)
      await branchService.reviewBranchVerificationAdmin({ actor: adminActor, branchId: branchAddisId, nextStatus: "verified", decisionNotes: "Passed inspection" });
      await branchService.reviewBranchVerificationAdmin({ actor: adminActor, branchId: branchHawassaId, nextStatus: "verified", decisionNotes: "Passed inspection" });

      // Put stock in unverified draftBranch and verify it is NOT returned as eligible
      await inventoryService.upsertBranchProductStock({ actor: farmerActor, branchId: draftBranchId, payload: { product_id: prodHawassaOnlyId, on_hand_quantity: 500 } });
      await inventoryService.upsertBranchProductStock({ actor: farmerActor, branchId: branchHawassaId, payload: { product_id: prodHawassaOnlyId, on_hand_quantity: 20, allocation_policy: "fefo", expiry_date: "2027-05-01" } });

      // Seed branch inventories: Addis = 25 kg, Bishoftu = 60 kg, Hawassa = 15 kg
      await inventoryService.upsertBranchProductStock({ actor: farmerActor, branchId: branchAddisId, payload: { product_id: prodMultiId, on_hand_quantity: 25 } });
      await inventoryService.upsertBranchProductStock({ actor: farmerActor, branchId: branchBishoftuId, payload: { product_id: prodMultiId, on_hand_quantity: 60 } });
      await inventoryService.upsertBranchProductStock({ actor: farmerActor, branchId: branchHawassaId, payload: { product_id: prodMultiId, on_hand_quantity: 15 } });
      await inventoryService.upsertBranchProductStock({ actor: farmerActor, branchId: branchAddisId, payload: { product_id: prodLastStockId, on_hand_quantity: 5 } });
      await inventoryService.upsertBranchProductStock({ actor: farmerActor, branchId: branchAddisId, payload: { product_id: prodColdId, on_hand_quantity: 10 } });
    });

    await test("1.2 Scoped RBAC: Branch A staff blocked from Branch B & financial payout settings", async () => {
      await branchService.assignBranchStaff({
        actor: farmerActor,
        branchId: branchAddisId,
        payload: { user_id: staffAId, staff_name: "Branch A Inventory Clerk", role: "inventory_manager" },
      });

      // Allowed on Branch A
      const ok = await inventoryService.upsertBranchProductStock({
        actor: staffAActor,
        branchId: branchAddisId,
        payload: { product_id: prodMultiId, on_hand_quantity: 25 },
      });
      assert(Number(ok.on_hand_quantity) === 25, "Staff A can manage Branch A stock");

      // Forbidden on Branch B
      let blockedB = false;
      try {
        await inventoryService.upsertBranchProductStock({
          actor: staffAActor,
          branchId: branchBishoftuId,
          payload: { product_id: prodMultiId, on_hand_quantity: 99 },
        });
      } catch (e) {
        blockedB = e.statusCode === 403;
      }
      assert(blockedB, "Branch A staff MUST be blocked (403) from Branch B inventory");

      // Forbidden from changing farmer business financial payout settings
      let blockedFin = false;
      try {
        await branchService.assertBranchAccess({ actor: staffAActor, branchId: branchAddisId, requiredPermission: "manage_financials" });
      } catch (e) {
        blockedFin = e.statusCode === 403;
      }
      assert(blockedFin, "Branch staff MUST NOT alter farmer financial payout account");

      let blockedFinOwner = false;
      try {
        await branchService.updateMyBusiness({ actor: staffAActor, payload: { farmer_id: farmerId, payout_account_number: "HACKED" } });
      } catch (e) {
        blockedFinOwner = e.statusCode === 403;
      }
      assert(blockedFinOwner, "Branch staff MUST NOT alter owner's business financial payout account");
    });

    // ==================================================================
    // GROUP 2: INTELLIGENT ALLOCATION, CLOSEST-LACKING-STOCK, & SPLITS
    // ==================================================================
    await test("2.1 Product only in Hawassa allocates to Hawassa (ignores unverified draft branch)", async () => {
      const alloc = await branchAllocationService.allocateFarmerItemsToBranches({
        farmerId,
        farmerItems: [{ product_id: prodHawassaOnlyId, name: "Avocado", quantity: 5, unit: "kg", cold_chain_required: true }],
        requestedDeliveryMethod: "delivery_partner",
        destinationAddress: "Addis Ababa, Bole",
      });
      assert(alloc.packages.length === 1 && alloc.packages[0].branch.id === branchHawassaId, "Must allocate exclusively to verified Hawassa branch");
    });

    await test("2.2 Closest branch (Addis, 25 kg) skipped for 40 kg order -> selects Bishoftu (60 kg)", async () => {
      const alloc = await branchAllocationService.allocateFarmerItemsToBranches({
        farmerId,
        farmerItems: [{ product_id: prodMultiId, name: "Tomatoes", quantity: 40, unit: "kg" }],
        requestedDeliveryMethod: "delivery_partner",
        destinationAddress: "Addis Ababa, Bole",
        strategyOverride: "nearest",
      });
      assert(alloc.packages.length === 1 && alloc.packages[0].branch.id === branchBishoftuId, "Nearest branch without enough stock must not win; Bishoftu (60 kg) must win");
    });

    await test("2.3 Split Fulfillment blocked without buyer consent, succeeds with consent into 2 branch suborders", async () => {
      let splitPrompted = false;
      try {
        await branchAllocationService.allocateFarmerItemsToBranches({
          farmerId,
          farmerItems: [{ product_id: prodMultiId, name: "Tomatoes", quantity: 75, unit: "kg" }],
          requestedDeliveryMethod: "delivery_partner",
          destinationAddress: "Addis Ababa, Bole",
          allowSplit: false,
        });
      } catch (e) {
        splitPrompted = Boolean(e.requires_split_approval && e.proposed_packages?.length >= 2);
      }
      assert(splitPrompted, "Must not silently split across branches without buyer awareness/consent");

      // Place real order with 75 kg and allow_split: true!
      await pool.query(`INSERT INTO carts (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [buyer1Id]);
      const cRes = await pool.query(`SELECT cart_id FROM carts WHERE user_id = $1`, [buyer1Id]);
      await pool.query(`DELETE FROM cart_items WHERE cart_id = $1`, [cRes.rows[0].cart_id]);
      await pool.query(`INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, 75)`, [cRes.rows[0].cart_id, prodMultiId]);

      const order = await orderService.createOrder(buyer1Id, {
        delivery_address: "Addis Ababa, Bole Near Edna Mall",
        fulfillment_selections: { [String(farmerId)]: "delivery_partner" },
        allow_split: true,
      });
      createdOrderIds.push(order.id);
      assert(order.suborders.length === 2, `Expected 2 split suborders from 1 farmer, got ${order.suborders.length}`);
      assert(order.suborders[0].branch_id !== order.suborders[1].branch_id, "Split suborders must record distinct origin branches");

      // Reconcile parent order total == sum(suborders.total_amount)
      const subsRes = await pool.query(`SELECT SUM(total_amount)::numeric AS sub_sum FROM suborders WHERE parent_order_id = $1`, [order.id]);
      assert(Math.abs(Number(order.total_amount) - Number(subsRes.rows[0].sub_sum)) < 0.02, "Parent order total must reconcile with split suborders sum");
    });

    await test("2.4 Concurrent Race Condition: Two buyers compete for last 5 units -> only 1 wins", async () => {
      for (const bId of [buyer1Id, buyer2Id]) {
        await pool.query(`INSERT INTO carts (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [bId]);
        const c = await pool.query(`SELECT cart_id FROM carts WHERE user_id = $1`, [bId]);
        await pool.query(`DELETE FROM cart_items WHERE cart_id = $1`, [c.rows[0].cart_id]);
        await pool.query(`INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, 4)`, [c.rows[0].cart_id, prodLastStockId]);
      }

      const results = await Promise.allSettled([
        orderService.createOrder(buyer1Id, { delivery_address: "Addis Ababa, Bole", fulfillment_selections: { [String(farmerId)]: "farmer_pickup" } }),
        orderService.createOrder(buyer2Id, { delivery_address: "Addis Ababa, Merkato", fulfillment_selections: { [String(farmerId)]: "farmer_pickup" } }),
      ]);
      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");
      fulfilled.forEach((f) => createdOrderIds.push(f.value.id));
      assert(fulfilled.length === 1 && rejected.length === 1, `Concurrent last-stock race must allow 1 winner and reject 1 (got ${fulfilled.length} ok, ${rejected.length} fail)`);
    });

    // ==================================================================
    // GROUP 3: CONTROLLED INTER-BRANCH STOCK TRANSFERS
    // ==================================================================
    await test("3.1 Transfer lifecycle: not sellable until received/verified; handles damaged + blocks duplicate confirm", async () => {
      // Hawassa currently has 15 Tomatoes; Addis has remaining stock -> replenish or check Bishoftu/Hawassa
      await inventoryService.upsertBranchProductStock({ actor: farmerActor, branchId: branchBishoftuId, payload: { product_id: prodColdId, on_hand_quantity: 30 } });
      const tr = await inventoryService.createInventoryTransfer({
        actor: farmerActor,
        payload: { source_branch_id: branchBishoftuId, destination_branch_id: branchHawassaId, items: [{ product_id: prodColdId, quantity: 10 }] },
      });
      await inventoryService.transitionInventoryTransfer({ actor: farmerActor, transferId: tr.id, action: "approve" });
      await inventoryService.transitionInventoryTransfer({ actor: farmerActor, transferId: tr.id, action: "dispatch" });

      // While in_transit, destination Hawassa available_quantity MUST remain 0!
      const midInv = await pool.query(`SELECT available_quantity, in_transit_in_quantity FROM branch_inventory WHERE branch_id = $1 AND product_id = $2`, [branchHawassaId, prodColdId]);
      assert(Number(midInv.rows[0].available_quantity) === 0 && Number(midInv.rows[0].in_transit_in_quantity) === 10, "In-transit stock must NOT be sellable at destination before verification");

      // Receive 8 verified good + 2 damaged!
      await inventoryService.transitionInventoryTransfer({
        actor: farmerActor,
        transferId: tr.id,
        action: "receive_and_verify",
        payload: { items: [{ product_id: prodColdId, verified_quantity: 8, damaged_quantity: 2, missing_quantity: 0 }] },
      });
      const postInv = await pool.query(`SELECT available_quantity, damaged_quantity FROM branch_inventory WHERE branch_id = $1 AND product_id = $2`, [branchHawassaId, prodColdId]);
      assert(Number(postInv.rows[0].available_quantity) === 8 && Number(postInv.rows[0].damaged_quantity) === 2, "Only verified good qty (8) becomes sellable; damaged (2) isolated");

      // Duplicate confirmation MUST fail with 409
      let dupBlocked = false;
      try {
        await inventoryService.transitionInventoryTransfer({ actor: farmerActor, transferId: tr.id, action: "receive_and_verify" });
      } catch (e) {
        dupBlocked = e.statusCode === 409;
      }
      assert(dupBlocked, "Duplicate transfer confirmation must be rejected (409)");
    });

    // ==================================================================
    // GROUP 4: PRICING RULES, QUOTES, STABILITY, GEOGRAPHIC ACCURACY
    // ==================================================================
    await test("4.1 Same destination, different branches -> different fees; quote locks price across rule version changes", async () => {
      const brAddis = (await branchService.assertBranchAccess({ actor: adminActor, branchId: branchAddisId })).branch;
      const brHawassa = (await branchService.assertBranchAccess({ actor: adminActor, branchId: branchHawassaId })).branch;
      const items = [{ product_id: prodColdId, quantity: 10, unit: "kg", cold_chain_required: true }];

      const [estAddis, estHawassa] = await Promise.all([
        deliveryPricingService.estimateBranchDeliveryAsync({ branch: brAddis, delivery_method: "delivery_partner", destination_address: "Addis Ababa, Bole", destination_lat: 9.0, destination_lng: 38.78, items, routingProviderUrl: "http://127.0.0.1:59999" }),
        deliveryPricingService.estimateBranchDeliveryAsync({ branch: brHawassa, delivery_method: "delivery_partner", destination_address: "Addis Ababa, Bole", destination_lat: 9.0, destination_lng: 38.78, items, routingProviderUrl: "http://127.0.0.1:59999" }),
      ]);
      assert(estAddis.is_estimated_fallback === true && estHawassa.is_estimated_fallback === true, "Unavailable routing provider must be honestly flagged as fallback estimate");
      assert(estHawassa.shipping_fee > estAddis.shipping_fee, `Hawassa (${estHawassa.shipping_fee}) must cost more than Addis (${estAddis.shipping_fee}) to deliver to Bole`);

      // Generate persistent quote for Addis branch
      const { quote } = await deliveryPricingService.generateAndSaveDeliveryQuote({
        buyer_id: buyer1Id,
        branch: brAddis,
        delivery_method: "delivery_partner",
        destination_address: "Addis Ababa, Bole",
        destination_lat: 9.0,
        destination_lng: 38.78,
        items,
      });

      // Change urban courier pricing rule AFTER quote issued!
      const newRule = await deliveryPricingService.createPricingRuleVersion({
        actorId: adminId,
        payload: { rule_name: "Surge Test Rule", delivery_method: "delivery_partner", zone_type: "urban", base_fee: 150, per_km_rate: 8, driver_base_payout: 80, deactivate_previous: false },
      });
      createdRuleId = newRule.id;

      // Consume accepted quote -> order MUST keep original quote fee & rule version!
      const c = await pool.query(`SELECT cart_id FROM carts WHERE user_id = $1`, [buyer1Id]);
      await pool.query(`DELETE FROM cart_items WHERE cart_id = $1`, [c.rows[0].cart_id]);
      await pool.query(`INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, 10)`, [c.rows[0].cart_id, prodColdId]);

      const quotedOrder = await orderService.createOrder(buyer1Id, {
        delivery_address: "Addis Ababa, Bole",
        destination_lat: 9.0,
        destination_lng: 38.78,
        fulfillment_selections: { [String(farmerId)]: "delivery_partner" },
        branch_selections: { [String(farmerId)]: branchAddisId },
        quote_ids: { [`${farmerId}:${branchAddisId}`]: quote.id },
      });
      createdOrderIds.push(quotedOrder.id);

      const frozenSub = quotedOrder.suborders[0];
      assert(Math.abs(Number(frozenSub.shipping_fee) - Number(quote.total_delivery_fee)) < 0.01, "Accepted quote price MUST remain frozen even after pricing rule changes");

      // Rollback temporary Surge Test Rule so active defaults stay clean
      await pool.query(`DELETE FROM delivery_pricing_rules WHERE id = $1`, [createdRuleId]);

      // Expired quote MUST be rejected
      const expRes = await deliveryPricingService.generateAndSaveDeliveryQuote({
        buyer_id: buyer1Id, branch: brAddis, delivery_method: "delivery_partner", destination_address: "Addis Ababa, Bole", items, ttlMinutes: -5,
      });
      let expBlocked = false;
      try {
        await deliveryPricingService.validateAndAcceptQuoteForOrder(pool, { quote_id: expRes.quote.id, buyer_id: buyer1Id, branch_id: branchAddisId, delivery_method: "delivery_partner", destination_address: "Addis Ababa, Bole" });
      } catch (e) {
        expBlocked = e.statusCode === 409;
      }
      assert(expBlocked, "Expired delivery quote must fail checkout acceptance (409)");
    });

    await test("4.2 Geographic checks: Invalid GPS rejected, outside country non-serviceable, food-safe consolidation checked", async () => {
      let invalidGpsCaught = false;
      try {
        await addressService.createMyAddress({ actor: buyer1Actor, payload: { label: "Bad Pin", city: "Addis Ababa", line1: "Bole", latitude: 190, longitude: 38.7 } });
      } catch (e) {
        invalidGpsCaught = e.statusCode === 400;
      }
      assert(invalidGpsCaught, "Invalid latitude > 90 must throw 400");

      const outsideZone = await deliveryPricingService.resolveDestinationZone({ addressText: "Remote Out", latitude: 51.5, longitude: -0.1 });
      assert(outsideZone.serviceable === false, "Coordinates outside Ethiopia must be non-serviceable");

      // Consolidation preserves food-safety separation (cold-chain vs ambient in separate groups)
      const consPlan = branchAllocationService.evaluateConsolidationPlan([
        { fulfillment_type: "delivery_partner", branch: { id: 1 }, estimate: { shipping_fee: 100, special_handling_flags: { cold_chain: true } } },
        { fulfillment_type: "delivery_partner", branch: { id: 2 }, estimate: { shipping_fee: 100, special_handling_flags: { cold_chain: false } } },
      ]);
      assert(consPlan.consolidation_eligible === false, "Must NEVER mix cold-chain produce and ambient produce into one consolidated package");
    });

    // ==================================================================
    // GROUP 5: FINANCIAL CONSISTENCY, DRIVER LEDGER, RETURNS & CONFLICTS
    // ==================================================================
    await test("5.1 Payment settlement + Driver claim + Buyer PIN completion keeps Farmer & Driver ledgers independent", async () => {
      const crypto = require("crypto");
      const orderId = createdOrderIds[createdOrderIds.length - 1];
      const whBody = { order_id: orderId, reference: `CHAPA-P7-${orderId}`, status: "success" };
      const whSecret = process.env.CHAPA_WEBHOOK_SECRET || process.env.CHAPA_SECRET_KEY || "chapa_test_secret";
      const whSig = crypto.createHmac("sha256", whSecret).update(JSON.stringify(whBody)).digest("hex");
      // Settle payment via server webhook flow
      await paymentService.processWebhook({
        provider: "chapa",
        headers: { "idempotency-key": `p7-wh-${orderId}`, "chapa-signature": whSig },
        body: whBody,
        rawBody: null,
      });

      const subRes = await pool.query(`SELECT * FROM suborders WHERE parent_order_id = $1 LIMIT 1`, [orderId]);
      const sub = subRes.rows[0];
      assert(Number(sub.driver_compensation_amount) > 0 && Number(sub.shipping_fee) !== Number(sub.driver_compensation_amount), "Driver payout must be calculated independently from buyer fee");

      // Mark packed & claim with verified driver
      await pool.query(`UPDATE suborders SET fulfillment_status = 'packed' WHERE id = $1`, [sub.id]);
      await deliveryService.claimPoolDelivery({ actor: driverActor, suborder_id: sub.id, estimated_time: "3 hours" });
      await deliveryService.updatePartnerTransitStatus({ actor: driverActor, suborder_id: sub.id, status: "picked_up" });
      await deliveryService.updatePartnerTransitStatus({ actor: driverActor, suborder_id: sub.id, status: "in_transit" });

      // Retrieve buyer secret handover PIN and complete delivery
      const delRow = await pool.query(`SELECT delivery_confirmation_code FROM deliveries WHERE suborder_id = $1`, [sub.id]);
      await deliveryService.updatePartnerTransitStatus({
        actor: driverActor,
        suborder_id: sub.id,
        status: "delivered",
        confirmation_code: delRow.rows[0].delivery_confirmation_code,
      });

      // Verify escrow & financial reconciliation report
      const recon = await logisticsOperationsService.getBranchFinancialReconciliation({ farmerId });
      const addisSummary = recon.branch_financial_summary.find((r) => Number(r.branch_id) === Number(branchAddisId));
      assert(addisSummary && Number(addisSummary.gross_produce_sales) > 0, "Branch-level sales must reconcile in financial report");

      const drvLedger = await pool.query(`SELECT * FROM driver_payout_ledger WHERE suborder_id = $1`, [sub.id]);
      assert(drvLedger.rows[0]?.status === "eligible" && Number(drvLedger.rows[0].driver_total_earning) > 0, "Driver payout ledger must record eligible earning independently");

      // Mutate branch name AFTER settlement -> historical suborder.branch_snapshot remains immutable!
      await branchService.updateFarmerBranch({ actor: farmerActor, branchId: branchAddisId, payload: { name: "Addis Renamed Depot" } });
      const snapCheck = await pool.query(`SELECT branch_snapshot FROM suborders WHERE id = $1`, [sub.id]);
      assert(snapCheck.rows[0].branch_snapshot.branch_name === "Addis Bole Warehouse", "Historical branch snapshot must remain immutable after branch edits");
    });

    await test("5.2 Branch closure/suspension creates operational exception without destroying orders; Returns stay quarantined", async () => {
      // Suspend Bishoftu branch which holds an active uncompleted split suborder from 2.3
      const susp = await branchService.reviewBranchVerificationAdmin({
        actor: adminActor,
        branchId: branchBishoftuId,
        nextStatus: "suspended",
        decisionNotes: "Temporary road outage test",
      });
      assert(susp.impacted_exceptions_created >= 1, "Suspending branch with active order must create recovery exception without deleting orders");

      // Test quarantine return: returned quantity must NOT increase sellable available_quantity!
      const orderId = createdOrderIds[createdOrderIds.length - 1];
      const beforeInv = await pool.query(`SELECT available_quantity, returned_quantity FROM branch_inventory WHERE branch_id = $1 AND product_id = $2`, [branchAddisId, prodColdId]);
      const retIns = await pool.query(
        `INSERT INTO returns (order_id, farmer_id, buyer_id, reason, restock_quantity) VALUES ($1,$2,$3,'Bruised crate',2) RETURNING id`,
        [orderId, farmerId, buyer1Id]
      );
      const mockRes = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
      await returnsController.updateReturn({ user: { id: farmerId, role: "farmer" }, params: { id: retIns.rows[0].id }, body: { action: "accept", restock: true } }, mockRes);
      const afterInv = await pool.query(`SELECT available_quantity, returned_quantity FROM branch_inventory WHERE branch_id = $1 AND product_id = $2`, [branchAddisId, prodColdId]);
      assert(
        Number(afterInv.rows[0].available_quantity) === Number(beforeInv.rows[0].available_quantity) &&
        Number(afterInv.rows[0].returned_quantity) > Number(beforeInv.rows[0].returned_quantity),
        "Accepted return MUST enter returned_quantity quarantine, NEVER directly into sellable available_quantity"
      );
    });

    await test("5.3 Time slots block overbooking & Operational comms mask private phone numbers", async () => {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const slot = await logisticsOperationsService.createTimeSlot({
        actor: farmerActor,
        payload: { branch_id: branchAddisId, slot_date: tomorrow, start_time: "09:00", end_time: "12:00", max_capacity: 1 },
      });
      const r1 = await pool.query(`UPDATE delivery_time_slots SET booked_count = booked_count + 1 WHERE id = $1 AND booked_count < max_capacity RETURNING *`, [slot.id]);
      const r2 = await pool.query(`UPDATE delivery_time_slots SET booked_count = booked_count + 1 WHERE id = $1 AND booked_count < max_capacity RETURNING *`, [slot.id]);
      assert(r1.rows.length === 1 && r2.rows.length === 0, "Time slot must prevent overbooking beyond max_capacity");

      const msg = await logisticsOperationsService.postOrderCommunication({
        actor: buyer1Actor,
        orderId: createdOrderIds[0],
        channel: "buyer_farmer",
        message: "Call me on +251911223344 when packed!",
      });
      assert(!msg.message.includes("911223344") && msg.message.includes("[Phone Masked"), "Order communication must mask raw phone numbers");
    });

  } finally {
    // Cleanup seeded test users & cascade their branches/products/orders
    try {
      if (createdOrderIds.length > 0) {
        await pool.query(`DELETE FROM orders WHERE id = ANY($1::bigint[])`, [createdOrderIds]);
      }
      if (farmerId) {
        await pool.query(`DELETE FROM inventory_transfers WHERE farmer_id = $1`, [farmerId]);
      }
      await pool.query(`DELETE FROM delivery_quotes WHERE buyer_id IN ($1, $2)`, [buyer1Id || 0, buyer2Id || 0]);
      await pool.query(`DELETE FROM users WHERE id IN ($1, $2, $3, $4, $5, $6)`, [farmerId || 0, buyer1Id || 0, buyer2Id || 0, staffAId || 0, adminId || 0, driverId || 0]);
    } catch (cleanErr) {
      console.error("Cleanup warning:", cleanErr.message);
    }
    await pool.end();
  }

  console.log("===================================================================");
  console.log(`PHASE 7 SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log("===================================================================");
  if (failed > 0) process.exit(1);
};

runTests();
