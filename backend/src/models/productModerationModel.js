const { pool } = require("../config/db");
const auditService = require("../services/auditService");

/**
 * Get paginated products for admin moderation & catalog governance
 */
const getProductsAdmin = async ({
  page = 1,
  limit = 20,
  search = "",
  status = "",
  moderation_status = "all",
  category = "",
  farmer = "",
  min_price = null,
  max_price = null,
} = {}) => {
  const offset = (Math.max(1, parseInt(page, 10)) - 1) * Math.max(1, parseInt(limit, 10));
  const pageLimit = Math.max(1, parseInt(limit, 10));

  const conditions = ["p.deleted_at IS NULL"];
  const params = [];

  if (search && search.trim() !== "") {
    params.push(`%${search.trim()}%`);
    conditions.push(`(p.name ILIKE $${params.length} OR p.description ILIKE $${params.length} OR f.name ILIKE $${params.length})`);
  }

  if (status && status !== "all") {
    params.push(status);
    conditions.push(`p.status = $${params.length}`);
  }

  if (moderation_status && moderation_status !== "all") {
    params.push(moderation_status);
    conditions.push(`p.moderation_status = $${params.length}`);
  }

  if (category && category !== "all") {
    params.push(category);
    conditions.push(`(c.name = $${params.length} OR CAST(p.category_id AS TEXT) = $${params.length})`);
  }

  if (farmer && farmer.trim() !== "") {
    params.push(`%${farmer.trim()}%`);
    conditions.push(`(f.name ILIKE $${params.length} OR CAST(p.farmer_id AS TEXT) = $${params.length})`);
  }

  if (min_price !== null && !isNaN(Number(min_price))) {
    params.push(Number(min_price));
    conditions.push(`p.price >= $${params.length}`);
  }

  if (max_price !== null && !isNaN(Number(max_price))) {
    params.push(Number(max_price));
    conditions.push(`p.price <= $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countQuery = `
    SELECT COUNT(p.id) as total
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN users f ON f.id = p.farmer_id
    ${whereClause}
  `;

  const dataQuery = `
    SELECT 
      p.id,
      p.name,
      p.description,
      p.price,
      p.discount_price,
      p.stock,
      p.status,
      p.image_url,
      p.created_at,
      p.moderation_status,
      p.moderation_reason,
      p.moderated_at,
      p.grade,
      p.quality_notes,
      p.cold_chain_required,
      c.id as category_id,
      c.name as category_name,
      f.id as farmer_id,
      f.name as farmer_name,
      f.email as farmer_email,
      f.phone as farmer_phone,
      fp.farm_name,
      mod_user.name as moderated_by_name,
      (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) as reviews_count,
      (SELECT COALESCE(AVG(r.rating), 0) FROM reviews r WHERE r.product_id = p.id) as average_rating
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN users f ON f.id = p.farmer_id
    LEFT JOIN farmer_profiles fp ON fp.user_id = f.id
    LEFT JOIN users mod_user ON mod_user.id = p.moderated_by
    ${whereClause}
    ORDER BY 
      CASE WHEN p.moderation_status = 'pending' THEN 1
           WHEN p.moderation_status = 'changes_requested' THEN 2
           WHEN p.moderation_status = 'rejected' THEN 3
           ELSE 4 END ASC,
      p.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  const countsQuery = `
    SELECT 
      COUNT(*) FILTER (WHERE moderation_status = 'pending') as pending,
      COUNT(*) FILTER (WHERE moderation_status = 'approved') as approved,
      COUNT(*) FILTER (WHERE moderation_status = 'rejected') as rejected,
      COUNT(*) FILTER (WHERE moderation_status = 'changes_requested') as changes_requested,
      COUNT(*) as all_count
    FROM products
  `;

  const [totalRes, dataRes, countsRes] = await Promise.all([
    pool.query(countQuery, params),
    pool.query(dataQuery, [...params, pageLimit, offset]),
    pool.query(countsQuery),
  ]);

  const total = parseInt(totalRes.rows[0].total, 10);

  return {
    products: dataRes.rows,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: pageLimit,
      totalPages: Math.ceil(total / pageLimit) || 1,
    },
    counts: countsRes.rows[0],
  };
};

/**
 * Get comprehensive single product dossier
 */
const getProductDossier = async (productId) => {
  const prodRes = await pool.query(
    `SELECT 
      p.*,
      c.name as category_name,
      c.attributes as category_attributes,
      f.name as farmer_name,
      f.email as farmer_email,
      f.phone as farmer_phone,
      f.kyc_status as farmer_kyc_status,
      f.kyc_tier as farmer_kyc_tier,
      fp.farm_name,
      fp.farm_type,
      mod_user.name as moderated_by_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN users f ON f.id = p.farmer_id
    LEFT JOIN farmer_profiles fp ON fp.user_id = f.id
    LEFT JOIN users mod_user ON mod_user.id = p.moderated_by
    WHERE p.id = $1`,
    [productId]
  );

  if (prodRes.rows.length === 0) {
    return null;
  }

  const product = prodRes.rows[0];

  const [actionsRes, reviewsRes, corridorRes] = await Promise.all([
    pool.query(
      `SELECT pma.*, u.name as admin_name
       FROM product_moderation_actions pma
       LEFT JOIN users u ON u.id = pma.admin_id
       WHERE pma.product_id = $1
       ORDER BY pma.created_at DESC`,
      [productId]
    ),
    pool.query(
      `SELECT r.*, u.name as reviewer_name
       FROM reviews r
       LEFT JOIN users u ON u.id = r.user_id
       WHERE r.product_id = $1
       ORDER BY r.created_at DESC`,
      [productId]
    ),
    pool.query(
      `SELECT * FROM price_corridors
       WHERE commodity_name ILIKE $1 OR commodity_name ILIKE $2
       LIMIT 1`,
      [`%${product.name}%`, `%${product.category_name || ""}%`]
    ),
  ]);

  return {
    product,
    moderationActions: actionsRes.rows,
    reviews: reviewsRes.rows,
    benchmarkCorridor: corridorRes.rows[0] || null,
  };
};

/**
 * Moderate single product
 */
const moderateProduct = async ({
  productId,
  action, // 'approve' | 'reject' | 'request_changes' | 'deactivate'
  reason = null,
  notes = null,
  grade = null,
  cold_chain_required = null,
  actorId,
  ipAddress = null,
  userAgent = null,
}) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const prodRes = await client.query(
      `SELECT * FROM products WHERE id = $1 FOR UPDATE`,
      [productId]
    );

    if (prodRes.rows.length === 0) {
      throw new Error(`Product #${productId} not found`);
    }

    const current = prodRes.rows[0];
    const previousState = {
      status: current.status,
      moderation_status: current.moderation_status,
      grade: current.grade,
      cold_chain_required: current.cold_chain_required,
    };

    let nextModerationStatus = current.moderation_status;
    let nextListingStatus = current.status;

    if (action === "approve") {
      nextModerationStatus = "approved";
      nextListingStatus = "active";
    } else if (action === "reject") {
      nextModerationStatus = "rejected";
      nextListingStatus = "draft";
    } else if (action === "request_changes") {
      nextModerationStatus = "changes_requested";
      nextListingStatus = "draft";
    } else if (action === "deactivate") {
      nextListingStatus = "deactivated";
    }

    const nextGrade = grade !== null && grade !== undefined ? grade : (current.grade || "Grade A");
    const nextColdChain = cold_chain_required !== null && cold_chain_required !== undefined
      ? Boolean(cold_chain_required)
      : (current.cold_chain_required || false);

    // Record in product_moderation_actions
    const actionRes = await client.query(
      `INSERT INTO product_moderation_actions
        (product_id, admin_id, action, previous_status, new_status, reason, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [productId, actorId, action, current.moderation_status, nextModerationStatus, reason, notes]
    );

    // Update product
    const updateRes = await client.query(
      `UPDATE products 
       SET moderation_status = $1,
           status = $2,
           moderation_reason = $3,
           moderated_by = $4,
           moderated_at = CURRENT_TIMESTAMP,
           grade = $5,
           cold_chain_required = $6,
           quality_notes = COALESCE($7, quality_notes)
       WHERE id = $8
       RETURNING *`,
      [
        nextModerationStatus,
        nextListingStatus,
        reason,
        actorId,
        nextGrade,
        nextColdChain,
        notes,
        productId,
      ]
    );

    const updated = updateRes.rows[0];

    // Notify farmer
    const title = action === "approve"
      ? `Listing Approved: ${current.name}`
      : action === "reject"
      ? `Listing Rejected: ${current.name}`
      : action === "request_changes"
      ? `Changes Requested: ${current.name}`
      : `Listing Deactivated: ${current.name}`;

    const message = reason || notes || `Administrative action taken on your product ${current.name}.`;

    await client.query(
      `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
       VALUES ($1, 'system', $2, $3, false, CURRENT_TIMESTAMP)`,
      [current.farmer_id, title, message]
    );

    // Audit log
    await auditService.record({
      actorId,
      action: `product.${action}`,
      entityType: "product",
      entityId: productId,
      beforeState: previousState,
      afterState: {
        status: nextListingStatus,
        moderation_status: nextModerationStatus,
        grade: nextGrade,
        cold_chain_required: nextColdChain,
      },
      reason: reason || notes || `Product moderation: ${action}`,
      ipAddress,
      userAgent,
      client,
    });

    await client.query("COMMIT");

    return {
      product: updated,
      action: actionRes.rows[0],
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Bulk moderate products in a single database transaction
 */
const bulkModerateProducts = async ({
  productIds,
  action,
  reason = null,
  notes = null,
  actorId,
  ipAddress = null,
  userAgent = null,
}) => {
  if (!Array.isArray(productIds) || productIds.length === 0) {
    throw new Error("No product IDs provided for bulk action");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const results = [];

    for (const pid of productIds) {
      const prodRes = await client.query(
        `SELECT * FROM products WHERE id = $1 FOR UPDATE`,
        [pid]
      );

      if (prodRes.rows.length === 0) continue;
      const current = prodRes.rows[0];

      let nextModeration = current.moderation_status;
      let nextListing = current.status;

      if (action === "approve") {
        nextModeration = "approved";
        nextListing = "active";
      } else if (action === "reject") {
        nextModeration = "rejected";
        nextListing = "draft";
      } else if (action === "deactivate") {
        nextListing = "deactivated";
      }

      await client.query(
        `INSERT INTO product_moderation_actions
          (product_id, admin_id, action, previous_status, new_status, reason, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [pid, actorId, action, current.moderation_status, nextModeration, reason, notes]
      );

      const upd = await client.query(
        `UPDATE products
         SET moderation_status = $1, status = $2, moderation_reason = $3,
             moderated_by = $4, moderated_at = CURRENT_TIMESTAMP
         WHERE id = $5 RETURNING *`,
        [nextModeration, nextListing, reason, actorId, pid]
      );

      await auditService.record({
        actorId,
        action: `product.bulk_${action}`,
        entityType: "product",
        entityId: pid,
        beforeState: { status: current.status, moderation_status: current.moderation_status },
        afterState: { status: nextListing, moderation_status: nextModeration },
        reason: reason || `Bulk ${action} action applied`,
        ipAddress,
        userAgent,
        client,
      });

      results.push(upd.rows[0]);
    }

    await client.query("COMMIT");

    return {
      success: true,
      modifiedCount: results.length,
      action,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get product moderation history
 */
const getProductModerationHistory = async (productId) => {
  const res = await pool.query(
    `SELECT pma.*, u.name as admin_name
     FROM product_moderation_actions pma
     LEFT JOIN users u ON u.id = pma.admin_id
     WHERE pma.product_id = $1
     ORDER BY pma.created_at DESC`,
    [productId]
  );
  return res.rows;
};

/**
 * Categories Governance CRUD
 */
const getCategoriesAdmin = async () => {
  const res = await pool.query(
    `SELECT 
      c.*,
      COUNT(p.id) as products_count,
      COUNT(p.id) FILTER (WHERE p.status = 'active') as active_products_count
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id
     GROUP BY c.id
     ORDER BY c.name ASC`
  );
  return res.rows;
};

const createCategoryAdmin = async ({ name, description = null, icon = null, attributes = [], actorId }) => {
  const res = await pool.query(
    `INSERT INTO categories (name, description, icon, is_active, attributes)
     VALUES ($1, $2, $3, true, $4)
     RETURNING *`,
    [name, description, icon, JSON.stringify(attributes)]
  );

  const newCat = res.rows[0];

  await auditService.record({
    actorId,
    action: "category.created",
    entityType: "category",
    entityId: newCat.id,
    afterState: newCat,
    reason: `Created category ${name}`,
  });

  return newCat;
};

const updateCategoryAdmin = async ({ id, name, description, icon, is_active, attributes, actorId }) => {
  const existing = await pool.query(`SELECT * FROM categories WHERE id = $1`, [id]);
  if (existing.rows.length === 0) {
    throw new Error(`Category #${id} not found`);
  }

  const prev = existing.rows[0];

  const res = await pool.query(
    `UPDATE categories
     SET name = COALESCE($1, name),
         description = COALESCE($2, description),
         icon = COALESCE($3, icon),
         is_active = COALESCE($4, is_active),
         attributes = COALESCE($5, attributes)
     WHERE id = $6
     RETURNING *`,
    [name, description, icon, is_active, attributes ? JSON.stringify(attributes) : null, id]
  );

  const updated = res.rows[0];

  await auditService.record({
    actorId,
    action: "category.updated",
    entityType: "category",
    entityId: id,
    beforeState: prev,
    afterState: updated,
    reason: `Updated category #${id} ${name || prev.name}`,
  });

  return updated;
};

const deleteCategoryAdmin = async (id, actorId) => {
  // Check if any product is assigned to this category
  const pCheck = await pool.query(`SELECT COUNT(*) as cnt FROM products WHERE category_id = $1`, [id]);
  if (parseInt(pCheck.rows[0].cnt, 10) > 0) {
    throw new Error(`Cannot delete category #${id}: ${pCheck.rows[0].cnt} products are currently linked to it. Please reassign products first.`);
  }

  const existing = await pool.query(`SELECT * FROM categories WHERE id = $1`, [id]);
  if (existing.rows.length === 0) {
    throw new Error(`Category #${id} not found`);
  }

  await pool.query(`DELETE FROM categories WHERE id = $1`, [id]);

  await auditService.record({
    actorId,
    action: "category.deleted",
    entityType: "category",
    entityId: id,
    beforeState: existing.rows[0],
    reason: `Deleted category #${id}`,
  });

  return { success: true };
};

/**
 * Reviews Moderation
 */
const getReviewsAdmin = async ({ page = 1, limit = 20, search = "", is_hidden = null, rating = null } = {}) => {
  const offset = (Math.max(1, parseInt(page, 10)) - 1) * Math.max(1, parseInt(limit, 10));
  const pageLimit = Math.max(1, parseInt(limit, 10));

  const conditions = [];
  const params = [];

  if (search && search.trim() !== "") {
    params.push(`%${search.trim()}%`);
    conditions.push(`(r.comment ILIKE $${params.length} OR u.name ILIKE $${params.length} OR p.name ILIKE $${params.length})`);
  }

  if (is_hidden !== null && is_hidden !== undefined && is_hidden !== "") {
    params.push(is_hidden === "true" || is_hidden === true);
    conditions.push(`r.is_hidden = $${params.length}`);
  }

  if (rating !== null && rating !== undefined && rating !== "") {
    params.push(parseInt(rating, 10));
    conditions.push(`r.rating = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countQuery = `
    SELECT COUNT(r.id) as total
    FROM reviews r
    LEFT JOIN users u ON u.id = r.user_id
    LEFT JOIN products p ON p.id = r.product_id
    ${whereClause}
  `;

  const dataQuery = `
    SELECT 
      r.*,
      u.name as reviewer_name,
      u.email as reviewer_email,
      p.name as product_name,
      p.image_url as product_image_url,
      f.name as farmer_name,
      hid.name as hidden_by_name
    FROM reviews r
    LEFT JOIN users u ON u.id = r.user_id
    LEFT JOIN products p ON p.id = r.product_id
    LEFT JOIN users f ON f.id = p.farmer_id
    LEFT JOIN users hid ON hid.id = r.hidden_by
    ${whereClause}
    ORDER BY r.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  const [totalRes, dataRes] = await Promise.all([
    pool.query(countQuery, params),
    pool.query(dataQuery, [...params, pageLimit, offset]),
  ]);

  const total = parseInt(totalRes.rows[0].total, 10);

  return {
    reviews: dataRes.rows,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: pageLimit,
      totalPages: Math.ceil(total / pageLimit) || 1,
    },
  };
};

const moderateReviewAdmin = async ({ reviewId, is_hidden, reason = null, actorId }) => {
  const existing = await pool.query(`SELECT * FROM reviews WHERE id = $1`, [reviewId]);
  if (existing.rows.length === 0) {
    throw new Error(`Review #${reviewId} not found`);
  }

  const prev = existing.rows[0];
  const hidden = Boolean(is_hidden);

  const res = await pool.query(
    `UPDATE reviews 
     SET is_hidden = $1,
         hidden_by = $2,
         hidden_at = $3,
         hidden_reason = $4
     WHERE id = $5
     RETURNING *`,
    [hidden, hidden ? actorId : null, hidden ? new Date() : null, hidden ? reason : null, reviewId]
  );

  const updated = res.rows[0];

  await auditService.record({
    actorId,
    action: hidden ? "review.hidden" : "review.restored",
    entityType: "review",
    entityId: reviewId,
    beforeState: { is_hidden: prev.is_hidden },
    afterState: { is_hidden: hidden, reason },
    reason: reason || (hidden ? "Review hidden by admin" : "Review restored by admin"),
  });

  return updated;
};

/**
 * Campaigns Governance
 */
const getCampaignsAdmin = async ({ page = 1, limit = 20, status = "all", search = "" } = {}) => {
  const offset = (Math.max(1, parseInt(page, 10)) - 1) * Math.max(1, parseInt(limit, 10));
  const pageLimit = Math.max(1, parseInt(limit, 10));

  const conditions = [];
  const params = [];

  if (search && search.trim() !== "") {
    params.push(`%${search.trim()}%`);
    conditions.push(`(c.name ILIKE $${params.length} OR f.name ILIKE $${params.length} OR c.voucher_code ILIKE $${params.length})`);
  }

  if (status && status !== "all") {
    params.push(status);
    conditions.push(`c.status = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countQuery = `
    SELECT COUNT(c.id) as total
    FROM campaigns c
    LEFT JOIN users f ON f.id = c.farmer_id
    ${whereClause}
  `;

  const dataQuery = `
    SELECT 
      c.*,
      f.name as farmer_name,
      f.email as farmer_email,
      appr.name as approved_by_name,
      (SELECT COUNT(*) FROM campaign_products cp WHERE cp.campaign_id = c.id) as products_count
    FROM campaigns c
    LEFT JOIN users f ON f.id = c.farmer_id
    LEFT JOIN users appr ON appr.id = c.approved_by
    ${whereClause}
    ORDER BY c.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  const [totalRes, dataRes] = await Promise.all([
    pool.query(countQuery, params),
    pool.query(dataQuery, [...params, pageLimit, offset]),
  ]);

  const total = parseInt(totalRes.rows[0].total, 10);

  return {
    campaigns: dataRes.rows,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: pageLimit,
      totalPages: Math.ceil(total / pageLimit) || 1,
    },
  };
};

const moderateCampaignAdmin = async ({ campaignId, action, reason = null, budget_cap = null, actorId }) => {
  const existing = await pool.query(`SELECT * FROM campaigns WHERE id = $1`, [campaignId]);
  if (existing.rows.length === 0) {
    throw new Error(`Campaign #${campaignId} not found`);
  }

  const prev = existing.rows[0];
  let newStatus = prev.status;

  if (action === "approve") {
    newStatus = "active";
  } else if (action === "reject") {
    newStatus = "rejected";
  } else if (action === "pause") {
    newStatus = "paused";
  }

  const res = await pool.query(
    `UPDATE campaigns
     SET status = $1,
         approved_by = $2,
         approved_at = $3,
         budget_cap = COALESCE($4, budget_cap),
         rejection_reason = $5
     WHERE id = $6
     RETURNING *`,
    [
      newStatus,
      action === "approve" ? actorId : prev.approved_by,
      action === "approve" ? new Date() : prev.approved_at,
      budget_cap,
      action === "reject" ? reason : null,
      campaignId,
    ]
  );

  const updated = res.rows[0];

  await auditService.record({
    actorId,
    action: `campaign.${action}`,
    entityType: "campaign",
    entityId: campaignId,
    beforeState: { status: prev.status },
    afterState: { status: newStatus, budget_cap },
    reason: reason || `Campaign ${action} by admin`,
  });

  return updated;
};

/**
 * Price Corridors & Outlier Detection
 */
const getPriceCorridors = async ({ region = "", commodity = "" } = {}) => {
  const conditions = [];
  const params = [];

  if (region && region !== "all") {
    params.push(region);
    conditions.push(`region = $${params.length}`);
  }

  if (commodity && commodity.trim() !== "") {
    params.push(`%${commodity.trim()}%`);
    conditions.push(`commodity_name ILIKE $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const res = await pool.query(
    `SELECT pc.*, u.name as updated_by_name
     FROM price_corridors pc
     LEFT JOIN users u ON u.id = pc.updated_by
     ${whereClause}
     ORDER BY pc.commodity_name ASC, pc.region ASC`,
    params
  );

  return res.rows;
};

const upsertPriceCorridor = async ({
  commodity_name,
  region,
  min_price,
  max_price,
  target_price,
  unit = "kg",
  deviation_threshold_pct = 15.00,
  actorId,
}) => {
  const res = await pool.query(
    `INSERT INTO price_corridors 
      (commodity_name, region, min_price, max_price, target_price, unit, deviation_threshold_pct, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
     ON CONFLICT (commodity_name, region) DO UPDATE 
     SET min_price = EXCLUDED.min_price,
         max_price = EXCLUDED.max_price,
         target_price = EXCLUDED.target_price,
         unit = EXCLUDED.unit,
         deviation_threshold_pct = EXCLUDED.deviation_threshold_pct,
         updated_by = EXCLUDED.updated_by,
         updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [commodity_name, region, min_price, max_price, target_price, unit, deviation_threshold_pct, actorId]
  );

  const corridor = res.rows[0];

  await auditService.record({
    actorId,
    action: "pricing.corridor_upserted",
    entityType: "price_corridor",
    entityId: corridor.id,
    afterState: corridor,
    reason: `Set corridor for ${commodity_name} in ${region} (${min_price} - ${max_price} ETB)`,
  });

  return corridor;
};

/**
 * Detect real-time price outliers against regional corridors
 */
const getPriceOutliers = async () => {
  const res = await pool.query(
    `SELECT 
      p.id,
      p.name as product_name,
      p.price,
      p.status,
      p.moderation_status,
      f.name as farmer_name,
      f.id as farmer_id,
      COALESCE(fp.farm_type, 'Oromia') as region,
      c.name as category_name,
      pc.min_price as corridor_min,
      pc.max_price as corridor_max,
      pc.target_price as corridor_target,
      pc.deviation_threshold_pct,
      CASE 
        WHEN p.price < pc.min_price THEN 'BELOW_MIN'
        WHEN p.price > pc.max_price THEN 'ABOVE_MAX'
        ELSE 'NORMAL'
      END as outlier_type,
      ROUND(CAST(((p.price - pc.target_price) / pc.target_price * 100) AS NUMERIC), 1) as deviation_pct
    FROM products p
    JOIN users f ON f.id = p.farmer_id
    LEFT JOIN farmer_profiles fp ON fp.user_id = f.id
    LEFT JOIN categories c ON c.id = p.category_id
    JOIN price_corridors pc ON (p.name ILIKE '%' || pc.commodity_name || '%' OR pc.commodity_name ILIKE '%' || p.name || '%')
    WHERE p.price < pc.min_price OR p.price > pc.max_price
    ORDER BY ABS(p.price - pc.target_price) DESC`
  );

  return res.rows;
};

const evaluateProductPricing = async (productId) => {
  const prodRes = await pool.query(
    `SELECT p.*, c.name as category_name, f.name as farmer_name
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN users f ON f.id = p.farmer_id
     WHERE p.id = $1`,
    [productId]
  );

  if (prodRes.rows.length === 0) {
    throw new Error(`Product #${productId} not found`);
  }

  const p = prodRes.rows[0];

  const corridorRes = await pool.query(
    `SELECT * FROM price_corridors
     WHERE commodity_name ILIKE '%' || $1 || '%' OR $1 ILIKE '%' || commodity_name || '%'
     LIMIT 1`,
    [p.name]
  );

  const corridor = corridorRes.rows[0] || null;

  if (!corridor) {
    return {
      status: "NO_CORRIDOR",
      message: `No active price corridor found for '${p.name}'.`,
      product: p,
      corridor: null,
    };
  }

  const price = parseFloat(p.price);
  const min = parseFloat(corridor.min_price);
  const max = parseFloat(corridor.max_price);
  const target = parseFloat(corridor.target_price);

  let status = "WITHIN_RANGE";
  let message = "Price is within acceptable market corridor";
  if (price < min) {
    status = "POTENTIAL_DUMPING";
    message = `Price ETB ${price} is below corridor floor ETB ${min} (${((min - price) / target * 100).toFixed(1)}% below target)`;
  } else if (price > max) {
    status = "POTENTIAL_GOUGING";
    message = `Price ETB ${price} exceeds corridor ceiling ETB ${max} (${((price - max) / target * 100).toFixed(1)}% above target)`;
  }

  return {
    status,
    message,
    product: p,
    corridor,
    deviation_pct: (((price - target) / target) * 100).toFixed(1),
  };
};

module.exports = {
  getProductsAdmin,
  getProductDossier,
  moderateProduct,
  bulkModerateProducts,
  getProductModerationHistory,
  getCategoriesAdmin,
  createCategoryAdmin,
  updateCategoryAdmin,
  deleteCategoryAdmin,
  getReviewsAdmin,
  moderateReviewAdmin,
  getCampaignsAdmin,
  moderateCampaignAdmin,
  getPriceCorridors,
  upsertPriceCorridor,
  getPriceOutliers,
  evaluateProductPricing,
};

