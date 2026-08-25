import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { AUTH_SCOPES } from "./auth.mjs";
import { hashPublicShareToken } from "./public-sharing.mjs";
import { sanitizePublicSnapshot } from "../shared/public-snapshot.mjs";
import {
  ITINERARY_UI_URI,
  LEGACY_ITINERARY_UI_URI,
  LEGACY_PUBLIC_SHARE_UI_URI,
  LEGACY_TRIP_INTAKE_UI_URI,
  LEGACY_TRIP_LIST_UI_URI,
  LEGACY_TRIP_REQUIREMENTS_UI_URI,
  LEGACY_TRIP_REQUIREMENTS_V2_UI_URI,
  LEGACY_TRIP_REQUIREMENTS_V3_UI_URI,
  PUBLIC_SHARE_UI_URI,
  TRIP_INTAKE_UI_URI,
  TRIP_LIST_UI_URI,
  TRIP_REQUIREMENTS_UI_URI,
  buildDailyRouteUrl,
  createTripPlannerServer,
  normalizeItinerary,
  validateItinerary,
} from "./server.mjs";

function assertInlineWidgetResource(resource, expectedUri) {
  const content = resource.contents[0];
  assert.equal(content.uri, expectedUri);
  assert.equal(content.mimeType, "text/html;profile=mcp-app");
  assert.equal(content._meta.ui.prefersBorder, false);
  assert.match(content.text, /<html class="widget-document" lang="es">/);
  assert.match(content.text, /html\.widget-document #root \{[\s\S]*background: transparent;/);
  assert.match(content.text, /html\.widget-document \.app-shell \{[\s\S]*width: 100%;[\s\S]*max-width: none;[\s\S]*padding: 0;/);
  assert.match(content.text, /notifyIntrinsicHeight/);
  assert.match(content.text, /ui\/notifications\/size-changed/);
  assert.doesNotMatch(content.text, /brand-line/);
}

const itinerary = {
  title: "Lisboa entre clásicos y barrios",
  destination: "Lisboa, Portugal",
  startDate: "2026-08-22",
  endDate: "2026-08-23",
  lodging: {
    name: "Alojamiento",
    address: "Bairro Alto, Lisboa",
  },
  transport: {
    modes: ["public_transit", "taxi", "walk"],
    hasLicense: false,
    wantsCar: false,
  },
  days: [
    {
      date: "2026-08-22",
      title: "Actividad reservada y noche cultural",
      area: "Belém · Alcântara",
      summary: "Una mañana fija y una tarde liviana.",
      fallback: "Cambiar el paseo exterior por una merienda cerca del cine.",
      activities: [
        {
          id: "reserved-morning",
          startTime: "09:00",
          endTime: "13:00",
          title: "Actividad ya reservada",
          category: "activity",
          locked: true,
          location: { name: "Mosteiro dos Jerónimos", address: "Praca do Imperio, Lisboa" },
          reservation: { status: "confirmed", note: "Reserva existente" },
          travelToNext: { mode: "taxi", durationMinutes: 35 },
        },
        {
          id: "evening-show",
          startTime: "19:00",
          endTime: "22:00",
          title: "Concierto en LX Factory",
          category: "music",
          location: { name: "LX Factory", address: "Rua Rodrigues de Faria 103, Lisboa" },
          reservation: {
            status: "pending",
            url: "https://www.lxfactory.com/",
          },
        },
      ],
      route: {
        origin: "Bairro Alto, Lisboa",
        stops: ["Praca do Imperio, Lisboa", "Rua Rodrigues de Faria 103, Lisboa"],
        returnToLodging: true,
      },
    },
  ],
};

test("validates realistic constraints and creates a daily route", () => {
  const validation = validateItinerary(itinerary);
  assert.equal(validation.valid, true);
  assert.equal(validation.errors.length, 0);

  const mapUrl = buildDailyRouteUrl(itinerary, itinerary.days[0]);
  assert.match(mapUrl, /^https:\/\/www\.google\.com\/maps\/dir\//);
  assert.match(mapUrl, /travelmode=transit/);

  const normalized = normalizeItinerary(itinerary);
  assert.equal(normalized.days[0].route.mapUrl, mapUrl);
});

test("rejects driving without a license and overlapping activities", () => {
  const invalid = structuredClone(itinerary);
  invalid.transport.modes = ["car"];
  invalid.transport.wantsCar = true;
  invalid.days[0].activities[1].startTime = "12:30";
  const validation = validateItinerary(invalid);

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((message) => message.includes("driving license")));
  assert.ok(validation.errors.some((message) => message.includes("overlaps")));
});

test("advertises the planning tools and renders the MCP Apps resource", async () => {
  const server = createTripPlannerServer();
  const client = new Client({ name: "sendero-test", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const tools = await client.listTools();
  assert.deepEqual(
    tools.tools.map((tool) => tool.name).sort(),
    [
      "find_itineraries",
      "get_itinerary",
      "get_public_share_status",
      "list_itineraries",
      "prepare_trip_brief",
      "preview_public_share",
      "publish_public_share",
      "render_itinerary",
      "render_trip_intake",
      "render_trip_requirements",
      "restore_itinerary_version",
      "revoke_public_share",
      "rotate_public_share",
      "save_itinerary",
      "share_itinerary",
      "update_public_share",
      "validate_itinerary",
    ],
  );
  const publicTool = tools.tools.find((tool) => tool.name === "render_itinerary");
  const findTool = tools.tools.find((tool) => tool.name === "find_itineraries");
  const intakeTool = tools.tools.find((tool) => tool.name === "render_trip_intake");
  const tripListTool = tools.tools.find((tool) => tool.name === "list_itineraries");
  const prepareTool = tools.tools.find((tool) => tool.name === "prepare_trip_brief");
  const requirementsTool = tools.tools.find((tool) => tool.name === "render_trip_requirements");
  const publicShareTool = tools.tools.find((tool) => tool.name === "preview_public_share");
  const publicShareMutationTools = [
    "publish_public_share",
    "update_public_share",
    "rotate_public_share",
    "revoke_public_share",
  ].map((name) => tools.tools.find((tool) => tool.name === name));
  const protectedTool = tools.tools.find((tool) => tool.name === "save_itinerary");
  assert.deepEqual(publicTool._meta.securitySchemes, [{ type: "noauth" }]);
  assert.equal(findTool._meta.ui, undefined);
  assert.equal(publicTool._meta.ui.resourceUri, ITINERARY_UI_URI);
  assert.equal(publicTool._meta["openai/outputTemplate"], ITINERARY_UI_URI);
  assert.equal(intakeTool._meta.ui.resourceUri, TRIP_INTAKE_UI_URI);
  assert.equal(tripListTool._meta.ui.resourceUri, TRIP_LIST_UI_URI);
  assert.equal(tripListTool._meta["openai/outputTemplate"], TRIP_LIST_UI_URI);
  assert.deepEqual(prepareTool._meta.ui.visibility, ["model", "app"]);
  assert.equal(prepareTool._meta["openai/widgetAccessible"], true);
  assert.equal(prepareTool.annotations.readOnlyHint, true);
  assert.equal(requirementsTool._meta.ui.resourceUri, TRIP_REQUIREMENTS_UI_URI);
  assert.equal(requirementsTool._meta["openai/outputTemplate"], TRIP_REQUIREMENTS_UI_URI);
  assert.equal(publicShareTool._meta.ui.resourceUri, PUBLIC_SHARE_UI_URI);
  assert.deepEqual(publicShareTool._meta.securitySchemes, [
    { type: "oauth2", scopes: [AUTH_SCOPES.share] },
  ]);
  for (const tool of publicShareMutationTools) {
    assert.equal(tool.annotations.openWorldHint, true);
    assert.equal(tool.inputSchema.properties.operationId.maxLength, 128);
    assert.equal(tool.inputSchema.properties.operationId.pattern, "^[A-Za-z0-9._:-]+$");
  }
  assert.deepEqual(protectedTool._meta.securitySchemes, [
    { type: "oauth2", scopes: [AUTH_SCOPES.write] },
  ]);

  const result = await client.callTool({
    name: "render_itinerary",
    arguments: { itinerary },
  });
  assert.equal(result.structuredContent.itinerary.days.length, 1);
  assert.equal(result.structuredContent.validation.valid, true);

  const resource = await client.readResource({ uri: ITINERARY_UI_URI });
  assertInlineWidgetResource(resource, ITINERARY_UI_URI);
  assert.match(resource.contents[0].text, /Calendario/);
  assert.match(resource.contents[0].text, /Rutas/);
  assert.match(resource.contents[0].text, /toolOutput/);
  assert.match(resource.contents[0].text, /ui\/notifications\/tool-result/);

  const legacyItineraryResource = await client.readResource({ uri: LEGACY_ITINERARY_UI_URI });
  assertInlineWidgetResource(legacyItineraryResource, LEGACY_ITINERARY_UI_URI);
  assert.equal(legacyItineraryResource.contents[0].text, resource.contents[0].text);

  const intake = await client.callTool({ name: "render_trip_intake", arguments: {} });
  assert.equal(intake.structuredContent.mode, "new");
  assert.deepEqual(intake.structuredContent.actions, []);
  const menu = await client.callTool({ name: "render_trip_intake", arguments: { mode: "menu" } });
  assert.equal(menu.structuredContent.mode, "menu");
  assert.deepEqual(menu.structuredContent.actions, ["new", "open", "adjust", "refresh"]);
  const intakeResource = await client.readResource({ uri: TRIP_INTAKE_UI_URI });
  assertInlineWidgetResource(intakeResource, TRIP_INTAKE_UI_URI);
  assert.match(intakeResource.contents[0].text, /Nuevo viaje/);
  assert.match(intakeResource.contents[0].text, /area_only/);
  assert.match(intakeResource.contents[0].text, /undecided/);

  const legacyIntakeResource = await client.readResource({ uri: LEGACY_TRIP_INTAKE_UI_URI });
  assertInlineWidgetResource(legacyIntakeResource, LEGACY_TRIP_INTAKE_UI_URI);
  assert.equal(legacyIntakeResource.contents[0].text, intakeResource.contents[0].text);

  const tripListResource = await client.readResource({ uri: TRIP_LIST_UI_URI });
  assertInlineWidgetResource(tripListResource, TRIP_LIST_UI_URI);
  assert.match(tripListResource.contents[0].text, /Viaje elegido/);
  assert.match(tripListResource.contents[0].text, /selectedTrip/);

  const legacyTripListResource = await client.readResource({ uri: LEGACY_TRIP_LIST_UI_URI });
  assertInlineWidgetResource(legacyTripListResource, LEGACY_TRIP_LIST_UI_URI);
  assert.equal(legacyTripListResource.contents[0].text, tripListResource.contents[0].text);

  const requirementsResource = await client.readResource({ uri: TRIP_REQUIREMENTS_UI_URI });
  assertInlineWidgetResource(requirementsResource, TRIP_REQUIREMENTS_UI_URI);
  assert.match(requirementsResource.contents[0].text, /ui\/update-model-context/);
  assert.match(requirementsResource.contents[0].text, /prepare_trip_brief/);
  assert.match(requirementsResource.contents[0].text, /brief_ready/);

  const legacyRequirementsResource = await client.readResource({ uri: LEGACY_TRIP_REQUIREMENTS_UI_URI });
  assert.equal(legacyRequirementsResource.contents[0].uri, LEGACY_TRIP_REQUIREMENTS_UI_URI);
  assert.equal(legacyRequirementsResource.contents[0]._meta.ui.prefersBorder, false);
  assert.equal(legacyRequirementsResource.contents[0].text, requirementsResource.contents[0].text);

  const legacyRequirementsV2Resource = await client.readResource({ uri: LEGACY_TRIP_REQUIREMENTS_V2_UI_URI });
  assert.equal(legacyRequirementsV2Resource.contents[0].uri, LEGACY_TRIP_REQUIREMENTS_V2_UI_URI);
  assert.equal(legacyRequirementsV2Resource.contents[0]._meta.ui.prefersBorder, false);
  assert.equal(legacyRequirementsV2Resource.contents[0].text, requirementsResource.contents[0].text);

  const legacyRequirementsV3Resource = await client.readResource({ uri: LEGACY_TRIP_REQUIREMENTS_V3_UI_URI });
  assertInlineWidgetResource(legacyRequirementsV3Resource, LEGACY_TRIP_REQUIREMENTS_V3_UI_URI);
  assert.equal(legacyRequirementsV3Resource.contents[0].text, requirementsResource.contents[0].text);

  const publicShareResource = await client.readResource({ uri: PUBLIC_SHARE_UI_URI });
  assertInlineWidgetResource(publicShareResource, PUBLIC_SHARE_UI_URI);
  assert.match(publicShareResource.contents[0].text, /share-exact-preview/);
  assert.match(publicShareResource.contents[0].text, /publish_public_share/);
  assert.match(publicShareResource.contents[0].text, /proposedExpiresAt/);
  assert.match(publicShareResource.contents[0].text, /Reemplazar enlace/);

  const legacyPublicShareResource = await client.readResource({ uri: LEGACY_PUBLIC_SHARE_UI_URI });
  assertInlineWidgetResource(legacyPublicShareResource, LEGACY_PUBLIC_SHARE_UI_URI);
  assert.equal(legacyPublicShareResource.contents[0].text, publicShareResource.contents[0].text);

  await client.close();
  await server.close();
});

test("accepts a provisional lodging base in a ready trip brief", async () => {
  const server = createTripPlannerServer();
  const client = new Client({ name: "sendero-test", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const result = await client.callTool({
    name: "prepare_trip_brief",
    arguments: {
      brief: {
        destination: "Sevilla, España",
        startDate: "2027-03-21",
        endDate: "2027-03-27",
        lodging: { status: "area_only", name: "Zona provisional", area: "Prado" },
        travellers: { adults: 2, children: 0 },
        transport: {
          modes: ["walk", "public_transit"],
          hasLicense: false,
          wantsCar: false,
        },
      },
    },
  });

  assert.equal(result.structuredContent.ready, true);
  assert.deepEqual(result.structuredContent.missing, []);
  assert.match(result.structuredContent.assumptions[0], /Prado/);

  await client.close();
  await server.close();
});

test("groups every known critical trip gap into one requirements component", async () => {
  const server = createTripPlannerServer();
  const client = new Client({ name: "sendero-requirements-test", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const prepared = await client.callTool({
    name: "prepare_trip_brief",
    arguments: { brief: {} },
  });
  assert.equal(prepared.structuredContent.ready, false);
  assert.deepEqual(prepared.structuredContent.criticalFields, [
    "destination",
    "startDate",
    "endDate",
    "travellers.adults",
    "transport.modes",
  ]);
  assert.match(prepared.content[0].text, /destino/);
  assert.match(prepared.content[0].text, /fecha de llegada/);
  assert.match(prepared.content[0].text, /fecha de regreso/);
  assert.match(prepared.content[0].text, /cantidad de adultos/);
  assert.match(prepared.content[0].text, /cómo quieren moverse/);
  assert.doesNotMatch(prepared.content[0].text, /criticalFields|component above|render_/);

  const partiallyKnown = await client.callTool({
    name: "prepare_trip_brief",
    arguments: {
      brief: {
        destination: "Sevilla, España",
        travellers: { adults: 2 },
      },
    },
  });
  assert.deepEqual(partiallyKnown.structuredContent.criticalFields, [
    "startDate",
    "endDate",
    "transport.modes",
  ]);

  const requirements = await client.callTool({
    name: "render_trip_requirements",
    arguments: {
      interactionId: "conversation-step-1",
      brief: { destination: "Buenos Aires, Argentina" },
    },
  });
  assert.equal(requirements.structuredContent.interactionId, "conversation-step-1");
  assert.deepEqual(requirements.structuredContent.fields, [
    "startDate",
    "endDate",
    "travellers.adults",
    "transport.modes",
  ]);
  assert.equal(requirements.structuredContent.brief.destination, "Buenos Aires, Argentina");
  assert.match(requirements.content[0].text, /fecha de llegada/);
  assert.match(requirements.content[0].text, /fecha de regreso/);
  assert.match(requirements.content[0].text, /cantidad de adultos/);
  assert.match(requirements.content[0].text, /cómo quieren moverse/);
  assert.doesNotMatch(requirements.content[0].text, /render_|prepare_|tripId|\{\s*"/);

  const readyWithoutOptionalDetails = await client.callTool({
    name: "prepare_trip_brief",
    arguments: {
      brief: {
        destination: "Montevideo, Uruguay",
        startDate: "2027-02-10",
        endDate: "2027-02-14",
        travellers: { adults: 2 },
        transport: { modes: ["walk", "public_transit"], wantsCar: false },
      },
    },
  });
  assert.equal(readyWithoutOptionalDetails.structuredContent.ready, true);
  assert.deepEqual(readyWithoutOptionalDetails.structuredContent.criticalFields, []);
  assert.ok(readyWithoutOptionalDetails.structuredContent.assumptions.length > 0);

  const carWithoutLicense = await client.callTool({
    name: "prepare_trip_brief",
    arguments: {
      brief: {
        destination: "Mendoza, Argentina",
        startDate: "2027-04-02",
        endDate: "2027-04-06",
        travellers: { adults: 2 },
        transport: { modes: ["car"], wantsCar: true, hasLicense: false },
      },
    },
  });
  assert.equal(carWithoutLicense.structuredContent.ready, false);
  assert.deepEqual(carWithoutLicense.structuredContent.missing, []);
  assert.deepEqual(carWithoutLicense.structuredContent.criticalFields, ["transport.modes"]);
  assert.equal(carWithoutLicense.structuredContent.warnings.length, 1);

  const invalidDates = await client.callTool({
    name: "prepare_trip_brief",
    arguments: {
      brief: {
        destination: "Buenos Aires, Argentina",
        startDate: "2027-08-26",
        endDate: "2027-08-13",
        travellers: { adults: 3 },
        transport: { modes: ["public_transit"], wantsCar: false },
      },
    },
  });
  assert.equal(invalidDates.structuredContent.ready, false);
  assert.deepEqual(invalidDates.structuredContent.missing, []);
  assert.deepEqual(invalidDates.structuredContent.criticalFields, ["startDate", "endDate"]);

  await client.close();
  await server.close();
});

test("returns an OAuth challenge before a protected tool touches storage", async () => {
  let storageCalled = false;
  const server = createTripPlannerServer({
    persistence: {
      async list() {
        storageCalled = true;
        return [];
      },
    },
    auth: {
      authenticated: false,
      scopes: [],
      resourceMetadataUrl:
        "https://sendero.example/.well-known/oauth-protected-resource",
    },
  });
  const client = new Client({ name: "sendero-auth-test", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const result = await client.callTool({ name: "list_itineraries", arguments: {} });
  assert.equal(result.isError, true);
  assert.equal(storageCalled, false);
  assert.match(result._meta["mcp/www_authenticate"][0], /error="invalid_token"/);
  assert.match(result._meta["mcp/www_authenticate"][0], /scope="trips:read"/);

  await client.close();
  await server.close();
});

test("saves, lists, opens, shares, and restores trips through the persistence boundary", async () => {
  const calls = [];
  const persistence = {
    async list() {
      calls.push(["list"]);
      return [
        {
          id: "trip_123",
          title: itinerary.title,
          destination: itinerary.destination,
          startDate: itinerary.startDate,
          endDate: itinerary.endDate,
          currentVersion: 2,
          role: "owner",
          updatedAt: 1786900000000,
        },
      ];
    },
    async get(tripId) {
      calls.push(["get", tripId]);
      return {
        id: tripId,
        role: "owner",
        version: 2,
        itinerary,
        revisions: [{ version: 1, reason: "Trip created", createdAt: 1786800000000 }],
      };
    },
    async save(input) {
      calls.push(["save", input]);
      return { tripId: input.tripId || "trip_123", version: input.tripId ? 2 : 1, role: "owner" };
    },
    async share(input) {
      calls.push(["share", input]);
      return { collaboratorId: "collab_123", role: input.role, status: "pending" };
    },
    async restore(input) {
      calls.push(["restore", input]);
      return { tripId: input.tripId, version: 3, restoredFrom: input.version, role: "owner" };
    },
  };

  const server = createTripPlannerServer({
    persistence,
    auth: {
      authenticated: true,
      scopes: Object.values(AUTH_SCOPES),
      resourceMetadataUrl:
        "https://sendero.example/.well-known/oauth-protected-resource",
    },
  });
  const client = new Client({ name: "sendero-persistence-test", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const found = await client.callTool({
    name: "find_itineraries",
    arguments: { query: "LISBOA CLASICOS" },
  });
  assert.equal(found.structuredContent.trips.length, 1);
  assert.equal(found.structuredContent.trips[0].id, "trip_123");

  const listed = await client.callTool({ name: "list_itineraries", arguments: { purpose: "adjust" } });
  assert.equal(listed.structuredContent.trips[0].id, "trip_123");
  assert.equal(listed.structuredContent.purpose, "adjust");
  assert.match(listed.content[0].text, /Lisboa entre clásicos y barrios/);
  assert.doesNotMatch(listed.content[0].text, /trip_123|tripId|list_|get_|render_|\{\s*"/);

  const opened = await client.callTool({
    name: "get_itinerary",
    arguments: { tripId: "trip_123" },
  });
  assert.equal(opened.structuredContent.itinerary.title, itinerary.title);

  const saved = await client.callTool({
    name: "save_itinerary",
    arguments: { itinerary, reason: "Initial plan" },
  });
  assert.equal(saved.structuredContent.version, 1);

  const shared = await client.callTool({
    name: "share_itinerary",
    arguments: { tripId: "trip_123", email: "friend@example.com", role: "editor" },
  });
  assert.equal(shared.structuredContent.status, "pending");

  const restored = await client.callTool({
    name: "restore_itinerary_version",
    arguments: { tripId: "trip_123", version: 1 },
  });
  assert.equal(restored.structuredContent.version, 3);
  assert.deepEqual(
    calls.map(([name]) => name),
    ["list", "list", "get", "save", "share", "restore"],
  );

  await client.close();
  await server.close();
});

test("previews, publishes, updates, rotates, and revokes a public snapshot without leaking token internals", async () => {
  const calls = [];
  const publicItinerary = sanitizePublicSnapshot(itinerary);
  let currentVersion = 2;
  let publishedVersion;
  let status = "not_published";
  let publishedAt;
  let updatedAt;
  let expiresAt;
  const summary = {
    title: publicItinerary.title,
    destination: publicItinerary.destination,
    startDate: publicItinerary.startDate,
    endDate: publicItinerary.endDate,
  };

  function sharing() {
    return {
      status,
      currentVersion,
      ...(publishedVersion ? { publishedVersion } : {}),
      isStale: Boolean(publishedVersion && publishedVersion !== currentVersion),
      ...(publishedAt ? { publishedAt } : {}),
      ...(updatedAt ? { updatedAt } : {}),
      ...(expiresAt ? { expiresAt } : {}),
      ...(publishedVersion ? { summary } : {}),
    };
  }

  const persistence = {
    async publicPreview(tripId) {
      calls.push(["preview", tripId]);
      return { itinerary: publicItinerary, version: currentVersion, sharing: sharing() };
    },
    async publicStatus(tripId) {
      calls.push(["status", tripId]);
      return sharing();
    },
    async publishPublic(input) {
      calls.push(["publish", input]);
      assert.equal(input.expectedVersion, currentVersion);
      status = "active";
      publishedVersion = currentVersion;
      publishedAt ||= 1_800_000_000_000;
      updatedAt = publishedAt;
      expiresAt = input.expiresAt;
      return sharing();
    },
    async updatePublic(input) {
      calls.push(["update", input]);
      publishedVersion = input.expectedVersion;
      updatedAt = 1_800_000_100_000;
      return sharing();
    },
    async rotatePublic(input) {
      calls.push(["rotate", input]);
      updatedAt = 1_800_000_200_000;
      return sharing();
    },
    async revokePublic(input) {
      calls.push(["revoke", input]);
      status = "revoked";
      updatedAt = 1_800_000_300_000;
      return sharing();
    },
  };
  const secret = "sendero-test-public-share-secret-with-at-least-32-bytes";
  const server = createTripPlannerServer({
    persistence,
    publicWebUrl: "https://sendero.example",
    publicShareSecret: secret,
    auth: {
      authenticated: true,
      scopes: Object.values(AUTH_SCOPES),
      resourceMetadataUrl: "https://sendero.example/.well-known/oauth-protected-resource",
    },
  });
  const client = new Client({ name: "sendero-public-share-test", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const preview = await client.callTool({
    name: "preview_public_share",
    arguments: { tripId: "trip_public", expiresInDays: 14 },
  });
  assert.equal(preview.structuredContent.state, "preview");
  assert.equal(preview.structuredContent.action, "publish");
  assert.equal(preview.structuredContent.expectedVersion, 2);
  assert.equal(preview.structuredContent.itinerary.lodging, undefined);
  assert.doesNotMatch(JSON.stringify(preview.structuredContent), /Bairro Alto|Reserva existente/);

  const publishArguments = {
    tripId: "trip_public",
    expectedVersion: 2,
    proposedExpiresAt: preview.structuredContent.proposedExpiresAt,
    operationId: preview.structuredContent.operationId,
  };
  const published = await client.callTool({
    name: "publish_public_share",
    arguments: publishArguments,
  });
  assert.equal(published.structuredContent.state, "published");
  const firstUrl = new URL(published.structuredContent.publicUrl);
  const firstToken = firstUrl.hash.slice(1);
  assert.equal(firstUrl.pathname, "/share");
  assert.equal(firstToken.length, 43);
  const publishCall = calls.find(([name]) => name === "publish")[1];
  assert.equal(publishCall.expiresAt, preview.structuredContent.proposedExpiresAt);
  assert.equal(publishCall.tokenHash, hashPublicShareToken(firstToken));
  assert.equal(JSON.stringify(publishCall).includes(firstToken), false);
  assert.doesNotMatch(JSON.stringify(published.structuredContent), /tokenHash/);

  const publishedRetry = await client.callTool({
    name: "publish_public_share",
    arguments: publishArguments,
  });
  assert.equal(publishedRetry.structuredContent.publicUrl, published.structuredContent.publicUrl);
  assert.equal(calls.filter(([name]) => name === "preview").length, 1);

  currentVersion = 3;
  const stale = await client.callTool({
    name: "get_public_share_status",
    arguments: { tripId: "trip_public" },
  });
  assert.equal(stale.structuredContent.state, "active");
  assert.equal(stale.structuredContent.isStale, true);
  assert.equal(stale.structuredContent.publicUrl, undefined);
  assert.equal(calls.at(-1)[0], "status");

  const updatePreview = await client.callTool({
    name: "preview_public_share",
    arguments: { tripId: "trip_public" },
  });
  assert.equal(updatePreview.structuredContent.action, "update");
  assert.equal(updatePreview.structuredContent.expectedVersion, 3);
  const updated = await client.callTool({
    name: "update_public_share",
    arguments: {
      tripId: "trip_public",
      expectedVersion: 3,
      operationId: updatePreview.structuredContent.operationId,
    },
  });
  assert.equal(updated.structuredContent.state, "updated");
  assert.equal(updated.structuredContent.isStale, false);
  assert.equal(updated.structuredContent.publicUrl, undefined);
  assert.equal(calls.filter(([name]) => name === "preview").length, 2);

  const rotateArguments = {
    tripId: "trip_public",
    operationId: "rotate-operation-123",
  };
  const rotated = await client.callTool({
    name: "rotate_public_share",
    arguments: rotateArguments,
  });
  const rotatedRetry = await client.callTool({
    name: "rotate_public_share",
    arguments: rotateArguments,
  });
  assert.equal(rotated.structuredContent.state, "rotated");
  assert.notEqual(rotated.structuredContent.publicUrl, published.structuredContent.publicUrl);
  assert.equal(rotatedRetry.structuredContent.publicUrl, rotated.structuredContent.publicUrl);

  const revoked = await client.callTool({
    name: "revoke_public_share",
    arguments: { tripId: "trip_public", operationId: "revoke-operation-123" },
  });
  assert.equal(revoked.structuredContent.state, "revoked");
  assert.equal(revoked.structuredContent.publicUrl, undefined);
  assert.equal(calls.filter(([name]) => name === "preview").length, 2);
  assert.doesNotMatch(
    [preview, published, stale, updated, rotated, revoked]
      .flatMap((result) => result.content || [])
      .map((content) => content.text || "")
      .join(" "),
    /trip_public|tokenHash|operationId|preview_public_share|publish_public_share/,
  );

  await client.close();
  await server.close();
});
