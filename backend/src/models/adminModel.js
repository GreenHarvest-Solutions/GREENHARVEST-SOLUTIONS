const { pool } = require("../config/db");

const getSummaryMetrics = async () => {
	const result = await pool.query(
		`
			SELECT
				(SELECT COUNT(*)::int FROM users) AS total_users,
				(
					SELECT COUNT(*)::int
					FROM users u
					JOIN roles r ON r.role_id = u.role_id
					WHERE r.role_name = 'farmer'
				) AS total_farmers,
				(SELECT COUNT(*)::int FROM orders) AS total_orders,
				(
					SELECT COALESCE(SUM(o.total_price), 0)::numeric(10,2)
					FROM orders o
					WHERE o.order_status != 'cancelled'
				) AS total_revenue
		`
	);

	return result.rows[0];
};

const getTopSellingProducts = async (limit = 10) => {
	const result = await pool.query(
		`
			SELECT
				p.id AS id,
				p.name,
				COALESCE(SUM(oi.quantity), 0)::int AS units_sold,
				COALESCE(SUM(oi.quantity * oi.price), 0)::numeric(10,2) AS revenue_generated
			FROM products p
			LEFT JOIN order_items oi ON oi.product_id = p.id
			LEFT JOIN orders o ON o.id = oi.order_id
			WHERE o.id IS NULL OR o.order_status != 'cancelled'
			GROUP BY p.id, p.name
			ORDER BY units_sold DESC, revenue_generated DESC, p.created_at DESC
			LIMIT $1
		`,
		[limit]
	);

	return result.rows;
};

const getPendingFarmers = async (limit = 20) => {
	const result = await pool.query(
		`
			SELECT
				u.id,
				u.name,
				u.email,
				u.is_verified,
				COALESCE(fp.farm_name, u.name || '''s Farm') AS farm_name,
				COALESCE(fp.farm_type, 'Organic Produce & Crops') AS specialty,
				COALESCE(u.address, 'Ethiopia') AS location,
				u.created_at
			FROM users u
			JOIN roles r ON r.role_id = u.role_id
			LEFT JOIN farmer_profiles fp ON fp.user_id = u.id
			WHERE r.role_name = 'farmer'
			ORDER BY u.is_verified ASC, u.created_at DESC
			LIMIT $1
		`,
		[limit]
	);

	return result.rows;
};

const verifyFarmer = async (farmerId, isVerified) => {
	const result = await pool.query(
		`
			UPDATE users
			SET is_verified = $2, updated_at = NOW()
			WHERE id = $1
			RETURNING id, name, email, is_verified
		`,
		[farmerId, isVerified]
	);

	return result.rows[0];
};

const getProductsForModeration = async (limit = 20) => {
	const result = await pool.query(
		`
			SELECT
				p.id,
				p.name AS product_name,
				p.price,
				p.stock,
				p.status,
				COALESCE(c.name, 'Agricultural Produce') AS category,
				COALESCE(u.name, 'Verified Producer') AS farmer_name,
				p.created_at
			FROM products p
			LEFT JOIN categories c ON c.id = p.category_id
			LEFT JOIN users u ON u.id = p.farmer_id
			ORDER BY p.status = 'draft' DESC, p.created_at DESC
			LIMIT $1
		`,
		[limit]
	);

	return result.rows;
};

const moderateProduct = async (productId, status) => {
	const validStatuses = ['active', 'draft', 'deactivated'];
	const normalizedStatus = validStatuses.includes(status) ? status : 'active';

	const result = await pool.query(
		`
			UPDATE products
			SET status = $2
			WHERE id = $1
			RETURNING id, name, status, price, stock
		`,
		[productId, normalizedStatus]
	);

	return result.rows[0];
};

const getDisputes = async (limit = 20) => {
	const result = await pool.query(
		`
			SELECT
				r.id,
				r.order_id,
				r.reason,
				r.status,
				r.refund_status,
				r.created_at,
				COALESCE(buyer.name, 'Commercial Buyer') AS buyer_name,
				COALESCE(farmer.name, 'Producer') AS farmer_name,
				COALESCE(o.total_price, 0)::numeric(10,2) AS amount
			FROM returns r
			LEFT JOIN users buyer ON buyer.id = r.buyer_id
			LEFT JOIN users farmer ON farmer.id = r.farmer_id
			LEFT JOIN orders o ON o.id = r.order_id
			ORDER BY r.status = 'pending' DESC, r.created_at DESC
			LIMIT $1
		`,
		[limit]
	);

	return result.rows;
};

const resolveDispute = async (disputeId, action) => {
	const returnCheck = await pool.query(`SELECT * FROM returns WHERE id = $1`, [disputeId]);
	if (returnCheck.rows.length === 0) return null;

	const record = returnCheck.rows[0];
	let updatedReturn;

	if (action === 'refund' || action === 'accept') {
		const updateResult = await pool.query(
			`
				UPDATE returns
				SET status = 'accepted', refund_status = 'issued', updated_at = NOW()
				WHERE id = $1
				RETURNING *
			`,
			[disputeId]
		);
		await pool.query(
			`UPDATE orders SET order_status = 'refunded' WHERE id = $1`,
			[record.order_id]
		);
		updatedReturn = updateResult.rows[0];
	} else {
		const updateResult = await pool.query(
			`
				UPDATE returns
				SET status = 'rejected', refund_status = 'none', updated_at = NOW()
				WHERE id = $1
				RETURNING *
			`,
			[disputeId]
		);
		updatedReturn = updateResult.rows[0];
	}

	return updatedReturn;
};

const broadcastAnnouncement = async (adminUserId, message) => {
	const result = await pool.query(
		`
			INSERT INTO notifications (user_id, message)
			SELECT id, $1 FROM users WHERE id != $2
			RETURNING id
		`,
		[message, adminUserId || 0]
	);

	return { delivered_count: result.rowCount };
};

module.exports = {
	getSummaryMetrics,
	getTopSellingProducts,
	getPendingFarmers,
	verifyFarmer,
	getProductsForModeration,
	moderateProduct,
	getDisputes,
	resolveDispute,
	broadcastAnnouncement,
};
