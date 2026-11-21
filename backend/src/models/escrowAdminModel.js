const { pool } = require("../config/db");
const auditService = require("../services/auditService");

/**
 * Fetch active escrow ledger records with real-time countdowns and metrics
 */
const getActiveEscrowLedger = async ({
  release_status = null,
  search = null,
  page = 1,
  limit = 20,
}) => {
  const conditions = [];
  const params = [];

  if (release_status && release_status !== "all") {
    params.push(release_status);
    conditions.push(`e.release_status = $${params.length}`);
  }

  if (search && search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`);
    const sIndex = params.length;
    conditions.push(`(
      CAST(e.id AS TEXT) LIKE $${sIndex} OR
      CAST(e.order_id AS TEXT) LIKE $${sIndex} OR
      LOWER(buyer.name) LIKE $${sIndex} OR
      LOWER(farmer.name) LIKE $${sIndex} OR
      LOWER(COALESCE(farmer.phone, '')) LIKE $${sIndex}
    )`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  // Summary Metrics
  const metricsRes = await pool.query(`
    SELECT
      COUNT(*)::int AS total_records,
      COUNT(*) FILTER (WHERE release_status = 'held')::int AS held_count,
      COUNT(*) FILTER (WHERE release_status = 'cleared')::int AS cleared_count,
      COUNT(*) FILTER (WHERE release_status = 'disputed')::int AS disputed_count,
      COUNT(*) FILTER (WHERE release_status = 'refunded' OR release_status = 'split_settled')::int AS refunded_count,
      COALESCE(SUM(escrow_amount) FILTER (WHERE release_status = 'held'), 0)::numeric(12,2) AS total_held_amount,
      COALESCE(SUM(farmer_payout_amount) FILTER (WHERE release_status = 'cleared'), 0)::numeric(12,2) AS total_cleared_payout,
      COALESCE(SUM(platform_fee_amount), 0)::numeric(12,2) AS total_platform_fees
    FROM escrow_ledger
  `);

  // Count total
  const countRes = await pool.query(
    `
      SELECT COUNT(*)::int AS total
      FROM escrow_ledger e
      LEFT JOIN users buyer ON buyer.id = e.buyer_id
      LEFT JOIN users farmer ON farmer.id = e.farmer_id
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
        e.id,
        e.order_id,
        e.buyer_id,
        e.farmer_id,
        e.escrow_amount::numeric(12,2) AS escrow_amount,
        e.platform_fee_amount::numeric(12,2) AS platform_fee_amount,
        e.farmer_payout_amount::numeric(12,2) AS farmer_payout_amount,
        e.buyer_refund_amount::numeric(12,2) AS buyer_refund_amount,
        e.hold_until,
        e.release_status,
        e.released_at,
        e.notes,
        e.created_at,
        buyer.name AS buyer_name,
        buyer.email AS buyer_email,
        farmer.name AS farmer_name,
        farmer.phone AS farmer_phone,
        releaser.name AS released_by_name,
        approver.name AS approved_by_name,
        o.order_status,
        o.delivery_status
      FROM escrow_ledger e
      JOIN orders o ON o.id = e.order_id
      LEFT JOIN users buyer ON buyer.id = e.buyer_id
      LEFT JOIN users farmer ON farmer.id = e.farmer_id
      LEFT JOIN users releaser ON releaser.id = e.released_by
      LEFT JOIN users approver ON approver.id = e.maker_checker_approved_by
      ${whereClause}
      ORDER BY
        CASE WHEN e.release_status = 'disputed' THEN 1
             WHEN e.release_status = 'held' THEN 2
             ELSE 3 END,
        e.hold_until ASC NULLS LAST,
        e.created_at DESC
      LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
    `,
    queryParams
  );

  return {
    ledger: dataRes.rows,
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
 * Release escrow funds to farmer with ledger adjustment and optional maker-checker signoff
 */
const releaseEscrow = async (
  escrowId,
  { notes = null, makerCheckerApproved = false },
  actorId,
  ipAddress = null,
  userAgent = null
) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const checkRes = await client.query("SELECT * FROM escrow_ledger WHERE id = $1 FOR UPDATE", [escrowId]);
    if (checkRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return { success: false, error: "Escrow record not found" };
    }

    const beforeState = checkRes.rows[0];

    if (beforeState.release_status === "cleared") {
      await client.query("ROLLBACK");
      return { success: false, error: "Escrow funds have already been cleared and released" };
    }

    // Ledger balance integrity check:
    // escrow_amount must equal buyer_refund + farmer_payout + platform_fee
    const escrowAmt = Number(beforeState.escrow_amount);
    const feeAmt = Number(beforeState.platform_fee_amount);
    const refundAmt = Number(beforeState.buyer_refund_amount || 0);
    const targetPayout = Math.max(0, escrowAmt - feeAmt - refundAmt);

    const updateRes = await client.query(
      `
        UPDATE escrow_ledger
        SET release_status = 'cleared',
            farmer_payout_amount = $1,
            released_at = NOW(),
            released_by = $2,
            maker_checker_approved_by = CASE WHEN $3 = TRUE THEN $2 ELSE maker_checker_approved_by END,
            notes = CASE WHEN $4::text IS NOT NULL THEN COALESCE(notes, '') || ' | ' || $4::text ELSE notes END,
            updated_at = NOW()
        WHERE id = $5
        RETURNING *
      `,
      [targetPayout, actorId, makerCheckerApproved, notes, escrowId]
    );

    const afterState = updateRes.rows[0];

    await auditService.record({
      actorId,
      action: "escrow.release.cleared",
      entityType: "escrow",
      entityId: escrowId,
      beforeState,
      afterState,
      reason: notes || "Escrow hold cleared and farmer disbursement approved",
      ipAddress,
      userAgent,
      client,
    });

    await client.query("COMMIT");
    return { success: true, escrow: afterState };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Emergency hold / freeze on escrow release
 */
const holdEscrow = async (
  escrowId,
  { reason, holdDays = 14 },
  actorId,
  ipAddress = null,
  userAgent = null
) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const checkRes = await client.query("SELECT * FROM escrow_ledger WHERE id = $1 FOR UPDATE", [escrowId]);
    if (checkRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return { success: false, error: "Escrow record not found" };
    }

    const beforeState = checkRes.rows[0];

    if (beforeState.release_status === "cleared") {
      await client.query("ROLLBACK");
      return { success: false, error: "Cannot freeze already cleared funds" };
    }

    const updateRes = await client.query(
      `
        UPDATE escrow_ledger
        SET release_status = 'held',
            hold_until = NOW() + ($1 || ' days')::INTERVAL,
            notes = COALESCE(notes, '') || ' | Freeze hold: ' || $2,
            updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `,
      [holdDays, reason, escrowId]
    );

    const afterState = updateRes.rows[0];

    await auditService.record({
      actorId,
      action: "escrow.freeze.hold",
      entityType: "escrow",
      entityId: escrowId,
      beforeState,
      afterState,
      reason,
      ipAddress,
      userAgent,
      client,
    });

    await client.query("COMMIT");
    return { success: true, escrow: afterState };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  getActiveEscrowLedger,
  releaseEscrow,
  holdEscrow,
};
