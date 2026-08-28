import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// `owner` is retained only so deployments can read legacy rows created before
// ownership became authoritative on trips.ownerId. New domain writes never
// create or authorize an owner collaborator.
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

const memberRole = v.union(v.literal("editor"), v.literal("viewer"));
const invitationStatus = v.union(
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("declined"),
  v.literal("expired"),
  v.literal("revoked"),
);
const invitationEmailPurpose = v.union(
  v.literal("invite"),
  v.literal("resend"),
);
const invitationEmailOutboxStatus = v.union(
  v.literal("queued"),
  v.literal("processing"),
  v.literal("retry_scheduled"),
  v.literal("sent"),
  v.literal("not_configured"),
  v.literal("failed"),
);
const invitationEmailProviderEvent = v.union(
  v.literal("accepted"),
  v.literal("delivered"),
  v.literal("delayed"),
  v.literal("bounced"),
  v.literal("complained"),
  v.literal("failed"),
);
const accessOperation = v.union(
  v.literal("invite"),
  v.literal("resend_invitation"),
  v.literal("migrate_legacy_invitation"),
  v.literal("change_role"),
  v.literal("remove_collaborator"),
  v.literal("revoke_invitation"),
  v.literal("accept_invitation"),
  v.literal("decline_invitation"),
);
const accessOperationStatus = v.union(
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("declined"),
  v.literal("expired"),
  v.literal("revoked"),
  v.literal("updated"),
  v.literal("removed"),
);
const accessAuditAction = v.union(
  v.literal("invitation_created"),
  v.literal("invitation_resent"),
  v.literal("invitation_accepted"),
  v.literal("invitation_declined"),
  v.literal("invitation_expired"),
  v.literal("invitation_revoked"),
  v.literal("collaborator_role_changed"),
  v.literal("collaborator_removed"),
  v.literal("legacy_invitation_migrated"),
  v.literal("legacy_invitation_accepted"),
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

const publicGuideSource = v.object({
  label: v.string(),
  url: v.string(),
  checkedAt: v.optional(v.string()),
});

const publicActivity = v.object({
  startTime: v.string(),
  endTime: v.optional(v.string()),
  title: v.string(),
  description: v.optional(v.string()),
  guide: v.optional(
    v.object({
      overview: v.string(),
      highlights: v.optional(v.array(v.string())),
      sources: v.array(publicGuideSource),
    }),
  ),
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
const publicShareTokenDerivation = v.object({
  purpose: v.union(v.literal("publish"), v.literal("rotate")),
  operationId: v.string(),
});
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
    emailVerified: v.optional(v.boolean()),
    name: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_token_identifier", ["tokenIdentifier"])
    .index("by_email", ["email"]),

  trips: defineTable({
    ownerId: v.id("users"),
    webId: v.optional(v.string()),
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
    .index("by_web_id", ["webId"])
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

  tripInvitations: defineTable({
    tripId: v.id("trips"),
    // Links an explicitly migrated pre-invitation collaborator row to its
    // modern bearer-backed invitation. This never grants access by itself.
    legacyCollaboratorId: v.optional(v.id("collaborators")),
    invitedEmail: v.string(),
    role: memberRole,
    status: invitationStatus,
    tokenHash: v.optional(v.string()),
    expiresAt: v.number(),
    invitedBy: v.id("users"),
    acceptedBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
    sentAt: v.optional(v.number()),
    acceptedAt: v.optional(v.number()),
    declinedAt: v.optional(v.number()),
    expiredAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
  })
    .index("by_trip", ["tripId"])
    .index("by_legacy_collaborator", ["legacyCollaboratorId"])
    .index("by_invited_email", ["invitedEmail"])
    .index("by_token_hash", ["tokenHash"])
    .index("by_trip_and_email", ["tripId", "invitedEmail"]),

  // Durable delivery intent. The bearer token is deliberately not persisted:
  // the worker derives it from operationId with SENDERO_INVITE_TOKEN_PEPPER.
  invitationEmailOutbox: defineTable({
    tripId: v.id("trips"),
    invitationId: v.id("tripInvitations"),
    actorId: v.id("users"),
    operationId: v.string(),
    idempotencyKey: v.string(),
    purpose: invitationEmailPurpose,
    recipientEmail: v.string(),
    role: memberRole,
    // Optional only so deployments can read jobs created before generation
    // binding existed. Every new job writes both values; the worker binds a
    // legacy job only after proving that it still matches the current pending
    // invitation generation, and otherwise fails it closed.
    tokenHash: v.optional(v.string()),
    invitationSentAt: v.optional(v.number()),
    status: invitationEmailOutboxStatus,
    attemptCount: v.number(),
    maxAttempts: v.number(),
    availableAt: v.number(),
    leaseOwner: v.optional(v.string()),
    leaseExpiresAt: v.optional(v.number()),
    provider: v.optional(v.string()),
    providerMessageId: v.optional(v.string()),
    providerEvent: v.optional(invitationEmailProviderEvent),
    providerEventAt: v.optional(v.number()),
    lastAttemptAt: v.optional(v.number()),
    lastErrorCode: v.optional(v.string()),
    deliveredAt: v.optional(v.number()),
    terminalAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_idempotency_key", ["idempotencyKey"])
    .index("by_invitation", ["invitationId"])
    .index("by_trip", ["tripId"])
    .index("by_status_and_available_at", ["status", "availableAt"])
    .index("by_provider_message", ["provider", "providerMessageId"]),

  tripAccessOperations: defineTable({
    tripId: v.id("trips"),
    actorId: v.id("users"),
    operationId: v.string(),
    operation: accessOperation,
    requestFingerprint: v.string(),
    resultInvitationId: v.optional(v.id("tripInvitations")),
    resultCollaboratorId: v.optional(v.id("collaborators")),
    resultStatus: accessOperationStatus,
    resultRole: v.optional(memberRole),
    resultExpiresAt: v.optional(v.number()),
    resultSentAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_actor_and_operation", ["actorId", "operationId"])
    .index("by_trip", ["tripId"]),

  tripAccessAuditEvents: defineTable({
    tripId: v.id("trips"),
    actorId: v.id("users"),
    action: accessAuditAction,
    targetUserId: v.optional(v.id("users")),
    targetEmail: v.optional(v.string()),
    invitationId: v.optional(v.id("tripInvitations")),
    previousRole: v.optional(memberRole),
    role: v.optional(memberRole),
    operationId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_trip", ["tripId"])
    .index("by_actor", ["actorId"]),

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
    tokenDerivation: v.optional(publicShareTokenDerivation),
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
