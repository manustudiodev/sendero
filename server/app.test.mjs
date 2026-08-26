import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "./app.mjs";
import { createAuthConfig } from "./auth.mjs";
import { createConvexPersistence } from "./persistence.mjs";

test("reports whether Convex storage is configured", async () => {
  const configured = createApp({ convexUrl: "https://example.convex.cloud" });
  const configuredResponse = await configured.request("/health");
  assert.equal(configuredResponse.status, 200);
  assert.deepEqual(await configuredResponse.json(), {
    status: "ok",
    service: "sendero",
    storage: "configured",
    authentication: "not_configured",
    publicSharing: "not_configured",
    mapsEmbed: "not_configured",
  });

  const unconfigured = createApp({ convexUrl: "" });
  assert.equal((await (await unconfigured.request("/health")).json()).storage, "not_configured");

  const sharingConfigured = createApp({
    publicShareSecret: "sendero-health-check-secret-with-at-least-thirty-two-bytes",
  });
  assert.equal(
    (await (await sharingConfigured.request("/health")).json()).publicSharing,
    "configured",
  );

  const mapsConfigured = createApp({ mapsEmbedApiKey: "test-key" });
  assert.equal((await (await mapsConfigured.request("/health")).json()).mapsEmbed, "configured");
});

test("publishes OAuth protected-resource metadata for ChatGPT and MCP clients", async () => {
  const authConfig = createAuthConfig({
    issuer: "https://sendero.us.auth0.com",
    audience: "https://sendero.example/mcp",
    resourceServerUrl: "https://sendero.example/mcp",
  });
  const app = createApp({ authConfig });

  for (const path of [
    "/.well-known/oauth-protected-resource",
    "/.well-known/oauth-protected-resource/mcp",
  ]) {
    const response = await app.request(path);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      resource: "https://sendero.example/mcp",
      authorization_servers: ["https://sendero.us.auth0.com/"],
      scopes_supported: ["trips:read", "trips:write", "trips:share"],
      bearer_methods_supported: ["header"],
      resource_name: "Sendero",
    });
  }
});

test("rejects malformed and invalid bearer tokens with an OAuth challenge", async () => {
  const authConfig = createAuthConfig({
    issuer: "https://sendero.us.auth0.com",
    audience: "https://sendero.example/mcp",
    resourceServerUrl: "https://sendero.example/mcp",
  });
  const warnings = [];
  const app = createApp({
    authConfig,
    verifyAccessToken: async () => {
      const error = new Error("invalid token");
      error.code = "ERR_JWT_EXPIRED";
      error.claim = "exp";
      throw error;
    },
    logger: { warn: (...args) => warnings.push(args) },
  });

  const malformed = await app.request("/mcp", {
    method: "POST",
    headers: { Authorization: "Basic nope" },
  });
  assert.equal(malformed.status, 401);
  assert.match(malformed.headers.get("www-authenticate"), /resource_metadata=/);

  const invalid = await app.request("/mcp", {
    method: "POST",
    headers: { Authorization: "Bearer nope" },
  });
  assert.equal(invalid.status, 401);
  assert.match(invalid.headers.get("www-authenticate"), /error="invalid_token"/);
  assert.deepEqual(warnings[0], [
    "[sendero.auth] access token rejected",
    {
      code: "ERR_JWT_EXPIRED",
      claim: "exp",
      issuer: "https://sendero.us.auth0.com/",
      audience: "https://sendero.example/mcp",
    },
  ]);
});

test("requires an authenticated token before reading Convex", async () => {
  const persistence = createConvexPersistence({
    convexUrl: "https://example.convex.cloud",
  });
  await assert.rejects(() => persistence.list(), /Sign in before accessing/);
});

test("serves the public read-only shell without authentication or cross-origin access", async () => {
  const app = createApp({ convexUrl: "https://example.convex.cloud" });
  const response = await app.request("/share");

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.match(await response.text(), /api\/public-shares\/resolve/);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  assert.equal(response.headers.get("www-authenticate"), null);
});

test("resolves an active public snapshot without Auth0 and returns no private envelope", async () => {
  const calls = [];
  const safePublicItinerary = {
    schemaVersion: 1,
    title: "Lisboa a pie",
    destination: "Lisboa, Portugal",
    startDate: "2027-05-01",
    endDate: "2027-05-02",
    transport: { modes: ["walk"] },
    days: [
      {
        date: "2027-05-01",
        title: "Lisboa a pie",
        area: "Baixa",
        activities: [{ startTime: "10:00", title: "Paseo por la Baixa" }],
      },
    ],
  };
  const resolverItinerary = {
    ...safePublicItinerary,
    privateEnvelope: "PRIVATE",
    days: [
      {
        ...safePublicItinerary.days[0],
        activities: [
          {
            ...safePublicItinerary.days[0].activities[0],
            locked: true,
            reservation: { status: "confirmed", note: "PRIVATE" },
          },
        ],
      },
    ],
  };
  const app = createApp({
    convexUrl: "https://example.convex.cloud",
    persistenceFactory: (options) => ({
      async resolvePublic(token) {
        calls.push({ options, token });
        return {
          status: "active",
          itinerary: resolverItinerary,
          publishedAt: 1788200000000,
          updatedAt: 1788300000000,
          expiresAt: 1790800000000,
        };
      },
    }),
  });

  const response = await app.request("/api/public-shares/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "x".repeat(43) }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    share: {
      itinerary: safePublicItinerary,
      publishedAt: 1788200000000,
      updatedAt: 1788300000000,
      expiresAt: 1790800000000,
    },
  });
  assert.deepEqual(calls, [
    {
      options: { convexUrl: "https://example.convex.cloud" },
      token: "x".repeat(43),
    },
  ]);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.equal(response.headers.get("www-authenticate"), null);
});

test("uses one generic response for invalid, expired, revoked, and malformed public links", async () => {
  const app = createApp({
    persistenceFactory: () => ({
      async resolvePublic(token) {
        return {
          status: token.startsWith("e")
            ? "expired"
            : token.startsWith("r")
              ? "unavailable"
              : "not_found",
        };
      },
    }),
  });
  const requests = [
    { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: "m".repeat(43) }) },
    { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: "e".repeat(43) }) },
    { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: "r".repeat(43) }) },
    { headers: { "Content-Type": "application/json" }, body: "{" },
    { headers: { "Content-Type": "text/plain" }, body: "missing" },
    { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: "short" }) },
  ];

  const bodies = [];
  for (const request of requests) {
    const response = await app.request("/api/public-shares/resolve", {
      method: "POST",
      ...request,
    });
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("www-authenticate"), null);
    bodies.push(await response.text());
  }
  assert.equal(new Set(bodies).size, 1);
});

test("does not log a public bearer token when the resolver is unavailable", async () => {
  const warnings = [];
  const token = "s".repeat(43);
  const app = createApp({
    persistenceFactory: () => ({
      async resolvePublic() {
        const error = new Error(`Do not log ${token}`);
        error.code = `PRIVATE_${token}`;
        throw error;
      },
    }),
    logger: { warn: (...args) => warnings.push(args) },
  });
  const response = await app.request("/api/public-shares/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

  assert.equal(response.status, 503);
  assert.equal(JSON.stringify(warnings).includes(token), false);
  assert.deepEqual(warnings, [
    ["[sendero.public-share] resolver unavailable", { code: "resolver_failed" }],
  ]);
});
