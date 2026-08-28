import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const modulePromises = new Map();

function loadConvexModule(relativePath) {
  if (!modulePromises.has(relativePath)) {
    modulePromises.set(
      relativePath,
      build({
        entryPoints: [new URL(relativePath, import.meta.url).pathname],
        bundle: true,
        format: "esm",
        logLevel: "silent",
        platform: "node",
        write: false,
      }).then(({ outputFiles }) =>
        import(
          `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`
        ),
      ),
    );
  }
  return modulePromises.get(relativePath);
}

function createDatabase() {
  const tables = {
    collaborators: [],
    invitationEmailOutbox: [],
    reservationOperations: [],
    tripAccessAuditEvents: [],
    tripAccessOperations: [],
    tripInvitations: [],
    tripWriteOperations: [],
    tripRevisions: [],
    trips: [
      {
        _id: "trip_1",
        ownerId: "user_owner",
        webId: "0123456789abcdef0123456789abcdef",
        title: "Friends in Buenos Aires",
        destination: "Buenos Aires, Argentina",
        startDate: "2026-08-13",
        endDate: "2026-08-26",
        currentVersion: 1,
        status: "active",
        snapshot: {
          title: "Friends in Buenos Aires",
          destination: "Buenos Aires, Argentina",
          startDate: "2026-08-13",
          endDate: "2026-08-26",
          days: [],
        },
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    users: [
      {
        _id: "user_owner",
        tokenIdentifier: "auth0|owner",
        email: "owner@example.com",
        emailVerified: true,
        name: "Owner",
        createdAt: 1,
        updatedAt: 1,
      },
      {
        _id: "user_invitee",
        tokenIdentifier: "auth0|invitee",
        email: "friend@example.com",
        emailVerified: true,
        name: "Friend",
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

function identity(tokenIdentifier, email, emailVerified = true, name = "Traveler") {
  return { tokenIdentifier, email, email_verified: emailVerified, name };
}

function createContext(db, initialIdentity) {
  let currentIdentity = initialIdentity;
  const scheduled = [];
  return {
    ctx: {
      auth: {
        async getUserIdentity() {
          return currentIdentity;
        },
      },
      db,
      scheduler: {
        async runAfter(delayMs, reference, args) {
          scheduled.push({ type: "after", delayMs, reference, args });
        },
        async runAt(at, reference, args) {
          scheduled.push({ type: "at", at, reference, args });
        },
      },
    },
    scheduled,
    setIdentity(nextIdentity) {
      currentIdentity = nextIdentity;
    },
  };
}

test("inviting is pending and idempotent until the verified recipient explicitly accepts", async () => {
  const invitations = await loadConvexModule("../convex/tripInvitations.ts");
  const trips = await loadConvexModule("../convex/trips.ts");
  const db = createDatabase();
  const session = createContext(
    db,
    identity("auth0|owner", "owner@example.com", true, "Owner"),
  );
  const tokenHash = "a".repeat(64);
  await assert.rejects(
    invitations.invite._handler(session.ctx, {
      tripId: "trip_1",
      email: "friend@example.com",
      role: "viewer",
      operationId: "invite-without-token-0001",
    }),
    /token hash is required/,
  );
  assert.equal(db.tables.tripInvitations.length, 0);
  assert.equal(db.tables.invitationEmailOutbox.length, 0);
  const request = {
    tripId: "trip_1",
    email: "  Friend@Example.COM ",
    role: "viewer",
    tokenHash,
    operationId: "invite-friend-0001",
  };

  const created = await invitations.invite._handler(session.ctx, request);
  assert.equal(created.status, "pending");
  assert.equal(created.delivery.status, "queued");
  assert.equal(created.collaboratorId, undefined);
  assert.equal(db.tables.tripInvitations.length, 1);
  assert.equal(db.tables.tripInvitations[0].invitedEmail, "friend@example.com");
  assert.equal(db.tables.tripInvitations[0].status, "pending");
  assert.equal(db.tables.collaborators.length, 0);

  const replay = await invitations.invite._handler(session.ctx, request);
  assert.equal(replay.replayed, true);
  assert.equal(db.tables.tripInvitations.length, 1);
  assert.equal(db.tables.tripAccessOperations.length, 1);

  await assert.rejects(
    invitations.invite._handler(session.ctx, { ...request, role: "editor" }),
    /already used for a different request/,
  );

  session.setIdentity(identity("auth0|invitee", "friend@example.com", true, "Friend"));
  const bootstrapped = await trips.bootstrapSession._handler(session.ctx, {});
  assert.equal(bootstrapped.emailVerified, true);
  assert.equal(db.tables.tripInvitations[0].status, "pending");
  assert.equal(db.tables.collaborators.length, 0);

  const mine = await invitations.listMine._handler(session.ctx, {});
  assert.equal(mine.length, 1);
  assert.equal(mine[0].status, "pending");
  assert.deepEqual(mine[0].trip, {
    webId: "0123456789abcdef0123456789abcdef",
    title: "Friends in Buenos Aires",
    destination: "Buenos Aires, Argentina",
    startDate: "2026-08-13",
    endDate: "2026-08-26",
  });
  assert.equal("tokenHash" in mine[0], false);

  await assert.rejects(
    invitations.accept._handler(session.ctx, {
      invitationId: created.invitationId,
      tokenHash: "b".repeat(64),
      operationId: "accept-friend-0001",
    }),
    /token is invalid/,
  );

  const accepted = await invitations.accept._handler(session.ctx, {
    invitationId: created.invitationId,
    tokenHash,
    operationId: "accept-friend-0001",
  });
  assert.equal(accepted.status, "accepted");
  assert.equal(db.tables.tripInvitations[0].acceptedBy, "user_invitee");
  assert.equal(db.tables.tripInvitations[0].tokenHash, undefined);
  assert.equal(db.tables.collaborators.length, 1);
  assert.deepEqual(
    {
      tripId: db.tables.collaborators[0].tripId,
      userId: db.tables.collaborators[0].userId,
      role: db.tables.collaborators[0].role,
      status: db.tables.collaborators[0].status,
    },
    { tripId: "trip_1", userId: "user_invitee", role: "viewer", status: "accepted" },
  );

  const acceptedReplay = await invitations.accept._handler(session.ctx, {
    invitationId: created.invitationId,
    tokenHash,
    operationId: "accept-friend-0001",
  });
  assert.equal(acceptedReplay.replayed, true);
  assert.equal(db.tables.collaborators.length, 1);

  const publicCtx = { auth: { async getUserIdentity() { return null; } }, db };
  assert.deepEqual(
    await invitations.inspect._handler(publicCtx, {
      webId: db.tables.trips[0].webId,
      tokenHash,
    }),
    { state: "unavailable" },
  );
  await assert.rejects(
    invitations.accept._handler(session.ctx, {
      invitationId: created.invitationId,
      tokenHash,
      operationId: "accept-friend-0002",
    }),
    /token is invalid/,
  );

  const opened = await trips.get._handler(session.ctx, { tripId: "trip_1" });
  assert.equal(opened.role, "viewer");
});

test("email linkage requires a live verified-email claim and exact normalized recipient", async () => {
  const { invite, accept } = await loadConvexModule("../convex/tripInvitations.ts");
  const db = createDatabase();
  const session = createContext(
    db,
    identity("auth0|owner", "owner@example.com", true, "Owner"),
  );
  const created = await invite._handler(session.ctx, {
    tripId: "trip_1",
    email: "friend@example.com",
    role: "editor",
    tokenHash: "b".repeat(64),
    operationId: "invite-verified-0001",
  });

  session.setIdentity(identity("auth0|invitee", "friend@example.com", false, "Friend"));
  await assert.rejects(
    accept._handler(session.ctx, {
      invitationId: created.invitationId,
      tokenHash: "b".repeat(64),
      operationId: "accept-unverified-0001",
    }),
    /verified email is required/,
  );
  assert.equal(db.tables.collaborators.length, 0);
  assert.equal(db.tables.tripInvitations[0].status, "pending");

  session.setIdentity(identity("auth0|invitee", "other@example.com", true, "Friend"));
  await assert.rejects(
    accept._handler(session.ctx, {
      invitationId: created.invitationId,
      tokenHash: "b".repeat(64),
      operationId: "accept-wrong-email-0001",
    }),
    /Invitation not found for this verified email/,
  );
  assert.equal(db.tables.collaborators.length, 0);
});

test("owners explicitly migrate legacy pending invitations without implicit email access", async () => {
  const invitations = await loadConvexModule("../convex/tripInvitations.ts");
  const trips = await loadConvexModule("../convex/trips.ts");
  const db = createDatabase();
  db.tables.collaborators.push({
    _id: "collaborator_legacy_pending",
    tripId: "trip_1",
    invitedEmail: " Friend@Example.COM ",
    role: "viewer",
    status: "pending",
    createdAt: 2,
    updatedAt: 2,
  });
  const session = createContext(
    db,
    identity("auth0|invitee", "friend@example.com", true, "Friend"),
  );

  // Provisioning or merely matching the historical email never grants access.
  await trips.bootstrapSession._handler(session.ctx, {});
  assert.equal(db.tables.collaborators[0].status, "pending");
  await assert.rejects(
    trips.get._handler(session.ctx, { tripId: "trip_1" }),
    /Trip access denied/,
  );
  await assert.rejects(
    invitations.migrateLegacyInvitation._handler(session.ctx, {
      tripId: "trip_1",
      collaboratorId: "collaborator_legacy_pending",
      tokenHash: "l".repeat(64),
      operationId: "migrate-legacy-0001",
    }),
    /Owner access required/,
  );

  session.setIdentity(identity("auth0|owner", "owner@example.com", true, "Owner"));
  const before = await invitations.listAccess._handler(session.ctx, { tripId: "trip_1" });
  assert.deepEqual(before.collaborators, []);
  assert.deepEqual(before.invitations, []);
  assert.deepEqual(before.legacyInvitations, [{
    id: "collaborator_legacy_pending",
    email: "friend@example.com",
    role: "viewer",
    status: "legacy_pending",
    createdAt: 2,
    updatedAt: 2,
  }]);

  const migrationRequest = {
    tripId: "trip_1",
    collaboratorId: "collaborator_legacy_pending",
    tokenHash: "l".repeat(64),
    operationId: "migrate-legacy-0001",
  };
  const migrated = await invitations.migrateLegacyInvitation._handler(
    session.ctx,
    migrationRequest,
  );
  assert.equal(migrated.status, "pending");
  assert.equal(migrated.delivery.status, "queued");
  assert.equal(db.tables.collaborators[0].status, "revoked");
  assert.equal(db.tables.tripInvitations.length, 1);
  assert.equal(
    db.tables.tripInvitations[0].legacyCollaboratorId,
    "collaborator_legacy_pending",
  );
  assert.equal(db.tables.tripInvitations[0].tokenHash, "l".repeat(64));
  assert.equal(db.tables.invitationEmailOutbox.length, 1);
  assert.equal(
    db.tables.tripAccessAuditEvents.some(
      (entry) => entry.action === "legacy_invitation_migrated",
    ),
    true,
  );

  const replay = await invitations.migrateLegacyInvitation._handler(
    session.ctx,
    migrationRequest,
  );
  assert.equal(replay.replayed, true);
  assert.equal(db.tables.tripInvitations.length, 1);
  assert.equal(db.tables.invitationEmailOutbox.length, 1);
  assert.equal(db.tables.tripAccessOperations.length, 1);
  assert.deepEqual(
    await invitations.getLegacyInvitationForMigration._handler(session.ctx, {
      tripId: "trip_1",
      collaboratorId: "collaborator_legacy_pending",
    }),
    {
      id: "collaborator_legacy_pending",
      email: "friend@example.com",
      role: "viewer",
      status: "migrated",
    },
  );

  const after = await invitations.listAccess._handler(session.ctx, { tripId: "trip_1" });
  assert.deepEqual(after.legacyInvitations, []);
  assert.equal(after.invitations.length, 1);
  assert.deepEqual(after.collaborators, []);

  session.setIdentity(identity("auth0|invitee", "friend@example.com", false, "Friend"));
  await assert.rejects(
    invitations.accept._handler(session.ctx, {
      invitationId: migrated.invitationId,
      tokenHash: "l".repeat(64),
      operationId: "accept-migrated-0001",
    }),
    /verified email is required/,
  );
  session.setIdentity(identity("auth0|invitee", "friend@example.com", true, "Friend"));
  await assert.rejects(
    invitations.accept._handler(session.ctx, {
      invitationId: migrated.invitationId,
      operationId: "accept-migrated-0001",
    }),
    /token is invalid/,
  );
  const accepted = await invitations.accept._handler(session.ctx, {
    invitationId: migrated.invitationId,
    tokenHash: "l".repeat(64),
    operationId: "accept-migrated-0001",
  });
  assert.equal(accepted.status, "accepted");
  assert.equal(
    db.tables.collaborators.some(
      (entry) =>
        entry.userId === "user_invitee" &&
        entry.role === "viewer" &&
        entry.status === "accepted",
    ),
    true,
  );
  assert.equal((await trips.get._handler(session.ctx, { tripId: "trip_1" })).role, "viewer");
});

test("removing a migrated legacy invitation revokes acceptance and its queued delivery", async () => {
  const invitations = await loadConvexModule("../convex/tripInvitations.ts");
  const outbox = await loadConvexModule("../convex/invitationEmailOutbox.ts");
  const db = createDatabase();
  db.tables.collaborators.push({
    _id: "collaborator_legacy_migrated_remove",
    tripId: "trip_1",
    invitedEmail: "friend@example.com",
    role: "viewer",
    status: "pending",
    createdAt: 3,
    updatedAt: 3,
  });
  const session = createContext(
    db,
    identity("auth0|owner", "owner@example.com", true, "Owner"),
  );
  const tokenHash = "r".repeat(64);
  const migrated = await invitations.migrateLegacyInvitation._handler(session.ctx, {
    tripId: "trip_1",
    collaboratorId: "collaborator_legacy_migrated_remove",
    tokenHash,
    operationId: "migrate-legacy-remove-0001",
  });

  const removalRequest = {
    tripId: "trip_1",
    collaboratorId: "collaborator_legacy_migrated_remove",
    operationId: "remove-migrated-legacy-0001",
  };
  const removed = await invitations.removeCollaborator._handler(
    session.ctx,
    removalRequest,
  );
  assert.equal(removed.status, "removed");
  assert.equal(removed.changed, true);
  assert.equal(db.tables.collaborators[0].status, "revoked");
  assert.equal(db.tables.tripInvitations[0].status, "revoked");

  const removalReplay = await invitations.removeCollaborator._handler(
    session.ctx,
    removalRequest,
  );
  assert.equal(removalReplay.replayed, true);
  assert.equal(db.tables.tripAccessOperations.length, 2);

  session.setIdentity(identity("auth0|invitee", "friend@example.com", true, "Friend"));
  await assert.rejects(
    invitations.accept._handler(session.ctx, {
      invitationId: migrated.invitationId,
      tokenHash,
      operationId: "accept-removed-migration-0001",
    }),
    /Invitation is revoked/,
  );
  assert.equal(
    db.tables.collaborators.some(
      (entry) => entry.userId === "user_invitee" && entry.status === "accepted",
    ),
    false,
  );

  const claimed = await outbox.claim._handler(session.ctx, {
    outboxId: migrated.delivery.outboxId,
    workerId: "worker:removed-migration",
  });
  assert.equal(claimed, null);
  assert.equal(db.tables.invitationEmailOutbox[0].status, "failed");
  assert.equal(
    db.tables.invitationEmailOutbox[0].lastErrorCode,
    "invitation_not_pending",
  );
  assert.equal(db.tables.invitationEmailOutbox[0].attemptCount, 0);
});

test("owners can revoke a legacy pending invitation without creating modern access", async () => {
  const invitations = await loadConvexModule("../convex/tripInvitations.ts");
  const db = createDatabase();
  db.tables.collaborators.push({
    _id: "collaborator_legacy_revoke",
    tripId: "trip_1",
    invitedEmail: "old-invite@example.com",
    role: "editor",
    status: "pending",
    createdAt: 3,
    updatedAt: 3,
  });
  const session = createContext(
    db,
    identity("auth0|owner", "owner@example.com", true, "Owner"),
  );
  const request = {
    tripId: "trip_1",
    collaboratorId: "collaborator_legacy_revoke",
    operationId: "remove-legacy-0001",
  };
  session.setIdentity(identity("auth0|invitee", "friend@example.com", true, "Friend"));
  await assert.rejects(
    invitations.removeCollaborator._handler(session.ctx, request),
    /Owner access required/,
  );
  session.setIdentity(identity("auth0|owner", "owner@example.com", true, "Owner"));
  const removed = await invitations.removeCollaborator._handler(session.ctx, request);
  assert.equal(removed.status, "removed");
  assert.equal(removed.changed, true);
  assert.equal(db.tables.collaborators[0].status, "revoked");
  assert.equal(db.tables.tripInvitations.length, 0);
  assert.deepEqual(
    (await invitations.listAccess._handler(session.ctx, { tripId: "trip_1" }))
      .legacyInvitations,
    [],
  );
  const replay = await invitations.removeCollaborator._handler(session.ctx, request);
  assert.equal(replay.replayed, true);
  assert.equal(db.tables.tripAccessOperations.length, 1);
});

test("only the authoritative owner manages roles and removal revokes access", async () => {
  const invitations = await loadConvexModule("../convex/tripInvitations.ts");
  const trips = await loadConvexModule("../convex/trips.ts");
  const db = createDatabase();
  const session = createContext(
    db,
    identity("auth0|owner", "owner@example.com", true, "Owner"),
  );
  const created = await invitations.invite._handler(session.ctx, {
    tripId: "trip_1",
    email: "friend@example.com",
    role: "viewer",
    tokenHash: "c".repeat(64),
    operationId: "invite-role-0001",
  });
  session.setIdentity(identity("auth0|invitee", "friend@example.com", true, "Friend"));
  const accepted = await invitations.accept._handler(session.ctx, {
    invitationId: created.invitationId,
    tokenHash: "c".repeat(64),
    operationId: "accept-role-0001",
  });

  await assert.rejects(
    invitations.changeRole._handler(session.ctx, {
      tripId: "trip_1",
      collaboratorId: accepted.collaboratorId,
      role: "editor",
      operationId: "role-denied-0001",
    }),
    /Owner access required/,
  );

  session.setIdentity(identity("auth0|owner", "owner@example.com", true, "Owner"));
  const changed = await invitations.changeRole._handler(session.ctx, {
    tripId: "trip_1",
    collaboratorId: accepted.collaboratorId,
    role: "editor",
    operationId: "role-change-0001",
  });
  assert.equal(changed.role, "editor");
  assert.equal(db.tables.collaborators[0].role, "editor");
  assert.equal(db.tables.tripInvitations[0].role, "editor");

  const removed = await invitations.removeCollaborator._handler(session.ctx, {
    tripId: "trip_1",
    collaboratorId: accepted.collaboratorId,
    operationId: "remove-member-0001",
  });
  assert.equal(removed.status, "removed");
  assert.equal(db.tables.collaborators[0].status, "revoked");
  assert.equal(db.tables.tripInvitations[0].status, "revoked");

  const removalReplay = await invitations.removeCollaborator._handler(session.ctx, {
    tripId: "trip_1",
    collaboratorId: accepted.collaboratorId,
    operationId: "remove-member-0001",
  });
  assert.equal(removalReplay.replayed, true);

  session.setIdentity(identity("auth0|invitee", "friend@example.com", true, "Friend"));
  await assert.rejects(
    trips.get._handler(session.ctx, { tripId: "trip_1" }),
    /Trip access denied/,
  );

  db.tables.users.push({
    _id: "user_legacy",
    tokenIdentifier: "auth0|legacy",
    email: "legacy@example.com",
    emailVerified: true,
    createdAt: 1,
    updatedAt: 1,
  });
  db.tables.collaborators.push({
    _id: "collaborator_legacy_owner",
    tripId: "trip_1",
    userId: "user_legacy",
    invitedEmail: "legacy@example.com",
    role: "owner",
    status: "accepted",
    createdAt: 1,
    updatedAt: 1,
  });
  session.setIdentity(identity("auth0|legacy", "legacy@example.com", true, "Legacy"));
  await assert.rejects(
    invitations.listAccess._handler(session.ctx, { tripId: "trip_1" }),
    /Owner access required/,
  );
});

test("verified recipients can decline and owners can revoke pending invitations", async () => {
  const invitations = await loadConvexModule("../convex/tripInvitations.ts");
  const db = createDatabase();
  const session = createContext(
    db,
    identity("auth0|owner", "owner@example.com", true, "Owner"),
  );
  const declinedInvite = await invitations.invite._handler(session.ctx, {
    tripId: "trip_1",
    email: "friend@example.com",
    role: "viewer",
    tokenHash: "d".repeat(64),
    operationId: "invite-decline-0001",
  });
  session.setIdentity(identity("auth0|invitee", "friend@example.com", true, "Friend"));
  const declined = await invitations.decline._handler(session.ctx, {
    invitationId: declinedInvite.invitationId,
    tokenHash: "d".repeat(64),
    operationId: "decline-invite-0001",
  });
  assert.equal(declined.status, "declined");
  assert.equal(db.tables.collaborators.length, 0);

  session.setIdentity(identity("auth0|owner", "owner@example.com", true, "Owner"));
  const revocable = await invitations.invite._handler(session.ctx, {
    tripId: "trip_1",
    email: "new-friend@example.com",
    role: "editor",
    tokenHash: "e".repeat(64),
    operationId: "invite-revoke-0001",
  });
  const revoked = await invitations.revokeInvitation._handler(session.ctx, {
    tripId: "trip_1",
    invitationId: revocable.invitationId,
    operationId: "revoke-invite-0001",
  });
  assert.equal(revoked.status, "revoked");

  const access = await invitations.listAccess._handler(session.ctx, { tripId: "trip_1" });
  assert.equal(access.owner.role, "owner");
  assert.equal(access.invitations.length, 2);
  assert.equal(access.invitations.some((entry) => "tokenHash" in entry), false);
  assert.ok(access.invitations.every((entry) => entry.delivery?.status === "queued"));
  assert.ok(access.invitations.every((entry) => entry.delivery?.attemptCount === 0));
  assert.ok(db.tables.tripAccessAuditEvents.length >= 4);
});

test("access receipts prefer the current invitation generation and break timestamp ties deterministically", async () => {
  const invitations = await loadConvexModule("../convex/tripInvitations.ts");
  const db = createDatabase();
  const session = createContext(
    db,
    identity("auth0|owner", "owner@example.com", true, "Owner"),
  );
  const tokenHash = "m".repeat(64);
  const created = await invitations.invite._handler(session.ctx, {
    tripId: "trip_1",
    email: "friend@example.com",
    role: "viewer",
    tokenHash,
    operationId: "invite-receipt-0001",
  });
  const invitation = db.tables.tripInvitations[0];
  db.tables.invitationEmailOutbox.splice(0, db.tables.invitationEmailOutbox.length,
    {
      _id: "outbox_stale",
      _creationTime: 99,
      tripId: "trip_1",
      invitationId: created.invitationId,
      tokenHash: "n".repeat(64),
      invitationSentAt: invitation.sentAt + 1,
      role: "editor",
      purpose: "resend",
      status: "failed",
      attemptCount: 1,
      maxAttempts: 5,
      createdAt: 99,
      updatedAt: 99,
    },
    {
      _id: "outbox_current_a",
      _creationTime: 10,
      tripId: "trip_1",
      invitationId: created.invitationId,
      tokenHash,
      invitationSentAt: invitation.sentAt,
      role: "viewer",
      purpose: "invite",
      status: "queued",
      attemptCount: 0,
      maxAttempts: 5,
      createdAt: 10,
      updatedAt: 20,
    },
    {
      _id: "outbox_current_b",
      _creationTime: 11,
      tripId: "trip_1",
      invitationId: created.invitationId,
      tokenHash,
      invitationSentAt: invitation.sentAt,
      role: "viewer",
      purpose: "invite",
      status: "sent",
      attemptCount: 1,
      maxAttempts: 5,
      createdAt: 10,
      updatedAt: 20,
      providerEvent: "accepted",
    },
  );

  const access = await invitations.listAccess._handler(session.ctx, { tripId: "trip_1" });
  assert.equal(access.invitations[0].delivery.status, "sent");
  assert.equal(access.invitations[0].delivery.providerEvent, "accepted");
});

test("owners resend pending or expired invitations atomically with a rotated token", async () => {
  const invitations = await loadConvexModule("../convex/tripInvitations.ts");
  const db = createDatabase();
  const session = createContext(
    db,
    identity("auth0|owner", "owner@example.com", true, "Owner"),
  );
  const firstTokenHash = "e".repeat(64);
  const nextTokenHash = "f".repeat(64);
  const created = await invitations.invite._handler(session.ctx, {
    tripId: "trip_1",
    email: "friend@example.com",
    role: "editor",
    tokenHash: firstTokenHash,
    operationId: "invite-resend-0001",
  });
  const nextExpiry = Date.now() + 2 * 24 * 60 * 60 * 1000;
  const resent = await invitations.resendInvitation._handler(session.ctx, {
    tripId: "trip_1",
    invitationId: created.invitationId,
    tokenHash: nextTokenHash,
    expiresAt: nextExpiry,
    operationId: "resend-invite-0001",
  });
  assert.deepEqual(
    {
      invitationId: resent.invitationId,
      role: resent.role,
      status: resent.status,
      expiresAt: resent.expiresAt,
      changed: resent.changed,
      replayed: resent.replayed,
    },
    {
      invitationId: created.invitationId,
      role: "editor",
      status: "pending",
      expiresAt: nextExpiry,
      changed: true,
      replayed: false,
    },
  );
  assert.equal(db.tables.tripInvitations.length, 1);
  assert.equal(db.tables.tripInvitations[0].tokenHash, nextTokenHash);
  assert.equal(db.tables.tripInvitations[0].sentAt, resent.sentAt);
  assert.equal(
    db.tables.tripAccessAuditEvents.at(-1).action,
    "invitation_resent",
  );

  const replay = await invitations.resendInvitation._handler(session.ctx, {
    tripId: "trip_1",
    invitationId: created.invitationId,
    tokenHash: nextTokenHash,
    expiresAt: nextExpiry + 60_000,
    operationId: "resend-invite-0001",
  });
  assert.equal(replay.replayed, true);
  assert.equal(replay.expiresAt, nextExpiry);
  assert.equal(replay.sentAt, resent.sentAt);

  const publicCtx = { auth: { async getUserIdentity() { return null; } }, db };
  assert.deepEqual(
    await invitations.inspect._handler(publicCtx, {
      webId: db.tables.trips[0].webId,
      tokenHash: firstTokenHash,
    }),
    { state: "unavailable" },
  );
  assert.equal(
    (
      await invitations.inspect._handler(publicCtx, {
        webId: db.tables.trips[0].webId,
        tokenHash: nextTokenHash,
      })
    ).state,
    "available",
  );

  await assert.rejects(
    invitations.resendInvitation._handler(session.ctx, {
      tripId: "trip_1",
      invitationId: created.invitationId,
      tokenHash: nextTokenHash,
      operationId: "resend-invite-0002",
    }),
    /requires a new token hash/,
  );

  db.tables.tripInvitations[0].status = "expired";
  db.tables.tripInvitations[0].expiresAt = Date.now() - 1;
  const renewed = await invitations.resendInvitation._handler(session.ctx, {
    tripId: "trip_1",
    invitationId: created.invitationId,
    tokenHash: "g".repeat(64),
    operationId: "resend-invite-0003",
  });
  assert.equal(renewed.status, "pending");
  assert.ok(renewed.expiresAt > Date.now());

  db.tables.tripInvitations[0].status = "revoked";
  await assert.rejects(
    invitations.resendInvitation._handler(session.ctx, {
      tripId: "trip_1",
      invitationId: created.invitationId,
      tokenHash: "g".repeat(64),
      operationId: "resend-invite-0003",
    }),
    /changed after this resend operation/,
  );
  await assert.rejects(
    invitations.resendInvitation._handler(session.ctx, {
      tripId: "trip_1",
      invitationId: created.invitationId,
      tokenHash: "h".repeat(64),
      operationId: "resend-invite-0004",
    }),
    /cannot be resent after it is revoked/,
  );
});

test("accept resolves an expiration boundary to the stored expired state without granting access", async () => {
  const invitations = await loadConvexModule("../convex/tripInvitations.ts");
  const db = createDatabase();
  const session = createContext(
    db,
    identity("auth0|owner", "owner@example.com", true, "Owner"),
  );
  const tokenHash = "i".repeat(64);
  const created = await invitations.invite._handler(session.ctx, {
    tripId: "trip_1",
    email: "friend@example.com",
    role: "viewer",
    tokenHash,
    operationId: "invite-expiry-0001",
  });
  db.tables.tripInvitations[0].expiresAt = Date.now() - 1;

  session.setIdentity(identity("auth0|invitee", "friend@example.com", true, "Friend"));
  const result = await invitations.accept._handler(session.ctx, {
    invitationId: created.invitationId,
    tokenHash,
    operationId: "accept-expiry-0001",
  });

  assert.equal(result.status, "expired");
  assert.equal(db.tables.tripInvitations[0].status, "expired");
  assert.equal(db.tables.tripInvitations[0].tokenHash, undefined);
  assert.equal(db.tables.collaborators.length, 0);
  assert.equal(db.tables.tripAccessOperations.at(-1).resultStatus, "expired");
});

test("pending reinvites are audited, exact duplicates are rejected, and invite replay keeps the original expiry", async () => {
  const invitations = await loadConvexModule("../convex/tripInvitations.ts");
  const db = createDatabase();
  const session = createContext(
    db,
    identity("auth0|owner", "owner@example.com", true, "Owner"),
  );
  const originalExpiry = Date.now() + 24 * 60 * 60 * 1000;
  const first = await invitations.invite._handler(session.ctx, {
    tripId: "trip_1",
    email: "friend@example.com",
    role: "viewer",
    tokenHash: "j".repeat(64),
    expiresAt: originalExpiry,
    operationId: "invite-idempotent-0001",
  });

  const replay = await invitations.invite._handler(session.ctx, {
    tripId: "trip_1",
    email: "friend@example.com",
    role: "viewer",
    tokenHash: "j".repeat(64),
    expiresAt: originalExpiry + 60_000,
    operationId: "invite-idempotent-0001",
  });
  assert.equal(replay.replayed, true);
  assert.equal(replay.expiresAt, originalExpiry);
  assert.equal(db.tables.tripInvitations[0].expiresAt, originalExpiry);

  const changed = await invitations.invite._handler(session.ctx, {
    tripId: "trip_1",
    email: "friend@example.com",
    role: "editor",
    tokenHash: "k".repeat(64),
    operationId: "invite-idempotent-0002",
  });
  assert.equal(changed.invitationId, first.invitationId);
  assert.equal(changed.changed, true);
  assert.equal(db.tables.tripAccessAuditEvents.at(-1).action, "invitation_resent");

  await assert.rejects(
    invitations.invite._handler(session.ctx, {
      tripId: "trip_1",
      email: "friend@example.com",
      role: "editor",
      tokenHash: "k".repeat(64),
      operationId: "invite-idempotent-0003",
    }),
    /pending invitation already exists/,
  );
});

test("invite and resend share a durable actor-trip-recipient send limit after idempotent replay", async () => {
  const invitations = await loadConvexModule("../convex/tripInvitations.ts");
  const db = createDatabase();
  const session = createContext(
    db,
    identity("auth0|owner", "owner@example.com", true, "Owner"),
  );
  let result = await invitations.invite._handler(session.ctx, {
    tripId: "trip_1",
    email: "friend@example.com",
    role: "viewer",
    tokenHash: "l".repeat(64),
    operationId: "invite-limit-0001",
  });

  const replay = await invitations.invite._handler(session.ctx, {
    tripId: "trip_1",
    email: "friend@example.com",
    role: "viewer",
    tokenHash: "l".repeat(64),
    operationId: "invite-limit-0001",
  });
  assert.equal(replay.replayed, true);

  for (let index = 2; index <= 5; index += 1) {
    result = await invitations.resendInvitation._handler(session.ctx, {
      tripId: "trip_1",
      invitationId: result.invitationId,
      tokenHash: String.fromCharCode(107 + index).repeat(64),
      operationId: `resend-limit-000${index}`,
    });
  }
  assert.equal(
    db.tables.tripAccessAuditEvents.filter((entry) =>
      entry.action === "invitation_created" || entry.action === "invitation_resent"
    ).length,
    5,
  );

  await assert.rejects(
    invitations.resendInvitation._handler(session.ctx, {
      tripId: "trip_1",
      invitationId: result.invitationId,
      tokenHash: "r".repeat(64),
      operationId: "resend-limit-0006",
    }),
    /Too many invitation sends/,
  );
  assert.equal(db.tables.tripAccessAuditEvents.length, 5);
});

test("public invitation inspection reveals safe trip context without making invalid links enumerable", async () => {
  const invitations = await loadConvexModule("../convex/tripInvitations.ts");
  const db = createDatabase();
  const session = createContext(
    db,
    identity("auth0|owner", "owner@example.com", true, "Owner"),
  );
  const tokenHash = "c".repeat(64);
  const created = await invitations.invite._handler(session.ctx, {
    tripId: "trip_1",
    email: "friend@example.com",
    role: "viewer",
    tokenHash,
    operationId: "invite-inspect-0001",
  });
  const publicCtx = { auth: { async getUserIdentity() { return null; } }, db };

  const available = await invitations.inspect._handler(publicCtx, {
    webId: db.tables.trips[0].webId,
    tokenHash,
  });
  assert.deepEqual(available, {
    state: "available",
    invitationId: created.invitationId,
    role: "viewer",
    status: "pending",
    expiresAt: db.tables.tripInvitations[0].expiresAt,
    inviterName: "Owner",
    trip: {
      webId: db.tables.trips[0].webId,
      locale: "en",
      title: "Friends in Buenos Aires",
      destination: "Buenos Aires, Argentina",
      startDate: "2026-08-13",
      endDate: "2026-08-26",
    },
  });
  assert.equal("invitedEmail" in available, false);
  assert.equal("tokenHash" in available, false);

  const wrongToken = await invitations.inspect._handler(publicCtx, {
    webId: db.tables.trips[0].webId,
    tokenHash: "d".repeat(64),
  });
  const wrongTrip = await invitations.inspect._handler(publicCtx, {
    webId: "f".repeat(32),
    tokenHash,
  });
  await invitations.revokeInvitation._handler(session.ctx, {
    tripId: "trip_1",
    invitationId: created.invitationId,
    operationId: "revoke-inspect-0001",
  });
  const revoked = await invitations.inspect._handler(publicCtx, {
    webId: db.tables.trips[0].webId,
    tokenHash,
  });
  assert.deepEqual(wrongToken, { state: "unavailable" });
  assert.deepEqual(wrongTrip, wrongToken);
  assert.deepEqual(revoked, wrongToken);
});
