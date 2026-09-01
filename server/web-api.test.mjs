import assert from "node:assert/strict";
import test from "node:test";
import { Hono } from "hono";
import {
  derivePublicShareToken,
  hashPublicShareToken,
} from "./public-sharing.mjs";
import { registerWebApiRoutes } from "./web-api.mjs";
import { planningProtocolIdentity } from "./itinerary-planning.mjs";

const WEB_ID = "trip_web_123456789012";
const INVITE_PEPPER = "sendero-invitation-pepper-with-at-least-thirty-two-bytes";
const SHARE_SECRET = "sendero-public-sharing-secret-with-at-least-thirty-two-bytes";
const CSRF = "csrf-test-token";

function trip(overrides = {}) {
  return {
    id: "trip_internal_1",
    webId: WEB_ID,
    role: "owner",
    version: 3,
    updatedAt: Date.UTC(2026, 7, 27, 12),
    itinerary: {
      schemaVersion: 1,
      locale: "es-MX",
      title: "CDMX entre mercados y diseño",
      destination: "Ciudad de México, México",
      startDate: "2026-09-02",
      endDate: "2026-09-06",
      transport: { modes: ["walk"] },
      days: [],
    },
    revisions: [],
    ...overrides,
  };
}

function fixture({
  authenticated = true,
  emailVerified = true,
  inspectionTrip,
  planningEnabled = false,
  placesApiKey,
  placesFetch,
  storage = {},
  sendInvitationEmail,
} = {}) {
  let sessionEnabled = authenticated;
  let pending;
  const calls = [];
  const currentTrip = trip();
  const authenticatedStorage = {
    async list() {
      calls.push(["list"]);
      return [{
        id: currentTrip.id,
        webId: currentTrip.webId,
        locale: currentTrip.itinerary.locale,
        title: currentTrip.itinerary.title,
        destination: currentTrip.itinerary.destination,
        startDate: currentTrip.itinerary.startDate,
        endDate: currentTrip.itinerary.endDate,
        currentVersion: currentTrip.version,
        role: currentTrip.role,
        updatedAt: currentTrip.updatedAt,
      }];
    },
    async getByWebId(webId) {
      calls.push(["getByWebId", webId]);
      if (webId !== WEB_ID) throw new Error("Trip not found");
      return currentTrip;
    },
    async updateReservation(args) {
      calls.push(["updateReservation", args]);
      currentTrip.version += 1;
      return { changed: true };
    },
    async listAccess() {
      calls.push(["listAccess"]);
      return {
        owner: { email: "owner@example.com", name: "Owner", role: "owner" },
        collaborators: [],
        invitations: [],
        legacyInvitations: [],
      };
    },
    async publicStatus() {
      calls.push(["publicStatus"]);
      return { status: "not_published", currentVersion: currentTrip.version, isStale: false };
    },
    async publishPublic(args) {
      calls.push(["publishPublic", args]);
      return { status: "active" };
    },
    async revokePublic(args) {
      calls.push(["revokePublic", args]);
      return { status: "revoked" };
    },
    async invite(args) {
      calls.push(["invite", args]);
      return {
        invitationId: "invitation_1",
        role: args.role,
        status: "pending",
        delivery: { outboxId: "outbox_1", status: "queued" },
      };
    },
    async getLegacyInvitationForMigration(args) {
      calls.push(["getLegacyInvitationForMigration", args]);
      return {
        id: args.collaboratorId,
        email: "legacy@example.com",
        role: "viewer",
        status: "legacy_pending",
      };
    },
    async migrateLegacyInvitation(args) {
      calls.push(["migrateLegacyInvitation", args]);
      return {
        invitationId: "invitation_migrated_1",
        legacyCollaboratorId: args.collaboratorId,
        role: "viewer",
        status: "pending",
        delivery: { outboxId: "outbox_migrated_1", status: "queued" },
      };
    },
    async resendInvitation(args) {
      calls.push(["resendInvitation", args]);
      return {
        invitationId: args.invitationId,
        role: "viewer",
        status: "pending",
        delivery: { outboxId: "outbox_2", status: "queued" },
      };
    },
    async removeCollaborator(args) {
      calls.push(["removeCollaborator", args]);
      return {
        collaboratorId: args.collaboratorId,
        role: "viewer",
        status: "removed",
        changed: true,
        replayed: false,
      };
    },
    async listInvitations() {
      calls.push(["listInvitations"]);
      return [{ id: "invitation_1", role: "viewer", status: "pending" }];
    },
    async acceptInvitation(args) {
      calls.push(["acceptInvitation", args]);
      return { status: "accepted" };
    },
    ...storage,
  };
  const publicStorage = {
    async inspectInvitation(args) {
      calls.push(["inspectInvitation", args]);
      return {
        state: "available",
        invitationId: "invitation_1",
        role: "viewer",
        status: "pending",
        expiresAt: Date.UTC(2026, 8, 3, 12),
        inviterName: "Owner",
        trip: {
          webId: WEB_ID,
          locale: currentTrip.itinerary.locale,
          title: currentTrip.itinerary.title,
          destination: currentTrip.itinerary.destination,
          ...inspectionTrip,
        },
      };
    },
  };
  const session = {
    accessToken: "access-token",
    email: "guest@example.com",
    emailVerified,
    name: "Guest",
    subject: "auth0|guest",
  };
  const webAuth = {
    async accessSession() { return sessionEnabled ? session : undefined; },
    validateCsrf(context) {
      return context.req.header("Origin") === "https://sendero.example"
        && context.req.header("X-CSRF-Token") === CSRF;
    },
    async storePendingInvitation(_context, value) { pending = value; },
    async readPendingInvitation() { return pending; },
    clearPendingInvitation() { pending = undefined; },
  };
  const app = new Hono();
  registerWebApiRoutes(app, {
    convexUrl: "https://example.convex.cloud",
    invitePepper: INVITE_PEPPER,
    now: () => Date.UTC(2026, 7, 27, 12),
    planningEnabled,
    placesApiKey,
    placesFetch,
    persistenceFactory: ({ authToken }) => authToken ? authenticatedStorage : publicStorage,
    publicShareSecret: SHARE_SECRET,
    publicWebUrl: "https://sendero.example",
    ...(sendInvitationEmail ? { sendInvitationEmail } : {}),
    webAuth,
    logger: { warn() {} },
  });
  return {
    app,
    calls,
    currentTrip,
    pending: () => pending,
    setAuthenticated(value) { sessionEnabled = value; },
  };
}

