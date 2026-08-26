import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDayRouteUrl,
  buildDayRouteUrls,
  coordinateCoverageForDay,
  coordinateStopsForDay,
  routeStopsForDay,
} from "./src/itinerary/route-utils.js";
import { safeExternalUrl } from "./src/safe-url.js";

test("daily routes use canonical activity locations and never append a provisional base", () => {
  const day = {
    route: {
      stops: ["Base provisional Roma Norte / Condesa", "Wrong imported stop"],
      returnToLodging: true,
    },
    activities: [
      { id: "a", location: { name: "Museo Frida Kahlo", address: "Londres 247, Coyoacán" } },
      { id: "b", location: { name: "Cineteca Nacional", address: "Av. México Coyoacán 389" } },
    ],
  };
  assert.deepEqual(routeStopsForDay(day), [
    "Museo Frida Kahlo · Londres 247, Coyoacán",
    "Cineteca Nacional · Av. México Coyoacán 389",
  ]);
  const route = new URL(buildDayRouteUrl({ destination: "Ciudad de México, México" }, day));
  assert.match(route.pathname, /\/maps\/dir\/$/);
  assert.match(route.searchParams.get("origin"), /Museo Frida Kahlo/);
  assert.match(route.searchParams.get("destination"), /Cineteca Nacional/);
  assert.doesNotMatch(route.href, /Base\+provisional|Wrong\+imported/i);
});

test("one real stop opens a scoped Google place search", () => {
  const href = buildDayRouteUrl(
    { destination: "Buenos Aires, Argentina" },
    { activities: [{ location: { name: "MALBA", address: "Av. Figueroa Alcorta 3415" } }] },
  );
  const route = new URL(href);
  assert.match(route.pathname, /\/maps\/search\/$/);
  assert.match(route.searchParams.get("query"), /MALBA/);
  assert.match(route.searchParams.get("query"), /Buenos Aires/);
});

test("Google place queries do not duplicate a city already present in the address", () => {
  const href = buildDayRouteUrl(
    { destination: "Buenos Aires, Argentina" },
    { activities: [{ location: { name: "El Ateneo", address: "Av. Santa Fe 1860, Buenos Aires" } }] },
  );
  const query = new URL(href).searchParams.get("query");
  assert.equal(query.match(/Buenos Aires/gi)?.length, 1);
  assert.doesNotMatch(query, /Buenos Aires, Buenos Aires/i);
});

test("confirmed lodging is preserved as origin and destination when a day returns there", () => {
  const itinerary = {
    destination: "Lisboa, Portugal",
    lodging: { status: "confirmed", address: "Rua da Prata 80, Lisboa" },
    transport: { modes: ["public_transit"] },
  };
  const day = {
    route: { returnToLodging: true },
    activities: [
      { location: { name: "Museu do Fado", address: "Largo do Chafariz de Dentro 1" } },
      { location: { name: "MAAT", address: "Av. Brasília" } },
    ],
  };
  const route = new URL(buildDayRouteUrl(itinerary, day));
  assert.equal(route.searchParams.get("origin"), "Rua da Prata 80, Lisboa");
  assert.equal(route.searchParams.get("destination"), "Rua da Prata 80, Lisboa");
  assert.equal(route.searchParams.get("travelmode"), "transit");
  assert.match(route.searchParams.get("waypoints"), /Museu do Fado/);
  assert.match(route.searchParams.get("waypoints"), /MAAT/);
});

test("long daily routes split into mobile-safe Google Maps segments without losing stops", () => {
  const activities = Array.from({ length: 7 }, (_, index) => ({
    id: `stop-${index + 1}`,
    location: { name: `Parada ${index + 1}`, address: `Calle ${index + 1}` },
  }));
  const urls = buildDayRouteUrls(
    { destination: "Buenos Aires, Argentina", transport: { modes: ["public_transit"] } },
    { activities },
  );
  assert.equal(urls.length, 2);
  const first = new URL(urls[0]);
  const second = new URL(urls[1]);
  assert.equal(first.searchParams.get("travelmode"), "transit");
  assert.equal(first.searchParams.get("waypoints").split("|").length, 3);
  assert.match(first.searchParams.get("destination"), /Parada 5/);
  assert.match(second.searchParams.get("origin"), /Parada 5/);
  assert.match(second.searchParams.get("destination"), /Parada 7/);
});

test("schematic maps only accept valid coordinate pairs", () => {
  const points = coordinateStopsForDay({
    activities: [
      { id: "valid", title: "Valid", location: { latitude: 19.4326, longitude: -99.1332 } },
      { id: "invalid", title: "Invalid", location: { latitude: 999, longitude: -99 } },
      { id: "missing", title: "Missing", location: { name: "No coordinates" } },
    ],
  });
  assert.deepEqual(points.map((point) => point.id), ["valid"]);
});

test("schematic coverage refuses to represent only a subset of route stops", () => {
  const itinerary = { destination: "Ciudad de México, México" };
  const partial = coordinateCoverageForDay(itinerary, {
    activities: [
      { id: "located", location: { name: "Museo", latitude: 19.4326, longitude: -99.1332 } },
      { id: "missing", location: { name: "Mercado", address: "Centro" } },
    ],
  });
  assert.equal(partial.complete, false);
  assert.equal(partial.locatedCount, 1);
  assert.equal(partial.requiredCount, 2);

  const complete = coordinateCoverageForDay(itinerary, {
    activities: [
      { id: "one", location: { name: "Museo", latitude: 19.4326, longitude: -99.1332 } },
      { id: "two", location: { name: "Mercado", latitude: 19.428, longitude: -99.127 } },
    ],
  });
  assert.equal(complete.complete, true);
  assert.equal(complete.locatedCount, 2);
  assert.equal(complete.requiredCount, 2);
});

test("schematic coverage includes both confirmed lodging endpoints", () => {
  const coverage = coordinateCoverageForDay({
    destination: "Ciudad de México, México",
    lodging: { status: "confirmed", address: "Av. Sonora 100, Ciudad de México" },
  }, {
    route: { returnToLodging: true },
    activities: [
      { id: "one", location: { name: "Museo", latitude: 19.4326, longitude: -99.1332 } },
      { id: "two", location: { name: "Mercado", latitude: 19.428, longitude: -99.127 } },
    ],
  });
  assert.equal(coverage.complete, false);
  assert.equal(coverage.locatedCount, 2);
  assert.equal(coverage.requiredCount, 4);
});

test("external links allow only HTTP(S) destinations", () => {
  assert.equal(safeExternalUrl("javascript:alert(1)"), "");
  assert.equal(safeExternalUrl("data:text/html,unsafe"), "");
  assert.equal(safeExternalUrl("not a URL"), "");
  assert.equal(safeExternalUrl("https://example.com/reserve"), "https://example.com/reserve");
});
