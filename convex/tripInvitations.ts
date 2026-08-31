import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import {
  cleanEmail,
  ensureCurrentUser,
  findCurrentUser,
  identityProfile,
  isMemberRole,
  provisionCurrentUser,
  requireAccess,
  upsertAcceptedCollaborator,
  type MemberRole,
} from "./tripAccess";
import { enqueueInvitationEmail } from "./invitationEmailOutbox";
import { canonicalLocale, DEFAULT_LOCALE } from "../shared/locale.mjs";

const memberRole = v.union(v.literal("editor"), v.literal("viewer"));
const DEFAULT_INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const INVITATION_SEND_LIMIT = 5;
const INVITATION_SEND_WINDOW_MS = 60 * 60 * 1000;

type Operation =
  | "invite"
  | "resend_invitation"
  | "migrate_legacy_invitation"
  | "change_role"
  | "remove_collaborator"
  | "revoke_invitation"
  | "accept_invitation"
  | "decline_invitation";
type OperationStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "expired"
  | "revoked"
  | "updated"
  | "removed";

function requireEmail(value: string) {
  const email = cleanEmail(value);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("A valid email is required");
  }
  return email;
}

function requireOperationId(operationId: string) {
  if (
    operationId.length < 8 ||
    operationId.length > 128 ||
    !/^[A-Za-z0-9._:-]+$/.test(operationId)
  ) {
    throw new Error("Invalid access operation ID");
  }
}

function requireTokenHash(tokenHash: string | undefined) {
  if (
    tokenHash !== undefined &&
    (tokenHash.length < 32 || tokenHash.length > 256 || !/^[A-Za-z0-9._:-]+$/.test(tokenHash))
  ) {
    throw new Error("Invalid invitation token hash");
  }
}

function validTokenHash(tokenHash: string) {
  return (
    tokenHash.length >= 32 &&
    tokenHash.length <= 256 &&
    /^[A-Za-z0-9._:-]+$/.test(tokenHash)
  );
}

function validWebId(webId: string) {
  return /^[A-Za-z0-9_-]{20,64}$/.test(webId);
}

function fingerprint(value: unknown) {
  const serialized = JSON.stringify(value);
  let high = 0x9e3779b9;
  let low = 0x85ebca6b;
  for (let index = 0; index < serialized.length; index += 1) {
    const code = serialized.charCodeAt(index);
    high = Math.imul(high ^ code, 0x5bd1e995);
    low = Math.imul(low ^ code, 0x27d4eb2d);
  }
  high =
    Math.imul(high ^ (high >>> 16), 0x85ebca6b) ^
    Math.imul(low ^ (low >>> 13), 0xc2b2ae35);
  low =
    Math.imul(low ^ (low >>> 16), 0x85ebca6b) ^
    Math.imul(high ^ (high >>> 13), 0xc2b2ae35);
  return `${serialized.length}:${(high >>> 0).toString(16).padStart(8, "0")}${(low >>> 0).toString(16).padStart(8, "0")}`;
}

async function replayOperation(
  ctx: MutationCtx,
  actorId: Id<"users">,
  operationId: string,
  operation: Operation,
  requestFingerprint: string,
) {
  const existing = await ctx.db
    .query("tripAccessOperations")
    .withIndex("by_actor_and_operation", (q) =>
      q.eq("actorId", actorId).eq("operationId", operationId),
    )
    .unique();
  if (!existing) return undefined;
  if (
    existing.operation !== operation ||
    existing.requestFingerprint !== requestFingerprint
  ) {
    throw new Error("Access operation ID was already used for a different request");
  }
  return {
    invitationId: existing.resultInvitationId,
    collaboratorId: existing.resultCollaboratorId,
    status: existing.resultStatus,
    role: existing.resultRole,
    ...(existing.resultExpiresAt !== undefined
      ? { expiresAt: existing.resultExpiresAt }
      : {}),
    ...(existing.resultSentAt !== undefined ? { sentAt: existing.resultSentAt } : {}),
    changed: false,
    replayed: true,
  };
}

async function recordOperation(
  ctx: MutationCtx,
  {
    tripId,
    actorId,
    operationId,
    operation,
    requestFingerprint,
    invitationId,
    collaboratorId,
    status,
    role,
    expiresAt,
    sentAt,
  }: {
    tripId: Id<"trips">;
    actorId: Id<"users">;
    operationId: string;
    operation: Operation;
    requestFingerprint: string;
    invitationId?: Id<"tripInvitations">;
    collaboratorId?: Id<"collaborators">;
    status: OperationStatus;
    role?: MemberRole;
    expiresAt?: number;
    sentAt?: number;
  },
) {
  await ctx.db.insert("tripAccessOperations", {
    tripId,
    actorId,
    operationId,
    operation,
    requestFingerprint,
    resultInvitationId: invitationId,
    resultCollaboratorId: collaboratorId,
    resultStatus: status,
    resultRole: role,
    resultExpiresAt: expiresAt,
    resultSentAt: sentAt,
    createdAt: Date.now(),
  });
}

async function audit(
  ctx: MutationCtx,
  event: {
    tripId: Id<"trips">;
    actorId: Id<"users">;
    action:
      | "invitation_created"
      | "invitation_resent"
      | "invitation_accepted"
      | "invitation_declined"
      | "invitation_expired"
      | "invitation_revoked"
      | "collaborator_role_changed"
      | "collaborator_removed"
      | "legacy_invitation_migrated";
    targetUserId?: Id<"users">;
    targetEmail?: string;
    invitationId?: Id<"tripInvitations">;
    previousRole?: MemberRole;
    role?: MemberRole;
    operationId?: string;
  },
) {
  await ctx.db.insert("tripAccessAuditEvents", { ...event, createdAt: Date.now() });
}

