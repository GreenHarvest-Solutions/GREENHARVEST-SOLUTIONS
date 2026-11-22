const { pool } = require("../config/db");

const findOrderById = async (client, order_id) => {
	const result = await client.query(
		`SELECT id, buyer_id, order_status, payment_status, delivery_status FROM orders WHERE id = $1 FOR UPDATE`,
		[order_id]
	);
	return result.rows[0] || null;
};

const findSuborderById = async (client, suborder_id) => {
	const result = await client.query(
		`
			SELECT s.*, o.buyer_id, o.order_number, u.name AS farmer_name, u.phone AS farmer_phone,
			       bu.name AS buyer_name, bu.phone AS buyer_phone, bu.address AS buyer_address
			FROM suborders s
			JOIN orders o ON o.id = s.parent_order_id
			JOIN users u ON u.id = s.farmer_id
			JOIN users bu ON bu.id = o.buyer_id
			WHERE s.id = $1
			FOR UPDATE OF s
		`,
		[suborder_id]
	);

	return result.rows[0] || null;
};

const findDeliveryPartnerById = async (client, user_id) => {
	const result = await client.query(
		`
			SELECT u.id, dp.profile_id, u.name, u.email, u.phone, COALESCE(r.name, u.role, '') AS role_name
			FROM users u
			LEFT JOIN roles r ON r.id = u.role_id
			LEFT JOIN delivery_profiles dp ON dp.user_id = u.id
			WHERE (u.id = $1 OR dp.profile_id = $1)
			AND (
				LOWER(COALESCE(r.name, '')) IN ('delivery_partner', 'field_agent')
				OR u.role IN ('delivery_partner', 'delivery', 'deliveryPartner', 'field_agent')
			)
		`,
		[user_id]
	);

	return result.rows[0] || null;
};

