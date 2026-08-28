import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import {
  evaluatePublicShareOperationRetry,
  publicShareOperationFingerprint,
  publicShareState,
} from "../shared/public-share-operations.mjs";
import { sanitizePublicSnapshot } from "../shared/public-snapshot.mjs";

type ReadContext = QueryCtx | MutationCtx;
type Operation = "publish" | "update" | "rotate" | "revoke";
type OperationResultStatus = "active" | "revoked" | "not_published";

const TOKEN_HASH_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const OPERATION_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const EXPIRY_CLOCK_TOLERANCE_MS = 5 * 60 * 1000;

async function currentUser(ctx: ReadContext) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  const user = await ctx.db
    .query("users")
    .withIndex("by_token_identifier", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
  if (!user) throw new Error("User profile not provisioned");
  return user;
}

async function requireOwner(ctx: ReadContext, tripId: Id<"trips">) {
  const [user, trip] = await Promise.all([
    currentUser(ctx),
    ctx.db.get(tripId),
  ]);
  if (!trip) throw new Error("Trip not found");
  if (trip.ownerId !== user._id)
    throw new Error("Only the trip owner can publish it");
  return { user, trip };
}

async function shareForTrip(ctx: ReadContext, tripId: Id<"trips">) {
  return ctx.db
    .query("publicShares")
    .withIndex("by_trip", (q) => q.eq("tripId", tripId))
    .unique();
}

async function recoverTokenDerivation(
  ctx: ReadContext,
  share: Doc<"publicShares">,
) {
  if (share.tokenDerivation) return share.tokenDerivation;
  const operations = await ctx.db
    .query("publicShareOperations")
    .withIndex("by_trip", (q) => q.eq("tripId", share.tripId))
    .collect();
  const source = operations
    .filter((operation) =>
      (operation.operation === "publish" || operation.operation === "rotate")
      && operation.resultStatus === "active"
      && operation.generation === share.generation
      && operation.tokenHash === share.tokenHash,
    )
    .sort((left, right) => right.createdAt - left.createdAt)[0];
  return source
    ? { purpose: source.operation, operationId: source.operationId }
    : undefined;
}

async function ownerStatus(
  ctx: ReadContext,
  trip: { currentVersion: number },
  share: Doc<"publicShares"> | null,
  now: number,
) {
  if (!share) {
    return {
      status: "not_published" as const,
      currentVersion: trip.currentVersion,
      isStale: false,
    };
  }
  const status = publicShareState(share, now);
  const tokenDerivation = status === "active"
    ? await recoverTokenDerivation(ctx, share)
    : undefined;
  return {
    status,
    currentVersion: trip.currentVersion,
    publishedVersion: share.sourceVersion,
    isStale: share.sourceVersion !== trip.currentVersion,
    expiresAt: share.expiresAt,
    publishedAt: share.publishedAt,
    updatedAt: share.updatedAt,
    summary: {
      title: share.publicSnapshot.title,
      destination: share.publicSnapshot.destination,
      startDate: share.publicSnapshot.startDate,
      endDate: share.publicSnapshot.endDate,
    },
    ...(share.revokedAt !== undefined ? { revokedAt: share.revokedAt } : {}),
    ...(share.rotatedAt !== undefined ? { rotatedAt: share.rotatedAt } : {}),
    ...(tokenDerivation
      ? { tokenDerivation, tokenHash: share.tokenHash }
      : {}),
  };
}

function assertExpectedVersion(
  trip: { currentVersion: number },
  expectedVersion: number,
) {
  if (trip.currentVersion !== expectedVersion) {
    throw new Error(
      `The trip changed after the sharing preview. Expected version ${expectedVersion}, found ${trip.currentVersion}.`,
    );
  }
}

function assertTokenHash(tokenHash: string) {
  if (!TOKEN_HASH_PATTERN.test(tokenHash)) {
    throw new Error("Invalid public share token hash");
  }
}

