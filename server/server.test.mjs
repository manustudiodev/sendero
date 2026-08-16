import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  ITINERARY_UI_URI,
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
    ["prepare_trip_brief", "render_itinerary", "validate_itinerary"],
  );

  const result = await client.callTool({
    name: "render_itinerary",
    arguments: { itinerary },
  });
  assert.equal(result.structuredContent.itinerary.days.length, 1);
  assert.equal(result.structuredContent.validation.valid, true);

  const resource = await client.readResource({ uri: ITINERARY_UI_URI });
  assert.equal(resource.contents[0].mimeType, "text/html;profile=mcp-app");
  assert.match(resource.contents[0].text, /Calendario/);
  assert.match(resource.contents[0].text, /Mapa/);

  await client.close();
  await server.close();
});