function jsonRequest(path, body, { csrf = CSRF, method = "POST" } = {}) {
  return new Request(`https://sendero.example${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: "https://sendero.example",
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
    },
    body: JSON.stringify(body),
  });
}

const planningBrief = {
  locale: "es",
  destination: "Valencia, España",
  destinationPlaceId: "ChIJb7Dv8ExPYA0ROR1_HwFRo7Q",
  startDate: "2027-04-10",
  endDate: "2027-04-10",
  travellers: { adults: 2 },
  transport: { modes: ["walk", "public_transit"], hasLicense: false, wantsCar: false },
};

const plannedItinerary = {
  locale: "es",
  title: "Valencia a pie",
  destination: "Valencia, España",
  startDate: "2027-04-10",
  endDate: "2027-04-10",
  travellers: { adults: 2, children: 0, seniors: 0 },
  transport: { modes: ["walk", "public_transit"], hasLicense: false, wantsCar: false },
  days: [{
    date: "2027-04-10",
    title: "Centro histórico",
    area: "Ciutat Vella",
    activities: [{
      id: "paseo-centro",
      startTime: "10:00",
      endTime: "11:30",
      title: "Paseo por el centro",
      category: "free_time",
    }],
  }],
};

test("returns authenticated destination suggestions and requires CSRF", async () => {
  const upstreamCalls = [];
  const { app } = fixture({
    placesApiKey: "server-only-test-key",
    async placesFetch(url, options) {
      upstreamCalls.push({ url, options });
      return new Response(JSON.stringify({
        suggestions: [{
          placePrediction: {
            placeId: "ChIJP3Sa8ziYEmsRUKgyFmh9AQM",
            text: { text: "Sydney NSW, Australia" },
            structuredFormat: {
              mainText: { text: "Sydney" },
              secondaryText: { text: "NSW, Australia" },
            },
            types: ["locality", "political"],
          },
        }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });
  const body = {
    query: "syd",
    locale: "en-AU",
    sessionToken: "3dfb0938-9dc6-47ea-b945-75c87f1b9830",
  };

  const rejected = await app.request(jsonRequest(
    "/api/destination-suggestions",
    body,
    { csrf: "wrong" },
  ));
  assert.equal(rejected.status, 403);
  assert.equal(upstreamCalls.length, 0);

  const response = await app.request(jsonRequest("/api/destination-suggestions", body));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    data: {
      suggestions: [{
        placeId: "ChIJP3Sa8ziYEmsRUKgyFmh9AQM",
        label: "Sydney NSW, Australia",
        primaryText: "Sydney",
        secondaryText: "NSW, Australia",
        types: ["locality", "political"],
      }],
    },
  });
  assert.equal(upstreamCalls.length, 1);
});

test("fails closed when destination suggestions are not configured", async () => {
  const { app } = fixture();
  const response = await app.request(jsonRequest("/api/destination-suggestions", {
    query: "par",
    locale: "fr",
    sessionToken: "3dfb0938-9dc6-47ea-b945-75c87f1b9830",
  }));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, "destination_search_unavailable");
});

test("keeps itinerary planning disabled by default behind an authenticated capability", async () => {
  const { app } = fixture();
  const capabilities = await app.request("/api/itinerary-planning/capabilities");
  assert.equal(capabilities.status, 200);
  assert.deepEqual(await capabilities.json(), { data: { enabled: false } });
  const response = await app.request(jsonRequest(
    "/api/itinerary-planning/protocol",
    { brief: planningBrief },
    { csrf: undefined },
  ));
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, "planning_unavailable");
});

test("returns the current protocol and stages only server-validated itineraries", async () => {
  const DRAFT_ID = "draft_1234567890123456";
  const { app, calls } = fixture({
    planningEnabled: true,
    storage: {
      async stageDraft(input) {
        calls.push(["stageDraft", input]);
        return {
          draftId: DRAFT_ID,
          status: "valid",
          expiresAt: Date.UTC(2027, 3, 11),
          protocolVersion: input.protocolVersion,
          warnings: input.warnings,
          itinerary: input.itinerary,
        };
      },
    },
  });
  const protocolResponse = await app.request(jsonRequest(
    "/api/itinerary-planning/protocol",
    { brief: planningBrief },
    { csrf: undefined },
  ));
  assert.equal(protocolResponse.status, 200);
  const protocol = (await protocolResponse.json()).data;
  assert.equal(protocol.brief.ready, true);
  assert.equal(protocol.brief.brief.destinationPlaceId, planningBrief.destinationPlaceId);
  assert.match(protocol.protocol.instructions, /active conversation is the reasoning/);

  const identity = planningProtocolIdentity();
  const stageResponse = await app.request(jsonRequest("/api/itinerary-drafts", {
    brief: planningBrief,
    itinerary: plannedItinerary,
    operationId: "sendero-stage:web-test",
    protocolHash: identity.hash,
    protocolVersion: identity.version,
  }));
  assert.equal(stageResponse.status, 201);
  const staged = (await stageResponse.json()).data;
  assert.equal(staged.draftId, DRAFT_ID);
  assert.equal(staged.status, "valid");
  assert.equal(staged.summary.days, 1);
  assert.equal(calls.filter(([name]) => name === "stageDraft").length, 1);
});

test("requires CSRF and explicit separate calls to save or discard a staged itinerary", async () => {
  const DRAFT_ID = "draft_1234567890123456";
  const { app, calls } = fixture({
    planningEnabled: true,
    storage: {
      async saveDraft(input) {
        calls.push(["saveDraft", input]);
        return {
          draftId: DRAFT_ID,
          status: "saved",
          replayed: false,
          trip: { tripId: "trip_internal_2", webId: WEB_ID, version: 1, itinerary: plannedItinerary },
        };
      },
      async discardDraft(draftId) {
        calls.push(["discardDraft", draftId]);
        return { draftId, status: "discarded" };
      },
    },
  });

  const rejected = await app.request(jsonRequest(
    `/api/itinerary-drafts/${DRAFT_ID}/save`,
    { operationId: "sendero-save:web-test" },
    { csrf: "wrong" },
  ));
  assert.equal(rejected.status, 403);

  const saved = await app.request(jsonRequest(
    `/api/itinerary-drafts/${DRAFT_ID}/save`,
    { operationId: "sendero-save:web-test" },
  ));
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).data.trip.version, 1);

  const discarded = await app.request(new Request(
    `https://sendero.example/api/itinerary-drafts/${DRAFT_ID}`,
    { method: "DELETE", headers: { Origin: "https://sendero.example", "X-CSRF-Token": CSRF } },
  ));
  assert.equal(discarded.status, 200);
  assert.deepEqual(calls.filter(([name]) => ["saveDraft", "discardDraft"].includes(name)), [
    ["saveDraft", { draftId: DRAFT_ID, operationId: "sendero-save:web-test" }],
    ["discardDraft", DRAFT_ID],
  ]);
});