async function assertInvitationSendRateLimit(
  ctx: MutationCtx,
  {
    tripId,
    actorId,
    targetEmail,
    now,
  }: {
    tripId: Id<"trips">;
    actorId: Id<"users">;
    targetEmail: string;
    now: number;
  },
) {
  const events = await ctx.db
    .query("tripAccessAuditEvents")
    .withIndex("by_trip", (q) => q.eq("tripId", tripId))
    .collect();
  const windowStart = now - INVITATION_SEND_WINDOW_MS;
  const recentSends = events.filter(
    (event) =>
      event.actorId === actorId &&
      event.targetEmail === targetEmail &&
      event.createdAt >= windowStart &&
      (event.action === "invitation_created" ||
        event.action === "invitation_resent"),
  );
  if (recentSends.length >= INVITATION_SEND_LIMIT) {
    throw new Error("Too many invitation sends. Try again later");
  }
}

async function assertOwnerActor(
  ctx: MutationCtx,
  tripId: Id<"trips">,
  actor: Doc<"users">,
) {
  const trip = await ctx.db.get(tripId);
  if (!trip) throw new Error("Trip not found");
  if (trip.ownerId !== actor._id) throw new Error("Owner access required");
  return trip;
}

export async function inviteMemberCompatibility(
  ctx: MutationCtx,
  {
    tripId,
    actor,
    email,
    role,
    expiresAt,
    tokenHash,
    operationId,
  }: {
    tripId: Id<"trips">;
    actor: Doc<"users">;
    email: string;
    role: MemberRole;
    expiresAt?: number;
    tokenHash: string;
    operationId?: string;
  },
) {
  const trip = await assertOwnerActor(ctx, tripId, actor);
  const invitedEmail = requireEmail(email);
  requireTokenHash(tokenHash);
  if (!tokenHash) throw new Error("An invitation token hash is required");
  const owner = await ctx.db.get(trip.ownerId);
  if (owner?.email && cleanEmail(owner.email) === invitedEmail) {
    throw new Error("The trip owner already has access");
  }

  const now = Date.now();
  const invitations = await ctx.db
    .query("tripInvitations")
    .withIndex("by_trip_and_email", (q) =>
      q.eq("tripId", tripId).eq("invitedEmail", invitedEmail),
    )
    .collect();

  for (const stale of invitations) {
    if (stale.status === "pending" && stale.expiresAt <= now) {
      await ctx.db.patch(stale._id, {
        status: "expired",
        expiredAt: now,
        updatedAt: now,
      });
      await audit(ctx, {
        tripId,
        actorId: actor._id,
        action: "invitation_expired",
        targetEmail: invitedEmail,
        invitationId: stale._id,
        role: stale.role,
        operationId,
      });
    }
  }

  const reusable = invitations
    .filter((entry) => entry.status === "pending" && entry.expiresAt > now)
    .sort((left, right) => right.updatedAt - left.updatedAt)[0];
  const acceptedCollaborators = await ctx.db
    .query("collaborators")
    .withIndex("by_trip_and_email", (q) =>
      q.eq("tripId", tripId).eq("invitedEmail", invitedEmail),
    )
    .collect();
  if (
    acceptedCollaborators.some(
      (entry) => entry.status === "accepted" && isMemberRole(entry.role),
    )
  ) {
    throw new Error("This person already has access");
  }
  const invitationExpiresAt = expiresAt ?? reusable?.expiresAt ?? now + DEFAULT_INVITATION_TTL_MS;
  if (!Number.isFinite(invitationExpiresAt) || invitationExpiresAt <= now) {
    throw new Error("Invitation expiry must be in the future");
  }
  const status = "pending" as const;
  const effectiveTokenHash = tokenHash;

  let invitationId: Id<"tripInvitations">;
  let changed = true;
  let sentAt = now;
  if (reusable) {
    invitationId = reusable._id;
    changed =
      reusable.role !== role ||
      reusable.status !== status ||
      reusable.expiresAt !== invitationExpiresAt ||
      reusable.tokenHash !== effectiveTokenHash ||
      reusable.acceptedBy !== undefined;
    if (!changed && operationId) {
      throw new Error("A pending invitation already exists; resend it explicitly");
    }
    if (changed) {
      await assertInvitationSendRateLimit(ctx, {
        tripId,
        actorId: actor._id,
        targetEmail: invitedEmail,
        now,
      });
      await ctx.db.patch(reusable._id, {
        role,
        status,
        tokenHash: effectiveTokenHash,
        expiresAt: invitationExpiresAt,
        acceptedBy: undefined,
        acceptedAt: undefined,
        updatedAt: now,
        sentAt: now,
      });
    } else {
      sentAt = reusable.sentAt ?? reusable.updatedAt;
    }
  } else {
    await assertInvitationSendRateLimit(ctx, {
      tripId,
      actorId: actor._id,
      targetEmail: invitedEmail,
      now,
    });
    invitationId = await ctx.db.insert("tripInvitations", {
      tripId,
      invitedEmail,
      role,
      status,
      tokenHash: effectiveTokenHash,
      expiresAt: invitationExpiresAt,
      invitedBy: actor._id,
      createdAt: now,
      updatedAt: now,
      sentAt: now,
    });
  }

  if (!reusable || changed) {
    await audit(ctx, {
      tripId,
      actorId: actor._id,
      action: reusable ? "invitation_resent" : "invitation_created",
      targetEmail: invitedEmail,
      invitationId,
      role,
      operationId,
    });
  }

  return {
    invitationId,
    collaboratorId: undefined,
    role,
    status,
    expiresAt: invitationExpiresAt,
    sentAt,
    changed,
    replayed: false,
  };
}

