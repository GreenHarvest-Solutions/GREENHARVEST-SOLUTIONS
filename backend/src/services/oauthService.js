// OAuth 2.0 provider orchestration for Google, Facebook, and GitHub using native fetch + JWT state.
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { pool } = require("../config/db");
const userModel = require("../models/userModel");
const authService = require("./authService");
const { generateOpaqueToken } = require("../utils/tokenSecurity");
const { normalizeRole, isAllowedPublicRegistrationRole } = require("../utils/roles");

const OAUTH_PROVIDERS = {
  google: {
    id: "google",
    name: "Google",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: "openid email profile",
    envClientId: "GOOGLE_CLIENT_ID",
    envClientSecret: "GOOGLE_CLIENT_SECRET",
    envCallbackUrl: "GOOGLE_CALLBACK_URL",
  },
  facebook: {
    id: "facebook",
    name: "Facebook",
    authUrl: "https://www.facebook.com/v19.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v19.0/oauth/access_token",
    scopes: "email,public_profile",
    envClientId: "FACEBOOK_CLIENT_ID",
    envClientSecret: "FACEBOOK_CLIENT_SECRET",
    envCallbackUrl: "FACEBOOK_CALLBACK_URL",
  },
  github: {
    id: "github",
    name: "GitHub",
    authUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scopes: "read:user user:email",
    envClientId: "GITHUB_CLIENT_ID",
    envClientSecret: "GITHUB_CLIENT_SECRET",
    envCallbackUrl: "GITHUB_CALLBACK_URL",
  },
};

// Track consumed single-use OAuth handoff JTIs in memory to prevent replay
const consumedHandoffs = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [jti, expiresAt] of consumedHandoffs.entries()) {
    if (expiresAt <= now) consumedHandoffs.delete(jti);
  }
}, 5 * 60 * 1000).unref();

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }
  return process.env.JWT_SECRET;
};