test("lists only safe trip summaries for an authenticated account", async () => {
  const { app, calls } = fixture();
  const response = await app.request("/api/trips");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    data: {
      trips: [{
        webId: WEB_ID,
        locale: "es-MX",
        title: "CDMX entre mercados y diseño",
        destination: "Ciudad de México, México",
        startDate: "2026-09-02",
        endDate: "2026-09-06",
        currentVersion: 3,
        role: "owner",
        updatedAt: "2026-08-27T12:00:00.000Z",
      }],
    },
  });
  assert.deepEqual(calls, [["list"]]);
});

test("backfills stable web IDs before returning historical trips", async () => {
  const backfilled = [];
  const { app } = fixture({
    storage: {
      async list() {
        return [{
          id: "trip_legacy_1",
          locale: "es",
          title: "Sevilla histórica",
          destination: "Sevilla, España",
          startDate: "2027-03-21",
          endDate: "2027-03-27",
          currentVersion: 1,
          role: "viewer",
          updatedAt: Date.UTC(2026, 7, 20, 12),
        }];
      },
      async ensureWebId(tripId) {
        backfilled.push(tripId);
        return { tripId, webId: WEB_ID, changed: true };
      },
    },
  });

  const response = await app.request("/api/trips");
  assert.equal(response.status, 200);
  assert.deepEqual(backfilled, ["trip_legacy_1"]);
  assert.equal((await response.json()).data.trips[0].webId, WEB_ID);
});

