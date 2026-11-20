const { pool } = require("../config/db");

const findOrderByIdForUpdate = async (client, order_id) => {
	const result = await client.query(
		`
			SELECT
				o.id,
				o.buyer_id,
				o.total_amount,
				o.total_price,
				o.payment_status
			FROM orders o
			WHERE o.id = $1
			FOR UPDATE
		`,
		[order_id]
	);

	return result.rows[0] || null;
};

const createOrUpdatePayment = async (
	client = pool,
	{ order_id, payment_method, amount, payment_status, transaction_id }
) => {
	const result = await client.query(
		`
			INSERT INTO payments (order_id, payment_method, amount, payment_status, transaction_id, created_at)
			VALUES ($1, $2, $3, $4, $5, NOW())
			ON CONFLICT (order_id) DO UPDATE SET
				payment_method = EXCLUDED.payment_method,
				amount = EXCLUDED.amount,
				payment_status = EXCLUDED.payment_status,
				transaction_id = EXCLUDED.transaction_id
			RETURNING id, order_id, payment_method, amount, payment_status, transaction_id, created_at
		`,
		[order_id, payment_method || 'chapa', amount, payment_status || 'paid', transaction_id]
	);

	return result.rows[0];
};

const createPayment = async (client, params) => {
	return createOrUpdatePayment(client, params);
};

const createTransaction = async (
	client = pool,
	{ order_id, user_id, amount, payment_method, status }
) => {
	const result = await client.query(
		`
			INSERT INTO transactions (order_id, user_id, amount, payment_method, status, created_at)
			VALUES ($1, $2, $3, $4, $5, NOW())
			RETURNING id, order_id, user_id, amount, payment_method, status, created_at
		`,
		[order_id, user_id, amount, payment_method || 'chapa', status || 'paid']
	);

	return result.rows[0];
};

const updateOrderPaymentStatus = async (client = pool, { order_id, payment_status }) => {
	await client.query(
		`
			UPDATE orders
			SET payment_status = $1
			WHERE id = $2
		`,
		[payment_status, order_id]
	);

	await client.query(
		`
			UPDATE payments
			SET payment_status = $1
			WHERE order_id = $2
		`,
		[payment_status, order_id]
	);
};

const getPaymentHistoryByBuyer = async (user_id) => {
	const result = await pool.query(
		`
			SELECT
				p.id,
				p.order_id,
				p.payment_method,
				p.amount,
				p.payment_status,
				p.transaction_id,
				p.created_at,
				o.order_status,
				COALESCE(d.delivery_status, 'pending') AS delivery_status,
				o.total_price,
				o.total_amount
			FROM payments p
			JOIN orders o ON o.id = p.order_id
			LEFT JOIN deliveries d ON d.order_id = o.id
			WHERE o.buyer_id = $1
			ORDER BY p.created_at DESC
		`,
		[user_id]
	);

	return result.rows;
};

const getTransactionHistoryByUser = async (user_id) => {
	const result = await pool.query(
		`
			SELECT
				t.id,
				t.order_id,
				t.user_id,
				t.amount,
				t.payment_method,
				t.status,
				t.created_at
			FROM transactions t
			WHERE t.user_id = $1
			ORDER BY t.created_at DESC
		`,
		[user_id]
	);

	return result.rows;
};

module.exports = {
	createPayment,
	createOrUpdatePayment,
	createTransaction,
	findOrderByIdForUpdate,
	getPaymentHistoryByBuyer,
	getTransactionHistoryByUser,
	updateOrderPaymentStatus,
};
