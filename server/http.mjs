import { serve } from "@hono/node-server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createTripPlannerServer } from "./server.mjs";

const app = new Hono();
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "mcp-session-id", "Last-Event-ID", "mcp-protocol-version"],
    exposeHeaders: ["mcp-session-id", "mcp-protocol-version"],
  }),
);

app.get("/health", (context) => context.json({ status: "ok", service: "sendero" }));
app.all("/mcp", async (context) => {
  const server = createTripPlannerServer();
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(context.req.raw);
});

const port = Number(process.env.MCP_PORT || 8788);
serve({ fetch: app.fetch, port });
console.error(`Sendero MCP listening on http://localhost:${port}/mcp`);
