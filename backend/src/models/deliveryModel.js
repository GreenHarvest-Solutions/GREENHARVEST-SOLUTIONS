const { pool } = require("../config/db");

const findOrderById = async (client, order_id) => {
	const result = await client.query(
		`SELECT id, buyer_id, order_status FROM orders WHERE id = $1 FOR UPDATE`,
		[order_id]
	);

	return result.rows[0] || null;
};

const findDeliveryPartnerById = async (client, user_id) => {
	const result = await client.query(
		`
			SELECT u.id, dp.profile_id, u.name, u.email, u.phone, COALESCE(r.name, '') AS role_name
			FROM users u
			LEFT JOIN roles r ON r.id = u.role_id
			LEFT JOIN delivery_profiles dp ON dp.user_id = u.id
			WHERE (u.id = $1 OR dp.profile_id = $1)
			AND LOWER(COALESCE(r.name, '')) IN ('delivery_partner', 'field_agent')
		`,
		[user_id]
	);
	return result.rows[0] || null;
};

const findDeliveryByOrderIdForUpdate = async (client, order_id) => {
	const result = await client.query(
		`SELECT * FROM deliveries WHERE order_id = $1 FOR UPDATE`,
		[order_id]
	);

	return result.rows[0] || null;
};

const findDeliveryByIdForUpdate = async (client, delivery_id) => {
	const result = await client.query(
		`SELECT * FROM deliveries WHERE id = $1 FOR UPDATE`,
		[delivery_id]
	);

	return result.rows[0] || null;
};

const createDelivery = async (
	client,
	{
		order_id,
		delivery_partner_id,
		pickup_location,
		delivery_location,
		status,
		estimated_time,
	}
) => {
	const result = await client.query(
		`
			INSERT INTO deliveries (
				order_id,
				delivery_partner_id,
				delivery_person_id,
				delivery_address,
				delivery_location,
				pickup_location,
				status,
				delivery_status,
				estimated_time
			)
			VALUES ($1, $2, $2, $3, $3, $4, $5, $5, $6)
			RETURNING id, id AS delivery_id, order_id, delivery_partner_id, status, estimated_time, pickup_location, delivery_location, created_at
		`,
		[order_id, delivery_partner_id, delivery_location, pickup_location, status, estimated_time]
	);

	return result.rows[0];
};

const updateDeliveryByOrderId = async (
	client,
	{
		order_id,
		status,
		estimated_time = null,
		pickup_location = undefined,
		delivery_location = undefined,
	}
) => {
	const result = await client.query(
		`
			UPDATE deliveries
			SET status = $1,
				delivery_status = $1,
				estimated_time = COALESCE($2, estimated_time),
				pickup_location = COALESCE($3, pickup_location),
				delivery_location = COALESCE($4, delivery_location),
				delivery_address = COALESCE($4, delivery_address)
			WHERE order_id = $5
			RETURNING id, id AS delivery_id, order_id, delivery_partner_id, status, estimated_time, pickup_location, delivery_location, created_at
		`,
		[status, estimated_time, pickup_location, delivery_location, order_id]
	);

	return result.rows[0] || null;
};

const updateOrderDeliveryStatus = async (client, { order_id, status }) => {
	await client.query(
		`
			UPDATE orders
			SET order_status = CASE
						WHEN $1 = 'delivered' THEN 'delivered'
						WHEN $1 IN ('shipped', 'in_transit', 'out for delivery') AND order_status IN ('confirmed', 'processing', 'in_transit') THEN 'in_transit'
						ELSE order_status
					END
			WHERE id = $2
		`,
		[status, order_id]
	);
};

const getDeliveryByOrderId = async (order_id) => {
	const result = await pool.query(
		`
			SELECT
				d.id,
				d.id AS delivery_id,
				d.order_id,
				COALESCE(d.delivery_partner_id, d.delivery_person_id) AS delivery_partner_id,
				d.pickup_location,
				COALESCE(d.delivery_location, d.delivery_address) AS delivery_location,
				COALESCE(d.status, d.delivery_status) AS status,
				d.estimated_time,
				d.created_at,
				o.buyer_id,
				o.order_status,
				COALESCE(p.payment_status, 'pending') AS payment_status,
				u.name AS delivery_partner_name,
				u.email AS delivery_partner_email,
				u.phone AS delivery_partner_phone
			FROM deliveries d
			JOIN orders o ON o.id = d.order_id
			LEFT JOIN payments p ON p.order_id = o.id
			LEFT JOIN users u ON u.id = COALESCE(d.delivery_partner_id, d.delivery_person_id)
			WHERE d.order_id = $1
		`,
		[order_id]
	);

	return result.rows[0] || null;
};

const findDeliveriesByPartnerId = async (partner_id) => {
	const result = await pool.query(
		`
			SELECT
				d.id,
				d.id AS delivery_id,
				d.order_id,
				d.delivery_partner_id,
				d.pickup_location,
				COALESCE(d.delivery_location, d.delivery_address) AS delivery_location,
				COALESCE(d.status, d.delivery_status) AS status,
				d.estimated_time,
				d.created_at,
				o.order_status,
				o.total_amount,
				u.name AS buyer_name,
				u.phone AS buyer_phone
			FROM deliveries d
			JOIN orders o ON o.id = d.order_id
			JOIN users u ON u.id = o.buyer_id
			WHERE d.delivery_partner_id = $1 OR d.delivery_person_id = $1
			ORDER BY d.created_at DESC
		`,
		[partner_id]
	);

	return result.rows;
};

module.exports = {
	createDelivery,
	findDeliveriesByPartnerId,
	findDeliveryByIdForUpdate,
	findDeliveryByOrderIdForUpdate,
	findDeliveryPartnerById,
	findOrderById,
	getDeliveryByOrderId,
	updateDeliveryByOrderId,
	updateOrderDeliveryStatus,
};
