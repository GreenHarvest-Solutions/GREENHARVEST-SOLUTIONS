const { pool } = require("../config/db");
const inventoryModel = require("../models/inventoryModel");
const productModel = require("../models/productModel");
const branchModel = require("../models/branchModel");
const branchService = require("./branchService");
const { normalizeRole } = require("../utils/roles");
const { isPositiveInteger } = require("../utils/validators");

const createServiceError = (message, statusCode, extra = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  Object.assign(error, extra);
  return error;
};

const canManageFarmerInventory = async ({ actor, farmer_id }) => {
  const role = normalizeRole(actor.role);
  if (role === "admin") return true;
  if (role === "farmer") return Number(actor.id) === Number(farmer_id);
  return false;
};

const updateInventory = async ({ actor, payload }) => {
  const product_id = Number(payload.product_id);
  const quantity = Number(payload.quantity);
  const branch_id = payload.branch_id ? Number(payload.branch_id) : null;

  if (!isPositiveInteger(product_id) || Number.isNaN(quantity) || quantity < 0) {
    throw createServiceError("product_id and non-negative quantity are required", 400);
  }

  const ownership = await productModel.findProductOwnershipById(product_id);
  if (!ownership) throw createServiceError("Product not found", 404);

  if (branch_id) {
    await branchService.assertBranchAccess({ actor, branchId: branch_id, requiredPermission: "manage_inventory" });
  } else {
    const ok = await canManageFarmerInventory({ actor, farmer_id: ownership.farmer_id });
    if (!ok) throw createServiceError("Forbidden: insufficient permissions", 403);
  }

  return inventoryModel.upsertInventory({
    product_id,
    farmer_id: ownership.farmer_id,
    quantity,
    branch_id,
  });
};

const getInventoryByProductId = async (product_id, actor) => {
  if (!isPositiveInteger(product_id)) throw createServiceError("Invalid product id", 400);
  const ownership = await productModel.findProductOwnershipById(Number(product_id));
  if (!ownership) throw createServiceError("Product not found", 404);

  const role = normalizeRole(actor?.role);
  if (role !== "admin") {
    const ok = await canManageFarmerInventory({ actor, farmer_id: ownership.farmer_id });
    if (!ok) throw createServiceError("Forbidden: insufficient permissions", 403);
  }

  const inventory = await inventoryModel.getInventoryByProductId(Number(product_id));
  if (!inventory) throw createServiceError("Inventory not found for this product", 404);
  const branchBreakdown = await inventoryModel.getProductBranchAvailability(Number(product_id), { onlyEligible: false });
  return { ...inventory, branches: branchBreakdown };
};

// ============================================================
// Branch-Level Inventory Operations (Scoped + Concurrency-Safe)
// ============================================================

const getBranchInventory = async ({ actor, branchId }) => {
  await branchService.assertBranchAccess({ actor, branchId, requiredPermission: null });
  const items = await inventoryModel.getBranchInventoryList(Number(branchId));
  return { branch_id: Number(branchId), items };
};

