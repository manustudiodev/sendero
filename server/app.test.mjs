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
  });

  const unconfigured = createApp({ convexUrl: "" });
  assert.equal((await (await unconfigured.request("/health")).json()).storage, "not_configured");
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
