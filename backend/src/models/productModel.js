const { pool } = require("../config/db");

const productSelect = `
	SELECT
		p.id,
		p.name,
		p.description,
		p.price,
		p.discount_price,
		p.stock,
		p.farm_location,
		p.image_url,
		p.created_at,
		p.category_id,
		p.farmer_id,
		p.status,
		p.moderation_status,
		p.moderation_reason,
		p.moderation_risk_score,
		p.is_published,
		p.harvest_date,
		p.unit,
		p.min_order_quantity,
		p.pickup_available,
		p.farmer_delivery_available,
		p.delivery_radius_km,
		p.deleted_at,
		(
			SELECT COUNT(*)::int
			FROM product_revisions pr
			WHERE pr.product_id = p.id AND pr.status = 'pending'
		) AS pending_revisions_count,
		CASE
			WHEN COALESCE(p.stock, 0) = 0 THEN 'out_of_stock'
			WHEN COALESCE(p.stock, 0) <= 50 THEN 'low_stock'
			ELSE 'in_stock'
		END AS stock_status,
		u.name AS farmer_name,
		u.email AS farmer_email,
		c.name AS category_name
	FROM products p
	JOIN users u ON u.id = p.farmer_id
	LEFT JOIN categories c ON c.id = p.category_id
`;