export const listAccess = query({
  args: { tripId: v.id("trips") },
  handler: async (ctx, { tripId }) => {
    const access = await requireAccess(ctx, tripId, "owner");
    const owner = await ctx.db.get(access.trip.ownerId);
    const collaboratorRows = await ctx.db
      .query("collaborators")
      .withIndex("by_trip", (q) => q.eq("tripId", tripId))
      .collect();
    const collaborators = [];
    const legacyInvitations = [];
    for (const row of collaboratorRows) {
      if (
        row.status === "pending" &&
        isMemberRole(row.role) &&
        cleanEmail(row.invitedEmail)
      ) {
        legacyInvitations.push({
          id: row._id,
          email: cleanEmail(row.invitedEmail),
          role: row.role,
          status: "legacy_pending" as const,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        });
        continue;
      }
      if (row.status !== "accepted" || !isMemberRole(row.role) || !row.userId) continue;
      const user = await ctx.db.get(row.userId);
      collaborators.push({
        id: row._id,
        userId: row.userId,
        email: user?.email || row.invitedEmail,
        name: user?.name,
        role: row.role,
        status: "accepted" as const,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      });
    }
    const invitationRows = await ctx.db
      .query("tripInvitations")
      .withIndex("by_trip", (q) => q.eq("tripId", tripId))
      .collect();
    const invitationById = new Map(
      invitationRows.map((invitation) => [invitation._id, invitation]),
    );
    const deliveryRows = await ctx.db
      .query("invitationEmailOutbox")
      .withIndex("by_trip", (q) => q.eq("tripId", tripId))
      .collect();
    const latestDeliveryByInvitation = new Map();
    for (const delivery of deliveryRows) {
      const previous = latestDeliveryByInvitation.get(delivery.invitationId);
      const invitation = invitationById.get(delivery.invitationId);
      const matchesCurrentGeneration = Boolean(
        invitation?.tokenHash &&
          delivery.tokenHash === invitation.tokenHash &&
          delivery.invitationSentAt === invitation.sentAt &&
          delivery.role === invitation.role,
      );
      const previousMatchesCurrentGeneration = Boolean(
        invitation?.tokenHash &&
          previous?.tokenHash === invitation.tokenHash &&
          previous?.invitationSentAt === invitation.sentAt &&
          previous?.role === invitation.role,
      );
      const freshness = [
        delivery.invitationSentAt ?? -1,
        delivery.createdAt,
        delivery.updatedAt,
        delivery._creationTime ?? -1,
      ];
      const previousFreshness = previous
        ? [
            previous.invitationSentAt ?? -1,
            previous.createdAt,
            previous.updatedAt,
            previous._creationTime ?? -1,
          ]
        : [];
      const isFresher = freshness.some(
        (value, index) =>
          value !== previousFreshness[index] &&
          value > (previousFreshness[index] ?? -1) &&
          freshness.slice(0, index).every(
            (prefix, prefixIndex) => prefix === previousFreshness[prefixIndex],
          ),
      );
      const sameFreshness = previous && freshness.every(
        (value, index) => value === previousFreshness[index],
      );
      if (
        !previous ||
        (matchesCurrentGeneration && !previousMatchesCurrentGeneration) ||
        (matchesCurrentGeneration === previousMatchesCurrentGeneration &&
          (isFresher ||
            (sameFreshness && String(delivery._id) > String(previous._id))))
      ) {
        latestDeliveryByInvitation.set(delivery.invitationId, delivery);
      }
    }
    const now = Date.now();
    const invitations = invitationRows.map((entry) => {
      const delivery = latestDeliveryByInvitation.get(entry._id);
      return {
        id: entry._id,
        email: entry.invitedEmail,
        role: entry.role,
        status:
          entry.status === "pending" && entry.expiresAt <= now
            ? ("expired" as const)
            : entry.status,
        expiresAt: entry.expiresAt,
        sentAt: entry.sentAt,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        ...(delivery
          ? {
              delivery: {
                purpose: delivery.purpose,
                status: delivery.status,
                attemptCount: delivery.attemptCount,
                maxAttempts: delivery.maxAttempts,
                provider: delivery.provider,
                providerEvent: delivery.providerEvent,
                lastErrorCode: delivery.lastErrorCode,
                updatedAt: delivery.updatedAt,
              },
            }
          : {}),
      };
    });
    return {
      tripId,
      owner: {
        userId: access.trip.ownerId,
        email: owner?.email,
        name: owner?.name,
        role: "owner" as const,
      },
      collaborators,
      invitations,
      legacyInvitations,
    };
  },
});

export const getLegacyInvitationForMigration = query({
  args: {
    tripId: v.id("trips"),
    collaboratorId: v.id("collaborators"),
  },
  handler: async (ctx, { tripId, collaboratorId }) => {
    await requireAccess(ctx, tripId, "owner");
    const legacy = await ctx.db.get(collaboratorId);
    const invitedEmail = cleanEmail(legacy?.invitedEmail);
    if (
      !legacy ||
      legacy.tripId !== tripId ||
      !isMemberRole(legacy.role) ||
      !invitedEmail
    ) {
      throw new Error("Legacy pending invitation not found");
    }
    if (legacy.status === "pending") {
      return {
        id: legacy._id,
        email: invitedEmail,
        role: legacy.role,
        status: "legacy_pending" as const,
      };
    }
    if (legacy.status === "revoked") {
      const migration = await ctx.db
        .query("tripInvitations")
        .withIndex("by_legacy_collaborator", (q) =>
          q.eq("legacyCollaboratorId", collaboratorId),
        )
        .unique();
      if (
        migration &&
        migration.tripId === tripId &&
        migration.invitedEmail === invitedEmail
      ) {
        return {
          id: legacy._id,
          email: migration.invitedEmail,
          role: migration.role,
          status: "migrated" as const,
        };
      }
    }
    throw new Error("Legacy pending invitation not found");
  },
});

