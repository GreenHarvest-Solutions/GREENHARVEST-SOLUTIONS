const { pool } = require("../config/db");

/**
 * Support Tickets Admin Model
 */
const getTicketsAdmin = async ({
  status = null,
  priority = null,
  category = null,
  assigned_to = null,
  search = null,
  page = 1,
  limit = 20,
}) => {
  const conditions = [];
  const params = [];

  if (status && status !== "all") {
    params.push(status);
    conditions.push(`st.status = $${params.length}`);
  }

  if (priority && priority !== "all") {
    params.push(priority);
    conditions.push(`st.priority = $${params.length}`);
  }

  if (category && category !== "all") {
    params.push(category);
    conditions.push(`st.category = $${params.length}`);
  }

  if (assigned_to && assigned_to !== "all") {
    if (assigned_to === "unassigned") {
      conditions.push(`st.assigned_to IS NULL`);
    } else {
      params.push(Number(assigned_to));
      conditions.push(`st.assigned_to = $${params.length}`);
    }
  }

  if (search && search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`);
    const sIdx = params.length;
    conditions.push(`(
      LOWER(st.ticket_number) LIKE $${sIdx} OR
      LOWER(st.subject) LIKE $${sIdx} OR
      LOWER(u.name) LIKE $${sIdx} OR
      LOWER(u.email) LIKE $${sIdx} OR
      LOWER(COALESCE(u.phone, '')) LIKE $${sIdx}
    )`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  // Summary Metrics
  const metricsRes = await pool.query(`
    SELECT
      COUNT(*)::int AS total_tickets,
      COUNT(CASE WHEN status = 'open' THEN 1 END)::int AS open_tickets,
      COUNT(CASE WHEN status = 'in_progress' THEN 1 END)::int AS in_progress_tickets,
      COUNT(CASE WHEN priority = 'urgent' AND status NOT IN ('resolved', 'closed') THEN 1 END)::int AS urgent_tickets,
      COUNT(CASE WHEN status = 'waiting_on_customer' THEN 1 END)::int AS waiting_customer,
      COUNT(CASE WHEN status = 'resolved' AND resolved_at >= CURRENT_DATE THEN 1 END)::int AS resolved_today
    FROM support_tickets
  `);

  const countRes = await pool.query(
    `
      SELECT COUNT(*)::int AS total
      FROM support_tickets st
      LEFT JOIN users u ON u.id = st.user_id
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
        st.*,
        u.name AS customer_name,
        u.email AS customer_email,
        u.phone AS customer_phone,
        u.role AS customer_role,
        admin_u.name AS assignee_name,
        (
          SELECT COUNT(*)::int FROM ticket_messages tm WHERE tm.ticket_id = st.id
        ) AS message_count,
        (
          SELECT tm.message
          FROM ticket_messages tm
          WHERE tm.ticket_id = st.id
          ORDER BY tm.created_at DESC
          LIMIT 1
        ) AS last_message_snippet,
        (
          SELECT tm.created_at
          FROM ticket_messages tm
          WHERE tm.ticket_id = st.id
          ORDER BY tm.created_at DESC
          LIMIT 1
        ) AS last_message_at
      FROM support_tickets st
      LEFT JOIN users u ON u.id = st.user_id
      LEFT JOIN users admin_u ON admin_u.id = st.assigned_to
      ${whereClause}
      ORDER BY
        (st.status = 'open' AND st.priority = 'urgent') DESC,
        (st.status = 'open') DESC,
        st.updated_at DESC
      LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
    `,
    queryParams
  );

  return {
    tickets: dataRes.rows,
    metrics: metricsRes.rows[0] || {},
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      total_pages: Math.ceil(total / Number(limit)) || 1,
    },
  };
};

const getTicketDossier = async (id) => {
  const ticketRes = await pool.query(
    `
      SELECT
        st.*,
        u.name AS customer_name,
        u.email AS customer_email,
        u.phone AS customer_phone,
        u.role AS customer_role,
        u.kyc_status AS customer_kyc_status,
        u.kyc_tier AS customer_kyc_tier,
        u.account_status AS customer_account_status,
        admin_u.name AS assignee_name,
        admin_u.email AS assignee_email,
        ('ORD-' || o.id) AS order_number,
        o.total_price AS order_total,
        fs.vehicle_plate AS shipment_plate,
        fs.carrier_partner AS shipment_carrier
      FROM support_tickets st
      LEFT JOIN users u ON u.id = st.user_id
      LEFT JOIN users admin_u ON admin_u.id = st.assigned_to
      LEFT JOIN orders o ON o.id = st.order_id
      LEFT JOIN fleet_shipments fs ON fs.id = st.shipment_id
      WHERE st.id = $1
    `,
    [id]
  );

  if (!ticketRes.rows.length) return null;

  const messagesRes = await pool.query(
    `
      SELECT
        tm.*,
        u.name AS sender_name,
        u.role AS sender_user_role
      FROM ticket_messages tm
      LEFT JOIN users u ON u.id = tm.sender_id
      WHERE tm.ticket_id = $1
      ORDER BY tm.created_at ASC
    `,
    [id]
  );

  return {
    ticket: ticketRes.rows[0],
    messages: messagesRes.rows,
  };
};

const createTicketAdmin = async ({
  user_id,
  subject,
  category = "general",
  priority = "medium",
  initial_message,
  assigned_to = null,
  order_id = null,
  shipment_id = null,
  dispute_id = null,
  creator_id = null,
}) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Generate unique ticket number
    const countRes = await client.query("SELECT nextval('support_tickets_id_seq') AS seq");
    const seq = countRes.rows[0]?.seq || Math.floor(1000 + Math.random() * 9000);
    const ticketNumber = `TICK-${seq}`;

    const insertTicketSql = `
      INSERT INTO support_tickets (
        id, ticket_number, user_id, subject, category, priority, status,
        assigned_to, order_id, shipment_id, dispute_id, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'open', $7, $8, $9, $10, NOW(), NOW())
      RETURNING *
    `;

    const ticketRes = await client.query(insertTicketSql, [
      seq,
      ticketNumber,
      user_id || null,
      subject,
      category,
      priority,
      assigned_to || null,
      order_id || null,
      shipment_id || null,
      dispute_id || null,
    ]);

    const createdTicket = ticketRes.rows[0];

    // Add initial message
    if (initial_message && initial_message.trim()) {
      await client.query(
        `
          INSERT INTO ticket_messages (
            ticket_id, sender_id, sender_type, message, is_internal, created_at
          )
          VALUES ($1, $2, $3, $4, FALSE, NOW())
        `,
        [createdTicket.id, creator_id || user_id || null, creator_id ? "admin" : "customer", initial_message.trim()]
      );
    }

    await client.query("COMMIT");
    return createdTicket;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const updateTicketAdmin = async (id, { status, priority, category, assigned_to }) => {
  const fields = [];
  const params = [id];

  if (status !== undefined) {
    params.push(status);
    fields.push(`status = $${params.length}`);

    if (status === "resolved") {
      fields.push(`resolved_at = NOW()`);
    } else if (status === "closed") {
      fields.push(`closed_at = NOW()`);
    } else {
      fields.push(`resolved_at = NULL`);
    }
  }

  if (priority !== undefined) {
    params.push(priority);
    fields.push(`priority = $${params.length}`);
  }

  if (category !== undefined) {
    params.push(category);
    fields.push(`category = $${params.length}`);
  }

  if (assigned_to !== undefined) {
    params.push(assigned_to || null);
    fields.push(`assigned_to = $${params.length}`);
  }

  fields.push(`updated_at = NOW()`);

  const sql = `
    UPDATE support_tickets
    SET ${fields.join(", ")}
    WHERE id = $1
    RETURNING *
  `;

  const res = await pool.query(sql, params);
  return res.rows[0] || null;
};

const addTicketMessage = async ({
  ticket_id,
  sender_id,
  sender_type = "admin",
  message,
  is_internal = false,
  attachments = [],
}) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const msgRes = await client.query(
      `
        INSERT INTO ticket_messages (
          ticket_id, sender_id, sender_type, message, is_internal, attachments, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
      `,
      [ticket_id, sender_id, sender_type, message, is_internal, JSON.stringify(attachments)]
    );

    // Update ticket updated_at and conditionally update status
    let statusSql = "updated_at = NOW()";
    if (!is_internal && sender_type === "admin") {
      statusSql += ", status = CASE WHEN status = 'open' THEN 'waiting_on_customer' ELSE status END";
    } else if (!is_internal && sender_type === "customer") {
      statusSql += ", status = 'open'";
    }

    await client.query(
      `
        UPDATE support_tickets
        SET ${statusSql}
        WHERE id = $1
      `,
      [ticket_id]
    );

    await client.query("COMMIT");
    return msgRes.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const assignTicketAdmin = async (ticket_id, assigned_to, actor_id) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const adminRes = await client.query("SELECT name FROM users WHERE id = $1", [assigned_to]);
    const assigneeName = adminRes.rows[0]?.name || "Staff Member";

    const updateRes = await client.query(
      `
        UPDATE support_tickets
        SET assigned_to = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `,
      [assigned_to, ticket_id]
    );

    // Record internal note
    await client.query(
      `
        INSERT INTO ticket_messages (ticket_id, sender_id, sender_type, message, is_internal, created_at)
        VALUES ($1, $2, 'admin', $3, TRUE, NOW())
      `,
      [ticket_id, actor_id, `Internal note: Ticket assigned to ${assigneeName}.`]
    );

    await client.query("COMMIT");
    return updateRes.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const escalateTicketAdmin = async (ticket_id, { reason, actor_id }) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const updateRes = await client.query(
      `
        UPDATE support_tickets
        SET priority = 'urgent', status = 'open', updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [ticket_id]
    );

    await client.query(
      `
        INSERT INTO ticket_messages (ticket_id, sender_id, sender_type, message, is_internal, created_at)
        VALUES ($1, $2, 'admin', $3, TRUE, NOW())
      `,
      [ticket_id, actor_id, `Internal note: Ticket escalated to URGENT priority. Reason: ${reason || 'Immediate operational escalation requested.'}`]
    );

    await client.query("COMMIT");
    return updateRes.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  getTicketsAdmin,
  getTicketDossier,
  createTicketAdmin,
  updateTicketAdmin,
  addTicketMessage,
  assignTicketAdmin,
  escalateTicketAdmin,
};
