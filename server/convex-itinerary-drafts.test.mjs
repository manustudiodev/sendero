import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

let modulePromise;

function loadModule() {
  modulePromise ||= build({
    entryPoints: [new URL("../convex/itineraryDrafts.ts", import.meta.url).pathname],
    bundle: true,
    format: "esm",
    logLevel: "silent",
    platform: "node",
    write: false,
  }).then(({ outputFiles }) =>
    import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`),
  );
  return modulePromise;
}

function createDatabase() {
  const tables = {
    collaborators: [],
    itineraryDrafts: [],
    tripRevisions: [],
    trips: [],
    tripWriteOperations: [],
    users: [{
      _id: "user_1",
      tokenIdentifier: "auth0|draft-user",
      email: "traveler@example.com",
      name: "Traveler",
      createdAt: 1,
      updatedAt: 1,
    }],
  };
  let nextId = 1;
  const recordById = (id) => Object.values(tables)
    .flat()
    .find((record) => record._id === id) || null;
  return {
    tables,
    async get(id) { return recordById(id); },
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
    async delete(id) {
      for (const records of Object.values(tables)) {
        const index = records.findIndex((record) => record._id === id);
        if (index >= 0) return records.splice(index, 1);
      }
      return undefined;
    },
    query(table) {
      const filters = [];
      const query = {
        withIndex(_name, apply) {
          const builder = { eq(field, value) { filters.push([field, value]); return builder; } };
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

function context(db) {
  const scheduled = [];
  return {
    auth: {
      async getUserIdentity() {
        return {
          tokenIdentifier: "auth0|draft-user",
          email: "traveler@example.com",
          name: "Traveler",
        };
      },
    },
    db,
    scheduler: {
      async runAt(at, reference, args) { scheduled.push({ at, reference, args }); },
    },
    scheduled,
  };
}

const itinerary = {
  locale: "es",
  title: "Valencia a pie",
  destination: "Valencia, España",
  startDate: "2027-04-10",
  endDate: "2027-04-10",
  transport: { modes: ["walk"], hasLicense: false, wantsCar: false },
  days: [],
};

const stageArgs = {
  brief: { destination: "Valencia, España" },
  briefHash: "b".repeat(64),
  itinerary,
  itineraryHash: "i".repeat(64),
  operationId: "sendero-stage:convex-test",
  protocolHash: "p".repeat(64),
  protocolVersion: "1.0.0",
  warnings: ["Base provisional"],
};

test("stages idempotently and saves one authoritative trip atomically", async () => {
  const { save, stage } = await loadModule();
  const db = createDatabase();
  const ctx = context(db);
  const first = await stage._handler(ctx, stageArgs);
  const retry = await stage._handler(ctx, stageArgs);
  assert.equal(first.draftId, retry.draftId);
  assert.equal(db.tables.itineraryDrafts.length, 1);
  assert.equal(ctx.scheduled.length, 1);

  const saved = await save._handler(ctx, {
    draftId: first.draftId,
    operationId: "sendero-save:convex-test",
  });
  assert.equal(saved.status, "saved");
  assert.equal(saved.replayed, false);
  assert.equal(saved.trip.version, 1);
  assert.match(saved.trip.webId, /^[a-f0-9]{32}$/);
  assert.equal(db.tables.trips.length, 1);
  assert.equal(db.tables.tripRevisions.length, 1);
  assert.equal(db.tables.tripWriteOperations.length, 1);
  assert.equal(db.tables.itineraryDrafts[0].snapshot, undefined);
  assert.equal(db.tables.itineraryDrafts[0].brief, undefined);

  const savedRetry = await save._handler(ctx, {
    draftId: first.draftId,
    operationId: "sendero-save:convex-test",
  });
  assert.equal(savedRetry.replayed, true);
  assert.equal(savedRetry.trip.tripId, saved.trip.tripId);
  assert.equal(db.tables.trips.length, 1);
});

test("discard and expiry remove draft content before terminal retention", async () => {
  const { discard, expire, stage } = await loadModule();
  const db = createDatabase();
  const ctx = context(db);
  const discardedDraft = await stage._handler(ctx, {
    ...stageArgs,
    operationId: "sendero-stage:discard-test",
  });
  const discarded = await discard._handler(ctx, { draftId: discardedDraft.draftId });
  assert.equal(discarded.status, "discarded");
  assert.equal(db.tables.itineraryDrafts[0].snapshot, undefined);

  const expiringDraft = await stage._handler(ctx, {
    ...stageArgs,
    operationId: "sendero-stage:expiry-test",
  });
  const row = db.tables.itineraryDrafts.find(({ _id }) => _id === expiringDraft.draftId);
  await expire._handler(ctx, { draftId: expiringDraft.draftId, expectedExpiresAt: row.expiresAt });
  assert.equal(row.status, "expired");
  assert.equal(row.snapshot, undefined);
  assert.equal(row.brief, undefined);
});
