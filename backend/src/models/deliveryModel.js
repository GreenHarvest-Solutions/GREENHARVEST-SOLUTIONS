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
			SELECT s.*, o.buyer_id, o.order_number,
			       u.name AS farmer_name, u.phone AS farmer_phone, u.address AS farmer_address,
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
			SELECT u.id, dp.profile_id, u.name, u.email, u.phone,
			       dp.vehicle_type, dp.vehicle_plate, dp.license_number,
			       dp.operating_region, dp.verification_status, dp.trust_score,
			       COALESCE(r.name, u.role, '') AS role_name
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

const getOrCreatePartnerProfile = async (client, user_id) => {
	const existing = await client.query(
		`SELECT dp.*, u.name, u.email, u.phone, u.address
		 FROM delivery_profiles dp
		 JOIN users u ON u.id = dp.user_id
		 WHERE dp.user_id = $1
		 LIMIT 1`,
		[user_id]
	);
	if (existing.rows[0]) return existing.rows[0];

	await client.query(
		`INSERT INTO delivery_profiles (user_id, verification_status, trust_score)
		 VALUES ($1, 'unverified', 5.00)
		 ON CONFLICT (user_id) DO NOTHING`,
		[user_id]
	);

	const created = await client.query(
		`SELECT dp.*, u.name, u.email, u.phone, u.address
		 FROM delivery_profiles dp
		 JOIN users u ON u.id = dp.user_id
		 WHERE dp.user_id = $1
		 LIMIT 1`,
		[user_id]
	);
	return created.rows[0] || null;
};

const upsertPartnerProfile = async (
	user_id,
	{
		vehicle_type,
		vehicle_plate,
		vehicle_capacity_kg,
		license_number,
		national_id_number,
		operating_region,
		id_document_url,
		license_document_url,
	}
) => {
	await pool.query(
		`
			INSERT INTO delivery_profiles (
				user_id, vehicle_type, vehicle_plate, vehicle_capacity_kg,
				license_number, national_id_number, operating_region,
				id_document_url, license_document_url,
				verification_status, updated_at
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending_review', NOW())
			ON CONFLICT (user_id)
			DO UPDATE SET
				vehicle_type = COALESCE(EXCLUDED.vehicle_type, delivery_profiles.vehicle_type),
				vehicle_plate = COALESCE(EXCLUDED.vehicle_plate, delivery_profiles.vehicle_plate),
				vehicle_capacity_kg = COALESCE(EXCLUDED.vehicle_capacity_kg, delivery_profiles.vehicle_capacity_kg),
				license_number = COALESCE(EXCLUDED.license_number, delivery_profiles.license_number),
				national_id_number = COALESCE(EXCLUDED.national_id_number, delivery_profiles.national_id_number),
				operating_region = COALESCE(EXCLUDED.operating_region, delivery_profiles.operating_region),
				id_document_url = COALESCE(EXCLUDED.id_document_url, delivery_profiles.id_document_url),
				license_document_url = COALESCE(EXCLUDED.license_document_url, delivery_profiles.license_document_url),
				verification_status = CASE
					WHEN delivery_profiles.verification_status = 'suspended' THEN 'suspended'
					ELSE 'pending_review'
				END,
				updated_at = NOW()
		`,
		[
			user_id,
			vehicle_type || null,
			vehicle_plate || null,
			vehicle_capacity_kg ? Number(vehicle_capacity_kg) : 500,
			license_number || null,
			national_id_number || null,
			operating_region || null,
			id_document_url || null,
			license_document_url || null,
		]
	);

	return getOrCreatePartnerProfile(pool, user_id);
};

