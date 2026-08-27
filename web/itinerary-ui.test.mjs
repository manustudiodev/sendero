import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDayAppleRouteUrl,
  buildDayAppleRouteUrls,
  buildDayEmbedMapUrl,
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

test("fallback routes exclude provisional areas from Google and Apple Maps", () => {
  const itinerary = {
    destination: "Ciudad de México, México",
    lodging: { status: "area_only", name: "Zona provisional", area: "Roma Norte" },
  };
  const day = {
    route: {
      stops: ["Zona provisional: Roma Norte", "Museo Nacional de Antropología"],
      returnToLodging: true,
    },
    activities: [],
  };
  assert.deepEqual(routeStopsForDay(day), ["Museo Nacional de Antropología"]);
  const googleRoute = buildDayRouteUrl(itinerary, day);
  const appleRoute = buildDayAppleRouteUrl(itinerary, day);
  assert.doesNotMatch(googleRoute, /provisional|Roma\+Norte/i);
  assert.doesNotMatch(appleRoute, /provisional|Roma\+Norte/i);
  assert.match(new URL(googleRoute).searchParams.get("query"), /Museo Nacional de Antropología/);
  assert.match(new URL(appleRoute).searchParams.get("query"), /Museo Nacional de Antropología/);
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

test("one real stop opens a scoped Apple Maps place search", () => {
  const href = buildDayAppleRouteUrl(
    { destination: "Buenos Aires, Argentina" },
    { activities: [{ location: { name: "MALBA", address: "Av. Figueroa Alcorta 3415" } }] },
  );
  const route = new URL(href);
  assert.equal(route.origin, "https://maps.apple.com");
  assert.equal(route.pathname, "/search");
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

test("Apple Maps preserves confirmed lodging and every public stop on return routes", () => {
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
  const route = new URL(buildDayAppleRouteUrl(itinerary, day));
  assert.equal(route.origin, "https://maps.apple.com");
  assert.equal(route.pathname, "/directions");
  assert.equal(route.searchParams.get("source"), "Rua da Prata 80, Lisboa");
  assert.equal(route.searchParams.get("destination"), "Rua da Prata 80, Lisboa");
  assert.equal(route.searchParams.get("mode"), "transit");
  const waypoints = route.searchParams.getAll("waypoint");
  assert.equal(waypoints.length, 2);
  assert.match(waypoints[0], /Museu do Fado/);
  assert.match(waypoints[1], /MAAT/);
});

test("daily route links prefer the scheduled transport over a global walking option", () => {
  const itinerary = {
    destination: "Ciudad de México, México",
    transport: { modes: ["walk", "public_transit", "taxi"] },
  };
  const day = {
    activities: [
      {
        id: "one",
        location: { name: "Centro", address: "Centro Histórico" },
        travelToNext: { mode: "public_transit", durationMinutes: 25 },
      },
      { id: "two", location: { name: "Coyoacán", address: "Coyoacán" } },
    ],
  };
  assert.equal(new URL(buildDayRouteUrl(itinerary, day)).searchParams.get("travelmode"), "transit");
  assert.equal(new URL(buildDayAppleRouteUrl(itinerary, day)).searchParams.get("mode"), "transit");
});

test("embedded directions use complete public coordinates instead of ambiguous place names", () => {
  const itinerary = {
    destination: "Ciudad de México, México",
    lodging: {
      status: "confirmed",
      address: "Private lodging address",
    },
    transport: { modes: ["public_transit"] },
  };
  const day = {
    route: { returnToLodging: true },
    activities: [
      {
        id: "one",
        location: { name: "Museo", latitude: 19.4326, longitude: -99.1332 },
        travelToNext: { mode: "public_transit" },
      },
      { id: "two", location: { name: "Mercado", latitude: 19.428, longitude: -99.127 } },
    ],
  };

  const url = new URL(buildDayEmbedMapUrl("test-key", itinerary, day, { language: "es" }));
  assert.equal(url.pathname, "/maps/embed/v1/directions");
  assert.equal(url.searchParams.get("key"), "test-key");
  assert.equal(url.searchParams.get("origin"), "19.4326,-99.1332");
  assert.equal(url.searchParams.get("destination"), "19.428,-99.127");
  assert.equal(url.searchParams.get("mode"), "transit");
  assert.equal(url.searchParams.get("language"), "es");
  assert.doesNotMatch(url.href, /Private|Museo|Mercado/);
});

test("embedded place maps support a canonical address without coordinates", () => {
  const itinerary = { destination: "Buenos Aires, Argentina" };
  const oneCoordinate = {
    activities: [
      { id: "malba", location: { name: "MALBA", latitude: -34.5768, longitude: -58.4034 } },
    ],
  };
  const coordinatePlace = new URL(buildDayEmbedMapUrl("test-key", itinerary, oneCoordinate));
  assert.equal(coordinatePlace.pathname, "/maps/embed/v1/place");
  assert.equal(coordinatePlace.searchParams.get("q"), "-34.5768,-58.4034");

  const oneAddress = {
    activities: [
      { id: "ateneo", location: { name: "El Ateneo Grand Splendid", address: "Av. Santa Fe 1860" } },
    ],
  };
  const place = new URL(buildDayEmbedMapUrl("test-key", itinerary, oneAddress));
  assert.equal(place.pathname, "/maps/embed/v1/place");
  assert.equal(
    place.searchParams.get("q"),
    "El Ateneo Grand Splendid, Av. Santa Fe 1860, Buenos Aires, Argentina",
  );
  assert.equal(buildDayEmbedMapUrl("", itinerary, oneAddress), "");
});

test("embedded directions allow a complete mix of coordinates and canonical addresses", () => {
  const itinerary = {
    destination: "Ciudad de México, México",
    transport: { modes: ["public_transit"] },
  };
  const mixed = {
    activities: [
      {
        id: "museum",
        location: {
          name: "Museo Nacional de Antropología",
          address: "Av. Paseo de la Reforma s/n",
          latitude: 19.426,
          longitude: -99.1863,
        },
      },
      {
        id: "market",
        location: { name: "Mercado de Coyoacán", address: "Ignacio Allende s/n, Coyoacán" },
      },
    ],
  };

  const url = new URL(buildDayEmbedMapUrl("test-key", itinerary, mixed));
  assert.equal(url.pathname, "/maps/embed/v1/directions");
  assert.equal(url.searchParams.get("origin"), "19.426,-99.1863");
  assert.equal(
    url.searchParams.get("destination"),
    "Mercado de Coyoacán, Ignacio Allende s/n, Coyoacán, Ciudad de México, México",
  );
  assert.equal(url.searchParams.get("mode"), "transit");
});

test("embedded routes fail closed when a public stop has neither coordinates nor an address", () => {
  const itinerary = { destination: "Buenos Aires, Argentina" };
  const unusable = {
    activities: [
      { id: "located", location: { name: "MALBA", latitude: -34.5768, longitude: -58.4034 } },
      { id: "missing", location: { name: "Lugar sin ubicación verificable" } },
    ],
  };
  assert.equal(buildDayEmbedMapUrl("test-key", itinerary, unusable), "");
});

test("embedded routes never include confirmed lodging or provisional bases", () => {
  const itinerary = {
    destination: "Ciudad de México, México",
    lodging: { status: "confirmed", address: "Dirección privada del alojamiento" },
  };
  const day = {
    route: {
      returnToLodging: true,
      stops: ["Base provisional Roma Norte / Condesa", "Otra parada importada"],
    },
    activities: [
      { id: "base", location: { name: "Base provisional Roma Norte", address: "Roma Norte" } },
      { id: "museum", location: { name: "Museo Frida Kahlo", address: "Londres 247, Coyoacán" } },
    ],
  };

  const url = new URL(buildDayEmbedMapUrl("test-key", itinerary, day));
  assert.equal(url.pathname, "/maps/embed/v1/place");
  assert.match(url.searchParams.get("q"), /Museo Frida Kahlo/);
  assert.doesNotMatch(url.href, /privada|alojamiento|provisional|Roma\+Norte|importada/i);
});

test("embedded directions accept Google's 20-waypoint limit and reject larger routes", () => {
  const itinerary = { destination: "Buenos Aires, Argentina" };
  const dayWithStops = (count) => ({
    activities: Array.from({ length: count }, (_, index) => ({
      id: `point-${index}`,
      location: {
        name: `Punto ${index}`,
        latitude: -34.6 + (index * 0.001),
        longitude: -58.4 + (index * 0.001),
      },
    })),
  });

  const supported = new URL(buildDayEmbedMapUrl("test-key", itinerary, dayWithStops(22)));
  assert.equal(supported.searchParams.get("waypoints").split("|").length, 20);
  assert.equal(buildDayEmbedMapUrl("test-key", itinerary, dayWithStops(23)), "");
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

test("long daily routes split into mobile-safe Apple Maps segments without losing stops", () => {
  const activities = Array.from({ length: 7 }, (_, index) => ({
    id: `stop-${index + 1}`,
    location: { name: `Parada ${index + 1}`, address: `Calle ${index + 1}` },
  }));
  const urls = buildDayAppleRouteUrls(
    { destination: "Buenos Aires, Argentina", transport: { modes: ["bike"] } },
    { activities },
  );
  assert.equal(urls.length, 2);
  const first = new URL(urls[0]);
  const second = new URL(urls[1]);
  assert.equal(first.searchParams.get("mode"), "cycling");
  assert.equal(first.searchParams.getAll("waypoint").length, 3);
  assert.match(first.searchParams.get("destination"), /Parada 5/);
  assert.match(second.searchParams.get("source"), /Parada 5/);
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

test("schematic coverage ignores private lodging endpoints", () => {
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
  assert.equal(coverage.complete, true);
  assert.equal(coverage.locatedCount, 2);
  assert.equal(coverage.requiredCount, 2);
  assert.deepEqual(coverage.points.map((point) => point.id), ["one", "two"]);
});

test("external links allow only HTTP(S) destinations", () => {
  assert.equal(safeExternalUrl("javascript:alert(1)"), "");
  assert.equal(safeExternalUrl("data:text/html,unsafe"), "");
  assert.equal(safeExternalUrl("not a URL"), "");
  assert.equal(safeExternalUrl("https://example.com/reserve"), "https://example.com/reserve");
});
