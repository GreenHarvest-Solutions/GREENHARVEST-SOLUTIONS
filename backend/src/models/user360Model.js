const { pool } = require("../config/db");
const auditService = require("../services/auditService");
const bcrypt = require("bcrypt");

/**
 * Get unified User 360 degree view
 */
const getUser360 = async (userId) => {
  const userRes = await pool.query(
    `SELECT 
      u.id,
      u.name,
      u.email,
      u.phone,
      u.role,
      u.account_status,
      u.is_verified,
      u.kyc_status,
      u.kyc_tier,
      u.created_at,
      u.updated_at,
      u.last_login_at,
      u.suspended_at,
      u.suspended_by,
      u.suspension_reason,
      u.admin_role_id,
      ar.name as admin_role_name,
      susp.name as suspended_by_name
    FROM users u
    LEFT JOIN admin_roles ar ON ar.id = u.admin_role_id
    LEFT JOIN users susp ON susp.id = u.suspended_by
    WHERE u.id = $1`,
    [userId]
  );

  if (userRes.rows.length === 0) {
    return null;
  }

  const user = userRes.rows[0];

  // Specific role profiles
  let roleProfile = null;
  if (user.role === "farmer") {
    const fpRes = await pool.query(`SELECT * FROM farmer_profiles WHERE user_id = $1`, [userId]);
    roleProfile = fpRes.rows[0] || null;
  } else if (user.role === "buyer") {
    const bpRes = await pool.query(`SELECT * FROM buyer_profiles WHERE user_id = $1`, [userId]);
    roleProfile = bpRes.rows[0] || null;
  } else if (user.role === "delivery_partner") {
    const dpRes = await pool.query(`SELECT * FROM delivery_profiles WHERE user_id = $1`, [userId]);
    roleProfile = dpRes.rows[0] || null;
  }

  // KYC documents
  const kycDocsRes = await pool.query(
    `SELECT id, document_type, document_url, status, rejection_reason, created_at 
     FROM kyc_documents WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );

  // Products (if farmer)
  let productsSummary = { total: 0, active: 0, total_value: 0, recent: [] };
  if (user.role === "farmer") {
    const pRes = await pool.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COALESCE(SUM(price * stock), 0) as total_value
       FROM products WHERE farmer_id = $1`,
      [userId]
    );
    const pRecent = await pool.query(
      `SELECT id, name, price, stock, status, moderation_status, created_at
       FROM products WHERE farmer_id = $1 ORDER BY created_at DESC LIMIT 5`,
      [userId]
    );
    productsSummary = {
      total: parseInt(pRes.rows[0].total, 10),
      active: parseInt(pRes.rows[0].active, 10),
      total_value: parseFloat(pRes.rows[0].total_value),
      recent: pRecent.rows,
    };
  }

  // Orders
  let ordersSummary = { total: 0, total_spent_or_earned: 0, recent: [] };
  if (user.role === "buyer") {
    const oRes = await pool.query(
      `SELECT 
        COUNT(*) as total,
        COALESCE(SUM(total_amount), 0) as total_volume
       FROM orders WHERE buyer_id = $1`,
      [userId]
    );
    const oRecent = await pool.query(
      `SELECT id, total_amount, order_status as status, payment_status, created_at
       FROM orders WHERE buyer_id = $1 ORDER BY created_at DESC LIMIT 5`,
      [userId]
    );
    ordersSummary = {
      total: parseInt(oRes.rows[0].total, 10),
      total_spent_or_earned: parseFloat(oRes.rows[0].total_volume),
      recent: oRecent.rows,
    };
  } else if (user.role === "farmer") {
    const oRes = await pool.query(
      `SELECT 
        COUNT(DISTINCT o.id) as total,
        COALESCE(SUM(oi.price * oi.quantity), 0) as total_volume
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN products p ON p.id = oi.product_id
       WHERE p.farmer_id = $1`,
      [userId]
    );
    const oRecent = await pool.query(
      `SELECT DISTINCT o.id, o.total_amount, o.order_status as status, o.payment_status, o.created_at
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN products p ON p.id = oi.product_id
       WHERE p.farmer_id = $1 ORDER BY o.created_at DESC LIMIT 5`,
      [userId]
    );
    ordersSummary = {
      total: parseInt(oRes.rows[0].total, 10),
      total_spent_or_earned: parseFloat(oRes.rows[0].total_volume),
      recent: oRecent.rows,
    };
  }

  // Disputes & Returns
  const disputesRes = await pool.query(
    `SELECT r.id, r.order_id, r.reason, r.status, r.refund_status, r.created_at
     FROM returns r
     WHERE r.buyer_id = $1 OR r.farmer_id = $1
     ORDER BY r.created_at DESC LIMIT 5`,
    [userId]
  );

  // Recent audit activity on this user
  const auditRes = await pool.query(
    `SELECT al.id, al.action, al.reason, al.created_at, actor.name as actor_name
     FROM audit_logs al
     LEFT JOIN users actor ON actor.id = al.actor_id
     WHERE al.entity_type = 'user' AND al.entity_id = $1
     ORDER BY al.created_at DESC LIMIT 10`,
    [userId]
  );

  return {
    user,
    roleProfile,
    kyc: {
      status: user.kyc_status,
      tier: user.kyc_tier,
      documents: kycDocsRes.rows,
    },
    products: productsSummary,
    orders: ordersSummary,
    disputes: disputesRes.rows,
    auditLogs: auditRes.rows,
  };
};

