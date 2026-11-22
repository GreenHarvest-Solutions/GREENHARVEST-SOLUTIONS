const { pool } = require("../config/db");

const upsertInventory = async ({ product_id, farmer_id, quantity }) => {
	const result = await pool.query(
		`
			INSERT INTO inventory (product_id, farmer_id, quantity, last_updated)
			VALUES ($1, $2, $3, NOW())
			ON CONFLICT (product_id)
			DO UPDATE
			SET quantity = EXCLUDED.quantity,
					last_updated = NOW()
			RETURNING id, product_id, quantity, last_updated
		`,
		[product_id, farmer_id, quantity]
	);

	return result.rows[0];
};

const getInventoryByProductId = async (product_id) => {
	const result = await pool.query(
		`
			SELECT
				i.id,
				i.product_id,
				p.farmer_id,
				i.quantity,
				i.last_updated,
				p.name AS product_name,
				p.price AS product_price,
				u.name AS farmer_name
			FROM inventory i
			JOIN products p ON p.id = i.product_id
			JOIN users u ON u.id = p.farmer_id
			WHERE i.product_id = $1
		`,
		[product_id]
	);

	return result.rows[0] || null;
};

const findInventoryForUpdate = async (client, productId) => {
	const result = await client.query(
		`SELECT id, product_id, farmer_id, quantity, last_updated 
		 FROM inventory 
		 WHERE product_id = $1 
		 FOR UPDATE`,
		[productId]
	);
	return result.rows[0] || null;
};

const decrementInventoryStock = async (client, productId, quantity) => {
	const result = await client.query(
		`UPDATE inventory 
		 SET quantity = quantity - $1, last_updated = NOW() 
		 WHERE product_id = $2 
		 RETURNING id, product_id, quantity, last_updated`,
		[quantity, productId]
	);
	return result.rows[0] || null;
};

const incrementInventoryStock = async (client, productId, quantity) => {
	const result = await client.query(
		`UPDATE inventory 
		 SET quantity = quantity + $1, last_updated = NOW() 
		 WHERE product_id = $2 
		 RETURNING id, product_id, quantity, last_updated`,
		[quantity, productId]
	);
	return result.rows[0] || null;
};

const createStockReservation = async (client, { orderId, productId, quantity, ttlMinutes = 15 }) => {
	const result = await client.query(
		`INSERT INTO stock_reservations (order_id, product_id, quantity, status, expires_at)
		 VALUES ($1, $2, $3, 'reserved', NOW() + ($4 || ' minutes')::INTERVAL)
		 RETURNING *`,
		[orderId, productId, quantity, ttlMinutes]
	);
	return result.rows[0];
};

const confirmReservations = async (client, orderId) => {
	const result = await client.query(
		`UPDATE stock_reservations
		 SET status = 'consumed'
		 WHERE order_id = $1 AND status = 'reserved'
		 RETURNING *`,
		[orderId]
	);
	return result.rows;
};

const releaseReservationsByOrderId = async (client, orderId) => {
	const resRes = await client.query(
		`SELECT * FROM stock_reservations WHERE order_id = $1 AND status = 'reserved' FOR UPDATE`,
		[orderId]
	);

	for (const r of resRes.rows) {
		await client.query(
			`UPDATE inventory SET quantity = quantity + $1, last_updated = NOW() WHERE product_id = $2`,
			[r.quantity, r.product_id]
		);
	}

	await client.query(
		`UPDATE stock_reservations SET status = 'released' WHERE order_id = $1 AND status = 'reserved'`,
		[orderId]
	);

	return resRes.rows;
};

const releaseExpiredReservations = async (client = pool) => {
	const expiredRes = await client.query(
		`SELECT * FROM stock_reservations WHERE status = 'reserved' AND expires_at < NOW() FOR UPDATE`
	);

	for (const r of expiredRes.rows) {
		await client.query(
			`UPDATE inventory SET quantity = quantity + $1, last_updated = NOW() WHERE product_id = $2`,
			[r.quantity, r.product_id]
		);
		await client.query(
			`UPDATE stock_reservations SET status = 'released' WHERE id = $1`,
			[r.id]
		);
		await client.query(
			`UPDATE orders SET order_status = 'cancelled', notes = COALESCE(notes || '; ', '') || 'Stock reservation expired' WHERE id = $1 AND order_status = 'pending'`,
			[r.order_id]
		);
		await client.query(
			`UPDATE suborders SET fulfillment_status = 'cancelled', notes = COALESCE(notes || '; ', '') || 'Stock reservation expired' WHERE parent_order_id = $1 AND fulfillment_status = 'pending'`,
			[r.order_id]
		);
	}

	return expiredRes.rows;
};

module.exports = {
	confirmReservations,
	createStockReservation,
	decrementInventoryStock,
	findInventoryForUpdate,
	getInventoryByProductId,
	incrementInventoryStock,
	releaseExpiredReservations,
	releaseReservationsByOrderId,
	upsertInventory,
};