export const inspect = query({
  args: { webId: v.string(), tokenHash: v.string() },
  handler: async (ctx, { webId, tokenHash }) => {
    const unavailable = { state: "unavailable" as const };
    if (!validWebId(webId) || !validTokenHash(tokenHash)) return unavailable;
    const matches = await ctx.db
      .query("tripInvitations")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
      .collect();
    if (matches.length !== 1) return unavailable;
    const invitation = matches[0];
    if (invitation.status !== "pending" || invitation.expiresAt <= Date.now()) {
      return unavailable;
    }
    const trip = await ctx.db.get(invitation.tripId);
    if (!trip || trip.webId !== webId || trip.status !== "active") return unavailable;
    const inviter = await ctx.db.get(invitation.invitedBy);
    return {
      state: "available" as const,
      invitationId: invitation._id,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      inviterName: inviter?.name,
      trip: {
        webId: trip.webId,
        locale: canonicalLocale(trip.locale, canonicalLocale((trip.snapshot as Record<string, unknown>)?.locale, DEFAULT_LOCALE)),
        title: trip.title,
        destination: trip.destination,
        startDate: trip.startDate,
        endDate: trip.endDate,
      },
    };
  },
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const { currentIdentity, user } = await findCurrentUser(ctx);
    const profile = identityProfile(currentIdentity);
    if (
      !user ||
      !profile.email ||
      !profile.emailVerified ||
      user.emailVerified !== true ||
      user.email !== profile.email
    ) {
      throw new Error("A verified email is required to list invitations");
    }
    const rows = await ctx.db
      .query("tripInvitations")
      .withIndex("by_invited_email", (q) => q.eq("invitedEmail", profile.email!))
      .collect();
    const now = Date.now();
    const invitations = [];
    for (const entry of rows) {
      const trip = await ctx.db.get(entry.tripId);
      invitations.push({
        id: entry._id,
        tripId: entry.tripId,
        trip: trip
          ? {
              webId: trip.webId,
              title: trip.title,
              destination: trip.destination,
              startDate: trip.startDate,
              endDate: trip.endDate,
            }
          : undefined,
        role: entry.role,
        status:
          entry.status === "pending" && entry.expiresAt <= now
            ? ("expired" as const)
            : entry.status,
        expiresAt: entry.expiresAt,
        sentAt: entry.sentAt,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      });
    }
    return invitations.sort((left, right) => right.updatedAt - left.updatedAt);
  },
});

export const listAudit = query({
  args: { tripId: v.id("trips") },
  handler: async (ctx, { tripId }) => {
    await requireAccess(ctx, tripId, "owner");
    const events = await ctx.db
      .query("tripAccessAuditEvents")
      .withIndex("by_trip", (q) => q.eq("tripId", tripId))
      .collect();
    return events.sort((left, right) => right.createdAt - left.createdAt);
  },
});

export const invite = mutation({
  args: {
    tripId: v.id("trips"),
    email: v.string(),
    role: memberRole,
    expiresAt: v.optional(v.number()),
    tokenHash: v.string(),
    operationId: v.string(),
  },
  handler: async (ctx, args) => {
    requireOperationId(args.operationId);
    const actor = await ensureCurrentUser(ctx);
    await requireAccess(ctx, args.tripId, "owner");
    const requestFingerprint = fingerprint({
      tripId: args.tripId,
      email: requireEmail(args.email),
      role: args.role,
      tokenHash: args.tokenHash ?? null,
    });
    const replay = await replayOperation(
      ctx,
      actor._id,
      args.operationId,
      "invite",
      requestFingerprint,
    );
    if (replay) {
      const invitation = replay.invitationId
        ? await ctx.db.get(replay.invitationId)
        : null;
      let delivery = null;
      if (invitation) {
        const tokenHash = invitation.tokenHash;
        const invitationSentAt = invitation.sentAt;
        if (
          invitation.tripId !== args.tripId ||
          invitation.status !== "pending" ||
          invitation.expiresAt <= Date.now() ||
          !tokenHash ||
          tokenHash !== args.tokenHash ||
          invitationSentAt === undefined ||
          invitationSentAt !== replay.sentAt
        ) {
          throw new Error("Invitation changed after this invite operation");
        }
        delivery = await enqueueInvitationEmail(ctx, {
          tripId: args.tripId,
          invitationId: invitation._id,
          actorId: actor._id,
          operationId: args.operationId,
          purpose: "invite",
          recipientEmail: invitation.invitedEmail,
          role: invitation.role,
          tokenHash,
          invitationSentAt,
        });
      }
      return {
        ...replay,
        ...(delivery ? { delivery: { outboxId: delivery._id, status: delivery.status } } : {}),
      };
    }
    const result = await inviteMemberCompatibility(ctx, { ...args, actor });
    await recordOperation(ctx, {
      tripId: args.tripId,
      actorId: actor._id,
      operationId: args.operationId,
      operation: "invite",
      requestFingerprint,
      invitationId: result.invitationId,
      collaboratorId: result.collaboratorId,
      status: result.status,
      role: result.role,
      expiresAt: result.expiresAt,
      sentAt: result.sentAt,
    });
    const delivery = await enqueueInvitationEmail(ctx, {
      tripId: args.tripId,
      invitationId: result.invitationId,
      actorId: actor._id,
      operationId: args.operationId,
      purpose: "invite",
      recipientEmail: requireEmail(args.email),
      role: result.role,
      tokenHash: args.tokenHash,
      invitationSentAt: result.sentAt,
    });
    return {
      ...result,
      delivery: { outboxId: delivery!._id, status: delivery!.status },
    };
  },
});

