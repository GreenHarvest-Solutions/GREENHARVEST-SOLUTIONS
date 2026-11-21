const { pool } = require("../config/db");
const logger = require("../utils/logger");

/**
 * Record an administrative mutation in the audit log.
 * @param {Object} entry
 * @param {number|string} entry.actorId - Admin user ID performing the mutation
 * @param {string} entry.action - Descriptive action code (e.g. 'user.suspend', 'kyc.approve')
 * @param {string} entry.entityType - Target entity type (e.g. 'user', 'farmer', 'product', 'setting')
 * @param {string|number} [entry.entityId] - ID of target entity
 * @param {Object} [entry.beforeState] - Prior state object before mutation
 * @param {Object} [entry.afterState] - New state object after mutation
 * @param {string} [entry.reason] - Justification or reason code for the action
 * @param {string} [entry.ipAddress] - Request IP address
 * @param {string} [entry.userAgent] - Request User-Agent header
 * @param {Object} [entry.client] - Optional pg client for running within an active transaction
 */
const record = async ({
  actorId,
  action,
  entityType,
  entityId = null,
  beforeState = null,
  afterState = null,
  reason = null,
  ipAddress = null,
  userAgent = null,
  client = null,
}) => {
  const db = client || pool;
  try {
    const result = await db.query(
      `
        INSERT INTO audit_logs (
          actor_id,
          action,
          entity_type,
          entity_id,
          before_state,
          after_state,
          reason,
          ip_address,
          user_agent,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING id, actor_id, action, entity_type, entity_id, created_at
      `,
      [
        actorId ? Number(actorId) : null,
        String(action),
        String(entityType),
        entityId !== null && entityId !== undefined ? String(entityId) : null,
        beforeState ? JSON.stringify(beforeState) : null,
        afterState ? JSON.stringify(afterState) : null,
        reason || null,
        ipAddress || null,
        userAgent || null,
      ]
    );

    return result.rows[0];
  } catch (error) {
    logger.error("Audit log recording failed", {
      action,
      entityType,
      entityId,
      error: error.message,
    });
    // In strict enterprise mode or audit rule, we want visibility
    throw error;
  }
};

/**
 * Retrieve paginated audit logs with filtering.
 */
const getAuditLogs = async ({
  actorId,
  action,
  entityType,
  entityId,
  search,
  fromDate,
  toDate,
  page = 1,
  limit = 20,
}) => {
  const offset = (Number(page) - 1) * Number(limit);
  const conditions = [];
  const params = [];
  let paramIdx = 1;

  if (actorId) {
    conditions.push(`al.actor_id = $${paramIdx++}`);
    params.push(actorId);
  }

  if (action) {
    conditions.push(`al.action = $${paramIdx++}`);
    params.push(action);
  }

  if (entityType) {
    conditions.push(`al.entity_type = $${paramIdx++}`);
    params.push(entityType);
  }

  if (entityId) {
    conditions.push(`al.entity_id = $${paramIdx++}`);
    params.push(String(entityId));
  }

  if (search) {
    conditions.push(
      `(al.action ILIKE $${paramIdx} OR al.entity_type ILIKE $${paramIdx} OR al.entity_id ILIKE $${paramIdx} OR al.reason ILIKE $${paramIdx} OR u.name ILIKE $${paramIdx} OR u.email ILIKE $${paramIdx})`
    );
    params.push(`%${search}%`);
    paramIdx++;
  }

  if (fromDate) {
    conditions.push(`al.created_at >= $${paramIdx++}`);
    params.push(fromDate);
  }

  if (toDate) {
    conditions.push(`al.created_at <= $${paramIdx++}`);
    params.push(toDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await pool.query(
    `
      SELECT COUNT(*)::int AS total
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.actor_id
      ${whereClause}
    `,
    params
  );

  const total = countResult.rows[0]?.total || 0;

  const dataParams = [...params, Number(limit), offset];
  const logsResult = await pool.query(
    `
      SELECT
        al.id,
        al.actor_id,
        u.name AS actor_name,
        u.email AS actor_email,
        ar.name AS actor_role,
        al.action,
        al.entity_type,
        al.entity_id,
        al.before_state,
        al.after_state,
        al.reason,
        al.ip_address,
        al.user_agent,
        al.created_at
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.actor_id
      LEFT JOIN admin_roles ar ON ar.id = u.admin_role_id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `,
    dataParams
  );

  return {
    logs: logsResult.rows,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      total_pages: Math.ceil(total / Number(limit)) || 1,
    },
  };
};

module.exports = {
  record,
  getAuditLogs,
};

