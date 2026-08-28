import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

let publicSharesModule;

async function loadPublicShares() {
  publicSharesModule ||= build({
    entryPoints: [new URL("../convex/publicShares.ts", import.meta.url).pathname],
    bundle: true,
    format: "esm",
    logLevel: "silent",
    platform: "node",
    write: false,
  }).then(({ outputFiles }) => import(
    `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`
  ));
  return publicSharesModule;
}

function createDatabase() {
  const tables = {
    publicShareOperations: [],
    publicShares: [],
    trips: [{
      _id: "trip_1",
      ownerId: "user_owner",
      currentVersion: 1,
      snapshot: {
        title: "Buenos Aires entre barrios",
        destination: "Buenos Aires, Argentina",
        startDate: "2026-08-13",
        endDate: "2026-08-14",
        transport: { modes: ["walk"] },
        days: [],
      },
    }],
    users: [{
      _id: "user_owner",
      tokenIdentifier: "auth0|owner",
    }],
  };
  let nextId = 1;
  function recordById(id) {
    return Object.values(tables)
      .flat()
      .find((record) => record._id === id) || null;
  }
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
    query(table) {
      const filters = [];
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

function context(db) {
  return {
    auth: {
      async getUserIdentity() {
        return { tokenIdentifier: "auth0|owner" };
      },
    },
    db,
  };
}

test("persists a recoverable descriptor and recovers it for legacy rows from operation history", async () => {
  const publicShares = await loadPublicShares();
  const db = createDatabase();
  const ctx = context(db);
  const operationId = "sendero-share:publish-0001";
  const tokenHash = "A".repeat(43);
  await publicShares.publish._handler(ctx, {
    tripId: "trip_1",
    expectedVersion: 1,
    tokenHash,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    operationId,
  });

  const share = db.tables.publicShares[0];
  assert.deepEqual(share.tokenDerivation, { purpose: "publish", operationId });
  const current = await publicShares.status._handler(ctx, { tripId: "trip_1" });
  assert.equal(current.tokenHash, tokenHash);
  assert.deepEqual(current.tokenDerivation, { purpose: "publish", operationId });

  delete share.tokenDerivation;
  const legacyRecovered = await publicShares.status._handler(ctx, { tripId: "trip_1" });
  assert.equal(legacyRecovered.tokenHash, tokenHash);
  assert.deepEqual(legacyRecovered.tokenDerivation, {
    purpose: "publish",
    operationId,
  });

  db.tables.publicShareOperations[0].tokenHash = "B".repeat(43);
  const unrecoverable = await publicShares.status._handler(ctx, { tripId: "trip_1" });
  assert.equal("tokenHash" in unrecoverable, false);
  assert.equal("tokenDerivation" in unrecoverable, false);
});

test("rotation replaces the descriptor while update preserves it", async () => {
  const publicShares = await loadPublicShares();
  const db = createDatabase();
  const ctx = context(db);
  const publishOperationId = "sendero-share:publish-0002";
  await publicShares.publish._handler(ctx, {
    tripId: "trip_1",
    expectedVersion: 1,
    tokenHash: "C".repeat(43),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    operationId: publishOperationId,
  });
  const share = db.tables.publicShares[0];
  const updateOperationId = "sendero-share:update-0001";
  await publicShares.update._handler(ctx, {
    tripId: "trip_1",
    expectedVersion: 1,
    operationId: updateOperationId,
  });
  assert.deepEqual(share.tokenDerivation, {
    purpose: "publish",
    operationId: publishOperationId,
  });

  const rotateOperationId = "sendero-share:rotate-0001";
  await publicShares.rotate._handler(ctx, {
    tripId: "trip_1",
    tokenHash: "D".repeat(43),
    operationId: rotateOperationId,
  });
  assert.equal(share.tokenHash, "D".repeat(43));
  assert.deepEqual(share.tokenDerivation, {
    purpose: "rotate",
    operationId: rotateOperationId,
  });
});
