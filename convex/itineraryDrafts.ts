import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { ensureCurrentUser, findCurrentUser } from "./tripAccess";
import {
  allocateWebId,
  itineraryMetadata,
  normalizeSnapshotLocale,
  requestFingerprint,
  requireOperationId,
} from "./tripWrites";

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const RETENTION_AFTER_TERMINAL_MS = 7 * 24 * 60 * 60 * 1000;

const draftStatus = v.union(
  v.literal("valid"),
  v.literal("saved"),
  v.literal("discarded"),
  v.literal("expired"),
);

const savedTrip = v.object({
  tripId: v.id("trips"),
  webId: v.string(),
  version: v.number(),
  itinerary: v.any(),
});

const draftViewValidator = v.object({
  draftId: v.id("itineraryDrafts"),
  status: draftStatus,
  expiresAt: v.number(),
  protocolVersion: v.string(),
  warnings: v.array(v.string()),
  itinerary: v.optional(v.any()),
  trip: v.optional(savedTrip),
});

function expireReference() {
  return (internal as any).itineraryDrafts.expire;
}

function purgeReference() {
  return (internal as any).itineraryDrafts.purge;
}

async function tripResult(ctx: QueryCtx | MutationCtx, draft: Doc<"itineraryDrafts">) {
  if (!draft.savedTripId) return undefined;
  const trip = await ctx.db.get(draft.savedTripId);
  if (!trip?.webId) throw new Error("Saved draft trip not found");
  return {
    tripId: trip._id,
    webId: trip.webId,
    version: trip.currentVersion,
    itinerary: normalizeSnapshotLocale(trip.snapshot),
  };
}

async function draftView(ctx: QueryCtx | MutationCtx, draft: Doc<"itineraryDrafts">) {
  const effectivelyExpired = draft.status === "valid" && draft.expiresAt <= Date.now();
  return {
    draftId: draft._id,
    status: effectivelyExpired ? "expired" as const : draft.status,
    expiresAt: draft.expiresAt,
    protocolVersion: draft.protocolVersion,
    warnings: draft.warnings,
    ...(!effectivelyExpired && draft.snapshot
      ? { itinerary: normalizeSnapshotLocale(draft.snapshot) }
      : {}),
    ...(draft.savedTripId ? { trip: await tripResult(ctx, draft) } : {}),
  };
}

async function requireOwnedDraft(
  ctx: QueryCtx | MutationCtx,
  draftId: Id<"itineraryDrafts">,
) {
  const draft = await ctx.db.get(draftId);
  const { user } = await findCurrentUser(ctx);
  if (!draft || !user || draft.actorId !== user._id) {
    throw new Error("Itinerary draft not found");
  }
  return draft;
}

export const stage = mutation({
  args: {
    brief: v.any(),
    briefHash: v.string(),
    itinerary: v.any(),
    itineraryHash: v.string(),
    operationId: v.string(),
    protocolHash: v.string(),
    protocolVersion: v.string(),
    warnings: v.array(v.string()),
  },
  returns: draftViewValidator,
  handler: async (ctx, args) => {
    requireOperationId(args.operationId, "itinerary stage");
    const user = await ensureCurrentUser(ctx);
    const snapshot = normalizeSnapshotLocale(args.itinerary);
    const fingerprint = requestFingerprint({
      briefHash: args.briefHash,
      itineraryHash: args.itineraryHash,
      protocolHash: args.protocolHash,
      protocolVersion: args.protocolVersion,
    });
    const existing = await ctx.db
      .query("itineraryDrafts")
      .withIndex("by_actor_and_stage_operation", (q) =>
        q.eq("actorId", user._id).eq("stageOperationId", args.operationId),
      )
      .unique();
    if (existing) {
      if (existing.stageRequestFingerprint !== fingerprint) {
        throw new Error("Itinerary stage operation ID was already used for a different request");
      }
      return await draftView(ctx, existing);
    }

    const now = Date.now();
    const expiresAt = now + DRAFT_TTL_MS;
    const draftId = await ctx.db.insert("itineraryDrafts", {
      actorId: user._id,
      status: "valid",
      brief: args.brief,
      briefHash: args.briefHash,
      snapshot,
      itineraryHash: args.itineraryHash,
      protocolVersion: args.protocolVersion,
      protocolHash: args.protocolHash,
      warnings: args.warnings,
      stageOperationId: args.operationId,
      stageRequestFingerprint: fingerprint,
      createdAt: now,
      updatedAt: now,
      expiresAt,
    });
    await ctx.scheduler.runAt(expiresAt, expireReference(), { draftId, expectedExpiresAt: expiresAt });
    const draft = await ctx.db.get(draftId);
    if (!draft) throw new Error("Unable to create itinerary draft");
    return await draftView(ctx, draft);
  },
});

