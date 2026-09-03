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
    async updateReservationStatuses() { return { status: "updated" }; },
    async save() { return { status: "saved", trip: { webId: "trip_123" } }; },
    async shareByLink() { return { shareUrl: "https://sendero.example/share#token" }; },
    async inviteMember() { return { invitationId: "invitation_123", status: "pending" }; },
    async discard() { return { status: "discarded" }; },
  };
}

test("registers the generation, reservation, and sharing tools on the top-level page", async () => {
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
  const byName = Object.fromEntries(registered.map(({ tool }) => [tool.name, tool]));
  assert.match(byName.save_staged_itinerary.description, /requires a Sendero account/i);
  assert.match(byName.update_itinerary_reservation_statuses.description, /one specific reservation.*or for a list/i);
  assert.match(byName.update_itinerary_reservation_statuses.description, /requires an authenticated Sendero account/i);
  assert.deepEqual(
    byName.update_itinerary_reservation_statuses.inputSchema.properties.updates.items.properties.status.enum,
    ["pending", "confirmed"],
  );
  assert.equal(byName.update_itinerary_reservation_statuses.inputSchema.properties.updates.items.additionalProperties, false);
  assert.match(byName.share_saved_itinerary_by_link.description, /public read-only access/i);
  assert.match(byName.share_saved_itinerary_by_link.description, /explicit user request/i);
  assert.match(byName.invite_saved_itinerary_member.description, /viewer grants read-only.*editor grants collaboration/i);
  assert.match(byName.invite_saved_itinerary_member.description, /explicitly asks/i);
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

test("updates one or several reservation trackers in the validated browser draft", async () => {
  const updates = [
    { activityId: "alcazar", dayDate: "2027-04-10", status: "confirmed" },
    { activityId: "flamenco", dayDate: "2027-04-11", status: "pending" },
  ];
  const cached = {
    view: {
      draftId: "browser_12345678901234567890123456789012",
      status: "valid",
      itinerary: { title: "Sevilla" },
    },
    saveInput: { itinerary: { title: "Sevilla" } },
  };
  const received = [];
  const generated = createItineraryGenerationFacade({
    getCachedDraft: () => cached,
    getCurrentDraftId: () => cached.view.draftId,
    getSession: () => ({ authenticated: true, csrfToken: "csrf" }),
    updateCachedReservationStatuses(value) {
      received.push(value);
      return cached;
    },
  });

  const result = await generated.updateReservationStatuses({ updates });
  assert.deepEqual(received, [updates]);
  assert.deepEqual(result, {
    draftId: cached.view.draftId,
    status: "updated",
    updatedReservations: updates,
  });
});

test("shares a saved itinerary publicly or invites one identified member through authoritative APIs", async () => {
  const calls = [];
  const cached = {
    view: {
      draftId: "draft_1234567890123456",
      status: "saved",
      trip: { webId: "trip_123", version: 4, itinerary: { title: "Sevilla" } },
    },
    saveInput: null,
  };
  const generated = createItineraryGenerationFacade({
    getCachedDraft: () => cached,
    getCurrentDraftId: () => cached.view.draftId,
    getSession: () => ({ authenticated: true, csrfToken: "csrf" }),
    request: async (path, options) => {
      calls.push({ path, ...options });
      if (path.endsWith("/access")) {
        return {
          generalAccess: { mode: "public_link" },
          shareUrl: "https://sendero.example/share#public-token",
        };
      }
      if (path.endsWith("/invitations")) {
        return { invitationId: "invitation_123", status: "pending", delivery: "scheduled" };
      }
      throw new Error(`Unexpected request: ${path}`);
    },
  });

  const firstShare = await generated.shareByLink({});
  const secondShare = await generated.shareByLink({});
  assert.equal(firstShare.shareUrl, "https://sendero.example/share#public-token");
  assert.equal(secondShare.shareUrl, firstShare.shareUrl);
  assert.equal(calls[0].path, "/api/trips/trip_123/access");
  assert.equal(calls[0].method, "PATCH");
  assert.equal(calls[0].csrfToken, "csrf");
  assert.equal(calls[0].body.generalAccess, "public_link");
  assert.equal(calls[0].body.operationId, calls[1].body.operationId);

  const firstInvite = await generated.inviteMember({ email: " Friend@Example.com ", role: "editor" });
  const secondInvite = await generated.inviteMember({ email: "friend@example.com", role: "editor" });
  assert.deepEqual(firstInvite, {
    invitationId: "invitation_123",
    status: "pending",
    delivery: "scheduled",
  });
  assert.deepEqual(secondInvite, firstInvite);
  assert.equal(calls[2].path, "/api/trips/trip_123/invitations");
  assert.equal(calls[2].method, "POST");
  assert.equal(calls[2].csrfToken, "csrf");
  assert.equal(calls[2].body.email, "friend@example.com");
  assert.equal(calls[2].body.role, "editor");
  assert.equal(calls[2].body.operationId, calls[3].body.operationId);
});

test("does not share an unsaved itinerary or bypass account authentication", async () => {
  const validDraft = {
    view: {
      draftId: "browser_12345678901234567890123456789012",
      status: "valid",
      itinerary: { title: "Sevilla" },
    },
    saveInput: { itinerary: { title: "Sevilla" } },
  };
  let session = { authenticated: true, csrfToken: "csrf" };
  const generated = createItineraryGenerationFacade({
    getCachedDraft: () => validDraft,
    getCurrentDraftId: () => validDraft.view.draftId,
    getSession: () => session,
  });

  await assert.rejects(
    generated.shareByLink({}),
    (error) => error.code === "itinerary_must_be_saved" && error.status === 409,
  );
  session = { authenticated: false, loginUrl: "/auth/login" };
  await assert.rejects(
    generated.updateReservationStatuses({
      updates: [{ activityId: "alcazar", dayDate: "2027-04-10", status: "confirmed" }],
    }),
    (error) => error.code === "authentication_required" && error.status === 401,
  );
  await assert.rejects(
    generated.inviteMember({ email: "friend@example.com", role: "viewer" }),
    (error) => error.code === "authentication_required" && error.status === 401,
  );
});