test("returns the saved locale with an authenticated trip envelope", async () => {
  const { app } = fixture();
  const response = await app.request(`/api/trips/${WEB_ID}`);
  assert.equal(response.status, 200);
  const payload = (await response.json()).data.trip;
  assert.equal(payload.locale, "es-MX");
  assert.equal(payload.itinerary.locale, "es-MX");
});

test("uses English for legacy trip summaries and envelopes without a locale", async () => {
  const legacy = trip();
  delete legacy.itinerary.locale;
  const { app } = fixture({
    storage: {
      async list() {
        return [{
          id: legacy.id,
          webId: legacy.webId,
          title: legacy.itinerary.title,
          destination: legacy.itinerary.destination,
          startDate: legacy.itinerary.startDate,
          endDate: legacy.itinerary.endDate,
          currentVersion: legacy.version,
          role: legacy.role,
          updatedAt: legacy.updatedAt,
        }];
      },
      async getByWebId() {
        return legacy;
      },
    },
  });

  const listPayload = (await (await app.request("/api/trips")).json()).data;
  assert.equal(listPayload.trips[0].locale, "en");
  const tripPayload = (await (await app.request(`/api/trips/${WEB_ID}`)).json()).data.trip;
  assert.equal(tripPayload.locale, "en");
  assert.equal(tripPayload.itinerary.locale, "en");
});

test("requires a session and exact same-origin CSRF for browser mutations", async () => {
  const signedOut = fixture({ authenticated: false });
  const signedOutResponse = await signedOut.app.request("/api/trips");
  assert.equal(signedOutResponse.status, 401);
  assert.deepEqual(await signedOutResponse.json(), {
    error: {
      code: "authentication_required",
      message: "Sign in to continue.",
      retryable: false,
    },
  });

  const { app, calls } = fixture();
  const response = await app.request(jsonRequest(
    `/api/trips/${WEB_ID}/reservations/status`,
    {
      activityId: "activity-1",
      dayDate: "2026-09-02",
      expectedVersion: 3,
      operationId: "sendero-reservation:request-1",
      status: "confirmed",
    },
    { csrf: "wrong", method: "PATCH" },
  ));
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    error: {
      code: "invalid_csrf",
      message: "Refresh and try again.",
      retryable: false,
    },
  });
  assert.equal(calls.some(([name]) => name === "updateReservation"), false);
});

