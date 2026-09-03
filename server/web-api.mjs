import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  deriveInvitationToken,
  hashInvitationToken,
  isValidInvitationToken,
} from "./invitations.mjs";
import {
  buildPublicShareUrl,
  derivePublicShareToken,
  hashPublicShareToken,
  isActivePublicShareConflict,
  publicShareExpiresAt,
  recoverPublicShareUrl,
} from "./public-sharing.mjs";
import { canonicalLocale, DEFAULT_LOCALE, localeLanguage } from "../shared/locale.mjs";
import {
  DestinationSuggestionsError,
  destinationSuggestions,
  destinationSuggestionsRequestSchema,
} from "./destination-suggestions.mjs";
import {
  draftSummary,
  ItineraryPlanningError,
  MAX_ITINERARY_BODY_BYTES,
  planningProtocol,
  planningProtocolIdentity,
  planningProtocolRequestSchema,
  saveDraftRequestSchema,
  stageItineraryRequestSchema,
  validatedDraft,
} from "./itinerary-planning.mjs";

const MAX_BODY_BYTES = 16 * 1024;
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const WEB_ID_PATTERN = /^[A-Za-z0-9_-]{20,64}$/;
const OPERATION_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

const webIdSchema = z.string().regex(WEB_ID_PATTERN);
const operationIdSchema = z.string().regex(OPERATION_ID_PATTERN);
const memberRoleSchema = z.enum(["viewer", "editor"]);
const emailSchema = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const reservationStatusSchema = z.enum(["pending", "confirmed", "cancelled"]);
const itineraryDraftIdSchema = z.string().min(16).max(128).regex(/^[A-Za-z0-9_-]+$/);

const reservationSchema = z.object({
  activityId: z.string().min(1).max(160),
  dayDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expectedVersion: z.number().int().positive(),
  operationId: operationIdSchema,
  status: reservationStatusSchema,
}).strict();

const inviteSchema = z.object({
  email: emailSchema,
  operationId: operationIdSchema,
  role: memberRoleSchema,
}).strict();

const operationSchema = z.object({ operationId: operationIdSchema }).strict();
const roleSchema = z.object({
  operationId: operationIdSchema,
  role: memberRoleSchema,
}).strict();
const accessSchema = z.object({
  generalAccess: z.enum(["restricted", "public_link"]),
  operationId: operationIdSchema,
}).strict();
const inspectSchema = z.object({
  token: z.string().optional(),
  webId: z.string().optional(),
}).strict();

function permissionsForRole(role) {
  return {
    editInSendero: role === "owner" || role === "editor",
    manageAccess: role === "owner",
    publish: role === "owner",
    updateReservationStatus: role === "owner" || role === "editor",
    view: true,
  };
}

function isoTime(value) {
  return Number.isFinite(Number(value)) ? new Date(Number(value)).toISOString() : "";
}

function localeForTrip(trip) {
  return canonicalLocale(
    trip?.locale,
    canonicalLocale(trip?.itinerary?.locale, DEFAULT_LOCALE),
  );
}

function itineraryWithLocale(itinerary, fallback = DEFAULT_LOCALE) {
  if (!itinerary || typeof itinerary !== "object" || Array.isArray(itinerary)) {
    return itinerary;
  }
  return {
    ...itinerary,
    locale: canonicalLocale(itinerary.locale, fallback),
  };
}

function safeTripSummary(trip) {
  return {
    webId: trip.webId,
    locale: localeForTrip(trip),
    title: trip.title,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    currentVersion: trip.currentVersion,
    role: trip.role,
    updatedAt: isoTime(trip.updatedAt),
  };
}

async function ensureWebTripSummary(storage, trip) {
  if (trip.webId) return safeTripSummary(trip);
  const { webId } = await storage.ensureWebId(trip.id);
  return safeTripSummary({ ...trip, webId });
}

