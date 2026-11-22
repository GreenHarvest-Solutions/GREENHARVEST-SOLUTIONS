const { pool } = require("../config/db");
const { Parser } = require("json2csv");

const REPORT_CATALOG = [
  {
    type: "gmv_commission",
    name: "Gross Merchandise Value & Commission Ledger",
    description: "Transaction volumes, order totals, farmer payouts, and platform take-rate across commerce corridors.",
    category: "Financial",
  },
  {
    type: "refunds_payouts",
    name: "Escrow Disbursements & Settlement Reconciliation",
    description: "Two-way escrow clearinghouse movements, buyer refunds, farmer release batches, and fee withholdings.",
    category: "Financial",
  },
  {
    type: "kyc_aging",
    name: "Producer KYC Verification Aging Audit",
    description: "Farmer onboarding turnaround times, verification backlog, and accreditation tier status.",
    category: "Governance",
  },
  {
    type: "moderation_sla",
    name: "Catalog Moderation SLA & Rejection Breakdown",
    description: "Product quality reviews, approval speeds, pesticide clearance checks, and rejection reason breakdown.",
    category: "Governance",
  },
  {
    type: "dispute_aging",
    name: "Customer Dispute & Return Resolution Turnaround",
    description: "Buyer dispute aging, claim validity ratios, return logistics receipts, and mediation settlements.",
    category: "Operations",
  },
  {
    type: "delivery_performance",
    name: "Carrier Fleet On-Time & Hub Dwell Performance",
    description: "Carrier SLA delivery metrics, dispatch-to-drop transit times, and regional corridor fulfillment.",
    category: "Logistics",
  },
  {
    type: "cold_chain_compliance",
    name: "Reefer Telematics Cold-Chain Compliance Log",
    description: "Continuous IoT temperature sensor records, duration in 0–4°C threshold, and thermal breach incidents.",
    category: "Logistics",
  },
  {
    type: "user_growth",
    name: "User Growth & Regional Density Registry",
    description: "Farmer, buyer, and carrier acquisition metrics segmented by regional agricultural corridors.",
    category: "Analytics",
  },
];

const getReportsCatalogAdmin = async () => {
  return REPORT_CATALOG;
};

const getReportJobsAdmin = async ({ page = 1, limit = 15 }) => {
  const countRes = await pool.query("SELECT COUNT(*)::int AS total FROM report_jobs");
  const total = countRes.rows[0]?.total || 0;

  const offset = (Number(page) - 1) * Number(limit);
  const dataRes = await pool.query(
    `
      SELECT
        rj.*,
        u.name AS creator_name
      FROM report_jobs rj
      LEFT JOIN users u ON u.id = rj.created_by
      ORDER BY rj.created_at DESC
      LIMIT $1 OFFSET $2
    `,
    [Number(limit), offset]
  );

  return {
    jobs: dataRes.rows,
    catalog: REPORT_CATALOG,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      total_pages: Math.ceil(total / Number(limit)) || 1,
    },
  };
};

const getReportJobById = async (id) => {
  const res = await pool.query(
    `
      SELECT
        rj.*,
        u.name AS creator_name
      FROM report_jobs rj
      LEFT JOIN users u ON u.id = rj.created_by
      WHERE rj.id = $1
    `,
    [id]
  );
  return res.rows[0] || null;
};