test("creates an invitation through the durable outbox without a second provider call", async () => {
  let directProviderCalls = 0;
  const { app, calls } = fixture({
    async sendInvitationEmail() {
      directProviderCalls += 1;
      throw new Error("The web request must not send email directly");
    },
  });
  const response = await app.request(jsonRequest(`/api/trips/${WEB_ID}/invitations`, {
    email: "friend@example.com",
    operationId: "sendero-sharing:request-1",
    role: "editor",
  }));
  assert.equal(response.status, 201);
  const payload = await response.json();
  assert.deepEqual(payload, {
    data: {
      delivery: "queued",
      invitationId: "invitation_1",
      status: "pending",
    },
  });
  const inviteCall = calls.find(([name]) => name === "invite")[1];
  assert.match(inviteCall.tokenHash, /^[A-Za-z0-9_-]{43}$/);
  assert.doesNotMatch(JSON.stringify(payload), /token|inviteUrl/);
  assert.equal(directProviderCalls, 0);
});

test("lists legacy pending invitations separately from access-bearing entries", async () => {
  const { app } = fixture({
    storage: {
      async listAccess() {
        return {
          owner: { email: "owner@example.com", name: "Owner", role: "owner" },
          collaborators: [],
          invitations: [],
          legacyInvitations: [{
            id: "collaborator_legacy_1",
            email: "legacy@example.com",
            role: "viewer",
            status: "legacy_pending",
            createdAt: 1,
            updatedAt: 1,
          }],
        };
      },
    },
  });
  const response = await app.request(`/api/trips/${WEB_ID}/access`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    data: {
      generalAccess: { mode: "restricted" },
      invitations: [],
      legacyInvitations: [{
        id: "collaborator_legacy_1",
        email: "legacy@example.com",
        role: "viewer",
        status: "legacy_pending",
        createdAt: 1,
        updatedAt: 1,
      }],
      members: [],
      owner: { email: "owner@example.com", name: "Owner", role: "owner" },
    },
  });
});

test("migrates legacy pending invitations through one idempotent durable operation", async () => {
  const { app, calls } = fixture();
  const request = jsonRequest(
    `/api/trips/${WEB_ID}/legacy-invitations/collaborator_legacy_1/migrate`,
    { operationId: "sendero-sharing:migrate-legacy-1" },
  );
  const response = await app.request(request);
  assert.equal(response.status, 201);
  const payload = await response.json();
  assert.deepEqual(payload, {
    data: {
      delivery: "queued",
      invitationId: "invitation_migrated_1",
      legacyCollaboratorId: "collaborator_legacy_1",
      status: "pending",
    },
  });
  const migration = calls.find(([name]) => name === "migrateLegacyInvitation")[1];
  assert.deepEqual(
    {
      tripId: migration.tripId,
      collaboratorId: migration.collaboratorId,
      operationId: migration.operationId,
      hasExpiresAt: "expiresAt" in migration,
    },
    {
      tripId: "trip_internal_1",
      collaboratorId: "collaborator_legacy_1",
      operationId: "sendero-sharing:migrate-legacy-1",
      hasExpiresAt: false,
    },
  );
  assert.match(migration.tokenHash, /^[A-Za-z0-9_-]{43}$/);
  assert.doesNotMatch(JSON.stringify(payload), /token|inviteUrl/);

  const retry = await app.request(jsonRequest(
    `/api/trips/${WEB_ID}/legacy-invitations/collaborator_legacy_1/migrate`,
    { operationId: "sendero-sharing:migrate-legacy-1" },
  ));
  assert.equal(retry.status, 201);
  const migrations = calls
    .filter(([name]) => name === "migrateLegacyInvitation")
    .map(([, args]) => args);
  assert.equal(migrations.length, 2);
  assert.equal(migrations[1].tokenHash, migrations[0].tokenHash);
});

