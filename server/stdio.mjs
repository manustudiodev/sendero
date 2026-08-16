import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createTripPlannerServer } from "./server.mjs";

const server = createTripPlannerServer();
const transport = new StdioServerTransport();
await server.connect(transport);