const executeReportExport = async ({
  report_type,
  name,
  parameters = {},
  format = "csv",
  actor_id,
}) => {
  let queryData = [];
  let defaultReportName = name;

  switch (report_type) {
    case "gmv_commission": {
      defaultReportName = defaultReportName || "GMV_Commission_Export";
      const qRes = await pool.query(`
        SELECT
          o.id AS order_id,
          ('ORD-' || o.id) AS order_number,
          o.total_price::float AS gmv_etb,
          ROUND((o.total_price * 0.05)::numeric, 2)::float AS platform_commission_etb,
          ROUND((o.total_price * 0.95)::numeric, 2)::float AS farmer_net_etb,
          o.order_status,
          o.payment_status,
          b.name AS buyer_name,
          o.created_at AS order_date
        FROM orders o
        LEFT JOIN users b ON b.id = o.buyer_id
        ORDER BY o.created_at DESC
        LIMIT 1000
      `);
      queryData = qRes.rows;
      break;
    }

    case "refunds_payouts": {
      defaultReportName = defaultReportName || "Escrow_Disbursements_Refunds";
      const qRes = await pool.query(`
        SELECT
          el.id AS ledger_entry_id,
          ('ORD-' || el.order_id) AS order_number,
          el.entry_type,
          el.amount::float AS amount_etb,
          el.balance_after::float AS escrow_balance_after_etb,
          el.reference_note,
          el.created_at
        FROM escrow_ledger el
        ORDER BY el.created_at DESC
        LIMIT 1000
      `);
      queryData = qRes.rows;
      break;
    }

    case "kyc_aging": {
      defaultReportName = defaultReportName || "Farmer_KYC_Aging_Audit";
      const qRes = await pool.query(`
        SELECT
          u.id AS user_id,
          u.name AS farmer_name,
          u.phone,
          u.kyc_status,
          u.kyc_tier,
          u.account_status,
          ROUND(EXTRACT(EPOCH FROM (NOW() - u.created_at)) / 86400, 1) AS days_since_registration,
          u.created_at AS registered_at
        FROM users u
        WHERE u.role = 'farmer'
        ORDER BY u.created_at DESC
        LIMIT 1000
      `);
      queryData = qRes.rows;
      break;
    }

    case "moderation_sla": {
      defaultReportName = defaultReportName || "Catalog_Moderation_SLA";
      const qRes = await pool.query(`
        SELECT
          p.id AS product_id,
          p.title AS product_name,
          c.name AS category_name,
          u.name AS farmer_name,
          p.price_per_unit::float AS price_etb,
          p.unit,
          p.status AS moderation_status,
          p.created_at AS listed_date
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN users u ON u.id = p.farmer_id
        ORDER BY p.created_at DESC
        LIMIT 1000
      `);
      queryData = qRes.rows;
      break;
    }

    case "dispute_aging": {
      defaultReportName = defaultReportName || "Dispute_Aging_Turnaround";
      const qRes = await pool.query(`
        SELECT
          r.id AS dispute_id,
          ('ORD-' || r.order_id) AS order_number,
          r.reason AS dispute_reason,
          r.refund_amount::float AS refund_amount_etb,
          r.status AS dispute_status,
          r.created_at AS filed_date
        FROM returns r
        ORDER BY r.created_at DESC
        LIMIT 1000
      `);
      queryData = qRes.rows;
      break;
    }

    case "delivery_performance": {
      defaultReportName = defaultReportName || "Fleet_Delivery_Performance";
      const qRes = await pool.query(`
        SELECT
          fs.id AS shipment_id,
          fs.vehicle_plate,
          fs.carrier_partner,
          fs.origin_hub,
          fs.destination_hub,
          fs.status AS shipment_status,
          fs.departure_time,
          fs.estimated_arrival,
          fs.actual_arrival
        FROM fleet_shipments fs
        ORDER BY fs.created_at DESC
        LIMIT 1000
      `);
      queryData = qRes.rows;
      break;
    }

    case "cold_chain_compliance": {
      defaultReportName = defaultReportName || "Cold_Chain_Compliance_Log";
      const qRes = await pool.query(`
        SELECT
          tl.id AS log_id,
          tl.shipment_id,
          tl.temperature_c::float AS sensor_temp_c,
          tl.humidity_pct::float AS humidity_pct,
          tl.recorded_at,
          fs.vehicle_plate,
          fs.carrier_partner
        FROM temperature_logs tl
        LEFT JOIN fleet_shipments fs ON fs.id = tl.shipment_id
        ORDER BY tl.recorded_at DESC
        LIMIT 1000
      `);
      queryData = qRes.rows;
      break;
    }

    case "user_growth":
    default: {
      defaultReportName = defaultReportName || "User_Growth_Registry";
      const qRes = await pool.query(`
        SELECT
          u.id AS user_id,
          u.name,
          u.email,
          u.role,
          u.account_status,
          u.created_at AS registered_at
        FROM users u
        ORDER BY u.created_at DESC
        LIMIT 1000
      `);
      queryData = qRes.rows;
      break;
    }
  }

  let csvContent = "";
  if (queryData.length > 0) {
    const parser = new Parser();
    csvContent = parser.parse(queryData);
  } else {
    csvContent = "No records found matching report criteria";
  }

  const rowCount = queryData.length;
  const fileSizeBytes = Buffer.byteLength(csvContent, "utf8");
  const dataPreview = queryData.slice(0, 10);

  const jobRes = await pool.query(
    `
      INSERT INTO report_jobs (
        report_type, name, parameters, format, status, row_count, file_size_bytes,
        download_url, data_preview, created_by, created_at, completed_at
      )
      VALUES ($1, $2, $3, $4, 'completed', $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *
    `,
    [
      report_type,
      defaultReportName,
      JSON.stringify(parameters || {}),
      format,
      rowCount,
      fileSizeBytes,
      `/api/admin/reports/jobs/${Date.now()}/download`,
      JSON.stringify(dataPreview),
      actor_id || null,
    ]
  );

  return {
    job: jobRes.rows[0],
    csv: csvContent,
    rowCount,
  };
};

const getReportSchedulesAdmin = async () => {
  const res = await pool.query(`
    SELECT
      rs.*,
      u.name AS creator_name
    FROM report_schedules rs
    LEFT JOIN users u ON u.id = rs.created_by
    ORDER BY rs.created_at DESC
  `);
  return res.rows;
};

const createReportScheduleAdmin = async ({
  report_type,
  name,
  cadence = "weekly",
  recipients = [],
  parameters = {},
  created_by,
}) => {
  const res = await pool.query(
    `
      INSERT INTO report_schedules (
        report_type, name, cadence, recipients, parameters, is_active,
        next_run_at, created_by, created_at
      )
      VALUES ($1, $2, $3, $4, $5, TRUE, NOW() + INTERVAL '7 days', $6, NOW())
      RETURNING *
    `,
    [report_type, name, cadence, recipients, JSON.stringify(parameters || {}), created_by || null]
  );
  return res.rows[0];
};

const updateReportScheduleAdmin = async (id, data) => {
  const fields = [];
  const params = [id];

  const allowed = ["name", "cadence", "recipients", "parameters", "is_active"];
  for (const k of allowed) {
    if (data[k] !== undefined) {
      if (k === "parameters") {
        params.push(JSON.stringify(data[k]));
      } else {
        params.push(data[k]);
      }
      fields.push(`${k} = $${params.length}`);
    }
  }

  const res = await pool.query(
    `
      UPDATE report_schedules
      SET ${fields.join(", ")}
      WHERE id = $1
      RETURNING *
    `,
    params
  );
  return res.rows[0] || null;
};

const deleteReportScheduleAdmin = async (id) => {
  const res = await pool.query("DELETE FROM report_schedules WHERE id = $1 RETURNING id", [id]);
  return res.rows[0] || null;
};

module.exports = {
  getReportsCatalogAdmin,
  getReportJobsAdmin,
  getReportJobById,
  executeReportExport,
  getReportSchedulesAdmin,
  createReportScheduleAdmin,
  updateReportScheduleAdmin,
  deleteReportScheduleAdmin,
};

