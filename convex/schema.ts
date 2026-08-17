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
});
