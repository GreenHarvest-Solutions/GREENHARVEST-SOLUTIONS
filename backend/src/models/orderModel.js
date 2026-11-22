const { pool } = require("../config/db");

const formatOrderRows = (rows) => {
	const ordersMap = new Map();

	rows.forEach((row) => {
		if (!ordersMap.has(row.order_id)) {
			ordersMap.set(row.order_id, {
				id: row.order_id,
				order_number: row.order_number || `ORD-${String(row.order_id).padStart(6, '0')}`,
				buyer_id: row.buyer_id,
				buyer_name: row.buyer_name,
				buyer_email: row.buyer_email,
				address_id: row.address_id,
				total_price: row.total_price,
				total_amount: row.total_amount,
				order_status: row.order_status,
				payment_status: row.payment_status,
				delivery_status: row.delivery_status,
				created_at: row.created_at,
				items: [],
				suborders: [],
			});
		}

		if (row.order_item_id) {
			const items = ordersMap.get(row.order_id).items;
			if (!items.some((i) => i.id === row.order_item_id)) {
				items.push({
					id: row.order_item_id,
					suborder_id: row.suborder_id,
					product_id: row.product_id,
					quantity: row.quantity,
					price: row.price,
					unit: row.unit || 'kg',
					product_name: row.order_item_product_name || row.product_name,
					image_url: row.order_item_image_url || row.image_url,
					farm_location: row.farm_location,
					farmer_id: row.order_item_farmer_id || row.farmer_id,
					farmer_name: row.order_item_farmer_name || row.farmer_name,
				});
			}
		}

		if (row.suborder_id) {
			const suborders = ordersMap.get(row.order_id).suborders;
			if (!suborders.some((s) => s.id === row.suborder_id)) {
				suborders.push({
					id: row.suborder_id,
					suborder_number: row.suborder_number,
					farmer_id: row.suborder_farmer_id,
					farmer_name: row.suborder_farmer_name,
					subtotal: row.suborder_subtotal,
					shipping_fee: row.suborder_shipping_fee,
					total_amount: row.suborder_total_amount,
					fulfillment_type: row.fulfillment_type,
					fulfillment_status: row.fulfillment_status,
					pickup_code: row.pickup_code,
				});
			}
		}
	});

	return Array.from(ordersMap.values());
};

const getOrdersForBuyer = async (buyer_id, order_id = null) => {
	const values = [buyer_id];
	let filter = "o.id IS NOT NULL AND o.buyer_id = $1";

	if (order_id !== null) {
		values.push(order_id);
		filter += " AND o.id = $2";
	}

	const result = await pool.query(
		`
			SELECT
				o.id AS order_id,
				o.order_number,
				o.buyer_id,
				bu.name AS buyer_name,
				bu.email AS buyer_email,
				o.address_id,
				o.total_price,
				o.total_amount,
				o.order_status,
				o.payment_status,
				o.delivery_status,
				o.created_at,
				oi.id AS order_item_id,
				oi.suborder_id,
				oi.product_id,
				oi.quantity,
				oi.price,
				oi.product_name AS order_item_product_name,
				oi.product_image_url AS order_item_image_url,
				oi.unit,
				oi.farmer_id AS order_item_farmer_id,
				oi.farmer_name AS order_item_farmer_name,
				p.name AS product_name,
				COALESCE(p.image_url, pi.image_url) AS image_url,
				p.farm_location,
				p.farmer_id,
				u.name AS farmer_name,
				so.id AS suborder_id,
				so.suborder_number,
				so.farmer_id AS suborder_farmer_id,
				so_u.name AS suborder_farmer_name,
				so.subtotal AS suborder_subtotal,
				so.shipping_fee AS suborder_shipping_fee,
				so.total_amount AS suborder_total_amount,
				so.fulfillment_type,
				so.fulfillment_status,
				so.pickup_code
			FROM orders o
			JOIN users bu ON bu.id = o.buyer_id
			LEFT JOIN order_items oi ON oi.order_id = o.id
			LEFT JOIN products p ON p.id = oi.product_id
			LEFT JOIN users u ON u.id = p.farmer_id
			LEFT JOIN LATERAL (
				SELECT image_url
				FROM product_images
				WHERE product_id = p.id
				ORDER BY image_id ASC
				LIMIT 1
			) pi ON TRUE
			LEFT JOIN suborders so ON so.parent_order_id = o.id
			LEFT JOIN users so_u ON so_u.id = so.farmer_id
			WHERE ${filter}
			ORDER BY o.created_at DESC, oi.id ASC
		`,
		values
	);

	return formatOrderRows(result.rows);
};

const findProductSupplyChainById = async (client, product_id) => {
	const result = await client.query(
		`
			SELECT
				p.id AS product_id,
				p.farmer_id,
				af.agent_id AS field_agent_id
			FROM products p
			LEFT JOIN agent_farmers af ON af.farmer_id = p.farmer_id
			WHERE p.id = $1
			ORDER BY af.id DESC NULLS LAST
			LIMIT 1
		`,
		[product_id]
	);

	return result.rows[0] || null;
};

