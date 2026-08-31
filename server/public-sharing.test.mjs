import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { sanitizePublicSnapshot } from "../shared/public-snapshot.mjs";
import {
  PUBLIC_SHARE_HASH_DOMAIN,
  buildPublicShareUrl,
  derivePublicShareToken,
  generatePublicShareToken,
  hashPublicShareToken,
  isValidPublicShareToken,
  publicShareExpiresAt,
  recoverPublicShareUrl,
  validatePublicShareToken,
} from "./public-sharing.mjs";

function privateItinerary() {
  return {
    id: "private-trip-id",
    title: "Buenos Aires entre amigos",
    destination: "Buenos Aires, Argentina",
    startDate: "2027-08-13",
    endDate: "2027-08-14",
    timezone: "America/Argentina/Buenos_Aires",
    travellers: { adults: 2, children: 0 },
    arrivalTime: "PRIVATE ARRIVAL TIME",
    departureTime: "PRIVATE DEPARTURE TIME",
    dailySchedule: { earliestStartTime: "09:00", latestEndTime: "21:00" },
    mobility: { maxWalkingMinutes: 15, avoidStairs: true, wheelchairAccess: true },
    accessibilityNeeds: ["PRIVATE ACCESSIBILITY NEED"],
    budget: {
      amount: 1300,
      currency: "USD",
      scope: "total",
      flexibility: "strict",
      includes: ["activities", "food", "local_transport"],
    },
    lodging: {
      name: "Secret Hotel",
      address: "PRIVATE LODGING ADDRESS 123",
      area: "Palermo",
      status: "confirmed",
      confirmationCode: "PRIVATE-CODE",
    },
    transport: {
      modes: ["walk", "public_transit"],
      hasLicense: false,
      wantsCar: false,
    },
    days: [
      {
        date: "2027-08-13",
        title: "Primer día",
        area: "Palermo",
        summary: "Museos y cafés",
        fallback: "Plan bajo techo",
        weather: {
          status: "forecast",
          summary: "Fresco",
          sourceUrl: "https://weather.example/forecast",
          checkedAt: "2027-08-10T10:00:00Z",
          privatePayload: "PRIVATE WEATHER DATA",
        },
        activities: [
          {
            id: "private-activity-id",
            startTime: "10:00",
            endTime: "12:00",
            title: "Museo",
            description: "Visita a la colección",
            guide: {
              overview: "Un museo clave para comprender el arte argentino.",
              highlights: ["Observar la colección de arte del siglo XIX."],
              sources: [
                {
                  label: "Museo · colección",
                  url: "https://museum.example/collection",
                  checkedAt: "2027-08-10T10:00:00Z",
                },
              ],
            },
            category: "museum",
            cost: {
              category: "activities",
              status: "verified",
              currency: "USD",
              min: 25,
              max: 25,
              sourceUrl: "https://museum.example/private-price",
            },
            accessibility: {
              status: "verified",
              wheelchairAccessible: true,
              stepFree: true,
              note: "PRIVATE ACCESSIBILITY NOTE",
              sourceUrl: "https://museum.example/private-accessibility-source",
              checkedAt: "2027-08-10T10:00:00Z",
            },
            locked: true,
            location: {
              name: "Museo público",
              address: "Avenida Pública 456",
              latitude: -34.5837,
              longitude: -58.3932,
              coordinates: "PRIVATE COORDINATES",
            },
            sourceUrl: "https://museum.example/visit",
            reservation: {
              requirement: "required",
              status: "confirmed",
              url: "https://booking.example/PRIVATE-TOKEN",
              deadline: "2027-08-01",
              note: "PRIVATE RESERVATION NOTE",
            },
            travelToNext: {
              mode: "walk",
              durationMinutes: 15,
              summary: "Caminata corta",
              privateNote: "PRIVATE TRAVEL NOTE",
            },
          },
        ],
        route: {
          origin: "PRIVATE LODGING ADDRESS 123",
          stops: ["Avenida Pública 456", "PRIVATE EXTRA STOP"],
          returnToLodging: true,
          totalMinutes: 99,
          mapUrl: "https://maps.example/?origin=PRIVATE+LODGING+ADDRESS+123",
        },
        additionalCosts: [{
          id: "private-food-budget",
          label: "PRIVATE DAILY BUDGET",
          category: "food",
          status: "estimated",
          currency: "USD",
          min: 80,
          max: 120,
        }],
      },
    ],
    sources: [
      { label: "Museo", url: "https://museum.example", checkedAt: "2027-08-01" },
    ],
    collaborators: [{ email: "private@example.com" }],
    revisions: [{ actorId: "private-user-id", reason: "private reason" }],
  };
}