function tripEnvelope(trip) {
  const locale = localeForTrip(trip);
  return {
    trip: {
      webId: trip.webId,
      locale,
      role: trip.role,
      version: trip.version,
      updatedAt: isoTime(trip.updatedAt),
      itinerary: itineraryWithLocale(trip.itinerary, locale),
      permissions: permissionsForRole(trip.role),
    },
  };
}

function invitationDetails(inspection, invitedEmail = "") {
  const locale = canonicalLocale(inspection.trip?.locale, DEFAULT_LOCALE);
  const fallbackTitle = {
    en: "Shared trip",
    es: "Viaje compartido",
    pt: "Viagem compartilhada",
    fr: "Voyage partagé",
    de: "Geteilte Reise",
  }[localeLanguage(locale)] || "Shared trip";
  return {
    destination: inspection.trip?.destination || "",
    expiresAt: isoTime(inspection.expiresAt),
    invitedEmail,
    inviterName: inspection.inviterName || "",
    locale,
    role: inspection.role,
    title: inspection.trip?.title || fallbackTitle,
    webId: inspection.trip?.webId || "",
  };
}

function errorResponse(context, code, status, message, retryable = status >= 500) {
  return context.json({ error: { code, message, retryable } }, status);
}

function mappedFailure(context, error, logger) {
  if (error instanceof DestinationSuggestionsError) {
    return errorResponse(context, error.code, error.status, error.message, error.retryable);
  }
  if (error instanceof ItineraryPlanningError) {
    return context.json({
      error: {
        code: error.code,
        message: error.message,
        retryable: false,
        ...(error.details ? { details: error.details } : {}),
      },
    }, error.status);
  }
  const message = typeof error?.message === "string" ? error.message : "";
  if (/Unauthenticated|Sign in|authentication/i.test(message)) {
    return errorResponse(context, "authentication_required", 401, "Sign in to continue.");
  }
  if (/Owner access|Only the trip owner|Editor access|access denied|required access/i.test(message)) {
    return errorResponse(context, "forbidden", 403, "You do not have permission to make that change.");
  }
  if (/not found/i.test(message)) {
    return errorResponse(context, "not_found", 404, "We could not find that resource.");
  }
  if (/version changed|changed after|already has|already used|cannot be resent|is revoked|is declined|is accepted/i.test(message)) {
    return errorResponse(context, "conflict", 409, "The state changed. Refresh and try again.");
  }
  if (/valid|invalid|required|expiry|expired|does not have a reservation/i.test(message)) {
    return errorResponse(context, "invalid_request", 400, "Check the details and try again.");
  }
  logger.warn?.("[sendero.web-api] request failed", { code: "request_failed" });
  return errorResponse(
    context,
    "temporarily_unavailable",
    503,
    "Sendero is temporarily unavailable.",
    true,
  );
}

async function readJson(context, schema, { maxBytes = MAX_BODY_BYTES } = {}) {
  if (!context.req.header("Content-Type")?.toLowerCase().startsWith("application/json")) {
    throw new Error("A valid JSON body is required");
  }
  const declaredLength = Number(context.req.header("Content-Length") || 0);
  if (declaredLength > maxBytes) throw new Error("Invalid request body");
  const raw = await context.req.text();
  if (raw.length > maxBytes) throw new Error("Invalid request body");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON body");
  }
  return schema.parse(parsed);
}

function requireWebId(context) {
  return webIdSchema.parse(context.req.param("webId"));
}

function activePublicShare(status) {
  return status?.status === "active";
}

function sameOriginRequest(context) {
  const origin = context.req.header("Origin");
  try {
    return Boolean(origin) && origin === new URL(context.req.url).origin;
  } catch {
    return false;
  }
}

