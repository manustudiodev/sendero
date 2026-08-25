import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { publicSharePageHtml } from "./ui/generated/widgets.mjs";
import {
  bearerChallenge,
  createAuthConfig,
  protectedResourceMetadata,
  verifyAccessToken as verifyJwtAccessToken,
} from "./auth.mjs";
import { createConvexPersistence } from "./persistence.mjs";
import { isValidPublicShareToken } from "./public-sharing.mjs";
import { createTripPlannerServer, publicItinerarySchema } from "./server.mjs";

function authorizationToken(request) {
  const authorization = request.header("Authorization");
  if (!authorization) return {};
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return { malformed: true };
  return { token: match[1] };
}

function defaultResourceServerUrl() {
  if (process.env.MCP_SERVER_URL) return process.env.MCP_SERVER_URL;
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  return vercelHost ? `https://${vercelHost}/mcp` : "http://localhost:8788/mcp";
}

function defaultPublicWebUrl(resourceServerUrl) {
  if (process.env.PUBLIC_WEB_URL) return process.env.PUBLIC_WEB_URL;
  return new URL(resourceServerUrl).origin;
}

const publicSecurityHeaders = Object.freeze({
  "Cache-Control": "no-store, max-age=0",
  "Content-Security-Policy":
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src data:; font-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
});

function setPublicSecurityHeaders(context) {
  for (const [name, value] of Object.entries(publicSecurityHeaders)) {
    context.header(name, value);
  }
}

function authFailureDetails(error, authConfig) {
  return {
    code: typeof error?.code === "string" ? error.code : "token_verification_failed",
    claim: typeof error?.claim === "string" ? error.claim : undefined,
    issuer: authConfig.issuer,
    audience: authConfig.audience,
  };
}

export function createApp({
  convexUrl = process.env.CONVEX_URL,
  authConfig = createAuthConfig({
    issuer: process.env.AUTH0_ISSUER,
    audience: process.env.AUTH0_AUDIENCE,
    resourceServerUrl: defaultResourceServerUrl(),
  }),
  verifyAccessToken = verifyJwtAccessToken,
  persistenceFactory = createConvexPersistence,
  publicWebUrl,
  publicShareSecret = process.env.SENDERO_SHARE_SECRET,
  logger = console,
  app = new Hono(),
} = {}) {
  const mcpCors = cors({
    origin: "*",
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Authorization",
      "Content-Type",
      "mcp-session-id",
      "Last-Event-ID",
      "mcp-protocol-version",
    ],
    exposeHeaders: ["mcp-session-id", "mcp-protocol-version", "WWW-Authenticate"],
  });
  app.use("/mcp", mcpCors);
  app.use("/.well-known/*", mcpCors);

  const metadata = protectedResourceMetadata(authConfig);
  const resolvedPublicWebUrl = publicWebUrl || defaultPublicWebUrl(authConfig.resourceServerUrl);

  app.get("/.well-known/oauth-protected-resource", (context) => context.json(metadata));
  app.get("/.well-known/oauth-protected-resource/mcp", (context) => context.json(metadata));

  app.get("/health", (context) =>
    context.json({
      status: "ok",
      service: "sendero",
      storage: convexUrl ? "configured" : "not_configured",
      authentication: authConfig.configured ? "configured" : "not_configured",
      publicSharing:
        typeof publicShareSecret === "string" && Buffer.byteLength(publicShareSecret, "utf8") >= 32
          ? "configured"
          : "not_configured",
    }),
  );

  app.get("/share", (context) => {
    setPublicSecurityHeaders(context);
    return context.html(publicSharePageHtml);
  });

  app.post("/api/public-shares/resolve", async (context) => {
    setPublicSecurityHeaders(context);
    if (!context.req.header("Content-Type")?.toLowerCase().startsWith("application/json")) {
      return context.json({ error: "share_unavailable" }, 404);
    }
    const declaredLength = Number(context.req.header("Content-Length") || 0);
    if (declaredLength > 1024) {
      return context.json({ error: "share_unavailable" }, 404);
    }

    let body;
    try {
      const raw = await context.req.text();
      if (raw.length > 1024) return context.json({ error: "share_unavailable" }, 404);
      body = JSON.parse(raw);
    } catch {
      return context.json({ error: "share_unavailable" }, 404);
    }
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      !isValidPublicShareToken(body.token)
    ) {
      return context.json({ error: "share_unavailable" }, 404);
    }

    try {
      const persistence = persistenceFactory({ convexUrl });
      const result = await persistence.resolvePublic(body.token);
      if (result?.status !== "active") {
        return context.json({ error: "share_unavailable" }, 404);
      }
      const itinerary = publicItinerarySchema.parse(result.itinerary);
      return context.json({
        share: {
          itinerary,
          publishedAt: result.share?.publishedAt ?? result.publishedAt,
          updatedAt: result.share?.updatedAt ?? result.updatedAt,
          expiresAt: result.share?.expiresAt ?? result.expiresAt,
        },
      });
    } catch {
      logger.warn?.("[sendero.public-share] resolver unavailable", {
        code: "resolver_failed",
      });
      return context.json({ error: "temporarily_unavailable" }, 503);
    }
  });

  app.all("/mcp", async (context) => {
    const authorization = authorizationToken(context.req);
    if (authorization.malformed) {
      context.header(
        "WWW-Authenticate",
        bearerChallenge(authConfig, {
          error: "invalid_token",
          description: "Use an Authorization: Bearer token.",
        }),
      );
      return context.json({ error: "invalid_token" }, 401);
    }

    let auth = {
      authenticated: false,
      scopes: [],
      resourceMetadataUrl: authConfig.resourceMetadataUrl,
    };
    if (authorization.token) {
      try {
        auth = {
          ...(await verifyAccessToken(authorization.token, authConfig)),
          resourceMetadataUrl: authConfig.resourceMetadataUrl,
        };
      } catch (error) {
        logger.warn?.("[sendero.auth] access token rejected", authFailureDetails(error, authConfig));
        context.header(
          "WWW-Authenticate",
          bearerChallenge(authConfig, {
            error: "invalid_token",
            description: "The access token is invalid or expired.",
          }),
        );
        return context.json({ error: "invalid_token" }, 401);
      }
    }

    const persistence = persistenceFactory({
      convexUrl,
      authToken: authorization.token,
    });
    const server = createTripPlannerServer({
      persistence,
      auth,
      widgetOrigin: authConfig.resourceServerUrl,
      publicWebUrl: resolvedPublicWebUrl,
      publicShareSecret,
    });
    const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
    await server.connect(transport);
    return transport.handleRequest(context.req.raw);
  });

  return app;
}

export default createApp();
