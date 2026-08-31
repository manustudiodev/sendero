"use node";

import { randomUUID } from "node:crypto";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import {
  deliverInvitationEmailOutboxJob,
  deriveInvitationToken,
  hashInvitationToken,
} from "../server/invitations.mjs";

type ClaimedOutboxJob =
  | {
      needsGenerationBinding: true;
      outboxId: Id<"invitationEmailOutbox">;
      tripId: Id<"trips">;
      invitationId: Id<"tripInvitations">;
      operationId: string;
      purpose: "invite" | "resend";
      recipientEmail: string;
      role: "editor" | "viewer";
      invitationTokenHash?: string;
      invitationSentAt?: number;
    }
  | {
      needsGenerationBinding?: false;
      outboxId: Id<"invitationEmailOutbox">;
      tripId: Id<"trips">;
      invitationId: Id<"tripInvitations">;
      operationId: string;
      idempotencyKey: string;
      purpose: "invite" | "resend";
      recipientEmail: string;
      role: "editor" | "viewer";
      tokenHash: string;
      invitationSentAt: number;
      attemptCount: number;
      maxAttempts: number;
      workerId: string;
      webId: string;
      tripTitle: string;
      ownerName?: string;
    };

type LegacyBindingResult = {
  status: "bound" | "failed" | "unavailable";
};

export const dispatch = internalAction({
  args: { outboxId: v.id("invitationEmailOutbox") },
  returns: v.any(),
  handler: async (ctx, { outboxId }): Promise<unknown> => {
    const workerId = `email:${randomUUID()}`;
    let job: ClaimedOutboxJob | null = await ctx.runMutation(
      (internal as any).invitationEmailOutbox.claim,
      { outboxId, workerId },
    );
    if (!job) return { status: "noop" as const };

    if (job.needsGenerationBinding) {
      let derivedTokenHash: string;
      try {
        const pepper = process.env.SENDERO_INVITE_TOKEN_PEPPER;
        const token = deriveInvitationToken({
          pepper,
          tripId: job.tripId,
          email: job.recipientEmail,
          operationId: job.operationId,
          purpose: job.purpose,
        });
        derivedTokenHash = hashInvitationToken(token, pepper);
      } catch {
        return ctx.runMutation(
          (internal as any).invitationEmailOutbox.recordLegacyBindingFailure,
          {
            outboxId,
            errorCode: "sendero_email_config_invalid",
            notConfigured: true,
            expectedTokenHash: job.invitationTokenHash,
            expectedInvitationSentAt: job.invitationSentAt,
          },
        );
      }
      const binding: LegacyBindingResult = await ctx.runMutation(
        (internal as any).invitationEmailOutbox.bindLegacyGeneration,
        { outboxId, derivedTokenHash },
      );
      if (binding.status !== "bound") return binding;
      job = await ctx.runMutation(
        (internal as any).invitationEmailOutbox.claim,
        { outboxId, workerId },
      );
      if (!job || job.needsGenerationBinding) return { status: "noop" as const };
    }

    const result = await deliverInvitationEmailOutboxJob(job, {
      pepper: process.env.SENDERO_INVITE_TOKEN_PEPPER,
      publicWebUrl: process.env.PUBLIC_WEB_URL,
    });
    if (result.outcome === "sent") {
      return ctx.runMutation((internal as any).invitationEmailOutbox.complete, {
        outboxId,
        workerId,
        provider: result.provider,
        ...(result.providerMessageId
          ? { providerMessageId: result.providerMessageId }
          : {}),
      });
    }
    return ctx.runMutation((internal as any).invitationEmailOutbox.recordFailure, {
      outboxId,
      workerId,
      errorCode: result.errorCode,
      retryable: result.outcome === "retry",
      ...(result.outcome === "not_configured" ? { notConfigured: true } : {}),
      ...(result.retryAfterMs !== undefined ? { retryAfterMs: result.retryAfterMs } : {}),
    });
  },
});