export const migrateLegacyInvitation = mutation({
  args: {
    tripId: v.id("trips"),
    collaboratorId: v.id("collaborators"),
    tokenHash: v.string(),
    expiresAt: v.optional(v.number()),
    operationId: v.string(),
  },
  handler: async (ctx, args) => {
    requireOperationId(args.operationId);
    requireTokenHash(args.tokenHash);
    if (!args.tokenHash) throw new Error("An invitation token hash is required");
    const actor = await ensureCurrentUser(ctx);
    await requireAccess(ctx, args.tripId, "owner");
    const legacy = await ctx.db.get(args.collaboratorId);
    if (
      !legacy ||
      legacy.tripId !== args.tripId ||
      !isMemberRole(legacy.role)
    ) {
      throw new Error("Legacy pending invitation not found");
    }
    const invitedEmail = requireEmail(legacy.invitedEmail || "");
    const requestFingerprint = fingerprint({
      tripId: args.tripId,
      collaboratorId: args.collaboratorId,
      invitedEmail,
      role: legacy.role,
      tokenHash: args.tokenHash,
      expiresAt: args.expiresAt ?? null,
    });
    const replay = await replayOperation(
      ctx,
      actor._id,
      args.operationId,
      "migrate_legacy_invitation",
      requestFingerprint,
    );
    if (replay) {
      const invitation = replay.invitationId
        ? await ctx.db.get(replay.invitationId)
        : null;
      const migratedLegacy = replay.collaboratorId
        ? await ctx.db.get(replay.collaboratorId)
        : null;
      if (
        !invitation ||
        !migratedLegacy ||
        invitation.tripId !== args.tripId ||
        invitation.legacyCollaboratorId !== args.collaboratorId ||
        invitation.status !== "pending" ||
        invitation.expiresAt <= Date.now() ||
        invitation.tokenHash !== args.tokenHash ||
        invitation.sentAt === undefined ||
        invitation.sentAt !== replay.sentAt ||
        migratedLegacy.status !== "revoked"
      ) {
        throw new Error("Legacy invitation changed after this migration operation");
      }
      const delivery = await enqueueInvitationEmail(ctx, {
        tripId: args.tripId,
        invitationId: invitation._id,
        actorId: actor._id,
        operationId: args.operationId,
        purpose: "invite",
        recipientEmail: invitation.invitedEmail,
        role: invitation.role,
        tokenHash: invitation.tokenHash,
        invitationSentAt: invitation.sentAt,
      });
      return {
        ...replay,
        legacyCollaboratorId: migratedLegacy._id,
        delivery: { outboxId: delivery!._id, status: delivery!.status },
      };
    }

    if (legacy.status !== "pending") {
      throw new Error("Legacy pending invitation not found");
    }

    const previousMigration = await ctx.db
      .query("tripInvitations")
      .withIndex("by_legacy_collaborator", (q) =>
        q.eq("legacyCollaboratorId", args.collaboratorId),
      )
      .unique();
    if (previousMigration) {
      throw new Error("Legacy invitation was already migrated");
    }

    const result = await inviteMemberCompatibility(ctx, {
      tripId: args.tripId,
      actor,
      email: invitedEmail,
      role: legacy.role,
      expiresAt: args.expiresAt,
      tokenHash: args.tokenHash,
    });
    await ctx.db.patch(result.invitationId, {
      legacyCollaboratorId: args.collaboratorId,
    });
    const migratedAt = Date.now();
    await ctx.db.patch(args.collaboratorId, {
      status: "revoked",
      updatedAt: migratedAt,
    });
    await audit(ctx, {
      tripId: args.tripId,
      actorId: actor._id,
      action: "legacy_invitation_migrated",
      targetEmail: invitedEmail,
      invitationId: result.invitationId,
      previousRole: legacy.role,
      role: result.role,
      operationId: args.operationId,
    });
    await recordOperation(ctx, {
      tripId: args.tripId,
      actorId: actor._id,
      operationId: args.operationId,
      operation: "migrate_legacy_invitation",
      requestFingerprint,
      invitationId: result.invitationId,
      collaboratorId: args.collaboratorId,
      status: result.status,
      role: result.role,
      expiresAt: result.expiresAt,
      sentAt: result.sentAt,
    });
    const delivery = await enqueueInvitationEmail(ctx, {
      tripId: args.tripId,
      invitationId: result.invitationId,
      actorId: actor._id,
      operationId: args.operationId,
      purpose: "invite",
      recipientEmail: invitedEmail,
      role: result.role,
      tokenHash: args.tokenHash,
      invitationSentAt: result.sentAt,
    });
    return {
      ...result,
      legacyCollaboratorId: args.collaboratorId,
      delivery: { outboxId: delivery!._id, status: delivery!.status },
    };
  },
});