const listPartnerProfilesAdmin = async ({ status = null, search = null } = {}) => {
	const conditions = [
		`LOWER(COALESCE(r.role_name, u.role, '')) IN ('delivery_partner', 'delivery', 'deliverypartner')`,
	];
	const params = [];

	if (status && status !== "all") {
		params.push(status);
		conditions.push(`COALESCE(dp.verification_status, 'unverified') = $${params.length}`);
	}
	if (search && search.trim()) {
		params.push(`%${search.trim().toLowerCase()}%`);
		const sIdx = params.length;
		conditions.push(
			`(LOWER(u.name) LIKE $${sIdx} OR LOWER(u.email) LIKE $${sIdx} OR LOWER(COALESCE(dp.vehicle_plate, '')) LIKE $${sIdx})`
		);
	}

	const res = await pool.query(
		`
			SELECT
				u.id AS user_id,
				u.name,
				u.email,
				u.phone,
				u.account_status,
				u.created_at,
				dp.profile_id,
				dp.vehicle_type,
				dp.vehicle_plate,
				dp.vehicle_capacity_kg,
				dp.license_number,
				dp.national_id_number,
				dp.operating_region,
				dp.id_document_url,
				dp.license_document_url,
				COALESCE(dp.verification_status, 'unverified') AS verification_status,
				dp.verification_notes,
				dp.verified_at,
				COALESCE(dp.trust_score, 5.00)::numeric(3,2) AS trust_score,
				COALESCE(dp.completed_deliveries, 0) AS completed_deliveries,
				COALESCE(dp.cancelled_deliveries, 0) AS cancelled_deliveries,
				COALESCE(dp.rating_count, 0) AS rating_count
			FROM users u
			LEFT JOIN roles r ON r.role_id = u.role_id
			LEFT JOIN delivery_profiles dp ON dp.user_id = u.id
			WHERE ${conditions.join(" AND ")}
			ORDER BY
				CASE COALESCE(dp.verification_status, 'unverified')
					WHEN 'pending_review' THEN 1
					WHEN 'unverified' THEN 2
					WHEN 'verified' THEN 3
					ELSE 4
				END,
				u.created_at DESC
		`,
		params
	);

	return res.rows;
};

const updatePartnerVerificationAdmin = async ({ user_id, status, notes = null }) => {
	await pool.query(
		`
			INSERT INTO delivery_profiles (user_id, verification_status, verification_notes, verified_at, updated_at)
			VALUES ($1, $2, $3, CASE WHEN $2 = 'verified' THEN NOW() ELSE NULL END, NOW())
			ON CONFLICT (user_id)
			DO UPDATE SET
				verification_status = EXCLUDED.verification_status,
				verification_notes = COALESCE(EXCLUDED.verification_notes, delivery_profiles.verification_notes),
				verified_at = CASE WHEN EXCLUDED.verification_status = 'verified' THEN NOW() ELSE delivery_profiles.verified_at END,
				updated_at = NOW()
		`,
		[user_id, status, notes]
	);

	if (status === "verified") {
		await pool.query(`UPDATE users SET is_verified = TRUE WHERE id = $1`, [user_id]);
	}

	return getOrCreatePartnerProfile(pool, user_id);
};

const recordDeliveryEvent = async (
	client = pool,
	{
		delivery_id = null,
		suborder_id = null,
		order_id,
		event_type,
		status = null,
		title,
		description = null,
		location_name = null,
		latitude = null,
		longitude = null,
		actor_id = null,
		actor_role = null,
	}
) => {
	const result = await client.query(
		`
			INSERT INTO delivery_events (
				delivery_id, suborder_id, order_id, event_type, status,
				title, description, location_name, latitude, longitude,
				actor_id, actor_role
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
			RETURNING *
		`,
		[
			delivery_id,
			suborder_id,
			order_id,
			event_type,
			status,
			title,
			description,
			location_name,
			latitude,
			longitude,
			actor_id,
			actor_role,
		]
	);
	return result.rows[0];
};

const getEventsByOrderId = async (order_id) => {
	const result = await pool.query(
		`
			SELECT de.*, u.name AS actor_name
			FROM delivery_events de
			LEFT JOIN users u ON u.id = de.actor_id
			WHERE de.order_id = $1
			ORDER BY de.created_at ASC, de.id ASC
		`,
		[order_id]
	);
	return result.rows;
};

