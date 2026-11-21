const { pool } = require("../config/db");
const auditService = require("../services/auditService");

/**
 * Fetch paginated orders with operational telemetry and filtering
 */
const getOrdersAdmin = async ({
  status = null,
  payment_status = null,
  delivery_status = null,
  search = null,
  from = null,
  to = null,
  page = 1,
  limit = 20,
}) => {
  const conditions = [];
  const params = [];

  if (status && status !== "all") {
    params.push(status);
    conditions.push(`o.order_status = $${params.length}`);
  }

  if (payment_status && payment_status !== "all") {
    params.push(payment_status);
    conditions.push(`o.payment_status = $${params.length}`);
  }

  if (delivery_status && delivery_status !== "all") {
    params.push(delivery_status);
    conditions.push(`o.delivery_status = $${params.length}`);
  }

  if (from) {
    params.push(from);
    conditions.push(`o.created_at >= $${params.length}`);
  }

  if (to) {
    params.push(to);
    conditions.push(`o.created_at <= $${params.length}`);
  }

  if (search && search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`);
    const sIndex = params.length;
    conditions.push(`(
      CAST(o.id AS TEXT) LIKE $${sIndex} OR
      LOWER(buyer.name) LIKE $${sIndex} OR
      LOWER(buyer.email) LIKE $${sIndex} OR
      LOWER(COALESCE(buyer.phone, '')) LIKE $${sIndex} OR
      EXISTS (
        SELECT 1 FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = o.id AND LOWER(p.name) LIKE $${sIndex}
      )
    )`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  // Get total count
  const countResult = await pool.query(
    `
      SELECT COUNT(*)::int AS total
      FROM orders o
      LEFT JOIN users buyer ON buyer.id = o.buyer_id
      ${whereClause}
    `,
    params
  );
  const total = countResult.rows[0]?.total || 0;

  // Get operational metric summaries
  const metricsResult = await pool.query(`
    SELECT
      COUNT(*)::int AS total_orders,
      COUNT(*) FILTER (WHERE order_status = 'pending')::int AS pending_count,
      COUNT(*) FILTER (WHERE order_status = 'confirmed')::int AS confirmed_count,
      COUNT(*) FILTER (WHERE order_status = 'shipped' OR delivery_status = 'in_transit')::int AS in_transit_count,
      COUNT(*) FILTER (WHERE order_status = 'delivered' OR delivery_status = 'delivered')::int AS delivered_count,
      COUNT(*) FILTER (WHERE order_status = 'cancelled')::int AS cancelled_count,
      COUNT(*) FILTER (WHERE order_status = 'refunded')::int AS refunded_count,
      COALESCE(SUM(total_price) FILTER (WHERE order_status != 'cancelled'), 0)::numeric(12,2) AS total_gmv
    FROM orders
  `);

  const offset = (Number(page) - 1) * Number(limit);
  const queryParams = [...params, Number(limit), offset];

  const dataResult = await pool.query(
    `
      SELECT
        o.id,
        o.buyer_id,
        o.address_id,
        o.total_price::numeric(12,2) AS total_price,
        COALESCE(o.total_amount, o.total_price)::numeric(12,2) AS total_amount,
        o.order_status,
        o.payment_status,
        o.delivery_status,
        COALESCE(o.refund_amount, 0)::numeric(12,2) AS refund_amount,
        o.created_at,
        buyer.name AS buyer_name,
        buyer.email AS buyer_email,
        buyer.phone AS buyer_phone,
        COALESCE(items_data.items_count, 0)::int AS items_count,
        items_data.product_names,
        items_data.farmer_names,
        pay.payment_method,
        pay.transaction_id,
        pay.gateway_name,
        esc.release_status AS escrow_status
      FROM orders o
      LEFT JOIN users buyer ON buyer.id = o.buyer_id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(oi.id) AS items_count,
          STRING_AGG(DISTINCT p.name, ', ') AS product_names,
          STRING_AGG(DISTINCT farmer.name, ', ') AS farmer_names
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        LEFT JOIN users farmer ON farmer.id = p.farmer_id
        WHERE oi.order_id = o.id
      ) items_data ON TRUE
      LEFT JOIN payments pay ON pay.order_id = o.id
      LEFT JOIN escrow_ledger esc ON esc.order_id = o.id
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
    `,
    queryParams
  );

  return {
    orders: dataResult.rows,
    metrics: metricsResult.rows[0] || {},
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      total_pages: Math.ceil(total / Number(limit)) || 1,
    },
  };
};

/**
 * Fetch complete Order Operations Dossier
 */
const getOrderDossier = async (orderId) => {
  // 1. Order core + buyer
  const orderRes = await pool.query(
    `
      SELECT
        o.id,
        o.buyer_id,
        o.address_id,
        o.total_price::numeric(12,2) AS total_price,
        COALESCE(o.total_amount, o.total_price)::numeric(12,2) AS total_amount,
        o.order_status,
        o.payment_status,
        o.delivery_status,
        COALESCE(o.refund_amount, 0)::numeric(12,2) AS refund_amount,
        o.refund_reason,
        o.refunded_at,
        o.cancellation_reason,
        o.notes,
        o.created_at,
        buyer.name AS buyer_name,
        buyer.email AS buyer_email,
        buyer.phone AS buyer_phone,
        buyer.account_status AS buyer_account_status,
        buyer.created_at AS buyer_member_since
      FROM orders o
      LEFT JOIN users buyer ON buyer.id = o.buyer_id
      WHERE o.id = $1
    `,
    [orderId]
  );

  if (orderRes.rows.length === 0) {
    return null;
  }

  const order = orderRes.rows[0];

  // 2. Line items with products and producers
  const itemsRes = await pool.query(
    `
      SELECT
        oi.id AS order_item_id,
        oi.product_id,
        oi.quantity,
        oi.price::numeric(12,2) AS unit_price,
        (oi.quantity * oi.price)::numeric(12,2) AS line_total,
        p.name AS product_name,
        COALESCE(p.image_url, pi.image_url) AS image_url,
        p.farm_location,
        p.grade,
        p.cold_chain_required,
        p.farmer_id,
        farmer.name AS farmer_name,
        farmer.phone AS farmer_phone,
        farmer.email AS farmer_email
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      LEFT JOIN LATERAL (
        SELECT image_url FROM product_images
        WHERE product_id = p.id
        ORDER BY image_id ASC LIMIT 1
      ) pi ON TRUE
      LEFT JOIN users farmer ON farmer.id = p.farmer_id
      WHERE oi.order_id = $1
      ORDER BY oi.id ASC
    `,
    [orderId]
  );

  // 3. Payment record
  const paymentRes = await pool.query(
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
        p.reconciled_at,
        p.reconciled_by,
        p.refund_amount::numeric(12,2) AS refund_amount,
        p.refund_status,
        p.created_at
      FROM payments p
      WHERE p.order_id = $1
      ORDER BY p.id DESC
      LIMIT 1
    `,
    [orderId]
  );

  // 4. Escrow status
  const escrowRes = await pool.query(
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
        releaser.name AS released_by_name
      FROM escrow_ledger e
      LEFT JOIN users releaser ON releaser.id = e.released_by
      WHERE e.order_id = $1
      ORDER BY e.id DESC
      LIMIT 1
    `,
    [orderId]
  );

  // 5. Delivery info
  const deliveryRes = await pool.query(
    `
      SELECT
        d.id,
        d.delivery_status,
        d.delivery_address,
        d.pickup_location,
        d.delivery_location,
        d.estimated_time,
        d.created_at,
        dp.name AS delivery_person_name,
        dp.phone AS delivery_person_phone
      FROM deliveries d
      LEFT JOIN users dp ON dp.id = COALESCE(d.delivery_person_id, d.delivery_partner_id)
      WHERE d.order_id = $1
      ORDER BY d.id DESC
      LIMIT 1
    `,
    [orderId]
  );

  // 6. Dispute / Return record if any
  const disputeRes = await pool.query(
    `
      SELECT
        r.id,
        r.reason,
        r.status,
        r.refund_status,
        r.dispute_category,
        r.evidence_image_urls,
        r.weighbridge_slip_url,
        r.settlement_split,
        r.tracking_number,
        r.created_at,
        r.updated_at
      FROM returns r
      WHERE r.order_id = $1
      ORDER BY r.id DESC
      LIMIT 1
    `,
    [orderId]
  );

  // 7. Audit history
  const auditRes = await pool.query(
    `
      SELECT
        a.id,
        a.action,
        a.reason,
        a.before_state,
        a.after_state,
        a.created_at,
        u.name AS actor_name,
        u.email AS actor_email
      FROM audit_logs a
      LEFT JOIN users u ON u.id = a.actor_id
      WHERE (a.entity_type = 'order' AND a.entity_id = $1)
         OR (a.entity_type = 'escrow' AND a.entity_id IN (
              SELECT id::text FROM escrow_ledger WHERE order_id = $2
            ))
         OR (a.entity_type = 'dispute' AND a.entity_id IN (
              SELECT id::text FROM returns WHERE order_id = $2
            ))
      ORDER BY a.created_at DESC
      LIMIT 50
    `,
    [String(orderId), orderId]
  );

  return {
    ...order,
    items: itemsRes.rows,
    payment: paymentRes.rows[0] || null,
    escrow: escrowRes.rows[0] || null,
    delivery: deliveryRes.rows[0] || null,
    dispute: disputeRes.rows[0] || null,
    audit_trail: auditRes.rows,
  };
};

/**
 * Override order status with mandatory justification
 */
const updateOrderStatus = async (orderId, newStatus, reason, actorId, ipAddress = null, userAgent = null) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const orderRes = await client.query("SELECT * FROM orders WHERE id = $1 FOR UPDATE", [orderId]);
    if (orderRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    const beforeState = orderRes.rows[0];

    const updateRes = await client.query(
      `
        UPDATE orders
        SET order_status = $1::varchar,
            cancellation_reason = CASE WHEN $1::varchar = 'cancelled' THEN $2::text ELSE cancellation_reason END
        WHERE id = $3
        RETURNING *
      `,
      [newStatus, reason, orderId]
    );

    const afterState = updateRes.rows[0];

    await auditService.record({
      actorId,
      action: `order.status_override.${newStatus}`,
      entityType: "order",
      entityId: orderId,
      beforeState,
      afterState,
      reason,
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

/**
 * Authorize idempotent full or partial refund on order
 */
const refundOrder = async (
  orderId,
  { amount, reason, idempotencyKey = null, refundFull = false },
  actorId,
  ipAddress = null,
  userAgent = null
) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const orderRes = await client.query("SELECT * FROM orders WHERE id = $1 FOR UPDATE", [orderId]);
    if (orderRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return { success: false, error: "Order not found" };
    }

    const order = orderRes.rows[0];
    const totalPrice = Number(order.total_price);
    const existingRefund = Number(order.refund_amount || 0);
    const maxRefundable = Math.max(0, totalPrice - existingRefund);

    let refundAmount = refundFull ? maxRefundable : Number(amount);
    if (!refundAmount || refundAmount <= 0) {
      await client.query("ROLLBACK");
      return { success: false, error: "Refund amount must be greater than 0" };
    }

    if (refundAmount > maxRefundable) {
      await client.query("ROLLBACK");
      return {
        success: false,
        error: `Refund amount ETB ${refundAmount.toFixed(2)} exceeds remaining refundable balance ETB ${maxRefundable.toFixed(2)}`,
      };
    }

    const newTotalRefund = existingRefund + refundAmount;
    const isFullRefund = newTotalRefund >= totalPrice;
    const newOrderStatus = isFullRefund ? "refunded" : order.order_status;

    // 1. Update order
    const updatedOrderRes = await client.query(
      `
        UPDATE orders
        SET refund_amount = $1,
            refund_reason = $2,
            refunded_at = NOW(),
            refunded_by = $3,
            order_status = $4
        WHERE id = $5
        RETURNING *
      `,
      [newTotalRefund, reason, actorId, newOrderStatus, orderId]
    );

    // 2. Update payment
    await client.query(
      `
        UPDATE payments
        SET refund_amount = COALESCE(refund_amount, 0) + $1,
            refund_status = CASE WHEN (COALESCE(refund_amount, 0) + $1) >= amount THEN 'refunded' ELSE 'partial' END
        WHERE order_id = $2
      `,
      [refundAmount, orderId]
    );

    // 3. Update escrow ledger
    const escrowRes = await client.query("SELECT * FROM escrow_ledger WHERE order_id = $1 FOR UPDATE", [orderId]);
    if (escrowRes.rows.length > 0) {
      const escrow = escrowRes.rows[0];
      const newBuyerRefund = Number(escrow.buyer_refund_amount || 0) + refundAmount;
      const newFarmerPayout = Math.max(0, Number(escrow.escrow_amount) - Number(escrow.platform_fee_amount) - newBuyerRefund);
      const newReleaseStatus = isFullRefund ? "refunded" : "split_settled";

      await client.query(
        `
          UPDATE escrow_ledger
          SET buyer_refund_amount = $1,
              farmer_payout_amount = $2,
              release_status = $3,
              notes = COALESCE(notes, '') || ' | ' || $4,
              updated_at = NOW()
          WHERE id = $5
        `,
        [newBuyerRefund, newFarmerPayout, newReleaseStatus, `Refund authorized: ETB ${refundAmount} (${reason})`, escrow.id]
      );
    }

    // 4. Record audit log
    await auditService.record({
      actorId,
      action: isFullRefund ? "order.refund.full" : "order.refund.partial",
      entityType: "order",
      entityId: orderId,
      beforeState: {
        order_status: order.order_status,
        refund_amount: existingRefund,
      },
      afterState: {
        order_status: newOrderStatus,
        refund_amount: newTotalRefund,
        refunded_this_transaction: refundAmount,
      },
      reason,
      ipAddress,
      userAgent,
      client,
    });

    await client.query("COMMIT");
    return {
      success: true,
      order: updatedOrderRes.rows[0],
      refundAmount,
      totalRefunded: newTotalRefund,
      isFullRefund,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  getOrdersAdmin,
  getOrderDossier,
  updateOrderStatus,
  refundOrder,
};
