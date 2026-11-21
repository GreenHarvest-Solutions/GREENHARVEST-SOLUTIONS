const { pool } = require("../config/db");
const auditService = require("../services/auditService");

/**
 * Fetch paginated disputes with category filtering and summary statistics
 */
const getDisputesAdmin = async ({
  status = null,
  category = null,
  search = null,
  page = 1,
  limit = 20,
}) => {
  const conditions = [];
  const params = [];

  if (status && status !== "all") {
    params.push(status);
    conditions.push(`r.status = $${params.length}`);
  }

  if (category && category !== "all") {
    params.push(category);
    conditions.push(`r.dispute_category = $${params.length}`);
  }

  if (search && search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`);
    const sIndex = params.length;
    conditions.push(`(
      CAST(r.id AS TEXT) LIKE $${sIndex} OR
      CAST(r.order_id AS TEXT) LIKE $${sIndex} OR
      LOWER(r.reason) LIKE $${sIndex} OR
      LOWER(buyer.name) LIKE $${sIndex} OR
      LOWER(farmer.name) LIKE $${sIndex} OR
      LOWER(COALESCE(r.tracking_number, '')) LIKE $${sIndex}
    )`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  // Summary Metrics
  const metricsRes = await pool.query(`
    SELECT
      COUNT(*)::int AS total_disputes,
      COUNT(*) FILTER (WHERE status = 'pending' OR status = 'open')::int AS open_count,
      COUNT(*) FILTER (WHERE status = 'accepted')::int AS accepted_count,
      COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected_count,
      COUNT(*) FILTER (WHERE dispute_category = 'transit_spoilage')::int AS transit_spoilage_count,
      COUNT(*) FILTER (WHERE dispute_category = 'weight_shortage')::int AS weight_shortage_count,
      COUNT(*) FILTER (WHERE dispute_category = 'grade_mismatch')::int AS grade_mismatch_count,
      COUNT(*) FILTER (WHERE dispute_category = 'non_delivery')::int AS non_delivery_count
    FROM returns
  `);

  // Count total
  const countRes = await pool.query(
    `
      SELECT COUNT(*)::int AS total
      FROM returns r
      LEFT JOIN users buyer ON buyer.id = r.buyer_id
      LEFT JOIN users farmer ON farmer.id = r.farmer_id
      ${whereClause}
    `,
    params
  );
  const total = countRes.rows[0]?.total || 0;

  const offset = (Number(page) - 1) * Number(limit);
  const queryParams = [...params, Number(limit), offset];

  const dataRes = await pool.query(
    `
      SELECT
        r.id,
        r.order_id,
        r.farmer_id,
        r.buyer_id,
        r.reason,
        r.status,
        r.refund_status,
        COALESCE(r.dispute_category, 'other') AS dispute_category,
        COALESCE(jsonb_array_length(r.evidence_image_urls), 0)::int AS evidence_count,
        r.weighbridge_slip_url IS NOT NULL AS has_weighbridge_slip,
        r.settlement_split,
        r.tracking_number,
        r.carrier_name,
        r.restock_quantity,
        r.created_at,
        r.updated_at,
        buyer.name AS buyer_name,
        buyer.email AS buyer_email,
        buyer.phone AS buyer_phone,
        farmer.name AS farmer_name,
        farmer.phone AS farmer_phone,
        o.total_price::numeric(12,2) AS order_total,
        esc.escrow_amount::numeric(12,2) AS escrow_amount,
        esc.release_status AS escrow_status
      FROM returns r
      JOIN orders o ON o.id = r.order_id
      LEFT JOIN users buyer ON buyer.id = r.buyer_id
      LEFT JOIN users farmer ON farmer.id = r.farmer_id
      LEFT JOIN escrow_ledger esc ON esc.order_id = r.order_id
      ${whereClause}
      ORDER BY
        (r.status = 'pending' OR r.status = 'open') DESC,
        r.created_at DESC
      LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
    `,
    queryParams
  );

  return {
    disputes: dataRes.rows,
    metrics: metricsRes.rows[0] || {},
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      total_pages: Math.ceil(total / Number(limit)) || 1,
    },
  };
};

/**
 * Fetch full Dispute Dossier with photo gallery, weighbridge slips, order items, and audit trail
 */
const getDisputeDossier = async (disputeId) => {
  const disputeRes = await pool.query(
    `
      SELECT
        r.id,
        r.order_id,
        r.farmer_id,
        r.buyer_id,
        r.reason,
        r.status,
        r.refund_status,
        COALESCE(r.dispute_category, 'other') AS dispute_category,
        COALESCE(r.evidence_image_urls, '[]'::jsonb) AS evidence_image_urls,
        r.weighbridge_slip_url,
        r.settlement_split,
        r.arbitration_notes,
        r.settled_at,
        r.tracking_number,
        r.carrier_name,
        r.restock_quantity,
        r.created_at,
        r.updated_at,
        buyer.name AS buyer_name,
        buyer.email AS buyer_email,
        buyer.phone AS buyer_phone,
        farmer.name AS farmer_name,
        farmer.email AS farmer_email,
        farmer.phone AS farmer_phone,
        settler.name AS settled_by_name
      FROM returns r
      LEFT JOIN users buyer ON buyer.id = r.buyer_id
      LEFT JOIN users farmer ON farmer.id = r.farmer_id
      LEFT JOIN users settler ON settler.id = r.settled_by
      WHERE r.id = $1
    `,
    [disputeId]
  );

  if (disputeRes.rows.length === 0) {
    return null;
  }

  const dispute = disputeRes.rows[0];

  // Associated Order
  const orderRes = await pool.query(
    `
      SELECT
        o.id,
        o.total_price::numeric(12,2) AS total_price,
        o.order_status,
        o.payment_status,
        o.delivery_status,
        COALESCE(o.refund_amount, 0)::numeric(12,2) AS refund_amount,
        o.created_at
      FROM orders o
      WHERE o.id = $1
    `,
    [dispute.order_id]
  );

  // Order Items
  const itemsRes = await pool.query(
    `
      SELECT
        oi.id,
        oi.product_id,
        oi.quantity,
        oi.price::numeric(12,2) AS unit_price,
        (oi.quantity * oi.price)::numeric(12,2) AS line_total,
        p.name AS product_name,
        COALESCE(p.image_url, pi.image_url) AS image_url,
        p.grade,
        p.farm_location
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      LEFT JOIN LATERAL (
        SELECT image_url FROM product_images
        WHERE product_id = p.id
        ORDER BY image_id ASC LIMIT 1
      ) pi ON TRUE
      WHERE oi.order_id = $1
    `,
    [dispute.order_id]
  );

  // Escrow status
  const escrowRes = await pool.query(
    `
      SELECT
        e.id,
        e.escrow_amount::numeric(12,2) AS escrow_amount,
        e.platform_fee_amount::numeric(12,2) AS platform_fee_amount,
        e.farmer_payout_amount::numeric(12,2) AS farmer_payout_amount,
        e.buyer_refund_amount::numeric(12,2) AS buyer_refund_amount,
        e.release_status,
        e.hold_until
      FROM escrow_ledger e
      WHERE e.order_id = $1
      LIMIT 1
    `,
    [dispute.order_id]
  );

  // Audit history
  const auditRes = await pool.query(
    `
      SELECT
        a.id,
        a.action,
        a.reason,
        a.before_state,
        a.after_state,
        a.created_at,
        u.name AS actor_name
      FROM audit_logs a
      LEFT JOIN users u ON u.id = a.actor_id
      WHERE (a.entity_type = 'dispute' AND a.entity_id = $1)
         OR (a.entity_type = 'order' AND a.entity_id = $2)
      ORDER BY a.created_at DESC
      LIMIT 50
    `,
    [String(disputeId), String(dispute.order_id)]
  );

  return {
    ...dispute,
    order: orderRes.rows[0] || null,
    items: itemsRes.rows,
    escrow: escrowRes.rows[0] || null,
    audit_trail: auditRes.rows,
  };
};

/**
 * Split escrow settlement calculator execution:
 * Enforces: buyer_refund + farmer_payout + platform_fee == escrow_amount (ledger balance integrity)
 */
const settleDisputeSplit = async (
  disputeId,
  { buyer_refund, farmer_payout, platform_fee, admin_notes },
  actorId,
  ipAddress = null,
  userAgent = null
) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const disputeRes = await client.query("SELECT * FROM returns WHERE id = $1 FOR UPDATE", [disputeId]);
    if (disputeRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return { success: false, error: "Dispute record not found" };
    }

    const dispute = disputeRes.rows[0];

    const escrowRes = await client.query("SELECT * FROM escrow_ledger WHERE order_id = $1 FOR UPDATE", [dispute.order_id]);
    if (escrowRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return { success: false, error: "Associated escrow record not found for this dispute" };
    }

    const escrow = escrowRes.rows[0];
    const totalEscrow = Number(escrow.escrow_amount);
    const bRefund = Number(buyer_refund || 0);
    const fPayout = Number(farmer_payout || 0);
    const pFee = Number(platform_fee !== undefined ? platform_fee : escrow.platform_fee_amount || 0);

    // Balance integrity validation: diff <= 0.05 (allowing rounding cents)
    const sum = bRefund + fPayout + pFee;
    const diff = Math.abs(sum - totalEscrow);
    if (diff > 0.05) {
      await client.query("ROLLBACK");
      return {
        success: false,
        error: `Ledger integrity breach: Buyer refund (${bRefund.toFixed(2)}) + Farmer payout (${fPayout.toFixed(2)}) + Platform fee (${pFee.toFixed(2)}) = ${sum.toFixed(2)}, which does not match total escrow balance ${totalEscrow.toFixed(2)}`,
      };
    }

    const splitData = {
      buyer_refund: bRefund,
      farmer_payout: fPayout,
      platform_fee: pFee,
      admin_notes: admin_notes || "Split settlement agreed by platform arbitration",
    };

    // 1. Update Return
    const updateReturnRes = await client.query(
      `
        UPDATE returns
        SET status = 'accepted',
            refund_status = CASE WHEN $1 > 0 THEN 'issued' ELSE 'none' END,
            settlement_split = $2,
            settled_by = $3,
            settled_at = NOW(),
            arbitration_notes = $4,
            updated_at = NOW()
        WHERE id = $5
        RETURNING *
      `,
      [bRefund, JSON.stringify(splitData), actorId, admin_notes, disputeId]
    );

    // 2. Update Escrow Ledger
    await client.query(
      `
        UPDATE escrow_ledger
        SET buyer_refund_amount = $1,
            farmer_payout_amount = $2,
            platform_fee_amount = $3,
            release_status = 'split_settled',
            released_at = NOW(),
            released_by = $4,
            notes = COALESCE(notes, '') || ' | Split settlement: ' || $5,
            updated_at = NOW()
        WHERE id = $6
      `,
      [bRefund, fPayout, pFee, actorId, admin_notes || "Arbitrated split settlement", escrow.id]
    );

    // 3. Update Order refund amount & status if buyer receives refund
    if (bRefund > 0) {
      const isFullRefund = bRefund >= totalEscrow;
      await client.query(
        `
          UPDATE orders
          SET refund_amount = $1,
              refund_reason = $2,
              refunded_at = NOW(),
              refunded_by = $3,
              order_status = CASE WHEN $4::boolean = TRUE THEN 'refunded' ELSE order_status END
          WHERE id = $5
        `,
        [bRefund, admin_notes || "Dispute split refund", actorId, isFullRefund, dispute.order_id]
      );
    }

    // 4. Audit Log
    await auditService.record({
      actorId,
      action: "dispute.arbitrate.split_settlement",
      entityType: "dispute",
      entityId: disputeId,
      beforeState: {
        status: dispute.status,
        refund_status: dispute.refund_status,
      },
      afterState: {
        status: "accepted",
        settlement_split: splitData,
      },
      reason: admin_notes,
      ipAddress,
      userAgent,
      client,
    });

    await client.query("COMMIT");
    return { success: true, dispute: updateReturnRes.rows[0], settlement: splitData };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Fetch return shipments tracking list
 */
const getReturnsAdmin = async ({
  status = null,
  search = null,
  page = 1,
  limit = 20,
}) => {
  const conditions = [];
  const params = [];

  if (status && status !== "all") {
    params.push(status);
    conditions.push(`r.status = $${params.length}`);
  }

  if (search && search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`);
    const sIndex = params.length;
    conditions.push(`(
      CAST(r.id AS TEXT) LIKE $${sIndex} OR
      CAST(r.order_id AS TEXT) LIKE $${sIndex} OR
      LOWER(COALESCE(r.tracking_number, '')) LIKE $${sIndex} OR
      LOWER(buyer.name) LIKE $${sIndex} OR
      LOWER(farmer.name) LIKE $${sIndex}
    )`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const countRes = await pool.query(
    `
      SELECT COUNT(*)::int AS total
      FROM returns r
      LEFT JOIN users buyer ON buyer.id = r.buyer_id
      LEFT JOIN users farmer ON farmer.id = r.farmer_id
      ${whereClause}
    `,
    params
  );
  const total = countRes.rows[0]?.total || 0;

  const offset = (Number(page) - 1) * Number(limit);
  const queryParams = [...params, Number(limit), offset];

  const dataRes = await pool.query(
    `
      SELECT
        r.id,
        r.order_id,
        r.farmer_id,
        r.buyer_id,
        r.reason,
        r.status,
        r.refund_status,
        COALESCE(r.dispute_category, 'other') AS dispute_category,
        COALESCE(r.tracking_number, 'GH-RET-' || LPAD(r.id::text, 4, '0')) AS tracking_number,
        COALESCE(r.carrier_name, 'Ethio Post Agro-Logistics') AS carrier_name,
        r.restock_quantity,
        r.return_received_at,
        r.created_at,
        r.updated_at,
        buyer.name AS buyer_name,
        buyer.phone AS buyer_phone,
        farmer.name AS farmer_name,
        farmer.phone AS farmer_phone,
        o.total_price::numeric(12,2) AS order_total
      FROM returns r
      JOIN orders o ON o.id = r.order_id
      LEFT JOIN users buyer ON buyer.id = r.buyer_id
      LEFT JOIN users farmer ON farmer.id = r.farmer_id
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
    `,
    queryParams
  );

  return {
    returns: dataRes.rows,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      total_pages: Math.ceil(total / Number(limit)) || 1,
    },
  };
};

