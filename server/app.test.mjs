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
    environment: "production",
    storage: "configured",
    authentication: "not_configured",
    webAuthentication: "not_configured",
    publicSharing: "not_configured",
    mapsEmbed: "not_configured",
    placesAutocomplete: "not_configured",
    webMcpPlanning: "disabled",
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

  const placesConfigured = createApp({ placesApiKey: "test-key" });
  assert.equal(
    (await (await placesConfigured.request("/health")).json()).placesAutocomplete,
    "configured",
  );

  const planningConfigured = createApp({ planningEnabled: true });
  assert.equal((await (await planningConfigured.request("/health")).json()).webMcpPlanning, "enabled");
});

test("identifies the development web and OAuth surfaces", async () => {
  const authConfig = createAuthConfig({
    issuer: "https://sendero.us.auth0.com",
    audience: "https://sendero-dev.example/mcp",
    resourceServerUrl: "https://sendero-dev.example/mcp",
  });
  const app = createApp({ authConfig, environment: "development" });

  assert.equal((await (await app.request("/health")).json()).environment, "development");
  assert.equal(
    (await (await app.request("/.well-known/oauth-protected-resource")).json()).resource_name,
    "Sendero Dev",
  );
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

test("negotiates localized public routes and serves canonical landing and legal pages", async () => {
  const app = createApp({ publicWebUrl: "https://sendero.example" });

  const frenchRedirect = await app.request("/", {
    headers: { "Accept-Language": "fr-FR;q=0.9, pt-BR;q=0.8, en;q=0.7" },
  });
  assert.equal(frenchRedirect.status, 307);
  assert.equal(frenchRedirect.headers.get("location"), "/fr");
  assert.match(frenchRedirect.headers.get("cache-control"), /no-store/);
  assert.match(frenchRedirect.headers.get("vary"), /Accept-Language/);
  assert.match(frenchRedirect.headers.get("vary"), /Cookie/);

  const rememberedRedirect = await app.request("/privacy", {
    headers: { Cookie: "sendero_locale=en" },
  });
  assert.equal(rememberedRedirect.status, 307);
  assert.equal(rememberedRedirect.headers.get("location"), "/en/privacy");

  const pages = [
    ["/es", "es", /<title>Sendero · Planifica conversando<\/title>/, "https://sendero.example/es"],
    ["/en/privacy", "en", /<title>Privacy · Sendero<\/title>/, "https://sendero.example/en/privacy"],
    ["/pt/terms", "pt", /<title>Termos · Sendero<\/title>/, "https://sendero.example/pt/terms"],
    ["/fr", "fr", /<title>Sendero · Planifiez en conversant<\/title>/, "https://sendero.example/fr"],
    ["/de/privacy", "de", /<title>Datenschutz · Sendero<\/title>/, "https://sendero.example/de/privacy"],
  ];
  for (const [path, locale, content, canonical] of pages) {
    const response = await app.request(path);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/html/);
    const html = await response.text();
    assert.match(html, new RegExp(`<html class="site-document" lang="${locale}">`));
    assert.match(html, content);
    assert.match(html, new RegExp(`rel="canonical" href="${canonical.replaceAll(".", "\\.")}"`));
    for (const alternate of ["es", "en", "pt", "fr", "de", "x-default"]) {
      assert.match(html, new RegExp(`hreflang="${alternate}"`));
    }
    assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'none'/);
    assert.equal(response.headers.get("x-robots-tag"), null);
  }
});

test("redirects localized application URLs to their query-localized canonical routes", async () => {
  const app = createApp();
  const cases = [
    ["/es/app", "/app?lang=es"],
    ["/fr/app/new?draft=browser_123", "/app/new?draft=browser_123&lang=fr"],
    ["/de/app/trips/trip%20one", "/app/trips/trip%20one?lang=de"],
  ];

  for (const [path, expectedLocation] of cases) {
    const response = await app.request(path, { redirect: "manual" });
    assert.equal(response.status, 307);
    assert.equal(response.headers.get("location"), expectedLocation);
  }
});

test("serves a cacheable Sendero favicon", async () => {
  const app = createApp();
  const response = await app.request("/favicon.ico");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /image\/svg\+xml/);
  const favicon = await response.text();
  assert.match(favicon, /#a2d45e/);
  assert.match(favicon, /M43 18H29/);
});

test("serves authenticated web shells with private caching, no indexing, and same-origin APIs", async () => {
  const app = createApp({ mapsEmbedApiKey: 'restricted-test-key-<not-real>&"' });
  const pages = [
    ["/app", /<title>Tus viajes · Sendero<\/title>/],
    ["/app/new", /<title>Crear un viaje · Sendero<\/title>/],
    ["/invite", /<title>Invitación · Sendero<\/title>/],
    ["/invite/trip_web_1234567890", /<title>Invitación · Sendero<\/title>/],
    ["/app/trips/trip_web_1234567890", /<title>Itinerario privado · Sendero<\/title>/],
  ];

  for (const [path, content] of pages) {
    const response = await app.request(path);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/html/);
    assert.match(await response.clone().text(), content);
    assert.match(response.headers.get("cache-control"), /no-store/);
    assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
    assert.equal(response.headers.get("cross-origin-resource-policy"), "same-origin");
    assert.equal(response.headers.get("cross-origin-opener-policy"), "same-origin");
    assert.match(response.headers.get("content-security-policy"), /connect-src 'self'/);
    assert.match(response.headers.get("content-security-policy"), /form-action 'self'/);
    if (!path.startsWith("/app/trips/") && path !== "/app/new") {
      assert.doesNotMatch(response.headers.get("content-security-policy"), /frame-src/);
    }
    assert.equal(response.headers.get("access-control-allow-origin"), null);
  }

  const restricted = await app.request("/app/trips/trip_web_1234567890");
  const html = await restricted.text();
  assert.match(html, /<meta name="sendero-google-maps-embed-key"/);
  assert.match(html, /restricted-test-key-&lt;not-real&gt;&amp;&quot;/);
  assert.match(restricted.headers.get("content-security-policy"), /frame-src https:\/\/www\.google\.com/);

  const portuguese = await app.request("/app?lang=pt");
  assert.match(await portuguese.text(), /<html class="web-document" lang="pt">[\s\S]*<title>Suas viagens · Sendero<\/title>/);
  assert.match(portuguese.headers.get("set-cookie") || "", /sendero_locale=pt/);
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
  const app = createApp({
    convexUrl: "https://example.convex.cloud",
    mapsEmbedApiKey: 'public-test-key-<not-real>&"',
  });
  const response = await app.request("/share");

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  const html = await response.text();
  assert.match(html, /api\/public-shares\/resolve/);
  assert.match(html, /<meta name="sendero-google-maps-embed-key"/);
  assert.match(html, /public-test-key-&lt;not-real&gt;&amp;&quot;/);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.match(
    response.headers.get("content-security-policy"),
    /frame-src https:\/\/www\.google\.com/,
  );
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  assert.equal(response.headers.get("www-authenticate"), null);

  const english = await app.request("/share?lang=en");
  assert.match(await english.text(), /<title>Shared trip · Sendero<\/title>/);
  assert.match(english.headers.get("set-cookie") || "", /sendero_locale=en/);
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
          sourceVersion: 7,
          generation: 2,
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
      itinerary: { ...safePublicItinerary, locale: "en" },
      sourceVersion: 7,
      generation: 2,
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
