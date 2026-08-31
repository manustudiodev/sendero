import { once } from "node:events";
import { serve } from "@hono/node-server";

const remoteMode = process.argv.includes("--remote");
let server;
let baseUrl;

if (remoteMode) {
  baseUrl = normalizedBaseUrl(process.env.SENDERO_SMOKE_BASE_URL);
  if (!baseUrl) {
    console.error("SENDERO_SMOKE_BASE_URL must be an absolute HTTPS URL for remote smoke checks.");
    process.exit(1);
  }
} else {
  scrubExternalConfiguration();
  const { default: app } = await import(`../server.mjs?smoke=${Date.now()}`);
  server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 0 });
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Unable to resolve local smoke server address.");
  baseUrl = `http://127.0.0.1:${address.port}`;
}

try {
  const health = await expectJson("/health", 200);
  assert(health.status === "ok" && health.service === "sendero", "/health did not identify a healthy Sendero service.");
  assert(
    ["development", "production"].includes(health.environment),
    `/health reported an unknown Sendero environment: ${health.environment || "missing"}.`,
  );
  if (remoteMode) {
    assert(
      health.webAuthentication === "configured",
      `/health reported webAuthentication=${health.webAuthentication || "missing"}, expected configured.`,
    );
  }

  await expectRedirect("/", "/es");
  await expectRedirect("/privacy", "/es/privacy");
  await expectRedirect("/terms", "/es/terms");
  await expectHtml("/es", "Sendero · Planifica conversando");
  await expectHtml("/es/privacy", "Privacidad · Sendero");
  await expectHtml("/es/terms", "Términos · Sendero");
  await expectHtml(
    "/share",
    "Viaje compartido · Sendero",
    "get_shared_trip_context",
    "preview_guest_arrival",
    "registerTool",
  );
  await expectHtml("/app", "Tus viajes · Sendero");
  await expectHtml("/invite/smoke-id", "Invitación · Sendero");
  await expectHtml("/app/trips/smoke-id", "Itinerario privado · Sendero");

  const metadata = await expectJson("/.well-known/oauth-protected-resource", 200);
  assert(Array.isArray(metadata.scopes_supported), "OAuth metadata is missing scopes_supported.");
  for (const scope of ["trips:read", "trips:write", "trips:share"]) {
    assert(metadata.scopes_supported.includes(scope), `OAuth metadata is missing ${scope}.`);
  }
  if (remoteMode) await expectRemoteLoginRedirect(metadata);

  const initialize = await mcpCall(1, "initialize", initializeParams());
  const expectedServerName = health.environment === "development" ? "sendero-dev" : "sendero";
  assert(
    initialize.result?.serverInfo?.name === expectedServerName,
    `MCP initialize identified ${initialize.result?.serverInfo?.name || "nothing"}, expected ${expectedServerName}.`,
  );
  const tools = await mcpCall(2, "tools/list", {});
  const toolNames = new Set(tools.result?.tools?.map(({ name }) => name));
  for (const toolName of ["open_trip", "render_itinerary", "invite_trip_member"]) {
    assert(toolNames.has(toolName), `MCP tools/list is missing ${toolName}.`);
  }
  const resources = await mcpCall(3, "resources/list", {});
  assert(resources.result?.resources?.length > 0, "MCP resources/list returned no resources.");

  const malformedAuth = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: { ...mcpHeaders(), authorization: "NotBearer smoke" },
    body: mcpRequest(4, "initialize", initializeParams()),
    redirect: "manual",
  });
  assert(malformedAuth.status === 401, `Malformed MCP authorization returned ${malformedAuth.status}, expected 401.`);
  assert(malformedAuth.headers.has("www-authenticate"), "MCP 401 is missing WWW-Authenticate.");

  console.log(`Sendero ${remoteMode ? "remote" : "local"} smoke passed against ${baseUrl}.`);
} finally {
  if (server) await new Promise((resolvePromise) => server.close(resolvePromise));
}

async function expectHtml(path, ...expectedTexts) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
  assert(response.status === 200, `${path} returned ${response.status}, expected 200.`);
  assert(response.headers.get("content-type")?.includes("text/html"), `${path} did not return HTML.`);
  const html = await response.text();
  for (const expectedText of expectedTexts) {
    assert(html.includes(expectedText), `${path} did not contain expected content: ${expectedText}.`);
  }
}

async function expectRedirect(path, expectedLocation) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
  assert(response.status === 307, `${path} returned ${response.status}, expected 307.`);
  assert(
    response.headers.get("location") === expectedLocation,
    `${path} redirected to ${response.headers.get("location") || "nothing"}, expected ${expectedLocation}.`,
  );
}

async function expectJson(path, status) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
  assert(response.status === status, `${path} returned ${response.status}, expected ${status}.`);
  assert(response.headers.get("content-type")?.includes("application/json"), `${path} did not return JSON.`);
  return response.json();
}

async function expectRemoteLoginRedirect(metadata) {
  const response = await fetch(`${baseUrl}/auth/login?returnTo=%2Fapp`, { redirect: "manual" });
  assert(response.status === 302, `/auth/login returned ${response.status}, expected 302.`);

  const location = response.headers.get("location");
  assert(location, "/auth/login did not include a Location header.");
  const redirect = new URL(location);
  const authorizationServer = new URL(metadata.authorization_servers?.[0] || "");
  assert(
    redirect.origin === authorizationServer.origin,
    "/auth/login did not redirect to the configured authorization server.",
  );
  assert(
    redirect.searchParams.get("redirect_uri") === `${baseUrl}/auth/callback`,
    "/auth/login used an unexpected callback URL.",
  );
}

async function mcpCall(id, method, params) {
  const response = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: mcpHeaders(),
    body: mcpRequest(id, method, params),
  });
  assert(response.status === 200, `MCP ${method} returned ${response.status}, expected 200.`);
  const payload = await response.json();
  assert(!payload.error, `MCP ${method} failed: ${payload.error?.message || "unknown error"}.`);
  return payload;
}

function mcpHeaders() {
  return { accept: "application/json, text/event-stream", "content-type": "application/json" };
}

function mcpRequest(id, method, params) {
  return JSON.stringify({ jsonrpc: "2.0", id, method, params });
}

function initializeParams() {
  return {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "sendero-release-smoke", version: "1.0.0" },
  };
}

function normalizedBaseUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return "";
    return url.href.replace(/\/$/, "");
  } catch {
    return "";
  }
}

function scrubExternalConfiguration() {
  for (const name of [
    "CONVEX_URL",
    "CONVEX_SITE_URL",
    "CONVEX_DEPLOY_KEY",
    "AUTH0_ISSUER",
    "AUTH0_AUDIENCE",
    "AUTH0_CLAIMS_NAMESPACE",
    "AUTH0_WEB_CLIENT_ID",
    "AUTH0_WEB_CLIENT_SECRET",
    "SENDERO_SHARE_SECRET",
    "SENDERO_WEB_SESSION_KEY",
    "SENDERO_INVITE_TOKEN_PEPPER",
    "RESEND_API_KEY",
    "SENDERO_EMAIL_FROM",
    "GOOGLE_MAPS_EMBED_API_KEY",
    "SENDERO_ENVIRONMENT",
  ]) delete process.env[name];
  process.env.MCP_SERVER_URL = "http://127.0.0.1:8788/mcp";
  process.env.PUBLIC_WEB_URL = "http://127.0.0.1:8788";
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