test("revokes a legacy pending invitation through the collaborator removal operation", async () => {
  const { app, calls } = fixture();
  const response = await app.request(jsonRequest(
    `/api/trips/${WEB_ID}/legacy-invitations/collaborator_legacy_1`,
    { operationId: "sendero-sharing:remove-legacy-1" },
    { method: "DELETE" },
  ));
  assert.equal(response.status, 200);
  assert.equal(calls.some(([name]) => name === "getLegacyInvitationForMigration"), false);
  assert.deepEqual(
    calls.find(([name]) => name === "removeCollaborator")[1],
    {
      tripId: "trip_internal_1",
      collaboratorId: "collaborator_legacy_1",
      operationId: "sendero-sharing:remove-legacy-1",
    },
  );
});

test("resends through the durable outbox without returning bearer recovery material", async () => {
  let directProviderCalls = 0;
  const { app } = fixture({
    storage: {
      async listAccess() {
        return {
          owner: { email: "owner@example.com", name: "Owner", role: "owner" },
          collaborators: [],
          invitations: [{
            id: "invitation_1",
            email: "friend@example.com",
            role: "viewer",
            status: "pending",
          }],
        };
      },
    },
    async sendInvitationEmail() {
      directProviderCalls += 1;
      throw new Error("The web request must not send email directly");
    },
  });
  const response = await app.request(jsonRequest(
    `/api/trips/${WEB_ID}/invitations/invitation_1/resend`,
    { operationId: "sendero-sharing:resend-1" },
  ));
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(payload, {
    data: {
      delivery: "queued",
      invitationId: "invitation_1",
      status: "pending",
    },
  });
  assert.doesNotMatch(JSON.stringify(payload), /token|inviteUrl/);
  assert.equal(directProviderCalls, 0);
});

test("recovers the same public URL after a lost response, reload, or later request", async () => {
  let active = false;
  let tokenHash;
  let tokenDerivation;
  const { app, calls } = fixture({
    storage: {
      async publicStatus() {
        return active
          ? {
              status: "active",
              currentVersion: 3,
              isStale: false,
              tokenHash,
              tokenDerivation,
            }
          : { status: "not_published", currentVersion: 3, isStale: false };
      },
      async publishPublic(args) {
        calls.push(["publishPublic", args]);
        active = true;
        tokenHash = args.tokenHash;
        tokenDerivation = { purpose: "publish", operationId: args.operationId };
        return {
          status: "active",
          currentVersion: 3,
          isStale: false,
          tokenHash,
          tokenDerivation,
        };
      },
    },
  });
  const body = {
    generalAccess: "public_link",
    operationId: "sendero-sharing:lost-response-1",
  };
  const first = await app.request(jsonRequest(`/api/trips/${WEB_ID}/access`, body, { method: "PATCH" }));
  const firstUrl = (await first.json()).data.shareUrl;
  const retry = await app.request(jsonRequest(`/api/trips/${WEB_ID}/access`, body, { method: "PATCH" }));
  assert.equal((await retry.json()).data.shareUrl, firstUrl);
  const later = await app.request(jsonRequest(`/api/trips/${WEB_ID}/access`, {
    ...body,
    operationId: "sendero-sharing:later-request-2",
  }, { method: "PATCH" }));
  assert.equal((await later.json()).data.shareUrl, firstUrl);
  const reloaded = await app.request(`/api/trips/${WEB_ID}/access`);
  const reloadResponse = await reloaded.json();
  const reloadPayload = reloadResponse.data;
  assert.equal(reloadPayload.shareUrl, firstUrl);
  assert.equal(reloadPayload.linkRecoverable, true);
  assert.doesNotMatch(JSON.stringify(reloadResponse), /tokenHash|tokenDerivation/);
  assert.equal(calls.filter(([name]) => name === "publishPublic").length, 1);
});

