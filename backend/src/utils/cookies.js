const REFRESH_TOKEN_COOKIE_NAME = "gh_refresh_token";

const getRefreshTokenTtlDays = () => {
  const configuredValue = Number(process.env.REFRESH_TOKEN_TTL_DAYS);
  return Number.isInteger(configuredValue) && configuredValue > 0 ? configuredValue : 7;
};

const getRefreshCookieMaxAgeMs = () => {
  return getRefreshTokenTtlDays() * 24 * 60 * 60 * 1000;
};

const parseCookies = (cookieHeader = "") => {
  if (!cookieHeader || typeof cookieHeader !== "string") {
    return {};
  }

  return cookieHeader.split(";").reduce((accumulator, pair) => {
    const separatorIndex = pair.indexOf("=");

    if (separatorIndex === -1) {
      return accumulator;
    }

    const key = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();

    if (key) {
      accumulator[key] = decodeURIComponent(value);
    }

    return accumulator;
  }, {});
};

const getRefreshTokenFromRequest = (req) => {
  if (req.body && typeof req.body === "object" && req.body.refresh_token) {
    return String(req.body.refresh_token).trim();
  }

  if (req.headers && req.headers["x-refresh-token"]) {
    return String(req.headers["x-refresh-token"]).trim();
  }

  const cookies = parseCookies(req.headers && req.headers.cookie ? req.headers.cookie : "");
  return cookies[REFRESH_TOKEN_COOKIE_NAME] || null;
};

const buildRefreshCookieOptions = ({ rememberMe, ttlDays } = {}) => {
  const options = {
    httpOnly: true,
    sameSite: process.env.REFRESH_COOKIE_SAMESITE || "lax",
    secure:
      process.env.REFRESH_COOKIE_SECURE === "true" || process.env.NODE_ENV === "production",
    path: process.env.REFRESH_COOKIE_PATH || "/api/auth",
  };

  if (rememberMe !== false) {
    const days = Number.isInteger(ttlDays) && ttlDays > 0 ? ttlDays : getRefreshTokenTtlDays();
    options.maxAge = days * 24 * 60 * 60 * 1000;
  }

  return options;
};

const setRefreshTokenCookie = (res, token, options = {}) => {
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, token, buildRefreshCookieOptions(options));
};

const clearRefreshTokenCookie = (res) => {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, buildRefreshCookieOptions());
};

const shouldExposeRefreshToken = () => {
  return process.env.NODE_ENV === "test" || process.env.EXPOSE_REFRESH_TOKEN_IN_BODY === "true";
};

module.exports = {
  REFRESH_TOKEN_COOKIE_NAME,
  clearRefreshTokenCookie,
  getRefreshTokenFromRequest,
  getRefreshTokenTtlDays,
  parseCookies,
  setRefreshTokenCookie,
  shouldExposeRefreshToken,
};