function assertOperationId(operationId: string) {
  if (!OPERATION_ID_PATTERN.test(operationId)) {
    throw new Error("Invalid public share operation ID");
  }
}

function assertExpiry(expiresAt: number, now: number) {
  const lifetime = expiresAt - now;
  if (
    !Number.isFinite(expiresAt) ||
    lifetime < DAY_MS - EXPIRY_CLOCK_TOLERANCE_MS ||
    lifetime > 365 * DAY_MS + EXPIRY_CLOCK_TOLERANCE_MS
  ) {
    throw new Error("Public share expiration must be between 1 and 365 days");
  }
}

async function tokenHashCollision(
  ctx: MutationCtx,
  tokenHash: string,
  tripId: Id<"trips">,
) {
  const existing = await ctx.db
    .query("publicShares")
    .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
    .unique();
  if (existing && existing.tripId !== tripId) {
    throw new Error("Public share token collision");
  }
}

async function repeatedOperation(
  ctx: MutationCtx,
  {
    ownerId,
    tripId,
    operationId,
    operation,
    tokenHash,
    requestFingerprint,
    now,
  }: {
    ownerId: Id<"users">;
    tripId: Id<"trips">;
    operationId: string;
    operation: Operation;
    tokenHash?: string;
    requestFingerprint: string;
    now: number;
  },
) {
  assertOperationId(operationId);
  const previous = await ctx.db
    .query("publicShareOperations")
    .withIndex("by_owner_and_operation", (q) =>
      q.eq("ownerId", ownerId).eq("operationId", operationId),
    )
    .unique();
  const share = previous ? await shareForTrip(ctx, tripId) : null;
  return evaluatePublicShareOperationRetry({
    previous,
    request: {
      tripId,
      operation,
      ...(tokenHash ? { tokenHash } : {}),
      requestFingerprint,
    },
    share,
    now,
  });
}

async function recordOperation(
  ctx: MutationCtx,
  {
    ownerId,
    tripId,
    operationId,
    operation,
    tokenHash,
    requestFingerprint,
    resultStatus,
    generation,
    now,
  }: {
    ownerId: Id<"users">;
    tripId: Id<"trips">;
    operationId: string;
    operation: Operation;
    tokenHash?: string;
    requestFingerprint: string;
    resultStatus: OperationResultStatus;
    generation: number;
    now: number;
  },
) {
  await ctx.db.insert("publicShareOperations", {
    ownerId,
    tripId,
    operationId,
    operation,
    ...(tokenHash ? { tokenHash } : {}),
    requestFingerprint,
    resultStatus,
    generation,
    createdAt: now,
  });
}

export const preview = query({
  args: { tripId: v.id("trips") },
  handler: async (ctx, { tripId }) => {
    const { trip } = await requireOwner(ctx, tripId);
    const share = await shareForTrip(ctx, tripId);
    return {
      itinerary: sanitizePublicSnapshot(trip.snapshot),
      version: trip.currentVersion,
      sharing: await ownerStatus(ctx, trip, share, Date.now()),
    };
  },
});

export const status = query({
  args: { tripId: v.id("trips") },
  handler: async (ctx, { tripId }) => {
    const { trip } = await requireOwner(ctx, tripId);
    return ownerStatus(ctx, trip, await shareForTrip(ctx, tripId), Date.now());
  },
});

