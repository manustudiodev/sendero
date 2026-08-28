import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  internalMutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { requireAccess, type MemberRole } from "./tripAccess";

export const INVITATION_EMAIL_MAX_ATTEMPTS = 5;
export const INVITATION_EMAIL_LEASE_MS = 60_000;

type Purpose = "invite" | "resend";
type ProviderEvent =
  | "accepted"
  | "delivered"
  | "delayed"
  | "bounced"
  | "complained"
  | "failed";

const providerEvent = v.union(
  v.literal("accepted"),
  v.literal("delivered"),
  v.literal("delayed"),
  v.literal("bounced"),
  v.literal("complained"),
  v.literal("failed"),
);

function dispatchReference() {
  // Generated API types are refreshed by `convex dev`; the runtime reference
  // is already stable while adding this module in the same deployment.
  return (internal as any).invitationEmailOutboxNode.dispatch;
}

function requireWorkerId(value: string) {
  if (value.length < 8 || value.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(value)) {
    throw new Error("Invalid invitation email worker ID");
  }
}

function requireErrorCode(value: string) {
  if (value.length < 1 || value.length > 100 || !/^[a-z0-9_:-]+$/i.test(value)) {
    throw new Error("Invalid invitation email error code");
  }
}

function idempotencyKey(
  purpose: Purpose,
  actorId: Id<"users">,
  tripId: Id<"trips">,
  operationId: string,
) {
  return `${purpose}/${actorId}/${tripId}/${operationId}`;
}

function deterministicJitter(key: string) {
  let hash = 0;
  for (const character of key) hash = Math.imul(hash ^ character.charCodeAt(0), 16_777_619);
  return Math.abs(hash % 10_000);
}

async function exactOperationJobs(
  ctx: MutationCtx,
  job: Doc<"invitationEmailOutbox">,
) {
  return (
    await ctx.db
      .query("invitationEmailOutbox")
      .withIndex("by_invitation", (q) => q.eq("invitationId", job.invitationId))
      .collect()
  ).filter(
    (candidate) =>
      candidate.tripId === job.tripId &&
      candidate.actorId === job.actorId &&
      candidate.operationId === job.operationId &&
      candidate.purpose === job.purpose,
  );
}

async function failDuplicateOperationJobs(
  ctx: MutationCtx,
  matches: Doc<"invitationEmailOutbox">[],
  now: number,
) {
  if (matches.length <= 1) return false;
  for (const candidate of matches) {
    if (["sent", "not_configured", "failed"].includes(candidate.status)) continue;
    await ctx.db.patch(candidate._id, {
      status: "failed",
      lastErrorCode: "duplicate_legacy_delivery",
      terminalAt: now,
      leaseOwner: undefined,
      leaseExpiresAt: undefined,
      updatedAt: now,
    });
  }
  return true;
}

export function invitationEmailRetryDelayMs({
  attemptCount,
  idempotencyKey: key,
  retryAfterMs,
}: {
  attemptCount: number;
  idempotencyKey: string;
  retryAfterMs?: number;
}) {
  const exponential = Math.min(30_000 * 4 ** Math.max(0, attemptCount - 1), 2 * 60 * 60 * 1000);
  const requested = Number.isFinite(retryAfterMs) ? Math.max(0, retryAfterMs!) : 0;
  return Math.max(exponential + deterministicJitter(key), requested);
}

