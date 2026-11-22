const { pool } = require('../config/db');

const getReturns = async (req, res) => {
  try {
    if (req.user.role !== 'farmer') {
      return res.status(403).json({ message: 'Only farmers can access their returns' });
    }

    const farmerId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;
    const { status, search } = req.query;

    const conditions = ['r.farmer_id = $1'];
    const values = [farmerId];
    let paramIdx = 2;

    if (status && status !== 'all') {
      conditions.push(`r.status = $${paramIdx}`);
      values.push(status);
      paramIdx++;
    }

    if (search && search.trim()) {
      conditions.push(`(
        CAST(r.order_id AS TEXT) ILIKE $${paramIdx} OR
        u.name ILIKE $${paramIdx} OR
        u.email ILIKE $${paramIdx} OR
        r.reason ILIKE $${paramIdx}
      )`);
      values.push(`%${search.trim()}%`);
      paramIdx++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM returns r
      JOIN users u ON u.id = r.buyer_id
      ${whereClause}
    `;

    const dataQuery = `
      SELECT
        r.id,
        r.order_id,
        r.buyer_id,
        r.reason,
        r.status,
        r.refund_status,
        r.restock_quantity,
        r.resolution_note,
        r.created_at,
        r.updated_at,
        u.name AS buyer_name,
        u.phone AS buyer_phone,
        u.email AS buyer_email,
        o.total_amount AS order_total,
        (
          SELECT json_agg(json_build_object(
            'product_id', p.id,
            'product_name', p.name,
            'quantity', oi.quantity,
            'price', oi.price,
            'unit', COALESCE(p.unit, 'kg'),
            'image_url', p.image_url
          ))
          FROM order_items oi
          JOIN products p ON p.id = oi.product_id
          WHERE oi.order_id = r.order_id
        ) AS items
      FROM returns r
      JOIN users u ON u.id = r.buyer_id
      JOIN orders o ON o.id = r.order_id
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;

    const [countResult, returnsResult] = await Promise.all([
      pool.query(countQuery, values),
      pool.query(dataQuery, [...values, limit, offset]),
    ]);

    const total = countResult.rows[0]?.total || 0;

    return res.status(200).json({
      returns: returnsResult.rows,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error('Fetch returns failed:', error.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const createReturn = async (req, res) => {
  try {
    if (req.user.role !== 'farmer' && req.user.role !== 'buyer') {
      return res.status(403).json({ message: 'Unauthorized to file a return' });
    }

    const userId = req.user.id;
    const { order_id, reason, restock_quantity } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: 'reason is required' });
    }

    if (!order_id) {
      return res.status(400).json({ message: 'order_id is required' });
    }

    // Verify order and determine farmer and buyer
    const orderCheck = await pool.query(
      `SELECT o.id, o.buyer_id, p.farmer_id
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN products p ON p.id = oi.product_id
       WHERE o.id = $1
       LIMIT 1`,
      [order_id]
    );

    if (orderCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const order = orderCheck.rows[0];

    const farmerId = order.farmer_id;
    const buyerId = order.buyer_id;

    const insertResult = await pool.query(
      `INSERT INTO returns (order_id, farmer_id, buyer_id, reason, restock_quantity)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [order_id, farmerId, buyerId, reason.trim(), restock_quantity || 0]
    );

    return res.status(201).json({ return: insertResult.rows[0] });
  } catch (error) {
    console.error('Create return failed:', error.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const updateReturn = async (req, res) => {
  const client = await pool.connect();
  try {
    if (req.user.role !== 'farmer') {
      return res.status(403).json({ message: 'Only farmers can update returns' });
    }

    const farmerId = req.user.id;
    const returnId = parseInt(req.params.id);
    const { action, resolution_note, restock } = req.body;

    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ message: "action must be 'accept' or 'reject'" });
    }

    // Fetch the return record
    const returnCheck = await client.query(
      `SELECT * FROM returns WHERE id = $1`,
      [returnId]
    );

    if (returnCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Return not found' });
    }

    const returnRecord = returnCheck.rows[0];

    if (returnRecord.farmer_id != farmerId) {
      return res.status(403).json({ message: 'Return not found or not authorized' });
    }

    if (returnRecord.status !== 'pending') {
      return res.status(409).json({ message: 'Return is already resolved' });
    }

    await client.query('BEGIN');

    let updatedReturn;

    if (action === 'accept') {
      const updateResult = await client.query(
        `UPDATE returns
         SET status = 'accepted',
             refund_status = 'pending',
             resolution_note = COALESCE($1, resolution_note),
             updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [resolution_note ? resolution_note.trim() : null, returnId]
      );

      await client.query(
        `UPDATE orders SET order_status = 'returned' WHERE id = $1`,
        [returnRecord.order_id]
      );

      // Automatic inventory and product restock if requested
      if (restock !== false) {
        await client.query(
          `UPDATE products p
           SET stock = stock + oi.quantity,
               status = CASE WHEN p.status = 'sold_out' THEN 'active' ELSE p.status END,
               updated_at = NOW()
           FROM order_items oi
           WHERE oi.order_id = $1 AND oi.product_id = p.id`,
          [returnRecord.order_id]
        );

        await client.query(
          `UPDATE inventory inv
           SET quantity = quantity + oi.quantity,
               updated_at = NOW()
           FROM order_items oi
           WHERE oi.order_id = $1 AND oi.product_id = inv.product_id`,
          [returnRecord.order_id]
        );
      }

      updatedReturn = updateResult.rows[0];
    } else {
      const updateResult = await client.query(
        `UPDATE returns
         SET status = 'rejected',
             resolution_note = COALESCE($1, resolution_note),
             updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [resolution_note ? resolution_note.trim() : null, returnId]
      );
      updatedReturn = updateResult.rows[0];
    }

    await client.query('COMMIT');

    return res.status(200).json({ return: updatedReturn });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update return failed:', error.message);
    return res.status(500).json({ message: 'Internal server error' });
  } finally {
    client.release();
  }
};

module.exports = { getReturns, createReturn, updateReturn };
