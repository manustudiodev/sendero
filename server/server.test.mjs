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
  LEGACY_ITINERARY_V3_UI_URI,
  LEGACY_ITINERARY_V4_UI_URI,
  LEGACY_ITINERARY_V5_UI_URI,
  LEGACY_ITINERARY_V6_UI_URI,
  LEGACY_ITINERARY_V7_UI_URI,
  LEGACY_ITINERARY_V8_UI_URI,
  LEGACY_ITINERARY_V9_UI_URI,
  LEGACY_PUBLIC_SHARE_UI_URI,
  LEGACY_PUBLIC_SHARE_V2_UI_URI,
  LEGACY_PUBLIC_SHARE_V3_UI_URI,
  LEGACY_TRIP_INTAKE_UI_URI,
  LEGACY_TRIP_INTAKE_V3_UI_URI,
  LEGACY_TRIP_INTAKE_V4_UI_URI,
  LEGACY_TRIP_LIST_UI_URI,
  LEGACY_TRIP_LIST_V2_UI_URI,
  LEGACY_TRIP_LIST_V3_UI_URI,
  LEGACY_TRIP_REQUIREMENTS_UI_URI,
  LEGACY_TRIP_REQUIREMENTS_V2_UI_URI,
  LEGACY_TRIP_REQUIREMENTS_V3_UI_URI,
  LEGACY_TRIP_REQUIREMENTS_V4_UI_URI,
  LEGACY_TRIP_REQUIREMENTS_V5_UI_URI,
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
  assert.equal(typeof content._meta["openai/widgetDescription"], "string");
  assert.ok(content._meta["openai/widgetDescription"].length > 40);
  assert.match(content.text, /<html class="widget-document" lang="es">/);
  assert.match(content.text, /html\.widget-document #root \{[\s\S]*background: transparent;/);
  assert.match(content.text, /html\.widget-document \.app-shell \{[\s\S]*width: 100%;[\s\S]*max-width: none;[\s\S]*padding: 0;/);
  assert.match(content.text, /notifyIntrinsicHeight/);
  assert.match(content.text, /ui\/notifications\/size-changed/);
  assert.match(content.text, /html\.widget-document\[data-theme="dark"\]/);
  assert.match(content.text, /dataset\.theme/);
  assert.match(content.text, /color-scheme: dark/);
  assert.doesNotMatch(content.text, /brand-line/);
}

test("pins a fresh URI for every current Sendero component bundle", () => {
  assert.deepEqual(
    {
      itinerary: ITINERARY_UI_URI,
      intake: TRIP_INTAKE_UI_URI,
      trips: TRIP_LIST_UI_URI,
      requirements: TRIP_REQUIREMENTS_UI_URI,
      share: PUBLIC_SHARE_UI_URI,
    },
    {
      itinerary: "ui://sendero/itinerary-v10.html",
      intake: "ui://sendero/trip-intake-v5.html",
      trips: "ui://sendero/trip-list-v4.html",
      requirements: "ui://sendero/trip-requirements-v6.html",
      share: "ui://sendero/public-share-control-v4.html",
    },
  );
});

const itinerary = {
  title: "Lisboa entre clásicos y barrios",
  destination: "Lisboa, Portugal",
  startDate: "2026-08-22",
  endDate: "2026-08-23",
  lodging: {
    name: "Alojamiento",
    address: "Bairro Alto, Lisboa",
    status: "confirmed",
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
          guide: {
            overview: "El monasterio es una obra central del gótico manuelino y un testimonio monumental de la Lisboa vinculada a los viajes marítimos portugueses.",
            highlights: ["Observa la piedra tallada del claustro y sus motivos náuticos."],
            sources: [
              {
                label: "Patrimonio Cultural de Portugal",
                url: "https://www.patrimoniocultural.gov.pt/",
                checkedAt: "2026-08-20",
              },
            ],
          },
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
  assert.equal(normalized.days[0].route.returnToLodging, true);
  assert.equal(normalized.days[0].route.origin, "Bairro Alto, Lisboa");
  assert.deepEqual(normalized.days[0].activities[0].guide, itinerary.days[0].activities[0].guide);
});

test("keeps operational descriptions separate from source-backed place guides", () => {
  const candidate = structuredClone(itinerary);
  candidate.days[0].activities[0].description = "Llegar quince minutos antes y presentar la entrada.";
  assert.equal(validateItinerary(candidate).valid, true);

  const legacy = structuredClone(candidate);
  delete legacy.days[0].activities[0].guide;
  assert.equal(validateItinerary(legacy).valid, true);

  const unsafeGuide = structuredClone(candidate);
  unsafeGuide.days[0].activities[0].guide.sources[0].url = "javascript:alert(1)";
  const unsafeValidation = validateItinerary(unsafeGuide);
  assert.equal(unsafeValidation.valid, false);
  assert.ok(unsafeValidation.errors.some((message) => message.includes("HTTP(S)")));
});

test("rebuilds daily links from ordered public activities and excludes provisional bases", () => {
  const plan = structuredClone(itinerary);
  plan.destination = "Ciudad de México, México";
  plan.lodging = {
    name: "Base provisional Roma Norte / Condesa",
    area: "Roma Norte / Condesa",
    status: "area_only",
  };
  plan.days[0].route = {
    origin: "Base provisional Roma Norte / Condesa",
    stops: ["University Campus of Buenos Aires", "La Condesa Cocina Argentina"],
    returnToLodging: true,
    mapUrl: "https://www.google.com/maps/dir/?api=1&origin=stale",
  };
  plan.days[0].activities = [
    {
      id: "base",
      startTime: "08:00",
      title: "Salida",
      location: {
        name: "Base provisional Roma Norte / Condesa",
        address: "Base provisional Roma Norte / Condesa",
      },
    },
    {
      id: "museum",
      startTime: "10:00",
      title: "Museo",
      location: { name: "Museo Frida Kahlo", address: "Londres 247, Coyoacán" },
    },
    {
      id: "duplicate",
      startTime: "12:00",
      title: "Almuerzo cercano",
      location: { name: "Museo Frida Kahlo", address: "Londres 247, Coyoacán" },
    },
    {
      id: "park",
      startTime: "15:00",
      title: "Parque",
      location: { name: "Parque México", address: "Av. México, Hipódromo" },
    },
  ];

  const normalized = normalizeItinerary(plan);
  assert.deepEqual(normalized.days[0].route.stops, [
    "Londres 247, Coyoacán, Ciudad de México, México",
    "Av. México, Hipódromo, Ciudad de México, México",
  ]);
  assert.equal(normalized.days[0].route.returnToLodging, false);
  assert.equal(normalized.days[0].route.totalMinutes, undefined);
  assert.doesNotMatch(normalized.days[0].route.mapUrl, /stale|provisional|Buenos Aires/i);
  assert.match(normalized.days[0].route.mapUrl, /maps\/dir/);

  plan.days[0].activities = [plan.days[0].activities[1]];
  const oneStop = normalizeItinerary(plan).days[0].route;
  assert.match(oneStop.mapUrl, /maps\/search/);
  assert.doesNotMatch(oneStop.mapUrl, /maps\/dir/);
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

test("rejects duplicate activity IDs before reservation controls can target them", () => {
  const invalid = structuredClone(itinerary);
  invalid.days[0].activities[1].id = invalid.days[0].activities[0].id;
  const validation = validateItinerary(invalid);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((message) => message.includes("duplicate activity ID")));
});

test("rejects non-HTTP source and reservation URLs at the server boundary", () => {
  const unsafeReservation = structuredClone(itinerary);
  unsafeReservation.days[0].activities[1].reservation.url = "javascript:alert(1)";
  const reservationValidation = validateItinerary(unsafeReservation);
  assert.equal(reservationValidation.valid, false);
  assert.ok(reservationValidation.errors.some((message) => message.includes("HTTP(S)")));

  const unsafeSources = structuredClone(itinerary);
  unsafeSources.days[0].weather = {
    status: "forecast",
    summary: "Lluvia",
    sourceUrl: "data:text/html,unsafe",
  };
  unsafeSources.sources = [{ label: "Fuente", url: "file:///tmp/source" }];
  const sourceValidation = validateItinerary(unsafeSources);
  assert.equal(sourceValidation.valid, false);
  assert.ok(sourceValidation.errors.filter((message) => message.includes("HTTP(S)")).length >= 2);
});

test("requires actionable details only for reservations that remain pending", () => {
  const pendingWithoutAction = structuredClone(itinerary);
  pendingWithoutAction.days[0].activities[1].reservation = { status: "pending" };
  const invalid = validateItinerary(pendingWithoutAction);
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some((message) => message.includes("pending reservation needs")));

  const displaySafe = validateItinerary(pendingWithoutAction, {
    reservationCompleteness: "warning",
  });
  assert.equal(displaySafe.valid, true);
  assert.ok(
    displaySafe.warnings.some((message) => message.includes("pending reservation needs")),
  );

  for (const actionable of [
    { status: "pending", url: "https://tickets.example/reserve" },
    { status: "pending", note: "Reservar por teléfono con el museo." },
    { status: "pending", deadline: "Antes del 15 de agosto" },
    { status: "not_needed" },
    { status: "confirmed" },
  ]) {
    const candidate = structuredClone(itinerary);
    candidate.days[0].activities[1].reservation = actionable;
    assert.equal(
      validateItinerary(candidate).valid,
      true,
      `expected ${actionable.status} reservation to remain valid`,
    );
  }

  const suggested = structuredClone(itinerary);
  suggested.days[0].activities[1].reservation = { status: "suggested" };
  const suggestedValidation = validateItinerary(suggested);
  assert.equal(suggestedValidation.valid, true);
  assert.ok(
    suggestedValidation.warnings.some((message) =>
      message.includes("suggested reservation should include"),
    ),
  );
});

test("keeps ticket type and necessity separate from lifecycle status", () => {
  const candidate = structuredClone(itinerary);
  candidate.days[0].activities[1].reservation = {
    kind: "ticket",
    requirement: "optional",
    status: "pending",
    url: "https://tickets.example/buy",
  };
  const normalized = normalizeItinerary(candidate);
  assert.deepEqual(normalized.days[0].activities[1].reservation, candidate.days[0].activities[1].reservation);
  assert.equal(validateItinerary(normalized).valid, true);

  const legacy = structuredClone(itinerary);
  legacy.days[0].activities[1].reservation = {
    status: "suggested",
    url: "https://tickets.example/buy",
  };
  const migrated = normalizeItinerary(legacy);
  assert.equal(migrated.days[0].activities[1].reservation.status, "pending");
  assert.equal(migrated.days[0].activities[1].reservation.requirement, "optional");
});

test("advertises the planning tools and renders the MCP Apps resource", async () => {
  const server = createTripPlannerServer({ mapsEmbedApiKey: "server-test-key" });
  const client = new Client({ name: "sendero-test", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const tools = await client.listTools();
  assert.deepEqual(
    tools.tools.map((tool) => tool.name).sort(),
    [
      "change_trip_member_role",
      "find_itineraries",
      "get_itinerary",
      "get_public_share_status",
      "get_trip_access",
      "invite_trip_member",
      "list_itineraries",
      "open_trip",
      "prepare_trip_brief",
      "present_trip",
      "preview_public_share",
      "publish_public_share",
      "remove_trip_member",
      "render_itinerary",
      "render_trip_intake",
      "render_trip_requirements",
      "resend_trip_invitation",
      "restore_itinerary_version",
      "revoke_public_share",
      "revoke_trip_invitation",
      "rotate_public_share",
      "save_and_present_trip",
      "save_itinerary",
      "share_trip_publicly",
      "update_public_share",
      "update_reservation_status",
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
  const reservationTool = tools.tools.find((tool) => tool.name === "update_reservation_status");
  const getItineraryTool = tools.tools.find((tool) => tool.name === "get_itinerary");
  const openTripTool = tools.tools.find((tool) => tool.name === "open_trip");
  const presentTripTool = tools.tools.find((tool) => tool.name === "present_trip");
  const saveAndPresentTool = tools.tools.find((tool) => tool.name === "save_and_present_trip");
  const accessTool = tools.tools.find((tool) => tool.name === "get_trip_access");
  const accessMutationTools = [
    "invite_trip_member",
    "resend_trip_invitation",
    "revoke_trip_invitation",
    "change_trip_member_role",
    "remove_trip_member",
  ].map((name) => tools.tools.find((tool) => tool.name === name));
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
  assert.equal(protectedTool.inputSchema.required.includes("operationId"), true);
  assert.deepEqual(reservationTool._meta.securitySchemes, [
    { type: "oauth2", scopes: [AUTH_SCOPES.write] },
  ]);
  assert.deepEqual(reservationTool._meta.ui.visibility, ["model", "app"]);
  assert.equal(reservationTool._meta["openai/widgetAccessible"], true);
  assert.deepEqual(getItineraryTool._meta.ui.visibility, ["model", "app"]);
  assert.equal(getItineraryTool._meta["openai/widgetAccessible"], true);
  assert.equal(openTripTool._meta.ui.resourceUri, TRIP_LIST_UI_URI);
  assert.deepEqual(openTripTool._meta.ui.visibility, ["model", "app"]);
  assert.equal(openTripTool._meta["openai/outputTemplate"], TRIP_LIST_UI_URI);
  assert.deepEqual(Object.keys(openTripTool.inputSchema.properties).sort(), [
    "endDate",
    "query",
    "reference",
    "selector",
    "startDate",
    "tripId",
  ]);
  assert.deepEqual(Object.keys(findTool.inputSchema.properties).sort(), [
    "endDate",
    "query",
    "reference",
    "selector",
    "startDate",
  ]);
  assert.equal(presentTripTool._meta.ui.resourceUri, ITINERARY_UI_URI);
  assert.equal(presentTripTool._meta["openai/outputTemplate"], ITINERARY_UI_URI);
  assert.equal(presentTripTool.annotations.readOnlyHint, true);
  assert.equal(saveAndPresentTool._meta.ui.resourceUri, ITINERARY_UI_URI);
  assert.equal(saveAndPresentTool._meta["openai/outputTemplate"], ITINERARY_UI_URI);
  assert.equal(saveAndPresentTool.annotations.idempotentHint, true);
  assert.deepEqual(saveAndPresentTool._meta.securitySchemes, [
    { type: "oauth2", scopes: [AUTH_SCOPES.write] },
  ]);
  assert.deepEqual(saveAndPresentTool.inputSchema.required.includes("operationId"), true);
  assert.equal(accessTool.annotations.readOnlyHint, true);
  assert.deepEqual(accessTool._meta.securitySchemes, [
    { type: "oauth2", scopes: [AUTH_SCOPES.share] },
  ]);
  for (const tool of accessMutationTools) {
    assert.equal(tool.annotations.idempotentHint, true);
    assert.equal(tool.inputSchema.required.includes("operationId"), true);
    assert.equal(tool.inputSchema.properties.operationId.maxLength, 128);
    assert.equal(tool.inputSchema.properties.operationId.pattern, "^[A-Za-z0-9._:-]+$");
    assert.deepEqual(tool._meta.securitySchemes, [
      { type: "oauth2", scopes: [AUTH_SCOPES.share] },
    ]);
  }

  const result = await client.callTool({
    name: "render_itinerary",
    arguments: { itinerary },
  });
  assert.equal(result.structuredContent.itinerary.days.length, 1);
  assert.equal(result.structuredContent.validation.valid, true);
  assert.equal(result.content[0].text, "Tu itinerario está listo en Sendero.");
  assert.doesNotMatch(result.content[0].text, /Lisboa|1 day|día/);
  assert.doesNotMatch(JSON.stringify(result), /server-test-key/);

  const savedPresentation = await client.callTool({
    name: "render_itinerary",
    arguments: { itinerary, tripId: "trip_123", version: 2, role: "editor" },
  });
  assert.equal(savedPresentation.structuredContent.tripId, "trip_123");
  assert.equal(savedPresentation.structuredContent.version, 2);
  assert.equal(savedPresentation.structuredContent.role, "editor");

  const pendingWithoutAction = structuredClone(itinerary);
  pendingWithoutAction.days[0].activities[1].reservation = { status: "pending" };
  const displaySafeRender = await client.callTool({
    name: "render_itinerary",
    arguments: { itinerary: pendingWithoutAction },
  });
  assert.equal(displaySafeRender.structuredContent.validation.valid, true);
  assert.ok(
    displaySafeRender.structuredContent.validation.warnings.some((message) =>
      message.includes("pending reservation needs"),
    ),
  );

  const invalid = structuredClone(itinerary);
  invalid.days[0].activities[1].startTime = "12:30";
  const invalidRender = await client.callTool({
    name: "render_itinerary",
    arguments: { itinerary: invalid },
  });
  assert.equal(invalidRender.isError, true);
  assert.match(invalidRender.content[0].text, /cannot be rendered/i);

  const resource = await client.readResource({ uri: ITINERARY_UI_URI });
  assertInlineWidgetResource(resource, ITINERARY_UI_URI);
  assert.match(resource.contents[0].text, /Calendario/);
  assert.match(resource.contents[0].text, /Rutas/);
  assert.match(resource.contents[0].text, /toolOutput/);
  assert.match(resource.contents[0].text, /ui\/notifications\/tool-result/);
  assert.match(resource.contents[0].text, /sendero-google-maps-embed-key/);
  assert.match(resource.contents[0].text, /server-test-key/);
  assert.deepEqual(resource.contents[0]._meta.ui.csp.frameDomains, ["https://www.google.com"]);
  assert.match(resource.contents[0]._meta["openai/widgetDescription"], /itinerary|calendar|route/i);

  const legacyItineraryResource = await client.readResource({ uri: LEGACY_ITINERARY_UI_URI });
  assertInlineWidgetResource(legacyItineraryResource, LEGACY_ITINERARY_UI_URI);
  assert.equal(legacyItineraryResource.contents[0].text, resource.contents[0].text);
  const legacyItineraryV3Resource = await client.readResource({ uri: LEGACY_ITINERARY_V3_UI_URI });
  assertInlineWidgetResource(legacyItineraryV3Resource, LEGACY_ITINERARY_V3_UI_URI);
  assert.equal(legacyItineraryV3Resource.contents[0].text, resource.contents[0].text);
  const legacyItineraryV4Resource = await client.readResource({ uri: LEGACY_ITINERARY_V4_UI_URI });
  assertInlineWidgetResource(legacyItineraryV4Resource, LEGACY_ITINERARY_V4_UI_URI);
  assert.equal(legacyItineraryV4Resource.contents[0].text, resource.contents[0].text);
  const legacyItineraryV5Resource = await client.readResource({ uri: LEGACY_ITINERARY_V5_UI_URI });
  assertInlineWidgetResource(legacyItineraryV5Resource, LEGACY_ITINERARY_V5_UI_URI);
  assert.equal(legacyItineraryV5Resource.contents[0].text, resource.contents[0].text);
  const legacyItineraryV6Resource = await client.readResource({ uri: LEGACY_ITINERARY_V6_UI_URI });
  assertInlineWidgetResource(legacyItineraryV6Resource, LEGACY_ITINERARY_V6_UI_URI);
  assert.equal(legacyItineraryV6Resource.contents[0].text, resource.contents[0].text);
  const legacyItineraryV7Resource = await client.readResource({ uri: LEGACY_ITINERARY_V7_UI_URI });
  assertInlineWidgetResource(legacyItineraryV7Resource, LEGACY_ITINERARY_V7_UI_URI);
  assert.equal(legacyItineraryV7Resource.contents[0].text, resource.contents[0].text);
  const legacyItineraryV8Resource = await client.readResource({ uri: LEGACY_ITINERARY_V8_UI_URI });
  assertInlineWidgetResource(legacyItineraryV8Resource, LEGACY_ITINERARY_V8_UI_URI);
  assert.equal(legacyItineraryV8Resource.contents[0].text, resource.contents[0].text);
  const legacyItineraryV9Resource = await client.readResource({ uri: LEGACY_ITINERARY_V9_UI_URI });
  assertInlineWidgetResource(legacyItineraryV9Resource, LEGACY_ITINERARY_V9_UI_URI);
  assert.equal(legacyItineraryV9Resource.contents[0].text, resource.contents[0].text);

  const intake = await client.callTool({ name: "render_trip_intake", arguments: {} });
  assert.equal(intake.structuredContent.mode, "new");
  assert.deepEqual(intake.structuredContent.actions, []);
  assert.equal(intake.content[0].text, "Sendero está listo para continuar.");
  const menu = await client.callTool({ name: "render_trip_intake", arguments: { mode: "menu" } });
  assert.equal(menu.structuredContent.mode, "menu");
  assert.deepEqual(menu.structuredContent.actions, ["new", "open", "adjust", "refresh"]);
  const intakeResource = await client.readResource({ uri: TRIP_INTAKE_UI_URI });
  assertInlineWidgetResource(intakeResource, TRIP_INTAKE_UI_URI);
  assert.match(intakeResource.contents[0].text, /Nuevo viaje/);
  assert.match(intakeResource.contents[0].text, /area_only/);
  assert.match(intakeResource.contents[0].text, /undecided/);
  assert.match(intakeResource.contents[0]._meta["openai/widgetDescription"], /intake|action menu/i);

  const legacyIntakeResource = await client.readResource({ uri: LEGACY_TRIP_INTAKE_UI_URI });
  assertInlineWidgetResource(legacyIntakeResource, LEGACY_TRIP_INTAKE_UI_URI);
  assert.equal(legacyIntakeResource.contents[0].text, intakeResource.contents[0].text);
  const legacyIntakeV3Resource = await client.readResource({ uri: LEGACY_TRIP_INTAKE_V3_UI_URI });
  assertInlineWidgetResource(legacyIntakeV3Resource, LEGACY_TRIP_INTAKE_V3_UI_URI);
  assert.equal(legacyIntakeV3Resource.contents[0].text, intakeResource.contents[0].text);
  const legacyIntakeV4Resource = await client.readResource({ uri: LEGACY_TRIP_INTAKE_V4_UI_URI });
  assertInlineWidgetResource(legacyIntakeV4Resource, LEGACY_TRIP_INTAKE_V4_UI_URI);
  assert.equal(legacyIntakeV4Resource.contents[0].text, intakeResource.contents[0].text);

  const tripListResource = await client.readResource({ uri: TRIP_LIST_UI_URI });
  assertInlineWidgetResource(tripListResource, TRIP_LIST_UI_URI);
  assert.match(tripListResource.contents[0].text, /Viaje elegido/);
  assert.match(tripListResource.contents[0].text, /selectedTrip/);
  assert.match(tripListResource.contents[0]._meta["openai/widgetDescription"], /saved-trip picker/i);

  const legacyTripListResource = await client.readResource({ uri: LEGACY_TRIP_LIST_UI_URI });
  assertInlineWidgetResource(legacyTripListResource, LEGACY_TRIP_LIST_UI_URI);
  assert.equal(legacyTripListResource.contents[0].text, tripListResource.contents[0].text);
  const legacyTripListV2Resource = await client.readResource({ uri: LEGACY_TRIP_LIST_V2_UI_URI });
  assertInlineWidgetResource(legacyTripListV2Resource, LEGACY_TRIP_LIST_V2_UI_URI);
  assert.equal(legacyTripListV2Resource.contents[0].text, tripListResource.contents[0].text);
  const legacyTripListV3Resource = await client.readResource({ uri: LEGACY_TRIP_LIST_V3_UI_URI });
  assertInlineWidgetResource(legacyTripListV3Resource, LEGACY_TRIP_LIST_V3_UI_URI);
  assert.equal(legacyTripListV3Resource.contents[0].text, tripListResource.contents[0].text);

  const requirementsResource = await client.readResource({ uri: TRIP_REQUIREMENTS_UI_URI });
  assertInlineWidgetResource(requirementsResource, TRIP_REQUIREMENTS_UI_URI);
  assert.match(requirementsResource.contents[0].text, /ui\/update-model-context/);
  assert.match(requirementsResource.contents[0].text, /prepare_trip_brief/);
  assert.match(requirementsResource.contents[0].text, /brief_ready/);
  assert.match(requirementsResource.contents[0]._meta["openai/widgetDescription"], /missing essential trip detail/i);

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
  const legacyRequirementsV4Resource = await client.readResource({ uri: LEGACY_TRIP_REQUIREMENTS_V4_UI_URI });
  assertInlineWidgetResource(legacyRequirementsV4Resource, LEGACY_TRIP_REQUIREMENTS_V4_UI_URI);
  assert.equal(legacyRequirementsV4Resource.contents[0].text, requirementsResource.contents[0].text);
  const legacyRequirementsV5Resource = await client.readResource({ uri: LEGACY_TRIP_REQUIREMENTS_V5_UI_URI });
  assertInlineWidgetResource(legacyRequirementsV5Resource, LEGACY_TRIP_REQUIREMENTS_V5_UI_URI);
  assert.equal(legacyRequirementsV5Resource.contents[0].text, requirementsResource.contents[0].text);

  const publicShareResource = await client.readResource({ uri: PUBLIC_SHARE_UI_URI });
  assertInlineWidgetResource(publicShareResource, PUBLIC_SHARE_UI_URI);
  assert.match(publicShareResource.contents[0].text, /share-exact-preview/);
  assert.match(publicShareResource.contents[0].text, /proposedExpiresAt/);
  assert.match(publicShareResource.contents[0].text, /Copiar enlace/);
  assert.match(publicShareResource.contents[0].text, /Abrir/);
  assert.doesNotMatch(publicShareResource.contents[0].text, /publish_public_share/);
  assert.doesNotMatch(publicShareResource.contents[0].text, /Reemplazar enlace/);
  assert.match(publicShareResource.contents[0]._meta["openai/widgetDescription"], /public read-only trip link/i);

  const legacyPublicShareResource = await client.readResource({ uri: LEGACY_PUBLIC_SHARE_UI_URI });
  assertInlineWidgetResource(legacyPublicShareResource, LEGACY_PUBLIC_SHARE_UI_URI);
  assert.equal(legacyPublicShareResource.contents[0].text, publicShareResource.contents[0].text);
  const legacyPublicShareV2Resource = await client.readResource({ uri: LEGACY_PUBLIC_SHARE_V2_UI_URI });
  assertInlineWidgetResource(legacyPublicShareV2Resource, LEGACY_PUBLIC_SHARE_V2_UI_URI);
  assert.equal(legacyPublicShareV2Resource.contents[0].text, publicShareResource.contents[0].text);
  const legacyPublicShareV3Resource = await client.readResource({ uri: LEGACY_PUBLIC_SHARE_V3_UI_URI });
  assertInlineWidgetResource(legacyPublicShareV3Resource, LEGACY_PUBLIC_SHARE_V3_UI_URI);
  assert.equal(legacyPublicShareV3Resource.contents[0].text, publicShareResource.contents[0].text);

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
  assert.equal(requirements.content[0].text, "Completa los datos esenciales directamente en Sendero.");
  assert.doesNotMatch(requirements.content[0].text, /fecha|adultos|moverse|Buenos Aires/);
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

test("requires write access before changing Sendero reservation tracking", async () => {
  let storageCalled = false;
  const server = createTripPlannerServer({
    persistence: {
      async updateReservation() {
        storageCalled = true;
        throw new Error("must not be reached");
      },
    },
    auth: {
      authenticated: false,
      scopes: [],
      resourceMetadataUrl:
        "https://sendero.example/.well-known/oauth-protected-resource",
    },
  });
  const client = new Client({ name: "sendero-reservation-auth-test", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const result = await client.callTool({
    name: "update_reservation_status",
    arguments: {
      tripId: "trip_123",
      dayDate: "2026-08-22",
      activityId: "evening-show",
      status: "confirmed",
      expectedVersion: 2,
      operationId: "reservation-operation-auth",
    },
  });
  assert.equal(result.isError, true);
  assert.equal(storageCalled, false);
  assert.match(result._meta["mcp/www_authenticate"][0], /scope="trips:write"/);

  await client.close();
  await server.close();
});

test("requires private-sharing access before reading or changing trip members", async () => {
  let storageCalled = false;
  const persistence = {
    async listAccess() {
      storageCalled = true;
      throw new Error("must not be reached");
    },
    async get() {
      storageCalled = true;
      throw new Error("must not be reached");
    },
  };
  const server = createTripPlannerServer({
    persistence,
    auth: {
      authenticated: true,
      scopes: [AUTH_SCOPES.read, AUTH_SCOPES.write],
      resourceMetadataUrl:
        "https://sendero.example/.well-known/oauth-protected-resource",
    },
  });
  const client = new Client({ name: "sendero-access-auth-test", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const read = await client.callTool({
    name: "get_trip_access",
    arguments: { tripId: "trip_123" },
  });
  assert.equal(read.isError, true);
  assert.match(read._meta["mcp/www_authenticate"][0], /error="insufficient_scope"/);
  assert.match(read._meta["mcp/www_authenticate"][0], /scope="trips:share"/);

  const mutations = [
    {
      name: "invite_trip_member",
      arguments: {
        tripId: "trip_123",
        email: "friend@example.com",
        role: "viewer",
        operationId: "invite-auth-operation-123",
      },
    },
    {
      name: "resend_trip_invitation",
      arguments: {
        tripId: "trip_123",
        invitationId: "invitation_123",
        operationId: "resend-auth-operation-123",
      },
    },
    {
      name: "revoke_trip_invitation",
      arguments: {
        tripId: "trip_123",
        invitationId: "invitation_123",
        operationId: "revoke-auth-operation-123",
      },
    },
    {
      name: "change_trip_member_role",
      arguments: {
        tripId: "trip_123",
        memberId: "member_123",
        role: "collaborator",
        operationId: "role-auth-operation-123",
      },
    },
    {
      name: "remove_trip_member",
      arguments: {
        tripId: "trip_123",
        memberId: "member_123",
        operationId: "remove-auth-operation-123",
      },
    },
  ];
  for (const request of mutations) {
    const mutation = await client.callTool(request);
    assert.equal(mutation.isError, true);
    assert.match(mutation._meta["mcp/www_authenticate"][0], /scope="trips:share"/);
  }
  assert.equal(storageCalled, false);

  await client.close();
  await server.close();
});

test("finds the latest updated trip deterministically without breaking text searches", async () => {
  let trips = [
    {
      id: "trip_middle",
      title: "Oporto junto al río",
      destination: "Oporto, Portugal",
      startDate: "2026-10-02",
      endDate: "2026-10-05",
      currentVersion: 2,
      role: "owner",
      updatedAt: 1788200000000,
    },
    {
      id: "trip_oldest",
      title: "Lisboa nocturna",
      destination: "Lisboa, Portugal",
      startDate: "2026-09-10",
      endDate: "2026-09-14",
      currentVersion: 1,
      role: "owner",
      updatedAt: 1788100000000,
    },
    {
      id: "trip_latest",
      title: "Lisboa entre clásicos y barrios",
      destination: "Lisboa, Portugal",
      startDate: itinerary.startDate,
      endDate: itinerary.endDate,
      currentVersion: 3,
      role: "editor",
      updatedAt: 1788300000000,
    },
  ];
  const server = createTripPlannerServer({
    persistence: {
      async list() {
        return trips;
      },
    },
    auth: {
      authenticated: true,
      scopes: [AUTH_SCOPES.read],
      resourceMetadataUrl:
        "https://sendero.example/.well-known/oauth-protected-resource",
    },
  });
  const client = new Client({ name: "sendero-latest-trip-test", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const latest = await client.callTool({
    name: "find_itineraries",
    arguments: { selector: "latest_updated" },
  });
  assert.deepEqual(
    latest.structuredContent.trips.map((trip) => trip.id),
    ["trip_latest"],
  );

  const named = await client.callTool({
    name: "find_itineraries",
    arguments: {
      query: "LISBOA CLASICOS",
      startDate: itinerary.startDate,
      endDate: itinerary.endDate,
    },
  });
  assert.deepEqual(
    named.structuredContent.trips.map((trip) => trip.id),
    ["trip_latest"],
  );

  const missingReference = await client.callTool({
    name: "find_itineraries",
    arguments: {},
  });
  assert.deepEqual(
    missingReference.structuredContent.trips.map((trip) => trip.id),
    ["trip_latest"],
  );

  const whitespaceReference = await client.callTool({
    name: "find_itineraries",
    arguments: { selector: "  ", query: "   ", reference: "  " },
  });
  assert.deepEqual(
    whitespaceReference.structuredContent.trips.map((trip) => trip.id),
    ["trip_latest"],
  );

  const blankQueryWithNamedReference = await client.callTool({
    name: "find_itineraries",
    arguments: {
      query: "   ",
      reference: "LISBOA CLASICOS",
      startDate: itinerary.startDate,
      endDate: itinerary.endDate,
    },
  });
  assert.deepEqual(
    blankQueryWithNamedReference.structuredContent.trips.map((trip) => trip.id),
    ["trip_latest"],
  );

  const redundantRecencyReference = await client.callTool({
    name: "find_itineraries",
    arguments: { query: "Oporto", selector: "latest_updated" },
  });
  assert.deepEqual(
    redundantRecencyReference.structuredContent.trips.map((trip) => trip.id),
    ["trip_middle"],
  );

  const naturalRecencyReference = await client.callTool({
    name: "find_itineraries",
    arguments: { query: "Abre mi último viaje guardado" },
  });
  assert.deepEqual(
    naturalRecencyReference.structuredContent.trips.map((trip) => trip.id),
    ["trip_latest"],
  );

  const englishRecencyReference = await client.callTool({
    name: "find_itineraries",
    arguments: { reference: "my last saved trip" },
  });
  assert.deepEqual(
    englishRecencyReference.structuredContent.trips.map((trip) => trip.id),
    ["trip_latest"],
  );

  for (const reference of [
    "el más reciente",
    "el último",
    "the latest",
    "most recently saved trip",
  ]) {
    const articlePrefixedRecency = await client.callTool({
      name: "find_itineraries",
      arguments: { reference },
    });
    assert.deepEqual(
      articlePrefixedRecency.structuredContent.trips.map((trip) => trip.id),
      ["trip_latest"],
    );
  }

  trips = [];
  const empty = await client.callTool({
    name: "find_itineraries",
    arguments: { selector: "latest_updated" },
  });
  assert.deepEqual(empty.structuredContent.trips, []);

  await client.close();
  await server.close();
});

test("opens one saved trip atomically through persistence.open", async () => {
  const openCalls = [];
  const authoritative = structuredClone(itinerary);
  authoritative.title = "Lisboa al ritmo de sus barrios";
  const server = createTripPlannerServer({
    persistence: {
      async open(reference) {
        openCalls.push(structuredClone(reference));
        return {
          state: "opened",
          id: "trip_latest",
          version: 4,
          role: "editor",
          itinerary: authoritative,
          revisions: [{ version: 3, reason: "Adjusted pace", createdAt: 1788300000000 }],
          trips: [],
        };
      },
      async list() {
        assert.fail("open_trip must not fall back to persistence.list");
      },
      async get() {
        assert.fail("open_trip must not follow persistence.open with persistence.get");
      },
    },
    auth: {
      authenticated: true,
      scopes: [AUTH_SCOPES.read],
      resourceMetadataUrl:
        "https://sendero.example/.well-known/oauth-protected-resource",
    },
  });
  const client = new Client({ name: "sendero-atomic-open-test", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const opened = await client.callTool({
    name: "open_trip",
    arguments: { selector: "latest_updated" },
  });

  assert.deepEqual(openCalls, [{ selector: "latest_updated" }]);
  assert.equal(opened.structuredContent.state, "opened");
  assert.equal(opened.structuredContent.tripId, "trip_latest");
  assert.equal(opened.structuredContent.version, 4);
  assert.equal(opened.structuredContent.role, "editor");
  assert.equal(opened.structuredContent.itinerary.title, authoritative.title);
  assert.equal(opened.structuredContent.validation.valid, true);
  assert.deepEqual(opened.structuredContent.trips, []);
  assert.equal(opened.structuredContent.purpose, "open");
  assert.deepEqual(opened.structuredContent.revisions, [
    { version: 3, reason: "Adjusted pace", createdAt: 1788300000000 },
  ]);

  await client.callTool({
    name: "open_trip",
    arguments: {
      query:
        "Abre mi último viaje guardado y muéstralo. No lo regeneres ni lo modifiques.",
    },
  });
  await client.callTool({
    name: "open_trip",
    arguments: { reference: "the most recent trip" },
  });
  await client.callTool({
    name: "open_trip",
    arguments: { selector: "latest_updated", query: "último viaje" },
  });
  await client.callTool({
    name: "open_trip",
    arguments: { tripId: "trip_exact", query: "último viaje" },
  });
  await client.callTool({
    name: "open_trip",
    arguments: { tripId: "   ", query: "último viaje" },
  });
  await client.callTool({
    name: "open_trip",
    arguments: { tripId: "último viaje" },
  });
  await client.callTool({
    name: "open_trip",
    arguments: { tripId: "last saved trip" },
  });
  await client.callTool({
    name: "open_trip",
    arguments: { query: "¿Puedes abrir mi último viaje?" },
  });
  await client.callTool({
    name: "open_trip",
    arguments: { query: "Show me my last saved trip" },
  });
  await client.callTool({ name: "open_trip", arguments: {} });
  await client.callTool({
    name: "open_trip",
    arguments: { selector: "latest_updated", query: "Lisboa" },
  });
  await client.callTool({
    name: "open_trip",
    arguments: { query: "No abras mi último viaje; abre Lisboa" },
  });
  await client.callTool({
    name: "open_trip",
    arguments: { query: "Mi último viaje a Japón" },
  });
  for (const query of [
    "don't open my last trip; open Lisbon",
    "No quiero abrir mi último viaje; abre Lisboa",
    "my most recently saved trip to Tokyo",
    "mi último viaje guardado a Japón",
    "Abre Lisboa, no mi último viaje",
    "No mi último viaje; abre Lisboa",
    "Open Lisbon, not my last trip",
    "Not my last trip; open Lisbon",
    "Open my last trip called Tokyo Nights",
    "Open Lisbon instead of my last trip",
    "Abre Lisboa en vez de mi último viaje",
    "My last trip was Lisbon; open Tokyo",
    "Mi último viaje fue Lisboa; abre Tokio",
  ]) {
    await client.callTool({
      name: "open_trip",
      arguments: { query },
    });
  }
  assert.deepEqual(openCalls, [
    { selector: "latest_updated" },
    { selector: "latest_updated" },
    { selector: "latest_updated" },
    { selector: "latest_updated" },
    { tripId: "trip_exact" },
    { selector: "latest_updated" },
    { selector: "latest_updated" },
    { selector: "latest_updated" },
    { selector: "latest_updated" },
    { selector: "latest_updated" },
    { selector: "latest_updated" },
    { query: "Lisboa" },
    { query: "No abras mi último viaje; abre Lisboa" },
    { query: "Mi último viaje a Japón" },
    { query: "don't open my last trip; open Lisbon" },
    { query: "No quiero abrir mi último viaje; abre Lisboa" },
    { query: "my most recently saved trip to Tokyo" },
    { query: "mi último viaje guardado a Japón" },
    { query: "Abre Lisboa, no mi último viaje" },
    { query: "No mi último viaje; abre Lisboa" },
    { query: "Open Lisbon, not my last trip" },
    { query: "Not my last trip; open Lisbon" },
    { query: "Open my last trip called Tokyo Nights" },
    { query: "Open Lisbon instead of my last trip" },
    { query: "Abre Lisboa en vez de mi último viaje" },
    { query: "My last trip was Lisbon; open Tokyo" },
    { query: "Mi último viaje fue Lisboa; abre Tokio" },
  ]);

  await client.close();
  await server.close();
});

test("returns ambiguity and absence from one atomic open lookup each", async () => {
  const openCalls = [];
  const matchingTrips = [
    {
      id: "trip_123",
      title: itinerary.title,
      destination: itinerary.destination,
      startDate: itinerary.startDate,
      endDate: itinerary.endDate,
      currentVersion: 2,
      role: "owner",
      updatedAt: 1788300000000,
    },
    {
      id: "trip_456",
      title: "Lisboa nocturna",
      destination: itinerary.destination,
      startDate: "2026-09-10",
      endDate: "2026-09-14",
      currentVersion: 1,
      role: "owner",
      updatedAt: 1788200000000,
    },
  ];
  const server = createTripPlannerServer({
    persistence: {
      async open(reference) {
        openCalls.push(structuredClone(reference));
        if (reference.tripId === "malformed") {
          throw new Error(
            'ArgumentValidationError: Value does not match validator. Path: .reference.tripId Validator: v.id("trips")',
          );
        }
        return "query" in reference
          ? { state: "needs_selection", trips: matchingTrips }
          : { state: "not_found", trips: [] };
      },
      async list() {
        assert.fail("open_trip must not fall back to persistence.list");
      },
      async get() {
        assert.fail("open_trip must not fall back to persistence.get");
      },
    },
    auth: {
      authenticated: true,
      scopes: [AUTH_SCOPES.read],
      resourceMetadataUrl:
        "https://sendero.example/.well-known/oauth-protected-resource",
    },
  });
  const client = new Client({ name: "sendero-open-resolution-test", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const ambiguous = await client.callTool({
    name: "open_trip",
    arguments: {
      query: "Lisboa",
      startDate: itinerary.startDate,
      endDate: itinerary.endDate,
    },
  });
  assert.deepEqual(openCalls, [
    { query: "Lisboa", startDate: itinerary.startDate, endDate: itinerary.endDate },
  ]);
  assert.equal(ambiguous.structuredContent.state, "needs_selection");
  assert.deepEqual(ambiguous.structuredContent.trips, matchingTrips);
  assert.equal(ambiguous.structuredContent.purpose, "open");

  const missing = await client.callTool({
    name: "open_trip",
    arguments: { tripId: "trip_missing" },
  });
  assert.deepEqual(openCalls, [
    { query: "Lisboa", startDate: itinerary.startDate, endDate: itinerary.endDate },
    { tripId: "trip_missing" },
  ]);
  assert.equal(missing.structuredContent.state, "not_found");
  assert.deepEqual(missing.structuredContent.trips, []);
  assert.equal(missing.structuredContent.purpose, "open");

  const malformed = await client.callTool({
    name: "open_trip",
    arguments: { tripId: "malformed" },
  });
  assert.equal(malformed.structuredContent.state, "not_found");
  assert.deepEqual(malformed.structuredContent.trips, []);

  await client.close();
  await server.close();
});

test("strictly presents a complete itinerary without touching persistence", async () => {
  let persistenceCalled = false;
  const server = createTripPlannerServer({
    persistence: new Proxy(
      {},
      {
        get() {
          persistenceCalled = true;
          throw new Error("present_trip must not access persistence");
        },
      },
    ),
  });
  const client = new Client({ name: "sendero-present-trip-test", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const presented = await client.callTool({
    name: "present_trip",
    arguments: { itinerary },
  });
  assert.equal(presented.structuredContent.state, "presented");
  assert.equal(presented.structuredContent.validation.valid, true);
  assert.equal(presented.structuredContent.itinerary.title, itinerary.title);
  assert.equal(persistenceCalled, false);

  const overlapping = structuredClone(itinerary);
  overlapping.days[0].activities[1].startTime = "12:30";
  const rejected = await client.callTool({
    name: "present_trip",
    arguments: { itinerary: overlapping },
  });
  assert.equal(rejected.isError, true);
  assert.match(rejected.content[0].text, /cannot be presented/i);
  assert.equal(persistenceCalled, false);

  await client.close();
  await server.close();
});

test("saves and presents the authoritative snapshot with idempotent retry context", async () => {
  const saveCalls = [];
  const authoritative = structuredClone(itinerary);
  authoritative.title = "Lisboa al ritmo de sus barrios";
  const server = createTripPlannerServer({
    persistence: {
      async save(input) {
        saveCalls.push(structuredClone(input));
        return {
          tripId: input.tripId,
          version: 3,
          savedVersion: 3,
          role: "editor",
          itinerary: authoritative,
          replayed: saveCalls.length > 1,
        };
      },
      async get() {
        assert.fail("save_and_present_trip must not reload the saved snapshot");
      },
    },
    auth: {
      authenticated: true,
      scopes: [AUTH_SCOPES.write],
      resourceMetadataUrl:
        "https://sendero.example/.well-known/oauth-protected-resource",
    },
  });
  const client = new Client({ name: "sendero-save-present-test", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const argumentsForSave = {
    tripId: "trip_123",
    itinerary,
    reason: "Refined neighborhood plan",
    expectedVersion: 2,
    operationId: "save-present-operation-123",
  };
  const first = await client.callTool({
    name: "save_and_present_trip",
    arguments: argumentsForSave,
  });
  const replay = await client.callTool({
    name: "save_and_present_trip",
    arguments: argumentsForSave,
  });

  assert.equal(saveCalls.length, 2);
  assert.equal(saveCalls[0].tripId, "trip_123");
  assert.equal(saveCalls[0].expectedVersion, 2);
  assert.equal(saveCalls[0].operationId, "save-present-operation-123");
  assert.equal(saveCalls[1].operationId, saveCalls[0].operationId);
  assert.deepEqual(saveCalls[1], saveCalls[0]);
  assert.equal(first.structuredContent.state, "saved");
  assert.equal(first.structuredContent.tripId, "trip_123");
  assert.equal(first.structuredContent.version, 3);
  assert.equal(first.structuredContent.savedVersion, 3);
  assert.equal(first.structuredContent.itinerary.title, authoritative.title);
  assert.notEqual(first.structuredContent.itinerary.title, itinerary.title);
  assert.equal(first.structuredContent.validation.valid, true);
  assert.equal(first.structuredContent.replayed, false);
  assert.equal(replay.structuredContent.replayed, true);
  assert.equal(replay.structuredContent.itinerary.title, authoritative.title);

  const missingExpectedVersion = await client.callTool({
    name: "save_and_present_trip",
    arguments: {
      tripId: "trip_123",
      itinerary,
      operationId: "save-present-operation-456",
    },
  });
  assert.equal(missingExpectedVersion.isError, true);
  assert.match(missingExpectedVersion.content[0].text, /expectedVersion is required/i);
  assert.equal(saveCalls.length, 2);

  await client.close();
  await server.close();
});

test("restores and presents one authoritative snapshot with concurrency and retry context", async () => {
  const restoreCalls = [];
  const authoritative = structuredClone(itinerary);
  authoritative.title = "Lisboa restaurada, sin prisas";
  const server = createTripPlannerServer({
    persistence: {
      async getRevision(input) {
        assert.deepEqual(input, { tripId: "trip_123", version: 2 });
        return {
          tripId: input.tripId,
          version: input.version,
          role: "owner",
          itinerary: authoritative,
        };
      },
      async restore(input) {
        restoreCalls.push(structuredClone(input));
        return {
          tripId: input.tripId,
          version: 5,
          restoredVersion: 5,
          restoredFrom: input.version,
          role: "owner",
          itinerary: authoritative,
          replayed: false,
        };
      },
      async get() {
        assert.fail("restore_itinerary_version must not reload the restored snapshot");
      },
    },
    auth: {
      authenticated: true,
      scopes: [AUTH_SCOPES.write],
      resourceMetadataUrl:
        "https://sendero.example/.well-known/oauth-protected-resource",
    },
  });
  const client = new Client({ name: "sendero-restore-present-test", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const restored = await client.callTool({
    name: "restore_itinerary_version",
    arguments: {
      tripId: "trip_123",
      version: 2,
      expectedVersion: 4,
      operationId: "restore-operation-123",
    },
  });

  assert.deepEqual(restoreCalls, [
    {
      tripId: "trip_123",
      version: 2,
      expectedVersion: 4,
      operationId: "restore-operation-123",
    },
  ]);
  assert.equal(restored.structuredContent.state, "restored");
  assert.equal(restored.structuredContent.tripId, "trip_123");
  assert.equal(restored.structuredContent.version, 5);
  assert.equal(restored.structuredContent.restoredVersion, 5);
  assert.equal(restored.structuredContent.restoredFrom, 2);
  assert.equal(restored.structuredContent.itinerary.title, authoritative.title);
  assert.equal(restored.structuredContent.validation.valid, true);
  assert.equal(restored.structuredContent.replayed, false);

  await client.close();
  await server.close();
});

test("rejects an invalid historical snapshot before restore can mutate the trip", async () => {
  let restoreCalled = false;
  const invalidRevision = structuredClone(itinerary);
  invalidRevision.days[0].activities[0].endTime = "08:00";
  const server = createTripPlannerServer({
    persistence: {
      async getRevision() {
        return {
          tripId: "trip_123",
          version: 1,
          role: "owner",
          itinerary: invalidRevision,
        };
      },
      async restore() {
        restoreCalled = true;
        assert.fail("an invalid revision must not reach the restore mutation");
      },
    },
    auth: {
      authenticated: true,
      scopes: [AUTH_SCOPES.write],
      resourceMetadataUrl:
        "https://sendero.example/.well-known/oauth-protected-resource",
    },
  });
  const client = new Client({ name: "sendero-invalid-restore-test", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const result = await client.callTool({
    name: "restore_itinerary_version",
    arguments: {
      tripId: "trip_123",
      version: 1,
      expectedVersion: 3,
      operationId: "restore-invalid-version-123",
    },
  });

  assert.equal(result.isError, true);
  assert.equal(restoreCalled, false);

  await client.close();
  await server.close();
});

test("saves, lists, opens, invites, and restores trips through the persistence boundary", async () => {
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
        {
          id: "trip_456",
          title: "Lisboa nocturna",
          destination: itinerary.destination,
          startDate: "2026-09-10",
          endDate: "2026-09-14",
          currentVersion: 1,
          role: "owner",
          updatedAt: 1786800000000,
        },
      ];
    },
    async get(tripId) {
      calls.push(["get", tripId]);
      return {
        id: tripId,
        webId: "trip_web_1234567890123456",
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
    async updateReservation(input) {
      calls.push(["updateReservation", input]);
      const updated = structuredClone(itinerary);
      updated.days[0].activities[1].reservation.status = input.status;
      return {
        tripId: input.tripId,
        version: 3,
        role: "owner",
        changed: true,
        itinerary: updated,
      };
    },
    async listAccess(tripId) {
      calls.push(["listAccess", tripId]);
      return {
        owner: { name: "Manuel", email: "owner@example.com", role: "owner" },
        collaborators: [],
        invitations: [],
      };
    },
    async invite(input) {
      calls.push(["invite", input]);
      return {
        invitationId: "invitation_123",
        role: input.role,
        status: "pending",
        delivery: { outboxId: "outbox_123", status: "queued" },
        changed: true,
        replayed: false,
      };
    },
    async getRevision(input) {
      calls.push(["getRevision", input]);
      return {
        tripId: input.tripId,
        version: input.version,
        role: "owner",
        itinerary,
      };
    },
    async restore(input) {
      calls.push(["restore", input]);
      return {
        tripId: input.tripId,
        version: 3,
        restoredVersion: 3,
        restoredFrom: input.version,
        role: "owner",
        itinerary,
        replayed: false,
      };
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
    publicWebUrl: "https://sendero.example",
    invitationPepper: "sendero-test-invitation-pepper-at-least-thirty-two-bytes",
    invitationSender: async () => ({ status: "sent" }),
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

  const foundByExactDates = await client.callTool({
    name: "find_itineraries",
    arguments: {
      query: "Lisboa",
      startDate: itinerary.startDate,
      endDate: itinerary.endDate,
    },
  });
  assert.equal(foundByExactDates.structuredContent.trips.length, 1);
  assert.equal(foundByExactDates.structuredContent.trips[0].id, "trip_123");

  const listed = await client.callTool({ name: "list_itineraries", arguments: { purpose: "adjust" } });
  assert.equal(listed.structuredContent.trips[0].id, "trip_123");
  assert.equal(listed.structuredContent.purpose, "adjust");
  assert.equal(listed.content[0].text, "Elige un viaje en Sendero.");
  assert.doesNotMatch(listed.content[0].text, /Lisboa entre clásicos y barrios|Lisboa, Portugal/);
  assert.doesNotMatch(listed.content[0].text, /trip_123|tripId|list_|get_|render_|\{\s*"/);

  const opened = await client.callTool({
    name: "get_itinerary",
    arguments: { tripId: "trip_123" },
  });
  assert.equal(opened.structuredContent.itinerary.title, itinerary.title);

  const pendingWithoutAction = structuredClone(itinerary);
  pendingWithoutAction.days[0].activities[1].reservation = { status: "pending" };
  const rejectedSave = await client.callTool({
    name: "save_itinerary",
    arguments: {
      itinerary: pendingWithoutAction,
      reason: "Incomplete reservation research",
      operationId: "legacy-save-invalid-123",
    },
  });
  assert.equal(rejectedSave.isError, true);
  assert.match(rejectedSave.content[0].text, /cannot be saved/i);
  assert.equal(calls.some(([name]) => name === "save"), false);

  const saved = await client.callTool({
    name: "save_itinerary",
    arguments: {
      itinerary,
      reason: "Initial plan",
      operationId: "legacy-save-create-123",
    },
  });
  assert.equal(saved.structuredContent.version, 1);

  const unsafeLegacyUpdate = await client.callTool({
    name: "save_itinerary",
    arguments: {
      tripId: "trip_123",
      itinerary,
      reason: "Unsafe stale update",
      operationId: "legacy-save-update-unsafe-123",
    },
  });
  assert.equal(unsafeLegacyUpdate.isError, true);
  assert.match(unsafeLegacyUpdate.content[0].text, /expectedVersion is required/i);
  assert.equal(calls.filter(([name]) => name === "save").length, 1);

  const reservationUpdated = await client.callTool({
    name: "update_reservation_status",
    arguments: {
      tripId: "trip_123",
      dayDate: "2026-08-22",
      activityId: "evening-show",
      status: "confirmed",
      expectedVersion: 2,
      operationId: "reservation-operation-123",
    },
  });
  assert.equal(reservationUpdated.structuredContent.changed, true);
  assert.equal(reservationUpdated.structuredContent.version, 3);
  assert.equal(
    reservationUpdated.structuredContent.itinerary.days[0].activities[1].reservation.status,
    "confirmed",
  );
  assert.match(reservationUpdated.content[0].text, /estado local/i);
  assert.match(reservationUpdated.content[0].text, /proveedor/i);

  const invited = await client.callTool({
    name: "invite_trip_member",
    arguments: {
      tripId: "trip_123",
      email: "friend@example.com",
      role: "collaborator",
      operationId: "invite-operation-123",
    },
  });
  assert.equal(invited.structuredContent.status, "pending");
  assert.equal(invited.structuredContent.role, "collaborator");
  assert.equal(invited.structuredContent.delivery, "queued");
  assert.doesNotMatch(invited.content[0].text, /invitation_123|invite_trip_member|trip_123/);

  const restored = await client.callTool({
    name: "restore_itinerary_version",
    arguments: {
      tripId: "trip_123",
      version: 1,
      expectedVersion: 2,
      operationId: "restore-operation-boundary-123",
    },
  });
  assert.equal(restored.structuredContent.version, 3);
  assert.equal(restored.structuredContent.restoredVersion, 3);
  assert.equal(restored.structuredContent.itinerary.title, itinerary.title);
  assert.equal(restored.structuredContent.validation.valid, true);
  assert.deepEqual(
    calls.map(([name]) => name),
    [
      "list",
      "list",
      "list",
      "get",
      "save",
      "updateReservation",
      "invite",
      "getRevision",
      "restore",
    ],
  );

  await client.close();
  await server.close();
});

test("manages each private-access intent atomically without leaking access identifiers in prose", async () => {
  const calls = [];
  const sent = [];
  const inviteOperations = new Map();
  const persistence = {
    async get(tripId) {
      calls.push(["get", tripId]);
      return {
        id: tripId,
        webId: "trip_web_1234567890123456",
        role: "owner",
        version: 2,
        itinerary,
        revisions: [],
      };
    },
    async listAccess(tripId) {
      calls.push(["listAccess", tripId]);
      return {
        owner: { name: "Manuel", email: "owner@example.com", role: "owner" },
        collaborators: [
          {
            id: "member_123",
            name: "Ana",
            email: "ana@example.com",
            role: "editor",
            status: "accepted",
            createdAt: 1786800000000,
            updatedAt: 1786900000000,
          },
        ],
        invitations: [
          {
            id: "invitation_123",
            email: "friend@example.com",
            role: "viewer",
            status: "pending",
            expiresAt: 1787500000000,
            sentAt: 1786900000000,
            delivery: {
              purpose: "invite",
              status: "retry_scheduled",
              attemptCount: 1,
              maxAttempts: 5,
              lastErrorCode: "provider_http_429",
              updatedAt: 1786900001000,
            },
          },
        ],
      };
    },
    async invite(input) {
      calls.push(["invite", input]);
      const replayed = inviteOperations.has(input.operationId);
      inviteOperations.set(input.operationId, input);
      return {
        invitationId: "invitation_new",
        role: input.role,
        status: "pending",
        delivery: { outboxId: "outbox_new", status: "queued" },
        changed: !replayed,
        replayed,
      };
    },
    async resendInvitation(input) {
      calls.push(["resendInvitation", input]);
      return {
        invitationId: input.invitationId,
        role: "viewer",
        status: "pending",
        expiresAt: 1787600000000,
        sentAt: 1787000000000,
        delivery: { outboxId: "outbox_resend", status: "queued" },
        changed: true,
        replayed: false,
      };
    },
    async revokeInvitation(input) {
      calls.push(["revokeInvitation", input]);
      return {
        invitationId: input.invitationId,
        role: "viewer",
        status: "revoked",
        changed: true,
        replayed: false,
      };
    },
    async changeRole(input) {
      calls.push(["changeRole", input]);
      return {
        collaboratorId: input.collaboratorId,
        role: input.role,
        status: "updated",
        changed: true,
        replayed: false,
      };
    },
    async removeCollaborator(input) {
      calls.push(["removeCollaborator", input]);
      return {
        collaboratorId: input.collaboratorId,
        role: "viewer",
        status: "removed",
        changed: true,
        replayed: false,
      };
    },
  };
  const server = createTripPlannerServer({
    persistence,
    auth: {
      authenticated: true,
      scopes: [AUTH_SCOPES.share],
      resourceMetadataUrl:
        "https://sendero.example/.well-known/oauth-protected-resource",
    },
    publicWebUrl: "https://sendero.example",
    invitationPepper: "sendero-test-invitation-pepper-at-least-thirty-two-bytes",
    invitationSender: async () => {
      sent.push("unexpected direct delivery");
      throw new Error("The MCP request must not send email directly");
    },
  });
  const client = new Client({ name: "sendero-private-access-test", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const access = await client.callTool({
    name: "get_trip_access",
    arguments: { tripId: "trip_access" },
  });
  assert.equal(access.structuredContent.members[0].role, "collaborator");
  assert.equal(access.structuredContent.invitations[0].role, "viewer");
  assert.deepEqual(access.structuredContent.invitations[0].delivery, {
    purpose: "invite",
    status: "retry_scheduled",
    attemptCount: 1,
    maxAttempts: 5,
    lastErrorCode: "provider_http_429",
    updatedAt: 1786900001000,
  });
  assert.match(access.content[0].text, /1 persona con acceso/i);
  assert.doesNotMatch(access.content[0].text, /member_123|invitation_123|trip_access|get_trip_access/);

  const inviteArguments = {
    tripId: "trip_access",
    email: "new@example.com",
    role: "collaborator",
    operationId: "invite-access-operation-123",
  };
  const invited = await client.callTool({ name: "invite_trip_member", arguments: inviteArguments });
  const inviteReplay = await client.callTool({
    name: "invite_trip_member",
    arguments: inviteArguments,
  });
  assert.equal(invited.structuredContent.role, "collaborator");
  assert.equal(invited.structuredContent.delivery, "queued");
  assert.equal(inviteReplay.structuredContent.delivery, "queued");
  assert.equal(sent.length, 0);
  assert.equal(calls.find(([name]) => name === "invite")[1].role, "editor");
  assert.doesNotMatch(JSON.stringify(invited), /#token=|SENDERO_INVITE|tokenHash/);
  assert.doesNotMatch(invited.content[0].text, /invitation_new|trip_access|invite_trip_member/);

  const resent = await client.callTool({
    name: "resend_trip_invitation",
    arguments: {
      tripId: "trip_access",
      invitationId: "invitation_123",
      operationId: "resend-access-operation-123",
    },
  });
  assert.equal(resent.structuredContent.delivery, "queued");
  assert.equal(resent.structuredContent.email, "friend@example.com");
  assert.equal(sent.length, 0);
  const invitationTokens = calls
    .filter(([name]) => name === "invite" || name === "resendInvitation")
    .map(([, input]) => input.tokenHash);
  assert.equal(new Set(invitationTokens).size, 2);

  const revoked = await client.callTool({
    name: "revoke_trip_invitation",
    arguments: {
      tripId: "trip_access",
      invitationId: "invitation_123",
      operationId: "revoke-access-operation-123",
    },
  });
  assert.equal(revoked.structuredContent.status, "revoked");
  assert.equal(revoked.content[0].text, "La invitación quedó revocada.");

  const changed = await client.callTool({
    name: "change_trip_member_role",
    arguments: {
      tripId: "trip_access",
      memberId: "member_123",
      role: "viewer",
      operationId: "role-access-operation-123",
    },
  });
  assert.equal(changed.structuredContent.role, "viewer");
  assert.equal(calls.find(([name]) => name === "changeRole")[1].role, "viewer");
  assert.doesNotMatch(changed.content[0].text, /member_123|change_trip_member_role/);

  const removed = await client.callTool({
    name: "remove_trip_member",
    arguments: {
      tripId: "trip_access",
      memberId: "member_123",
      operationId: "remove-access-operation-123",
    },
  });
  assert.equal(removed.structuredContent.status, "removed");
  assert.equal(removed.content[0].text, "Esa persona ya no tiene acceso al viaje.");
  assert.doesNotMatch(removed.content[0].text, /member_123|remove_trip_member/);

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
  let publicTokenHash;
  let tokenDerivation;
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
      ...(status === "active" && publicTokenHash && tokenDerivation
        ? { tokenHash: publicTokenHash, tokenDerivation }
        : {}),
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
      publicTokenHash = input.tokenHash;
      tokenDerivation = { purpose: "publish", operationId: input.operationId };
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
      publicTokenHash = input.tokenHash;
      tokenDerivation = { purpose: "rotate", operationId: input.operationId };
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
  assert.equal(preview.content[0].text, "Revisa y confirma la vista pública en Sendero.");
  assert.doesNotMatch(preview.content[0].text, /Bairro Alto|Lisboa|publicar|actualizar/);
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
  assert.ok(published.content[0].text.includes(published.structuredContent.publicUrl));
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
  assert.doesNotMatch(stale.content[0].text, /https?:\/\//);
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
  assert.equal(updated.structuredContent.publicUrl, published.structuredContent.publicUrl);
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
  assert.ok(rotated.content[0].text.includes(rotated.structuredContent.publicUrl));
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
  assert.doesNotMatch(
    JSON.stringify([published, stale, updated, rotated, revoked]
      .map((result) => result.structuredContent)),
    /tokenHash|tokenDerivation/,
  );

  await client.close();
  await server.close();
});
