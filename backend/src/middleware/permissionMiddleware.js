const { pool } = require("../config/db");
const logger = require("../utils/logger");

// Cache permissions for short TTL to balance performance and freshness
const permissionCache = new Map();
const CACHE_TTL_MS = 30000; // 30 seconds

const getUserPermissions = async (userId) => {
  const cached = permissionCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached;
  }

  const result = await pool.query(
    `
      SELECT
        u.id AS user_id,
        ar.id AS role_id,
        ar.name AS role_name,
        COALESCE(
          json_agg(p.code) FILTER (WHERE p.code IS NOT NULL),
          '[]'::json
        ) AS permissions
      FROM users u
      LEFT JOIN admin_roles ar ON ar.id = u.admin_role_id
      LEFT JOIN role_permissions rp ON rp.role_id = ar.id
      LEFT JOIN permissions p ON p.id = rp.permission_id
      WHERE u.id = $1
      GROUP BY u.id, ar.id, ar.name
    `,
    [userId]
  );

  const data = result.rows[0] || {
    user_id: userId,
    role_id: null,
    role_name: null,
    permissions: [],
  };

  const payload = {
    roleId: data.role_id,
    roleName: data.role_name,
    permissions: Array.isArray(data.permissions) ? data.permissions : [],
    timestamp: Date.now(),
  };

  permissionCache.set(userId, payload);
  return payload;
};

/**
 * Clear permission cache for a user when their role changes.
 */
const invalidateUserPermissionCache = (userId) => {
  permissionCache.delete(userId);
};

/**
 * Middleware factory requiring a specific granular permission code.
 * @param {string|string[]} requiredPermissions - Permission code(s) required to proceed
 */
const permissionMiddleware = (requiredPermissions) => {
  const perms = Array.isArray(requiredPermissions)
    ? requiredPermissions
    : [requiredPermissions];

  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: "error",
        message: "Authentication is required",
      });
    }

    if (req.user.role !== "admin") {
      return res.status(403).json({
        status: "error",
        message: "Forbidden: administrative privileges required",
      });
    }

    try {
      const userPermissions = await getUserPermissions(req.user.user_id || req.user.id);
      req.user.adminRole = userPermissions.roleName;
      req.user.permissions = userPermissions.permissions;

      // Super admin has unrestricted access to all endpoints
      if (userPermissions.roleName === "super_admin") {
        return next();
      }

      // Check if user has at least one of the required permissions
      const hasPermission = perms.some((p) =>
        userPermissions.permissions.includes(p)
      );

      if (!hasPermission) {
        logger.warn("Admin access denied by permissionMiddleware", {
          userId: req.user.id,
          adminRole: userPermissions.roleName,
          required: perms,
          userHas: userPermissions.permissions,
          path: req.originalUrl,
          method: req.method,
        });

        return res.status(403).json({
          status: "error",
          message: `Forbidden: missing required permission [${perms.join(", ")}]`,
        });
      }

      return next();
    } catch (error) {
      logger.error("Permission check failed", { error: error.message });
      return res.status(500).json({
        status: "error",
        message: "Failed to verify administrative authorization",
      });
    }
  };
};

module.exports = permissionMiddleware;
module.exports.permissionMiddleware = permissionMiddleware;
module.exports.getUserPermissions = getUserPermissions;
module.exports.invalidateUserPermissionCache = invalidateUserPermissionCache;