const upsertBranchProductStock = async ({ actor, branchId, payload }) => {
  const { branch } = await branchService.assertBranchAccess({
    actor,
    branchId,
    requiredPermission: "manage_inventory",
  });

  const productId = Number(payload.product_id);
  if (!isPositiveInteger(productId)) throw createServiceError("Valid product_id is required", 400);

  const ownership = await productModel.findProductOwnershipById(productId);
  if (!ownership) throw createServiceError("Product not found", 404);
  if (Number(ownership.farmer_id) !== Number(branch.farmer_id)) {
    throw createServiceError("Product does not belong to this farmer business", 403);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await inventoryModel.findBranchInventoryForUpdate(client, branch.id, productId);
    const nextOnHand = payload.on_hand_quantity !== undefined ? Number(payload.on_hand_quantity) : Number(existing?.on_hand_quantity || 0);
    if (Number.isNaN(nextOnHand) || nextOnHand < 0) throw createServiceError("on_hand_quantity must be >= 0", 400);

    const lockedQty = existing
      ? Number(existing.reserved_quantity) + Number(existing.committed_quantity) + Number(existing.in_transit_out_quantity)
      : 0;
    if (nextOnHand < lockedQty) {
      throw createServiceError(
        `Cannot reduce on-hand stock below active reserved/committed/in-transit obligations (${lockedQty})`,
        409
      );
    }

    const updated = await inventoryModel.upsertBranchInventory(client, {
      branch_id: branch.id,
      product_id: productId,
      farmer_id: branch.farmer_id,
      is_available: payload.is_available !== undefined ? Boolean(payload.is_available) : (existing ? existing.is_available : true),
      branch_price_override: payload.branch_price_override !== undefined ? payload.branch_price_override : (existing ? existing.branch_price_override : null),
      on_hand_quantity: nextOnHand,
      allocation_policy: payload.allocation_policy || existing?.allocation_policy || "fifo",
      batch_traceability_required: payload.batch_traceability_required ?? existing?.batch_traceability_required ?? false,
      freshness_grade: payload.freshness_grade ?? existing?.freshness_grade ?? null,
      storage_conditions: payload.storage_conditions ?? existing?.storage_conditions ?? null,
      handling_instructions: payload.handling_instructions ?? existing?.handling_instructions ?? null,
      harvest_date: payload.harvest_date ?? existing?.harvest_date ?? null,
      expiry_date: payload.expiry_date ?? existing?.expiry_date ?? null,
    });

    const delta = nextOnHand - Number(existing?.on_hand_quantity || 0);
    if (delta !== 0 || !existing) {
      await inventoryModel.recordInventoryMovement(client, {
        branch_id: branch.id,
        product_id: productId,
        movement_type: existing ? "manual_stock_set" : "initial_branch_stock",
        quantity_delta: existing ? delta : nextOnHand,
        bucket: "available",
        reference_type: "branch_inventory",
        reference_id: updated.id,
        reason: payload.reason || "Branch stock updated by manager",
        actor_id: actor.id,
      });
    }

    if (payload.create_batch && delta > 0) {
      await inventoryModel.createInventoryBatch(client, {
        branch_inventory_id: updated.id,
        branch_id: branch.id,
        product_id: productId,
        batch_code: payload.batch_code,
        harvest_date: payload.harvest_date,
        expiry_date: payload.expiry_date,
        freshness_grade: payload.freshness_grade,
        storage_conditions: payload.storage_conditions,
        handling_instructions: payload.handling_instructions,
        quantity: delta,
      });
    }

    await branchModel.recordBranchAuditLog(client, {
      branch_id: branch.id,
      actor_id: actor.id,
      actor_role: normalizeRole(actor.role),
      action: "branch_inventory_updated",
      entity_type: "branch_inventory",
      entity_id: updated.id,
      details: { product_id: productId, on_hand_quantity: nextOnHand, available_quantity: updated.available_quantity },
    });

    await client.query("COMMIT");
    return updated;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Atomic adjustment of buckets: restock (+), damage (+damaged), expire (+expired),
 * inspect_return (approve return quarantine -> sellable OR damaged)
 */
const adjustBranchInventoryBucket = async ({ actor, branchId, payload }) => {
  const { branch } = await branchService.assertBranchAccess({
    actor,
    branchId,
    requiredPermission: "manage_inventory",
  });

  const productId = Number(payload.product_id);
  const qty = Number(payload.quantity || 0);
  const adjustmentType = String(payload.adjustment_type || "").trim().toLowerCase();

  if (!isPositiveInteger(productId) || Number.isNaN(qty) || qty <= 0) {
    throw createServiceError("product_id and positive quantity are required", 400);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const bi = await inventoryModel.findBranchInventoryForUpdate(client, branch.id, productId);
    if (!bi) throw createServiceError("Branch inventory record not found", 404);

    if (adjustmentType === "add_stock") {
      bi.on_hand_quantity = Number(bi.on_hand_quantity) + qty;
    } else if (adjustmentType === "mark_damaged") {
      if (Number(bi.available_quantity) < qty) throw createServiceError("Insufficient available stock to mark damaged", 409);
      bi.damaged_quantity = Number(bi.damaged_quantity) + qty;
    } else if (adjustmentType === "mark_expired") {
      if (Number(bi.available_quantity) < qty) throw createServiceError("Insufficient available stock to mark expired", 409);
      bi.expired_quantity = Number(bi.expired_quantity) + qty;
    } else if (adjustmentType === "approve_return_restock") {
      if (Number(bi.returned_quantity) < qty) throw createServiceError("Returned quarantine quantity is smaller than requested restock", 409);
      bi.returned_quantity = Number(bi.returned_quantity) - qty;
      bi.on_hand_quantity = Number(bi.on_hand_quantity) + qty;
    } else if (adjustmentType === "discard_returned_damaged") {
      if (Number(bi.returned_quantity) < qty) throw createServiceError("Returned quarantine quantity is smaller than requested discard", 409);
      bi.returned_quantity = Number(bi.returned_quantity) - qty;
      bi.damaged_quantity = Number(bi.damaged_quantity) + qty;
    } else {
      throw createServiceError("Unsupported adjustment_type", 400);
    }

    const updated = await inventoryModel.recomputeAndSaveBranchAvailability(client, bi);
    await inventoryModel.recordInventoryMovement(client, {
      branch_id: branch.id,
      product_id: productId,
      movement_type: adjustmentType,
      quantity_delta: adjustmentType === "add_stock" || adjustmentType === "approve_return_restock" ? qty : -qty,
      bucket: adjustmentType,
      reason: payload.reason || adjustmentType,
      actor_id: actor.id,
    });

    await client.query("COMMIT");
    return updated;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

// ============================================================
// Controlled Inter-Branch Inventory Transfers (Full 8-Stage Lifecycle)
// ============================================================

const createInventoryTransfer = async ({ actor, payload }) => {
  const sourceBranchId = Number(payload.source_branch_id);
  const destBranchId = Number(payload.destination_branch_id);
  const items = Array.isArray(payload.items) ? payload.items : [];

  if (!isPositiveInteger(sourceBranchId) || !isPositiveInteger(destBranchId) || sourceBranchId === destBranchId) {
    throw createServiceError("Different valid source_branch_id and destination_branch_id are required", 400);
  }
  if (items.length === 0) {
    throw createServiceError("Transfer must contain at least one product item", 400);
  }

  const { branch: srcBranch } = await branchService.assertBranchAccess({
    actor,
    branchId: sourceBranchId,
    requiredPermission: "manage_transfers",
  });
  const dstBranch = await branchModel.getBranchById(destBranchId);
  if (!dstBranch) throw createServiceError("Destination branch not found", 404);
  if (Number(srcBranch.farmer_id) !== Number(dstBranch.farmer_id)) {
    throw createServiceError("Transfers can only move stock between branches of the same farmer business", 403);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const transferNumber = `TRF-${srcBranch.farmer_id}-${Date.now().toString().slice(-6)}-${Math.floor(10 + Math.random() * 89)}`;

    const tRes = await client.query(
      `INSERT INTO inventory_transfers (
         transfer_number, farmer_id, source_branch_id, destination_branch_id,
         status, requested_by, notes
       ) VALUES ($1,$2,$3,$4,'requested',$5,$6)
       RETURNING *`,
      [transferNumber, srcBranch.farmer_id, sourceBranchId, destBranchId, actor.id, payload.notes || null]
    );
    const transfer = tRes.rows[0];

    for (const item of items) {
      const qty = Number(item.quantity || item.requested_quantity || 0);
      if (!isPositiveInteger(item.product_id) || qty <= 0) {
        throw createServiceError("Each transfer item needs a valid product_id and positive quantity", 400);
      }
      await client.query(
        `INSERT INTO inventory_transfer_items (transfer_id, product_id, batch_id, requested_quantity)
         VALUES ($1,$2,$3,$4)`,
        [transfer.id, Number(item.product_id), item.batch_id || null, qty]
      );
    }

    await client.query("COMMIT");
    return inventoryModel.getTransferById(transfer.id);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Transitions transfer through controlled lifecycle:
 * requested -> approved -> stock_reserved -> dispatched -> in_transit -> received -> verified -> completed
 * Also handles rejected, cancelled, delayed, partially_received, and prevents duplicate confirmation.
 */
const transitionInventoryTransfer = async ({ actor, transferId, action, payload = {} }) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const tLockRes = await client.query(`SELECT * FROM inventory_transfers WHERE id = $1 FOR UPDATE`, [Number(transferId)]);
    if (tLockRes.rows.length === 0) throw createServiceError("Transfer not found", 404);
    const transfer = tLockRes.rows[0];

    const itemsRes = await client.query(
      `SELECT * FROM inventory_transfer_items WHERE transfer_id = $1 ORDER BY id ASC FOR UPDATE`,
      [transfer.id]
    );
    const items = itemsRes.rows;

    const normAction = String(action || "").trim().toLowerCase();

    // Prevent duplicate confirmation!
    if (transfer.status === "completed") {
      throw createServiceError("Transfer is already completed; duplicate confirmation blocked", 409);
    }

    if (normAction === "approve") {
      if (transfer.status !== "requested") throw createServiceError(`Cannot approve transfer in status ${transfer.status}`, 409);
      await branchService.assertBranchAccess({ actor, branchId: transfer.source_branch_id, requiredPermission: "manage_transfers" });

      // Approve and immediately reserve stock at source atomically
      for (const item of items) {
        const bi = await inventoryModel.findBranchInventoryForUpdate(client, transfer.source_branch_id, item.product_id);
        if (!bi || Number(bi.available_quantity) < Number(item.requested_quantity)) {
          throw createServiceError(`Insufficient available stock at source branch for product #${item.product_id}`, 409);
        }
        bi.reserved_quantity = Number(bi.reserved_quantity) + Number(item.requested_quantity);
        await inventoryModel.recomputeAndSaveBranchAvailability(client, bi);
        await inventoryModel.recordInventoryMovement(client, {
          branch_id: transfer.source_branch_id,
          product_id: item.product_id,
          movement_type: "transfer_reserve",
          quantity_delta: -Number(item.requested_quantity),
          bucket: "reserved",
          reference_type: "transfer",
          reference_id: transfer.id,
          reason: `Reserved for transfer ${transfer.transfer_number}`,
          actor_id: actor.id,
        });
      }

      await client.query(
        `UPDATE inventory_transfers SET status = 'stock_reserved', approved_by = $1, approved_at = NOW(), updated_at = NOW() WHERE id = $2`,
        [actor.id, transfer.id]
      );
    } else if (normAction === "dispatch") {
      if (!["stock_reserved", "approved"].includes(transfer.status)) {
        throw createServiceError(`Cannot dispatch transfer in status ${transfer.status}`, 409);
      }
      await branchService.assertBranchAccess({ actor, branchId: transfer.source_branch_id, requiredPermission: "manage_transfers" });

      for (const item of items) {
        const biSrc = await inventoryModel.findBranchInventoryForUpdate(client, transfer.source_branch_id, item.product_id);
        const dispatchQty = Number(item.requested_quantity);
        if (!biSrc || Number(biSrc.reserved_quantity) < dispatchQty) {
          throw createServiceError(`Source reservation missing for product #${item.product_id}`, 409);
        }
        biSrc.reserved_quantity = Math.max(0, Number(biSrc.reserved_quantity) - dispatchQty);
        biSrc.in_transit_out_quantity = Number(biSrc.in_transit_out_quantity) + dispatchQty;
        await inventoryModel.recomputeAndSaveBranchAvailability(client, biSrc);

        // Record in_transit_in at destination WITHOUT making it available_quantity yet!
        let biDst = await inventoryModel.findBranchInventoryForUpdate(client, transfer.destination_branch_id, item.product_id);
        if (!biDst) {
          biDst = await inventoryModel.upsertBranchInventory(client, {
            branch_id: transfer.destination_branch_id,
            product_id: item.product_id,
            farmer_id: transfer.farmer_id,
            on_hand_quantity: 0,
            is_available: true,
          });
          biDst = await inventoryModel.findBranchInventoryForUpdate(client, transfer.destination_branch_id, item.product_id);
        }
        biDst.in_transit_in_quantity = Number(biDst.in_transit_in_quantity) + dispatchQty;
        await inventoryModel.recomputeAndSaveBranchAvailability(client, biDst);

        await client.query(
          `UPDATE inventory_transfer_items SET dispatched_quantity = $1 WHERE id = $2`,
          [dispatchQty, item.id]
        );
        await inventoryModel.recordInventoryMovement(client, {
          branch_id: transfer.source_branch_id,
          product_id: item.product_id,
          movement_type: "transfer_dispatched",
          quantity_delta: 0,
          bucket: "in_transit_out",
          reference_type: "transfer",
          reference_id: transfer.id,
          reason: `Dispatched ${dispatchQty} to branch #${transfer.destination_branch_id}`,
          actor_id: actor.id,
        });
      }

      await client.query(
        `UPDATE inventory_transfers SET status = 'in_transit', dispatched_by = $1, dispatched_at = NOW(), updated_at = NOW() WHERE id = $2`,
        [actor.id, transfer.id]
      );
    } else if (normAction === "delay") {
      if (transfer.status !== "in_transit") throw createServiceError("Only in_transit transfers can be flagged delayed", 409);
      await client.query(
        `UPDATE inventory_transfers SET status = 'delayed', delay_reason = $1, updated_at = NOW() WHERE id = $2`,
        [payload.delay_reason || "Transit delay reported", transfer.id]
      );
    } else if (normAction === "receive_and_verify") {
      if (!["in_transit", "delayed", "received", "partially_received"].includes(transfer.status)) {
        throw createServiceError(`Cannot receive transfer in status ${transfer.status}`, 409);
      }
      await branchService.assertBranchAccess({ actor, branchId: transfer.destination_branch_id, requiredPermission: "manage_transfers" });

      const itemReports = Array.isArray(payload.items) ? payload.items : [];
      let allGood = true;

      for (const item of items) {
        const report = itemReports.find((r) => Number(r.product_id) === Number(item.product_id)) || {};
        const dispatched = Number(item.dispatched_quantity || item.requested_quantity);
        const receivedGood = report.verified_quantity !== undefined
          ? Number(report.verified_quantity)
          : report.received_quantity !== undefined
          ? Number(report.received_quantity)
          : dispatched;
        const damaged = Number(report.damaged_quantity || 0);
        const missing = report.missing_quantity !== undefined
          ? Number(report.missing_quantity)
          : Math.max(0, dispatched - receivedGood - damaged);

        if (receivedGood < 0 || damaged < 0 || missing < 0 || receivedGood + damaged + missing > dispatched + 0.001) {
          throw createServiceError(`Invalid received/damaged/missing quantities for product #${item.product_id}`, 400);
        }
        if (damaged > 0 || missing > 0 || receivedGood < dispatched) allGood = false;

        // Release source on_hand + in_transit_out
        const biSrc = await inventoryModel.findBranchInventoryForUpdate(client, transfer.source_branch_id, item.product_id);
        if (biSrc) {
          biSrc.in_transit_out_quantity = Math.max(0, Number(biSrc.in_transit_out_quantity) - dispatched);
          biSrc.on_hand_quantity = Math.max(0, Number(biSrc.on_hand_quantity) - dispatched);
          await inventoryModel.recomputeAndSaveBranchAvailability(client, biSrc);
        }

        // Credit destination: ONLY verified good qty enters available_quantity; damaged goes to damaged_quantity!
        const biDst = await inventoryModel.findBranchInventoryForUpdate(client, transfer.destination_branch_id, item.product_id);
        if (biDst) {
          biDst.in_transit_in_quantity = Math.max(0, Number(biDst.in_transit_in_quantity) - dispatched);
          biDst.on_hand_quantity = Number(biDst.on_hand_quantity) + receivedGood + damaged;
          biDst.damaged_quantity = Number(biDst.damaged_quantity) + damaged;
          await inventoryModel.recomputeAndSaveBranchAvailability(client, biDst);
        }

        await client.query(
          `UPDATE inventory_transfer_items
           SET received_quantity = $1, damaged_quantity = $2, missing_quantity = $3, verified_quantity = $4
           WHERE id = $5`,
          [receivedGood + damaged, damaged, missing, receivedGood, item.id]
        );

        await inventoryModel.recordInventoryMovement(client, {
          branch_id: transfer.destination_branch_id,
          product_id: item.product_id,
          movement_type: "transfer_received_verified",
          quantity_delta: receivedGood,
          bucket: "available",
          reference_type: "transfer",
          reference_id: transfer.id,
          reason: `Transfer ${transfer.transfer_number} verified: good=${receivedGood}, damaged=${damaged}, missing=${missing}`,
          actor_id: actor.id,
        });
      }

      await client.query(
        `UPDATE inventory_transfers
         SET status = 'completed',
             received_by = $1,
             verified_by = $1,
             received_at = NOW(),
             verified_at = NOW(),
             completed_at = NOW(),
             discrepancy_notes = $2,
             updated_at = NOW()
         WHERE id = $3`,
        [actor.id, allGood ? null : (payload.discrepancy_notes || "Partial/damaged/missing quantities reconciled"), transfer.id]
      );
    } else if (["reject", "cancel"].includes(normAction)) {
      if (["in_transit", "delayed", "completed"].includes(transfer.status)) {
        throw createServiceError(`Cannot ${normAction} transfer already ${transfer.status}`, 409);
      }
      if (transfer.status === "stock_reserved") {
        for (const item of items) {
          const biSrc = await inventoryModel.findBranchInventoryForUpdate(client, transfer.source_branch_id, item.product_id);
          if (biSrc) {
            biSrc.reserved_quantity = Math.max(0, Number(biSrc.reserved_quantity) - Number(item.requested_quantity));
            await inventoryModel.recomputeAndSaveBranchAvailability(client, biSrc);
          }
        }
      }
      const nextStatus = normAction === "reject" ? "rejected" : "cancelled";
      await client.query(
        `UPDATE inventory_transfers SET status = $1, discrepancy_notes = $2, updated_at = NOW() WHERE id = $3`,
        [nextStatus, payload.reason || `Transfer ${nextStatus}`, transfer.id]
      );
    } else {
      throw createServiceError("Unsupported transfer action", 400);
    }

    await client.query("COMMIT");
    return inventoryModel.getTransferById(transfer.id);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const listFarmerTransfers = async (actor) => {
  const transfers = await inventoryModel.listTransfersForFarmer(Number(actor.id));
  return { transfers };
};

const getBranchMovements = async ({ actor, branchId, productId = null }) => {
  await branchService.assertBranchAccess({ actor, branchId, requiredPermission: null });
  const movements = await inventoryModel.listInventoryMovements({ branchId: Number(branchId), productId });
  return { movements };
};

// Legacy order reservation passthroughs
const reserveStockForOrder = async (client, orderId, items) => {
  for (const item of items) {
    const inv = await inventoryModel.findInventoryForUpdate(client, item.product_id);
    if (!inv || Number(inv.quantity) < Number(item.quantity)) {
      const available = inv ? inv.quantity : 0;
      throw createServiceError(`Insufficient stock for product: ${item.name} (requested: ${item.quantity}, available: ${available})`, 409);
    }
    await inventoryModel.decrementInventoryStock(client, item.product_id, item.quantity);
    await inventoryModel.createStockReservation(client, { orderId, productId: item.product_id, quantity: item.quantity, ttlMinutes: 15 });
  }
};

const confirmReservation = async (orderId, client = pool) => {
  const rows = await inventoryModel.confirmReservations(client, orderId);
  return rows.length;
};

const releaseReservationsForOrder = async (orderId, client = pool) => {
  return inventoryModel.releaseReservationsByOrderId(client, orderId);
};

const releaseExpiredReservations = async (client = pool) => {
  return inventoryModel.releaseExpiredReservations(client);
};

module.exports = {
  adjustBranchInventoryBucket,
  confirmReservation,
  createInventoryTransfer,
  getBranchInventory,
  getBranchMovements,
  getInventoryByProductId,
  listFarmerTransfers,
  releaseExpiredReservations,
  releaseReservationsForOrder,
  reserveStockForOrder,
  transitionInventoryTransfer,
  updateInventory,
  upsertBranchProductStock,
};