export const resendInvitation = mutation({
  args: {
    tripId: v.id("trips"),
    invitationId: v.id("tripInvitations"),
    tokenHash: v.string(),
    expiresAt: v.optional(v.number()),
    operationId: v.string(),
  },
  handler: async (ctx, args) => {
    requireOperationId(args.operationId);
    requireTokenHash(args.tokenHash);
    const actor = await ensureCurrentUser(ctx);
    await requireAccess(ctx, args.tripId, "owner");
    const requestFingerprint = fingerprint({
      tripId: args.tripId,
      invitationId: args.invitationId,
      tokenHash: args.tokenHash,
    });
    const replay = await replayOperation(
      ctx,
      actor._id,
      args.operationId,
      "resend_invitation",
      requestFingerprint,
    );
    if (replay) {
      const current = await ctx.db.get(args.invitationId);
      if (
        !current ||
        current.tripId !== args.tripId ||
        current.status !== "pending" ||
        current.expiresAt <= Date.now() ||
        current.tokenHash !== args.tokenHash ||
        current.sentAt === undefined ||
        replay.sentAt === undefined ||
        current.expiresAt !== replay.expiresAt ||
        current.sentAt !== replay.sentAt
      ) {
        throw new Error("Invitation changed after this resend operation");
      }
      const delivery = await enqueueInvitationEmail(ctx, {
        tripId: args.tripId,
        invitationId: current._id,
        actorId: actor._id,
        operationId: args.operationId,
        purpose: "resend",
        recipientEmail: current.invitedEmail,
        role: current.role,
        tokenHash: current.tokenHash,
        invitationSentAt: current.sentAt,
      });
      return {
        ...replay,
        delivery: { outboxId: delivery!._id, status: delivery!.status },
      };
    }

    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation || invitation.tripId !== args.tripId) {
      throw new Error("Invitation not found");
    }
    if (invitation.status !== "pending" && invitation.status !== "expired") {
      throw new Error(`Invitation cannot be resent after it is ${invitation.status}`);
    }
    if (invitation.tokenHash === args.tokenHash) {
      throw new Error("Resending an invitation requires a new token hash");
    }

    const sentAt = Date.now();
    await assertInvitationSendRateLimit(ctx, {
      tripId: args.tripId,
      actorId: actor._id,
      targetEmail: invitation.invitedEmail,
      now: sentAt,
    });
    const expiresAt = args.expiresAt ?? sentAt + DEFAULT_INVITATION_TTL_MS;
    if (!Number.isFinite(expiresAt) || expiresAt <= sentAt) {
      throw new Error("Invitation expiry must be in the future");
    }
    await ctx.db.patch(invitation._id, {
      status: "pending",
      tokenHash: args.tokenHash,
      expiresAt,
      sentAt,
      updatedAt: sentAt,
      acceptedBy: undefined,
      acceptedAt: undefined,
      declinedAt: undefined,
      expiredAt: undefined,
      revokedAt: undefined,
    });
    await audit(ctx, {
      tripId: args.tripId,
      actorId: actor._id,
      action: "invitation_resent",
      targetEmail: invitation.invitedEmail,
      invitationId: invitation._id,
      role: invitation.role,
      operationId: args.operationId,
    });
    await recordOperation(ctx, {
      tripId: args.tripId,
      actorId: actor._id,
      operationId: args.operationId,
      operation: "resend_invitation",
      requestFingerprint,
      invitationId: invitation._id,
      status: "pending",
      role: invitation.role,
      expiresAt,
      sentAt,
    });
    const delivery = await enqueueInvitationEmail(ctx, {
      tripId: args.tripId,
      invitationId: invitation._id,
      actorId: actor._id,
      operationId: args.operationId,
      purpose: "resend",
      recipientEmail: invitation.invitedEmail,
      role: invitation.role,
      tokenHash: args.tokenHash,
      invitationSentAt: sentAt,
    });
    return {
      invitationId: invitation._id,
      role: invitation.role,
      status: "pending" as const,
      expiresAt,
      sentAt,
      changed: true,
      replayed: false,
      delivery: { outboxId: delivery!._id, status: delivery!.status },
    };
  },
});

export const changeRole = mutation({
  args: {
    tripId: v.id("trips"),
    collaboratorId: v.id("collaborators"),
    role: memberRole,
    operationId: v.string(),
  },
  handler: async (ctx, args) => {
    requireOperationId(args.operationId);
    const actor = await ensureCurrentUser(ctx);
    await requireAccess(ctx, args.tripId, "owner");
    const requestFingerprint = fingerprint(args);
    const replay = await replayOperation(
      ctx,
      actor._id,
      args.operationId,
      "change_role",
      requestFingerprint,
    );
    if (replay) return replay;
    const collaborator = await ctx.db.get(args.collaboratorId);
    if (
      !collaborator ||
      collaborator.tripId !== args.tripId ||
      collaborator.status !== "accepted" ||
      !isMemberRole(collaborator.role) ||
      !collaborator.userId
    ) {
      throw new Error("Accepted collaborator not found");
    }
    const changed = collaborator.role !== args.role;
    if (changed) {
      const now = Date.now();
      await ctx.db.patch(collaborator._id, { role: args.role, updatedAt: now });
      if (collaborator.invitedEmail) {
        const invitedEmail = collaborator.invitedEmail;
        const invitations = await ctx.db
          .query("tripInvitations")
          .withIndex("by_trip_and_email", (q) =>
            q.eq("tripId", args.tripId).eq("invitedEmail", invitedEmail),
          )
          .collect();
        for (const invitation of invitations) {
          if (
            invitation.status === "accepted" &&
            (!collaborator.userId || invitation.acceptedBy === collaborator.userId)
          ) {
            await ctx.db.patch(invitation._id, { role: args.role, updatedAt: now });
          }
        }
      }
      await audit(ctx, {
        tripId: args.tripId,
        actorId: actor._id,
        action: "collaborator_role_changed",
        targetUserId: collaborator.userId,
        targetEmail: collaborator.invitedEmail,
        previousRole: collaborator.role,
        role: args.role,
        operationId: args.operationId,
      });
    }
    await recordOperation(ctx, {
      tripId: args.tripId,
      actorId: actor._id,
      operationId: args.operationId,
      operation: "change_role",
      requestFingerprint,
      collaboratorId: collaborator._id,
      status: "updated",
      role: args.role,
    });
    return {
      collaboratorId: collaborator._id,
      role: args.role,
      status: "updated" as const,
      changed,
      replayed: false,
    };
  },
});