const createProduct = async ({
	farmer_id,
	category_id,
	name,
	description,
	price,
	discount_price,
	stock,
	farm_location,
	image_url,
	image_hash = null,
	status = 'draft',
	moderation_status = 'pending',
	moderation_reason = null,
	moderation_risk_score = 0.0,
	is_published = false,
	harvest_date = null,
	unit = 'kg',
	min_order_quantity = 1.0,
	pickup_available = true,
	farmer_delivery_available = false,
	delivery_radius_km = 0,
}) => {
	const result = await pool.query(
		`
			INSERT INTO products (
				farmer_id,
				category_id,
				name,
				description,
				price,
				discount_price,
				stock,
				farm_location,
				image_url,
				image_hash,
				status,
				moderation_status,
				moderation_reason,
				moderation_risk_score,
				is_published,
				harvest_date,
				unit,
				min_order_quantity,
				pickup_available,
				farmer_delivery_available,
				delivery_radius_km
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
			RETURNING *
		`,
		[
			farmer_id,
			category_id || null,
			name,
			description || null,
			price || 0,
			discount_price || null,
			stock ?? 0,
			farm_location || null,
			image_url || null,
			image_hash || null,
			status,
			moderation_status,
			moderation_reason,
			moderation_risk_score,
			is_published,
			harvest_date || null,
			unit || 'kg',
			min_order_quantity || 1.0,
			pickup_available !== undefined ? pickup_available : true,
			farmer_delivery_available !== undefined ? farmer_delivery_available : false,
			delivery_radius_km || 0,
		]
	);

	if (image_url) {
		const hasImagesTable = await tableExists('product_images');
		if (hasImagesTable) {
			await pool.query(
				`INSERT INTO product_images (product_id, image_url, image_hash) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
				[result.rows[0].id, image_url, image_hash || null]
			);
		}
	}

	return result.rows[0];
};

const tableExists = async (tableName) => {
	const result = await pool.query(
		`
			SELECT EXISTS (
				SELECT 1
				FROM information_schema.tables
				WHERE table_schema = CURRENT_SCHEMA()
					AND table_name = $1
			) AS exists
		`,
		[tableName]
	);

	return Boolean(result.rows[0] && result.rows[0].exists);
};

const getTableColumns = async (tableName) => {
	const result = await pool.query(
		`
			SELECT column_name
			FROM information_schema.columns
			WHERE table_schema = CURRENT_SCHEMA()
				AND table_name = $1
		`,
		[tableName]
	);

	return result.rows.map((row) => row.column_name);
};

const getFirstAvailableColumn = (columns, candidateColumns) => {
	return candidateColumns.find((columnName) => columns.includes(columnName)) || null;
};

const findFarmerById = async (farmerId) => {
	const farmerSourceTables = [
		{
			tableName: "farmers",
			idColumns: ["farmer_id", "id"],
		},
		{
			tableName: "farmer_profiles",
			idColumns: ["farmer_id", "profile_id", "id"],
		},
	];

	for (const { tableName, idColumns } of farmerSourceTables) {
		if (!(await tableExists(tableName))) {
			continue;
		}

		const farmerColumns = await getTableColumns(tableName);
		const farmerIdColumn = getFirstAvailableColumn(farmerColumns, idColumns);

		if (!farmerIdColumn) {
			continue;
		}

		const farmerResult = await pool.query(
			`
				SELECT ${farmerIdColumn} AS id
				FROM ${tableName}
				WHERE ${farmerIdColumn} = $1
			`,
			[farmerId]
		);

		if (farmerResult.rows[0]) {
			return farmerResult.rows[0];
		}
	}

	const userColumns = await getTableColumns("users");
	const userIdColumn = getFirstAvailableColumn(userColumns, ["user_id", "id"]);

	if (!userIdColumn) {
		return null;
	}

	if (userColumns.includes("role_id") && (await tableExists("roles"))) {
		const roleBasedUserResult = await pool.query(
			`
				SELECT u.${userIdColumn} AS id
				FROM users u
				JOIN roles r ON r.role_id = u.role_id
				WHERE u.${userIdColumn} = $1
					AND LOWER(COALESCE(r.role_name, '')) = 'farmer'
			`,
			[farmerId]
		);

		if (roleBasedUserResult.rows[0]) {
			return roleBasedUserResult.rows[0];
		}
	}

	return null;
};

const findProductOwnershipById = async (productId) => {
	const result = await pool.query(
		"SELECT id, farmer_id, name, description, price, discount_price, stock, category_id, farm_location, image_url, status, moderation_status, is_published, deleted_at FROM products WHERE id = $1 AND deleted_at IS NULL",
		[productId]
	);
	return result.rows[0] || null;
};

const findProductStockById = async (productId) => {
	const result = await pool.query(
		`
			SELECT
				p.id,
				p.farmer_id,
				p.status,
				p.moderation_status,
				p.deleted_at,
				u.account_status,
				COALESCE(i.quantity, p.stock, 0) AS stock
			FROM products p
			JOIN users u ON u.id = p.farmer_id
			LEFT JOIN inventory i ON i.product_id = p.id
			WHERE p.id = $1
		`,
		[productId]
	);

	return result.rows[0] || null;
};

const findProductStockForUpdateById = async (client, productId) => {
	const result = await client.query(
		`
			SELECT p.id, p.farmer_id, p.stock
			FROM products p
			WHERE p.id = $1
			FOR UPDATE
		`,
		[productId]
	);

	return result.rows[0] || null;
};

const findAllProducts = async ({ limit, offset, farmer_id, category_id, search, sort, includeInactive = false } = {}) => {
	let conditions = [];
	let countParams = [];
	let dataParams = [];
	let paramCount = 1;

	// Security & Marketplace Gate: Only active, approved listings from active sellers
	if (!includeInactive) {
		conditions.push("p.deleted_at IS NULL");
		conditions.push("p.status = 'active'");
		conditions.push("p.moderation_status = 'approved'");
		conditions.push("p.is_published = TRUE");
		conditions.push("u.account_status = 'active'");
	}

	if (farmer_id) {
		conditions.push(`p.farmer_id = $${paramCount}`);
		countParams.push(farmer_id);
		dataParams.push(farmer_id);
		paramCount++;
	}

	if (category_id) {
		conditions.push(`p.category_id = $${paramCount}`);
		countParams.push(category_id);
		dataParams.push(category_id);
		paramCount++;
	}

	if (search) {
		conditions.push(`(p.name ILIKE $${paramCount} OR p.description ILIKE $${paramCount} OR p.farm_location ILIKE $${paramCount} OR u.name ILIKE $${paramCount})`);
		countParams.push(`%${search}%`);
		dataParams.push(`%${search}%`);
		paramCount++;
	}

	let queryCondition = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

	let orderBy = 'ORDER BY p.created_at DESC';
	if (sort === 'price_low') orderBy = 'ORDER BY p.price ASC';
	else if (sort === 'price_high') orderBy = 'ORDER BY p.price DESC';
	else if (sort === 'popular') orderBy = 'ORDER BY p.stock DESC';

	if (limit !== undefined && offset !== undefined) {
		dataParams.push(limit, offset);
		const limitIdx = dataParams.length - 1;
		const offsetIdx = dataParams.length;

		const [countResult, dataResult] = await Promise.all([
			pool.query(`SELECT COUNT(*)::int AS total FROM products p JOIN users u ON u.id = p.farmer_id ${queryCondition}`, countParams),
			pool.query(
				`
					${productSelect}
					${queryCondition}
					${orderBy}
					LIMIT $${limitIdx} OFFSET $${offsetIdx}
				`,
				dataParams
			),
		]);

		return {
			rows: dataResult.rows,
			total: countResult.rows[0].total,
		};
	}

	const result = await pool.query(
		`
			${productSelect}
			${queryCondition}
			${orderBy}
		`,
		dataParams
	);

	return result.rows;
};

const findProductById = async (productId, { includeUnpublished = false } = {}) => {
	const eligibilityClause = includeUnpublished
		? "WHERE p.id = $1 AND p.deleted_at IS NULL"
		: "WHERE p.id = $1 AND p.deleted_at IS NULL AND p.status = 'active' AND p.moderation_status = 'approved' AND p.is_published = TRUE AND u.account_status = 'active'";

	const result = await pool.query(
		`
			${productSelect}
			${eligibilityClause}
		`,
		[productId]
	);

	return result.rows[0] || null;
};

const updateProductById = async (
	productId,
	{
		name,
		description,
		price,
		discount_price,
		stock,
		category_id,
		farm_location,
		image_url,
		status,
		moderation_status,
		moderation_reason,
		moderation_risk_score,
		is_published,
		harvest_date,
		unit,
		min_order_quantity,
		pickup_available,
		farmer_delivery_available,
		delivery_radius_km,
	}
) => {
	const result = await pool.query(
		`
			UPDATE products
			SET
				name = COALESCE($1, name),
				description = COALESCE($2, description),
				price = COALESCE($3, price),
				discount_price = CASE WHEN $4 = -1 THEN NULL WHEN $4 IS NULL THEN discount_price ELSE $4 END,
				stock = COALESCE($5, stock),
				category_id = COALESCE($6, category_id),
				farm_location = COALESCE($7, farm_location),
				image_url = COALESCE($8, image_url),
				status = COALESCE($9, status),
				moderation_status = COALESCE($10, moderation_status),
				moderation_reason = COALESCE($11, moderation_reason),
				moderation_risk_score = COALESCE($12, moderation_risk_score),
				is_published = COALESCE($13, is_published),
				harvest_date = COALESCE($14, harvest_date),
				unit = COALESCE($15, unit),
				min_order_quantity = COALESCE($16, min_order_quantity),
				pickup_available = COALESCE($17, pickup_available),
				farmer_delivery_available = COALESCE($18, farmer_delivery_available),
				delivery_radius_km = COALESCE($19, delivery_radius_km)
			WHERE id = $20
			RETURNING *
		`,
		[
			name,
			description,
			price,
			discount_price,
			stock,
			category_id,
			farm_location,
			image_url,
			status,
			moderation_status,
			moderation_reason,
			moderation_risk_score,
			is_published,
			harvest_date,
			unit,
			min_order_quantity,
			pickup_available,
			farmer_delivery_available,
			delivery_radius_km,
			productId,
		]
	);

	return result.rows[0] || null;
};

const createProductRevision = async ({ productId, farmerId, revisionData }) => {
	const result = await pool.query(
		`
			INSERT INTO product_revisions (product_id, farmer_id, revision_data, status)
			VALUES ($1, $2, $3, 'pending')
			RETURNING *
		`,
		[productId, farmerId, JSON.stringify(revisionData)]
	);

	return result.rows[0];
};

const getProductRevisions = async (productId) => {
	const result = await pool.query(
		`
			SELECT
				pr.*,
				rev.name AS reviewer_name
			FROM product_revisions pr
			LEFT JOIN users rev ON rev.id = pr.reviewer_id
			WHERE pr.product_id = $1
			ORDER BY pr.created_at DESC
		`,
		[productId]
	);

	return result.rows;
};

const reviewProductRevision = async ({ revisionId, decision, feedback = null, reviewerId = null }) => {
	const client = await pool.connect();
	try {
		await client.query("BEGIN");

		const revRes = await client.query(
			`SELECT * FROM product_revisions WHERE id = $1 FOR UPDATE`,
			[revisionId]
		);

		if (!revRes.rows[0]) {
			throw new Error("Revision not found");
		}

		const revision = revRes.rows[0];
		const nextStatus = decision === "approve" ? "approved" : "rejected";

		await client.query(
			`
				UPDATE product_revisions
				SET
					status = $1,
					reviewer_id = $2,
					reviewer_feedback = $3,
					reviewed_at = NOW()
				WHERE id = $4
			`,
			[nextStatus, reviewerId, feedback, revisionId]
		);

		if (decision === "approve") {
			const data = typeof revision.revision_data === "string" ? JSON.parse(revision.revision_data) : revision.revision_data;
			await client.query(
				`
					UPDATE products
					SET
						name = COALESCE($1, name),
						price = COALESCE($2, price),
						discount_price = CASE WHEN $3 = -1 THEN NULL WHEN $3 IS NULL THEN discount_price ELSE $3 END,
						description = COALESCE($4, description),
						category_id = COALESCE($5, category_id),
						farm_location = COALESCE($6, farm_location),
						image_url = COALESCE($7, image_url)
					WHERE id = $8
				`,
				[
					data.name ?? null,
					data.price ?? null,
					data.discount_price ?? null,
					data.description ?? null,
					data.category_id ?? null,
					data.farm_location ?? null,
					data.image_url ?? null,
					revision.product_id,
				]
			);
		}

		await client.query("COMMIT");
		return { success: true, status: nextStatus };
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	} finally {
		client.release();
	}
};

const updateProductStockById = async (productId, stock) => {
	await pool.query(
		`
			UPDATE products
			SET stock = $1
			WHERE id = $2
		`,
		[stock, productId]
	);

	return findProductById(productId);
};

const deleteProductById = async (productId) => {
	const result = await pool.query(
		`
			UPDATE products
			SET
				deleted_at = NOW(),
				status = 'deactivated',
				moderation_status = 'rejected'
			WHERE id = $1
			RETURNING id, status, deleted_at
		`,
		[productId]
	);

	return result.rows[0] || null;
};

module.exports = {
	createProduct,
	createProductRevision,
	deleteProductById,
	findAllProducts,
	findFarmerById,
	findProductById,
	findProductOwnershipById,
	getProductRevisions,
	findProductStockById,
	findProductStockForUpdateById,
	reviewProductRevision,
	updateProductById,
	updateProductStockById,
};
