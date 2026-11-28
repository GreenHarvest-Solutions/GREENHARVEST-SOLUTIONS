const { pool } = require("../config/db");

const computeAvailableFormula = (row) => {
  const onHand = Number(row.on_hand_quantity || 0);
  const reserved = Number(row.reserved_quantity || 0);
  const committed = Number(row.committed_quantity || 0);
  const damaged = Number(row.damaged_quantity || 0);
  const expired = Number(row.expired_quantity || 0);
  const inTransitOut = Number(row.in_transit_out_quantity || 0);
  return Math.max(0, onHand - reserved - committed - damaged - expired - inTransitOut);
};

/**
 * Legacy-compatible upsertInventory:
 * Synchronizes into the farmer's primary branch in branch_inventory (trigger auto-syncs inventory & products.stock).
 */
const upsertInventory = async ({ product_id, farmer_id, quantity, branch_id = null }) => {
  let targetBranchId = branch_id;
  if (!targetBranchId) {
    const brRes = await pool.query(
      `SELECT id FROM farmer_branches WHERE farmer_id = $1 ORDER BY is_primary DESC, id ASC LIMIT 1`,
      [farmer_id]
    );
    if (brRes.rows.length > 0) {
      targetBranchId = brRes.rows[0].id;
    } else {
      const branchModel = require("./branchModel");
      const ensured = await branchModel.ensureFarmerBusinessAndPrimaryBranch(farmer_id);
      targetBranchId = ensured?.primaryBranch?.id || null;
    }
  }

  if (targetBranchId) {
    const qty = Math.max(0, Number(quantity || 0));
    const biRes = await pool.query(
      `INSERT INTO branch_inventory (
         branch_id, product_id, farmer_id, is_available, on_hand_quantity, available_quantity, updated_at
       ) VALUES ($1, $2, $3, TRUE, $4, $4, NOW())
       ON CONFLICT (branch_id, product_id) DO UPDATE SET
         on_hand_quantity = EXCLUDED.on_hand_quantity,
         available_quantity = GREATEST(0, EXCLUDED.on_hand_quantity - branch_inventory.reserved_quantity - branch_inventory.committed_quantity - branch_inventory.damaged_quantity - branch_inventory.expired_quantity - branch_inventory.in_transit_out_quantity),
         updated_at = NOW()
       RETURNING *`,
      [targetBranchId, product_id, farmer_id, qty]
    );

    const aggRes = await pool.query(
      `SELECT id, product_id, quantity, last_updated FROM inventory WHERE product_id = $1`,
      [product_id]
    );
    if (aggRes.rows[0]) return aggRes.rows[0];
    return { id: biRes.rows[0].id, product_id, quantity: qty, last_updated: biRes.rows[0].updated_at };
  }

  const result = await pool.query(
    `
      INSERT INTO inventory (product_id, farmer_id, quantity, last_updated)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (product_id)
      DO UPDATE
      SET quantity = EXCLUDED.quantity,
          last_updated = NOW()
      RETURNING id, product_id, quantity, last_updated
    `,
    [product_id, farmer_id, quantity]
  );

  return result.rows[0];
};

const getInventoryByProductId = async (product_id) => {
  const result = await pool.query(
    `
      SELECT
        i.id,
        i.product_id,
        p.farmer_id,
        i.quantity,
        i.last_updated,
        p.name AS product_name,
        p.price AS product_price,
        u.name AS farmer_name
      FROM inventory i
      JOIN products p ON p.id = i.product_id
      JOIN users u ON u.id = p.farmer_id
      WHERE i.product_id = $1
    `,
    [product_id]
  );

  return result.rows[0] || null;
};

const findInventoryForUpdate = async (client, productId) => {
  const result = await client.query(
    `SELECT id, product_id, farmer_id, quantity, last_updated 
     FROM inventory 
     WHERE product_id = $1 
     FOR UPDATE`,
    [productId]
  );
  return result.rows[0] || null;
};

