import assert from "node:assert/strict";
import test from "node:test";
import { createItineraryGenerationFacade } from "./src/generate/generation-client.js";
import {
  ITINERARY_GENERATION_TOOL_NAMES,
  itineraryGenerationToolDefinitions,
  registerItineraryGenerationTools,
} from "./src/generate/webmcp.js";

function facade() {
  return {
    async getProtocol() { return { protocol: { version: "1.0.0" } }; },
    async stage() { return { draftId: "draft_1234567890123456", status: "valid" }; },
    async getDraft() { return { draftId: "draft_1234567890123456", status: "valid" }; },
    async save() { return { status: "saved", trip: { webId: "trip_123" } }; },
    async discard() { return { status: "discarded" }; },
  };
}

test("registers the five authenticated generation tools on the top-level page", async () => {
  const registered = [];
  const reports = [];
  const controller = new AbortController();
  const supported = await registerItineraryGenerationTools({
    modelContext: { registerTool(tool, options) { registered.push({ tool, options }); } },
  }, facade(), { report: (event) => reports.push(event), signal: controller.signal });
  assert.equal(supported, true);
  assert.deepEqual(registered.map(({ tool }) => tool.name), ITINERARY_GENERATION_TOOL_NAMES);
  assert.equal(registered.every(({ options }) => options.signal === controller.signal), true);
  assert.equal(registered.every(({ tool }) => tool.inputSchema.additionalProperties === false), true);
  assert.deepEqual(reports.map(({ type }) => type), [
    "webmcp_support_detected",
    "webmcp_tools_registered",
  ]);
  assert.match(registered[0].tool.description, /prefer this page workflow over remote Sendero planning tools/i);
  assert.match(registered[1].tool.description, /authoritative review handoff/i);
  assert.match(registered[3].tool.description, /current web account/i);
});

test("leaves the page usable without WebMCP and keeps failures compact", async () => {
  const reports = [];
  assert.equal(await registerItineraryGenerationTools({}, facade(), {
    report: (event) => reports.push(event),
  }), false);
  assert.deepEqual(reports, [{ type: "webmcp_support_unavailable" }]);
  const broken = facade();
  broken.stage = async () => {
    const error = new Error("The itinerary has blocking validation errors.");
    error.code = "itinerary_invalid";
    error.details = { errors: ["overlap"] };
    throw error;
  };
  const tool = itineraryGenerationToolDefinitions(broken)
    .find(({ name }) => name === "validate_and_stage_itinerary");
  const result = await tool.execute({});
  assert.deepEqual(result.error.details, { errors: ["overlap"] });
  assert.equal("stack" in result.error, false);
});

test("reports tool lifecycle without exposing the generated itinerary", async () => {
  const reports = [];
  const tool = itineraryGenerationToolDefinitions(facade(), {
    report: (event) => reports.push(event),
  }).find(({ name }) => name === "validate_and_stage_itinerary");
  await tool.execute({});
  assert.deepEqual(reports.map(({ type, toolName }) => ({ type, toolName })), [
    { type: "webmcp_tool_started", toolName: "validate_and_stage_itinerary" },
    { type: "webmcp_tool_succeeded", toolName: "validate_and_stage_itinerary" },
  ]);
  assert.equal(reports.some((event) => "itinerary" in event), false);
});

test("uses CSRF for temporary and canonical mutations and reuses operation IDs", async () => {
  const calls = [];
  const generated = createItineraryGenerationFacade({
    csrfToken: "csrf",
    getBrief: () => ({ destination: "Valencia" }),
    getCurrentDraftId: () => "draft_1234567890123456",
    request: async (path, options = {}) => {
      calls.push({ path, ...options });
      if (path.endsWith("/save")) return { status: "saved" };
      return { draftId: "draft_1234567890123456", status: "valid" };
    },
  });
  const input = { itinerary: { title: "Viaje" }, protocolHash: "a".repeat(64), protocolVersion: "1.0.0" };
  await generated.stage(input);
  await generated.stage(input);
  await generated.save({});
  await generated.save({});
  assert.equal(calls.every(({ method }) => method === "POST"), true);
  assert.equal(calls.every(({ csrfToken }) => csrfToken === "csrf"), true);
  assert.equal(calls[0].body.operationId, calls[1].body.operationId);
  assert.equal(calls[2].body.operationId, calls[3].body.operationId);
});