export const publish = mutation({
  args: {
    tripId: v.id("trips"),
    expectedVersion: v.number(),
    tokenHash: v.string(),
    expiresAt: v.number(),
    operationId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const { user, trip } = await requireOwner(ctx, args.tripId);
    assertTokenHash(args.tokenHash);
    const requestFingerprint = publicShareOperationFingerprint("publish", {
      expectedVersion: args.expectedVersion,
      tokenHash: args.tokenHash,
      expiresAt: args.expiresAt,
    });
    const repeated = await repeatedOperation(ctx, {
      ownerId: user._id,
      tripId: args.tripId,
      operationId: args.operationId,
      operation: "publish",
      tokenHash: args.tokenHash,
      requestFingerprint,
      now,
    });
    if (repeated.repeated) return ownerStatus(ctx, trip, repeated.share, now);

    assertExpectedVersion(trip, args.expectedVersion);
    assertExpiry(args.expiresAt, now);
    await tokenHashCollision(ctx, args.tokenHash, args.tripId);
    const existing = await shareForTrip(ctx, args.tripId);
    if (publicShareState(existing, now) === "active") {
      throw new Error(
        "This trip already has an active public link; update or rotate it instead",
      );
    }
    if (existing?.tokenHash === args.tokenHash) {
      throw new Error(
        "A new public link must not reuse an expired or revoked token",
      );
    }

    const generation = (existing?.generation || 0) + 1;
    const publicSnapshot = sanitizePublicSnapshot(trip.snapshot);
    let shareId: Id<"publicShares">;
    if (existing) {
      shareId = existing._id;
      await ctx.db.patch(shareId, {
        ownerId: user._id,
        tokenHash: args.tokenHash,
        tokenDerivation: { purpose: "publish", operationId: args.operationId },
        sourceVersion: trip.currentVersion,
        publicSnapshot,
        status: "active",
        expiresAt: args.expiresAt,
        generation,
        publishedAt: now,
        updatedAt: now,
        revokedAt: undefined,
        rotatedAt: now,
      });
    } else {
      shareId = await ctx.db.insert("publicShares", {
        tripId: args.tripId,
        ownerId: user._id,
        tokenHash: args.tokenHash,
        tokenDerivation: { purpose: "publish", operationId: args.operationId },
        sourceVersion: trip.currentVersion,
        publicSnapshot,
        status: "active",
        expiresAt: args.expiresAt,
        generation,
        publishedAt: now,
        updatedAt: now,
      });
    }
    await recordOperation(ctx, {
      ownerId: user._id,
      tripId: args.tripId,
      operationId: args.operationId,
      operation: "publish",
      tokenHash: args.tokenHash,
      requestFingerprint,
      resultStatus: "active",
      generation,
      now,
    });
    const share = await ctx.db.get(shareId);
    if (!share) throw new Error("Unable to publish trip");
    return ownerStatus(ctx, trip, share, now);
  },
});

export const update = mutation({
  args: {
    tripId: v.id("trips"),
    expectedVersion: v.number(),
    operationId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const { user, trip } = await requireOwner(ctx, args.tripId);
    const requestFingerprint = publicShareOperationFingerprint("update", {
      expectedVersion: args.expectedVersion,
    });
    const repeated = await repeatedOperation(ctx, {
      ownerId: user._id,
      tripId: args.tripId,
      operationId: args.operationId,
      operation: "update",
      requestFingerprint,
      now,
    });
    if (repeated.repeated) return ownerStatus(ctx, trip, repeated.share, now);

    assertExpectedVersion(trip, args.expectedVersion);
    const share = await shareForTrip(ctx, args.tripId);
    if (!share || publicShareState(share, now) !== "active") {
      throw new Error("Only an active public link can be updated");
    }
    await ctx.db.patch(share._id, {
      sourceVersion: trip.currentVersion,
      publicSnapshot: sanitizePublicSnapshot(trip.snapshot),
      updatedAt: now,
    });
    await recordOperation(ctx, {
      ownerId: user._id,
      tripId: args.tripId,
      operationId: args.operationId,
      operation: "update",
      requestFingerprint,
      resultStatus: "active",
      generation: share.generation,
      now,
    });
    const updated = await ctx.db.get(share._id);
    if (!updated) throw new Error("Unable to update public trip");
    return ownerStatus(ctx, trip, updated, now);
  },
});