export async function enqueueInvitationEmail(
  ctx: MutationCtx,
  {
    tripId,
    invitationId,
    actorId,
    operationId,
    purpose,
    recipientEmail,
    role,
    tokenHash,
    invitationSentAt,
    now = Date.now(),
  }: {
    tripId: Id<"trips">;
    invitationId: Id<"tripInvitations">;
    actorId: Id<"users">;
    operationId: string;
    purpose: Purpose;
    recipientEmail: string;
    role: MemberRole;
    tokenHash: string;
    invitationSentAt: number;
    now?: number;
  },
) {
  const key = idempotencyKey(purpose, actorId, tripId, operationId);
  const invitation = await ctx.db.get(invitationId);
  if (
    !invitation ||
    invitation.tripId !== tripId ||
    invitation.status !== "pending" ||
    invitation.expiresAt <= now ||
    invitation.invitedEmail !== recipientEmail ||
    invitation.role !== role ||
    invitation.tokenHash !== tokenHash ||
    invitation.sentAt !== invitationSentAt
  ) {
    throw new Error("Invitation delivery no longer matches the pending invitation");
  }

  const bindExactExisting = async (job: Doc<"invitationEmailOutbox">) => {
    if (
      job.tripId !== tripId ||
      job.invitationId !== invitationId ||
      job.actorId !== actorId ||
      job.operationId !== operationId ||
      job.recipientEmail !== recipientEmail ||
      job.role !== role ||
      job.purpose !== purpose ||
      (job.tokenHash !== undefined && job.tokenHash !== tokenHash) ||
      (job.invitationSentAt !== undefined &&
        job.invitationSentAt !== invitationSentAt)
    ) {
      throw new Error("Invitation delivery operation was already used for a different request");
    }

    const missingGeneration =
      job.tokenHash === undefined || job.invitationSentAt === undefined;
    if (!missingGeneration) return job;

    // Provider idempotency is immutable after the first attempt. Only a job
    // that has never been claimed can safely move from the historical
    // `${purpose}/${operationId}` key to the actor/trip-scoped key.
    const canRekey = job.status === "queued" && job.attemptCount === 0;
    await ctx.db.patch(job._id, {
      tokenHash,
      invitationSentAt,
      ...(canRekey ? { idempotencyKey: key } : {}),
      updatedAt: now,
    });

    if (job.status === "queued") {
      if (job.availableAt <= now) {
        await ctx.scheduler.runAfter(0, dispatchReference(), { outboxId: job._id });
      } else {
        await ctx.scheduler.runAt(job.availableAt, dispatchReference(), {
          outboxId: job._id,
        });
      }
    } else if (job.status === "retry_scheduled") {
      await ctx.scheduler.runAt(job.availableAt, dispatchReference(), {
        outboxId: job._id,
      });
    } else if (
      job.status === "processing" &&
      (job.leaseExpiresAt ?? 0) <= now
    ) {
      await ctx.scheduler.runAfter(0, dispatchReference(), { outboxId: job._id });
    }
    return await ctx.db.get(job._id);
  };

  const existing = await ctx.db
    .query("invitationEmailOutbox")
    .withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", key))
    .unique();
  if (existing) {
    return bindExactExisting(existing);
  }

  // Deployments before actor/trip scoping used `${purpose}/${operationId}`.
  // Reuse an exact legacy job instead of sending the same invitation again
  // when a client retries across the deployment boundary.
  const legacyMatches = (
    await ctx.db
      .query("invitationEmailOutbox")
      .withIndex("by_invitation", (q) => q.eq("invitationId", invitationId))
      .collect()
  ).filter(
    (job) =>
      job.tripId === tripId &&
      job.actorId === actorId &&
      job.operationId === operationId &&
      job.purpose === purpose,
  );
  if (legacyMatches.length > 1) {
    throw new Error("Multiple invitation delivery jobs match this legacy operation");
  }
  if (legacyMatches[0]) {
    return bindExactExisting(legacyMatches[0]);
  }

  const outboxId = await ctx.db.insert("invitationEmailOutbox", {
    tripId,
    invitationId,
    actorId,
    operationId,
    idempotencyKey: key,
    purpose,
    recipientEmail,
    role,
    tokenHash,
    invitationSentAt,
    status: "queued",
    attemptCount: 0,
    maxAttempts: INVITATION_EMAIL_MAX_ATTEMPTS,
    availableAt: now,
    createdAt: now,
    updatedAt: now,
  });
  await ctx.scheduler.runAfter(0, dispatchReference(), { outboxId });
  return await ctx.db.get(outboxId);
}

