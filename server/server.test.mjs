import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { AUTH_SCOPES } from "./auth.mjs";
import {
  ITINERARY_UI_URI,
  TRIP_INTAKE_UI_URI,
  buildDailyRouteUrl,
  createTripPlannerServer,
  normalizeItinerary,
  validateItinerary,
} from "./server.mjs";

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
      "get_itinerary",
      "list_itineraries",
      "prepare_trip_brief",
      "render_itinerary",
      "render_trip_intake",
      "restore_itinerary_version",
      "save_itinerary",
      "share_itinerary",
      "validate_itinerary",
    ],
  );
  const publicTool = tools.tools.find((tool) => tool.name === "render_itinerary");
  const intakeTool = tools.tools.find((tool) => tool.name === "render_trip_intake");
  const protectedTool = tools.tools.find((tool) => tool.name === "save_itinerary");
  assert.deepEqual(publicTool._meta.securitySchemes, [{ type: "noauth" }]);
  assert.equal(publicTool._meta.ui.resourceUri, ITINERARY_UI_URI);
  assert.equal(publicTool._meta["openai/outputTemplate"], ITINERARY_UI_URI);
  assert.equal(intakeTool._meta.ui.resourceUri, TRIP_INTAKE_UI_URI);
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
  assert.equal(resource.contents[0].mimeType, "text/html;profile=mcp-app");
  assert.match(resource.contents[0].text, /Calendario/);
  assert.match(resource.contents[0].text, /Rutas/);
  assert.match(resource.contents[0].text, /toolOutput/);
  assert.match(resource.contents[0].text, /ui\/notifications\/tool-result/);

  const intake = await client.callTool({ name: "render_trip_intake", arguments: {} });
  assert.deepEqual(intake.structuredContent.actions, ["new", "open", "adjust", "refresh"]);
  const intakeResource = await client.readResource({ uri: TRIP_INTAKE_UI_URI });
  assert.match(intakeResource.contents[0].text, /Nuevo viaje/);
  assert.match(intakeResource.contents[0].text, /area_only/);
  assert.match(intakeResource.contents[0].text, /undecided/);

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

  const listed = await client.callTool({ name: "list_itineraries", arguments: {} });
  assert.equal(listed.structuredContent.trips[0].id, "trip_123");

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
    ["list", "get", "save", "share", "restore"],
  );

  await client.close();
  await server.close();
});
