// Moved from middleware/authMiddleware.js during the structure refactor.
const { normalizeRole } = require("../utils/roles");
const { pool } = require("../config/db");
const { verifyAccessToken } = require("../utils/jwt");

const getUserAccountStatus = async (userId) => {
  const result = await pool.query(
    `SELECT account_status FROM users WHERE id = $1`,
    [userId]
  );

  return result.rows[0]?.account_status || "active";
};

const invalidateAccountStatusCache = (_userId) => {
  // Maintained for backward compatibility
};

const resolveActorId = async (user_id, role) => {
  if (role === "admin") {
    return user_id;
  }

  if (role === "buyer") {
    await pool.query(
      `
        INSERT INTO buyer_profiles (user_id)
        VALUES ($1)
        ON CONFLICT (user_id) DO NOTHING
      `,
      [user_id]
    );

    return user_id;
  }

  if (role === "farmer") {
    await pool.query(
      `
        INSERT INTO farmer_profiles (user_id)
        VALUES ($1)
        ON CONFLICT (user_id) DO NOTHING
      `,
      [user_id]
    );

    return user_id;
  }

  if (role === "delivery_partner") {
    try {
      await pool.query(
        `
          INSERT INTO delivery_profiles (user_id)
          VALUES ($1)
          ON CONFLICT (user_id) DO NOTHING
        `,
        [user_id]
      );
    } catch (err) {
      // Ignore if table/constraint difference
    }

    return user_id;
  }

  if (role === "field_agent") {
    try {
      await pool.query(
        `
          INSERT INTO field_agent_profiles (user_id)
          VALUES ($1)
          ON CONFLICT (user_id) DO NOTHING
        `,
        [user_id]
      );
    } catch (err) {
      // Ignore if table doesn't exist
    }

    return user_id;
  }

  return user_id;
};

const extractBearerToken = (authorizationHeader) => {
  if (!authorizationHeader || typeof authorizationHeader !== "string") {
    return null;
  }

  const [scheme, token] = authorizationHeader.trim().split(/\s+/);

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
};

const authMiddleware = async (req, res, next) => {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    return res.status(401).json({
      message: "Authorization token is required. Use: Authorization: Bearer <token>",
    });
  }

  if (!process.env.JWT_SECRET) {
    console.error("JWT verification failed: JWT_SECRET is not configured");
    return res.status(500).json({
      message: "Authentication service is not configured",
    });
  }

  try {
    const decoded = verifyAccessToken(token);

    if (!decoded || typeof decoded !== "object" || !decoded.id) {
      return res.status(401).json({
        message: "Invalid token payload",
      });
    }

    const role = normalizeRole(decoded.role);
    const user_id = decoded.id;

    // Security Gate: Enforce active account standing
    const accountStatus = await getUserAccountStatus(user_id);
    if (["suspended", "banned", "deactivated"].includes(accountStatus)) {
      return res.status(403).json({
        status: "error",
        code: "ACCOUNT_SUSPENDED",
        message: "Your account has been suspended or deactivated. Please contact platform administration.",
      });
    }

    const actor_id = await resolveActorId(user_id, role);

    req.user = {
      ...decoded,
      id: actor_id,
      user_id,
      role,
      account_status: accountStatus,
    };
    return next();
  } catch (error) {
    const errorContext = {
      name: error.name,
      message: error.message,
      path: req.originalUrl,
      method: req.method,
    };

    console.error("JWT verification failed:", errorContext);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Token has expired",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        message: "Invalid token",
      });
    }

    return res.status(500).json({
      message: "Authentication failed",
    });
  }
};

const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }
  try {
    const token = authHeader.split(" ")[1];
    const decoded = verifyAccessToken(token);
    if (decoded && decoded.id) {
      const role = normalizeRole(decoded.role);
      const user_id = decoded.id;
      const accountStatus = await getUserAccountStatus(user_id);
      const actor_id = await resolveActorId(user_id, role);
      req.user = {
        ...decoded,
        id: actor_id,
        user_id,
        role,
        account_status: accountStatus,
      };
    }
  } catch (err) {
    // Silent fail for optional auth
  }
  return next();
};

module.exports = authMiddleware;
module.exports.authMiddleware = authMiddleware;
module.exports.optionalAuth = optionalAuth;
module.exports.invalidateAccountStatusCache = invalidateAccountStatusCache;
