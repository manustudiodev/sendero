import { serve } from "@hono/node-server";
import app from "./app.mjs";

const port = Number(process.env.MCP_PORT || 8788);
serve({ fetch: app.fetch, port });
console.error(`Sendero MCP listening on http://localhost:${port}/mcp`);