test("recovers the winning public URL when another request publishes concurrently", async () => {
  let statusReads = 0;
  const winnerOperationId = "sendero-sharing:concurrent-winner-1";
  const winnerToken = derivePublicShareToken({
    secret: SHARE_SECRET,
    purpose: "publish",
    tripId: "trip_internal_1",
    operationId: winnerOperationId,
  });
  const { app, calls } = fixture({
    storage: {
      async publicStatus() {
        statusReads += 1;
        return statusReads === 1
          ? { status: "not_published", currentVersion: 3, isStale: false }
          : {
              status: "active",
              currentVersion: 3,
              publishedVersion: 3,
              isStale: false,
              tokenHash: hashPublicShareToken(winnerToken),
              tokenDerivation: {
                purpose: "publish",
                operationId: winnerOperationId,
              },
            };
      },
      async publishPublic(args) {
        calls.push(["publishPublic", args]);
        throw new Error("This trip already has an active public link; update or rotate it instead");
      },
      async updatePublic(args) {
        calls.push(["updatePublic", args]);
        throw new Error("A current concurrent publication must not be updated");
      },
    },
  });

  const response = await app.request(jsonRequest(`/api/trips/${WEB_ID}/access`, {
    generalAccess: "public_link",
    operationId: "sendero-sharing:concurrent-loser-1",
  }, { method: "PATCH" }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    data: {
      generalAccess: { mode: "public_link" },
      linkRecoverable: true,
      shareUrl: `https://sendero.example/share#${winnerToken}`,
    },
  });
  assert.equal(calls.filter(([name]) => name === "publishPublic").length, 1);
  assert.equal(calls.some(([name]) => name === "updatePublic"), false);
});

test("keeps a hash-only legacy link active without silently replacing it", async () => {
  const { app, calls } = fixture({
    storage: {
      async publicStatus() {
        return {
          status: "active",
          currentVersion: 3,
          isStale: false,
        };
      },
    },
  });
  const loaded = await app.request(`/api/trips/${WEB_ID}/access`);
  assert.deepEqual((await loaded.json()).data, {
    generalAccess: { mode: "public_link" },
    linkRecoverable: false,
    invitations: [],
    legacyInvitations: [],
    members: [],
    owner: { email: "owner@example.com", name: "Owner", role: "owner" },
  });

  const repeated = await app.request(jsonRequest(`/api/trips/${WEB_ID}/access`, {
    generalAccess: "public_link",
    operationId: "sendero-sharing:legacy-request-1",
  }, { method: "PATCH" }));
  assert.deepEqual(await repeated.json(), {
    data: {
      generalAccess: { mode: "public_link" },
      linkRecoverable: false,
    },
  });
  assert.equal(calls.some(([name]) => name === "publishPublic"), false);
  assert.equal(calls.some(([name]) => name === "rotatePublic"), false);
});

test("preserves an invitation through login and accepts it only after an explicit action", async () => {
  const { app, calls, pending, setAuthenticated } = fixture({ authenticated: false });
  const token = "x".repeat(43);
  const inspect = await app.request(jsonRequest("/api/invitations/inspect", {
    token,
    webId: WEB_ID,
  }, { csrf: undefined }));
  const signedOut = (await inspect.json()).data;
  assert.equal(signedOut.state, "signed_out");
  assert.equal(signedOut.invitation.locale, "es-MX");
  assert.equal(signedOut.invitation.inviterName, "Owner");
  assert.equal(signedOut.invitation.invitedEmail, "");
  assert.equal(typeof pending()?.tokenHash, "string");
  assert.equal(calls.some(([name]) => name === "acceptInvitation"), false);

  setAuthenticated(true);
  const ready = await app.request(jsonRequest("/api/invitations/inspect", {
    webId: WEB_ID,
  }, { csrf: undefined }));
  const readyState = (await ready.json()).data;
  assert.equal(readyState.state, "ready");
  assert.equal(readyState.invitation.locale, "es-MX");
  assert.equal(readyState.invitation.inviterName, "Owner");
  assert.equal(readyState.invitation.invitedEmail, "guest@example.com");

  const accepted = await app.request(jsonRequest("/api/invitations/accept", {
    operationId: "sendero-invite-accepted:request-1",
  }));
  assert.equal(accepted.status, 200);
  assert.deepEqual(await accepted.json(), {
    data: { status: "accepted", webId: WEB_ID },
  });
  assert.equal(pending(), undefined);
  assert.equal(calls.filter(([name]) => name === "acceptInvitation").length, 1);
});

