const { pool } = require("../config/db");
const auditService = require("../services/auditService");

/**
 * Get paginated farmer KYC queue with tab counts
 */
const getKycQueue = async ({
  page = 1,
  limit = 20,
  status = "all",
  search = "",
  tier = "",
  region = "",
} = {}) => {
  const offset = (Math.max(1, parseInt(page, 10)) - 1) * Math.max(1, parseInt(limit, 10));
  const pageLimit = Math.max(1, parseInt(limit, 10));

  const conditions = ["u.role = 'farmer'"];
  const params = [];

  if (search && search.trim() !== "") {
    params.push(`%${search.trim()}%`);
    conditions.push(
      `(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR u.phone ILIKE $${params.length} OR fp.farm_name ILIKE $${params.length})`
    );
  }

  if (tier && tier !== "all") {
    params.push(tier);
    conditions.push(`u.kyc_tier = $${params.length}`);
  }

  if (region && region !== "all") {
    params.push(`%${region.trim()}%`);
    conditions.push(`(fp.farm_type ILIKE $${params.length} OR fp.bio ILIKE $${params.length})`);
  }

  if (status && status !== "all") {
    if (status === "field_visit") {
      conditions.push(`(u.kyc_status = 'field_visit' OR (SELECT COUNT(*) FROM field_visits fv WHERE fv.farmer_id = u.id) > 0)`);
    } else {
      params.push(status);
      conditions.push(`u.kyc_status = $${params.length}`);
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countQuery = `
    SELECT COUNT(u.id) as total
    FROM users u
    LEFT JOIN farmer_profiles fp ON fp.user_id = u.id
    ${whereClause}
  `;

  const dataQuery = `
    SELECT 
      u.id,
      u.name,
      u.email,
      u.phone,
      u.role,
      u.account_status,
      u.is_verified,
      u.kyc_status,
      u.kyc_tier,
      u.created_at,
      fp.profile_id,
      fp.farm_name,
      fp.farm_type,
      fp.bio,
      (SELECT COUNT(*) FROM kyc_documents kd WHERE kd.user_id = u.id) as documents_count,
      (SELECT COUNT(*) FROM field_visits fv WHERE fv.farmer_id = u.id) as field_visits_count,
      (SELECT decision FROM kyc_reviews kr WHERE kr.user_id = u.id ORDER BY kr.created_at DESC LIMIT 1) as latest_decision,
      (SELECT reason FROM kyc_reviews kr WHERE kr.user_id = u.id ORDER BY kr.created_at DESC LIMIT 1) as latest_decision_reason,
      (SELECT created_at FROM kyc_reviews kr WHERE kr.user_id = u.id ORDER BY kr.created_at DESC LIMIT 1) as last_reviewed_at
    FROM users u
    LEFT JOIN farmer_profiles fp ON fp.user_id = u.id
    ${whereClause}
    ORDER BY 
      CASE WHEN u.kyc_status = 'pending' THEN 1
           WHEN u.kyc_status = 'under_review' THEN 2
           WHEN u.kyc_status = 'field_visit' THEN 3
           WHEN u.kyc_status = 'changes_requested' THEN 4
           ELSE 5 END ASC,
      u.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  // Status counts for queue tabs
  const tabCountsQuery = `
    SELECT 
      COUNT(*) FILTER (WHERE u.kyc_status = 'pending') as pending,
      COUNT(*) FILTER (WHERE u.kyc_status = 'under_review') as under_review,
      COUNT(*) FILTER (WHERE u.kyc_status = 'field_visit' OR (SELECT COUNT(*) FROM field_visits fv WHERE fv.farmer_id = u.id) > 0) as field_visit,
      COUNT(*) FILTER (WHERE u.kyc_status = 'approved') as approved,
      COUNT(*) FILTER (WHERE u.kyc_status = 'rejected') as rejected,
      COUNT(*) FILTER (WHERE u.kyc_status = 'changes_requested') as changes_requested,
      COUNT(*) as all_count
    FROM users u
    WHERE u.role = 'farmer'
  `;

  const [totalRes, dataRes, tabCountsRes] = await Promise.all([
    pool.query(countQuery, params),
    pool.query(dataQuery, [...params, pageLimit, offset]),
    pool.query(tabCountsQuery),
  ]);

  const total = parseInt(totalRes.rows[0].total, 10);

  return {
    farmers: dataRes.rows,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: pageLimit,
      totalPages: Math.ceil(total / pageLimit) || 1,
    },
    counts: tabCountsRes.rows[0],
  };
};

/**
 * Get comprehensive KYC dossier for a single farmer
 */
const getKycDossier = async (farmerId) => {
  const userRes = await pool.query(
    `SELECT 
      u.id,
      u.name,
      u.email,
      u.phone,
      u.role,
      u.account_status,
      u.is_verified,
      u.kyc_status,
      u.kyc_tier,
      u.created_at,
      u.updated_at,
      fp.profile_id,
      fp.farm_name,
      fp.farm_type,
      fp.bio
    FROM users u
    LEFT JOIN farmer_profiles fp ON fp.user_id = u.id
    WHERE u.id = $1 AND u.role = 'farmer'`,
    [farmerId]
  );

  if (userRes.rows.length === 0) {
    return null;
  }

  const farmer = userRes.rows[0];

  const [docsRes, visitsRes, reviewsRes] = await Promise.all([
    pool.query(
      `SELECT 
        kd.*,
        rev.name as reviewer_name
      FROM kyc_documents kd
      LEFT JOIN users rev ON rev.id = kd.reviewer_id
      WHERE kd.user_id = $1
      ORDER BY kd.created_at DESC`,
      [farmerId]
    ),
    pool.query(
      `SELECT 
        fv.*,
        agent.name as agent_name
      FROM field_visits fv
      LEFT JOIN users agent ON agent.id = fv.agent_id
      WHERE fv.farmer_id = $1
      ORDER BY fv.visit_date DESC, fv.created_at DESC`,
      [farmerId]
    ),
    pool.query(
      `SELECT 
        kr.*,
        rev.name as reviewer_name
      FROM kyc_reviews kr
      LEFT JOIN users rev ON rev.id = kr.reviewer_id
      WHERE kr.user_id = $1
      ORDER BY kr.created_at DESC`,
      [farmerId]
    ),
  ]);

  return {
    farmer,
    documents: docsRes.rows,
    fieldVisits: visitsRes.rows,
    reviews: reviewsRes.rows,
  };
};

/**
 * Add document to KYC dossier
 */
const addKycDocument = async ({
  userId,
  documentType,
  documentUrl,
  publicId = null,
  expiresAt = null,
  reviewerId = null,
  actorId = null,
  ipAddress = null,
  userAgent = null,
}) => {
  const res = await pool.query(
    `INSERT INTO kyc_documents 
      (user_id, document_type, document_url, public_id, status, reviewer_id, expires_at)
     VALUES ($1, $2, $3, $4, 'pending', $5, $6)
     RETURNING *`,
    [userId, documentType, documentUrl, publicId, reviewerId, expiresAt]
  );

  const newDoc = res.rows[0];

  await auditService.record({
    actorId: actorId || reviewerId,
    action: "kyc.document_uploaded",
    entityType: "kyc_document",
    entityId: newDoc.id,
    afterState: newDoc,
    reason: `Uploaded ${documentType} for farmer KYC`,
    ipAddress,
    userAgent,
  });

  return newDoc;
};

/**
 * Delete a KYC document
 */
const deleteKycDocument = async ({ documentId, actorId = null, ipAddress = null, userAgent = null }) => {
  const existing = await pool.query(`SELECT * FROM kyc_documents WHERE id = $1`, [documentId]);
  if (existing.rows.length === 0) {
    return null;
  }

  await pool.query(`DELETE FROM kyc_documents WHERE id = $1`, [documentId]);

  await auditService.record({
    actorId,
    action: "kyc.document_deleted",
    entityType: "kyc_document",
    entityId: documentId,
    beforeState: existing.rows[0],
    reason: `Deleted KYC document ${documentId}`,
    ipAddress,
    userAgent,
  });

  return existing.rows[0];
};

/**
 * Record a field visit
 */
const addFieldVisit = async ({
  farmerId,
  agentId,
  visitDate = new Date(),
  findings,
  gpsCoordinates = null,
  verifiedCrops = null,
  recommendation = "approve",
  actorId = null,
  ipAddress = null,
  userAgent = null,
}) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const res = await client.query(
      `INSERT INTO field_visits 
        (farmer_id, agent_id, visit_date, findings, gps_coordinates, verified_crops, recommendation)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [farmerId, agentId, visitDate, findings, gpsCoordinates, verifiedCrops, recommendation]
    );

    const visit = res.rows[0];

    // If status is currently pending, advance to under_review or field_visit
    await client.query(
      `UPDATE users 
       SET kyc_status = 'field_visit', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND kyc_status IN ('pending', 'under_review')`,
      [farmerId]
    );

    await auditService.record({
      actorId: actorId || agentId,
      action: "kyc.field_visit_logged",
      entityType: "field_visit",
      entityId: visit.id,
      afterState: visit,
      reason: `Recorded field visit for farmer #${farmerId}: recommendation=${recommendation}`,
      ipAddress,
      userAgent,
      client,
    });

    await client.query("COMMIT");
    return visit;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Review farmer KYC: approve, reject, request_info, under_review
 */
const reviewKyc = async ({
  farmerId,
  decision, // 'approve' | 'reject' | 'request_info' | 'under_review'
  tier = "tier_1",
  reason = null,
  notes = null,
  actorId,
  ipAddress = null,
  userAgent = null,
}) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const userRes = await client.query(
      `SELECT id, name, email, role, kyc_status, kyc_tier FROM users WHERE id = $1 FOR UPDATE`,
      [farmerId]
    );

    if (userRes.rows.length === 0) {
      throw new Error(`Farmer #${farmerId} not found`);
    }

    const farmer = userRes.rows[0];
    const previousState = { kyc_status: farmer.kyc_status, kyc_tier: farmer.kyc_tier };

    let nextKycStatus = farmer.kyc_status;
    let nextTier = farmer.kyc_tier;

    if (decision === "approve") {
      nextKycStatus = "approved";
      nextTier = tier || "tier_1";
    } else if (decision === "reject") {
      nextKycStatus = "rejected";
    } else if (decision === "request_info") {
      nextKycStatus = "changes_requested";
    } else if (decision === "under_review") {
      nextKycStatus = "under_review";
    }

    // Insert into kyc_reviews
    const reviewRes = await client.query(
      `INSERT INTO kyc_reviews 
        (user_id, reviewer_id, decision, tier, reason, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [farmerId, actorId, decision, nextTier, reason, notes]
    );

    const review = reviewRes.rows[0];

    // Update users table
    await client.query(
      `UPDATE users 
       SET kyc_status = $1, kyc_tier = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [nextKycStatus, nextTier, farmerId]
    );

    // Notify farmer
    const title = decision === "approve"
      ? "KYC Verification Approved"
      : decision === "reject"
      ? "KYC Verification Rejected"
      : "KYC Verification: Additional Info Needed";

    const msg = notes || reason || (decision === "approve" ? `Your farm profile has been verified at ${nextTier}.` : "Please review the notes provided by admin.");

    await client.query(
      `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
       VALUES ($1, 'system', $2, $3, false, CURRENT_TIMESTAMP)`,
      [farmerId, title, msg]
    );

    // Immutable audit record
    await auditService.record({
      actorId,
      action: `kyc.${decision}`,
      entityType: "user",
      entityId: farmerId,
      beforeState: previousState,
      afterState: { kyc_status: nextKycStatus, kyc_tier: nextTier, review_id: review.id },
      reason: reason || notes || `KYC decision: ${decision}`,
      ipAddress,
      userAgent,
      client,
    });

    await client.query("COMMIT");

    return {
      success: true,
      decision,
      kyc_status: nextKycStatus,
      kyc_tier: nextTier,
      review,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get unified KYC history timeline for farmer
 */
const getKycHistory = async (farmerId) => {
  const [reviews, visits, documents, auditLogs] = await Promise.all([
    pool.query(
      `SELECT 
        kr.id,
        'review' as event_type,
        kr.decision,
        kr.tier,
        kr.reason,
        kr.notes,
        kr.created_at,
        rev.name as actor_name
       FROM kyc_reviews kr
       LEFT JOIN users rev ON rev.id = kr.reviewer_id
       WHERE kr.user_id = $1`,
      [farmerId]
    ),
    pool.query(
      `SELECT 
        fv.id,
        'field_visit' as event_type,
        fv.recommendation as decision,
        null as tier,
        fv.findings as reason,
        fv.verified_crops as notes,
        fv.created_at,
        agent.name as actor_name
       FROM field_visits fv
       LEFT JOIN users agent ON agent.id = fv.agent_id
       WHERE fv.farmer_id = $1`,
      [farmerId]
    ),
    pool.query(
      `SELECT 
        kd.id,
        'document_upload' as event_type,
        kd.status as decision,
        kd.document_type as tier,
        kd.rejection_reason as reason,
        kd.document_url as notes,
        kd.created_at,
        rev.name as actor_name
       FROM kyc_documents kd
       LEFT JOIN users rev ON rev.id = kd.reviewer_id
       WHERE kd.user_id = $1`,
      [farmerId]
    ),
    pool.query(
      `SELECT 
        al.id,
        'audit' as event_type,
        al.action as decision,
        null as tier,
        al.reason,
        null as notes,
        al.created_at,
        u.name as actor_name
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.actor_id
       WHERE al.entity_type = 'user' AND al.entity_id = $1 AND al.action LIKE 'kyc.%'`,
      [farmerId]
    ),
  ]);

  const timeline = [
    ...reviews.rows,
    ...visits.rows,
    ...documents.rows,
    ...auditLogs.rows,
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return timeline;
};

module.exports = {
  getKycQueue,
  getKycDossier,
  addKycDocument,
  deleteKycDocument,
  addFieldVisit,
  reviewKyc,
  getKycHistory,
};

