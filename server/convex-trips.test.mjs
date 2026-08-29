import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

let tripsModulePromise;

function loadTripsModule() {
  tripsModulePromise ||= build({
    entryPoints: [new URL("../convex/trips.ts", import.meta.url).pathname],
    bundle: true,
    format: "esm",
    logLevel: "silent",
    platform: "node",
    write: false,
  }).then(({ outputFiles }) =>
    import(
      `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`
    ),
  );
  return tripsModulePromise;
}

function requestFingerprint(value) {
  const serialized = JSON.stringify(value);
  let high = 0x9e3779b9;
  let low = 0x85ebca6b;
  for (let index = 0; index < serialized.length; index += 1) {
    const code = serialized.charCodeAt(index);
    high = Math.imul(high ^ code, 0x5bd1e995);
    low = Math.imul(low ^ code, 0x27d4eb2d);
  }
  high = Math.imul(high ^ (high >>> 16), 0x85ebca6b) ^ Math.imul(low ^ (low >>> 13), 0xc2b2ae35);
  low = Math.imul(low ^ (low >>> 16), 0x85ebca6b) ^ Math.imul(high ^ (high >>> 13), 0xc2b2ae35);
  return `${serialized.length}:${(high >>> 0).toString(16).padStart(8, "0")}${(low >>> 0).toString(16).padStart(8, "0")}`;
}