/**
 * Perform administrative action on user
 */
const performUserAction = async ({
  userId,
  action, // 'reset_password' | 'resend_verification' | 'change_role' | 'update_status'
  payload = {},
  actorId,
  ipAddress = null,
  userAgent = null,
}) => {
  const userRes = await pool.query(`SELECT * FROM users WHERE id = $1`, [userId]);
  if (userRes.rows.length === 0) {
    throw new Error(`User #${userId} not found`);
  }

  const user = userRes.rows[0];

  if (action === "reset_password") {
    const tempPassword = payload.password || Math.random().toString(36).slice(-8) + "Aa1!";
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    await pool.query(
      `UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [hashedPassword, userId]
    );

    await auditService.record({
      actorId,
      action: "user.reset_password",
      entityType: "user",
      entityId: userId,
      reason: payload.reason || "Admin triggered password reset",
      ipAddress,
      userAgent,
    });

    return {
      message: "Password reset successfully",
      temporary_password: payload.password ? undefined : tempPassword,
    };
  }

  if (action === "resend_verification") {
    // Insert notification
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
       VALUES ($1, 'system', 'Account Verification', 'Your verification request has been queued.', false, CURRENT_TIMESTAMP)`,
      [userId]
    );

    await auditService.record({
      actorId,
      action: "user.resend_verification",
      entityType: "user",
      entityId: userId,
      reason: "Admin queued verification notice",
      ipAddress,
      userAgent,
    });

    return { message: "Verification notice triggered successfully" };
  }

  if (action === "change_role") {
    const validRoles = ["buyer", "farmer", "delivery_partner", "admin"];
    if (!validRoles.includes(payload.role)) {
      throw new Error(`Invalid role: ${payload.role}. Must be one of ${validRoles.join(", ")}`);
    }

    await pool.query(
      `UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [payload.role, userId]
    );

    // If changing to farmer and no farmer_profile exists, create one
    if (payload.role === "farmer") {
      await pool.query(
        `INSERT INTO farmer_profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
        [userId]
      );
    }

    await auditService.record({
      actorId,
      action: "user.change_role",
      entityType: "user",
      entityId: userId,
      beforeState: { role: user.role },
      afterState: { role: payload.role },
      reason: payload.reason || `Changed role from ${user.role} to ${payload.role}`,
      ipAddress,
      userAgent,
    });

    return { message: `Role changed to ${payload.role} successfully` };
  }

  if (action === "update_status") {
    const validStatuses = ["active", "suspended", "banned", "deactivated", "pending"];
    if (!validStatuses.includes(payload.status)) {
      throw new Error(`Invalid status: ${payload.status}`);
    }

    const isSuspension = payload.status === "suspended" || payload.status === "banned";
    const suspendedAt = isSuspension ? new Date() : null;
    const suspendedBy = isSuspension ? actorId : null;
    const suspensionReason = isSuspension ? payload.reason || "Administrative action" : null;

    await pool.query(
      `UPDATE users 
       SET account_status = $1,
           suspended_at = $2,
           suspended_by = $3,
           suspension_reason = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5`,
      [payload.status, suspendedAt, suspendedBy, suspensionReason, userId]
    );

    await auditService.record({
      actorId,
      action: `user.status_${payload.status}`,
      entityType: "user",
      entityId: userId,
      beforeState: { account_status: user.account_status },
      afterState: { account_status: payload.status, suspension_reason: suspensionReason },
      reason: payload.reason || `Account status changed to ${payload.status}`,
      ipAddress,
      userAgent,
    });

    return { message: `Account status updated to ${payload.status}` };
  }

  throw new Error(`Unsupported action: ${action}`);
};

module.exports = {
  getUser360,
  performUserAction,
};
