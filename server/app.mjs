import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createConvexPersistence } from "./persistence.mjs";
import { createTripPlannerServer } from "./server.mjs";

function bearerToken(request) {
  const authorization = request.header("Authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
}

export function createApp({ convexUrl = process.env.CONVEX_URL, app = new Hono() } = {}) {
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
      exposeHeaders: ["mcp-session-id", "mcp-protocol-version"],
    }),
  );

  app.get("/health", (context) =>
    context.json({
      status: "ok",
      service: "sendero",
      storage: convexUrl ? "configured" : "not_configured",
    }),
  );

  app.all("/mcp", async (context) => {
    const persistence = createConvexPersistence({
      convexUrl,
      authToken: bearerToken(context.req),
    });
    const server = createTripPlannerServer({ persistence });
    const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
    await server.connect(transport);
    return transport.handleRequest(context.req.raw);
  });

  return app;
}

export default createApp();
