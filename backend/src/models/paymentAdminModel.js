const { pool } = require("../config/db");
const auditService = require("../services/auditService");

/**
 * Fetch paginated payments and transaction ledger with gateway reconciliation metrics
 */
const getPaymentsAdmin = async ({
  status = null,
  method = null,
  from = null,
  to = null,
  search = null,
  page = 1,
  limit = 20,
}) => {
  const conditions = [];
  const params = [];

  if (status && status !== "all") {
    params.push(status);
    conditions.push(`p.payment_status = $${params.length}`);
  }

  if (method && method !== "all") {
    params.push(method);
    conditions.push(`p.payment_method = $${params.length}`);
  }

  if (from) {
    params.push(from);
    conditions.push(`p.created_at >= $${params.length}`);
  }

  if (to) {
    params.push(to);
    conditions.push(`p.created_at <= $${params.length}`);
  }

  if (search && search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`);
    const sIndex = params.length;
    conditions.push(`(
      CAST(p.id AS TEXT) LIKE $${sIndex} OR
      CAST(p.order_id AS TEXT) LIKE $${sIndex} OR
      LOWER(COALESCE(p.transaction_id, '')) LIKE $${sIndex} OR
      LOWER(COALESCE(p.reference_number, '')) LIKE $${sIndex} OR
      LOWER(buyer.name) LIKE $${sIndex} OR
      LOWER(COALESCE(buyer.phone, '')) LIKE $${sIndex}
    )`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  // Summary Metrics
  const metricsRes = await pool.query(`
    SELECT
      COUNT(*)::int AS total_payments,
      COUNT(*) FILTER (WHERE payment_status = 'paid')::int AS completed_count,
      COUNT(*) FILTER (WHERE payment_status = 'pending')::int AS pending_count,
      COUNT(*) FILTER (WHERE payment_status = 'refunded')::int AS refunded_count,
      COUNT(*) FILTER (WHERE reconciled_at IS NULL)::int AS unreconciled_count,
      COALESCE(SUM(amount) FILTER (WHERE payment_status = 'paid'), 0)::numeric(12,2) AS total_settled_volume,
      COALESCE(SUM(amount) FILTER (WHERE payment_method = 'telebirr' AND payment_status = 'paid'), 0)::numeric(12,2) AS telebirr_volume,
      COALESCE(SUM(amount) FILTER (WHERE payment_method = 'chapa' AND payment_status = 'paid'), 0)::numeric(12,2) AS chapa_volume,
      COALESCE(SUM(refund_amount), 0)::numeric(12,2) AS total_refunded_volume
    FROM payments
  `);

  const countRes = await pool.query(
    `
      SELECT COUNT(*)::int AS total
      FROM payments p
      LEFT JOIN orders o ON o.id = p.order_id
      LEFT JOIN users buyer ON buyer.id = o.buyer_id
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
        p.id,
        p.order_id,
        p.payment_method,
        p.amount::numeric(12,2) AS amount,
        p.payment_status,
        p.transaction_id,
        COALESCE(p.reference_number, 'ET-REF-' || LPAD(p.id::text, 6, '0')) AS reference_number,
        COALESCE(p.gateway_name, p.payment_method) AS gateway_name,
        p.reconciled_at,
        p.reconciled_by,
        COALESCE(p.refund_amount, 0)::numeric(12,2) AS refund_amount,
        COALESCE(p.refund_status, 'none') AS refund_status,
        p.created_at,
        buyer.name AS buyer_name,
        buyer.email AS buyer_email,
        buyer.phone AS buyer_phone,
        o.order_status,
        o.delivery_status,
        reconciler.name AS reconciler_name
      FROM payments p
      JOIN orders o ON o.id = p.order_id
      LEFT JOIN users buyer ON buyer.id = o.buyer_id
      LEFT JOIN users reconciler ON reconciler.id = p.reconciled_by
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
    `,
    queryParams
  );

  return {
    payments: dataRes.rows,
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
 * Fetch full payment transaction dossier
 */
const getPaymentDossier = async (paymentId) => {
  const payRes = await pool.query(
    `
      SELECT
        p.id,
        p.order_id,
        p.payment_method,
        p.amount::numeric(12,2) AS amount,
        p.payment_status,
        p.transaction_id,
        p.reference_number,
        p.gateway_name,
        p.gateway_response,
        p.reconciled_at,
        p.reconciled_by,
        COALESCE(p.refund_amount, 0)::numeric(12,2) AS refund_amount,
        p.refund_status,
        p.created_at,
        reconciler.name AS reconciler_name,
        o.order_status,
        o.total_price::numeric(12,2) AS order_total_price,
        buyer.id AS buyer_id,
        buyer.name AS buyer_name,
        buyer.email AS buyer_email,
        buyer.phone AS buyer_phone
      FROM payments p
      JOIN orders o ON o.id = p.order_id
      LEFT JOIN users buyer ON buyer.id = o.buyer_id
      LEFT JOIN users reconciler ON reconciler.id = p.reconciled_by
      WHERE p.id = $1
    `,
    [paymentId]
  );

  if (payRes.rows.length === 0) {
    return null;
  }

  const payment = payRes.rows[0];

  // Associated order items
  const itemsRes = await pool.query(
    `
      SELECT
        oi.id,
        oi.quantity,
        oi.price::numeric(12,2) AS price,
        (oi.quantity * oi.price)::numeric(12,2) AS total,
        p.name AS product_name
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = $1
    `,
    [payment.order_id]
  );

  // Escrow status
  const escrowRes = await pool.query(
    `
      SELECT
        id,
        escrow_amount::numeric(12,2) AS escrow_amount,
        platform_fee_amount::numeric(12,2) AS platform_fee_amount,
        farmer_payout_amount::numeric(12,2) AS farmer_payout_amount,
        buyer_refund_amount::numeric(12,2) AS buyer_refund_amount,
        release_status,
        released_at
      FROM escrow_ledger
      WHERE order_id = $1
      LIMIT 1
    `,
    [payment.order_id]
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
      WHERE (a.entity_type = 'payment' AND a.entity_id = $1)
         OR (a.entity_type = 'order' AND a.entity_id = $2)
      ORDER BY a.created_at DESC
      LIMIT 50
    `,
    [String(paymentId), String(payment.order_id)]
  );

  return {
    ...payment,
    items: itemsRes.rows,
    escrow: escrowRes.rows[0] || null,
    audit_trail: auditRes.rows,
  };
};

/**
 * Reconcile payment record
 */
const reconcilePayment = async (
  paymentId,
  { status = "reconciled", notes = null },
  actorId,
  ipAddress = null,
  userAgent = null
) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const checkRes = await client.query("SELECT * FROM payments WHERE id = $1 FOR UPDATE", [paymentId]);
    if (checkRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    const beforeState = checkRes.rows[0];

    const updateRes = await client.query(
      `
        UPDATE payments
        SET reconciled_at = NOW(),
            reconciled_by = $1,
            payment_status = CASE WHEN $2 = 'disputed' THEN 'failed' ELSE payment_status END
        WHERE id = $3
        RETURNING *
      `,
      [actorId, status, paymentId]
    );

    const afterState = updateRes.rows[0];

    await auditService.record({
      actorId,
      action: `payment.reconcile.${status}`,
      entityType: "payment",
      entityId: paymentId,
      beforeState,
      afterState,
      reason: notes || `Payment reconciliation status: ${status}`,
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
  getPaymentsAdmin,
  getPaymentDossier,
  reconcilePayment,
};
