const { pool } = require("../config/db");
const auditService = require("../services/auditService");
const kycModel = require("./kycModel");
const user360Model = require("./user360Model");
const productModerationModel = require("./productModerationModel");
const orderAdminModel = require("./orderAdminModel");
const escrowAdminModel = require("./escrowAdminModel");
const disputeAdminModel = require("./disputeAdminModel");
const paymentAdminModel = require("./paymentAdminModel");
const logisticsAdminModel = require("./logisticsAdminModel");
const supportAdminModel = require("./supportAdminModel");
const announcementAdminModel = require("./announcementAdminModel");
const riskAdminModel = require("./riskAdminModel");
const reportAdminModel = require("./reportAdminModel");
const systemHealthAdminModel = require("./systemHealthAdminModel");

const getAdminMe = async (userId) => {
	const result = await pool.query(
		`
			SELECT
				u.id,
				u.name,
				u.email,
				u.role,
				u.account_status,
				u.last_login_at,
				ar.id AS admin_role_id,
				ar.name AS admin_role_name,
				ar.description AS admin_role_description,
				COALESCE(
					json_agg(
						json_build_object(
							'id', p.id,
							'code', p.code,
							'name', p.name,
							'category', p.category
						)
					) FILTER (WHERE p.id IS NOT NULL),
					'[]'::json
				) AS permissions
			FROM users u
			LEFT JOIN admin_roles ar ON ar.id = u.admin_role_id
			LEFT JOIN role_permissions rp ON rp.role_id = ar.id
			LEFT JOIN permissions p ON p.id = rp.permission_id
			WHERE u.id = $1
			GROUP BY u.id, ar.id, ar.name, ar.description
		`,
		[userId]
	);

	if (result.rows.length === 0) {
		return null;
	}

	const user = result.rows[0];
	return {
		id: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
		account_status: user.account_status,
		last_login_at: user.last_login_at,
		admin_role: {
			id: user.admin_role_id,
			name: user.admin_role_name || "super_admin",
			description: user.admin_role_description,
		},
		permissions: Array.isArray(user.permissions) ? user.permissions : [],
	};
};

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
					SELECT COALESCE(SUM(o.total_price), 0)::numeric(12,2)
					FROM orders o
					WHERE o.order_status != 'cancelled'
				) AS total_revenue,
				(
					SELECT COUNT(*)::int
					FROM users
					WHERE last_login_at >= CURRENT_DATE
				) AS active_today,
				(
					SELECT ROUND(COALESCE((COUNT(*) FILTER (WHERE delivery_status = 'delivered' OR order_status = 'confirmed')::numeric / NULLIF(COUNT(*), 0)) * 100, 0), 1)
					FROM orders
				) AS fulfillment_rate,
				(
					SELECT COUNT(*)::int
					FROM fleet_shipments
					WHERE status != 'completed'
				) AS active_fleet_trucks,
				(
					SELECT ROUND(COALESCE((COUNT(*) FILTER (WHERE compliance_status = 'optimal')::numeric / NULLIF(COUNT(*), 0)) * 100, 0), 1)
					FROM fleet_shipments
				) AS cold_chain_compliance,
				(
					SELECT ROUND(COALESCE(AVG(speed_kmh), 0), 1)
					FROM fleet_shipments
					WHERE status = 'in_transit'
				) AS avg_speed_kmh,
				(
					SELECT COUNT(*)::int
					FROM users u
					JOIN roles r ON r.role_id = u.role_id
					WHERE r.role_name = 'farmer' AND (u.kyc_status = 'pending' OR u.kyc_status = 'under_review' OR (u.is_verified IS FALSE AND u.kyc_status != 'approved'))
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
				COALESCE(SUM(oi.quantity * oi.price), 0)::numeric(12,2) AS revenue_generated
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

const getPendingFarmers = async ({ page = 1, limit = 20, search = "" } = {}) => {
	const offset = (Number(page) - 1) * Number(limit);
	const params = [];
	let whereClause = `WHERE r.role_name = 'farmer'`;

	if (search) {
		params.push(`%${search}%`);
		whereClause += ` AND (u.name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR fp.farm_name ILIKE $${params.length} OR u.address ILIKE $${params.length})`;
	}

	const countResult = await pool.query(
		`
			SELECT COUNT(*)::int AS total
			FROM users u
			JOIN roles r ON r.role_id = u.role_id
			LEFT JOIN farmer_profiles fp ON fp.user_id = u.id
			${whereClause}
		`,
		params
	);
	const total = countResult.rows[0]?.total || 0;

	params.push(Number(limit), offset);
	const dataResult = await pool.query(
		`
			SELECT
				u.id,
				u.name,
				u.email,
				u.phone,
				u.is_verified,
				u.kyc_status,
				u.kyc_tier,
				u.account_status,
				COALESCE(fp.farm_name, u.name || '''s Farm') AS farm_name,
				COALESCE(fp.farm_type, 'Organic Produce & Crops') AS specialty,
				COALESCE(u.address, 'Ethiopia') AS location,
				COALESCE(fp.bio, 'Certified agricultural producer registered on GreenHarvest clearinghouse.') AS bio,
				u.created_at
			FROM users u
			JOIN roles r ON r.role_id = u.role_id
			LEFT JOIN farmer_profiles fp ON fp.user_id = u.id
			${whereClause}
			ORDER BY (u.kyc_status = 'pending' OR u.kyc_status = 'under_review') DESC, u.created_at DESC
			LIMIT $${params.length - 1} OFFSET $${params.length}
		`,
		params
	);

	return {
		farmers: dataResult.rows,
		pagination: {
			page: Number(page),
			limit: Number(limit),
			total,
			total_pages: Math.ceil(total / Number(limit)) || 1,
		},
	};
};

const verifyFarmer = async (farmerId, isVerified, actorId = null, reason = null) => {
	const client = await pool.connect();
	try {
		await client.query("BEGIN");

		const beforeCheck = await client.query(`SELECT id, is_verified, kyc_status, kyc_tier FROM users WHERE id = $1`, [farmerId]);
		const before = beforeCheck.rows[0] || null;

		const kycStatus = isVerified ? "approved" : "rejected";
		const kycTier = isVerified ? "tier_1" : "provisional";

		const updateResult = await client.query(
			`
				UPDATE users
				SET
					is_verified = $2,
					kyc_status = $3,
					kyc_tier = $4,
					updated_at = NOW()
				WHERE id = $1
				RETURNING id, name, email, is_verified, kyc_status, kyc_tier
			`,
			[farmerId, Boolean(isVerified), kycStatus, kycTier]
		);
		const updated = updateResult.rows[0];

		// Record in kyc_reviews
		await client.query(
			`
				INSERT INTO kyc_reviews (user_id, reviewer_id, decision, tier, reason, notes, created_at)
				VALUES ($1, $2, $3, $4, $5, $6, NOW())
			`,
			[
				farmerId,
				actorId,
				isVerified ? "approve" : "reject",
				kycTier,
				reason || (isVerified ? "Accredited platform verification" : "Verification requirements unfulfilled"),
				"Administrative KYC review action",
			]
		);

		// Record in audit log
		await auditService.record({
			actorId,
			action: isVerified ? "kyc.approve" : "kyc.reject",
			entityType: "farmer",
			entityId: farmerId,
			beforeState: before,
			afterState: updated,
			reason,
			client,
		});

		await client.query("COMMIT");
		return updated;
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	} finally {
		client.release();
	}
};

const getProductsForModeration = async ({ page = 1, limit = 20, search = "", status } = {}) => {
	const offset = (Number(page) - 1) * Number(limit);
	const params = [];
	let whereClause = `WHERE 1=1`;

	if (status && status !== "all") {
		params.push(status);
		whereClause += ` AND p.status = $${params.length}`;
	}

	if (search) {
		params.push(`%${search}%`);
		whereClause += ` AND (p.name ILIKE $${params.length} OR c.name ILIKE $${params.length} OR u.name ILIKE $${params.length})`;
	}

	const countResult = await pool.query(
		`
			SELECT COUNT(*)::int AS total
			FROM products p
			LEFT JOIN categories c ON c.id = p.category_id
			LEFT JOIN users u ON u.id = p.farmer_id
			${whereClause}
		`,
		params
	);
	const total = countResult.rows[0]?.total || 0;

	params.push(Number(limit), offset);
	const dataResult = await pool.query(
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
			${whereClause}
			ORDER BY (p.status = 'draft' OR p.status = 'pending') DESC, p.created_at DESC
			LIMIT $${params.length - 1} OFFSET $${params.length}
		`,
		params
	);

	return {
		products: dataResult.rows,
		pagination: {
			page: Number(page),
			limit: Number(limit),
			total,
			total_pages: Math.ceil(total / Number(limit)) || 1,
		},
	};
};

const moderateProduct = async (productId, status, actorId = null, reason = null) => {
	const validStatuses = ["active", "draft", "deactivated"];
	const normalizedStatus = validStatuses.includes(status) ? status : "active";

	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		const beforeCheck = await client.query(`SELECT id, name, status, price, stock FROM products WHERE id = $1`, [productId]);
		const before = beforeCheck.rows[0] || null;

		const result = await client.query(
			`
				UPDATE products
				SET status = $2
				WHERE id = $1
				RETURNING id, name, status, price, stock
			`,
			[productId, normalizedStatus]
		);
		const updated = result.rows[0];

		await auditService.record({
			actorId,
			action: `product.moderate.${normalizedStatus}`,
			entityType: "product",
			entityId: productId,
			beforeState: before,
			afterState: updated,
			reason,
			client,
		});

		await client.query("COMMIT");
		return updated;
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	} finally {
		client.release();
	}
};

const getDisputes = async ({ page = 1, limit = 20, search = "", status } = {}) => {
	const offset = (Number(page) - 1) * Number(limit);
	const params = [];
	let whereClause = `WHERE 1=1`;

	if (status && status !== "all") {
		params.push(status);
		whereClause += ` AND r.status = $${params.length}`;
	}

	if (search) {
		params.push(`%${search}%`);
		whereClause += ` AND (r.reason ILIKE $${params.length} OR buyer.name ILIKE $${params.length} OR farmer.name ILIKE $${params.length})`;
	}

	const countResult = await pool.query(
		`
			SELECT COUNT(*)::int AS total
			FROM returns r
			LEFT JOIN users buyer ON buyer.id = r.buyer_id
			LEFT JOIN users farmer ON farmer.id = r.farmer_id
			${whereClause}
		`,
		params
	);
	const total = countResult.rows[0]?.total || 0;

	params.push(Number(limit), offset);
	const dataResult = await pool.query(
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
				COALESCE(o.total_price, 0)::numeric(12,2) AS amount
			FROM returns r
			LEFT JOIN users buyer ON buyer.id = r.buyer_id
			LEFT JOIN users farmer ON farmer.id = r.farmer_id
			LEFT JOIN orders o ON o.id = r.order_id
			${whereClause}
			ORDER BY (r.status = 'pending' OR r.status = 'open') DESC, r.created_at DESC
			LIMIT $${params.length - 1} OFFSET $${params.length}
		`,
		params
	);

	return {
		disputes: dataResult.rows,
		pagination: {
			page: Number(page),
			limit: Number(limit),
			total,
			total_pages: Math.ceil(total / Number(limit)) || 1,
		},
	};
};

const resolveDispute = async (disputeId, action, actorId = null, reason = null) => {
	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		const returnCheck = await client.query(`SELECT * FROM returns WHERE id = $1`, [disputeId]);
		if (returnCheck.rows.length === 0) {
			await client.query("ROLLBACK");
			return null;
		}

		const record = returnCheck.rows[0];
		let updatedReturn;

		if (action === "refund" || action === "accept") {
			const updateResult = await client.query(
				`
					UPDATE returns
					SET status = 'accepted', refund_status = 'issued', updated_at = NOW()
					WHERE id = $1
					RETURNING *
				`,
				[disputeId]
			);
			await client.query(
				`UPDATE orders SET order_status = 'refunded' WHERE id = $1`,
				[record.order_id]
			);
			updatedReturn = updateResult.rows[0];
		} else {
			const updateResult = await client.query(
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

		await auditService.record({
			actorId,
			action: `dispute.resolve.${action}`,
			entityType: "dispute",
			entityId: disputeId,
			beforeState: record,
			afterState: updatedReturn,
			reason,
			client,
		});

		await client.query("COMMIT");
		return updatedReturn;
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	} finally {
		client.release();
	}
};

const broadcastAnnouncement = async (adminUserId, message, targetAudience = "all", title = "Platform Advisory") => {
	const client = await pool.connect();
	try {
		await client.query("BEGIN");

		// Determine target recipients
		let targetSql = `SELECT u.id FROM users u WHERE u.id != $1`;
		const targetParams = [adminUserId || 0];

		if (targetAudience === "farmers") {
			targetSql = `
				SELECT u.id FROM users u
				JOIN roles r ON r.role_id = u.role_id
				WHERE r.role_name = 'farmer' AND u.id != $1
			`;
		} else if (targetAudience === "buyers") {
			targetSql = `
				SELECT u.id FROM users u
				JOIN roles r ON r.role_id = u.role_id
				WHERE r.role_name = 'buyer' AND u.id != $1
			`;
		} else if (targetAudience === "logistics") {
			targetSql = `
				SELECT u.id FROM users u
				JOIN roles r ON r.role_id = u.role_id
				WHERE (r.role_name = 'delivery' OR r.role_name = 'delivery_partner') AND u.id != $1
			`;
		}

		const recipients = await client.query(targetSql, targetParams);
		const userIds = recipients.rows.map((r) => r.id);

		// Insert announcement
		const announcementResult = await client.query(
			`
				INSERT INTO announcements (
					created_by,
					title,
					message,
					target_audience,
					status,
					delivered_count,
					created_at
				)
				VALUES ($1, $2, $3, $4, 'sent', $5, NOW())
				RETURNING id, title, message, target_audience, delivered_count, created_at
			`,
			[adminUserId || null, title, message, targetAudience, userIds.length]
		);
		const announcement = announcementResult.rows[0];

		// Dispatch notifications and deliveries in batch
		if (userIds.length > 0) {
			await client.query(
				`
					INSERT INTO announcement_deliveries (announcement_id, user_id, channel, status, delivered_at)
					SELECT $1, u.id, 'in_app', 'delivered', NOW()
					FROM unnest($2::bigint[]) AS u(id)
				`,
				[announcement.id, userIds]
			);

			await client.query(
				`
					INSERT INTO notifications (user_id, title, message, is_read, created_at)
					SELECT u.id, $1, $2, FALSE, NOW()
					FROM unnest($3::bigint[]) AS u(id)
				`,
				[title, message, userIds]
			);
		}

		await auditService.record({
			actorId: adminUserId,
			action: "announcement.broadcast",
			entityType: "announcement",
			entityId: announcement.id,
			afterState: announcement,
			reason: `Broadcast dispatched to target audience: ${targetAudience}`,
			client,
		});

		await client.query("COMMIT");
		return {
			...announcement,
			delivered_count: userIds.length,
		};
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	} finally {
		client.release();
	}
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

	if (filters.status && filters.status !== "all") {
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

const assignDispatchBatch = async (data, actorId = null) => {
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
		nearest_cold_hub = "Debre Zeit Cold Hub Depot",
	} = data;

	const newId = id || `FL-${Math.floor(200 + Math.random() * 800)}`;

	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		const result = await client.query(
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
				truck_type || "10-Ton Refrigerated Reefer",
				driver_name,
				driver_phone,
				carrier_partner || "Ethio Cold-Chain Logistics",
				cargo_batch,
				cargo_weight_kg || 1500,
				origin_hub,
				destination_hub,
				reefer_temp_celsius,
				nearest_cold_hub,
			]
		);
		const shipment = result.rows[0];

		await auditService.record({
			actorId,
			action: "logistics.dispatch",
			entityType: "fleet_shipment",
			entityId: newId,
			afterState: shipment,
			client,
		});

		await client.query("COMMIT");
		return shipment;
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	} finally {
		client.release();
	}
};

const emergencyRerouteTruck = async (id, { diversion_hub, admin_notes }, actorId = null) => {
	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		const beforeCheck = await client.query(`SELECT * FROM fleet_shipments WHERE id = $1`, [id]);
		const before = beforeCheck.rows[0] || null;

		const result = await client.query(
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
			[id, diversion_hub || "Nearest Regional Cold Hub Depot", admin_notes]
		);
		const rerouted = result.rows[0];

		await auditService.record({
			actorId,
			action: "logistics.emergency_reroute",
			entityType: "fleet_shipment",
			entityId: id,
			beforeState: before,
			afterState: rerouted,
			reason: admin_notes || "Cold-chain deviation diversion",
			client,
		});

		await client.query("COMMIT");
		return rerouted;
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	} finally {
		client.release();
	}
};