/**
 * Update return physical receipt, restock quantity, and status
 */
const updateReturnStatus = async (
  returnId,
  { status, restock_quantity = null, notes = null },
  actorId,
  ipAddress = null,
  userAgent = null
) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const returnRes = await client.query("SELECT * FROM returns WHERE id = $1 FOR UPDATE", [returnId]);
    if (returnRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    const beforeState = returnRes.rows[0];

    const updateRes = await client.query(
      `
        UPDATE returns
        SET status = $1::varchar,
            restock_quantity = COALESCE($2::int, restock_quantity),
            return_received_at = CASE WHEN $1::varchar = 'received' OR $1::varchar = 'restocked' THEN NOW() ELSE return_received_at END,
            arbitration_notes = CASE WHEN $3::text IS NOT NULL THEN COALESCE(arbitration_notes, '') || ' | ' || $3::text ELSE arbitration_notes END,
            updated_at = NOW()
        WHERE id = $4
        RETURNING *
      `,
      [status, restock_quantity, notes, returnId]
    );

    const afterState = updateRes.rows[0];

    await auditService.record({
      actorId,
      action: `return.status_update.${status}`,
      entityType: "return",
      entityId: returnId,
      beforeState,
      afterState,
      reason: notes || `Return status updated to ${status}`,
      ipAddress,
      userAgent,
      client,
    });

    await client.query("COMMIT");
    return afterState;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  getDisputesAdmin,
  getDisputeDossier,
  settleDisputeSplit,
  getReturnsAdmin,
  updateReturnStatus,
};
