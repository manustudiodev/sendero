import {
  createHash,
  createHmac,
  randomBytes as nodeRandomBytes,
  timingSafeEqual,
} from "node:crypto";
import { EncryptJWT, createRemoteJWKSet, jwtDecrypt, jwtVerify } from "jose";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { resolveUiLocale, uiLanguage } from "../shared/ui-locale.mjs";

const FLOW_COOKIE = "sendero_auth_flow";
const PENDING_INVITATION_COOKIE = "sendero_pending_invitation";
const SESSION_COOKIE = "__Host-sendero_session";
const LOCAL_SESSION_COOKIE = "sendero_session";
const FLOW_TTL_SECONDS = 10 * 60;
const PENDING_INVITATION_TTL_SECONDS = 24 * 60 * 60;
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const AUTH0_UI_LOCALES = Object.freeze({
  de: "de",
  en: "en",
  es: "es",
  fr: "fr-FR",
  pt: "pt-BR",
});

function auth0UiLocale(locale) {
  return AUTH0_UI_LOCALES[uiLanguage(locale)] || "es";
}

function normalizedIssuer(value) {
  if (!value) return undefined;
  const url = new URL(value);
  return url.href.endsWith("/") ? url.href : `${url.href}/`;
}

function normalizedOrigin(value) {
  if (!value) return undefined;
  return new URL(value).origin;
}

function secretKey(secret) {
  if (typeof secret !== "string" || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("SENDERO_WEB_SESSION_KEY must contain at least 32 bytes.");
  }
  return createHash("sha256").update(secret, "utf8").digest();
}

function base64url(bytes) {
  return Buffer.from(bytes).toString("base64url");
}