export const claim = internalMutation({
  args: {
    outboxId: v.id("invitationEmailOutbox"),
    workerId: v.string(),
  },
  handler: async (ctx, { outboxId, workerId }) => {
    requireWorkerId(workerId);
    const now = Date.now();
    const job = await ctx.db.get(outboxId);
    if (!job) return null;
    if (["sent", "not_configured", "failed"].includes(job.status)) return null;
    if (
      await failDuplicateOperationJobs(
        ctx,
        await exactOperationJobs(ctx, job),
        now,
      )
    ) {
      return null;
    }
    if (job.status === "processing" && (job.leaseExpiresAt ?? 0) > now) return null;
    if (job.status !== "processing" && job.availableAt > now) return null;

    const invitation = await ctx.db.get(job.invitationId);
    if (
      !invitation ||
      invitation.tripId !== job.tripId ||
      invitation.status !== "pending" ||
      invitation.expiresAt <= now
    ) {
      await ctx.db.patch(job._id, {
        status: "failed",
        lastErrorCode: "invitation_not_pending",
        terminalAt: now,
        leaseOwner: undefined,
        leaseExpiresAt: undefined,
        updatedAt: now,
      });
      return null;
    }

    if (!job.tokenHash || job.invitationSentAt === undefined) {
      return {
        needsGenerationBinding: true as const,
        outboxId: job._id,
        tripId: job.tripId,
        invitationId: job.invitationId,
        operationId: job.operationId,
        purpose: job.purpose,
        recipientEmail: job.recipientEmail,
        role: job.role,
        invitationTokenHash: invitation.tokenHash,
        invitationSentAt: invitation.sentAt,
      };
    }

    if (
      invitation.tokenHash !== job.tokenHash ||
      invitation.role !== job.role ||
      invitation.sentAt !== job.invitationSentAt
    ) {
      await ctx.db.patch(job._id, {
        status: "failed",
        lastErrorCode: "invitation_superseded",
        terminalAt: now,
        leaseOwner: undefined,
        leaseExpiresAt: undefined,
        updatedAt: now,
      });
      return null;
    }

    const trip = await ctx.db.get(job.tripId);
    const owner = trip ? await ctx.db.get(trip.ownerId) : null;
    if (!trip?.webId) {
      await ctx.db.patch(job._id, {
        status: "failed",
        lastErrorCode: "trip_web_id_missing",
        terminalAt: now,
        updatedAt: now,
      });
      return null;
    }

    const attemptCount = job.attemptCount + 1;
    const leaseExpiresAt = now + INVITATION_EMAIL_LEASE_MS;
    await ctx.db.patch(job._id, {
      status: "processing",
      attemptCount,
      lastAttemptAt: now,
      leaseOwner: workerId,
      leaseExpiresAt,
      lastErrorCode: undefined,
      updatedAt: now,
    });
    // If the action dies after claiming, this scheduled no-op/reclaim prevents
    // the job from remaining stuck in processing forever.
    await ctx.scheduler.runAt(leaseExpiresAt, dispatchReference(), { outboxId });

    return {
      outboxId: job._id,
      tripId: job.tripId,
      invitationId: job.invitationId,
      operationId: job.operationId,
      idempotencyKey: job.idempotencyKey,
      purpose: job.purpose,
      recipientEmail: job.recipientEmail,
      role: job.role,
      tokenHash: job.tokenHash,
      invitationSentAt: job.invitationSentAt,
      attemptCount,
      maxAttempts: job.maxAttempts,
      workerId,
      webId: trip.webId,
      tripTitle: trip.title,
      ownerName: owner?.name,
    };
  },
});

export const bindLegacyGeneration = internalMutation({
  args: {
    outboxId: v.id("invitationEmailOutbox"),
    derivedTokenHash: v.string(),
  },
  handler: async (ctx, { outboxId, derivedTokenHash }) => {
    const now = Date.now();
    const job = await ctx.db.get(outboxId);
    if (!job || ["sent", "not_configured", "failed"].includes(job.status)) {
      return { status: "unavailable" as const };
    }
    if (
      await failDuplicateOperationJobs(
        ctx,
        await exactOperationJobs(ctx, job),
        now,
      )
    ) {
      return { status: "failed" as const };
    }
    const invitation = await ctx.db.get(job.invitationId);
    const generationMatches = Boolean(
      invitation &&
        invitation.tripId === job.tripId &&
        invitation.status === "pending" &&
        invitation.expiresAt > now &&
        invitation.invitedEmail === job.recipientEmail &&
        invitation.role === job.role &&
        invitation.tokenHash &&
        invitation.sentAt !== undefined &&
        invitation.tokenHash === derivedTokenHash &&
        (job.tokenHash === undefined || job.tokenHash === invitation.tokenHash) &&
        (job.invitationSentAt === undefined ||
          job.invitationSentAt === invitation.sentAt),
    );
    if (!generationMatches || !invitation?.tokenHash || invitation.sentAt === undefined) {
      await ctx.db.patch(job._id, {
        status: "failed",
        lastErrorCode: "invitation_superseded",
        terminalAt: now,
        leaseOwner: undefined,
        leaseExpiresAt: undefined,
        updatedAt: now,
      });
      return { status: "failed" as const };
    }

    const scopedKey = idempotencyKey(
      job.purpose,
      job.actorId,
      job.tripId,
      job.operationId,
    );
    const canRekey = job.status === "queued" && job.attemptCount === 0;
    await ctx.db.patch(job._id, {
      tokenHash: invitation.tokenHash,
      invitationSentAt: invitation.sentAt,
      ...(canRekey ? { idempotencyKey: scopedKey } : {}),
      updatedAt: now,
    });
    return { status: "bound" as const };
  },
});

