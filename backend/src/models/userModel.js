const { pool } = require("../config/db");
const { normalizeRole } = require("../utils/roles");

const tableColumnsCache = new Map();
const tableExistsCache = new Map();

const tableExists = async (tableName, db = pool) => {
	const cached = tableExistsCache.get(tableName);
	if (cached !== undefined) {
		return cached;
	}

	const result = await db.query(
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

	const exists = Boolean(result.rows[0] && result.rows[0].exists);
	tableExistsCache.set(tableName, exists);
	return exists;
};

const getTableColumns = async (tableName, db = pool) => {
	const cached = tableColumnsCache.get(tableName);
	if (cached) {
		return cached;
	}

	const result = await db.query(
		`
			SELECT column_name
			FROM information_schema.columns
			WHERE table_schema = CURRENT_SCHEMA()
				AND table_name = $1
		`,
		[tableName]
	);

	const columns = result.rows.map((row) => row.column_name);
	tableColumnsCache.set(tableName, columns);
	return columns;
};

const getFirstAvailableColumn = (columns, candidateColumns) => (
	candidateColumns.find((columnName) => columns.includes(columnName)) || null
);

const nullableColumn = (columns, columnName, fallbackType = "text") => (
	columns.includes(columnName) ? `u.${columnName}` : `NULL::${fallbackType}`
);

const toDbRoleName = (role) => {
	const normalizedRole = normalizeRole(role);

	if (normalizedRole === "delivery_partner") {
		return "delivery_partner";
	}

	if (normalizedRole === "field_agent") {
		return "field_agent";
	}

	return normalizedRole;
};

const buildUserSelect = async (db = pool) => {
	const userColumns = await getTableColumns("users", db);
	const userIdColumn = getFirstAvailableColumn(userColumns, ["id", "user_id"]);
	const passwordColumn = getFirstAvailableColumn(userColumns, ["password", "password_hash"]);
	const hasRoleJoin = userColumns.includes("role_id") && (await tableExists("roles", db));
	const hasUserBio = userColumns.includes("bio");
	const hasFarmerProfile = (await tableExists("farmer_profiles", db));
	const farmerColumns = hasFarmerProfile ? await getTableColumns("farmer_profiles", db) : [];
	const roleValue = userColumns.includes("role")
		? "u.role"
		: "NULL::text";
	const roleNameValue = hasRoleJoin
		? "r.role_name"
		: "NULL::text";

	return {
		userIdColumn,
		passwordColumn,
		sql: `
			SELECT
				u.${userIdColumn} AS id,
				u.name,
				u.email,
				${passwordColumn ? `u.${passwordColumn}` : "NULL::text"} AS password,
				${nullableColumn(userColumns, "phone")} AS phone,
				${nullableColumn(userColumns, "address")} AS address,
				${hasUserBio ? "u.bio" : (farmerColumns.includes("bio") ? "fp.bio" : "NULL::text")} AS bio,
				${farmerColumns.includes("farm_name") ? "fp.farm_name" : "NULL::text"} AS farm_name,
				${farmerColumns.includes("farm_type") ? "fp.farm_type" : "NULL::text"} AS farm_type,
				${farmerColumns.includes("farm_location") ? "fp.farm_location" : "NULL::text"} AS farm_location,
				${farmerColumns.includes("farm_size") ? "fp.farm_size" : "NULL::text"} AS farm_size,
				${farmerColumns.includes("experience_years") ? "fp.experience_years" : "NULL::integer"} AS experience_years,
				${nullableColumn(userColumns, "created_at", "timestamptz")} AS created_at,
				${nullableColumn(userColumns, "role_id", "integer")} AS role_id,
				${roleNameValue} AS role_name,
				COALESCE(${roleNameValue}, ${roleValue}, 'buyer') AS role,
				COALESCE(${nullableColumn(userColumns, "is_verified", "boolean")}, FALSE) AS is_verified,
				COALESCE(${nullableColumn(userColumns, "email_verified", "boolean")}, FALSE) AS email_verified,
				COALESCE(${nullableColumn(userColumns, "account_status")}, 'active') AS account_status,
				COALESCE(${nullableColumn(userColumns, "kyc_status")}, 'not_submitted') AS kyc_status,
				COALESCE(${nullableColumn(userColumns, "kyc_tier")}, 'provisional') AS kyc_tier,
				COALESCE(${nullableColumn(userColumns, "mfa_enabled", "boolean")}, FALSE) AS mfa_enabled,
				${nullableColumn(userColumns, "backup_email")} AS backup_email,
				${nullableColumn(userColumns, "recovery_phone")} AS recovery_phone,
				${nullableColumn(userColumns, "verification_token_hash")} AS verification_token_hash,
				${nullableColumn(userColumns, "verification_token_expiry", "timestamptz")} AS verification_token_expiry,
				${nullableColumn(userColumns, "password_reset_token_hash")} AS password_reset_token_hash,
				${nullableColumn(userColumns, "password_reset_token_expiry", "timestamptz")} AS password_reset_token_expiry,
				${nullableColumn(userColumns, "last_login_at", "timestamptz")} AS last_login_at
			FROM users u
			${hasRoleJoin ? "LEFT JOIN roles r ON r.role_id = u.role_id" : ""}
			${hasFarmerProfile ? `LEFT JOIN farmer_profiles fp ON fp.user_id = u.${userIdColumn}` : ""}
		`,
		userColumns,
	};
};

const createUser = async ({
	name,
	email,
	password,
	role,
	phone = null,
	address = null,
	backup_email = null,
	recovery_phone = null,
}) => {
	const roleName = toDbRoleName(role);

	const roleResult = await pool.query(
		`
			SELECT role_id, role_name
			FROM roles
			WHERE role_name = $1
		`,
		[roleName]
	);

	if (roleResult.rows.length === 0) {
		throw new Error(`Role '${roleName}' is not configured`);
	}

	const roleRecord = roleResult.rows[0];

	const client = await pool.connect();

	try {
		await client.query("BEGIN");

		const insertedUser = await client.query(
			`
				INSERT INTO users (
					name,
					email,
					password,
					role,
					role_id,
					phone,
					address,
					is_verified,
					email_verified,
					account_status,
					mfa_enabled,
					backup_email,
					recovery_phone
				)
				VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, FALSE, 'active', FALSE, $8, $9)
				RETURNING
					id,
					name,
					email,
					phone,
					address,
					created_at,
					role_id,
					is_verified,
					email_verified,
					account_status,
					mfa_enabled,
					backup_email,
					recovery_phone
			`,
			[name, email, password, roleName, roleRecord.role_id, phone, address, backup_email, recovery_phone]
		);

		const user = insertedUser.rows[0];
		const userId = user.id;

		if (roleName === "buyer") {
			await client.query(
				`INSERT INTO buyer_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
				[userId]
			);
		} else if (roleName === "farmer") {
			await client.query(
				`INSERT INTO farmer_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
				[userId]
			);
		} else if (roleName === "delivery_partner") {
			await client.query(
				`INSERT INTO delivery_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
				[userId]
			);
		} else if (roleName === "field_agent") {
			await client.query(
				`INSERT INTO field_agent_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
				[userId]
			);
		}

		await client.query("COMMIT");

		return {
			id: userId,
			name: user.name,
			email: user.email,
			phone: user.phone,
			address: user.address,
			created_at: user.created_at,
			role_id: user.role_id,
			role_name: roleRecord.role_name,
			role: roleRecord.role_name,
			is_verified: user.is_verified,
			mfa_enabled: user.mfa_enabled,
			backup_email: user.backup_email,
			recovery_phone: user.recovery_phone,
		};
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	} finally {
		client.release();
	}
};

const findUserByEmail = async (email) => {
	const userSelect = await buildUserSelect();
	const result = await pool.query(
		`
			${userSelect.sql}
			WHERE u.email = $1
		`,
		[email]
	);

	return result.rows[0] || null;
};

const findUserById = async (userId) => {
	const userSelect = await buildUserSelect();
	const result = await pool.query(
		`
			${userSelect.sql}
			WHERE u.${userSelect.userIdColumn} = $1
		`,
		[userId]
	);

	if (!result.rows[0]) {
		return null;
	}

	const { password, verification_token_hash, password_reset_token_hash, ...safeUser } = result.rows[0];
	return safeUser;
};

const findAllUsers = async () => {
	const userSelect = await buildUserSelect();
	const result = await pool.query(
		`
			${userSelect.sql}
			ORDER BY u.${userSelect.userIdColumn} DESC
		`
	);

	return result.rows.map((row) => {
		const { password, verification_token_hash, password_reset_token_hash, ...safeUser } = row;
		return safeUser;
	});
};

const findUserByIdWithPassword = async (userId) => {
	const userSelect = await buildUserSelect();
	const result = await pool.query(
		`
			${userSelect.sql}
			WHERE u.${userSelect.userIdColumn} = $1
		`,
		[userId]
	);

	return result.rows[0] || null;
};

const updateLastLoginAt = async (userId) => {
	const userSelect = await buildUserSelect();
	await pool.query(`UPDATE users SET last_login_at = NOW() WHERE ${userSelect.userIdColumn} = $1`, [userId]);
};

const storeEmailVerificationToken = async ({ user_id, token_hash, expires_at }) => {
	const userSelect = await buildUserSelect();
	await pool.query(
		`
			UPDATE users
			SET
				verification_token_hash = $1,
				verification_token_expiry = $2
			WHERE ${userSelect.userIdColumn} = $3
		`,
		[token_hash, expires_at, user_id]
	);
};

const findUserByVerificationToken = async (token_hash) => {
	const userSelect = await buildUserSelect();
	const result = await pool.query(
		`
			${userSelect.sql}
			WHERE u.verification_token_hash = $1
		`,
		[token_hash]
	);

	return result.rows[0] || null;
};

const markEmailVerified = async (userId) => {
	const userSelect = await buildUserSelect();
	const result = await pool.query(
		`
			UPDATE users
			SET
				email_verified = TRUE,
				is_verified = TRUE,
				verification_token_hash = NULL,
				verification_token_expiry = NULL
			WHERE ${userSelect.userIdColumn} = $1
			RETURNING ${userSelect.userIdColumn} AS id, email_verified, is_verified
		`,
		[userId]
	);

	return result.rows[0] || null;
};

const storePasswordResetToken = async ({ user_id, token_hash, expires_at }) => {
	const userSelect = await buildUserSelect();
	await pool.query(
		`
			UPDATE users
			SET
				password_reset_token_hash = $1,
				password_reset_token_expiry = $2
			WHERE ${userSelect.userIdColumn} = $3
		`,
		[token_hash, expires_at, user_id]
	);
};

const findUserByPasswordResetToken = async (token_hash) => {
	const userSelect = await buildUserSelect();
	const result = await pool.query(
		`
			${userSelect.sql}
			WHERE u.password_reset_token_hash = $1
		`,
		[token_hash]
	);

	return result.rows[0] || null;
};

const clearPasswordResetToken = async (userId) => {
	const userSelect = await buildUserSelect();
	await pool.query(
		`
			UPDATE users
			SET
				password_reset_token_hash = NULL,
				password_reset_token_expiry = NULL
			WHERE ${userSelect.userIdColumn} = $1
		`,
		[userId]
	);
};

const updateUserProfile = async ({
	user_id,
	name,
	phone,
	address,
	bio,
	farm_name,
	farm_type,
	farm_location,
	farm_size,
	experience_years,
}) => {
	const client = await pool.connect();

	try {
		await client.query("BEGIN");
		const userSelect = await buildUserSelect(client);
		const profileColumns = (await tableExists("farmer_profiles", client))
			? await getTableColumns("farmer_profiles", client)
			: [];
		const updatableUserFields = [
			{ column: "name", value: name },
			{ column: "phone", value: phone },
			{ column: "address", value: address },
			{ column: "bio", value: bio },
		].filter(({ column }) => userSelect.userColumns.includes(column));
		const setClauses = updatableUserFields.map(({ column }, index) => `${column} = COALESCE($${index + 1}, ${column})`);
		const values = updatableUserFields.map(({ value }) => value ?? null);
		values.push(user_id);

		const result = await client.query(
			`
				UPDATE users
				SET
					${setClauses.join(",\n\t\t\t\t\t")}
				WHERE ${userSelect.userIdColumn} = $${values.length}
				RETURNING ${userSelect.userIdColumn} AS id
			`,
			values
		);

		if (!result.rows[0]) {
			await client.query("ROLLBACK");
			return null;
		}

		if (profileColumns.includes("user_id")) {
			await client.query(
				`
					INSERT INTO farmer_profiles (
						user_id,
						farm_name,
						farm_type,
						farm_location,
						farm_size,
						experience_years,
						bio
					)
					VALUES ($1, $2, $3, $4, $5, $6, $7)
					ON CONFLICT (user_id)
					DO UPDATE SET
						farm_name = COALESCE(EXCLUDED.farm_name, farmer_profiles.farm_name),
						farm_type = COALESCE(EXCLUDED.farm_type, farmer_profiles.farm_type),
						farm_location = COALESCE(EXCLUDED.farm_location, farmer_profiles.farm_location),
						farm_size = COALESCE(EXCLUDED.farm_size, farmer_profiles.farm_size),
						experience_years = COALESCE(EXCLUDED.experience_years, farmer_profiles.experience_years),
						bio = COALESCE(EXCLUDED.bio, farmer_profiles.bio)
				`,
				[
					user_id,
					farm_name ?? null,
					farm_type ?? null,
					farm_location ?? null,
					farm_size ?? null,
					experience_years ? Number(experience_years) : null,
					bio ?? null,
				]
			);
		}

		const updated = await client.query(
			`
				${userSelect.sql}
				WHERE u.${userSelect.userIdColumn} = $1
			`,
			[user_id]
		);

		await client.query("COMMIT");

		if (!updated.rows[0]) {
			return null;
		}

		const { password, verification_token_hash, password_reset_token_hash, ...safeUser } = updated.rows[0];
		return safeUser;
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	} finally {
		client.release();
	}
};

const updateUserPassword = async ({ user_id, password_hash }) => {
	const userSelect = await buildUserSelect();
	await pool.query(
		`
			UPDATE users
			SET ${userSelect.passwordColumn} = $1
			WHERE ${userSelect.userIdColumn} = $2
		`,
		[password_hash, user_id]
	);
};

const updateMfaPreference = async ({ user_id, enabled }) => {
	const userSelect = await buildUserSelect();
	const result = await pool.query(
		`
			UPDATE users
			SET mfa_enabled = $1
			WHERE ${userSelect.userIdColumn} = $2
			RETURNING ${userSelect.userIdColumn} AS id, mfa_enabled
		`,
		[enabled, user_id]
	);

	return result.rows[0] || null;
};

const calculateProfileProgress = (profile = {}) => {
	const sections = {
		personal: Boolean(profile.name && profile.email && profile.phone),
		farm_info: Boolean(profile.farm_name && (profile.farm_size_hectares !== null && profile.farm_size_hectares !== undefined) && (profile.farming_type || profile.farm_type)),
		location: Boolean(profile.region && (profile.woreda || profile.kebele || profile.pickup_address || profile.address)),
		crops: Boolean(Array.isArray(profile.primary_crops) && profile.primary_crops.length > 0),
		payout: Boolean(profile.bank_name && profile.bank_account_number),
	};

	let completedCount = 0;
	if (sections.personal) completedCount++;
	if (sections.farm_info) completedCount++;
	if (sections.location) completedCount++;
	if (sections.crops) completedCount++;
	if (sections.payout) completedCount++;

	const score = Math.round((completedCount / 5) * 100);

	return {
		score,
		sections,
		profile,
	};
};

const getFarmerProfileExtended = async (userId) => {
	const result = await pool.query(
		`
			SELECT
				u.id,
				u.name,
				u.email,
				u.phone,
				u.address,
				u.account_status,
				u.kyc_status,
				u.kyc_tier,
				u.is_verified,
				u.email_verified,
				u.created_at,
				fp.profile_id,
				fp.farm_name,
				COALESCE(fp.farming_type, fp.farm_type) AS farming_type,
				fp.farm_type,
				fp.bio,
				fp.region,
				fp.woreda,
				fp.kebele,
				fp.gps_coordinates,
				fp.farm_size_hectares,
				fp.primary_crops,
				fp.id_number,
				fp.id_type,
				fp.bank_name,
				fp.bank_account_number,
				fp.pickup_address,
				fp.pickup_instructions
			FROM users u
			LEFT JOIN farmer_profiles fp ON fp.user_id = u.id
			WHERE u.id = $1
		`,
		[userId]
	);

	if (!result.rows[0]) {
		return null;
	}

	return result.rows[0];
};

const updateFarmerProfileExtended = async (userId, data = {}) => {
	const client = await pool.connect();
	try {
		await client.query("BEGIN");

		// 1. Update users fields if provided
		const userFields = [];
		const userValues = [];
		let pCount = 1;

		if (data.name !== undefined) {
			userFields.push(`name = $${pCount++}`);
			userValues.push(data.name);
		}
		if (data.phone !== undefined) {
			userFields.push(`phone = $${pCount++}`);
			userValues.push(data.phone);
		}
		if (data.address !== undefined) {
			userFields.push(`address = $${pCount++}`);
			userValues.push(data.address);
		}

		if (userFields.length > 0) {
			userValues.push(userId);
			await client.query(
				`UPDATE users SET ${userFields.join(", ")} WHERE id = $${pCount}`,
				userValues
			);
		}

		// 2. Upsert farmer_profiles
		await client.query(
			`
				INSERT INTO farmer_profiles (
					user_id, farm_name, farm_type, bio, region, woreda, kebele,
					gps_coordinates, farm_size_hectares, farming_type, primary_crops,
					id_number, id_type, bank_name, bank_account_number, pickup_address,
					pickup_instructions, updated_at
				) VALUES (
					$1, $2, $3, $4, $5, $6, $7,
					$8, $9, $10, $11,
					$12, $13, $14, $15, $16,
					$17, NOW()
				)
				ON CONFLICT (user_id) DO UPDATE SET
					farm_name = COALESCE(EXCLUDED.farm_name, farmer_profiles.farm_name),
					farm_type = COALESCE(EXCLUDED.farm_type, farmer_profiles.farm_type),
					bio = COALESCE(EXCLUDED.bio, farmer_profiles.bio),
					region = COALESCE(EXCLUDED.region, farmer_profiles.region),
					woreda = COALESCE(EXCLUDED.woreda, farmer_profiles.woreda),
					kebele = COALESCE(EXCLUDED.kebele, farmer_profiles.kebele),
					gps_coordinates = COALESCE(EXCLUDED.gps_coordinates, farmer_profiles.gps_coordinates),
					farm_size_hectares = COALESCE(EXCLUDED.farm_size_hectares, farmer_profiles.farm_size_hectares),
					farming_type = COALESCE(EXCLUDED.farming_type, farmer_profiles.farming_type),
					primary_crops = COALESCE(EXCLUDED.primary_crops, farmer_profiles.primary_crops),
					id_number = COALESCE(EXCLUDED.id_number, farmer_profiles.id_number),
					id_type = COALESCE(EXCLUDED.id_type, farmer_profiles.id_type),
					bank_name = COALESCE(EXCLUDED.bank_name, farmer_profiles.bank_name),
					bank_account_number = COALESCE(EXCLUDED.bank_account_number, farmer_profiles.bank_account_number),
					pickup_address = COALESCE(EXCLUDED.pickup_address, farmer_profiles.pickup_address),
					pickup_instructions = COALESCE(EXCLUDED.pickup_instructions, farmer_profiles.pickup_instructions),
					updated_at = NOW()
			`,
			[
				userId,
				data.farm_name ?? null,
				data.farm_type ?? data.farming_type ?? null,
				data.bio ?? null,
				data.region ?? null,
				data.woreda ?? null,
				data.kebele ?? null,
				data.gps_coordinates ?? null,
				data.farm_size_hectares !== undefined && data.farm_size_hectares !== null && data.farm_size_hectares !== "" ? Number(data.farm_size_hectares) : null,
				data.farming_type ?? data.farm_type ?? null,
				data.primary_crops ?? null,
				data.id_number ?? null,
				data.id_type ?? null,
				data.bank_name ?? null,
				data.bank_account_number ?? null,
				data.pickup_address ?? null,
				data.pickup_instructions ?? null,
			]
		);

		await client.query("COMMIT");

		const updated = await getFarmerProfileExtended(userId);
		return updated;
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	} finally {
		client.release();
	}
};

module.exports = {
	calculateProfileProgress,
	clearPasswordResetToken,
	createUser,
	findAllUsers,
	findUserByEmail,
	findUserById,
	findUserByIdWithPassword,
	findUserByPasswordResetToken,
	findUserByVerificationToken,
	getFarmerProfileExtended,
	markEmailVerified,
	storeEmailVerificationToken,
	storePasswordResetToken,
	updateFarmerProfileExtended,
	updateLastLoginAt,
	updateMfaPreference,
	updateUserPassword,
	updateUserProfile,
};