export function registerWebApiRoutes(app, {
  convexUrl,
  invitePepper,
  logger = console,
  now = () => Date.now(),
  planningEnabled = false,
  placesApiKey,
  placesFetch = globalThis.fetch,
  persistenceFactory,
  publicShareSecret,
  publicWebUrl,
  webAuth,
} = {}) {
  function currentPublicUrl(tripId, sharing) {
    if (!publicShareSecret) return undefined;
    return recoverPublicShareUrl({
      baseUrl: publicWebUrl,
      secret: publicShareSecret,
      tripId,
      sharing,
    });
  }

  async function sessionContext(context, { mutate = false } = {}) {
    const session = await webAuth.accessSession(context);
    if (!session) {
      return { response: errorResponse(context, "authentication_required", 401, "Sign in to continue.") };
    }
    if (mutate && !webAuth.validateCsrf(context, session)) {
      return { response: errorResponse(context, "invalid_csrf", 403, "Refresh and try again.") };
    }
    return {
      session,
      storage: persistenceFactory({ convexUrl, authToken: session.accessToken }),
    };
  }

  async function authenticated(context, handler, options) {
    const access = await sessionContext(context, options);
    if (access.response) return access.response;
    try {
      return await handler(access);
    } catch (error) {
      return mappedFailure(context, error, logger);
    }
  }

  async function tripByWebId(storage, context) {
    return storage.getByWebId(requireWebId(context));
  }

  function requirePlanningEnabled(context) {
    return planningEnabled
      ? undefined
      : errorResponse(
          context,
          "planning_unavailable",
          404,
          "Itinerary generation is not available on this Sendero environment.",
          false,
        );
  }

  function requireSameOrigin(context) {
    return sameOriginRequest(context)
      ? undefined
      : errorResponse(
          context,
          "invalid_origin",
          403,
          "Open Sendero directly and try again.",
          false,
        );
  }

  app.get("/api/itinerary-planning/capabilities", (context) => context.json({
    data: {
      enabled: planningEnabled,
      anonymousPlanning: planningEnabled,
      persistenceRequiresAuthentication: true,
      ...(planningEnabled ? planningProtocolIdentity() : {}),
    },
  }));

  app.post("/api/destination-suggestions", async (context) => {
    const invalidOrigin = requireSameOrigin(context);
    if (invalidOrigin) return invalidOrigin;
    try {
      const input = await readJson(context, destinationSuggestionsRequestSchema);
      return context.json({
        data: await destinationSuggestions(input, {
          apiKey: placesApiKey,
          fetchImpl: placesFetch,
          signal: context.req.raw.signal,
        }),
      });
    } catch (error) {
      return mappedFailure(context, error, logger);
    }
  });

  app.post("/api/itinerary-planning/protocol", async (context) => {
    const invalidOrigin = requireSameOrigin(context);
    if (invalidOrigin) return invalidOrigin;
    try {
      const unavailable = requirePlanningEnabled(context);
      if (unavailable) return unavailable;
      const { brief } = await readJson(context, planningProtocolRequestSchema);
      return context.json({ data: planningProtocol(brief) });
    } catch (error) {
      return mappedFailure(context, error, logger);
    }
  });

  app.post("/api/itinerary-planning/validate", async (context) => {
    const invalidOrigin = requireSameOrigin(context);
    if (invalidOrigin) return invalidOrigin;
    try {
      const unavailable = requirePlanningEnabled(context);
      if (unavailable) return unavailable;
      const input = await readJson(
        context,
        stageItineraryRequestSchema,
        { maxBytes: MAX_ITINERARY_BODY_BYTES },
      );
      const prepared = validatedDraft(input);
      return context.json({
        data: draftSummary({
          draftId: `browser_${randomUUID().replaceAll("-", "")}`,
          status: "valid",
          protocolVersion: prepared.protocolVersion,
          warnings: prepared.warnings,
          itinerary: prepared.itinerary,
        }),
      });
    } catch (error) {
      return mappedFailure(context, error, logger);
    }
  });

  app.post("/api/itinerary-drafts", (context) => authenticated(
    context,
    async ({ storage }) => {
      const unavailable = requirePlanningEnabled(context);
      if (unavailable) return unavailable;
      const input = await readJson(
        context,
        stageItineraryRequestSchema,
        { maxBytes: MAX_ITINERARY_BODY_BYTES },
      );
      const prepared = validatedDraft(input);
      const draft = await storage.stageDraft(prepared);
      return context.json({ data: draftSummary(draft) }, 201);
    },
    { mutate: true },
  ));

  app.get("/api/itinerary-drafts/:draftId", (context) => authenticated(
    context,
    async ({ storage }) => {
      const unavailable = requirePlanningEnabled(context);
      if (unavailable) return unavailable;
      const draft = await storage.getDraft(itineraryDraftIdSchema.parse(context.req.param("draftId")));
      if (!draft) return errorResponse(context, "not_found", 404, "We could not find that itinerary draft.");
      return context.json({ data: draftSummary(draft) });
    },
  ));

  app.post("/api/itinerary-drafts/:draftId/save", (context) => authenticated(
    context,
    async ({ storage }) => {
      const unavailable = requirePlanningEnabled(context);
      if (unavailable) return unavailable;
      const draftId = itineraryDraftIdSchema.parse(context.req.param("draftId"));
      const { operationId } = await readJson(context, saveDraftRequestSchema);
      const result = await storage.saveDraft({ draftId, operationId });
      return context.json({ data: result });
    },
    { mutate: true },
  ));

  app.delete("/api/itinerary-drafts/:draftId", (context) => authenticated(
    context,
    async ({ storage }) => {
      const unavailable = requirePlanningEnabled(context);
      if (unavailable) return unavailable;
      const result = await storage.discardDraft(
        itineraryDraftIdSchema.parse(context.req.param("draftId")),
      );
      return context.json({ data: result });
    },
    { mutate: true },
  ));

  app.get("/api/trips", (context) => authenticated(context, async ({ storage }) => {
    const trips = await storage.list();
    const summaries = await Promise.all(
      trips.map((trip) => ensureWebTripSummary(storage, trip)),
    );
    return context.json({ data: { trips: summaries } });
  }));

  app.get("/api/trips/:webId", (context) => authenticated(context, async ({ storage }) => {
    const trip = await tripByWebId(storage, context);
    return context.json({ data: tripEnvelope(trip) });
  }));

  app.patch("/api/trips/:webId/reservations/status", (context) => authenticated(
    context,
    async ({ storage }) => {
      const input = await readJson(context, reservationSchema);
      const trip = await tripByWebId(storage, context);
      await storage.updateReservation({ tripId: trip.id, ...input });
      return context.json({ data: tripEnvelope(await storage.getByWebId(trip.webId)) });
    },
    { mutate: true },
  ));

  app.get("/api/trips/:webId/access", (context) => authenticated(context, async ({ storage }) => {
    const trip = await tripByWebId(storage, context);
    const [access, sharing] = await Promise.all([
      storage.listAccess(trip.id),
      storage.publicStatus(trip.id),
    ]);
    const shareUrl = currentPublicUrl(trip.id, sharing);
    const publicLinkActive = activePublicShare(sharing);
    return context.json({
      data: {
        generalAccess: { mode: publicLinkActive ? "public_link" : "restricted" },
        ...(publicLinkActive ? { linkRecoverable: Boolean(shareUrl) } : {}),
        ...(shareUrl ? { shareUrl } : {}),
        invitations: (access.invitations || [])
          .filter((entry) => entry.status === "pending" || entry.status === "expired")
          .map((entry) => ({
            ...entry,
            expiresAt: isoTime(entry.expiresAt),
          })),
        // Historical pending collaborator rows are recovery candidates only.
        // They stay separate from members and bearer-backed invitations so
        // merely matching an email can never look like, or become, access.
        legacyInvitations: access.legacyInvitations || [],
        members: access.collaborators || [],
        owner: access.owner,
      },
    });
  }));

  app.patch("/api/trips/:webId/access", (context) => authenticated(
    context,
    async ({ storage }) => {
      const input = await readJson(context, accessSchema);
      const trip = await tripByWebId(storage, context);
      const status = await storage.publicStatus(trip.id);
      if (input.generalAccess === "restricted") {
        if (activePublicShare(status)) {
          await storage.revokePublic({ tripId: trip.id, operationId: input.operationId });
        }
        return context.json({ data: { generalAccess: { mode: "restricted" } } });
      }

      if (activePublicShare(status)) {
        const currentUrl = currentPublicUrl(trip.id, status);
        let updatedStatus = status;
        if (status.isStale) {
          updatedStatus = await storage.updatePublic({
            tripId: trip.id,
            expectedVersion: trip.version,
            operationId: input.operationId,
          });
        }
        const shareUrl = currentUrl || currentPublicUrl(trip.id, updatedStatus);
        return context.json({ data: {
          generalAccess: { mode: "public_link" },
          linkRecoverable: Boolean(shareUrl),
          ...(shareUrl ? { shareUrl } : {}),
        } });
      }

      const token = derivePublicShareToken({
        secret: publicShareSecret,
        purpose: "publish",
        tripId: trip.id,
        operationId: input.operationId,
      });
      try {
        await storage.publishPublic({
          tripId: trip.id,
          expectedVersion: trip.version,
          tokenHash: hashPublicShareToken(token),
          expiresAt: publicShareExpiresAt(365, now()),
          operationId: input.operationId,
        });
      } catch (error) {
        if (!isActivePublicShareConflict(error)) throw error;
        const winner = await storage.publicStatus(trip.id);
        if (!activePublicShare(winner)) throw error;
        let current = winner;
        if (winner.isStale) {
          const freshTrip = await tripByWebId(storage, context);
          current = await storage.updatePublic({
            tripId: freshTrip.id,
            expectedVersion: freshTrip.version,
            operationId: input.operationId,
          });
        }
        const shareUrl = currentPublicUrl(trip.id, current);
        return context.json({ data: {
          generalAccess: { mode: "public_link" },
          linkRecoverable: Boolean(shareUrl),
          ...(shareUrl ? { shareUrl } : {}),
        } });
      }
      return context.json({
        data: {
          generalAccess: { mode: "public_link" },
          linkRecoverable: true,
          shareUrl: buildPublicShareUrl({ baseUrl: publicWebUrl, token }),
        },
      });
    },
    { mutate: true },
  ));

  app.post("/api/trips/:webId/access/public-link/rotate", (context) => authenticated(
    context,
    async ({ storage }) => {
      const input = await readJson(context, operationSchema);
      const trip = await tripByWebId(storage, context);
      const status = await storage.publicStatus(trip.id);
      if (!activePublicShare(status)) throw new Error("Public link not found");
      const token = derivePublicShareToken({
        secret: publicShareSecret,
        purpose: "rotate",
        tripId: trip.id,
        operationId: input.operationId,
      });
      await storage.rotatePublic({
        tripId: trip.id,
        tokenHash: hashPublicShareToken(token),
        operationId: input.operationId,
      });
      return context.json({ data: {
        generalAccess: { mode: "public_link" },
        linkRecoverable: true,
        shareUrl: buildPublicShareUrl({ baseUrl: publicWebUrl, token }),
      } });
    },
    { mutate: true },
  ));

  app.post("/api/trips/:webId/invitations", (context) => authenticated(
    context,
    async ({ session, storage }) => {
      const input = await readJson(context, inviteSchema);
      const trip = await tripByWebId(storage, context);
      const token = deriveInvitationToken({
        pepper: invitePepper,
        tripId: trip.id,
        email: input.email,
        operationId: input.operationId,
        purpose: "invite",
      });
      const expiresAt = now() + INVITATION_TTL_MS;
      const result = await storage.invite({
        tripId: trip.id,
        email: input.email,
        role: input.role,
        expiresAt,
        tokenHash: hashInvitationToken(token, invitePepper),
        operationId: input.operationId,
      });
      return context.json({
        data: {
          invitationId: result.invitationId,
          status: result.status,
          // The Convex mutation transactionally persisted and scheduled this
          // delivery. Do not add a second synchronous provider call here: the
          // durable worker owns retries and provider idempotency.
          delivery: result.delivery?.status || "unknown",
        },
      }, 201);
    },
    { mutate: true },
  ));

  app.post("/api/trips/:webId/legacy-invitations/:collaboratorId/migrate", (context) => authenticated(
    context,
    async ({ storage }) => {
      const input = await readJson(context, operationSchema);
      const trip = await tripByWebId(storage, context);
      // This owner-only lookup can also resolve an already-migrated row, which
      // lets a lost HTTP response replay the exact bearer generation without
      // exposing revoked legacy rows in the normal access list.
      const legacyInvitation = await storage.getLegacyInvitationForMigration({
        tripId: trip.id,
        collaboratorId: context.req.param("collaboratorId"),
      });
      const token = deriveInvitationToken({
        pepper: invitePepper,
        tripId: trip.id,
        email: legacyInvitation.email,
        operationId: input.operationId,
        purpose: "invite",
      });
      const result = await storage.migrateLegacyInvitation({
        tripId: trip.id,
        collaboratorId: legacyInvitation.id,
        tokenHash: hashInvitationToken(token, invitePepper),
        operationId: input.operationId,
      });
      return context.json({
        data: {
          invitationId: result.invitationId,
          legacyCollaboratorId: result.legacyCollaboratorId,
          status: result.status,
          delivery: result.delivery?.status || "unknown",
        },
      }, 201);
    },
    { mutate: true },
  ));

  app.delete("/api/trips/:webId/legacy-invitations/:collaboratorId", (context) => authenticated(
    context,
    async ({ storage }) => {
      const input = await readJson(context, operationSchema);
      const trip = await tripByWebId(storage, context);
      const result = await storage.removeCollaborator({
        tripId: trip.id,
        collaboratorId: context.req.param("collaboratorId"),
        operationId: input.operationId,
      });
      return context.json({ data: result });
    },
    { mutate: true },
  ));

  app.post("/api/trips/:webId/invitations/:invitationId/resend", (context) => authenticated(
    context,
    async ({ session, storage }) => {
      const input = await readJson(context, operationSchema);
      const trip = await tripByWebId(storage, context);
      const access = await storage.listAccess(trip.id);
      const invitation = (access.invitations || []).find(
        (entry) => entry.id === context.req.param("invitationId"),
      );
      if (!invitation) throw new Error("Invitation not found");
      const token = deriveInvitationToken({
        pepper: invitePepper,
        tripId: trip.id,
        email: invitation.email,
        operationId: input.operationId,
        purpose: "resend",
      });
      const expiresAt = now() + INVITATION_TTL_MS;
      const result = await storage.resendInvitation({
        tripId: trip.id,
        invitationId: invitation.id,
        tokenHash: hashInvitationToken(token, invitePepper),
        expiresAt,
        operationId: input.operationId,
      });
      return context.json({ data: {
        invitationId: result.invitationId,
        status: result.status,
        delivery: result.delivery?.status || "unknown",
      } });
    },
    { mutate: true },
  ));

  app.delete("/api/trips/:webId/invitations/:invitationId", (context) => authenticated(
    context,
    async ({ storage }) => {
      const input = await readJson(context, operationSchema);
      const trip = await tripByWebId(storage, context);
      const result = await storage.revokeInvitation({
        tripId: trip.id,
        invitationId: context.req.param("invitationId"),
        operationId: input.operationId,
      });
      return context.json({ data: result });
    },
    { mutate: true },
  ));

  app.patch("/api/trips/:webId/access/:collaboratorId", (context) => authenticated(
    context,
    async ({ storage }) => {
      const input = await readJson(context, roleSchema);
      const trip = await tripByWebId(storage, context);
      const result = await storage.changeRole({
        tripId: trip.id,
        collaboratorId: context.req.param("collaboratorId"),
        role: input.role,
        operationId: input.operationId,
      });
      return context.json({ data: result });
    },
    { mutate: true },
  ));

  app.delete("/api/trips/:webId/access/:collaboratorId", (context) => authenticated(
    context,
    async ({ storage }) => {
      const input = await readJson(context, operationSchema);
      const trip = await tripByWebId(storage, context);
      const result = await storage.removeCollaborator({
        tripId: trip.id,
        collaboratorId: context.req.param("collaboratorId"),
        operationId: input.operationId,
      });
      return context.json({ data: result });
    },
    { mutate: true },
  ));

  app.post("/api/invitations/inspect", async (context) => {
    try {
      const input = await readJson(context, inspectSchema);
      let pending;
      if (input.token) {
        if (!input.webId || !isValidInvitationToken(input.token)) {
          return context.json({ data: { state: "unavailable" } });
        }
        pending = {
          webId: webIdSchema.parse(input.webId),
          tokenHash: hashInvitationToken(input.token, invitePepper),
        };
      } else {
        pending = await webAuth.readPendingInvitation(context);
      }
      if (!pending?.webId || !pending?.tokenHash) {
        return context.json({ data: { state: "unavailable" } });
      }

      const publicStorage = persistenceFactory({ convexUrl });
      const inspection = await publicStorage.inspectInvitation(pending);
      if (inspection?.state !== "available") {
        webAuth.clearPendingInvitation(context);
        return context.json({ data: { state: "unavailable" } });
      }
      await webAuth.storePendingInvitation(context, pending);
      const session = await webAuth.accessSession(context);
      if (!session) {
        return context.json({ data: {
          state: "signed_out",
          invitation: invitationDetails(inspection),
        } });
      }
      if (session.emailVerified !== true) {
        return context.json({ data: {
          state: "email_unverified",
          invitation: invitationDetails(inspection),
        } });
      }
      const storage = persistenceFactory({ convexUrl, authToken: session.accessToken });
      const mine = await storage.listInvitations();
      const invitation = mine.find((entry) => entry.id === inspection.invitationId);
      if (!invitation) {
        return context.json({ data: {
          state: "email_mismatch",
          invitation: invitationDetails(inspection),
        } });
      }
      return context.json({ data: {
        state: "ready",
        invitation: invitationDetails(inspection, session.email),
      } });
    } catch {
      return context.json({ data: { state: "unavailable" } });
    }
  });

  async function respondToInvitation(context, decision) {
    return authenticated(context, async ({ storage }) => {
      const input = await readJson(context, operationSchema);
      const pending = await webAuth.readPendingInvitation(context);
      if (!pending?.webId || !pending?.tokenHash) throw new Error("Invitation not found");
      const inspection = await persistenceFactory({ convexUrl }).inspectInvitation(pending);
      if (inspection?.state !== "available") throw new Error("Invitation not found");
      const mine = await storage.listInvitations();
      const invitation = mine.find((entry) => entry.id === inspection.invitationId);
      if (!invitation) throw new Error("Invitation not found for this verified email");
      const result = decision === "accept"
        ? await storage.acceptInvitation({
          invitationId: invitation.id,
          tokenHash: pending.tokenHash,
          operationId: input.operationId,
        })
        : await storage.declineInvitation({
          invitationId: invitation.id,
          tokenHash: pending.tokenHash,
          operationId: input.operationId,
        });
      webAuth.clearPendingInvitation(context);
      const expectedStatus = decision === "accept" ? "accepted" : "declined";
      if (result.status !== expectedStatus) {
        return errorResponse(
          context,
          "invitation_unavailable",
          409,
          "The invitation is no longer available.",
          false,
        );
      }
      return context.json({ data: {
        status: result.status,
        webId: inspection.trip.webId,
      } });
    }, { mutate: true });
  }

  app.post("/api/invitations/accept", (context) => respondToInvitation(context, "accept"));
  app.post("/api/invitations/decline", (context) => respondToInvitation(context, "decline"));
}