export const recordLegacyBindingFailure = internalMutation({
  args: {
    outboxId: v.id("invitationEmailOutbox"),
    errorCode: v.string(),
    notConfigured: v.boolean(),
    expectedTokenHash: v.string(),
    expectedInvitationSentAt: v.number(),
  },
  handler: async (
    ctx,
    {
      outboxId,
      errorCode,
      notConfigured,
      expectedTokenHash,
      expectedInvitationSentAt,
    },
  ) => {
    requireErrorCode(errorCode);
    const job = await ctx.db.get(outboxId);
    if (!job || ["sent", "not_configured", "failed"].includes(job.status)) {
      return { status: job?.status ?? "unavailable" };
    }
    const now = Date.now();
    const invitation = await ctx.db.get(job.invitationId);
    const stillUnbound =
      job.tokenHash === undefined && job.invitationSentAt === undefined;
    const safeStatus =
      job.status === "queued" ||
      job.status === "retry_scheduled" ||
      (job.status === "processing" && (job.leaseExpiresAt ?? 0) <= now);
    const sameGeneration = Boolean(
      invitation &&
        invitation.status === "pending" &&
        invitation.expiresAt > now &&
        invitation.tokenHash === expectedTokenHash &&
        invitation.sentAt === expectedInvitationSentAt,
    );
    if (!stillUnbound || !safeStatus || !sameGeneration) {
      return { status: "superseded" as const };
    }
    const status = notConfigured ? ("not_configured" as const) : ("failed" as const);
    await ctx.db.patch(job._id, {
      status,
      lastErrorCode: errorCode,
      terminalAt: now,
      leaseOwner: undefined,
      leaseExpiresAt: undefined,
      updatedAt: now,
    });
    return { status };
  },
});

export const complete = internalMutation({
  args: {
    outboxId: v.id("invitationEmailOutbox"),
    workerId: v.string(),
    provider: v.string(),
    providerMessageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireWorkerId(args.workerId);
    const job = await ctx.db.get(args.outboxId);
    if (!job) throw new Error("Invitation email outbox job not found");
    if (job.status === "sent") return { status: job.status, replayed: true };
    if (job.status !== "processing" || job.leaseOwner !== args.workerId) {
      throw new Error("Invitation email outbox lease is no longer owned by this worker");
    }
    const now = Date.now();
    await ctx.db.patch(job._id, {
      status: "sent",
      provider: args.provider.slice(0, 80),
      providerMessageId: args.providerMessageId?.slice(0, 256),
      providerEvent: "accepted",
      providerEventAt: now,
      terminalAt: now,
      leaseOwner: undefined,
      leaseExpiresAt: undefined,
      lastErrorCode: undefined,
      updatedAt: now,
    });
    return { status: "sent" as const, replayed: false };
  },
});

