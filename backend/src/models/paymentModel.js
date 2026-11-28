const { pool } = require("../config/db");

const findOrderByIdForUpdate = async (client, order_id) => {
	const result = await client.query(
		`
			SELECT
				o.id,
				o.order_number,
				o.buyer_id,
				o.total_amount,
				o.total_price,
				o.order_status,
				o.payment_status,
				o.delivery_status
			FROM orders o
			WHERE o.id = $1
			FOR UPDATE
		`,
		[order_id]
	);

	return result.rows[0] || null;
};

const findPaymentByReference = async (client, reference) => {
	const result = await client.query(
		`
			SELECT *
			FROM payments
			WHERE reference_number = $1 OR transaction_id = $1
			ORDER BY id DESC
			LIMIT 1
		`,
		[reference]
	);

	return result.rows[0] || null;
};

const findPaymentByIdempotency = async (client, idempotencyKey) => {
	const result = await client.query(
		`
			SELECT *
			FROM payments
			WHERE idempotency_key = $1
			LIMIT 1
		`,
		[idempotencyKey]
	);

	return result.rows[0] || null;
};

const findSubordersForOrder = async (client, order_id) => {
	const result = await client.query(
		`
			SELECT *
			FROM suborders
			WHERE parent_order_id = $1
			ORDER BY id ASC
		`,
		[order_id]
	);

	return result.rows;
};

const createPaymentRecord = async (
	client,
	{
		order_id,
		suborder_id = null,
		payment_method,
		amount,
		payment_status = "pending",
		transaction_id,
		reference_number = null,
		gateway_name = "chapa",
		gateway_response = {},
		idempotency_key = null,
		currency = "ETB",
	}
) => {
	const result = await client.query(
		`
			INSERT INTO payments (
				order_id,
				suborder_id,
				payment_method,
				amount,
				payment_status,
				transaction_id,
				reference_number,
				gateway_name,
				gateway_response,
				idempotency_key,
				currency,
				created_at
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
			ON CONFLICT (order_id) DO UPDATE SET
				suborder_id = COALESCE(EXCLUDED.suborder_id, payments.suborder_id),
				payment_method = EXCLUDED.payment_method,
				amount = EXCLUDED.amount,
				payment_status = EXCLUDED.payment_status,
				transaction_id = EXCLUDED.transaction_id,
				reference_number = COALESCE(EXCLUDED.reference_number, payments.reference_number),
				gateway_name = EXCLUDED.gateway_name,
				gateway_response = EXCLUDED.gateway_response,
				idempotency_key = COALESCE(EXCLUDED.idempotency_key, payments.idempotency_key),
				currency = EXCLUDED.currency,
				reconciled_at = CASE WHEN EXCLUDED.payment_status = 'paid' THEN NOW() ELSE payments.reconciled_at END
			RETURNING *
		`,
		[
			order_id,
			suborder_id,
			payment_method,
			amount,
			payment_status,
			transaction_id,
			reference_number || transaction_id,
			gateway_name,
			gateway_response,
			idempotency_key,
			currency,
		]
	);

	return result.rows[0];
};

const createOrUpdatePayment = async (client = pool, params) => {
	return createPaymentRecord(client, params);
};

const createPayment = async (client = pool, params) => {
	return createPaymentRecord(client, params);
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

const updatePaymentStatus = async (
	client,
	{ payment_id, payment_status, reference_number, gateway_response, reconciled = true }
) => {
	const result = await client.query(
		`
			UPDATE payments
			SET payment_status = $1,
			    reference_number = COALESCE($2, reference_number),
			    gateway_response = COALESCE($3, gateway_response),
			    reconciled_at = CASE WHEN $4 THEN NOW() ELSE reconciled_at END
			WHERE id = $5
			RETURNING *
		`,
		[payment_status, reference_number, gateway_response, reconciled, payment_id]
	);

	return result.rows[0] || null;
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

const createEscrowEntry = async (
	client,
	{
		order_id,
		suborder_id,
		branch_id = null,
		buyer_id,
		farmer_id,
		escrow_amount,
		product_subtotal = null,
		buyer_delivery_fee = 0,
		driver_payout_amount = 0,
		platform_logistics_fee = 0,
		fulfillment_type = "farmer_pickup",
		platform_fee_pct = 0.05,
		notes = null,
	}
) => {
	const escrowNum = Number(escrow_amount);
	const prodSubtotal = product_subtotal !== null ? Number(product_subtotal) : escrowNum;
	const buyerDeliveryFee = Number(buyer_delivery_fee || 0);
	const driverPayout = fulfillment_type === "delivery_partner" ? Number(driver_payout_amount || 0) : 0;
	const platformLogistics =
		fulfillment_type === "delivery_partner"
			? Math.max(0, Number((buyerDeliveryFee - driverPayout).toFixed(2)))
			: 0;
	const platformFee = Number((prodSubtotal * platform_fee_pct).toFixed(2));
	const farmerGross = fulfillment_type === "farmer_delivery" ? prodSubtotal + buyerDeliveryFee : prodSubtotal;
	const farmerPayout = Number(Math.max(0, farmerGross - platformFee).toFixed(2));

	const result = await client.query(
		`
			INSERT INTO escrow_ledger (
				order_id,
				suborder_id,
				branch_id,
				buyer_id,
				farmer_id,
				escrow_amount,
				product_subtotal,
				buyer_delivery_fee,
				driver_payout_amount,
				platform_logistics_fee,
				platform_fee_amount,
				farmer_payout_amount,
				buyer_refund_amount,
				hold_until,
				release_status,
				notes,
				created_at
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0.00, NOW() + INTERVAL '7 days', 'held', $13, NOW())
			RETURNING *
		`,
		[
			order_id,
			suborder_id,
			branch_id,
			buyer_id,
			farmer_id,
			escrowNum,
			prodSubtotal,
			buyerDeliveryFee,
			driverPayout,
			platformLogistics_or_param(platformLogistics, platform_logistics_fee, fulfillment_type),
			platformFee,
			farmerPayout,
			notes || `Escrow held for suborder #${suborder_id}`,
		]
	);

	return result.rows[0];
};

function platformLogistics_or_param(computed, param, fulfillment_type) {
	if (fulfillment_type !== "delivery_partner") return 0;
	return param !== undefined && param !== null && Number(param) > 0 ? Number(param) : computed;
}

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
				p.reference_number,
				p.gateway_name,
				p.created_at,
				o.order_number,
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
	createEscrowEntry,
	createPaymentRecord,
	createPayment,
	createOrUpdatePayment,
	createTransaction,
	findOrderByIdForUpdate,
	findPaymentByIdempotency,
	findPaymentByReference,
	findSubordersForOrder,
	getPaymentHistoryByBuyer,
	getTransactionHistoryByUser,
	updateOrderPaymentStatus,
	updatePaymentStatus,
};