function safeReturnTo(value, fallback = "/app") {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }
  try {
    const url = new URL(value, "https://sendero.invalid");
    if (url.origin !== "https://sendero.invalid") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

function scopesFromTokenResponse(tokenResponse, fallbackScopes) {
  const value = typeof tokenResponse.scope === "string"
    ? tokenResponse.scope
    : fallbackScopes.join(" ");
  return value.split(/\s+/).filter(Boolean);
}

function constantTimeEqual(left, right) {
  const leftBytes = Buffer.from(String(left));
  const rightBytes = Buffer.from(String(right));
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function cookieName(context) {
  return new URL(context.req.url).protocol === "https:" ? SESSION_COOKIE : LOCAL_SESSION_COOKIE;
}

function cookieOptions(context, overrides = {}) {
  const secure = new URL(context.req.url).protocol === "https:";
  return {
    httpOnly: true,
    path: "/",
    sameSite: "Lax",
    secure,
    ...overrides,
  };
}

async function encryptPayload(payload, key, ttlSeconds, nowSeconds) {
  return new EncryptJWT(payload)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM", typ: "JWT" })
    .setIssuedAt(nowSeconds)
    .setExpirationTime(nowSeconds + ttlSeconds)
    .encrypt(key);
}

async function decryptPayload(token, key, nowSeconds) {
  const { payload } = await jwtDecrypt(token, key, {
    clockTolerance: 5,
    currentDate: new Date(nowSeconds * 1000),
  });
  return payload;
}

export function createWebAuth({
  issuer: issuerValue,
  audience,
  clientId,
  clientSecret,
  publicWebUrl,
  sessionSecret,
  scopes = [
    "openid",
    "profile",
    "email",
    "offline_access",
    "trips:read",
    "trips:write",
    "trips:share",
  ],
  fetchImpl = fetch,
  randomBytes = nodeRandomBytes,
  now = () => Date.now(),
  verifyIdToken,
  onAuthenticated,
} = {}) {
  const issuer = normalizedIssuer(issuerValue);
  const webOrigin = normalizedOrigin(publicWebUrl);
  const configured = Boolean(
    issuer && audience && clientId && clientSecret && webOrigin && sessionSecret,
  );
  const key = sessionSecret ? secretKey(sessionSecret) : undefined;
  const jwks = issuer ? createRemoteJWKSet(new URL(".well-known/jwks.json", issuer)) : undefined;

  function requireConfigured() {
    if (!configured) throw new Error("Sendero web authentication is not configured.");
  }

  function redirectUri() {
    return `${webOrigin}/auth/callback`;
  }

  async function verifyIdentityToken(idToken, nonce) {
    if (verifyIdToken) return verifyIdToken(idToken, { issuer, clientId, nonce });
    const { payload } = await jwtVerify(idToken, jwks, {
      issuer,
      audience: clientId,
      algorithms: ["RS256"],
    });
    if (!constantTimeEqual(payload.nonce || "", nonce)) {
      throw new Error("The authentication nonce did not match.");
    }
    return payload;
  }

  async function login(context) {
    requireConfigured();
    const nowSeconds = Math.floor(now() / 1000);
    const state = base64url(randomBytes(32));
    const nonce = base64url(randomBytes(32));
    const codeVerifier = base64url(randomBytes(48));
    const codeChallenge = base64url(createHash("sha256").update(codeVerifier).digest());
    const returnTo = safeReturnTo(context.req.query("returnTo"));
    const returnUrl = new URL(returnTo, webOrigin);
    const uiLocale = auth0UiLocale(resolveUiLocale({
      acceptLanguage: context.req.header("Accept-Language") || "",
      cookie: context.req.header("Cookie") || "",
      pathname: returnUrl.pathname,
      search: returnUrl.search,
    }));
    const reauthenticate = context.req.query("reauth") === "1";
    const flow = await encryptPayload(
      { state, nonce, codeVerifier, returnTo },
      key,
      FLOW_TTL_SECONDS,
      nowSeconds,
    );
    setCookie(context, FLOW_COOKIE, flow, cookieOptions(context, {
      maxAge: FLOW_TTL_SECONDS,
      path: "/auth/callback",
    }));

    const authorizationUrl = new URL("authorize", issuer);
    authorizationUrl.search = new URLSearchParams({
      audience,
      client_id: clientId,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      nonce,
      redirect_uri: redirectUri(),
      response_type: "code",
      scope: scopes.join(" "),
      state,
      ui_locales: uiLocale,
    }).toString();
    if (reauthenticate) authorizationUrl.searchParams.set("prompt", "login");
    return context.redirect(authorizationUrl.href, 302);
  }

  async function callback(context) {
    requireConfigured();
    const nowSeconds = Math.floor(now() / 1000);
    const flowCookie = getCookie(context, FLOW_COOKIE);
    deleteCookie(context, FLOW_COOKIE, cookieOptions(context, { path: "/auth/callback" }));
    if (!flowCookie || context.req.query("error")) {
      return context.redirect("/app?auth=failed", 302);
    }

    try {
      const flow = await decryptPayload(flowCookie, key, nowSeconds);
      const code = context.req.query("code");
      const state = context.req.query("state");
      if (!code || !state || !constantTimeEqual(flow.state || "", state)) {
        throw new Error("The authentication state did not match.");
      }
      const tokenResponse = await fetchImpl(new URL("oauth/token", issuer), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: clientId,
          client_secret: clientSecret,
          code,
          code_verifier: String(flow.codeVerifier),
          redirect_uri: redirectUri(),
        }),
      });
      if (!tokenResponse.ok) throw new Error("Auth0 rejected the authorization code.");
      const tokens = await tokenResponse.json();
      if (!tokens.access_token || !tokens.id_token) {
        throw new Error("Auth0 did not return the required tokens.");
      }
      const identity = await verifyIdentityToken(tokens.id_token, String(flow.nonce));
      if (onAuthenticated) {
        await onAuthenticated({
          accessToken: tokens.access_token,
          identity,
        });
      }
      const sid = base64url(randomBytes(32));
      const session = await encryptPayload(
        {
          sid,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          accessTokenExpiresAt: nowSeconds + Number(tokens.expires_in || 3600),
          subject: identity.sub,
          email: identity.email,
          emailVerified: identity.email_verified === true,
          name: identity.name || identity.nickname || identity.email,
          scopes: scopesFromTokenResponse(tokens, scopes),
        },
        key,
        SESSION_TTL_SECONDS,
        nowSeconds,
      );
      setCookie(context, cookieName(context), session, cookieOptions(context, {
        maxAge: SESSION_TTL_SECONDS,
      }));
      return context.redirect(safeReturnTo(flow.returnTo), 302);
    } catch {
      return context.redirect("/app?auth=failed", 302);
    }
  }

  async function readSession(context) {
    if (!configured) return undefined;
    const token = getCookie(context, cookieName(context));
    if (!token) return undefined;
    try {
      return await decryptPayload(token, key, Math.floor(now() / 1000));
    } catch {
      return undefined;
    }
  }

  async function accessSession(context) {
    const session = await readSession(context);
    if (!session) return undefined;
    const nowSeconds = Math.floor(now() / 1000);
    if (Number(session.accessTokenExpiresAt || 0) > nowSeconds + 60) return session;
    if (!session.refreshToken) return undefined;

    try {
      const tokenResponse = await fetchImpl(new URL("oauth/token", issuer), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: String(session.refreshToken),
        }),
      });
      if (!tokenResponse.ok) throw new Error("Auth0 rejected the refresh token.");
      const tokens = await tokenResponse.json();
      if (!tokens.access_token) throw new Error("Auth0 did not return a refreshed access token.");
      const refreshed = {
        ...session,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || session.refreshToken,
        accessTokenExpiresAt: nowSeconds + Number(tokens.expires_in || 3600),
        scopes: scopesFromTokenResponse(tokens, session.scopes || scopes),
      };
      const encrypted = await encryptPayload(refreshed, key, SESSION_TTL_SECONDS, nowSeconds);
      setCookie(context, cookieName(context), encrypted, cookieOptions(context, {
        maxAge: SESSION_TTL_SECONDS,
      }));
      return refreshed;
    } catch {
      deleteCookie(context, cookieName(context), cookieOptions(context));
      return undefined;
    }
  }

  function csrfToken(session) {
    return createHmac("sha256", key)
      .update(`sendero-csrf:${session.sid}`)
      .digest("base64url");
  }

  async function sessionResponse(context) {
    const session = await accessSession(context);
    if (!session) {
      return context.json({
        authenticated: false,
        loginUrl: "/auth/login",
      });
    }
    return context.json({
      authenticated: true,
      user: {
        id: session.subject,
        subject: session.subject,
        email: session.email,
        emailVerified: session.emailVerified === true,
        name: session.name,
      },
      csrfToken: csrfToken(session),
      expiresAt: new Date(Number(session.exp || 0) * 1000).toISOString(),
    });
  }

  async function requireSession(context) {
    const session = await accessSession(context);
    if (!session) return { response: context.json({ error: "authentication_required" }, 401) };
    return { session };
  }

  async function storePendingInvitation(context, invitation) {
    requireConfigured();
    const nowSeconds = Math.floor(now() / 1000);
    const encrypted = await encryptPayload(
      invitation,
      key,
      PENDING_INVITATION_TTL_SECONDS,
      nowSeconds,
    );
    setCookie(
      context,
      PENDING_INVITATION_COOKIE,
      encrypted,
      cookieOptions(context, { maxAge: PENDING_INVITATION_TTL_SECONDS }),
    );
  }

  async function readPendingInvitation(context) {
    if (!configured) return undefined;
    const token = getCookie(context, PENDING_INVITATION_COOKIE);
    if (!token) return undefined;
    try {
      return await decryptPayload(token, key, Math.floor(now() / 1000));
    } catch {
      deleteCookie(context, PENDING_INVITATION_COOKIE, cookieOptions(context));
      return undefined;
    }
  }

  function clearPendingInvitation(context) {
    deleteCookie(context, PENDING_INVITATION_COOKIE, cookieOptions(context));
  }

  function validateCsrf(context, session) {
    const origin = context.req.header("Origin");
    const supplied = context.req.header("X-CSRF-Token");
    return origin === webOrigin && supplied && constantTimeEqual(supplied, csrfToken(session));
  }

  async function logout(context) {
    const session = await readSession(context);
    if (session && !validateCsrf(context, session)) {
      return context.json({ error: "invalid_csrf" }, 403);
    }
    deleteCookie(context, cookieName(context), cookieOptions(context));
    return context.json({ signedOut: true });
  }

  return {
    callback,
    accessSession,
    clearPendingInvitation,
    configured,
    csrfToken,
    login,
    logout,
    readSession,
    readPendingInvitation,
    requireSession,
    sessionResponse,
    storePendingInvitation,
    validateCsrf,
  };
}

export function registerWebAuthRoutes(app, webAuth) {
  app.get("/auth/login", (context) => webAuth.login(context));
  app.get("/auth/callback", (context) => webAuth.callback(context));
  app.post("/auth/logout", (context) => webAuth.logout(context));
  app.get("/api/session", (context) => webAuth.sessionResponse(context));
}
