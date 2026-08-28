import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import {
  bootstrapCurrentUser,
  ensureCurrentUser,
  listAccessibleTrips,
  requireAccess,
  type ReadContext,
} from "./tripAccess";

function itineraryMetadata(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== "object") throw new Error("Invalid itinerary snapshot");
  const itinerary = snapshot as Record<string, unknown>;
  for (const field of ["title", "destination", "startDate", "endDate"] as const) {
    if (typeof itinerary[field] !== "string" || itinerary[field].length === 0) {
      throw new Error(`Invalid itinerary ${field}`);
    }
  }
  return {
    title: itinerary.title as string,
    destination: itinerary.destination as string,
    startDate: itinerary.startDate as string,
    endDate: itinerary.endDate as string,
  };
}

function requireOperationId(operationId: string, label: string) {
  if (
    operationId.length < 8 ||
    operationId.length > 128 ||
    !/^[A-Za-z0-9._:-]+$/.test(operationId)
  ) {
    throw new Error(`Invalid ${label} operation ID`);
  }
}

function requestFingerprint(value: unknown) {
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

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tripSummary(trip: Record<string, unknown>) {
  return {
    id: trip._id,
    webId: trip.webId,
    title: trip.title,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    currentVersion: trip.currentVersion,
    role: trip.role,
    updatedAt: trip.updatedAt,
  };
}

function assertWebId(value: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(value)) throw new Error("Invalid trip web ID");
  return value;
}

async function allocateWebId(ctx: MutationCtx) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const webId = crypto.randomUUID().replace(/-/g, "");
    const existing = await ctx.db
      .query("trips")
      .withIndex("by_web_id", (q) => q.eq("webId", webId))
      .unique();
    if (!existing) return webId;
  }
  throw new Error("Unable to allocate a unique trip web ID");
}

async function revisionSummaries(ctx: ReadContext, tripId: Id<"trips">) {
  const revisions = await ctx.db
    .query("tripRevisions")
    .withIndex("by_trip", (q) => q.eq("tripId", tripId))
    .collect();
  return revisions
    .map(({ _id, version, reason, createdAt }) => ({ _id, version, reason, createdAt }))
    .sort((a, b) => b.version - a.version);
}

export const listMine = query({
  args: {},
  handler: async (ctx) => listAccessibleTrips(ctx),
});

export const bootstrapSession = mutation({
  args: {},
  handler: async (ctx) => {
    const result = await bootstrapCurrentUser(ctx);
    return {
      userId: result.user._id,
      email: result.user.email,
      emailVerified: result.user.emailVerified === true,
    };
  },
});