const findDeliveryBySuborderId = async (client, suborder_id) => {
	const result = await client.query(
		`SELECT * FROM deliveries WHERE suborder_id = $1 ORDER BY id DESC LIMIT 1`,
		[suborder_id]
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

const upsertSuborderDelivery = async (
	client,
	{
		order_id,
		suborder_id,
		delivery_partner_id = null,
		fulfillment_type = "farmer_pickup",
		status = "pending",
		pickup_verification_code = null,
		delivery_confirmation_code = null,
		pickup_location = null,
		delivery_location = null,
		estimated_time = null,
		farmer_notes = null,
		proof_of_delivery_image_url = null,
	}
) => {
	const existing = await client.query(
		`SELECT id FROM deliveries WHERE suborder_id = $1 LIMIT 1`,
		[suborder_id]
	);

	if (existing.rows.length > 0) {
		const result = await client.query(
			`
				UPDATE deliveries
				SET
					fulfillment_type = COALESCE($1, fulfillment_type),
					status = COALESCE($2, status),
					delivery_status = COALESCE($2, delivery_status),
					delivery_partner_id = COALESCE($3, delivery_partner_id),
					delivery_person_id = COALESCE($3, delivery_person_id),
					pickup_verification_code = COALESCE($4, pickup_verification_code),
					delivery_confirmation_code = COALESCE($5, delivery_confirmation_code),
					pickup_location = COALESCE($6, pickup_location),
					delivery_location = COALESCE($7, delivery_location),
					delivery_address = COALESCE($7, delivery_address),
					estimated_time = COALESCE($8, estimated_time),
					farmer_notes = COALESCE($9, farmer_notes),
					proof_of_delivery_image_url = COALESCE($10, proof_of_delivery_image_url)
				WHERE id = $11
				RETURNING *
			`,
			[
				fulfillment_type,
				status,
				delivery_partner_id,
				pickup_verification_code,
				delivery_confirmation_code,
				pickup_location,
				delivery_location,
				estimated_time,
				farmer_notes,
				proof_of_delivery_image_url,
				existing.rows[0].id,
			]
		);
		return result.rows[0];
	}

	const result = await client.query(
		`
			INSERT INTO deliveries (
				order_id,
				suborder_id,
				delivery_partner_id,
				delivery_person_id,
				fulfillment_type,
				status,
				delivery_status,
				pickup_verification_code,
				delivery_confirmation_code,
				pickup_location,
				delivery_location,
				delivery_address,
				estimated_time,
				farmer_notes,
				proof_of_delivery_image_url,
				created_at
			)
			VALUES ($1, $2, $3, $3, $4, $5, $5, $6, $7, $8, $9, $9, $10, $11, $12, NOW())
			RETURNING *
		`,
		[
			order_id,
			suborder_id,
			delivery_partner_id,
			fulfillment_type,
			status,
			pickup_verification_code,
			delivery_confirmation_code,
			pickup_location,
			delivery_location,
			estimated_time,
			farmer_notes,
			proof_of_delivery_image_url,
		]
	);

	return result.rows[0];
};

const createDelivery = async (client, payload) => {
	return upsertSuborderDelivery(client, payload);
};

const getAvailableDeliveryPool = async () => {
	const result = await pool.query(
		`
			SELECT
				s.id AS suborder_id,
				s.suborder_number,
				s.parent_order_id AS order_id,
				o.order_number,
				s.subtotal,
				s.shipping_fee,
				s.total_amount,
				s.fulfillment_type,
				s.fulfillment_status,
				s.delivery_partner_id,
				u.name AS farmer_name,
				u.phone AS farmer_phone,
				u.address AS farmer_address,
				bu.name AS buyer_name,
				bu.phone AS buyer_phone,
				bu.address AS buyer_address,
				s.created_at,
				d.id AS delivery_id,
				d.status AS delivery_status,
				d.estimated_time
			FROM suborders s
			JOIN orders o ON o.id = s.parent_order_id
			JOIN users u ON u.id = s.farmer_id
			JOIN users bu ON bu.id = o.buyer_id
			LEFT JOIN deliveries d ON d.suborder_id = s.id
			WHERE s.fulfillment_type = 'delivery_partner'
			  AND s.fulfillment_status IN ('pending', 'accepted', 'packed', 'ready_for_pickup')
			  AND s.delivery_partner_id IS NULL
			ORDER BY s.id ASC
		`
	);

	return result.rows;
};

const updateDeliveryByOrderId = async (
	client = pool,
	{ order_id, status, estimated_time, pickup_location, delivery_location }
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

const releaseEscrowForSuborder = async (client, suborder_id) => {
	const result = await client.query(
		`
			UPDATE escrow_ledger
			SET release_status = 'cleared',
			    released_at = NOW()
			WHERE suborder_id = $1 AND release_status = 'held'
			RETURNING *
		`,
		[suborder_id]
	);

	return result.rows;
};

const updateOrderDeliveryStatus = async (
	client = pool,
	{ order_id, delivery_status, status }
) => {
	const targetStatus = delivery_status || status;
	const result = await client.query(
		`
			UPDATE orders
			SET order_status = CASE
						WHEN $1 = 'delivered' THEN 'delivered'
						WHEN $1 IN ('shipped', 'in_transit', 'out for delivery') AND order_status IN ('confirmed', 'processing', 'in_transit') THEN 'in_transit'
						ELSE order_status
					END,
				delivery_status = $1
			WHERE id = $2
			RETURNING id, order_status, delivery_status
		`,
		[targetStatus, order_id]
	);

	return result.rows[0] || null;
};

const checkAndCompleteParentOrder = async (client, parent_order_id) => {
	const subordersRes = await client.query(
		`SELECT fulfillment_status FROM suborders WHERE parent_order_id = $1`,
		[parent_order_id]
	);

	const allDelivered = subordersRes.rows.every(
		(s) => s.fulfillment_status === "delivered"
	);

	if (allDelivered && subordersRes.rows.length > 0) {
		await client.query(
			`UPDATE orders
			 SET delivery_status = 'delivered',
			     order_status = 'delivered'
			 WHERE id = $1`,
			[parent_order_id]
		);
	}
};

const getDeliveryByOrderId = async (order_id) => {
	const result = await pool.query(
		`
			SELECT
				d.id,
				d.id AS delivery_id,
				d.order_id,
				d.suborder_id,
				COALESCE(d.delivery_partner_id, d.delivery_person_id) AS delivery_partner_id,
				d.fulfillment_type,
				COALESCE(d.status, d.delivery_status) AS status,
				d.delivery_status,
				d.pickup_verification_code,
				d.delivery_confirmation_code,
				d.pickup_location,
				COALESCE(d.delivery_location, d.delivery_address) AS delivery_location,
				d.estimated_time,
				d.proof_of_delivery_image_url,
				d.farmer_notes,
				d.dispatched_at,
				d.delivered_at,
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
			ORDER BY d.id DESC
		`,
		[order_id]
	);

	return result.rows;
};

const getDeliveryBySuborderId = async (suborder_id) => {
	const result = await pool.query(
		`
			SELECT
				d.id AS delivery_id,
				d.order_id,
				d.suborder_id,
				d.delivery_partner_id,
				u.name AS delivery_partner_name,
				u.phone AS delivery_partner_phone,
				d.fulfillment_type,
				d.status,
				d.delivery_status,
				d.pickup_verification_code,
				d.delivery_confirmation_code,
				d.pickup_location,
				d.delivery_location,
				d.estimated_time,
				d.proof_of_delivery_image_url,
				d.farmer_notes,
				d.dispatched_at,
				d.delivered_at,
				d.created_at,
				o.buyer_id
			FROM deliveries d
			JOIN orders o ON o.id = d.order_id
			LEFT JOIN users u ON u.id = d.delivery_partner_id
			WHERE d.suborder_id = $1
			LIMIT 1
		`,
		[suborder_id]
	);

	return result.rows[0] || null;
};

// Legacy stubs for existing code
const findDeliveryByOrderIdForUpdate = async (client, order_id) => {
	const result = await client.query(
		`SELECT * FROM deliveries WHERE order_id = $1 FOR UPDATE`,
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
	checkAndCompleteParentOrder,
	createDelivery,
	findDeliveriesByPartnerId,
	findDeliveryByIdForUpdate,
	findDeliveryByOrderIdForUpdate,
	findDeliveryBySuborderId,
	findDeliveryPartnerById,
	findOrderById,
	findSuborderById,
	getAvailableDeliveryPool,
	getDeliveryByOrderId,
	getDeliveryBySuborderId,
	releaseEscrowForSuborder,
	updateDeliveryByOrderId,
	updateOrderDeliveryStatus,
	upsertSuborderDelivery,
};