export const get = query({
  args: { draftId: v.id("itineraryDrafts") },
  returns: v.union(v.null(), draftViewValidator),
  handler: async (ctx, { draftId }) => {
    const draft = await requireOwnedDraft(ctx, draftId);
    return await draftView(ctx, draft);
  },
});

export const save = mutation({
  args: {
    draftId: v.id("itineraryDrafts"),
    operationId: v.string(),
  },
  returns: v.object({
    draftId: v.id("itineraryDrafts"),
    status: v.literal("saved"),
    replayed: v.boolean(),
    trip: savedTrip,
  }),
  handler: async (ctx, { draftId, operationId }) => {
    requireOperationId(operationId, "itinerary draft save");
    const user = await ensureCurrentUser(ctx);
    const draft = await requireOwnedDraft(ctx, draftId);
    if (draft.status === "saved") {
      const trip = await tripResult(ctx, draft);
      if (!trip) throw new Error("Saved draft trip not found");
      return { draftId, status: "saved" as const, replayed: true, trip };
    }
    if (draft.status !== "valid" || draft.expiresAt <= Date.now() || !draft.snapshot) {
      throw new Error("Itinerary draft expired or is no longer available");
    }

    const requestFingerprintValue = requestFingerprint({
      draftId,
      itineraryHash: draft.itineraryHash,
    });
    const existingOperation = await ctx.db
      .query("tripWriteOperations")
      .withIndex("by_actor_and_operation", (q) =>
        q.eq("actorId", user._id).eq("operationId", operationId),
      )
      .unique();
    if (existingOperation) {
      throw new Error("Trip write operation ID was already used for a different request");
    }

    const now = Date.now();
    const itinerary = normalizeSnapshotLocale(draft.snapshot);
    const metadata = itineraryMetadata(itinerary);
    const webId = await allocateWebId(ctx);
    const tripId = await ctx.db.insert("trips", {
      ownerId: user._id,
      webId,
      ...metadata,
      snapshot: itinerary,
      currentVersion: 1,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("tripRevisions", {
      tripId,
      version: 1,
      snapshot: itinerary,
      actorId: user._id,
      reason: "Itinerary created from WebMCP",
      createdAt: now,
    });
    await ctx.db.insert("tripWriteOperations", {
      tripId,
      actorId: user._id,
      operationId,
      operation: "save",
      requestFingerprint: requestFingerprintValue,
      resultVersion: 1,
      createdAt: now,
    });
    await ctx.db.patch(draftId, {
      status: "saved",
      brief: undefined,
      snapshot: undefined,
      saveOperationId: operationId,
      savedTripId: tripId,
      savedWebId: webId,
      savedVersion: 1,
      updatedAt: now,
    });
    await ctx.scheduler.runAt(now + RETENTION_AFTER_TERMINAL_MS, purgeReference(), { draftId });
    return {
      draftId,
      status: "saved" as const,
      replayed: false,
      trip: { tripId, webId, version: 1, itinerary },
    };
  },
});

export const discard = mutation({
  args: { draftId: v.id("itineraryDrafts") },
  returns: v.object({
    draftId: v.id("itineraryDrafts"),
    status: draftStatus,
  }),
  handler: async (ctx, { draftId }) => {
    await ensureCurrentUser(ctx);
    const draft = await requireOwnedDraft(ctx, draftId);
    if (draft.status === "saved") throw new Error("A saved itinerary draft cannot be discarded");
    if (draft.status === "discarded" || draft.status === "expired") {
      return { draftId, status: draft.status };
    }
    const now = Date.now();
    await ctx.db.patch(draftId, {
      status: "discarded",
      brief: undefined,
      snapshot: undefined,
      updatedAt: now,
    });
    await ctx.scheduler.runAt(now + RETENTION_AFTER_TERMINAL_MS, purgeReference(), { draftId });
    return { draftId, status: "discarded" as const };
  },
});

export const expire = internalMutation({
  args: {
    draftId: v.id("itineraryDrafts"),
    expectedExpiresAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, { draftId, expectedExpiresAt }) => {
    const draft = await ctx.db.get(draftId);
    if (!draft || draft.status !== "valid" || draft.expiresAt !== expectedExpiresAt) return null;
    const now = Date.now();
    await ctx.db.patch(draftId, {
      status: "expired",
      brief: undefined,
      snapshot: undefined,
      updatedAt: now,
    });
    await ctx.scheduler.runAt(now + RETENTION_AFTER_TERMINAL_MS, purgeReference(), { draftId });
    return null;
  },
});

export const purge = internalMutation({
  args: { draftId: v.id("itineraryDrafts") },
  returns: v.null(),
  handler: async (ctx, { draftId }) => {
    const draft = await ctx.db.get(draftId);
    if (draft && draft.status !== "valid") await ctx.db.delete(draftId);
    return null;
  },
});