export const open = query({
  args: {
    reference: v.union(
      v.object({ tripId: v.id("trips") }),
      v.object({ selector: v.literal("latest_updated") }),
      v.object({
        query: v.string(),
        startDate: v.optional(v.string()),
        endDate: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { reference }) => {
    if ("tripId" in reference) {
      const access = await requireAccess(ctx, reference.tripId, "viewer");
      return {
        state: "opened" as const,
        trip: { ...access.trip, role: access.role },
        revisions: await revisionSummaries(ctx, reference.tripId),
        trips: [],
      };
    }

    const trips = await listAccessibleTrips(ctx);
    const matches = "selector" in reference
      ? trips.slice(0, 1)
      : (() => {
          const terms = normalizeSearchText(reference.query).split(/\s+/).filter(Boolean);
          if (!terms.length) return [];
          return trips.filter((trip) => {
            const searchable = normalizeSearchText(`${trip.title} ${trip.destination}`);
            return (
              terms.every((term) => searchable.includes(term)) &&
              (!reference.startDate || trip.startDate === reference.startDate) &&
              (!reference.endDate || trip.endDate === reference.endDate)
            );
          });
        })();

    if (matches.length === 0) {
      return { state: "not_found" as const, trips: [] };
    }
    if (matches.length > 1) {
      return {
        state: "needs_selection" as const,
        trips: matches.map(tripSummary),
      };
    }

    const trip = matches[0];
    const tripId = trip._id as Id<"trips">;
    return {
      state: "opened" as const,
      trip,
      revisions: await revisionSummaries(ctx, tripId),
      trips: [],
    };
  },
});

export const get = query({
  args: { tripId: v.id("trips") },
  handler: async (ctx, { tripId }) => {
    const access = await requireAccess(ctx, tripId, "viewer");
    return {
      ...access.trip,
      role: access.role,
      revisions: await revisionSummaries(ctx, tripId),
    };
  },
});

export const getByWebId = query({
  args: { webId: v.string() },
  handler: async (ctx, { webId }) => {
    const trip = await ctx.db
      .query("trips")
      .withIndex("by_web_id", (q) => q.eq("webId", assertWebId(webId)))
      .unique();
    if (!trip) throw new Error("Trip not found");
    const access = await requireAccess(ctx, trip._id, "viewer");
    return {
      ...access.trip,
      role: access.role,
      revisions: await revisionSummaries(ctx, trip._id),
    };
  },
});

export const ensureWebId = mutation({
  args: { tripId: v.id("trips") },
  handler: async (ctx, { tripId }) => {
    await ensureCurrentUser(ctx);
    const access = await requireAccess(ctx, tripId, "owner");
    if (access.trip.webId) return { tripId, webId: access.trip.webId, changed: false };
    const webId = await allocateWebId(ctx);
    await ctx.db.patch(tripId, { webId, updatedAt: Date.now() });
    return { tripId, webId, changed: true };
  },
});

export const getRevision = query({
  args: {
    tripId: v.id("trips"),
    version: v.number(),
  },
  handler: async (ctx, { tripId, version }) => {
    const access = await requireAccess(ctx, tripId, "viewer");
    const revision = await ctx.db
      .query("tripRevisions")
      .withIndex("by_trip_and_version", (q) => q.eq("tripId", tripId).eq("version", version))
      .unique();
    if (!revision) throw new Error("Trip revision not found");
    return {
      tripId,
      version: revision.version,
      role: access.role,
      itinerary: revision.snapshot,
    };
  },
});

export const save = mutation({
  args: {
    tripId: v.optional(v.id("trips")),
    itinerary: v.any(),
    reason: v.optional(v.string()),
    expectedVersion: v.optional(v.number()),
    operationId: v.string(),
  },
  handler: async (
    ctx,
    { tripId, itinerary, reason, expectedVersion, operationId },
  ) => {
    requireOperationId(operationId, "trip save");
    const user = await ensureCurrentUser(ctx);
    const metadata = itineraryMetadata(itinerary);
    const now = Date.now();
    const requestFingerprintValue = requestFingerprint({
      tripId: tripId || null,
      itinerary,
      reason: reason || null,
      expectedVersion: expectedVersion ?? null,
    });
    const existingOperation = await ctx.db
      .query("tripWriteOperations")
      .withIndex("by_actor_and_operation", (q) =>
        q.eq("actorId", user._id).eq("operationId", operationId),
      )
      .unique();

    if (existingOperation) {
      if (
        existingOperation.operation !== "save" ||
        existingOperation.requestFingerprint !== requestFingerprintValue
      ) {
        throw new Error("Trip write operation ID was already used for a different request");
      }
      const access = await requireAccess(ctx, existingOperation.tripId, "viewer");
      return {
        tripId: existingOperation.tripId,
        webId: access.trip.webId,
        version: access.trip.currentVersion,
        savedVersion: existingOperation.resultVersion,
        role: access.role,
        itinerary: access.trip.snapshot,
        replayed: true,
      };
    }

    if (!tripId) {
      if (expectedVersion !== undefined) {
        throw new Error("expectedVersion is only valid when updating a saved trip");
      }
      const webId = await allocateWebId(ctx);
      const createdTripId = await ctx.db.insert("trips", {
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
        tripId: createdTripId,
        version: 1,
        snapshot: itinerary,
        actorId: user._id,
        reason: reason || "Trip created",
        createdAt: now,
      });
      await ctx.db.insert("tripWriteOperations", {
        tripId: createdTripId,
        actorId: user._id,
        operationId,
        operation: "save",
        requestFingerprint: requestFingerprintValue,
        resultVersion: 1,
        createdAt: now,
      });
      return {
        tripId: createdTripId,
        version: 1,
        savedVersion: 1,
        role: "owner" as const,
        webId,
        itinerary,
        replayed: false,
      };
    }

    const access = await requireAccess(ctx, tripId, "editor");
    if (!Number.isInteger(expectedVersion) || Number(expectedVersion) < 1) {
      throw new Error("A positive integer expectedVersion is required when updating a trip");
    }
    if (access.trip.currentVersion !== expectedVersion) {
      throw new Error(
        `Trip version changed. Expected ${expectedVersion}, found ${access.trip.currentVersion}. Refresh before saving the itinerary.`,
      );
    }
    const version = access.trip.currentVersion + 1;
    await ctx.db.patch(tripId, {
      ...metadata,
      snapshot: itinerary,
      currentVersion: version,
      updatedAt: now,
    });
    await ctx.db.insert("tripRevisions", {
      tripId,
      version,
      snapshot: itinerary,
      actorId: user._id,
      reason: reason || "Itinerary updated",
      createdAt: now,
    });
    await ctx.db.insert("tripWriteOperations", {
      tripId,
      actorId: user._id,
      operationId,
      operation: "save",
      requestFingerprint: requestFingerprintValue,
      resultVersion: version,
      createdAt: now,
    });
    return {
      tripId,
      webId: access.trip.webId,
      version,
      savedVersion: version,
      role: access.role,
      itinerary,
      replayed: false,
    };
  },
});

export const updateReservationStatus = mutation({
  args: {
    tripId: v.id("trips"),
    dayDate: v.string(),
    activityId: v.string(),
    status: v.union(v.literal("pending"), v.literal("confirmed"), v.literal("cancelled")),
    expectedVersion: v.number(),
    operationId: v.string(),
  },
  handler: async (
    ctx,
    { tripId, dayDate, activityId, status, expectedVersion, operationId },
  ) => {
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      throw new Error("A positive integer expectedVersion is required");
    }
    if (
      operationId.length < 8 ||
      operationId.length > 128 ||
      !/^[A-Za-z0-9._:-]+$/.test(operationId)
    ) {
      throw new Error("Invalid reservation operation ID");
    }
    const user = await ensureCurrentUser(ctx);
    const access = await requireAccess(ctx, tripId, "editor");
    if (access.role !== "owner" && access.role !== "editor") {
      throw new Error("Editor access required");
    }

    const requestFingerprint = JSON.stringify({
      tripId,
      dayDate,
      activityId,
      status,
      expectedVersion,
    });
    const existingOperation = await ctx.db
      .query("reservationOperations")
      .withIndex("by_actor_and_operation", (q) =>
        q.eq("actorId", user._id).eq("operationId", operationId),
      )
      .unique();

    if (existingOperation) {
      if (
        existingOperation.tripId !== tripId ||
        existingOperation.requestFingerprint !== requestFingerprint
      ) {
        throw new Error("Reservation operation ID was already used for a different request");
      }
      const currentTrip = await ctx.db.get(tripId);
      if (!currentTrip) throw new Error("Trip not found");
      return {
        tripId,
        // The durable operation record proves that this exact write already ran.
        // Always return the authoritative current snapshot, though: a later edit
        // must never be visually replaced by the historical operation result.
        version: currentTrip.currentVersion,
        role: access.role,
        changed: existingOperation.changed,
        itinerary: currentTrip.snapshot,
      };
    }

    if (access.trip.currentVersion !== expectedVersion) {
      throw new Error(
        `Trip version changed. Expected ${expectedVersion}, found ${access.trip.currentVersion}. Refresh before updating the reservation.`,
      );
    }

    const snapshot = structuredClone(access.trip.snapshot) as Record<string, unknown>;
    const days = Array.isArray(snapshot.days) ? snapshot.days : undefined;
    if (!days) throw new Error("Invalid itinerary snapshot");
    const day = days.find(
      (value) =>
        value !== null &&
        typeof value === "object" &&
        (value as Record<string, unknown>).date === dayDate,
    ) as Record<string, unknown> | undefined;
    if (!day || !Array.isArray(day.activities)) throw new Error("Itinerary day not found");
    const activity = day.activities.find(
      (value) =>
        value !== null &&
        typeof value === "object" &&
        (value as Record<string, unknown>).id === activityId,
    ) as Record<string, unknown> | undefined;
    if (!activity) throw new Error("Itinerary activity not found");
    if (
      activity.reservation === null ||
      typeof activity.reservation !== "object" ||
      Array.isArray(activity.reservation)
    ) {
      throw new Error("This activity does not have a reservation to track");
    }

    const reservation = activity.reservation as Record<string, unknown>;
    const changed = reservation.status !== status;
    let resultVersion = access.trip.currentVersion;
    const now = Date.now();

    if (changed) {
      reservation.status = status;
      resultVersion += 1;
      await ctx.db.patch(tripId, {
        snapshot,
        currentVersion: resultVersion,
        updatedAt: now,
      });
      await ctx.db.insert("tripRevisions", {
        tripId,
        version: resultVersion,
        snapshot,
        actorId: user._id,
        reason: `Reservation tracker updated to ${status}`,
        createdAt: now,
      });
    }

    await ctx.db.insert("reservationOperations", {
      tripId,
      actorId: user._id,
      operationId,
      requestFingerprint,
      targetStatus: status,
      resultVersion,
      changed,
      createdAt: now,
    });

    return {
      tripId,
      version: resultVersion,
      role: access.role,
      changed,
      itinerary: snapshot,
    };
  },
});

export const restoreRevision = mutation({
  args: {
    tripId: v.id("trips"),
    version: v.number(),
    expectedVersion: v.number(),
    operationId: v.string(),
  },
  handler: async (ctx, { tripId, version, expectedVersion, operationId }) => {
    requireOperationId(operationId, "trip restore");
    const user = await ensureCurrentUser(ctx);
    const access = await requireAccess(ctx, tripId, "editor");
    const requestFingerprintValue = requestFingerprint({
      tripId,
      version,
      expectedVersion,
    });
    const existingOperation = await ctx.db
      .query("tripWriteOperations")
      .withIndex("by_actor_and_operation", (q) =>
        q.eq("actorId", user._id).eq("operationId", operationId),
      )
      .unique();
    if (existingOperation) {
      if (
        existingOperation.operation !== "restore" ||
        existingOperation.tripId !== tripId ||
        existingOperation.requestFingerprint !== requestFingerprintValue
      ) {
        throw new Error("Trip write operation ID was already used for a different request");
      }
      const currentTrip = await ctx.db.get(tripId);
      if (!currentTrip) throw new Error("Trip not found");
      return {
        tripId,
        version: currentTrip.currentVersion,
        restoredVersion: existingOperation.resultVersion,
        restoredFrom: version,
        role: access.role,
        itinerary: currentTrip.snapshot,
        replayed: true,
      };
    }
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      throw new Error("A positive integer expectedVersion is required");
    }
    if (access.trip.currentVersion !== expectedVersion) {
      throw new Error(
        `Trip version changed. Expected ${expectedVersion}, found ${access.trip.currentVersion}. Refresh before restoring a revision.`,
      );
    }
    const revision = await ctx.db
      .query("tripRevisions")
      .withIndex("by_trip_and_version", (q) => q.eq("tripId", tripId).eq("version", version))
      .unique();
    if (!revision) throw new Error("Trip revision not found");

    const nextVersion = access.trip.currentVersion + 1;
    const now = Date.now();
    await ctx.db.patch(tripId, {
      ...itineraryMetadata(revision.snapshot),
      snapshot: revision.snapshot,
      currentVersion: nextVersion,
      updatedAt: now,
    });
    await ctx.db.insert("tripRevisions", {
      tripId,
      version: nextVersion,
      snapshot: revision.snapshot,
      actorId: user._id,
      reason: `Restored version ${version}`,
      createdAt: now,
    });
    await ctx.db.insert("tripWriteOperations", {
      tripId,
      actorId: user._id,
      operationId,
      operation: "restore",
      requestFingerprint: requestFingerprintValue,
      resultVersion: nextVersion,
      createdAt: now,
    });
    return {
      tripId,
      version: nextVersion,
      restoredVersion: nextVersion,
      restoredFrom: version,
      role: access.role,
      itinerary: revision.snapshot,
      replayed: false,
    };
  },
});
