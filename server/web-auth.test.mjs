import assert from "node:assert/strict";
import test from "node:test";
import { Hono } from "hono";
import { createWebAuth, registerWebAuthRoutes } from "./web-auth.mjs";

const config = {
  issuer: "https://sendero-test.us.auth0.com/",
  audience: "https://sendero.example/mcp",
  clientId: "web-client",
  clientSecret: "web-client-secret",
  publicWebUrl: "https://sendero.example",
  sessionSecret: "sendero-test-session-secret-that-is-long-enough",
  now: () => Date.UTC(2026, 7, 27, 12, 0, 0),
  randomBytes: (size) => Buffer.alloc(size, 7),
};

function cookiePair(response, name) {
  const setCookie = response.headers.get("set-cookie");
  const match = setCookie?.match(new RegExp(`(?:^|, )${name}=([^;]+)`));
  return match ? `${name}=${match[1]}` : undefined;
}

test("starts Auth0 Authorization Code + PKCE with a short HttpOnly flow cookie", async () => {
  const app = new Hono();
  registerWebAuthRoutes(app, createWebAuth(config));
  const response = await app.request("https://sendero.example/auth/login?returnTo=%2Fapp%2Ftrips%2Fabc");

  assert.equal(response.status, 302);
  const location = new URL(response.headers.get("location"));
  assert.equal(location.origin, "https://sendero-test.us.auth0.com");
  assert.equal(location.pathname, "/authorize");
  assert.equal(location.searchParams.get("response_type"), "code");
  assert.equal(location.searchParams.get("code_challenge_method"), "S256");
  assert.equal(location.searchParams.get("audience"), config.audience);
  assert.equal(location.searchParams.get("ui_locales"), "es");
  assert.match(response.headers.get("set-cookie"), /sendero_auth_flow=/);
  assert.match(response.headers.get("set-cookie"), /HttpOnly/i);
  assert.match(response.headers.get("set-cookie"), /Secure/i);
  assert.match(response.headers.get("set-cookie"), /SameSite=Lax/i);
});

test("keeps the active Sendero language in Universal Login", async () => {
  const app = new Hono();
  registerWebAuthRoutes(app, createWebAuth(config));
  const localized = await app.request(
    "https://sendero.example/auth/login?returnTo=%2Fapp%2Fnew%3Flang%3Dfr",
    { headers: { "Accept-Language": "de-DE,de;q=0.9" } },
  );
  assert.equal(
    new URL(localized.headers.get("location")).searchParams.get("ui_locales"),
    "fr-FR",
  );

  const remembered = await app.request(
    "https://sendero.example/auth/login?returnTo=%2Fapp",
    { headers: { Cookie: "sendero_locale=pt" } },
  );
  assert.equal(
    new URL(remembered.headers.get("location")).searchParams.get("ui_locales"),
    "pt-BR",
  );
});

test("forces fresh authentication for a verified-email retry and returns to the pending invitation", async () => {
  const webAuth = createWebAuth({
    ...config,
    fetchImpl: async () => new Response(JSON.stringify({
      access_token: "fresh-access-token",
      id_token: "fresh-id-token",
      expires_in: 3600,
    }), { status: 200, headers: { "Content-Type": "application/json" } }),
    verifyIdToken: async (_token, { nonce }) => ({
      sub: "auth0|verified-invitee",
      email: "invitee@example.com",
      email_verified: true,
      nonce,
    }),
  });
  const app = new Hono();
  registerWebAuthRoutes(app, webAuth);
  app.post("/pending", async (context) => {
    await webAuth.storePendingInvitation(context, {
      invitationId: "invitation_verified",
      tokenHash: "verified-token-hash",
      webId: "trip_web_verified",
    });
    return context.json({ stored: true });
  });
  app.get("/pending", async (context) =>
    context.json({ invitation: await webAuth.readPendingInvitation(context) }));

  const stored = await app.request("https://sendero.example/pending", { method: "POST" });
  const pendingCookie = cookiePair(stored, "sendero_pending_invitation");
  const login = await app.request(
    "https://sendero.example/auth/login?returnTo=%2Finvite%2Ftrip_web_verified&reauth=1",
    { headers: { Cookie: pendingCookie } },
  );
  const authorize = new URL(login.headers.get("location"));
  assert.equal(authorize.searchParams.get("prompt"), "login");

  const callback = await app.request(
    `https://sendero.example/auth/callback?code=fresh-code&state=${authorize.searchParams.get("state")}`,
    { headers: { Cookie: `${pendingCookie}; ${cookiePair(login, "sendero_auth_flow")}` } },
  );
  assert.equal(callback.status, 302);
  assert.equal(callback.headers.get("location"), "/invite/trip_web_verified");
  assert.doesNotMatch(callback.headers.get("set-cookie") || "", /sendero_pending_invitation=;/);

  const pending = await app.request("https://sendero.example/pending", {
    headers: { Cookie: pendingCookie },
  });
  assert.equal((await pending.json()).invitation.webId, "trip_web_verified");

  const session = await app.request("https://sendero.example/api/session", {
    headers: { Cookie: cookiePair(callback, "__Host-sendero_session") },
  });
  assert.equal((await session.json()).user.emailVerified, true);
});