const createOrderRecord = async (
	client,
	{ buyer_id, total_amount, address_id = null, order_number = null }
) => {
	const orderNumber = order_number || `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
	const result = await client.query(
		`
			INSERT INTO orders (
				order_number,
				buyer_id,
				address_id,
				total_amount,
				total_price,
				order_status,
				payment_status,
				delivery_status
			)
			VALUES ($1, $2, $3, $4, $4, 'pending', 'pending', 'pending')
			RETURNING
				id,
				order_number,
				buyer_id,
				address_id,
				total_price,
				total_amount,
				order_status,
				payment_status,
				delivery_status,
				created_at
		`,
		[orderNumber, buyer_id, address_id, total_amount]
	);

	return result.rows[0];
};

const createSuborderRecord = async (
	client,
	{
		parent_order_id,
		farmer_id,
		suborder_number,
		subtotal,
		shipping_fee = 0.0,
		total_amount,
		fulfillment_type = "farmer_pickup",
		pickup_code = null,
		notes = null,
	}
) => {
	const result = await client.query(
		`
			INSERT INTO suborders (
				parent_order_id,
				farmer_id,
				suborder_number,
				subtotal,
				shipping_fee,
				total_amount,
				fulfillment_type,
				fulfillment_status,
				pickup_code,
				notes
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9)
			RETURNING *
		`,
		[
			parent_order_id,
			farmer_id,
			suborder_number,
			subtotal,
			shipping_fee,
			total_amount,
			fulfillment_type,
			pickup_code,
			notes,
		]
	);

	return result.rows[0];
};

const createOrderItemRecord = async (
	client,
	{
		order_id,
		suborder_id = null,
		product_id,
		quantity,
		price,
		product_name = null,
		product_image_url = null,
		unit = "kg",
		unit_price = null,
		farmer_id = null,
		farmer_name = null,
	}
) => {
	const result = await client.query(
		`
			INSERT INTO order_items (
				order_id,
				suborder_id,
				product_id,
				quantity,
				price,
				product_name,
				product_image_url,
				unit,
				unit_price,
				farmer_id,
				farmer_name
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
			RETURNING *
		`,
		[
			order_id,
			suborder_id,
			product_id,
			quantity,
			price,
			product_name,
			product_image_url,
			unit || "kg",
			unit_price !== null && unit_price !== undefined ? unit_price : price,
			farmer_id,
			farmer_name,
		]
	);

	return result.rows[0];
};

const getSubordersByOrderId = async (orderId, client = pool) => {
	const result = await client.query(
		`
			SELECT
				s.*,
				u.name AS farmer_name,
				u.email AS farmer_email,
				u.phone AS farmer_phone,
				fp.pickup_address,
				fp.pickup_instructions
			FROM suborders s
			JOIN users u ON u.id = s.farmer_id
			LEFT JOIN farmer_profiles fp ON fp.user_id = s.farmer_id
			WHERE s.parent_order_id = $1
			ORDER BY s.id ASC
		`,
		[orderId]
	);

	return result.rows;
};

const getSubordersForFarmer = async (
	farmerId,
	{ page = 1, limit = 10, status = null, search = null } = {}
) => {
	const parsedPage = Math.max(1, parseInt(page, 10) || 1);
	const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
	const offset = (parsedPage - 1) * parsedLimit;
	const values = [farmerId];
	let paramIdx = 2;

	let statusFilter = "";
	if (status && status !== "all") {
		statusFilter = ` AND s.fulfillment_status = $${paramIdx}`;
		values.push(status);
		paramIdx++;
	}

	let searchFilter = "";
	if (search) {
		searchFilter = ` AND (s.suborder_number ILIKE $${paramIdx} OR CAST(s.id AS TEXT) LIKE $${paramIdx} OR u.name ILIKE $${paramIdx})`;
		values.push(`%${search}%`);
		paramIdx++;
	}

	const countRes = await pool.query(
		`
			SELECT COUNT(*)::int AS total
			FROM suborders s
			JOIN orders o ON o.id = s.parent_order_id
			JOIN users u ON u.id = o.buyer_id
			WHERE s.farmer_id = $1 ${statusFilter} ${searchFilter}
		`,
		values
	);

	values.push(parsedLimit, offset);
	const dataRes = await pool.query(
		`
			SELECT
				s.*,
				o.order_number,
				o.order_status,
				o.payment_status,
				u.name AS buyer_name,
				u.email AS buyer_email,
				u.phone AS buyer_phone,
				(
					SELECT json_agg(
						json_build_object(
							'id', oi.id,
							'product_id', oi.product_id,
							'product_name', oi.product_name,
							'quantity', oi.quantity,
							'price', oi.price,
							'unit', oi.unit,
							'image_url', oi.product_image_url
						)
					)
					FROM order_items oi
					WHERE oi.suborder_id = s.id
				) AS items
			FROM suborders s
			JOIN orders o ON o.id = s.parent_order_id
			JOIN users u ON u.id = o.buyer_id
			WHERE s.farmer_id = $1 ${statusFilter} ${searchFilter}
			ORDER BY s.created_at DESC
			LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
		`,
		values
	);

	const total = countRes.rows[0].total;

	return {
		suborders: dataRes.rows,
		pagination: {
			page: parsedPage,
			limit: parsedLimit,
			total,
			total_pages: Math.ceil(total / parsedLimit),
		},
	};
};

const updateSuborderStatus = async (suborderId, fulfillmentStatus, farmerId = null) => {
	const values = [fulfillmentStatus, suborderId];
	let farmerCheck = "";
	if (farmerId) {
		farmerCheck = " AND farmer_id = $3";
		values.push(farmerId);
	}

	const result = await pool.query(
		`
			UPDATE suborders
			SET fulfillment_status = $1, updated_at = NOW()
			WHERE id = $2 ${farmerCheck}
			RETURNING *
		`,
		values
	);

	return result.rows[0] || null;
};

const findOrderById = async (order_id, client = pool) => {
	const result = await client.query(
		`
			SELECT
				id,
				order_number,
				buyer_id,
				address_id,
				total_price,
				total_amount,
				order_status,
				payment_status,
				delivery_status,
				created_at
			FROM orders
			WHERE id = $1
		`,
		[order_id]
	);

	return result.rows[0] || null;
};

const assignDeliveryPartnerById = async (order_id, delivery_partner_id, client = pool) => {
	const result = await client.query(
		`
			UPDATE orders
			SET delivery_partner_id = $2,
					delivery_status = 'assigned'
			WHERE id = $1
			RETURNING
				id,
				order_number,
				buyer_id,
				address_id,
				total_price,
				total_amount,
				order_status,
				payment_status,
				delivery_partner_id,
				delivery_status,
				created_at
		`,
		[order_id, delivery_partner_id]
	);

	return result.rows[0] || null;
};

const updateOrderStatusById = async (order_id, order_status, client = pool) => {
	const result = await client.query(
		`
			UPDATE orders
			SET order_status = $1
			WHERE id = $2
			RETURNING
				id,
				order_number,
				buyer_id,
				address_id,
				total_price,
				total_amount,
				order_status,
				payment_status,
				delivery_status,
				created_at
		`,
		[order_status, order_id]
	);

	return result.rows[0] || null;
};

const decrementProductStock = async (client, product_id, quantity) => {
	// Updates authoritative inventory table (trigger keeps products.stock in sync)
	const invResult = await client.query(
		`
			UPDATE inventory
			SET quantity = quantity - $1,
					last_updated = NOW()
			WHERE product_id = $2
			RETURNING product_id AS id, quantity AS stock
		`,
		[quantity, product_id]
	);

	if (invResult.rows[0]) {
		return invResult.rows[0];
	}

	const prodResult = await client.query(
		`
			UPDATE products
			SET stock = stock - $1
			WHERE id = $2
			RETURNING id, stock
		`,
		[quantity, product_id]
	);

	return prodResult.rows[0] || null;
};

const updateOrderStatusesById = async (
	order_id,
	{ order_status, payment_status, delivery_status }
) => {
	if (order_status !== null && order_status !== undefined) {
		await pool.query(
			`UPDATE orders SET order_status = $1 WHERE id = $2`,
			[order_status, order_id]
		);
	}

	if (payment_status !== null && payment_status !== undefined) {
		await pool.query(
			`UPDATE orders SET payment_status = $1 WHERE id = $2`,
			[payment_status, order_id]
		);
	}

	if (delivery_status !== null && delivery_status !== undefined) {
		await pool.query(
			`UPDATE orders SET delivery_status = $1 WHERE id = $2`,
			[delivery_status, order_id]
		);
	}

	const result = await pool.query(
		`
			SELECT
				o.id,
				o.order_number,
				o.buyer_id,
				o.total_price,
				o.total_amount,
				o.order_status,
				o.payment_status,
				o.delivery_status,
				o.created_at
			FROM orders o
			WHERE o.id = $1
		`,
		[order_id]
	);

	return result.rows[0] || null;
};

module.exports = {
	assignDeliveryPartnerById,
	createOrderItemRecord,
	createOrderRecord,
	createSuborderRecord,
	decrementProductStock,
	findOrderById,
	findProductSupplyChainById,
	formatOrderRows,
	getOrdersForBuyer,
	getSubordersByOrderId,
	getSubordersForFarmer,
	updateOrderStatusById,
	updateOrderStatusesById,
	updateSuborderStatus,
};