test("uses English invitation fallback copy by default and preserves supported trip locales", async () => {
  const cases = [
    { locale: undefined, expectedLocale: "en", expectedTitle: "Shared trip" },
    { locale: "es-AR", expectedLocale: "es-AR", expectedTitle: "Viaje compartido" },
    { locale: "pt-BR", expectedLocale: "pt-BR", expectedTitle: "Viagem compartilhada" },
    { locale: "fr-FR", expectedLocale: "fr-FR", expectedTitle: "Voyage partagé" },
    { locale: "de-DE", expectedLocale: "de-DE", expectedTitle: "Geteilte Reise" },
  ];

  for (const item of cases) {
    const { app } = fixture({
      authenticated: false,
      inspectionTrip: { locale: item.locale, title: "" },
    });
    const response = await app.request(jsonRequest("/api/invitations/inspect", {
      token: "f".repeat(43),
      webId: WEB_ID,
    }, { csrf: undefined }));
    const invitation = (await response.json()).data.invitation;
    assert.equal(invitation.locale, item.expectedLocale);
    assert.equal(invitation.title, item.expectedTitle);
  }
});

test("shows the inviter name but never the invited address on an email mismatch", async () => {
  const { app } = fixture({
    storage: {
      async listInvitations() { return []; },
    },
  });
  const response = await app.request(jsonRequest("/api/invitations/inspect", {
    token: "m".repeat(43),
    webId: WEB_ID,
  }, { csrf: undefined }));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data, {
    state: "email_mismatch",
    invitation: {
      destination: "Ciudad de México, México",
      expiresAt: "2026-09-03T12:00:00.000Z",
      invitedEmail: "",
      inviterName: "Owner",
      locale: "es-MX",
      role: "viewer",
      title: "CDMX entre mercados y diseño",
      webId: WEB_ID,
    },
  });
});

test("never reports an invitation as accepted when it expires during the decision", async () => {
  const { app, pending, setAuthenticated } = fixture({
    authenticated: false,
    storage: {
      async acceptInvitation() {
        return { status: "expired" };
      },
    },
  });
  const token = "y".repeat(43);
  await app.request(jsonRequest("/api/invitations/inspect", {
    token,
    webId: WEB_ID,
  }, { csrf: undefined }));
  setAuthenticated(true);
  const response = await app.request(jsonRequest("/api/invitations/accept", {
    operationId: "sendero-invite-expired:request-1",
  }));
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    error: {
      code: "invitation_unavailable",
      message: "The invitation is no longer available.",
      retryable: false,
    },
  });
  assert.equal(pending(), undefined);
});

test("publishes a public viewer link with an opaque fragment and can restrict it again", async () => {
  let published = false;
  const { app, calls } = fixture({
    storage: {
      async publicStatus() {
        return published
          ? { status: "active", currentVersion: 3, isStale: false }
          : { status: "not_published", currentVersion: 3, isStale: false };
      },
      async publishPublic(args) {
        calls.push(["publishPublic", args]);
        published = true;
        return { status: "active" };
      },
      async revokePublic(args) {
        calls.push(["revokePublic", args]);
        published = false;
        return { status: "revoked" };
      },
    },
  });
  const enabled = await app.request(jsonRequest(`/api/trips/${WEB_ID}/access`, {
    generalAccess: "public_link",
    operationId: "sendero-sharing:public-1",
  }, { method: "PATCH" }));
  const enabledPayload = await enabled.json();
  assert.equal(enabledPayload.data.generalAccess.mode, "public_link");
  assert.match(enabledPayload.data.shareUrl, /^https:\/\/sendero\.example\/share#[A-Za-z0-9_-]{43}$/);

  const restricted = await app.request(jsonRequest(`/api/trips/${WEB_ID}/access`, {
    generalAccess: "restricted",
    operationId: "sendero-sharing:restrict-1",
  }, { method: "PATCH" }));
  assert.deepEqual(await restricted.json(), {
    data: { generalAccess: { mode: "restricted" } },
  });
  assert.equal(calls.filter(([name]) => name === "publishPublic").length, 1);
  assert.equal(calls.filter(([name]) => name === "revokePublic").length, 1);
});