const getEventsBySuborderId = async (suborder_id) => {
	const result = await pool.query(
		`
			SELECT de.*, u.name AS actor_name
			FROM delivery_events de
			LEFT JOIN users u ON u.id = de.actor_id
			WHERE de.suborder_id = $1
			ORDER BY de.created_at ASC, de.id ASC
		`,
		[suborder_id]
	);
	return result.rows;
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
		branch_id = null,
		delivery_quote_id = null,
		zone_id = null,
		driver_compensation_amount = null,
		platform_logistics_fee = null,
		pricing_rule_version = null,
		distance_source = null,
		is_estimated_fallback = null,
		consolidation_group_id = null,
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
		distance_km = null,
		total_weight_kg = null,
		fee_breakdown = null,
		vehicle_plate = null,
		current_checkpoint = null,
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
					branch_id = COALESCE($1, branch_id),
					delivery_quote_id = COALESCE($2, delivery_quote_id),
					zone_id = COALESCE($3, zone_id),
					driver_compensation_amount = COALESCE($4, driver_compensation_amount),
					platform_logistics_fee = COALESCE($5, platform_logistics_fee),
					pricing_rule_version = COALESCE($6, pricing_rule_version),
					distance_source = COALESCE($7, distance_source),
					is_estimated_fallback = COALESCE($8, is_estimated_fallback),
					consolidation_group_id = COALESCE($9, consolidation_group_id),
					fulfillment_type = COALESCE($10, fulfillment_type),
					status = COALESCE($11, status),
					delivery_status = COALESCE($11, delivery_status),
					delivery_partner_id = COALESCE($12, delivery_partner_id),
					delivery_person_id = COALESCE($12, delivery_person_id),
					pickup_verification_code = COALESCE($13, pickup_verification_code),
					delivery_confirmation_code = COALESCE($14, delivery_confirmation_code),
					pickup_location = COALESCE($15, pickup_location),
					delivery_location = COALESCE($16, delivery_location),
					delivery_address = COALESCE($16, delivery_address),
					estimated_time = COALESCE($17, estimated_time),
					farmer_notes = COALESCE($18, farmer_notes),
					proof_of_delivery_image_url = COALESCE($19, proof_of_delivery_image_url),
					distance_km = COALESCE($20, distance_km),
					total_weight_kg = COALESCE($21, total_weight_kg),
					fee_breakdown = COALESCE($22, fee_breakdown),
					vehicle_plate = COALESCE($23, vehicle_plate),
					current_checkpoint = COALESCE($24, current_checkpoint)
				WHERE id = $25
				RETURNING *
			`,
			[
				branch_id,
				delivery_quote_id,
				zone_id,
				driver_compensation_amount,
				platform_logistics_fee,
				pricing_rule_version,
				distance_source,
				is_estimated_fallback,
				consolidation_group_id,
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
				distance_km,
				total_weight_kg,
				fee_breakdown ? JSON.stringify(fee_breakdown) : null,
				vehicle_plate,
				current_checkpoint,
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
				branch_id,
				delivery_quote_id,
				zone_id,
				driver_compensation_amount,
				platform_logistics_fee,
				pricing_rule_version,
				distance_source,
				is_estimated_fallback,
				consolidation_group_id,
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
				distance_km,
				total_weight_kg,
				fee_breakdown,
				vehicle_plate,
				current_checkpoint,
				created_at
			)
			VALUES ($1, $2, $3, $4, $5, COALESCE($6::numeric, 0.00), COALESCE($7::numeric, 0.00), COALESCE($8::integer, 1), COALESCE($9::varchar, 'corridor_fallback'), COALESCE($10::boolean, TRUE), $11, $12, $12, $13, $14, $14, $15, $16, $17, $18, $18, $19, $20, $21, $22, $23, $24, $25, $26, NOW())
			RETURNING *
		`,
		[
			order_id,
			suborder_id,
			branch_id,
			delivery_quote_id,
			zone_id,
			driver_compensation_amount,
			platform_logistics_fee,
			pricing_rule_version,
			distance_source,
			is_estimated_fallback,
			consolidation_group_id,
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
			distance_km,
			total_weight_kg,
			fee_breakdown ? JSON.stringify(fee_breakdown) : "{}",
			vehicle_plate,
			current_checkpoint,
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
				COALESCE(d.pickup_location, u.address, 'Farm Gate') AS farmer_address,
				bu.name AS buyer_name,
				bu.phone AS buyer_phone,
				COALESCE(d.delivery_location, d.delivery_address, bu.address, 'Customer Address') AS buyer_address,
				s.created_at,
				d.id AS delivery_id,
				d.status AS delivery_status,
				d.estimated_time,
				d.distance_km,
				d.total_weight_kg,
				d.fee_breakdown
			FROM suborders s
			JOIN orders o ON o.id = s.parent_order_id
			JOIN users u ON u.id = s.farmer_id
			JOIN users bu ON bu.id = o.buyer_id
			LEFT JOIN deliveries d ON d.suborder_id = s.id
			WHERE s.fulfillment_type = 'delivery_partner'
			  AND s.fulfillment_status IN ('pending', 'accepted', 'packed', 'ready_for_pickup')
			  AND s.delivery_partner_id IS NULL
			  AND o.order_status <> 'cancelled'
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

const getDeliveryByOrderId = async (order_id, { includeSecretCodes = true } = {}) => {
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
				${includeSecretCodes ? "d.delivery_confirmation_code," : "NULL::text AS delivery_confirmation_code,"}
				d.pickup_location,
				COALESCE(d.delivery_location, d.delivery_address) AS delivery_location,
				d.estimated_time,
				d.proof_of_delivery_image_url,
				d.farmer_notes,
				d.distance_km,
				d.total_weight_kg,
				d.fee_breakdown,
				COALESCE(d.vehicle_plate, dp.vehicle_plate) AS vehicle_plate,
				dp.vehicle_type,
				COALESCE(dp.verification_status, 'unverified') AS partner_verification_status,
				COALESCE(dp.trust_score, 5.00)::numeric(3,2) AS partner_trust_score,
				COALESCE(dp.completed_deliveries, 0) AS partner_completed_deliveries,
				d.current_checkpoint,
				d.last_latitude,
				d.last_longitude,
				d.buyer_confirmed_at,
				d.buyer_rating,
				d.buyer_feedback,
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
			LEFT JOIN delivery_profiles dp ON dp.user_id = u.id
			WHERE d.order_id = $1
			ORDER BY d.id DESC
		`,
		[order_id]
	);

	return result.rows;
};

const getDeliveryBySuborderId = async (suborder_id, { includeSecretCodes = true } = {}) => {
	const result = await pool.query(
		`
			SELECT
				d.id AS delivery_id,
				d.order_id,
				d.suborder_id,
				d.delivery_partner_id,
				u.name AS delivery_partner_name,
				u.phone AS delivery_partner_phone,
				COALESCE(d.vehicle_plate, dp.vehicle_plate) AS vehicle_plate,
				dp.vehicle_type,
				COALESCE(dp.verification_status, 'unverified') AS partner_verification_status,
				COALESCE(dp.trust_score, 5.00)::numeric(3,2) AS partner_trust_score,
				d.fulfillment_type,
				d.status,
				d.delivery_status,
				d.pickup_verification_code,
				${includeSecretCodes ? "d.delivery_confirmation_code," : "NULL::text AS delivery_confirmation_code,"}
				d.pickup_location,
				COALESCE(d.delivery_location, d.delivery_address) AS delivery_location,
				d.estimated_time,
				d.proof_of_delivery_image_url,
				d.farmer_notes,
				d.distance_km,
				d.total_weight_kg,
				d.fee_breakdown,
				d.current_checkpoint,
				d.last_latitude,
				d.last_longitude,
				d.buyer_rating,
				d.buyer_feedback,
				d.dispatched_at,
				d.delivered_at,
				d.created_at,
				o.buyer_id
			FROM deliveries d
			JOIN orders o ON o.id = d.order_id
			LEFT JOIN users u ON u.id = d.delivery_partner_id
			LEFT JOIN delivery_profiles dp ON dp.user_id = u.id
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
	// NOTE: Intentionally omits delivery_confirmation_code so couriers must obtain it from the buyer
	const result = await pool.query(
		`
			SELECT
				d.id,
				d.id AS delivery_id,
				d.order_id,
				d.suborder_id,
				s.suborder_number,
				s.fulfillment_type,
				s.fulfillment_status,
				s.shipping_fee,
				s.total_amount AS suborder_total,
				o.order_number,
				d.delivery_partner_id,
				COALESCE(d.pickup_location, fu.address, 'Farm Gate') AS pickup_location,
				COALESCE(d.delivery_location, d.delivery_address, u.address, 'Customer Address') AS delivery_location,
				COALESCE(d.status, d.delivery_status) AS status,
				d.estimated_time,
				d.distance_km,
				d.total_weight_kg,
				d.current_checkpoint,
				d.proof_of_delivery_image_url,
				d.farmer_notes,
				d.delivered_at,
				d.created_at,
				o.order_status,
				o.total_amount,
				fu.name AS farmer_name,
				fu.phone AS farmer_phone,
				u.name AS buyer_name,
				u.phone AS buyer_phone,
				u.address AS buyer_address,
				(d.delivery_confirmation_code IS NOT NULL) AS requires_buyer_pin
			FROM deliveries d
			JOIN orders o ON o.id = d.order_id
			LEFT JOIN suborders s ON s.id = d.suborder_id
			LEFT JOIN users fu ON fu.id = s.farmer_id
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
	getEventsByOrderId,
	getEventsBySuborderId,
	getOrCreatePartnerProfile,
	listPartnerProfilesAdmin,
	recordDeliveryEvent,
	releaseEscrowForSuborder,
	updateDeliveryByOrderId,
	updateOrderDeliveryStatus,
	updatePartnerVerificationAdmin,
	upsertPartnerProfile,
	upsertSuborderDelivery,
};
