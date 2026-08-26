import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const collaboratorRole = v.union(
  v.literal("owner"),
  v.literal("editor"),
  v.literal("viewer"),
);

const collaboratorStatus = v.union(
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("revoked"),
);

const transportMode = v.union(
  v.literal("walk"),
  v.literal("bike"),
  v.literal("public_transit"),
  v.literal("taxi"),
  v.literal("car"),
  v.literal("train"),
  v.literal("boat"),
  v.literal("other"),
);

const publicWeatherStatus = v.union(
  v.literal("forecast"),
  v.literal("seasonal"),
  v.literal("unknown"),
);

const publicActivity = v.object({
  startTime: v.string(),
  endTime: v.optional(v.string()),
  title: v.string(),
  description: v.optional(v.string()),
  category: v.optional(v.string()),
  location: v.optional(
    v.object({
      name: v.string(),
      address: v.optional(v.string()),
      lat: v.optional(v.number()),
      lng: v.optional(v.number()),
      latitude: v.optional(v.number()),
      longitude: v.optional(v.number()),
    }),
  ),
  sourceUrl: v.optional(v.string()),
  travelToNext: v.optional(
    v.object({
      mode: transportMode,
      durationMinutes: v.number(),
      summary: v.optional(v.string()),
    }),
  ),
});

const publicDay = v.object({
  date: v.string(),
  title: v.string(),
  area: v.string(),
  summary: v.optional(v.string()),
  weather: v.optional(
    v.object({
      status: publicWeatherStatus,
      summary: v.string(),
      sourceUrl: v.optional(v.string()),
      checkedAt: v.optional(v.string()),
    }),
  ),
  fallback: v.optional(v.string()),
  activities: v.array(publicActivity),
  route: v.optional(
    v.object({
      origin: v.string(),
      stops: v.array(v.string()),
      returnToLodging: v.boolean(),
      mapUrl: v.string(),
      mapUrls: v.optional(v.array(v.string())),
    }),
  ),
});

export const publicSnapshotValidator = v.object({
  schemaVersion: v.literal(1),
  title: v.string(),
  destination: v.string(),
  startDate: v.string(),
  endDate: v.string(),
  baseArea: v.optional(v.string()),
  transport: v.object({ modes: v.array(transportMode) }),
  days: v.array(publicDay),
  sources: v.optional(
    v.array(
      v.object({
        label: v.string(),
        url: v.string(),
        checkedAt: v.optional(v.string()),
      }),
    ),
  ),
});

const publicShareStatus = v.union(v.literal("active"), v.literal("revoked"));
const publicShareOperation = v.union(
  v.literal("publish"),
  v.literal("update"),
  v.literal("rotate"),
  v.literal("revoke"),
);
const publicShareOperationResult = v.union(
  v.literal("active"),
  v.literal("revoked"),
  v.literal("not_published"),
);
const reservationTrackingStatus = v.union(
  v.literal("pending"),
  v.literal("confirmed"),
  v.literal("cancelled"),
);

const tripWriteOperation = v.union(
  v.literal("save"),
  v.literal("restore"),
);

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_token_identifier", ["tokenIdentifier"])
    .index("by_email", ["email"]),

  trips: defineTable({
    ownerId: v.id("users"),
    title: v.string(),
    destination: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    snapshot: v.any(),
    currentVersion: v.number(),
    status: v.union(v.literal("active"), v.literal("archived")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_owner_and_status", ["ownerId", "status"]),

  collaborators: defineTable({
    tripId: v.id("trips"),
    userId: v.optional(v.id("users")),
    invitedEmail: v.optional(v.string()),
    role: collaboratorRole,
    status: collaboratorStatus,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_trip", ["tripId"])
    .index("by_user", ["userId"])
    .index("by_invited_email", ["invitedEmail"])
    .index("by_trip_and_user", ["tripId", "userId"])
    .index("by_trip_and_email", ["tripId", "invitedEmail"]),

  tripRevisions: defineTable({
    tripId: v.id("trips"),
    version: v.number(),
    snapshot: v.any(),
    actorId: v.id("users"),
    reason: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_trip", ["tripId"])
    .index("by_trip_and_version", ["tripId", "version"]),

  tripWriteOperations: defineTable({
    tripId: v.id("trips"),
    actorId: v.id("users"),
    operationId: v.string(),
    operation: tripWriteOperation,
    requestFingerprint: v.string(),
    resultVersion: v.number(),
    createdAt: v.number(),
  })
    .index("by_actor_and_operation", ["actorId", "operationId"])
    .index("by_trip", ["tripId"]),

  reservationOperations: defineTable({
    tripId: v.id("trips"),
    actorId: v.id("users"),
    operationId: v.string(),
    requestFingerprint: v.string(),
    targetStatus: reservationTrackingStatus,
    resultVersion: v.number(),
    changed: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_actor_and_operation", ["actorId", "operationId"])
    .index("by_trip", ["tripId"]),

  publicShares: defineTable({
    tripId: v.id("trips"),
    ownerId: v.id("users"),
    tokenHash: v.string(),
    sourceVersion: v.number(),
    publicSnapshot: publicSnapshotValidator,
    status: publicShareStatus,
    expiresAt: v.number(),
    generation: v.number(),
    publishedAt: v.number(),
    updatedAt: v.number(),
    revokedAt: v.optional(v.number()),
    rotatedAt: v.optional(v.number()),
  })
    .index("by_trip", ["tripId"])
    .index("by_token_hash", ["tokenHash"])
    .index("by_owner", ["ownerId"]),

  publicShareOperations: defineTable({
    tripId: v.id("trips"),
    ownerId: v.id("users"),
    operationId: v.string(),
    operation: publicShareOperation,
    tokenHash: v.optional(v.string()),
    requestFingerprint: v.string(),
    resultStatus: publicShareOperationResult,
    generation: v.number(),
    createdAt: v.number(),
  })
    .index("by_owner_and_operation", ["ownerId", "operationId"])
    .index("by_trip", ["tripId"]),
});
