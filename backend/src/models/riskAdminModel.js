const { pool } = require("../config/db");

/**
 * Risk & Fraud Heuristics Admin Model
 */
const getRiskRules = async () => {
  const res = await pool.query(`
    SELECT *
    FROM risk_rules
    ORDER BY created_at ASC
  `);
  return res.rows;
};

const createRiskRule = async ({ name, rule_type, description, severity = "medium", threshold_config = {}, action = "flag_for_review" }) => {
  const res = await pool.query(
    `
      INSERT INTO risk_rules (name, rule_type, description, severity, threshold_config, action, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW(), NOW())
      RETURNING *
    `,
    [name, rule_type, description, severity, JSON.stringify(threshold_config), action]
  );
  return res.rows[0];
};

const updateRiskRule = async (id, data) => {
  const fields = [];
  const params = [id];

  const allowed = ["name", "description", "severity", "threshold_config", "is_active", "action"];
  for (const k of allowed) {
    if (data[k] !== undefined) {
      if (k === "threshold_config") {
        params.push(JSON.stringify(data[k]));
      } else {
        params.push(data[k]);
      }
      fields.push(`${k} = $${params.length}`);
    }
  }

  fields.push(`updated_at = NOW()`);

  const res = await pool.query(
    `
      UPDATE risk_rules
      SET ${fields.join(", ")}
      WHERE id = $1
      RETURNING *
    `,
    params
  );
  return res.rows[0] || null;
};

const getRiskFlags = async ({
  status = null,
  severity = null,
  entity_type = null,
  search = null,
  page = 1,
  limit = 20,
}) => {
  const conditions = [];
  const params = [];

  if (status && status !== "all") {
    params.push(status);
    conditions.push(`rf.status = $${params.length}`);
  }

  if (severity && severity !== "all") {
    params.push(severity);
    conditions.push(`rf.severity = $${params.length}`);
  }

  if (entity_type && entity_type !== "all") {
    params.push(entity_type);
    conditions.push(`rf.entity_type = $${params.length}`);
  }

  if (search && search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`);
    const sIdx = params.length;
    conditions.push(`(
      LOWER(rf.entity_id) LIKE $${sIdx} OR
      LOWER(rf.flag_reason) LIKE $${sIdx} OR
      LOWER(COALESCE(rr.name, '')) LIKE $${sIdx}
    )`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  // Summary Metrics
  const metricsRes = await pool.query(`
    SELECT
      COUNT(*)::int AS total_flags,
      COUNT(CASE WHEN status IN ('flagged', 'under_investigation') THEN 1 END)::int AS open_flags,
      COUNT(CASE WHEN severity = 'critical' AND status NOT IN ('resolved_safe', 'action_taken') THEN 1 END)::int AS critical_flags,
      COUNT(CASE WHEN status = 'under_investigation' THEN 1 END)::int AS under_investigation,
      COUNT(CASE WHEN status = 'resolved_safe' THEN 1 END)::int AS resolved_safe,
      COUNT(CASE WHEN status = 'confirmed_fraud' OR status = 'action_taken' THEN 1 END)::int AS confirmed_fraud
    FROM risk_flags
  `);

  const countRes = await pool.query(
    `
      SELECT COUNT(*)::int AS total
      FROM risk_flags rf
      LEFT JOIN risk_rules rr ON rr.id = rf.rule_id
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
        rf.*,
        rr.name AS rule_name,
        rr.rule_type,
        u.name AS resolver_name
      FROM risk_flags rf
      LEFT JOIN risk_rules rr ON rr.id = rf.rule_id
      LEFT JOIN users u ON u.id = rf.resolved_by
      ${whereClause}
      ORDER BY
        (rf.status = 'flagged' AND rf.severity = 'critical') DESC,
        (rf.status = 'flagged') DESC,
        rf.created_at DESC
      LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
    `,
    queryParams
  );

  return {
    flags: dataRes.rows,
    metrics: metricsRes.rows[0] || {},
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      total_pages: Math.ceil(total / Number(limit)) || 1,
    },
  };
};

const resolveRiskFlag = async (id, { status, resolution_notes, actor_id }) => {
  const res = await pool.query(
    `
      UPDATE risk_flags
      SET
        status = $1,
        resolution_notes = $2,
        resolved_by = $3,
        resolved_at = NOW(),
        updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `,
    [status, resolution_notes, actor_id, id]
  );
  return res.rows[0] || null;
};

const createRiskFlag = async ({
  rule_id = null,
  entity_type,
  entity_id,
  flag_type = null,
  severity = "medium",
  flag_reason,
  evidence = {},
  confidence_score = null,
  status = "flagged",
}) => {
  const res = await pool.query(
    `
      INSERT INTO risk_flags (
        rule_id,
        entity_type,
        entity_id,
        flag_type,
        severity,
        flag_reason,
        evidence,
        confidence_score,
        status,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *
    `,
    [
      rule_id,
      entity_type,
      String(entity_id),
      flag_type,
      severity,
      flag_reason,
      JSON.stringify(evidence || {}),
      confidence_score,
      status,
    ]
  );
  return res.rows[0];
};

module.exports = {
  getRiskRules,
  createRiskRule,
  updateRiskRule,
  getRiskFlags,
  resolveRiskFlag,
  createRiskFlag,
};

