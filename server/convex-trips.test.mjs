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

function createDatabase() {
  const tables = {
    collaborators: [],
    reservationOperations: [],
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