export const removeCollaborator = mutation({
  args: {
    tripId: v.id("trips"),
    collaboratorId: v.id("collaborators"),
    operationId: v.string(),
  },
  handler: async (ctx, args) => {
    requireOperationId(args.operationId);
    const actor = await ensureCurrentUser(ctx);
    await requireAccess(ctx, args.tripId, "owner");
    const requestFingerprint = fingerprint(args);
    const replay = await replayOperation(
      ctx,
      actor._id,
      args.operationId,
      "remove_collaborator",
      requestFingerprint,
    );
    if (replay) return replay;
    const collaborator = await ctx.db.get(args.collaboratorId);
    if (
      !collaborator ||
      collaborator.tripId !== args.tripId ||
      !isMemberRole(collaborator.role)
    ) {
      throw new Error("Collaborator not found");
    }
    const migratedInvitation = await ctx.db
      .query("tripInvitations")
      .withIndex("by_legacy_collaborator", (q) =>
        q.eq("legacyCollaboratorId", args.collaboratorId),
      )
      .unique();
    if (migratedInvitation && migratedInvitation.tripId !== args.tripId) {
      throw new Error("Collaborator not found");
    }
    if (migratedInvitation?.status === "accepted") {
      throw new Error("Remove the accepted collaborator instead");
    }
    const changed =
      collaborator.status !== "revoked" ||
      Boolean(migratedInvitation && migratedInvitation.status !== "revoked");
    if (changed) {
      const now = Date.now();
      if (collaborator.status !== "revoked") {
        await ctx.db.patch(collaborator._id, { status: "revoked", updatedAt: now });
      }
      if (migratedInvitation && migratedInvitation.status !== "revoked") {
        await ctx.db.patch(migratedInvitation._id, {
          status: "revoked",
          revokedAt: now,
          updatedAt: now,
        });
      }
      if (collaborator.invitedEmail) {
        const invitedEmail = collaborator.invitedEmail;
        const invitations = await ctx.db
          .query("tripInvitations")
          .withIndex("by_trip_and_email", (q) =>
            q.eq("tripId", args.tripId).eq("invitedEmail", invitedEmail),
          )
          .collect();
        for (const invitation of invitations) {
          if (
            invitation.status === "accepted" &&
            (!collaborator.userId || invitation.acceptedBy === collaborator.userId)
          ) {
            await ctx.db.patch(invitation._id, {
              status: "revoked",
              revokedAt: now,
              updatedAt: now,
            });
          }
        }
      }
      await audit(ctx, {
        tripId: args.tripId,
        actorId: actor._id,
        action: "collaborator_removed",
        targetUserId: collaborator.userId,
        targetEmail: collaborator.invitedEmail,
        previousRole: collaborator.role,
        operationId: args.operationId,
      });
    }
    await recordOperation(ctx, {
      tripId: args.tripId,
      actorId: actor._id,
      operationId: args.operationId,
      operation: "remove_collaborator",
      requestFingerprint,
      collaboratorId: collaborator._id,
      status: "removed",
      role: collaborator.role,
    });
    return {
      collaboratorId: collaborator._id,
      role: collaborator.role,
      status: "removed" as const,
      changed,
      replayed: false,
    };
  },
});

export const revokeInvitation = mutation({
  args: {
    tripId: v.id("trips"),
    invitationId: v.id("tripInvitations"),
    operationId: v.string(),
  },
  handler: async (ctx, args) => {
    requireOperationId(args.operationId);
    const actor = await ensureCurrentUser(ctx);
    await requireAccess(ctx, args.tripId, "owner");
    const requestFingerprint = fingerprint(args);
    const replay = await replayOperation(
      ctx,
      actor._id,
      args.operationId,
      "revoke_invitation",
      requestFingerprint,
    );
    if (replay) return replay;
    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation || invitation.tripId !== args.tripId) {
      throw new Error("Invitation not found");
    }
    if (invitation.status === "accepted") {
      throw new Error("Remove the accepted collaborator instead");
    }
    const changed = invitation.status !== "revoked";
    if (changed) {
      await ctx.db.patch(invitation._id, {
        status: "revoked",
        revokedAt: Date.now(),
        updatedAt: Date.now(),
      });
      await audit(ctx, {
        tripId: args.tripId,
        actorId: actor._id,
        action: "invitation_revoked",
        targetEmail: invitation.invitedEmail,
        invitationId: invitation._id,
        role: invitation.role,
        operationId: args.operationId,
      });
    }
    await recordOperation(ctx, {
      tripId: args.tripId,
      actorId: actor._id,
      operationId: args.operationId,
      operation: "revoke_invitation",
      requestFingerprint,
      invitationId: invitation._id,
      status: "revoked",
      role: invitation.role,
    });
    return {
      invitationId: invitation._id,
      role: invitation.role,
      status: "revoked" as const,
      changed,
      replayed: false,
    };
  },
});

async function requireVerifiedInvitee(ctx: MutationCtx) {
  const user = await provisionCurrentUser(ctx);
  const currentIdentity = await ctx.auth.getUserIdentity();
  if (!currentIdentity) throw new Error("Unauthenticated");
  const profile = identityProfile(currentIdentity);
  if (!profile.email || !profile.emailVerified || user.emailVerified !== true) {
    throw new Error("A verified email is required to respond to an invitation");
  }
  return { user, email: profile.email };
}

function assertInvitationToken(invitation: Doc<"tripInvitations">, tokenHash?: string) {
  if (invitation.status === "accepted" && tokenHash !== undefined) {
    throw new Error("Invitation token is invalid");
  }
  if (invitation.tokenHash && invitation.tokenHash !== tokenHash) {
    throw new Error("Invitation token is invalid");
  }
}