function createDatabase() {
  const tables = {
    collaborators: [],
    reservationOperations: [],
    tripAccessAuditEvents: [],
    tripAccessOperations: [],
    tripInvitations: [],
    tripWriteOperations: [],
    tripRevisions: [],
    trips: [
      {
        _id: "trip_1",
        ownerId: "user_1",
        title: "Trip",
        destination: "Lisbon, Portugal",
        startDate: "2026-08-22",
        endDate: "2026-08-22",
        currentVersion: 1,
        status: "active",
        snapshot: {
          title: "Trip",
          destination: "Lisbon, Portugal",
          startDate: "2026-08-22",
          endDate: "2026-08-22",
          days: [
            {
              date: "2026-08-22",
              activities: [
                {
                  id: "museum",
                  startTime: "10:00",
                  title: "Museum",
                  reservation: {
                    kind: "ticket",
                    requirement: "required",
                    status: "pending",
                  },
                },
              ],
            },
          ],
        },
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    users: [
      {
        _id: "user_1",
        tokenIdentifier: "auth0|user-1",
        email: "traveler@example.com",
        name: "Traveler",
        createdAt: 1,
        updatedAt: 1,
      },
    ],
  };
  let nextId = 1;

  function recordById(id) {
    for (const records of Object.values(tables)) {
      const record = records.find((candidate) => candidate._id === id);
      if (record) return record;
    }
    return null;
  }

  return {
    tables,
    async get(id) {
      return recordById(id);
    },
    async insert(table, value) {
      const id = `${table}_${nextId++}`;
      tables[table].push({ _id: id, ...structuredClone(value) });
      return id;
    },
    async patch(id, value) {
      const record = recordById(id);
      if (!record) throw new Error(`Missing record ${id}`);
      Object.assign(record, structuredClone(value));
    },
    query(table) {
      let filters = [];
      const query = {
        withIndex(_name, apply) {
          const builder = {
            eq(field, value) {
              filters.push([field, value]);
              return builder;
            },
          };
          apply(builder);
          return query;
        },
        async unique() {
          const matches = tables[table].filter((record) =>
            filters.every(([field, value]) => record[field] === value),
          );
          if (matches.length > 1) throw new Error("Expected unique record");
          return matches[0] || null;
        },
        async collect() {
          return tables[table].filter((record) =>
            filters.every(([field, value]) => record[field] === value),
          );
        },
      };
      return query;
    },
  };
}

test("trip saves require optimistic concurrency and replay idempotently", async () => {
  const { save } = await loadTripsModule();
  const db = createDatabase();
  const ctx = {
    auth: {
      async getUserIdentity() {
        return {
          tokenIdentifier: "auth0|user-1",
          email: "traveler@example.com",
          name: "Traveler",
        };
      },
    },
    db,
  };
  const update = structuredClone(db.tables.trips[0].snapshot);
  update.title = "Updated trip";

  const firstRequest = {
    tripId: "trip_1",
    itinerary: update,
    reason: "Refined plan",
    expectedVersion: 1,
    operationId: "trip-save-update-1",
  };
  const first = await save._handler(ctx, firstRequest);
  assert.equal(first.version, 2);
  assert.equal(first.savedVersion, 2);
  assert.equal(first.replayed, false);
  assert.equal(first.itinerary.title, "Updated trip");
  assert.equal(first.itinerary.locale, "en");
  assert.equal(db.tables.trips[0].locale, "en");
  assert.equal(db.tables.trips[0].snapshot.locale, "en");

  const laterUpdate = structuredClone(update);
  laterUpdate.title = "Latest trip";
  const later = await save._handler(ctx, {
    tripId: "trip_1",
    itinerary: laterUpdate,
    reason: "Second refinement",
    expectedVersion: 2,
    operationId: "trip-save-update-2",
  });
  assert.equal(later.version, 3);

  db.tables.tripWriteOperations[0].requestFingerprint = requestFingerprint({
    tripId: firstRequest.tripId,
    itinerary: firstRequest.itinerary,
    reason: firstRequest.reason,
    expectedVersion: firstRequest.expectedVersion,
  });

  const retry = await save._handler(ctx, firstRequest);
  assert.equal(retry.replayed, true);
  assert.equal(retry.savedVersion, 2);
  assert.equal(retry.version, 3);
  assert.equal(retry.itinerary.title, "Latest trip");
  assert.equal(db.tables.tripRevisions.length, 2);
  assert.equal(db.tables.tripWriteOperations.length, 2);
  assert.match(
    db.tables.tripWriteOperations[0].requestFingerprint,
    /^\d+:[0-9a-f]{16}$/,
  );
  assert.doesNotMatch(
    db.tables.tripWriteOperations[0].requestFingerprint,
    /Updated trip|traveler@example\.com/,
  );

  await assert.rejects(
    save._handler(ctx, {
      tripId: "trip_1",
      itinerary: laterUpdate,
      expectedVersion: 1,
      operationId: "trip-save-stale-3",
    }),
    /Trip version changed/,
  );
});

test("new trip save retries return the existing authoritative trip", async () => {
  const { listMine, open, save } = await loadTripsModule();
  const db = createDatabase();
  const ctx = {
    auth: {
      async getUserIdentity() {
        return {
          tokenIdentifier: "auth0|user-1",
          email: "traveler@example.com",
          name: "Traveler",
        };
      },
    },
    db,
  };
  const itinerary = {
    locale: "en-GB",
    title: "New trip",
    destination: "Buenos Aires, Argentina",
    startDate: "2026-08-13",
    endDate: "2026-08-26",
    days: [],
  };
  const request = {
    itinerary,
    reason: "Trip created",
    operationId: "trip-save-create-1",
  };

  const created = await save._handler(ctx, request);
  const retry = await save._handler(ctx, request);
  assert.equal(created.tripId, retry.tripId);
  assert.match(created.webId, /^[a-f0-9]{32}$/);
  assert.equal(retry.webId, created.webId);
  assert.equal(db.tables.trips[1].webId, created.webId);
  assert.equal(created.itinerary.locale, "en-GB");
  assert.equal(retry.itinerary.locale, "en-GB");
  assert.equal(db.tables.trips[1].locale, "en-GB");
  assert.equal(db.tables.trips[1].snapshot.locale, "en-GB");
  assert.equal(db.tables.tripRevisions[0].snapshot.locale, "en-GB");
  assert.equal(retry.replayed, true);
  assert.equal(db.tables.trips.length, 2);
  assert.equal(db.tables.collaborators.length, 0);
  assert.equal(db.tables.tripWriteOperations.length, 1);

  const opened = await open._handler(ctx, { reference: { tripId: created.tripId } });
  assert.equal(opened.trip.locale, "en-GB");
  assert.equal(opened.trip.snapshot.locale, "en-GB");
  const listed = await listMine._handler(ctx, {});
  const listedTrip = listed.find((entry) => entry._id === created.tripId);
  assert.equal(listedTrip.locale, "en-GB");
  assert.equal(listedTrip.snapshot.locale, "en-GB");
});

test("trip updates preserve the saved locale unless a complete language change is explicit", async () => {
  const { save } = await loadTripsModule();
  const db = createDatabase();
  db.tables.trips[0].locale = "en-GB";
  db.tables.trips[0].snapshot = {
    ...db.tables.trips[0].snapshot,
    locale: "en-GB",
  };
  const ctx = {
    auth: {
      async getUserIdentity() {
        return {
          tokenIdentifier: "auth0|user-1",
          email: "traveler@example.com",
          name: "Traveler",
        };
      },
    },
    db,
  };

  const ordinaryUpdate = {
    ...structuredClone(db.tables.trips[0].snapshot),
    locale: "es",
    title: "Ordinary update",
  };
  await assert.rejects(
    save._handler(ctx, {
      tripId: "trip_1",
      itinerary: ordinaryUpdate,
      expectedVersion: 1,
      operationId: "trip-save-locale-mismatch",
    }),
    /Saved trip locale is en-GB/,
  );
  assert.equal(db.tables.trips[0].currentVersion, 1);
  assert.equal(db.tables.tripRevisions.length, 0);
  assert.equal(db.tables.tripWriteOperations.length, 0);

  const preserved = await save._handler(ctx, {
    tripId: "trip_1",
    itinerary: {
      ...ordinaryUpdate,
      locale: "en-GB",
    },
    expectedVersion: 1,
    operationId: "trip-save-locale-preserved",
  });
  assert.equal(preserved.itinerary.locale, "en-GB");
  assert.equal(db.tables.trips[0].locale, "en-GB");
  assert.equal(db.tables.tripRevisions.at(-1).snapshot.locale, "en-GB");

  const translatedUpdate = {
    ...structuredClone(preserved.itinerary),
    locale: "pt-BR",
    title: "Viagem traduzida",
  };
  const translated = await save._handler(ctx, {
    tripId: "trip_1",
    itinerary: translatedUpdate,
    expectedVersion: 2,
    changeLanguage: true,
    operationId: "trip-save-language-change",
  });
  assert.equal(translated.itinerary.locale, "pt-BR");
  assert.equal(db.tables.trips[0].locale, "pt-BR");
  assert.equal(db.tables.trips[0].snapshot.locale, "pt-BR");
  assert.equal(db.tables.tripRevisions.at(-1).snapshot.locale, "pt-BR");

  await assert.rejects(
    save._handler(ctx, {
      tripId: "trip_1",
      itinerary: translatedUpdate,
      expectedVersion: 2,
      operationId: "trip-save-language-change",
    }),
    /operation ID was already used for a different request/,
  );
});

test("existing trips receive one stable web ID and resolve it without exposing database IDs in URLs", async () => {
  const { ensureWebId, getByWebId } = await loadTripsModule();
  const db = createDatabase();
  const ctx = {
    auth: {
      async getUserIdentity() {
        return {
          tokenIdentifier: "auth0|user-1",
          email: "traveler@example.com",
          email_verified: true,
          name: "Traveler",
        };
      },
    },
    db,
  };

  const backfilled = await ensureWebId._handler(ctx, { tripId: "trip_1" });
  assert.equal(backfilled.changed, true);
  assert.match(backfilled.webId, /^[a-f0-9]{32}$/);
  assert.notEqual(backfilled.webId, "trip_1");

  const repeated = await ensureWebId._handler(ctx, { tripId: "trip_1" });
  assert.deepEqual(repeated, {
    tripId: "trip_1",
    webId: backfilled.webId,
    changed: false,
  });

  const resolved = await getByWebId._handler(ctx, { webId: backfilled.webId });
  assert.equal(resolved._id, "trip_1");
  assert.equal(resolved.webId, backfilled.webId);
  assert.equal(resolved.role, "owner");
  assert.equal(resolved.locale, "en");
  assert.equal(resolved.snapshot.locale, "en");
});

test("authorized collaborators can backfill a stable web ID for historical trips", async () => {
  const { ensureWebId } = await loadTripsModule();
  const db = createDatabase();
  db.tables.users.push({
    _id: "user_2",
    tokenIdentifier: "auth0|user-2",
    email: "viewer@example.com",
    name: "Viewer",
    createdAt: 2,
    updatedAt: 2,
  });
  db.tables.collaborators.push({
    _id: "collaborator_1",
    tripId: "trip_1",
    userId: "user_2",
    role: "viewer",
    status: "accepted",
    createdAt: 2,
    updatedAt: 2,
  });
  const ctx = {
    auth: {
      async getUserIdentity() {
        return {
          tokenIdentifier: "auth0|user-2",
          email: "viewer@example.com",
          name: "Viewer",
        };
      },
    },
    db,
  };

  const result = await ensureWebId._handler(ctx, { tripId: "trip_1" });
  assert.equal(result.changed, true);
  assert.match(result.webId, /^[a-f0-9]{32}$/);
  assert.equal(db.tables.trips[0].webId, result.webId);
});

test("trip opening resolves exact, latest, natural, ambiguous, and missing references atomically", async () => {
  const { listMine, open } = await loadTripsModule();
  const db = createDatabase();
  const ctx = {
    auth: {
      async getUserIdentity() {
        return {
          tokenIdentifier: "auth0|user-1",
          email: "traveler@example.com",
          name: "Traveler",
        };
      },
    },
    db,
  };

  const exact = await open._handler(ctx, { reference: { tripId: "trip_1" } });
  assert.equal(exact.state, "opened");
  assert.equal(exact.trip._id, "trip_1");
  assert.equal(exact.trip.role, "owner");
  assert.equal(exact.trip.locale, "en");
  assert.equal(exact.trip.snapshot.locale, "en");

  const listed = await listMine._handler(ctx, {});
  assert.equal(listed[0].locale, "en");
  assert.equal(listed[0].snapshot.locale, "en");

  const natural = await open._handler(ctx, {
    reference: {
      query: "lisbon portugal",
      startDate: "2026-08-22",
      endDate: "2026-08-22",
    },
  });
  assert.equal(natural.state, "opened");
  assert.equal(natural.trip._id, "trip_1");

  db.tables.trips.push({
    ...structuredClone(db.tables.trips[0]),
    _id: "trip_2",
    title: "Second trip",
    currentVersion: 2,
    updatedAt: 2,
  });

  const latest = await open._handler(ctx, {
    reference: { selector: "latest_updated" },
  });
  assert.equal(latest.state, "opened");
  assert.equal(latest.trip._id, "trip_2");

  const ambiguous = await open._handler(ctx, {
    reference: { query: "Lisbon" },
  });
  assert.equal(ambiguous.state, "needs_selection");
  assert.deepEqual(
    ambiguous.trips.map((trip) => trip.id),
    ["trip_2", "trip_1"],
  );
  assert.deepEqual(
    ambiguous.trips.map((trip) => trip.locale),
    ["en", "en"],
  );

  const missing = await open._handler(ctx, {
    reference: { query: "Tokyo" },
  });
  assert.deepEqual(missing, { state: "not_found", trips: [] });
});

test("revision restores preserve the current trip locale and replay against the latest trip", async () => {
  const { getRevision, restoreRevision } = await loadTripsModule();
  const db = createDatabase();
  const original = {
    ...structuredClone(db.tables.trips[0].snapshot),
    locale: "es",
  };
  db.tables.tripRevisions.push({
    _id: "revision_1",
    tripId: "trip_1",
    version: 1,
    snapshot: original,
    actorId: "user_1",
    reason: "Original",
    createdAt: 1,
  });
  db.tables.trips[0].snapshot = { ...original, title: "Current version" };
  db.tables.trips[0].locale = "en-GB";
  db.tables.trips[0].title = "Current version";
  db.tables.trips[0].currentVersion = 2;
  const ctx = {
    auth: {
      async getUserIdentity() {
        return {
          tokenIdentifier: "auth0|user-1",
          email: "traveler@example.com",
          name: "Traveler",
        };
      },
    },
    db,
  };
  const request = {
    tripId: "trip_1",
    version: 1,
    expectedVersion: 2,
    operationId: "trip-restore-version-1",
  };

  const candidate = await getRevision._handler(ctx, {
    tripId: request.tripId,
    version: request.version,
  });
  assert.equal(candidate.tripId, "trip_1");
  assert.equal(candidate.version, 1);
  assert.equal(candidate.role, "owner");
  assert.equal(candidate.itinerary.title, "Trip");
  assert.equal(candidate.itinerary.locale, "en-GB");

  const restored = await restoreRevision._handler(ctx, request);
  assert.equal(restored.version, 3);
  assert.equal(restored.replayed, false);
  assert.equal(restored.itinerary.title, "Trip");
  assert.equal(restored.itinerary.locale, "en-GB");
  assert.equal(db.tables.trips[0].locale, "en-GB");
  assert.equal(db.tables.trips[0].snapshot.locale, "en-GB");
  assert.equal(db.tables.tripRevisions.at(-1).snapshot.locale, "en-GB");

  db.tables.trips[0].snapshot = { ...original, title: "Later edit" };
  db.tables.trips[0].title = "Later edit";
  db.tables.trips[0].currentVersion = 4;
  const retry = await restoreRevision._handler(ctx, request);
  assert.equal(retry.replayed, true);
  assert.equal(retry.restoredVersion, 3);
  assert.equal(retry.version, 4);
  assert.equal(retry.itinerary.title, "Later edit");
  assert.equal(retry.itinerary.locale, "en-GB");
  assert.equal(db.tables.tripWriteOperations.length, 1);
});

test("reservation updates preserve classification and idempotent retries return the latest trip", async () => {
  const { updateReservationStatus } = await loadTripsModule();
  const db = createDatabase();
  const ctx = {
    auth: {
      async getUserIdentity() {
        return {
          tokenIdentifier: "auth0|user-1",
          email: "traveler@example.com",
          name: "Traveler",
        };
      },
    },
    db,
  };
  const assertReservation = (result, status) => {
    assert.deepEqual(result.itinerary.days[0].activities[0].reservation, {
      kind: "ticket",
      requirement: "required",
      status,
    });
  };
  const firstRequest = {
    tripId: "trip_1",
    dayDate: "2026-08-22",
    activityId: "museum",
    status: "confirmed",
    expectedVersion: 1,
    operationId: "reservation-confirm-1",
  };

  const first = await updateReservationStatus._handler(ctx, firstRequest);
  assert.equal(first.version, 2);
  assertReservation(first, "confirmed");

  const later = await updateReservationStatus._handler(ctx, {
    ...firstRequest,
    status: "cancelled",
    expectedVersion: 2,
    operationId: "reservation-cancel-2",
  });
  assert.equal(later.version, 3);
  assertReservation(later, "cancelled");

  const retry = await updateReservationStatus._handler(ctx, firstRequest);
  assert.equal(retry.changed, true);
  assert.equal(retry.version, 3);
  assertReservation(retry, "cancelled");
  assert.equal(db.tables.tripRevisions.length, 2);
  assert.equal(db.tables.reservationOperations.length, 2);
});
