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

test("registers the five anonymous-first generation tools on the top-level page", async () => {
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
  assert.match(registered[0].tool.description, /without requiring form entry or prompt copying/i);
  assert.match(registered[1].tool.description, /authoritative review handoff/i);
  assert.match(registered[1].tool.description, /without a Sendero account/i);
  assert.match(registered[3].tool.description, /requires a Sendero account/i);
});

test("returns the prepared conversational brief to the open page", async () => {
  const prepared = [];
  const generated = createItineraryGenerationFacade({
    getBrief: () => ({ destination: "Fallback" }),
    onBriefPrepared: (value) => prepared.push(value),
    request: async (path, options) => {
      assert.equal(path, "/api/itinerary-planning/protocol");
      assert.equal(options.body.brief.destination, "Sevilla, España");
      return {
        brief: {
          ready: true,
          missing: [],
          brief: {
            destination: "Sevilla, España",
            startDate: "2027-03-21",
            endDate: "2027-04-18",
            travellers: { adults: 2, children: 0 },
            transport: { modes: ["walk", "public_transit"], hasLicense: false, wantsCar: false },
          },
        },
        protocol: { version: "1.4.0" },
      };
    },
  });

  const result = await generated.getProtocol({ brief: { destination: "Sevilla, España" } });
  assert.equal(result.protocol.version, "1.4.0");
  assert.equal(prepared.length, 1);
  assert.equal(prepared[0].ready, true);
  assert.equal(prepared[0].brief.travellers.adults, 2);
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

test("keeps anonymous validation in the browser cache and requires authentication only to save", async () => {
  const calls = [];
  let cached = null;
  let session = { authenticated: false, loginUrl: "/auth/login" };
  const generated = createItineraryGenerationFacade({
    getBrief: () => ({ destination: "Valencia" }),
    getCachedDraft: () => cached,
    getCurrentDraftId: () => cached?.view?.draftId,
    getSession: () => session,
    onDraft(view, options = {}) {
      if (options.clear) cached = null;
      else cached = {
        view,
        saveInput: Object.hasOwn(options, "saveInput")
          ? options.saveInput
          : cached?.saveInput || null,
      };
    },
    request: async (path, options = {}) => {
      calls.push({ path, ...options });
      if (path === "/api/itinerary-planning/validate") {
        return { draftId: "browser_12345678901234567890123456789012", status: "valid" };
      }
      if (path === "/api/itinerary-drafts") {
        return { draftId: "draft_1234567890123456", status: "valid" };
      }
      if (path.endsWith("/save")) {
        return { draftId: "draft_1234567890123456", status: "saved", trip: { webId: "trip_123" } };
      }
      throw new Error(`Unexpected request: ${path}`);
    },
  });
  const input = { itinerary: { title: "Viaje" }, protocolHash: "a".repeat(64), protocolVersion: "1.0.0" };
  await generated.stage(input);
  await generated.stage(input);
  assert.equal((await generated.getDraft({})).draftId, "browser_12345678901234567890123456789012");
  await assert.rejects(
    generated.save({}),
    (error) => error.code === "authentication_required" && error.status === 401,
  );
  assert.equal(calls.length, 2);
  assert.equal(calls.every(({ path }) => path === "/api/itinerary-planning/validate"), true);
  assert.equal(calls.every(({ csrfToken }) => csrfToken === undefined), true);
  assert.equal(calls[0].body.operationId, calls[1].body.operationId);

  session = { authenticated: true, csrfToken: "csrf" };
  const saved = await generated.save({});
  assert.equal(saved.trip.webId, "trip_123");
  assert.equal(calls[2].path, "/api/itinerary-drafts");
  assert.equal(calls[3].path, "/api/itinerary-drafts/draft_1234567890123456/save");
  assert.equal(calls[2].csrfToken, "csrf");
  assert.equal(calls[3].csrfToken, "csrf");
  assert.equal(cached.view.status, "saved");
  assert.equal(cached.saveInput, null);
});