export const accept = mutation({
  args: {
    invitationId: v.id("tripInvitations"),
    tokenHash: v.optional(v.string()),
    operationId: v.string(),
  },
  handler: async (ctx, args) => {
    requireOperationId(args.operationId);
    requireTokenHash(args.tokenHash);
    const { user, email } = await requireVerifiedInvitee(ctx);
    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation || invitation.invitedEmail !== email) {
      throw new Error("Invitation not found for this verified email");
    }
    const requestFingerprint = fingerprint(args);
    const replay = await replayOperation(
      ctx,
      user._id,
      args.operationId,
      "accept_invitation",
      requestFingerprint,
    );
    if (replay) return replay;
    assertInvitationToken(invitation, args.tokenHash);
    if (invitation.status === "accepted" && invitation.acceptedBy === user._id) {
      const memberships = await ctx.db
        .query("collaborators")
        .withIndex("by_trip_and_user", (q) =>
          q.eq("tripId", invitation.tripId).eq("userId", user._id),
        )
        .collect();
      const membership = memberships.find(
        (entry) => entry.status === "accepted" && isMemberRole(entry.role),
      );
      await recordOperation(ctx, {
        tripId: invitation.tripId,
        actorId: user._id,
        operationId: args.operationId,
        operation: "accept_invitation",
        requestFingerprint,
        invitationId: invitation._id,
        collaboratorId: membership?._id,
        status: "accepted",
        role: invitation.role,
      });
      return {
        invitationId: invitation._id,
        collaboratorId: membership?._id,
        status: "accepted" as const,
        role: invitation.role,
        changed: false,
        replayed: false,
      };
    }
    if (invitation.status !== "pending") {
      throw new Error(`Invitation is ${invitation.status}`);
    }
    const decisionAt = Date.now();
    if (invitation.expiresAt <= decisionAt) {
      await ctx.db.patch(invitation._id, {
        status: "expired",
        tokenHash: undefined,
        expiredAt: decisionAt,
        updatedAt: decisionAt,
      });
      await audit(ctx, {
        tripId: invitation.tripId,
        actorId: user._id,
        action: "invitation_expired",
        targetUserId: user._id,
        targetEmail: email,
        invitationId: invitation._id,
        role: invitation.role,
        operationId: args.operationId,
      });
      await recordOperation(ctx, {
        tripId: invitation.tripId,
        actorId: user._id,
        operationId: args.operationId,
        operation: "accept_invitation",
        requestFingerprint,
        invitationId: invitation._id,
        status: "expired",
        role: invitation.role,
      });
      return {
        invitationId: invitation._id,
        status: "expired" as const,
        role: invitation.role,
        changed: true,
        replayed: false,
      };
    }
    const membership = await upsertAcceptedCollaborator(ctx, {
      tripId: invitation.tripId,
      userId: user._id,
      invitedEmail: email,
      role: invitation.role,
      now: decisionAt,
    });
    if (membership.owner) throw new Error("The trip owner already has access");
    await ctx.db.patch(invitation._id, {
      status: "accepted",
      tokenHash: undefined,
      acceptedBy: user._id,
      acceptedAt: decisionAt,
      updatedAt: decisionAt,
    });
    await audit(ctx, {
      tripId: invitation.tripId,
      actorId: user._id,
      action: "invitation_accepted",
      targetUserId: user._id,
      targetEmail: email,
      invitationId: invitation._id,
      role: invitation.role,
      operationId: args.operationId,
    });
    await recordOperation(ctx, {
      tripId: invitation.tripId,
      actorId: user._id,
      operationId: args.operationId,
      operation: "accept_invitation",
      requestFingerprint,
      invitationId: invitation._id,
      collaboratorId: membership.collaboratorId,
      status: "accepted",
      role: invitation.role,
    });
    return {
      invitationId: invitation._id,
      collaboratorId: membership.collaboratorId,
      status: "accepted" as const,
      role: invitation.role,
      changed: true,
      replayed: false,
    };
  },
});

export const decline = mutation({
  args: {
    invitationId: v.id("tripInvitations"),
    tokenHash: v.optional(v.string()),
    operationId: v.string(),
  },
  handler: async (ctx, args) => {
    requireOperationId(args.operationId);
    requireTokenHash(args.tokenHash);
    const { user, email } = await requireVerifiedInvitee(ctx);
    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation || invitation.invitedEmail !== email) {
      throw new Error("Invitation not found for this verified email");
    }
    assertInvitationToken(invitation, args.tokenHash);
    const requestFingerprint = fingerprint(args);
    const replay = await replayOperation(
      ctx,
      user._id,
      args.operationId,
      "decline_invitation",
      requestFingerprint,
    );
    if (replay) return replay;
    if (invitation.status !== "pending") {
      throw new Error(`Invitation is ${invitation.status}`);
    }
    const now = Date.now();
    const expired = invitation.expiresAt <= now;
    const status = expired ? ("expired" as const) : ("declined" as const);
    await ctx.db.patch(invitation._id, {
      status,
      updatedAt: now,
      ...(expired ? { expiredAt: now } : { declinedAt: now }),
    });
    await audit(ctx, {
      tripId: invitation.tripId,
      actorId: user._id,
      action: expired ? "invitation_expired" : "invitation_declined",
      targetUserId: user._id,
      targetEmail: email,
      invitationId: invitation._id,
      role: invitation.role,
      operationId: args.operationId,
    });
    await recordOperation(ctx, {
      tripId: invitation.tripId,
      actorId: user._id,
      operationId: args.operationId,
      operation: "decline_invitation",
      requestFingerprint,
      invitationId: invitation._id,
      status,
      role: invitation.role,
    });
    return {
      invitationId: invitation._id,
      status,
      role: invitation.role,
      changed: true,
      replayed: false,
    };
  },
});
