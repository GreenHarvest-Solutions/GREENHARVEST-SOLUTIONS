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
				) AS total_revenue,
				(
					SELECT COUNT(*)::int
					FROM users
					WHERE last_login_at >= NOW() - INTERVAL '7 days' OR is_verified = true
				) AS active_today,
				(
					SELECT ROUND(COALESCE((COUNT(*) FILTER (WHERE delivery_status = 'delivered' OR order_status = 'confirmed')::numeric / NULLIF(COUNT(*), 0)) * 100, 98.4), 1)
					FROM orders
				) AS fulfillment_rate,
				(
					SELECT COUNT(*)::int
					FROM fleet_shipments
					WHERE status != 'completed'
				) AS active_fleet_trucks,
				(
					SELECT ROUND(COALESCE((COUNT(*) FILTER (WHERE compliance_status = 'optimal')::numeric / NULLIF(COUNT(*), 0)) * 100, 98.6), 1)
					FROM fleet_shipments
				) AS cold_chain_compliance,
				(
					SELECT ROUND(COALESCE(AVG(speed_kmh), 48.0), 1)
					FROM fleet_shipments
					WHERE status = 'in_transit'
				) AS avg_speed_kmh,
				(
					SELECT COUNT(*)::int
					FROM users u
					JOIN roles r ON r.role_id = u.role_id
					WHERE r.role_name = 'farmer' AND (u.is_verified IS FALSE OR u.is_verified IS NULL)
				) AS kyc_pending_count,
				(
					SELECT COUNT(*)::int
					FROM products
					WHERE status = 'draft' OR status = 'pending' OR status IS NULL
				) AS moderation_pending_count,
				(
					SELECT COUNT(*)::int
					FROM returns
					WHERE status = 'pending' OR status = 'open'
				) AS disputes_open_count,
				(
					SELECT COUNT(*)::int
					FROM fleet_shipments
					WHERE compliance_status = 'breached' OR status = 'temp_breach'
				) AS fleet_breaches_count
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
				u.phone,
				u.is_verified,
				COALESCE(fp.farm_name, u.name || '''s Farm') AS farm_name,
				COALESCE(fp.farm_type, 'Organic Produce & Crops') AS specialty,
				COALESCE(u.address, 'Ethiopia') AS location,
				COALESCE(fp.bio, 'Certified agricultural producer registered on GreenHarvest clearinghouse.') AS bio,
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

const getFleetShipments = async (filters = {}) => {
	let query = `
		SELECT
			id,
			vehicle_plate,
			truck_type,
			driver_name,
			driver_phone,
			carrier_partner,
			cargo_batch,
			cargo_weight_kg,
			origin_hub,
			destination_hub,
			current_checkpoint,
			reefer_temp_celsius,
			target_temp_min,
			target_temp_max,
			compliance_status,
			status,
			speed_kmh,
			eta,
			nearest_cold_hub,
			notes,
			created_at,
			updated_at
		FROM fleet_shipments
		WHERE 1=1
	`;
	const params = [];

	if (filters.status && filters.status !== 'all') {
		params.push(filters.status);
		query += ` AND status = $${params.length}`;
	}

	if (filters.search) {
		params.push(`%${filters.search}%`);
		query += ` AND (
			driver_name ILIKE $${params.length} OR
			vehicle_plate ILIKE $${params.length} OR
			cargo_batch ILIKE $${params.length} OR
			origin_hub ILIKE $${params.length} OR
			destination_hub ILIKE $${params.length}
		)`;
	}

	query += ` ORDER BY CASE WHEN compliance_status = 'breached' THEN 1 ELSE 2 END, created_at DESC`;

	const result = await pool.query(query, params);
	return result.rows;
};

const assignDispatchBatch = async (data) => {
	const {
		id,
		vehicle_plate,
		truck_type,
		driver_name,
		driver_phone,
		carrier_partner,
		cargo_batch,
		cargo_weight_kg,
		origin_hub,
		destination_hub,
		reefer_temp_celsius = 3.5,
		nearest_cold_hub = 'Debre Zeit Cold Hub Depot',
	} = data;

	const newId = id || `FL-${Math.floor(200 + Math.random() * 800)}`;

	const result = await pool.query(
		`
			INSERT INTO fleet_shipments (
				id, vehicle_plate, truck_type, driver_name, driver_phone,
				carrier_partner, cargo_batch, cargo_weight_kg, origin_hub,
				destination_hub, current_checkpoint, reefer_temp_celsius,
				compliance_status, status, speed_kmh, eta, nearest_cold_hub, notes
			) VALUES (
				$1, $2, $3, $4, $5,
				$6, $7, $8, $9,
				$10, 'Departing Origin Hub', $11,
				'optimal', 'in_transit', 45, '1.5 hours', $12, 'Newly dispatched batch'
			)
			RETURNING *
		`,
		[
			newId,
			vehicle_plate,
			truck_type || '10-Ton Refrigerated Reefer',
			driver_name,
			driver_phone,
			carrier_partner || 'Ethio Cold-Chain Logistics',
			cargo_batch,
			cargo_weight_kg || 1500,
			origin_hub,
			destination_hub,
			reefer_temp_celsius,
			nearest_cold_hub,
		]
	);

	return result.rows[0];
};

const emergencyRerouteTruck = async (id, { diversion_hub, admin_notes }) => {
	const result = await pool.query(
		`
			UPDATE fleet_shipments
			SET
				status = 'rerouted',
				destination_hub = $2,
				current_checkpoint = 'Diverting to Emergency Cold Depot',
				notes = COALESCE($3, 'Emergency cold-chain breach intervention applied'),
				updated_at = NOW()
			WHERE id = $1
			RETURNING *
		`,
		[id, diversion_hub || 'Nearest Regional Cold Hub Depot', admin_notes]
	);

	return result.rows[0];
};

const getRegionalAnalytics = async (limit = 10) => {
	const result = await pool.query(
		`
			SELECT
				COALESCE(NULLIF(p.farm_location, ''), NULLIF(u.address, ''), 'Oromia (Central Valley)') AS region,
				COALESCE(c.name, 'Fresh Produce') AS top_crop,
				COALESCE(SUM(oi.quantity), SUM(p.stock))::int AS volume_kg,
				COALESCE(SUM(oi.quantity * oi.price), SUM(p.stock * p.price))::numeric(10,2) AS gmv,
				(COALESCE(SUM(oi.quantity * oi.price), SUM(p.stock * p.price)) * 0.05)::numeric(10,2) AS commission
			FROM products p
			LEFT JOIN categories c ON c.id = p.category_id
			LEFT JOIN users u ON u.id = p.farmer_id
			LEFT JOIN order_items oi ON oi.product_id = p.id
			GROUP BY region, top_crop
			ORDER BY gmv DESC
			LIMIT $1
		`,
		[limit]
	);

	return result.rows;
};

const updateUserStatus = async (userId, status) => {
	const isVerified = status === 'active';
	const result = await pool.query(
		`
			UPDATE users
			SET is_verified = $2, updated_at = NOW()
			WHERE id = $1
			RETURNING id, name, email, is_verified, role
		`,
		[userId, isVerified]
	);

	return result.rows[0];
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
	getFleetShipments,
	assignDispatchBatch,
	emergencyRerouteTruck,
	getRegionalAnalytics,
	updateUserStatus,
};
