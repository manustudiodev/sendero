import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

async function loadOutboxModule() {
  const { outputFiles } = await build({
    entryPoints: [new URL("../convex/invitationEmailOutbox.ts", import.meta.url).pathname],
    bundle: true,
    format: "esm",
    logLevel: "silent",
    platform: "node",
    write: false,
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`
  );
}

function database() {
  const tables = {
    invitationEmailOutbox: [],
    tripInvitations: [{
      _id: "invitation_1",
      tripId: "trip_1",
      invitedEmail: "friend@example.com",
      role: "viewer",
      status: "pending",
      tokenHash: "a".repeat(64),
      expiresAt: Date.now() + 60_000,
      sentAt: 100,
    }],
    trips: [{
      _id: "trip_1",
      ownerId: "user_owner",
      webId: "0123456789abcdef0123456789abcdef",
      title: "Buenos Aires entre amigos",
    }],
    users: [{ _id: "user_owner", name: "Manuel" }],
  };
  let nextId = 1;
  const record = (id) => Object.values(tables).flat().find((entry) => entry._id === id) || null;
  return {
    tables,
    async get(id) { return record(id); },
    async insert(table, value) {
      const id = `${table}_${nextId++}`;
      tables[table].push({ _id: id, ...structuredClone(value) });
      return id;
    },
    async patch(id, value) {
      const target = record(id);
      if (!target) throw new Error(`Missing record ${id}`);
      Object.assign(target, structuredClone(value));
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
          const rows = await query.collect();
          if (rows.length > 1) throw new Error("Expected unique row");
          return rows[0] || null;
        },
        async collect() {
          return tables[table].filter((entry) =>
            filters.every(([field, value]) => entry[field] === value));
        },
      };
      return query;
    },
  };
}

function context(db) {
  const scheduled = [];
  return {
    db,
    scheduled,
    scheduler: {
      async runAfter(delayMs, reference, args) {
        scheduled.push({ type: "after", delayMs, reference, args });
      },
      async runAt(at, reference, args) {
        scheduled.push({ type: "at", at, reference, args });
      },
    },
  };
}

test("enqueues once per provider idempotency key without storing bearer material", async () => {
  const outbox = await loadOutboxModule();
  const db = database();
  const ctx = context(db);
  const input = {
    tripId: "trip_1",
    invitationId: "invitation_1",
    actorId: "user_owner",
    operationId: "invite-operation-123",
    purpose: "invite",
    recipientEmail: "friend@example.com",
    role: "viewer",
    tokenHash: "a".repeat(64),
    invitationSentAt: 100,
    now: 10,
  };
  const created = await outbox.enqueueInvitationEmail(ctx, input);
  const replay = await outbox.enqueueInvitationEmail(ctx, input);

  assert.equal(created._id, replay._id);
  assert.equal(db.tables.invitationEmailOutbox.length, 1);
  assert.equal(created.idempotencyKey, "invite/user_owner/trip_1/invite-operation-123");
  assert.equal("token" in created, false);
  assert.equal(created.tokenHash, "a".repeat(64));
  assert.equal(ctx.scheduled.length, 1);
  assert.equal(ctx.scheduled[0].type, "after");
});

test("reuses an exact legacy delivery when a request is retried across the key migration", async () => {
  const outbox = await loadOutboxModule();
  const db = database();
  const ctx = context(db);
  db.tables.invitationEmailOutbox.push({
    _id: "legacy_outbox_1",
    tripId: "trip_1",
    invitationId: "invitation_1",
    actorId: "user_owner",
    operationId: "legacy-operation-123",
    idempotencyKey: "invite/legacy-operation-123",
    purpose: "invite",
    recipientEmail: "friend@example.com",
    role: "viewer",
    status: "sent",
    attemptCount: 1,
    maxAttempts: 5,
    availableAt: 0,
    createdAt: 10,
    updatedAt: 20,
  });

  const replay = await outbox.enqueueInvitationEmail(ctx, {
    tripId: "trip_1",
    invitationId: "invitation_1",
    actorId: "user_owner",
    operationId: "legacy-operation-123",
    purpose: "invite",
    recipientEmail: "friend@example.com",
    role: "viewer",
    tokenHash: "a".repeat(64),
    invitationSentAt: 100,
    now: 30,
  });

  assert.equal(replay._id, "legacy_outbox_1");
  assert.equal(db.tables.invitationEmailOutbox.length, 1);
  assert.equal(replay.idempotencyKey, "invite/legacy-operation-123");
  assert.equal(replay.tokenHash, "a".repeat(64));
  assert.equal(replay.invitationSentAt, 100);
  assert.equal(ctx.scheduled.length, 0);
});

test("binds and rekeys an unattempted old-key queued delivery before claiming it", async () => {
  const outbox = await loadOutboxModule();
  const db = database();
  const ctx = context(db);
  db.tables.invitationEmailOutbox.push({
    _id: "legacy_queued_old_key",
    tripId: "trip_1",
    invitationId: "invitation_1",
    actorId: "user_owner",
    operationId: "legacy-queued-operation",
    idempotencyKey: "invite/legacy-queued-operation",
    purpose: "invite",
    recipientEmail: "friend@example.com",
    role: "viewer",
    status: "queued",
    attemptCount: 0,
    maxAttempts: 5,
    availableAt: 0,
    createdAt: 10,
    updatedAt: 10,
  });

  const rebound = await outbox.enqueueInvitationEmail(ctx, {
    tripId: "trip_1",
    invitationId: "invitation_1",
    actorId: "user_owner",
    operationId: "legacy-queued-operation",
    purpose: "invite",
    recipientEmail: "friend@example.com",
    role: "viewer",
    tokenHash: "a".repeat(64),
    invitationSentAt: 100,
    now: 30,
  });

  assert.equal(rebound._id, "legacy_queued_old_key");
  assert.equal(db.tables.invitationEmailOutbox.length, 1);
  assert.equal(
    rebound.idempotencyKey,
    "invite/user_owner/trip_1/legacy-queued-operation",
  );
  assert.equal(rebound.tokenHash, "a".repeat(64));
  assert.equal(rebound.invitationSentAt, 100);
  assert.deepEqual(
    ctx.scheduled.map(({ type, delayMs }) => ({ type, delayMs })),
    [{ type: "after", delayMs: 0 }],
  );

  const claimed = await outbox.claim._handler(ctx, {
    outboxId: rebound._id,
    workerId: "worker:legacy-old-key",
  });
  assert.equal(claimed.needsGenerationBinding, undefined);
  assert.equal(claimed.attemptCount, 1);
  assert.equal(db.tables.invitationEmailOutbox[0].status, "processing");
});

test("binds an unattempted scoped-key queued delivery before claiming it", async () => {
  const outbox = await loadOutboxModule();
  const db = database();
  const ctx = context(db);
  const scopedKey = "invite/user_owner/trip_1/scoped-queued-operation";
  db.tables.invitationEmailOutbox.push({
    _id: "legacy_queued_scoped_key",
    tripId: "trip_1",
    invitationId: "invitation_1",
    actorId: "user_owner",
    operationId: "scoped-queued-operation",
    idempotencyKey: scopedKey,
    purpose: "invite",
    recipientEmail: "friend@example.com",
    role: "viewer",
    status: "queued",
    attemptCount: 0,
    maxAttempts: 5,
    availableAt: 0,
    createdAt: 10,
    updatedAt: 10,
  });

  const rebound = await outbox.enqueueInvitationEmail(ctx, {
    tripId: "trip_1",
    invitationId: "invitation_1",
    actorId: "user_owner",
    operationId: "scoped-queued-operation",
    purpose: "invite",
    recipientEmail: "friend@example.com",
    role: "viewer",
    tokenHash: "a".repeat(64),
    invitationSentAt: 100,
    now: 30,
  });

  assert.equal(rebound._id, "legacy_queued_scoped_key");
  assert.equal(rebound.idempotencyKey, scopedKey);
  assert.equal(rebound.tokenHash, "a".repeat(64));
  assert.equal(rebound.invitationSentAt, 100);
  assert.equal(ctx.scheduled.length, 1);

  const claimed = await outbox.claim._handler(ctx, {
    outboxId: rebound._id,
    workerId: "worker:legacy-scoped-key",
  });
  assert.equal(claimed.needsGenerationBinding, undefined);
  assert.equal(claimed.attemptCount, 1);
});

test("binds an attempted retry without changing its provider key or backoff", async () => {
  const outbox = await loadOutboxModule();
  const db = database();
  const ctx = context(db);
  const availableAt = Date.now() + 60_000;
  const legacyKey = "invite/legacy-retry-operation";
  db.tables.invitationEmailOutbox.push({
    _id: "legacy_retry_old_key",
    tripId: "trip_1",
    invitationId: "invitation_1",
    actorId: "user_owner",
    operationId: "legacy-retry-operation",
    idempotencyKey: legacyKey,
    purpose: "invite",
    recipientEmail: "friend@example.com",
    role: "viewer",
    status: "retry_scheduled",
    attemptCount: 1,
    maxAttempts: 5,
    availableAt,
    createdAt: 10,
    updatedAt: 20,
  });

  const rebound = await outbox.enqueueInvitationEmail(ctx, {
    tripId: "trip_1",
    invitationId: "invitation_1",
    actorId: "user_owner",
    operationId: "legacy-retry-operation",
    purpose: "invite",
    recipientEmail: "friend@example.com",
    role: "viewer",
    tokenHash: "a".repeat(64),
    invitationSentAt: 100,
    now: 30,
  });

  assert.equal(rebound.idempotencyKey, legacyKey);
  assert.equal(rebound.status, "retry_scheduled");
  assert.equal(rebound.attemptCount, 1);
  assert.equal(rebound.availableAt, availableAt);
  assert.deepEqual(
    ctx.scheduled.map(({ type, at }) => ({ type, at })),
    [{ type: "at", at: availableAt }],
  );
  assert.equal(
    await outbox.claim._handler(ctx, {
      outboxId: rebound._id,
      workerId: "worker:retry-too-early",
    }),
    null,
  );

  db.tables.invitationEmailOutbox[0].availableAt = 0;
  const claimed = await outbox.claim._handler(ctx, {
    outboxId: rebound._id,
    workerId: "worker:retry-due",
  });
  assert.equal(claimed.idempotencyKey, legacyKey);
  assert.equal(claimed.attemptCount, 2);
});

test("fails safely when multiple legacy deliveries match the same operation", async () => {
  const outbox = await loadOutboxModule();
  const db = database();
  const ctx = context(db);
  const common = {
    tripId: "trip_1",
    invitationId: "invitation_1",
    actorId: "user_owner",
    operationId: "duplicate-legacy-operation",
    purpose: "invite",
    recipientEmail: "friend@example.com",
    role: "viewer",
    status: "queued",
    attemptCount: 0,
    maxAttempts: 5,
    availableAt: 0,
    createdAt: 10,
    updatedAt: 10,
  };
  db.tables.invitationEmailOutbox.push(
    {
      _id: "duplicate_legacy_1",
      ...common,
      idempotencyKey: "invite/duplicate-legacy-operation",
    },
    {
      _id: "duplicate_legacy_2",
      ...common,
      idempotencyKey: "invite/duplicate-legacy-operation-copy",
    },
  );

  await assert.rejects(
    outbox.enqueueInvitationEmail(ctx, {
      tripId: "trip_1",
      invitationId: "invitation_1",
      actorId: "user_owner",
      operationId: "duplicate-legacy-operation",
      purpose: "invite",
      recipientEmail: "friend@example.com",
      role: "viewer",
      tokenHash: "a".repeat(64),
      invitationSentAt: 100,
      now: 30,
    }),
    /Multiple invitation delivery jobs match this legacy operation/,
  );
  assert.equal(db.tables.invitationEmailOutbox.length, 2);
  assert.equal(db.tables.invitationEmailOutbox.every((job) => job.tokenHash === undefined), true);
  assert.equal(ctx.scheduled.length, 0);
});

test("claim fails every active duplicate before either legacy delivery is leased", async () => {
  const outbox = await loadOutboxModule();
  const db = database();
  const ctx = context(db);
  const common = {
    tripId: "trip_1",
    invitationId: "invitation_1",
    actorId: "user_owner",
    operationId: "duplicate-dispatch-operation",
    purpose: "invite",
    recipientEmail: "friend@example.com",
    role: "viewer",
    maxAttempts: 5,
    createdAt: 10,
    updatedAt: 10,
  };
  db.tables.invitationEmailOutbox.push(
    {
      _id: "duplicate_dispatch_queued",
      ...common,
      idempotencyKey: "invite/duplicate-dispatch-operation",
      status: "queued",
      attemptCount: 0,
      availableAt: 0,
    },
    {
      _id: "duplicate_dispatch_retry",
      ...common,
      idempotencyKey: "invite/user_owner/trip_1/duplicate-dispatch-operation",
      status: "retry_scheduled",
      attemptCount: 1,
      availableAt: 0,
    },
  );

  assert.equal(
    await outbox.claim._handler(ctx, {
      outboxId: "duplicate_dispatch_queued",
      workerId: "worker:duplicate-queued",
    }),
    null,
  );
  assert.deepEqual(
    db.tables.invitationEmailOutbox.map((job) => ({
      id: job._id,
      status: job.status,
      error: job.lastErrorCode,
      attempts: job.attemptCount,
    })),
    [
      {
        id: "duplicate_dispatch_queued",
        status: "failed",
        error: "duplicate_legacy_delivery",
        attempts: 0,
      },
      {
        id: "duplicate_dispatch_retry",
        status: "failed",
        error: "duplicate_legacy_delivery",
        attempts: 1,
      },
    ],
  );
  assert.equal(
    await outbox.claim._handler(ctx, {
      outboxId: "duplicate_dispatch_retry",
      workerId: "worker:duplicate-retry",
    }),
    null,
  );
});

test("claim requests legacy generation binding and a valid binding then permits claim", async () => {
  const outbox = await loadOutboxModule();
  const db = database();
  const ctx = context(db);
  db.tables.invitationEmailOutbox.push({
    _id: "lazy_bind_legacy",
    tripId: "trip_1",
    invitationId: "invitation_1",
    actorId: "user_owner",
    operationId: "lazy-bind-operation",
    idempotencyKey: "invite/lazy-bind-operation",
    purpose: "invite",
    recipientEmail: "friend@example.com",
    role: "viewer",
    status: "queued",
    attemptCount: 0,
    maxAttempts: 5,
    availableAt: 0,
    createdAt: 10,
    updatedAt: 10,
  });

  const needsBinding = await outbox.claim._handler(ctx, {
    outboxId: "lazy_bind_legacy",
    workerId: "worker:lazy-probe",
  });
  assert.equal(needsBinding.needsGenerationBinding, true);
  assert.equal(needsBinding.invitationTokenHash, "a".repeat(64));
  assert.equal(needsBinding.invitationSentAt, 100);
  assert.equal(db.tables.invitationEmailOutbox[0].attemptCount, 0);
  assert.equal(db.tables.invitationEmailOutbox[0].status, "queued");

  assert.deepEqual(
    await outbox.bindLegacyGeneration._handler(ctx, {
      outboxId: "lazy_bind_legacy",
      derivedTokenHash: "a".repeat(64),
    }),
    { status: "bound" },
  );
  assert.equal(
    db.tables.invitationEmailOutbox[0].idempotencyKey,
    "invite/user_owner/trip_1/lazy-bind-operation",
  );

  const claimed = await outbox.claim._handler(ctx, {
    outboxId: "lazy_bind_legacy",
    workerId: "worker:lazy-claim",
  });
  assert.equal(claimed.needsGenerationBinding, undefined);
  assert.equal(claimed.attemptCount, 1);
  assert.equal(claimed.tokenHash, "a".repeat(64));
  assert.equal(claimed.invitationSentAt, 100);
});

test("rejects an incorrect derived hash without leasing or claiming the legacy job", async () => {
  const outbox = await loadOutboxModule();
  const db = database();
  const ctx = context(db);
  db.tables.invitationEmailOutbox.push({
    _id: "lazy_bind_wrong_hash",
    tripId: "trip_1",
    invitationId: "invitation_1",
    actorId: "user_owner",
    operationId: "lazy-bind-wrong-hash",
    idempotencyKey: "invite/lazy-bind-wrong-hash",
    purpose: "invite",
    recipientEmail: "friend@example.com",
    role: "viewer",
    status: "queued",
    attemptCount: 0,
    maxAttempts: 5,
    availableAt: 0,
    createdAt: 10,
    updatedAt: 10,
  });

  const needsBinding = await outbox.claim._handler(ctx, {
    outboxId: "lazy_bind_wrong_hash",
    workerId: "worker:wrong-probe",
  });
  assert.equal(needsBinding.needsGenerationBinding, true);
  assert.deepEqual(
    await outbox.bindLegacyGeneration._handler(ctx, {
      outboxId: "lazy_bind_wrong_hash",
      derivedTokenHash: "b".repeat(64),
    }),
    { status: "failed" },
  );
  assert.equal(db.tables.invitationEmailOutbox[0].status, "failed");
  assert.equal(db.tables.invitationEmailOutbox[0].lastErrorCode, "invitation_superseded");
  assert.equal(db.tables.invitationEmailOutbox[0].attemptCount, 0);
  assert.equal(db.tables.invitationEmailOutbox[0].leaseOwner, undefined);
  assert.equal(
    await outbox.claim._handler(ctx, {
      outboxId: "lazy_bind_wrong_hash",
      workerId: "worker:wrong-claim",
    }),
    null,
  );
});

test("a delayed binding failure cannot overwrite a job another worker already bound and leased", async () => {
  const outbox = await loadOutboxModule();
  const db = database();
  const ctx = context(db);
  db.tables.invitationEmailOutbox.push({
    _id: "lazy_bind_race",
    tripId: "trip_1",
    invitationId: "invitation_1",
    actorId: "user_owner",
    operationId: "lazy-bind-race",
    idempotencyKey: "invite/lazy-bind-race",
    purpose: "invite",
    recipientEmail: "friend@example.com",
    role: "viewer",
    status: "queued",
    attemptCount: 0,
    maxAttempts: 5,
    availableAt: 0,
    createdAt: 10,
    updatedAt: 10,
  });

  const probe = await outbox.claim._handler(ctx, {
    outboxId: "lazy_bind_race",
    workerId: "worker:race-probe",
  });
  assert.equal(probe.needsGenerationBinding, true);
  assert.deepEqual(
    await outbox.bindLegacyGeneration._handler(ctx, {
      outboxId: "lazy_bind_race",
      derivedTokenHash: "a".repeat(64),
    }),
    { status: "bound" },
  );
  const claimed = await outbox.claim._handler(ctx, {
    outboxId: "lazy_bind_race",
    workerId: "worker:race-winner",
  });
  assert.equal(claimed.attemptCount, 1);

  assert.deepEqual(
    await outbox.recordLegacyBindingFailure._handler(ctx, {
      outboxId: "lazy_bind_race",
      errorCode: "sendero_email_config_invalid",
      notConfigured: true,
      expectedTokenHash: probe.invitationTokenHash,
      expectedInvitationSentAt: probe.invitationSentAt,
    }),
    { status: "superseded" },
  );
  assert.equal(db.tables.invitationEmailOutbox[0].status, "processing");
  assert.equal(db.tables.invitationEmailOutbox[0].leaseOwner, "worker:race-winner");
  assert.equal(db.tables.invitationEmailOutbox[0].lastErrorCode, undefined);
});

test("claims with a lease, retries with backoff, and completes idempotently", async () => {
  const outbox = await loadOutboxModule();
  const db = database();
  const ctx = context(db);
  const created = await outbox.enqueueInvitationEmail(ctx, {
    tripId: "trip_1",
    invitationId: "invitation_1",
    actorId: "user_owner",
    operationId: "invite-operation-456",
    purpose: "invite",
    recipientEmail: "friend@example.com",
    role: "viewer",
    tokenHash: "a".repeat(64),
    invitationSentAt: 100,
    now: 0,
  });

  const first = await outbox.claim._handler(ctx, {
    outboxId: created._id,
    workerId: "worker:first",
  });
  assert.equal(first.attemptCount, 1);
  assert.equal(first.webId, "0123456789abcdef0123456789abcdef");
  assert.equal(db.tables.invitationEmailOutbox[0].status, "processing");

  const busy = await outbox.claim._handler(ctx, {
    outboxId: created._id,
    workerId: "worker:other",
  });
  assert.equal(busy, null);

  const retry = await outbox.recordFailure._handler(ctx, {
    outboxId: created._id,
    workerId: "worker:first",
    errorCode: "provider_http_429",
    retryable: true,
    retryAfterMs: 45_000,
  });
  assert.equal(retry.status, "retry_scheduled");
  assert.ok(retry.availableAt > Date.now());
  assert.equal(db.tables.invitationEmailOutbox[0].lastErrorCode, "provider_http_429");

  db.tables.invitationEmailOutbox[0].availableAt = 0;
  const second = await outbox.claim._handler(ctx, {
    outboxId: created._id,
    workerId: "worker:second",
  });
  assert.equal(second.attemptCount, 2);
  const completed = await outbox.complete._handler(ctx, {
    outboxId: created._id,
    workerId: "worker:second",
    provider: "resend",
    providerMessageId: "email_123",
  });
  assert.equal(completed.status, "sent");
  assert.equal(db.tables.invitationEmailOutbox[0].providerEvent, "accepted");
  assert.equal(db.tables.invitationEmailOutbox[0].deliveredAt, undefined);
  assert.equal(
    (await outbox.complete._handler(ctx, {
      outboxId: created._id,
      workerId: "worker:second",
      provider: "resend",
      providerMessageId: "email_123",
    })).replayed,
    true,
  );
});

test("rejects a queued job after its invitation generation or role is superseded", async () => {
  const outbox = await loadOutboxModule();
  const db = database();
  const ctx = context(db);
  const created = await outbox.enqueueInvitationEmail(ctx, {
    tripId: "trip_1",
    invitationId: "invitation_1",
    actorId: "user_owner",
    operationId: "invite-operation-old",
    purpose: "invite",
    recipientEmail: "friend@example.com",
    role: "viewer",
    tokenHash: "a".repeat(64),
    invitationSentAt: 100,
    now: 0,
  });

  Object.assign(db.tables.tripInvitations[0], {
    role: "editor",
    tokenHash: "b".repeat(64),
    sentAt: 200,
  });
  const stale = await outbox.claim._handler(ctx, {
    outboxId: created._id,
    workerId: "worker:stale",
  });
  assert.equal(stale, null);
  assert.equal(db.tables.invitationEmailOutbox[0].status, "failed");
  assert.equal(db.tables.invitationEmailOutbox[0].lastErrorCode, "invitation_superseded");
  assert.equal(db.tables.invitationEmailOutbox[0].attemptCount, 0);

  const current = await outbox.enqueueInvitationEmail(ctx, {
    tripId: "trip_1",
    invitationId: "invitation_1",
    actorId: "user_owner",
    operationId: "resend-operation-new",
    purpose: "resend",
    recipientEmail: "friend@example.com",
    role: "editor",
    tokenHash: "b".repeat(64),
    invitationSentAt: 200,
    now: 0,
  });
  assert.equal(
    (await outbox.claim._handler(ctx, {
      outboxId: current._id,
      workerId: "worker:current",
    })).role,
    "editor",
  );
});

test("scopes provider idempotency keys by actor and trip", async () => {
  const outbox = await loadOutboxModule();
  const db = database();
  const ctx = context(db);
  db.tables.tripInvitations.push({
    _id: "invitation_2",
    tripId: "trip_2",
    invitedEmail: "friend@example.com",
    role: "viewer",
    status: "pending",
    tokenHash: "a".repeat(64),
    expiresAt: Date.now() + 60_000,
    sentAt: 100,
  });
  const common = {
    operationId: "shared-operation-123",
    purpose: "invite",
    recipientEmail: "friend@example.com",
    role: "viewer",
    tokenHash: "a".repeat(64),
    invitationSentAt: 100,
    now: 0,
  };
  const first = await outbox.enqueueInvitationEmail(ctx, {
    ...common,
    tripId: "trip_1",
    invitationId: "invitation_1",
    actorId: "user_owner",
  });
  const second = await outbox.enqueueInvitationEmail(ctx, {
    ...common,
    tripId: "trip_2",
    invitationId: "invitation_2",
    actorId: "user_other",
  });
  assert.notEqual(first.idempotencyKey, second.idempotencyKey);
  assert.equal(db.tables.invitationEmailOutbox.length, 2);
});

test("records normalized webhook events in chronological order", async () => {
  const outbox = await loadOutboxModule();
  const db = database();
  const ctx = context(db);
  db.tables.invitationEmailOutbox.push({
    _id: "outbox_1",
    provider: "resend",
    providerMessageId: "email_123",
    providerEvent: "accepted",
    providerEventAt: 10,
    updatedAt: 10,
  });
  const delivered = await outbox.recordProviderEvent._handler(ctx, {
    provider: "resend",
    providerMessageId: "email_123",
    event: "delivered",
    occurredAt: 20,
  });
  const stale = await outbox.recordProviderEvent._handler(ctx, {
    provider: "resend",
    providerMessageId: "email_123",
    event: "bounced",
    occurredAt: 15,
  });
  const equalLowerPriority = await outbox.recordProviderEvent._handler(ctx, {
    provider: "resend",
    providerMessageId: "email_123",
    event: "delayed",
    occurredAt: 20,
  });
  const newer = await outbox.recordProviderEvent._handler(ctx, {
    provider: "resend",
    providerMessageId: "email_123",
    event: "delayed",
    occurredAt: 30,
  });
  const replay = await outbox.recordProviderEvent._handler(ctx, {
    provider: "resend",
    providerMessageId: "email_123",
    event: "delayed",
    occurredAt: 30,
  });
  assert.deepEqual(delivered, { matched: true, changed: true });
  assert.deepEqual(stale, { matched: true, changed: false });
  assert.deepEqual(equalLowerPriority, { matched: true, changed: false });
  assert.deepEqual(newer, { matched: true, changed: true });
  assert.deepEqual(replay, { matched: true, changed: false });
  assert.equal(db.tables.invitationEmailOutbox[0].providerEvent, "delayed");
  assert.equal(db.tables.invitationEmailOutbox[0].providerEventAt, 30);
  assert.equal(db.tables.invitationEmailOutbox[0].deliveredAt, 20);
});