test("rejects external return targets before they reach the encrypted flow", async () => {
  const app = new Hono();
  registerWebAuthRoutes(app, createWebAuth(config));
  const response = await app.request(
    "https://sendero.example/auth/login?returnTo=https%3A%2F%2Fevil.example%2Fsteal",
  );
  assert.equal(response.status, 302);
  assert.match(response.headers.get("set-cookie"), /sendero_auth_flow=/);
});

test("completes the callback, creates an encrypted session, and exposes only safe profile data", async () => {
  const tokenCalls = [];
  const authenticated = [];
  const webAuth = createWebAuth({
    ...config,
    fetchImpl: async (url, init) => {
      tokenCalls.push({ url: String(url), init });
      return new Response(JSON.stringify({
        access_token: "access-token",
        refresh_token: "refresh-token",
        id_token: "id-token",
        expires_in: 3600,
        scope: "openid profile email trips:read trips:write trips:share",
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
    verifyIdToken: async (_token, { nonce }) => ({
      sub: "auth0|sendero-user",
      email: "traveler@example.com",
      email_verified: true,
      name: "Traveler",
      nonce,
    }),
    onAuthenticated: async (value) => authenticated.push(value),
  });
  const app = new Hono();
  registerWebAuthRoutes(app, webAuth);

  const login = await app.request("https://sendero.example/auth/login?returnTo=%2Fapp%2Ftrips%2Fabc");
  const authorize = new URL(login.headers.get("location"));
  const flowCookie = cookiePair(login, "sendero_auth_flow");
  const callback = await app.request(
    `https://sendero.example/auth/callback?code=auth-code&state=${authorize.searchParams.get("state")}`,
    { headers: { Cookie: flowCookie } },
  );

  assert.equal(callback.status, 302);
  assert.equal(callback.headers.get("location"), "/app/trips/abc");
  assert.equal(tokenCalls.length, 1);
  assert.equal(authenticated.length, 1);
  assert.equal(authenticated[0].accessToken, "access-token");
  assert.equal(authenticated[0].identity.email, "traveler@example.com");
  assert.match(String(tokenCalls[0].init.body), /code_verifier=/);
  const sessionCookie = cookiePair(callback, "__Host-sendero_session");
  assert.ok(sessionCookie);

  const session = await app.request("https://sendero.example/api/session", {
    headers: { Cookie: sessionCookie },
  });
  assert.equal(session.status, 200);
  const payload = await session.json();
  assert.deepEqual(payload.user, {
    id: "auth0|sendero-user",
    subject: "auth0|sendero-user",
    email: "traveler@example.com",
    emailVerified: true,
    name: "Traveler",
  });
  assert.equal(typeof payload.csrfToken, "string");
  assert.doesNotMatch(JSON.stringify(payload), /access-token|refresh-token|id-token/);
});

test("returns a safe signed-out session response instead of treating it as an API failure", async () => {
  const app = new Hono();
  registerWebAuthRoutes(app, createWebAuth(config));
  const response = await app.request("https://sendero.example/api/session");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    authenticated: false,
    loginUrl: "/auth/login",
  });
});

test("keeps a pending invitation encrypted and HttpOnly across an authentication redirect", async () => {
  const webAuth = createWebAuth(config);
  const app = new Hono();
  app.post("/pending", async (context) => {
    await webAuth.storePendingInvitation(context, {
      invitationId: "invitation_123",
      tokenHash: "hash-secret",
      webId: "web_123",
    });
    return context.json({ stored: true });
  });
  app.get("/pending", async (context) =>
    context.json({ invitation: await webAuth.readPendingInvitation(context) }));
  app.delete("/pending", (context) => {
    webAuth.clearPendingInvitation(context);
    return context.json({ cleared: true });
  });

  const stored = await app.request("https://sendero.example/pending", { method: "POST" });
  const cookie = cookiePair(stored, "sendero_pending_invitation");
  assert.ok(cookie);
  assert.match(stored.headers.get("set-cookie"), /HttpOnly/i);
  assert.doesNotMatch(stored.headers.get("set-cookie"), /hash-secret|invitation_123/);

  const read = await app.request("https://sendero.example/pending", {
    headers: { Cookie: cookie },
  });
  assert.deepEqual((await read.json()).invitation, {
    invitationId: "invitation_123",
    tokenHash: "hash-secret",
    webId: "web_123",
    iat: 1787832000,
    exp: 1787918400,
  });

  const cleared = await app.request("https://sendero.example/pending", {
    method: "DELETE",
    headers: { Cookie: cookie },
  });
  assert.match(cleared.headers.get("set-cookie"), /sendero_pending_invitation=;/);
});

test("requires the exact same-origin CSRF token to sign out", async () => {
  const webAuth = createWebAuth({
    ...config,
    fetchImpl: async () => new Response(JSON.stringify({
      access_token: "access-token",
      id_token: "id-token",
      expires_in: 3600,
    }), { status: 200, headers: { "Content-Type": "application/json" } }),
    verifyIdToken: async (_token, { nonce }) => ({ sub: "auth0|user", nonce }),
  });
  const app = new Hono();
  registerWebAuthRoutes(app, webAuth);
  const login = await app.request("https://sendero.example/auth/login");
  const authorize = new URL(login.headers.get("location"));
  const callback = await app.request(
    `https://sendero.example/auth/callback?code=code&state=${authorize.searchParams.get("state")}`,
    { headers: { Cookie: cookiePair(login, "sendero_auth_flow") } },
  );
  const sessionCookie = cookiePair(callback, "__Host-sendero_session");
  const sessionResponse = await app.request("https://sendero.example/api/session", {
    headers: { Cookie: sessionCookie },
  });
  const { csrfToken } = await sessionResponse.json();

  const rejected = await app.request("https://sendero.example/auth/logout", {
    method: "POST",
    headers: { Cookie: sessionCookie, Origin: "https://evil.example", "X-CSRF-Token": csrfToken },
  });
  assert.equal(rejected.status, 403);

  const accepted = await app.request("https://sendero.example/auth/logout", {
    method: "POST",
    headers: {
      Cookie: sessionCookie,
      Origin: "https://sendero.example",
      "X-CSRF-Token": csrfToken,
    },
  });
  assert.equal(accepted.status, 200);
  assert.deepEqual(await accepted.json(), { signedOut: true });
});

test("refreshes an expired browser access token without exposing the refresh token", async () => {
  let currentTime = Date.UTC(2026, 7, 27, 12, 0, 0);
  const tokenGrants = [];
  const webAuth = createWebAuth({
    ...config,
    now: () => currentTime,
    fetchImpl: async (_url, init) => {
      const grant = new URLSearchParams(init.body).get("grant_type");
      tokenGrants.push(grant);
      return new Response(JSON.stringify(
        grant === "refresh_token"
          ? { access_token: "refreshed-access", expires_in: 3600 }
          : {
              access_token: "initial-access",
              refresh_token: "refresh-token",
              id_token: "id-token",
              expires_in: 30,
            },
      ), { status: 200, headers: { "Content-Type": "application/json" } });
    },
    verifyIdToken: async (_token, { nonce }) => ({ sub: "auth0|user", nonce }),
  });
  const app = new Hono();
  registerWebAuthRoutes(app, webAuth);
  app.get("/test-access", async (context) => {
    const session = await webAuth.accessSession(context);
    return context.json({ accessToken: session?.accessToken });
  });

  const login = await app.request("https://sendero.example/auth/login");
  const authorize = new URL(login.headers.get("location"));
  const callback = await app.request(
    `https://sendero.example/auth/callback?code=code&state=${authorize.searchParams.get("state")}`,
    { headers: { Cookie: cookiePair(login, "sendero_auth_flow") } },
  );
  currentTime += 31_000;
  const response = await app.request("https://sendero.example/test-access", {
    headers: { Cookie: cookiePair(callback, "__Host-sendero_session") },
  });
  assert.deepEqual(tokenGrants, ["authorization_code", "refresh_token"]);
  assert.deepEqual(await response.json(), { accessToken: "refreshed-access" });
  assert.match(response.headers.get("set-cookie"), /__Host-sendero_session=/);
  assert.doesNotMatch(response.headers.get("set-cookie"), /refresh-token|refreshed-access/);
});