export const rotate = mutation({
  args: {
    tripId: v.id("trips"),
    tokenHash: v.string(),
    operationId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const { user, trip } = await requireOwner(ctx, args.tripId);
    assertTokenHash(args.tokenHash);
    const requestFingerprint = publicShareOperationFingerprint("rotate", {
      tokenHash: args.tokenHash,
    });
    const repeated = await repeatedOperation(ctx, {
      ownerId: user._id,
      tripId: args.tripId,
      operationId: args.operationId,
      operation: "rotate",
      tokenHash: args.tokenHash,
      requestFingerprint,
      now,
    });
    if (repeated.repeated) return ownerStatus(ctx, trip, repeated.share, now);

    const share = await shareForTrip(ctx, args.tripId);
    if (!share || publicShareState(share, now) !== "active") {
      throw new Error("Only an active public link can be rotated");
    }
    if (share.tokenHash === args.tokenHash) {
      throw new Error("The rotated public link must use a new token");
    }
    await tokenHashCollision(ctx, args.tokenHash, args.tripId);
    const generation = share.generation + 1;
    await ctx.db.patch(share._id, {
      tokenHash: args.tokenHash,
      tokenDerivation: { purpose: "rotate", operationId: args.operationId },
      generation,
      rotatedAt: now,
      updatedAt: now,
    });
    await recordOperation(ctx, {
      ownerId: user._id,
      tripId: args.tripId,
      operationId: args.operationId,
      operation: "rotate",
      tokenHash: args.tokenHash,
      requestFingerprint,
      resultStatus: "active",
      generation,
      now,
    });
    const rotated = await ctx.db.get(share._id);
    if (!rotated) throw new Error("Unable to rotate public link");
    return ownerStatus(ctx, trip, rotated, now);
  },
});

export const revoke = mutation({
  args: { tripId: v.id("trips"), operationId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const { user, trip } = await requireOwner(ctx, args.tripId);
    const requestFingerprint = publicShareOperationFingerprint("revoke");
    const repeated = await repeatedOperation(ctx, {
      ownerId: user._id,
      tripId: args.tripId,
      operationId: args.operationId,
      operation: "revoke",
      requestFingerprint,
      now,
    });
    if (repeated.repeated) return ownerStatus(ctx, trip, repeated.share, now);

    const share = await shareForTrip(ctx, args.tripId);
    if (!share) {
      await recordOperation(ctx, {
        ownerId: user._id,
        tripId: args.tripId,
        operationId: args.operationId,
        operation: "revoke",
        requestFingerprint,
        resultStatus: "not_published",
        generation: 0,
        now,
      });
      return ownerStatus(ctx, trip, null, now);
    }
    const generation = share.generation + 1;
    await ctx.db.patch(share._id, {
      status: "revoked",
      generation,
      revokedAt: share.revokedAt ?? now,
      updatedAt: now,
    });
    await recordOperation(ctx, {
      ownerId: user._id,
      tripId: args.tripId,
      operationId: args.operationId,
      operation: "revoke",
      requestFingerprint,
      resultStatus: "revoked",
      generation,
      now,
    });
    const revoked = await ctx.db.get(share._id);
    if (!revoked) throw new Error("Unable to revoke public link");
    return ownerStatus(ctx, trip, revoked, now);
  },
});

export const resolveByTokenHash = internalQuery({
  args: { tokenHash: v.string() },
  handler: async (ctx, { tokenHash }) => {
    assertTokenHash(tokenHash);
    const share = await ctx.db
      .query("publicShares")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (!share) return { status: "not_found" as const };
    if (share.status !== "active") return { status: "unavailable" as const };
    if (share.expiresAt <= Date.now()) return { status: "expired" as const };
    return {
      status: "active" as const,
      itinerary: share.publicSnapshot,
      share: {
        publishedAt: share.publishedAt,
        updatedAt: share.updatedAt,
        expiresAt: share.expiresAt,
      },
    };
  },
});