const decrementInventoryStock = async (client, productId, quantity) => {
  const result = await client.query(
    `UPDATE inventory 
     SET quantity = GREATEST(0, quantity - $1), last_updated = NOW() 
     WHERE product_id = $2 
     RETURNING id, product_id, quantity, last_updated`,
    [quantity, productId]
  );
  return result.rows[0] || null;
};

const incrementInventoryStock = async (client, productId, quantity) => {
  const result = await client.query(
    `UPDATE inventory 
     SET quantity = quantity + $1, last_updated = NOW() 
     WHERE product_id = $2 
     RETURNING id, product_id, quantity, last_updated`,
    [quantity, productId]
  );
  return result.rows[0] || null;
};

// ============================================================
// Branch-Level Inventory, Freshness Batches & Movements
// ============================================================

const recordInventoryMovement = async (
  clientOrPool,
  { branch_id, product_id, batch_id = null, movement_type, quantity_delta, bucket = "available", reference_type = null, reference_id = null, reason = null, actor_id = null }
) => {
  const db = clientOrPool || pool;
  await db.query(
    `INSERT INTO inventory_movements (
       branch_id, product_id, batch_id, movement_type, quantity_delta, bucket,
       reference_type, reference_id, reason, actor_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [branch_id, product_id, batch_id, movement_type, quantity_delta, bucket, reference_type, reference_id, reason, actor_id]
  );
};

const findBranchInventoryForUpdate = async (client, branchId, productId) => {
  const res = await client.query(
    `SELECT bi.*, fb.verification_status, fb.operational_status, fb.service_available
     FROM branch_inventory bi
     JOIN farmer_branches fb ON fb.id = bi.branch_id
     WHERE bi.branch_id = $1 AND bi.product_id = $2
     FOR UPDATE OF bi`,
    [branchId, productId]
  );
  return res.rows[0] || null;
};

const recomputeAndSaveBranchAvailability = async (client, biRow) => {
  const nextAvailable = computeAvailableFormula(biRow);
  const res = await client.query(
    `UPDATE branch_inventory
     SET on_hand_quantity = $1,
         reserved_quantity = $2,
         committed_quantity = $3,
         damaged_quantity = $4,
         expired_quantity = $5,
         returned_quantity = $6,
         in_transit_out_quantity = $7,
         in_transit_in_quantity = $8,
         available_quantity = $9,
         updated_at = NOW()
     WHERE id = $10
     RETURNING *`,
    [
      Number(biRow.on_hand_quantity || 0),
      Number(biRow.reserved_quantity || 0),
      Number(biRow.committed_quantity || 0),
      Number(biRow.damaged_quantity || 0),
      Number(biRow.expired_quantity || 0),
      Number(biRow.returned_quantity || 0),
      Number(biRow.in_transit_out_quantity || 0),
      Number(biRow.in_transit_in_quantity || 0),
      nextAvailable,
      biRow.id,
    ]
  );
  return res.rows[0];
};

const upsertBranchInventory = async (clientOrPool, {
  branch_id,
  product_id,
  farmer_id,
  is_available = true,
  branch_price_override = null,
  on_hand_quantity = 0,
  allocation_policy = "fifo",
  batch_traceability_required = false,
  freshness_grade = null,
  storage_conditions = null,
  handling_instructions = null,
  harvest_date = null,
  expiry_date = null,
}) => {
  const db = clientOrPool || pool;
  const qty = Math.max(0, Number(on_hand_quantity || 0));
  const res = await db.query(
    `INSERT INTO branch_inventory (
       branch_id, product_id, farmer_id, is_available, branch_price_override,
       on_hand_quantity, available_quantity, allocation_policy, batch_traceability_required,
       freshness_grade, storage_conditions, handling_instructions, harvest_date, expiry_date, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
     ON CONFLICT (branch_id, product_id) DO UPDATE SET
       is_available = COALESCE($4, branch_inventory.is_available),
       branch_price_override = $5,
       on_hand_quantity = $6,
       available_quantity = GREATEST(0, $6 - branch_inventory.reserved_quantity - branch_inventory.committed_quantity - branch_inventory.damaged_quantity - branch_inventory.expired_quantity - branch_inventory.in_transit_out_quantity),
       allocation_policy = COALESCE($7, branch_inventory.allocation_policy),
       batch_traceability_required = COALESCE($8, branch_inventory.batch_traceability_required),
       freshness_grade = COALESCE($9, branch_inventory.freshness_grade),
       storage_conditions = COALESCE($10, branch_inventory.storage_conditions),
       handling_instructions = COALESCE($11, branch_inventory.handling_instructions),
       harvest_date = COALESCE($12, branch_inventory.harvest_date),
       expiry_date = COALESCE($13, branch_inventory.expiry_date),
       updated_at = NOW()
     RETURNING *`,
    [
      branch_id,
      product_id,
      farmer_id,
      Boolean(is_available),
      branch_price_override,
      qty,
      allocation_policy,
      Boolean(batch_traceability_required),
      freshness_grade,
      storage_conditions,
      handling_instructions,
      harvest_date,
      expiry_date,
    ]
  );
  return res.rows[0];
};

const getBranchInventoryList = async (branchId) => {
  const res = await pool.query(
    `SELECT bi.*,
            p.name AS product_name,
            p.price AS catalog_price,
            COALESCE(bi.branch_price_override, p.price) AS effective_price,
            p.unit,
            p.status AS product_status,
            p.image_url,
            p.cold_chain_required,
            fb.name AS branch_name,
            fb.branch_code,
            (SELECT json_agg(b ORDER BY b.expiry_date ASC NULLS LAST, b.created_at ASC)
             FROM inventory_batches b WHERE b.branch_inventory_id = bi.id AND b.available_quantity > 0) AS active_batches
     FROM branch_inventory bi
     JOIN products p ON p.id = bi.product_id
     JOIN farmer_branches fb ON fb.id = bi.branch_id
     WHERE bi.branch_id = $1
     ORDER BY p.name ASC`,
    [branchId]
  );
  return res.rows;
};

const getProductBranchAvailability = async (productId, { onlyEligible = true } = {}) => {
  const eligFilter = onlyEligible
    ? `AND bi.is_available = TRUE AND fb.verification_status = 'verified' AND fb.operational_status IN ('active', 'busy') AND fb.service_available = TRUE AND bi.available_quantity > 0`
    : "";
  const res = await pool.query(
    `SELECT bi.*,
            fb.name AS branch_name,
            fb.branch_code,
            fb.branch_type,
            fb.physical_address,
            fb.region,
            fb.city,
            fb.latitude,
            fb.longitude,
            fb.verification_status,
            fb.operational_status,
            fb.supported_delivery_methods,
            fb.delivery_radius_km,
            fb.farmer_delivery_base_fee,
            fb.farmer_delivery_per_km_rate,
            fb.max_daily_orders,
            fb.is_preferred,
            fb.is_primary,
            fb.operating_hours,
            fb.holiday_dates,
            (SELECT COUNT(*)::int FROM suborders s WHERE s.branch_id = fb.id AND s.created_at >= CURRENT_DATE AND s.fulfillment_status != 'cancelled') AS today_orders_count,
            COALESCE(bi.branch_price_override, p.price) AS effective_price
     FROM branch_inventory bi
     JOIN farmer_branches fb ON fb.id = bi.branch_id
     JOIN products p ON p.id = bi.product_id
     WHERE bi.product_id = $1 ${eligFilter}
     ORDER BY fb.is_preferred DESC, bi.available_quantity DESC, fb.id ASC`,
    [productId]
  );
  return res.rows;
};

const createInventoryBatch = async (clientOrPool, {
  branch_inventory_id,
  branch_id,
  product_id,
  batch_code,
  harvest_date = null,
  expiry_date = null,
  freshness_grade = null,
  storage_conditions = null,
  quality_inspection_status = "passed",
  handling_instructions = null,
  quantity,
}) => {
  const db = clientOrPool || pool;
  const code = batch_code || `LOT-${branch_id}-${product_id}-${Date.now().toString().slice(-6)}`;
  const qty = Number(quantity || 0);
  const res = await db.query(
    `INSERT INTO inventory_batches (
       branch_inventory_id, branch_id, product_id, batch_code, harvest_date, expiry_date,
       freshness_grade, storage_conditions, quality_inspection_status, handling_instructions,
       initial_quantity, available_quantity
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)
     RETURNING *`,
    [
      branch_inventory_id,
      branch_id,
      product_id,
      code,
      harvest_date,
      expiry_date,
      freshness_grade,
      storage_conditions,
      quality_inspection_status,
      handling_instructions,
      qty,
    ]
  );
  return res.rows[0];
};

const selectAllocatableBatchForUpdate = async (client, branchId, productId, policy = "fifo") => {
  const orderSql =
    policy === "fefo"
      ? `ORDER BY expiry_date ASC NULLS LAST, created_at ASC, id ASC`
      : `ORDER BY created_at ASC, id ASC`;
  const res = await client.query(
    `SELECT * FROM inventory_batches
     WHERE branch_id = $1 AND product_id = $2
       AND quality_inspection_status = 'passed'
       AND available_quantity > 0
       AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
     ${orderSql}
     LIMIT 1
     FOR UPDATE`,
    [branchId, productId]
  );
  return res.rows[0] || null;
};

// Atomic branch stock reservation (used on checkout!)
const reserveBranchStockForOrder = async (client, { orderId, suborderId = null, branchId, productId, quantity, actorId = null, ttlMinutes = 30 }) => {
  const bi = await findBranchInventoryForUpdate(client, branchId, productId);
  if (!bi) {
    throw Object.assign(new Error(`No inventory record at branch #${branchId} for product #${productId}`), { statusCode: 409 });
  }
  if (bi.verification_status !== "verified" || !["active", "busy"].includes(bi.operational_status) || bi.service_available === false) {
    throw Object.assign(new Error(`Branch #${branchId} is not currently eligible or is suspended/closed`), { statusCode: 409 });
  }
  if (!bi.is_available || Number(bi.available_quantity) < Number(quantity)) {
    throw Object.assign(
      new Error(`Insufficient stock at branch #${branchId} (requested ${quantity}, available ${bi.available_quantity})`),
      { statusCode: 409 }
    );
  }

  let selectedBatchId = null;
  if (bi.allocation_policy !== "none") {
    const batch = await selectAllocatableBatchForUpdate(client, branchId, productId, bi.allocation_policy);
    if (batch && Number(batch.available_quantity) >= Number(quantity)) {
      selectedBatchId = batch.id;
      await client.query(
        `UPDATE inventory_batches
         SET available_quantity = available_quantity - $1,
             reserved_quantity = reserved_quantity + $1,
             updated_at = NOW()
         WHERE id = $2`,
        [quantity, batch.id]
      );
    }
  }

  bi.reserved_quantity = Number(bi.reserved_quantity) + Number(quantity);
  await recomputeAndSaveBranchAvailability(client, bi);

  const resRow = await client.query(
    `INSERT INTO stock_reservations (order_id, suborder_id, branch_id, product_id, batch_id, quantity, status, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,'reserved',NOW() + ($7 || ' minutes')::INTERVAL)
     RETURNING *`,
    [orderId, suborderId, branchId, productId, selectedBatchId, quantity, ttlMinutes]
  );

  await recordInventoryMovement(client, {
    branch_id: branchId,
    product_id: productId,
    batch_id: selectedBatchId,
    movement_type: "reserve_order",
    quantity_delta: -Number(quantity),
    bucket: "reserved",
    reference_type: "order",
    reference_id: orderId,
    reason: `Reserved for order #${orderId} / suborder #${suborderId}`,
    actor_id: actorId,
  });

  return resRow.rows[0];
};

// Reservations
const createStockReservation = async (client, { orderId, suborderId = null, branchId = null, productId, batchId = null, quantity, ttlMinutes = 15 }) => {
  const result = await client.query(
    `INSERT INTO stock_reservations (order_id, suborder_id, branch_id, product_id, batch_id, quantity, status, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'reserved', NOW() + ($7 || ' minutes')::INTERVAL)
     RETURNING *`,
    [orderId, suborderId, branchId, productId, batchId, quantity, ttlMinutes]
  );
  return result.rows[0];
};

const confirmReservations = async (client, orderId) => {
  const reservedRows = await client.query(
    `SELECT * FROM stock_reservations WHERE order_id = $1 AND status = 'reserved' FOR UPDATE`,
    [orderId]
  );

  for (const r of reservedRows.rows) {
    if (r.branch_id) {
      const bi = await findBranchInventoryForUpdate(client, r.branch_id, r.product_id);
      if (bi) {
        bi.reserved_quantity = Math.max(0, Number(bi.reserved_quantity) - Number(r.quantity));
        bi.committed_quantity = Number(bi.committed_quantity) + Number(r.quantity);
        await recomputeAndSaveBranchAvailability(client, bi);
        await recordInventoryMovement(client, {
          branch_id: r.branch_id,
          product_id: r.product_id,
          batch_id: r.batch_id,
          movement_type: "commit_order",
          quantity_delta: -Number(r.quantity),
          bucket: "committed",
          reference_type: "order",
          reference_id: orderId,
          reason: "Payment confirmed; stock committed for fulfillment",
        });
      }
      if (r.batch_id) {
        await client.query(
          `UPDATE inventory_batches SET reserved_quantity = GREATEST(0, reserved_quantity - $1), updated_at = NOW() WHERE id = $2`,
          [r.quantity, r.batch_id]
        );
      }
    }
  }

  const result = await client.query(
    `UPDATE stock_reservations
     SET status = 'consumed'
     WHERE order_id = $1 AND status = 'reserved'
     RETURNING *`,
    [orderId]
  );
  return result.rows;
};

const releaseReservationsByOrderId = async (client, orderId) => {
  const resRes = await client.query(
    `SELECT * FROM stock_reservations WHERE order_id = $1 AND status = 'reserved' FOR UPDATE`,
    [orderId]
  );

  for (const r of resRes.rows) {
    if (r.branch_id) {
      const bi = await findBranchInventoryForUpdate(client, r.branch_id, r.product_id);
      if (bi) {
        bi.reserved_quantity = Math.max(0, Number(bi.reserved_quantity) - Number(r.quantity));
        await recomputeAndSaveBranchAvailability(client, bi);
        await recordInventoryMovement(client, {
          branch_id: r.branch_id,
          product_id: r.product_id,
          batch_id: r.batch_id,
          movement_type: "release_reservation",
          quantity_delta: Number(r.quantity),
          bucket: "available",
          reference_type: "order",
          reference_id: orderId,
          reason: "Order cancelled or reservation expired",
        });
      }
      if (r.batch_id) {
        await client.query(
          `UPDATE inventory_batches SET available_quantity = available_quantity + $1, reserved_quantity = GREATEST(0, reserved_quantity - $1), updated_at = NOW() WHERE id = $2`,
          [r.quantity, r.batch_id]
        );
      }
    } else {
      await client.query(
        `UPDATE inventory SET quantity = quantity + $1, last_updated = NOW() WHERE product_id = $2`,
        [r.quantity, r.product_id]
      );
    }
  }

  await client.query(
    `UPDATE stock_reservations SET status = 'released' WHERE order_id = $1 AND status = 'reserved'`,
    [orderId]
  );

  return resRes.rows;
};

const releaseExpiredReservations = async (client = pool) => {
  const expiredRes = await client.query(
    `SELECT * FROM stock_reservations WHERE status = 'reserved' AND expires_at < NOW() FOR UPDATE`
  );

  const affectedOrderIds = [...new Set(expiredRes.rows.map((r) => r.order_id))];
  for (const ordId of affectedOrderIds) {
    await releaseReservationsByOrderId(client, ordId);
    await client.query(
      `UPDATE orders SET order_status = 'cancelled', notes = COALESCE(notes || '; ', '') || 'Stock reservation expired' WHERE id = $1 AND order_status = 'pending'`,
      [ordId]
    );
    await client.query(
      `UPDATE suborders SET fulfillment_status = 'cancelled', notes = COALESCE(notes || '; ', '') || 'Stock reservation expired' WHERE parent_order_id = $1 AND fulfillment_status = 'pending'`,
      [ordId]
    );
  }

  return expiredRes.rows;
};

// Transfers Queries
const getTransferById = async (transferId, client = pool) => {
  const tRes = await client.query(
    `SELECT it.*,
            sb.name AS source_branch_name, sb.branch_code AS source_branch_code,
            db.name AS destination_branch_name, db.branch_code AS destination_branch_code,
            (SELECT json_agg(json_build_object(
              'id', iti.id, 'product_id', iti.product_id, 'product_name', p.name, 'unit', p.unit,
              'batch_id', iti.batch_id, 'requested_quantity', iti.requested_quantity,
              'dispatched_quantity', iti.dispatched_quantity, 'received_quantity', iti.received_quantity,
              'damaged_quantity', iti.damaged_quantity, 'missing_quantity', iti.missing_quantity,
              'verified_quantity', iti.verified_quantity
            ) ORDER BY iti.id)
             FROM inventory_transfer_items iti
             JOIN products p ON p.id = iti.product_id
             WHERE iti.transfer_id = it.id) AS items
     FROM inventory_transfers it
     JOIN farmer_branches sb ON sb.id = it.source_branch_id
     JOIN farmer_branches db ON db.id = it.destination_branch_id
     WHERE it.id = $1`,
    [transferId]
  );
  return tRes.rows[0] || null;
};

const listTransfersForFarmer = async (farmerId) => {
  const res = await pool.query(
    `SELECT it.*,
            sb.name AS source_branch_name, db.name AS destination_branch_name,
            (SELECT json_agg(json_build_object(
              'id', iti.id, 'product_id', iti.product_id, 'product_name', p.name,
              'requested_quantity', iti.requested_quantity, 'dispatched_quantity', iti.dispatched_quantity,
              'received_quantity', iti.received_quantity, 'damaged_quantity', iti.damaged_quantity,
              'missing_quantity', iti.missing_quantity, 'verified_quantity', iti.verified_quantity
            )) FROM inventory_transfer_items iti JOIN products p ON p.id = iti.product_id WHERE iti.transfer_id = it.id) AS items
     FROM inventory_transfers it
     JOIN farmer_branches sb ON sb.id = it.source_branch_id
     JOIN farmer_branches db ON db.id = it.destination_branch_id
     WHERE it.farmer_id = $1
     ORDER BY it.created_at DESC`,
    [farmerId]
  );
  return res.rows;
};

const listInventoryMovements = async ({ branchId, productId = null, limit = 50 }) => {
  const params = [branchId];
  let cond = "";
  if (productId) {
    params.push(Number(productId));
    cond = `AND im.product_id = $${params.length}`;
  }
  params.push(Number(limit));
  const res = await pool.query(
    `SELECT im.*, p.name AS product_name, u.name AS actor_name
     FROM inventory_movements im
     JOIN products p ON p.id = im.product_id
     LEFT JOIN users u ON u.id = im.actor_id
     WHERE im.branch_id = $1 ${cond}
     ORDER BY im.created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return res.rows;
};

module.exports = {
  computeAvailableFormula,
  confirmReservations,
  createInventoryBatch,
  createStockReservation,
  decrementInventoryStock,
  findBranchInventoryForUpdate,
  findInventoryForUpdate,
  getBranchInventoryList,
  getInventoryByProductId,
  getProductBranchAvailability,
  getTransferById,
  incrementInventoryStock,
  listInventoryMovements,
  listTransfersForFarmer,
  recomputeAndSaveBranchAvailability,
  recordInventoryMovement,
  releaseExpiredReservations,
  releaseReservationsByOrderId,
  reserveBranchStockForOrder,
  selectAllocatableBatchForUpdate,
  upsertBranchInventory,
  upsertInventory,
};