test("creates a strict, versionable public projection without known private fields", () => {
  const source = privateItinerary();
  const published = sanitizePublicSnapshot(source);

  assert.equal(published.schemaVersion, 1);
  assert.equal(published.timezone, "America/Argentina/Buenos_Aires");
  assert.equal(published.baseArea, "Palermo");
  assert.deepEqual(published.transport, { modes: ["walk", "public_transit"] });
  assert.equal("locked" in published.days[0].activities[0], false);
  assert.equal("reservation" in published.days[0].activities[0], false);
  assert.equal("budget" in published, false);
  assert.equal("travellers" in published, false);
  assert.equal("arrivalTime" in published, false);
  assert.equal("departureTime" in published, false);
  assert.equal("dailySchedule" in published, false);
  assert.equal("mobility" in published, false);
  assert.equal("accessibilityNeeds" in published, false);
  assert.equal("cost" in published.days[0].activities[0], false);
  assert.equal("accessibility" in published.days[0].activities[0], false);
  assert.equal("additionalCosts" in published.days[0], false);
  assert.equal(published.days[0].activities[0].publicId, "2027-08-13:activity:1");
  assert.deepEqual(published.days[0].activities[0].booking, {
    required: true,
    confirmed: true,
  });
  assert.equal(published.days[0].activities[0].location.latitude, -34.5837);
  assert.equal(published.days[0].activities[0].location.longitude, -58.3932);
  assert.deepEqual(published.days[0].activities[0].guide, {
    overview: "Un museo clave para comprender el arte argentino.",
    highlights: ["Observar la colección de arte del siglo XIX."],
    sources: [
      {
        label: "Museo · colección",
        url: "https://museum.example/collection",
        checkedAt: "2027-08-10T10:00:00Z",
      },
    ],
  });
  assert.deepEqual(published.days[0].route.stops, [
    "Avenida Pública 456, Buenos Aires, Argentina",
  ]);
  assert.equal(
    published.days[0].route.origin,
    "Avenida Pública 456, Buenos Aires, Argentina",
  );
  assert.equal(published.days[0].route.returnToLodging, false);
  assert.match(published.days[0].route.mapUrl, /maps\/search/);
  assert.doesNotMatch(published.days[0].route.mapUrl, /origin=Palermo/);

  const serialized = JSON.stringify(published);
  for (const secret of [
    "private-trip-id",
    "Secret Hotel",
    "PRIVATE LODGING ADDRESS 123",
    "PRIVATE-CODE",
    "private-activity-id",
    "PRIVATE COORDINATES",
    "PRIVATE-TOKEN",
    "PRIVATE RESERVATION NOTE",
    "PRIVATE EXTRA STOP",
    "PRIVATE TRAVEL NOTE",
    "private@example.com",
    "private-user-id",
    "private reason",
    "PRIVATE DAILY BUDGET",
    "PRIVATE ARRIVAL TIME",
    "PRIVATE DEPARTURE TIME",
    "PRIVATE ACCESSIBILITY NEED",
    "PRIVATE ACCESSIBILITY NOTE",
    "private-accessibility-source",
  ]) {
    assert.doesNotMatch(serialized, new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.equal(source.days[0].route.origin, "PRIVATE LODGING ADDRESS 123");
});

test("keeps recommended booking public without claiming that it is required", () => {
  const source = privateItinerary();
  source.days[0].activities[0].reservation.requirement = "recommended";
  source.days[0].activities[0].reservation.status = "pending";
  const published = sanitizePublicSnapshot(source);
  assert.deepEqual(published.days[0].activities[0].booking, {
    required: false,
    confirmed: false,
  });
});

test("omits an invalid timezone instead of publishing misleading local-time context", () => {
  const source = privateItinerary();
  source.timezone = "Buenos Aires local time";
  const published = sanitizePublicSnapshot(source);
  assert.equal(published.timezone, undefined);
});

test("uses English public redaction labels by default and preserves supported trip locales", () => {
  const cases = [
    { locale: undefined, expectedLocale: "en", title: "Shared trip", destination: "Destination" },
    { locale: "es-AR", expectedLocale: "es-AR", title: "Viaje compartido", destination: "Destino" },
    { locale: "pt-BR", expectedLocale: "pt-BR", title: "Viagem compartilhada", destination: "Destino" },
    { locale: "fr-FR", expectedLocale: "fr-FR", title: "Voyage partagé", destination: "Destination" },
    { locale: "de-DE", expectedLocale: "de-DE", title: "Geteilte Reise", destination: "Reiseziel" },
  ];

  for (const item of cases) {
    const source = privateItinerary();
    source.locale = item.locale;
    source.title = source.lodging.name;
    source.destination = source.lodging.address;

    const published = sanitizePublicSnapshot(source);
    assert.equal(published.locale, item.expectedLocale);
    assert.equal(published.title, item.title);
    assert.equal(published.destination, item.destination);
  }
});

test("redacts lodging variants from public copy, locations, routes, and map URLs", () => {
  const source = privateItinerary();
  source.lodging.name = "Hôtel Sécret";
  source.lodging.address = "Calle Privada 123";
  source.title = "Escapada desde HOTEL-SECRET";
  source.days[0].summary = "Regreso a Calle-Privada 123 al final del día";
  source.days[0].fallback = "Descansar en Hôtel Sécret";
  source.days[0].weather.summary = "Pronóstico para HOTEL SECRET";
  source.days[0].weather.checkedAt = "Calle Privada 123";
  source.days[0].activities[0].guide.highlights.push(
    "Regresar a Calle Privada 123 después de la visita",
  );
  source.days[0].activities[0].guide.sources.push(
    {
      label: "Cómo llegar desde Hôtel Sécret",
      url: "https://museum.example/directions",
    },
    {
      label: "Fuente pública",
      url: "https://museum.example/?origin=Calle+Privada+123",
    },
  );
  source.days[0].activities.push({
    startTime: "15:00",
    title: "Check-in en HOTEL SECRET",
    description: "Llegar a CALLE-PRIVADA 123",
    guide: {
      overview: "La visita comienza junto a Hôtel Sécret.",
      highlights: ["Arquitectura pública"],
      sources: [{ label: "Fuente", url: "https://example.com/guide" }],
    },
    category: "logistics",
    locked: true,
    location: {
      name: "hotel secret",
      address: "Calle Privada 123",
    },
    sourceUrl: "https://example.com/?place=Calle+Privada+123",
    reservation: {
      status: "confirmed",
      note: "Dato privado",
    },
    travelToNext: {
      mode: "walk",
      durationMinutes: 5,
      summary: "Salida desde Hôtel Sécret",
    },
  });
  source.sources.push({
    label: "Cómo llegar a HOTEL SECRET",
    url: "https://example.com/Calle-Privada-123",
    checkedAt: "Hôtel Sécret",
  });
  source.sources[0].checkedAt = "Secret Hotel";

  const published = sanitizePublicSnapshot(source);
  const privateActivity = published.days[0].activities[1];
  const serialized = JSON.stringify(published);

  assert.equal(privateActivity.location, undefined);
  assert.equal(privateActivity.sourceUrl, undefined);
  assert.equal(privateActivity.guide, undefined);
  assert.deepEqual(published.days[0].activities[0].guide, {
    overview: "Un museo clave para comprender el arte argentino.",
    highlights: ["Observar la colección de arte del siglo XIX."],
    sources: [
      {
        label: "Museo · colección",
        url: "https://museum.example/collection",
        checkedAt: "2027-08-10T10:00:00Z",
      },
    ],
  });
  assert.equal(published.days[0].weather.checkedAt, undefined);
  assert.equal(published.sources?.[0]?.checkedAt, undefined);
  assert.equal("locked" in privateActivity, false);
  assert.equal("reservation" in privateActivity, false);
  assert.deepEqual(published.days[0].route.stops, [
    "Avenida Pública 456, Buenos Aires, Argentina",
  ]);
  assert.doesNotMatch(published.days[0].route.mapUrl, /hotel|secret|calle|privada|123/i);
  assert.doesNotMatch(serialized, /h[oô]tel[ -]s[eé]cret|calle[ -]privada[ -]123/i);
});

test("omits an activity guide when no safe editorial source remains", () => {
  const source = privateItinerary();
  source.days[0].activities[0].guide = {
    overview: "Historia pública del museo.",
    highlights: ["Observar la arquitectura original."],
    sources: [
      {
        label: "Indicaciones desde Secret Hotel",
        url: "https://museum.example/history",
      },
      {
        label: "Fuente pública",
        url: "https://museum.example/?origin=PRIVATE+LODGING+ADDRESS+123",
      },
    ],
  };

  const published = sanitizePublicSnapshot(source);
  assert.equal(published.days[0].activities[0].guide, undefined);
  assert.doesNotMatch(JSON.stringify(published), /Secret Hotel|PRIVATE LODGING ADDRESS 123/i);
});

test("never uses the destination or lodging as a public route base", () => {
  const source = privateItinerary();
  delete source.lodging.area;
  const published = sanitizePublicSnapshot(source);
  assert.equal(published.baseArea, undefined);
  assert.equal(
    published.days[0].route.origin,
    "Avenida Pública 456, Buenos Aires, Argentina",
  );
  assert.equal(published.days[0].route.returnToLodging, false);
  assert.doesNotMatch(published.days[0].route.mapUrl, /Secret|PRIVATE/);
});

test("generates and hashes strict opaque share tokens", () => {
  const first = generatePublicShareToken();
  const second = generatePublicShareToken();
  assert.equal(first.length, 43);
  assert.equal(isValidPublicShareToken(first), true);
  assert.notEqual(first, second);

  const hash = hashPublicShareToken(first);
  assert.equal(hash.length, 43);
  assert.notEqual(hash, first);
  assert.equal(hashPublicShareToken(first), hash);
  assert.equal(
    hash,
    createHash("sha256")
      .update(`${PUBLIC_SHARE_HASH_DOMAIN}${first}`, "utf8")
      .digest("base64url"),
  );
});

test("derives a stable opaque token for idempotent publish and rotation retries", () => {
  const secret = "sendero-test-secret-with-more-than-thirty-two-bytes";
  const input = {
    secret,
    purpose: "publish",
    tripId: "trip_123",
    operationId: "operation-1234",
  };
  const first = derivePublicShareToken(input);
  assert.equal(first, derivePublicShareToken(input));
  assert.equal(isValidPublicShareToken(first), true);
  assert.notEqual(first, derivePublicShareToken({ ...input, purpose: "rotate" }));
  assert.notEqual(first, derivePublicShareToken({ ...input, tripId: "trip_456" }));
  assert.notEqual(first, derivePublicShareToken({ ...input, operationId: "operation-5678" }));
  assert.throws(
    () => derivePublicShareToken({ ...input, secret: "too-short" }),
    /at least 32 bytes/,
  );
});

test("recovers a public URL only when its protected descriptor matches the stored hash", () => {
  const secret = "sendero-test-secret-with-more-than-thirty-two-bytes";
  const tripId = "trip_123";
  const tokenDerivation = {
    purpose: "publish",
    operationId: "operation-1234",
  };
  const token = derivePublicShareToken({ secret, tripId, ...tokenDerivation });
  const sharing = {
    status: "active",
    tokenDerivation,
    tokenHash: hashPublicShareToken(token),
  };
  const url = recoverPublicShareUrl({
    baseUrl: "https://sendero.example",
    secret,
    tripId,
    sharing,
  });
  assert.equal(url, `https://sendero.example/share#${token}`);
  assert.equal(recoverPublicShareUrl({
    baseUrl: "https://sendero.example",
    secret,
    tripId,
    sharing: { ...sharing, tokenHash: "A".repeat(43) },
  }), undefined);
  assert.equal(recoverPublicShareUrl({
    baseUrl: "https://sendero.example",
    secret,
    tripId,
    sharing: { status: "active", tokenHash: sharing.tokenHash },
  }), undefined);
  assert.equal(recoverPublicShareUrl({
    baseUrl: "https://sendero.example",
    secret,
    tripId,
    sharing: { ...sharing, status: "revoked" },
  }), undefined);
});

test("rejects malformed tokens and unsafe public origins", () => {
  for (const value of ["", "short", "a".repeat(42), "a".repeat(44), `${"a".repeat(42)}!`]) {
    assert.equal(isValidPublicShareToken(value), false);
    assert.throws(() => validatePublicShareToken(value), /Invalid Sendero public share token/);
  }
  const token = generatePublicShareToken();
  assert.throws(
    () => buildPublicShareUrl({ baseUrl: "http://sendero.example", token }),
    /must use HTTPS/,
  );
  for (const baseUrl of ["file://localhost", "ftp://localhost"]) {
    assert.throws(
      () => buildPublicShareUrl({ baseUrl, token }),
      /must use HTTPS/,
    );
  }
  assert.throws(
    () => buildPublicShareUrl({ baseUrl: "https://user:secret@sendero.example", token }),
    /must not include credentials/,
  );
});

test("builds fragment links and validates the 1–365 day expiry window", () => {
  const token = generatePublicShareToken();
  const link = new URL(buildPublicShareUrl({ baseUrl: "https://sendero.example/mcp", token }));
  assert.equal(link.pathname, "/share");
  assert.equal(link.search, "");
  assert.equal(link.hash, `#${token}`);
  assert.equal(link.pathname.includes(token), false);

  const now = 1_800_000_000_000;
  assert.equal(publicShareExpiresAt(undefined, now), now + 30 * 24 * 60 * 60 * 1000);
  assert.equal(publicShareExpiresAt(1, now), now + 24 * 60 * 60 * 1000);
  assert.equal(publicShareExpiresAt(365, now), now + 365 * 24 * 60 * 60 * 1000);
  assert.throws(() => publicShareExpiresAt(0, now), /between 1 and 365/);
  assert.throws(() => publicShareExpiresAt(366, now), /between 1 and 365/);
});
