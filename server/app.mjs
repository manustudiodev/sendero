import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  bearerChallenge,
  createAuthConfig,
  protectedResourceMetadata,
  verifyAccessToken as verifyJwtAccessToken,
} from "./auth.mjs";
import { createConvexPersistence } from "./persistence.mjs";
import { createTripPlannerServer } from "./server.mjs";

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
  logger = console,
  app = new Hono(),
} = {}) {
  app.use(
    "*",
    cors({
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
    }),
  );

  const metadata = protectedResourceMetadata(authConfig);

  app.get("/.well-known/oauth-protected-resource", (context) => context.json(metadata));
  app.get("/.well-known/oauth-protected-resource/mcp", (context) => context.json(metadata));

  app.get("/health", (context) =>
    context.json({
      status: "ok",
      service: "sendero",
      storage: convexUrl ? "configured" : "not_configured",
      authentication: authConfig.configured ? "configured" : "not_configured",
    }),
  );

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

    const persistence = createConvexPersistence({
      convexUrl,
      authToken: authorization.token,
    });
    const server = createTripPlannerServer({
      persistence,
      auth,
      widgetOrigin: authConfig.resourceServerUrl,
    });
    const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
    await server.connect(transport);
    return transport.handleRequest(context.req.raw);
  });

  return app;
}

export default createApp();