export const recordFailure = internalMutation({
  args: {
    outboxId: v.id("invitationEmailOutbox"),
    workerId: v.string(),
    errorCode: v.string(),
    retryable: v.boolean(),
    notConfigured: v.optional(v.boolean()),
    retryAfterMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requireWorkerId(args.workerId);
    requireErrorCode(args.errorCode);
    const job = await ctx.db.get(args.outboxId);
    if (!job) throw new Error("Invitation email outbox job not found");
    if (["sent", "failed", "not_configured"].includes(job.status)) {
      return { status: job.status, replayed: true };
    }
    if (job.status !== "processing" || job.leaseOwner !== args.workerId) {
      throw new Error("Invitation email outbox lease is no longer owned by this worker");
    }

    const now = Date.now();
    if (args.notConfigured) {
      await ctx.db.patch(job._id, {
        status: "not_configured",
        lastErrorCode: args.errorCode,
        terminalAt: now,
        leaseOwner: undefined,
        leaseExpiresAt: undefined,
        updatedAt: now,
      });
      return { status: "not_configured" as const, replayed: false };
    }

    if (args.retryable && job.attemptCount < job.maxAttempts) {
      const delayMs = invitationEmailRetryDelayMs({
        attemptCount: job.attemptCount,
        idempotencyKey: job.idempotencyKey,
        retryAfterMs: args.retryAfterMs,
      });
      const availableAt = now + delayMs;
      await ctx.db.patch(job._id, {
        status: "retry_scheduled",
        availableAt,
        lastErrorCode: args.errorCode,
        leaseOwner: undefined,
        leaseExpiresAt: undefined,
        updatedAt: now,
      });
      await ctx.scheduler.runAt(availableAt, dispatchReference(), { outboxId: job._id });
      return { status: "retry_scheduled" as const, availableAt, replayed: false };
    }

    await ctx.db.patch(job._id, {
      status: "failed",
      lastErrorCode: args.errorCode,
      terminalAt: now,
      leaseOwner: undefined,
      leaseExpiresAt: undefined,
      updatedAt: now,
    });
    return { status: "failed" as const, replayed: false };
  },
});

const providerEventPriority: Record<ProviderEvent, number> = {
  accepted: 1,
  delayed: 2,
  delivered: 3,
  failed: 4,
  bounced: 5,
  complained: 6,
};

// HTTP webhook handlers must verify the provider signature, normalize its
// payload, and only then call this internal mutation.
export const recordProviderEvent = internalMutation({
  args: {
    provider: v.string(),
    providerMessageId: v.string(),
    event: providerEvent,
    occurredAt: v.number(),
  },
  handler: async (ctx, args) => {
    const matches = await ctx.db
      .query("invitationEmailOutbox")
      .withIndex("by_provider_message", (q) =>
        q.eq("provider", args.provider).eq("providerMessageId", args.providerMessageId),
      )
      .collect();
    if (matches.length !== 1) return { matched: false, changed: false };
    const job = matches[0];
    const currentOccurredAt = job.providerEventAt;
    if (
      currentOccurredAt !== undefined &&
      (args.occurredAt < currentOccurredAt ||
        (args.occurredAt === currentOccurredAt &&
          job.providerEvent &&
          providerEventPriority[job.providerEvent as ProviderEvent] >=
            providerEventPriority[args.event]))
    ) {
      return { matched: true, changed: false };
    }
    await ctx.db.patch(job._id, {
      providerEvent: args.event,
      providerEventAt: args.occurredAt,
      ...(args.event === "delivered" ? { deliveredAt: args.occurredAt } : {}),
      updatedAt: Date.now(),
    });
    return { matched: true, changed: true };
  },
});

export const getForInvitation = query({
  args: { invitationId: v.id("tripInvitations") },
  handler: async (ctx, { invitationId }) => {
    const invitation = await ctx.db.get(invitationId);
    if (!invitation) throw new Error("Invitation not found");
    await requireAccess(ctx, invitation.tripId, "owner");
    const jobs = await ctx.db
      .query("invitationEmailOutbox")
      .withIndex("by_invitation", (q) => q.eq("invitationId", invitationId))
      .collect();
    return jobs
      .sort((left, right) => {
        const freshness =
          right.createdAt - left.createdAt ||
          right.updatedAt - left.updatedAt ||
          right._creationTime - left._creationTime;
        return freshness || String(right._id).localeCompare(String(left._id));
      })
      .map((job) => ({
        id: job._id,
        purpose: job.purpose,
        status: job.status,
        attemptCount: job.attemptCount,
        maxAttempts: job.maxAttempts,
        availableAt: job.availableAt,
        provider: job.provider,
        providerEvent: job.providerEvent,
        providerEventAt: job.providerEventAt,
        lastAttemptAt: job.lastAttemptAt,
        lastErrorCode: job.lastErrorCode,
        deliveredAt: job.deliveredAt,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      }));
  },
});