const getRegionalAnalytics = async (limit = 10) => {
	const result = await pool.query(
		`
			SELECT
				COALESCE(NULLIF(p.farm_location, ''), NULLIF(u.address, ''), 'Oromia (Central Valley)') AS region,
				COALESCE(c.name, 'Fresh Produce') AS top_crop,
				COALESCE(SUM(oi.quantity), SUM(p.stock))::int AS volume_kg,
				COALESCE(SUM(oi.quantity * oi.price), SUM(p.stock * p.price))::numeric(12,2) AS gmv,
				(COALESCE(SUM(oi.quantity * oi.price), SUM(p.stock * p.price)) * 0.05)::numeric(12,2) AS commission
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

const updateUserStatus = async (userId, status, actorId = null, reason = null) => {
	const validStatuses = ["active", "pending", "suspended", "banned", "deactivated"];
	if (!validStatuses.includes(status)) {
		throw new Error(`Invalid account status: ${status}. Allowed: ${validStatuses.join(", ")}`);
	}

	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		const beforeCheck = await client.query(
			`SELECT id, name, email, role, account_status, is_verified, suspended_at, suspended_by, suspension_reason FROM users WHERE id = $1`,
			[userId]
		);
		const before = beforeCheck.rows[0];
		if (!before) {
			throw new Error(`User with ID ${userId} not found`);
		}

		const isSuspended = status === "suspended" || status === "banned";
		const result = await client.query(
			`
				UPDATE users
				SET
					account_status = $2,
					suspended_at = CASE WHEN $3 = TRUE THEN NOW() ELSE NULL END,
					suspended_by = CASE WHEN $3 = TRUE THEN $4 ELSE NULL END,
					suspension_reason = CASE WHEN $3 = TRUE THEN $5 ELSE NULL END,
					updated_at = NOW()
				WHERE id = $1
				RETURNING id, name, email, role, account_status, is_verified, suspended_at, suspended_by, suspension_reason
			`,
			[userId, status, isSuspended, actorId, reason]
		);
		const updated = result.rows[0];

		await auditService.record({
			actorId,
			action: `user.status.${status}`,
			entityType: "user",
			entityId: userId,
			beforeState: before,
			afterState: updated,
			reason,
			client,
		});

		await client.query("COMMIT");
		return updated;
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	} finally {
		client.release();
	}
};

// ════════════════ Platform Settings Management ════════════════

const getPlatformSettings = async () => {
	const result = await pool.query(
		`SELECT key, value, updated_by, updated_at FROM platform_settings ORDER BY key ASC`
	);
	const settingsMap = {};
	result.rows.forEach((row) => {
		settingsMap[row.key] = row.value;
	});
	return {
		settings: settingsMap,
		raw: result.rows,
	};
};

const updatePlatformSettings = async (newSettings, actorId = null) => {
	const client = await pool.connect();
	try {
		await client.query("BEGIN");

		const currentResult = await client.query(`SELECT key, value FROM platform_settings`);
		const currentMap = {};
		currentResult.rows.forEach((r) => {
			currentMap[r.key] = r.value;
		});

		for (const [key, value] of Object.entries(newSettings)) {
			const oldValue = currentMap[key] || null;
			const jsonValue = typeof value === "object" && value !== null ? value : { value };

			await client.query(
				`
					INSERT INTO platform_settings (key, value, updated_by, updated_at)
					VALUES ($1, $2, $3, NOW())
					ON CONFLICT (key) DO UPDATE
					SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()
				`,
				[key, JSON.stringify(jsonValue), actorId]
			);

			// Record in settings history
			await client.query(
				`
					INSERT INTO settings_history (key, old_value, new_value, changed_by, created_at)
					VALUES ($1, $2, $3, $4, NOW())
				`,
				[key, oldValue ? JSON.stringify(oldValue) : null, JSON.stringify(jsonValue), actorId]
			);
		}

		await auditService.record({
			actorId,
			action: "settings.update",
			entityType: "platform_settings",
			entityId: "global",
			beforeState: currentMap,
			afterState: newSettings,
			reason: "Administrative governance parameters update",
			client,
		});

		await client.query("COMMIT");
		return getPlatformSettings();
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	} finally {
		client.release();
	}
};

const getSettingsHistory = async (limit = 50) => {
	const result = await pool.query(
		`
			SELECT
				sh.id,
				sh.key,
				sh.old_value,
				sh.new_value,
				sh.changed_by,
				u.name AS changed_by_name,
				u.email AS changed_by_email,
				sh.created_at
			FROM settings_history sh
			LEFT JOIN users u ON u.id = sh.changed_by
			ORDER BY sh.created_at DESC
			LIMIT $1
		`,
		[limit]
	);
	return result.rows;
};

// ════════════════ Admin Team & Role Assignments ════════════════

const getAdminRoles = async () => {
	const result = await pool.query(
		`
			SELECT
				ar.id,
				ar.name,
				ar.description,
				ar.created_at,
				COALESCE(
					json_agg(
						json_build_object(
							'id', p.id,
							'code', p.code,
							'name', p.name,
							'category', p.category
						)
					) FILTER (WHERE p.id IS NOT NULL),
					'[]'::json
				) AS permissions
			FROM admin_roles ar
			LEFT JOIN role_permissions rp ON rp.role_id = ar.id
			LEFT JOIN permissions p ON p.id = rp.permission_id
			GROUP BY ar.id, ar.name, ar.description, ar.created_at
			ORDER BY ar.id ASC
		`
	);
	return result.rows;
};

const getAdminTeam = async () => {
	const result = await pool.query(
		`
			SELECT
				u.id,
				u.name,
				u.email,
				u.role,
				u.account_status,
				u.last_login_at,
				u.created_at,
				ar.id AS admin_role_id,
				ar.name AS admin_role_name,
				ar.description AS admin_role_description,
				COUNT(al.id)::int AS total_actions_logged
			FROM users u
			LEFT JOIN admin_roles ar ON ar.id = u.admin_role_id
			LEFT JOIN audit_logs al ON al.actor_id = u.id
			WHERE u.role = 'admin' OR u.admin_role_id IS NOT NULL
			GROUP BY u.id, ar.id, ar.name, ar.description
			ORDER BY u.created_at ASC
		`
	);
	return result.rows;
};

const updateAdminRole = async (targetUserId, adminRoleId, actorId = null) => {
	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		const beforeCheck = await client.query(
			`
				SELECT u.id, u.name, u.email, u.admin_role_id, ar.name AS role_name
				FROM users u
				LEFT JOIN admin_roles ar ON ar.id = u.admin_role_id
				WHERE u.id = $1
			`,
			[targetUserId]
		);
		const before = beforeCheck.rows[0];
		if (!before) {
			throw new Error(`Admin user with ID ${targetUserId} not found`);
		}

		const roleCheck = await client.query(`SELECT id, name FROM admin_roles WHERE id = $1`, [adminRoleId]);
		if (roleCheck.rows.length === 0) {
			throw new Error(`Admin role ID ${adminRoleId} does not exist`);
		}
		const newRole = roleCheck.rows[0];

		const updateResult = await client.query(
			`
				UPDATE users
				SET admin_role_id = $2, role = 'admin', updated_at = NOW()
				WHERE id = $1
				RETURNING id, name, email, admin_role_id
			`,
			[targetUserId, adminRoleId]
		);
		const updated = updateResult.rows[0];

		await auditService.record({
			actorId,
			action: "team.assign_role",
			entityType: "admin_user",
			entityId: targetUserId,
			beforeState: before,
			afterState: { ...updated, admin_role_name: newRole.name },
			reason: `Admin role changed to ${newRole.name}`,
			client,
		});

		await client.query("COMMIT");
		return {
			...updated,
			admin_role_name: newRole.name,
		};
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	} finally {
		client.release();
	}
};

module.exports = {
	getAdminMe,
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
	getPlatformSettings,
	updatePlatformSettings,
	getSettingsHistory,
	getAdminRoles,
	getAdminTeam,
	updateAdminRole,
	// KYC
	...kycModel,
	// User 360
	...user360Model,
	// Product Governance
	...productModerationModel,
	// Phase 2: Commerce, Escrow, Disputes, Payments
	...orderAdminModel,
	...escrowAdminModel,
	...disputeAdminModel,
	...paymentAdminModel,
	// Phase 3: Cold-Chain Logistics, Fleet, Carriers, Hubs, Incidents
	...logisticsAdminModel,
	// Phase 4: Support & Broadcast Communications
	...supportAdminModel,
	...announcementAdminModel,
	// Phase 5: Risk, Reports, System Health
	...riskAdminModel,
	...reportAdminModel,
	...systemHealthAdminModel,
};
