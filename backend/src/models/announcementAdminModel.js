const { pool } = require("../config/db");

/**
 * Announcement and Broadcast Communications Admin Model
 */
const getAnnouncementsAdmin = async ({
  status = null,
  category = null,
  priority = null,
  search = null,
  page = 1,
  limit = 20,
}) => {
  const conditions = [];
  const params = [];

  if (status && status !== "all") {
    params.push(status);
    conditions.push(`a.status = $${params.length}`);
  }

  if (category && category !== "all") {
    params.push(category);
    conditions.push(`a.category = $${params.length}`);
  }

  if (priority && priority !== "all") {
    params.push(priority);
    conditions.push(`a.priority = $${params.length}`);
  }

  if (search && search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`);
    const sIdx = params.length;
    conditions.push(`(
      LOWER(a.title) LIKE $${sIdx} OR
      LOWER(a.message) LIKE $${sIdx} OR
      LOWER(COALESCE(u.name, '')) LIKE $${sIdx}
    )`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  // Summary Metrics
  const metricsRes = await pool.query(`
    SELECT
      COUNT(*)::int AS total_broadcasts,
      COUNT(CASE WHEN status = 'sent' THEN 1 END)::int AS sent_count,
      COUNT(CASE WHEN status = 'scheduled' THEN 1 END)::int AS scheduled_count,
      COUNT(CASE WHEN status = 'draft' THEN 1 END)::int AS draft_count,
      COALESCE(SUM(delivered_count), 0)::int AS total_recipients_reached
    FROM announcements
  `);

  const countRes = await pool.query(
    `
      SELECT COUNT(*)::int AS total
      FROM announcements a
      LEFT JOIN users u ON u.id = a.created_by
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
        a.*,
        u.name AS creator_name,
        u.email AS creator_email
      FROM announcements a
      LEFT JOIN users u ON u.id = a.created_by
      ${whereClause}
      ORDER BY
        (a.status = 'scheduled') DESC,
        (a.status = 'draft') DESC,
        a.created_at DESC
      LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
    `,
    queryParams
  );

  return {
    announcements: dataRes.rows,
    metrics: metricsRes.rows[0] || {},
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      total_pages: Math.ceil(total / Number(limit)) || 1,
    },
  };
};

const getAnnouncementDossier = async (id) => {
  const annRes = await pool.query(
    `
      SELECT
        a.*,
        u.name AS creator_name,
        u.email AS creator_email
      FROM announcements a
      LEFT JOIN users u ON u.id = a.created_by
      WHERE a.id = $1
    `,
    [id]
  );

  if (!annRes.rows.length) return null;

  const deliveriesRes = await pool.query(
    `
      SELECT
        ad.*,
        u.name AS recipient_name,
        u.email AS recipient_email,
        u.role AS recipient_role
      FROM announcement_deliveries ad
      LEFT JOIN users u ON u.id = ad.user_id
      WHERE ad.announcement_id = $1
      ORDER BY ad.delivered_at DESC
      LIMIT 100
    `,
    [id]
  );

  return {
    announcement: annRes.rows[0],
    deliveries: deliveriesRes.rows,
  };
};

const estimateAudienceReach = async (target_audience, target_filter = {}) => {
  const conditions = ["u.account_status != 'suspended'"];
  const params = [];

  const role = target_filter?.role || (
    target_audience === "farmers_only" ? "farmer" :
    target_audience === "buyers_only" ? "buyer" :
    target_audience === "logistics_only" ? "delivery_partner" : null
  );

  if (role && role !== "all") {
    params.push(role);
    conditions.push(`u.role = $${params.length}`);
  }

  if (target_filter?.region && target_filter.region !== "all") {
    params.push(`%${target_filter.region.toLowerCase()}%`);
    const rIdx = params.length;
    conditions.push(`(
      LOWER(COALESCE(u.address, '')) LIKE $${rIdx} OR
      EXISTS (
        SELECT 1 FROM addresses addr WHERE addr.user_id = u.id AND LOWER(COALESCE(addr.region, '')) LIKE $${rIdx}
      )
    )`);
  }

  if (target_filter?.kyc_tier && target_filter.kyc_tier !== "all") {
    params.push(target_filter.kyc_tier);
    conditions.push(`u.kyc_tier = $${params.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const res = await pool.query(
    `
      SELECT COUNT(*)::int AS count
      FROM users u
      ${whereClause}
    `,
    params
  );

  return res.rows[0]?.count || 0;
};

const createAnnouncementAdmin = async ({
  title,
  message,
  target_audience = "all",
  target_filter = {},
  priority = "normal",
  category = "general",
  channels = ["in_app"],
  scheduled_at = null,
  expires_at = null,
  is_dismissible = true,
  status = "draft",
  created_by,
}) => {
  const insertSql = `
    INSERT INTO announcements (
      title, message, target_audience, target_filter, priority, category,
      channels, scheduled_at, expires_at, is_dismissible, status,
      delivered_count, created_by, created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, $12, NOW())
    RETURNING *
  `;

  const res = await pool.query(insertSql, [
    title,
    message,
    target_audience,
    JSON.stringify(target_filter || {}),
    priority,
    category,
    channels || ["in_app"],
    scheduled_at || null,
    expires_at || null,
    is_dismissible !== false,
    status || "draft",
    created_by || null,
  ]);

  return res.rows[0];
};

const updateAnnouncementAdmin = async (id, data) => {
  const fields = [];
  const params = [id];

  const allowedFields = [
    "title", "message", "target_audience", "target_filter", "priority",
    "category", "channels", "scheduled_at", "expires_at", "is_dismissible", "status"
  ];

  for (const key of allowedFields) {
    if (data[key] !== undefined) {
      if (key === "target_filter") {
        params.push(JSON.stringify(data[key]));
      } else {
        params.push(data[key]);
      }
      fields.push(`${key} = $${params.length}`);
    }
  }

  if (!fields.length) return null;

  const sql = `
    UPDATE announcements
    SET ${fields.join(", ")}
    WHERE id = $1
    RETURNING *
  `;

  const res = await pool.query(sql, params);
  return res.rows[0] || null;
};

const sendAnnouncementAdmin = async (id, actor_id) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Fetch announcement
    const annRes = await client.query("SELECT * FROM announcements WHERE id = $1 FOR UPDATE", [id]);
    if (!annRes.rows.length) {
      throw new Error("Announcement not found");
    }

    const ann = annRes.rows[0];
    if (ann.status === "sent") {
      throw new Error("Announcement has already been sent");
    }

    // Determine targeted users
    const conditions = ["u.account_status != 'suspended'"];
    const params = [];

    const filter = ann.target_filter || {};
    const role = filter.role || (
      ann.target_audience === "farmers_only" ? "farmer" :
      ann.target_audience === "buyers_only" ? "buyer" :
      ann.target_audience === "logistics_only" ? "delivery_partner" : null
    );

    if (role && role !== "all") {
      params.push(role);
      conditions.push(`u.role = $${params.length}`);
    }

    if (filter.region && filter.region !== "all") {
      params.push(`%${filter.region.toLowerCase()}%`);
      const rIdx = params.length;
      conditions.push(`(
        LOWER(COALESCE(u.address, '')) LIKE $${rIdx} OR
        EXISTS (
          SELECT 1 FROM addresses addr WHERE addr.user_id = u.id AND LOWER(COALESCE(addr.region, '')) LIKE $${rIdx}
        )
      )`);
    }

    if (filter.kyc_tier && filter.kyc_tier !== "all") {
      params.push(filter.kyc_tier);
      conditions.push(`u.kyc_tier = $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const usersRes = await client.query(
      `
        SELECT u.id, u.name, u.email
        FROM users u
        ${whereClause}
      `,
      params
    );

    const targetUsers = usersRes.rows;
    const deliveredCount = targetUsers.length;

    // Batch insert into notifications and announcement_deliveries
    for (const u of targetUsers) {
      // Create user in-app notification
      await client.query(
        `
          INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
          VALUES ($1, $2, $3, 'announcement', FALSE, NOW())
        `,
        [u.id, ann.title, ann.message]
      );

      // Record delivery log
      await client.query(
        `
          INSERT INTO announcement_deliveries (announcement_id, user_id, channel, status, delivered_at)
          VALUES ($1, $2, 'in_app', 'delivered', NOW())
        `,
        [ann.id, u.id]
      );
    }

    // Update announcement state
    const updatedRes = await client.query(
      `
        UPDATE announcements
        SET status = 'sent', sent_at = NOW(), delivered_count = $1
        WHERE id = $2
        RETURNING *
      `,
      [deliveredCount, id]
    );

    await client.query("COMMIT");
    return {
      announcement: updatedRes.rows[0],
      deliveredCount,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const cancelAnnouncementAdmin = async (id, actor_id) => {
  const res = await pool.query(
    `
      UPDATE announcements
      SET status = 'cancelled'
      WHERE id = $1 AND status != 'sent'
      RETURNING *
    `,
    [id]
  );

  return res.rows[0] || null;
};

// Notification Templates Model
const getNotificationTemplatesAdmin = async () => {
  const res = await pool.query(
    `
      SELECT *
      FROM notification_templates
      ORDER BY title ASC
    `
  );
  return res.rows;
};

const createNotificationTemplateAdmin = async ({ title, code, channel = "in_app", subject, body, variables = [] }) => {
  const res = await pool.query(
    `
      INSERT INTO notification_templates (title, code, channel, subject, body, variables, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW(), NOW())
      RETURNING *
    `,
    [title, code.toUpperCase(), channel, subject || null, body, JSON.stringify(variables || [])]
  );
  return res.rows[0];
};

const updateNotificationTemplateAdmin = async (id, data) => {
  const fields = [];
  const params = [id];

  const allowed = ["title", "subject", "body", "variables", "is_active", "channel"];
  for (const k of allowed) {
    if (data[k] !== undefined) {
      if (k === "variables") {
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
      UPDATE notification_templates
      SET ${fields.join(", ")}
      WHERE id = $1
      RETURNING *
    `,
    params
  );
  return res.rows[0] || null;
};

const deleteNotificationTemplateAdmin = async (id) => {
  const res = await pool.query("DELETE FROM notification_templates WHERE id = $1 RETURNING id", [id]);
  return res.rows[0] || null;
};

module.exports = {
  getAnnouncementsAdmin,
  getAnnouncementDossier,
  estimateAudienceReach,
  createAnnouncementAdmin,
  updateAnnouncementAdmin,
  sendAnnouncementAdmin,
  cancelAnnouncementAdmin,
  getNotificationTemplatesAdmin,
  createNotificationTemplateAdmin,
  updateNotificationTemplateAdmin,
  deleteNotificationTemplateAdmin,
};

