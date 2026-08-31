import { createHmac, randomBytes as nodeRandomBytes, timingSafeEqual } from "node:crypto";
import {
  classifyInvitationEmailError,
  sendInvitationEmail,
} from "./email.mjs";

export const INVITATION_TOKEN_BYTES = 32;
export const INVITATION_TOKEN_LENGTH = 43;

function requirePepper(pepper) {
  if (typeof pepper !== "string" || Buffer.byteLength(pepper, "utf8") < 32) {
    throw new Error("SENDERO_INVITE_TOKEN_PEPPER must contain at least 32 bytes.");
  }
  return pepper;
}

export function isValidInvitationToken(value) {
  return (
    typeof value === "string" &&
    value.length === INVITATION_TOKEN_LENGTH &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

export function hashInvitationToken(token, pepper) {
  if (!isValidInvitationToken(token)) throw new Error("Invalid Sendero invitation token.");
  return createHmac("sha256", requirePepper(pepper))
    .update(`sendero-invitation:v1:${token}`)
    .digest("base64url");
}

export function createInvitationToken({
  pepper,
  randomBytes = nodeRandomBytes,
} = {}) {
  const token = Buffer.from(randomBytes(INVITATION_TOKEN_BYTES)).toString("base64url");
  if (!isValidInvitationToken(token)) {
    throw new Error("Unable to generate a valid Sendero invitation token.");
  }
  return { token, tokenHash: hashInvitationToken(token, pepper) };
}

export function deriveInvitationToken({ pepper, tripId, email, operationId, purpose = "invite" }) {
  const secret = requirePepper(pepper);
  if (!['invite', 'resend'].includes(purpose)) {
    throw new Error("Invitation token purpose must be invite or resend.");
  }
  if (typeof tripId !== "string" || tripId.length < 1 || tripId.length > 128) {
    throw new Error("A valid trip ID is required to derive an invitation token.");
  }
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!normalizedEmail || normalizedEmail.length > 254) {
    throw new Error("A valid invitation email is required.");
  }
  if (
    typeof operationId !== "string" ||
    !/^[A-Za-z0-9._:-]{8,128}$/.test(operationId)
  ) {
    throw new Error("A valid operation ID is required to derive an invitation token.");
  }
  return createHmac("sha256", secret)
    .update(JSON.stringify(["sendero-invite-token:v1", purpose, tripId, normalizedEmail, operationId]))
    .digest("base64url");
}

export function invitationLink({ publicWebUrl, webId, token }) {
  if (!isValidInvitationToken(token)) throw new Error("Invalid Sendero invitation token.");
  const base = new URL(publicWebUrl);
  if (base.protocol !== "https:" && base.hostname !== "localhost") {
    throw new Error("PUBLIC_WEB_URL must use HTTPS outside local development.");
  }
  if (typeof webId !== "string" || !/^[A-Za-z0-9_-]{16,128}$/.test(webId)) {
    throw new Error("Invalid Sendero web trip ID.");
  }
  const link = new URL(`/invite/${encodeURIComponent(webId)}`, base.origin);
  link.hash = new URLSearchParams({ token }).toString();
  return link.href;
}

export function tokenHashMatches(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export function invitationEmailIdempotencyKey({ purpose, actorId, tripId, operationId }) {
  if (!['invite', 'resend'].includes(purpose)) {
    throw new Error("Invitation email purpose must be invite or resend.");
  }
  if (
    typeof operationId !== "string" ||
    !/^[A-Za-z0-9._:-]{8,128}$/.test(operationId)
  ) {
    throw new Error("A valid operation ID is required for invitation delivery.");
  }
  for (const [label, value] of [["actor", actorId], ["trip", tripId]]) {
    if (
      typeof value !== "string" ||
      value.length < 1 ||
      value.length > 128 ||
      !/^[A-Za-z0-9._:-]+$/.test(value)
    ) {
      throw new Error(`A valid ${label} ID is required for invitation delivery.`);
    }
  }
  return `${purpose}/${actorId}/${tripId}/${operationId}`;
}

function requireOutboxJob(job) {
  if (!job || typeof job !== "object") throw new Error("Invitation outbox job is required.");
  if (typeof job.tripId !== "string" || typeof job.operationId !== "string") {
    throw new Error("Invitation outbox job is incomplete.");
  }
  if (typeof job.recipientEmail !== "string" || !["editor", "viewer"].includes(job.role)) {
    throw new Error("Invitation outbox recipient is invalid.");
  }
  if (
    typeof job.tokenHash !== "string" ||
    job.tokenHash.length < 32 ||
    !Number.isFinite(job.invitationSentAt)
  ) {
    throw new Error("Invitation outbox generation is invalid.");
  }
  return job;
}

/**
 * Delivers one already-claimed outbox job. The durable state transition remains
 * in Convex; this function only materializes the token and calls the provider.
 *
 * @param {unknown} job
 * @param {{
 *   pepper?: string,
 *   publicWebUrl?: string,
 *   send?: typeof sendInvitationEmail,
 * }} [options]
 * @returns {Promise<
 *   | { outcome: "sent", provider: string, providerMessageId?: string }
 *   | {
 *       outcome: "retry" | "failed" | "not_configured",
 *       errorCode: string,
 *       retryAfterMs?: number,
 *     }
 * >}
 */
export async function deliverInvitationEmailOutboxJob(
  job,
  {
    pepper,
    publicWebUrl,
    send = sendInvitationEmail,
  } = {},
) {
  const current = requireOutboxJob(job);
  if (typeof pepper !== "string" || typeof publicWebUrl !== "string") {
    return { outcome: "not_configured", errorCode: "sendero_email_config_missing" };
  }

  try {
    requirePepper(pepper);
    const publicOrigin = new URL(publicWebUrl);
    if (publicOrigin.protocol !== "https:" && publicOrigin.hostname !== "localhost") {
      throw new Error("PUBLIC_WEB_URL must use HTTPS outside local development.");
    }
  } catch {
    return { outcome: "not_configured", errorCode: "sendero_email_config_invalid" };
  }

  let inviteUrl;
  try {
    const token = deriveInvitationToken({
      pepper,
      tripId: current.tripId,
      email: current.recipientEmail,
      operationId: current.operationId,
      purpose: current.purpose,
    });
    if (!tokenHashMatches(hashInvitationToken(token, pepper), current.tokenHash)) {
      return { outcome: "failed", errorCode: "invitation_email_generation_mismatch" };
    }
    inviteUrl = invitationLink({
      publicWebUrl,
      webId: current.webId,
      token,
    });
  } catch {
    return { outcome: "failed", errorCode: "invitation_email_job_invalid" };
  }

  try {
    const delivery = await send({
      to: current.recipientEmail,
      role: current.role === "editor" ? "collaborator" : "viewer",
      inviteUrl,
      ownerName: current.ownerName,
      tripTitle: current.tripTitle,
      idempotencyKey: current.idempotencyKey,
    });
    if (delivery?.status === "not_configured") {
      return { outcome: "not_configured", errorCode: "provider_not_configured" };
    }
    if (delivery?.status !== "sent") {
      return { outcome: "retry", errorCode: "provider_invalid_result" };
    }
    return {
      outcome: "sent",
      provider: "resend",
      ...(typeof delivery.id === "string" ? { providerMessageId: delivery.id } : {}),
    };
  } catch (error) {
    const classified = classifyInvitationEmailError(error);
    return {
      outcome: classified.retryable ? "retry" : "failed",
      errorCode: classified.code,
      ...(classified.retryAfterMs !== undefined
        ? { retryAfterMs: classified.retryAfterMs }
        : {}),
    };
  }
}
