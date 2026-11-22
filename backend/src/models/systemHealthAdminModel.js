const { pool } = require("../config/db");

/**
 * System Health & Diagnostics Admin Model
 */
const getSystemHealthAdmin = async () => {
  // 1. Measure real database latency
  const dbStart = process.hrtime.bigint();
  await pool.query("SELECT 1");
  const dbEnd = process.hrtime.bigint();
  const dbLatencyMs = Number(dbEnd - dbStart) / 1_000_000;

  // 2. Fetch live queue sizes
  const queueRes = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM users WHERE kyc_status IN ('pending', 'under_review')) AS unverified_kyc,
      (SELECT COUNT(*)::int FROM products WHERE status = 'pending_review') AS pending_products,
      (SELECT COUNT(*)::int FROM logistics_incidents WHERE is_resolved = FALSE) AS active_breaches,
      (SELECT COUNT(*)::int FROM support_tickets WHERE status = 'open') AS open_tickets,
      (SELECT COUNT(*)::int FROM returns WHERE status IN ('pending', 'accepted')) AS active_disputes,
      (SELECT COUNT(*)::int FROM payments WHERE payment_status = 'pending') AS unreconciled_payments
  `);

  // 3. Failed webhooks & delivery statistics
  const failuresRes = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM system_events WHERE event_type = 'failed_webhook') AS failed_webhooks_count,
      (SELECT COUNT(*)::int FROM announcement_deliveries WHERE status = 'failed') AS failed_deliveries_count,
      (SELECT COUNT(*)::int FROM audit_logs WHERE created_at >= NOW() - INTERVAL '24 hours') AS audit_events_24h
  `);

  // 4. Background Job Runs
  const jobsRes = await pool.query(`
    SELECT *
    FROM job_runs
    ORDER BY started_at DESC
    LIMIT 10
  `);

  // 5. Recent System Events
  const eventsRes = await pool.query(`
    SELECT *
    FROM system_events
    ORDER BY created_at DESC
    LIMIT 10
  `);

  const memoryUsage = process.memoryUsage();

  return {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor(process.uptime()),
    node_version: process.version,
    environment: process.env.NODE_ENV || "development",
    database: {
      status: "connected",
      latency_ms: Number(dbLatencyMs.toFixed(2)),
      pool_total_count: pool.totalCount || 10,
      pool_idle_count: pool.idleCount || 8,
      pool_waiting_count: pool.waitingCount || 0,
    },
    system_memory: {
      heap_used_mb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      heap_total_mb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      rss_mb: Math.round(memoryUsage.rss / 1024 / 1024),
    },
    queues: queueRes.rows[0] || {},
    telemetry: failuresRes.rows[0] || {},
    recent_jobs: jobsRes.rows,
    recent_events: eventsRes.rows,
  };
};

const getSystemEventsAdmin = async ({
  event_type = null,
  severity = null,
  page = 1,
  limit = 20,
}) => {
  const conditions = [];
  const params = [];

  if (event_type && event_type !== "all") {
    params.push(event_type);
    conditions.push(`event_type = $${params.length}`);
  }

  if (severity && severity !== "all") {
    params.push(severity);
    conditions.push(`severity = $${params.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS total FROM system_events ${whereClause}`,
    params
  );
  const total = countRes.rows[0]?.total || 0;

  const offset = (Number(page) - 1) * Number(limit);
  const queryParams = [...params, Number(limit), offset];

  const dataRes = await pool.query(
    `
      SELECT *
      FROM system_events
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
    `,
    queryParams
  );

  return {
    events: dataRes.rows,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      total_pages: Math.ceil(total / Number(limit)) || 1,
    },
  };
};

const recordSystemEvent = async ({ event_type, severity = "info", source, message, metadata = {} }) => {
  const res = await pool.query(
    `
      INSERT INTO system_events (event_type, severity, source, message, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `,
    [event_type, severity, source, message, JSON.stringify(metadata)]
  );
  return res.rows[0];
};

module.exports = {
  getSystemHealthAdmin,
  getSystemEventsAdmin,
  recordSystemEvent,
};