const ensureOAuthTableExists = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS oauth_accounts (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider VARCHAR(40) NOT NULL,
      provider_user_id VARCHAR(255) NOT NULL,
      provider_email VARCHAR(255),
      avatar_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT oauth_accounts_provider_uid_unique UNIQUE (provider, provider_user_id)
    )
  `);
};

const getProviderConfig = (providerId) => {
  const key = String(providerId || "").toLowerCase();
  const cfg = OAUTH_PROVIDERS[key];
  if (!cfg) return null;

  const clientId = (process.env[cfg.envClientId] || "").trim();
  const clientSecret = (process.env[cfg.envClientSecret] || "").trim();
  const explicitCallback = (process.env[cfg.envCallbackUrl] || "").trim();

  return {
    ...cfg,
    clientId,
    clientSecret,
    explicitCallback,
    configured: Boolean(clientId && clientSecret),
  };
};

const listProvidersStatus = () => {
  return Object.keys(OAUTH_PROVIDERS).map((key) => {
    const cfg = getProviderConfig(key);
    return {
      id: cfg.id,
      name: cfg.name,
      configured: cfg.configured,
      env_keys: [cfg.envClientId, cfg.envClientSecret],
    };
  });
};

const resolveCallbackUrl = (cfg, backendBaseUrl) => {
  if (cfg.explicitCallback) return cfg.explicitCallback;
  return `${backendBaseUrl.replace(/\/$/, "")}/api/auth/oauth/${cfg.id}/callback`;
};

const buildAuthorizationUrl = ({
  providerId,
  role = "buyer",
  rememberMe = true,
  frontendOrigin,
  backendBaseUrl,
}) => {
  const cfg = getProviderConfig(providerId);
  if (!cfg) {
    const err = new Error("Unsupported OAuth provider");
    err.statusCode = 400;
    throw err;
  }

  if (!cfg.configured) {
    const err = new Error(
      `${cfg.name} sign-in is not configured yet. Set ${cfg.envClientId} and ${cfg.envClientSecret} in backend/.env.`
    );
    err.statusCode = 503;
    err.provider = cfg.id;
    err.providerName = cfg.name;
    err.envKeys = [cfg.envClientId, cfg.envClientSecret];
    throw err;
  }

  const normalizedRole = normalizeRole(role);
  const safeRole = isAllowedPublicRegistrationRole(normalizedRole) ? normalizedRole : "buyer";

  const stateToken = jwt.sign(
    {
      purpose: "oauth_state",
      provider: cfg.id,
      role: safeRole,
      remember_me: Boolean(rememberMe),
      frontend_origin: frontendOrigin,
      nonce: generateOpaqueToken(12),
    },
    getJwtSecret(),
    { expiresIn: "10m" }
  );

  const callbackUrl = resolveCallbackUrl(cfg, backendBaseUrl);
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: callbackUrl,
    response_type: "code",
    scope: cfg.scopes,
    state: stateToken,
  });

  if (cfg.id === "google") {
    params.set("access_type", "online");
    params.set("prompt", "select_account");
  }

  return `${cfg.authUrl}?${params.toString()}`;
};

const verifyStateToken = (state, expectedProvider) => {
  try {
    const decoded = jwt.verify(String(state || ""), getJwtSecret());
    if (
      !decoded ||
      decoded.purpose !== "oauth_state" ||
      decoded.provider !== expectedProvider
    ) {
      throw new Error("Invalid OAuth state");
    }
    return decoded;
  } catch {
    const err = new Error("OAuth session expired or invalid. Please try again.");
    err.statusCode = 400;
    throw err;
  }
};

const fetchProviderProfile = async ({ providerId, code, callbackUrl }) => {
  const cfg = getProviderConfig(providerId);
  if (!cfg || !cfg.configured) {
    const err = new Error("OAuth provider is not configured");
    err.statusCode = 503;
    throw err;
  }

  // Exchange code for access token
  const tokenParams = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    code: String(code),
    redirect_uri: callbackUrl,
  });

  if (cfg.id === "google") {
    tokenParams.set("grant_type", "authorization_code");
  }

  let tokenData;
  if (cfg.id === "facebook") {
    const tokenRes = await fetch(`${cfg.tokenUrl}?${tokenParams.toString()}`, {
      headers: { Accept: "application/json" },
    });
    tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData?.error?.message || "Failed to exchange Facebook auth code");
    }
  } else {
    const tokenRes = await fetch(cfg.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: tokenParams.toString(),
    });
    tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(
        tokenData?.error_description || tokenData?.error || `Failed to exchange ${cfg.name} auth code`
      );
    }
  }

  const providerAccessToken = tokenData.access_token;

  if (cfg.id === "google") {
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${providerAccessToken}` },
    });
    const profile = await profileRes.json();
    if (!profileRes.ok || !profile.id || !profile.email) {
      throw new Error("Could not retrieve verified email from Google");
    }
    return {
      provider: "google",
      provider_user_id: String(profile.id),
      email: String(profile.email).trim().toLowerCase(),
      name: profile.name || profile.email.split("@")[0],
      avatar_url: profile.picture || null,
    };
  }

  if (cfg.id === "facebook") {
    const profileRes = await fetch(
      `https://graph.facebook.com/v19.0/me?fields=id,name,email,picture.type(large)&access_token=${encodeURIComponent(
        providerAccessToken
      )}`
    );
    const profile = await profileRes.json();
    if (!profileRes.ok || !profile.id) {
      throw new Error(profile?.error?.message || "Could not retrieve Facebook profile");
    }
    if (!profile.email) {
      throw new Error(
        "Your Facebook account did not share an email address. Please grant email permission or sign in with Google/GitHub."
      );
    }
    return {
      provider: "facebook",
      provider_user_id: String(profile.id),
      email: String(profile.email).trim().toLowerCase(),
      name: profile.name || profile.email.split("@")[0],
      avatar_url: profile.picture?.data?.url || null,
    };
  }

  if (cfg.id === "github") {
    const [profileRes, emailsRes] = await Promise.all([
      fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${providerAccessToken}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "GreenHarvest-App",
        },
      }),
      fetch("https://api.github.com/user/emails", {
        headers: {
          Authorization: `Bearer ${providerAccessToken}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "GreenHarvest-App",
        },
      }),
    ]);

    const profile = await profileRes.json();
    const emails = await emailsRes.json();

    if (!profileRes.ok || !profile.id) {
      throw new Error("Could not retrieve GitHub profile");
    }

    let resolvedEmail = profile.email ? String(profile.email).trim().toLowerCase() : null;
    if (Array.isArray(emails)) {
      const primaryVerified =
        emails.find((e) => e.primary && e.verified) ||
        emails.find((e) => e.verified) ||
        emails.find((e) => e.primary) ||
        emails[0];
      if (primaryVerified?.email) {
        resolvedEmail = String(primaryVerified.email).trim().toLowerCase();
      }
    }

    if (!resolvedEmail) {
      throw new Error(
        "Could not retrieve a verified email from GitHub. Ensure a verified email exists on your GitHub account."
      );
    }

    return {
      provider: "github",
      provider_user_id: String(profile.id),
      email: resolvedEmail,
      name: profile.name || profile.login || resolvedEmail.split("@")[0],
      avatar_url: profile.avatar_url || null,
    };
  }

  throw new Error("Unsupported OAuth provider");
};

const findOrCreateOAuthUser = async ({ profile, preferredRole }) => {
  await ensureOAuthTableExists();

  // 1. Existing federated identity link
  const linkRes = await pool.query(
    `SELECT user_id FROM oauth_accounts WHERE provider = $1 AND provider_user_id = $2 LIMIT 1`,
    [profile.provider, profile.provider_user_id]
  );

  let user = null;
  if (linkRes.rows[0]) {
    user = await userModel.findUserById(linkRes.rows[0].user_id);
  }

  // 2. Match existing user by email
  if (!user) {
    user = await userModel.findUserByEmail(profile.email);
  }

  // 3. Create new verified user if first time
  if (!user) {
    const normalizedRole = normalizeRole(preferredRole);
    const safeRole = isAllowedPublicRegistrationRole(normalizedRole) ? normalizedRole : "buyer";
    const randomSecretHash = await bcrypt.hash(generateOpaqueToken(32), 10);

    user = await userModel.createUser({
      name: profile.name,
      email: profile.email,
      password: randomSecretHash,
      role: safeRole,
    });
  }

  // Security gate: enforce active account standing
  if (
    user.account_status &&
    ["suspended", "banned", "deactivated"].includes(user.account_status)
  ) {
    const err = new Error(
      "Your account has been suspended. Please contact platform administration."
    );
    err.statusCode = 403;
    throw err;
  }

  // Mark email verified because the OAuth provider verified identity/email
  if (!user.email_verified) {
    await pool.query(`UPDATE users SET email_verified = TRUE WHERE id = $1`, [user.id]);
    user.email_verified = true;
  }

  // Upsert federated link
  await pool.query(
    `
      INSERT INTO oauth_accounts (user_id, provider, provider_user_id, provider_email, avatar_url)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (provider, provider_user_id)
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        provider_email = EXCLUDED.provider_email,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = NOW()
    `,
    [user.id, profile.provider, profile.provider_user_id, profile.email, profile.avatar_url]
  );

  return user;
};

const completeOAuthCallback = async ({ providerId, code, state, backendBaseUrl }) => {
  const stateData = verifyStateToken(state, providerId);
  const cfg = getProviderConfig(providerId);
  const callbackUrl = resolveCallbackUrl(cfg, backendBaseUrl);

  const profile = await fetchProviderProfile({
    providerId,
    code,
    callbackUrl,
  });

  const user = await findOrCreateOAuthUser({
    profile,
    preferredRole: stateData.role,
  });

  const handoffCode = jwt.sign(
    {
      purpose: "oauth_handoff",
      user_id: user.id,
      remember_me: Boolean(stateData.remember_me),
      jti: generateOpaqueToken(16),
    },
    getJwtSecret(),
    { expiresIn: "90s" }
  );

  return {
    handoffCode,
    frontendOrigin: stateData.frontend_origin,
    rememberMe: Boolean(stateData.remember_me),
  };
};

const exchangeHandoffCode = async ({ code, ip = null, userAgent = null }) => {
  if (!code) {
    const err = new Error("OAuth exchange code is required");
    err.statusCode = 400;
    throw err;
  }

  let decoded;
  try {
    decoded = jwt.verify(String(code), getJwtSecret());
  } catch {
    const err = new Error("OAuth authorization expired. Please sign in again.");
    err.statusCode = 401;
    throw err;
  }

  if (!decoded || decoded.purpose !== "oauth_handoff" || !decoded.user_id || !decoded.jti) {
    const err = new Error("Invalid OAuth exchange code");
    err.statusCode = 401;
    throw err;
  }

  if (consumedHandoffs.has(decoded.jti)) {
    const err = new Error("OAuth authorization code has already been used");
    err.statusCode = 401;
    throw err;
  }
  consumedHandoffs.set(decoded.jti, (decoded.exp || 0) * 1000 || Date.now() + 120000);

  const user = await userModel.findUserById(decoded.user_id);
  if (!user) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }

  await userModel.updateLastLoginAt(user.id);
  return authService.createRefreshSession({
    user,
    created_by_ip: ip,
    user_agent: userAgent,
    remember_me: Boolean(decoded.remember_me),
  });
};

module.exports = {
  OAUTH_PROVIDERS,
  buildAuthorizationUrl,
  completeOAuthCallback,
  exchangeHandoffCode,
  listProvidersStatus,
};
