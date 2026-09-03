import {
  createStableOperationRegistry,
  requestJson,
  WebApiError,
} from "../account/web-client.js";

export function createItineraryGenerationFacade({
  csrfToken,
  getBrief,
  getCachedDraft,
  getCurrentDraftId,
  getSession,
  onBriefPrepared,
  onDraft,
  request = requestJson,
  updateCachedReservationStatuses,
} = {}) {
  const operations = createStableOperationRegistry();

  function currentBrief(inputBrief) {
    return inputBrief && typeof inputBrief === "object" && !Array.isArray(inputBrief)
      ? inputBrief
      : getBrief?.() || {};
  }

  function draftIdOrCurrent(value) {
    const draftId = typeof value === "string" && value.trim()
      ? value.trim()
      : getCurrentDraftId?.();
    if (!draftId) throw new Error("No staged itinerary draft is selected.");
    return draftId;
  }

  function currentSession() {
    const session = getSession?.();
    if (session) return session;
    return csrfToken
      ? { authenticated: true, csrfToken }
      : { authenticated: false };
  }

  function cachedDraft(draftId) {
    const entry = getCachedDraft?.();
    return entry?.view?.draftId === draftId ? entry : null;
  }

  function authenticationRequired(session) {
    throw new WebApiError({
      code: "authentication_required",
      details: session?.loginUrl ? { loginUrl: session.loginUrl } : undefined,
      message: "Create or sign in to a Sendero account to save and share this itinerary.",
      retryable: false,
      status: 401,
    });
  }

  function operationFailure({ code, details, message, status = 400 }) {
    throw new WebApiError({ code, details, message, retryable: false, status });
  }

  function editableLocalDraft(draftId) {
    const cached = cachedDraft(draftId);
    if (!cached) {
      operationFailure({
        code: "draft_not_found",
        message: "The selected Sendero itinerary draft is not available in this browser.",
        status: 404,
      });
    }
    if (cached.view.status !== "valid" || !cached.view.itinerary) {
      operationFailure({
        code: "draft_not_editable",
        message: "Reservation status can be changed here only while the local itinerary draft is awaiting review.",
        status: 409,
      });
    }
    return cached;
  }

  function savedTrip(draftId) {
    const cached = cachedDraft(draftId);
    const trip = cached?.view?.status === "saved"
      ? cached.view.trip
      : null;
    if (!trip?.webId) {
      operationFailure({
        code: "itinerary_must_be_saved",
        message: "Save the itinerary to a Sendero account before sharing it.",
        status: 409,
      });
    }
    return trip;
  }

  return {
    async getProtocol({ brief } = {}) {
      const requestedBrief = currentBrief(brief);
      const result = await request("/api/itinerary-planning/protocol", {
        body: { brief: requestedBrief },
        method: "POST",
      });
      if (result?.brief?.brief) onBriefPrepared?.(result.brief);
      return result;
    },

    async stage({ brief, itinerary, protocolHash, protocolVersion }) {
      const key = JSON.stringify({ brief: currentBrief(brief), itinerary, protocolHash, protocolVersion });
      const { operationId } = operations.begin(key, undefined, "webmcp-stage");
      const saveInput = {
        brief: currentBrief(brief),
        itinerary,
        operationId,
        protocolHash,
        protocolVersion,
      };
      const draft = await request("/api/itinerary-planning/validate", {
        body: saveInput,
        method: "POST",
      });
      onDraft?.(draft, { saveInput });
      return draft;
    },

    async getDraft({ draftId } = {}) {
      const resolvedDraftId = draftIdOrCurrent(draftId);
      const cached = cachedDraft(resolvedDraftId);
      if (cached) {
        onDraft?.(cached.view, { saveInput: cached.saveInput });
        return cached.view;
      }
      const draft = await request(
        `/api/itinerary-drafts/${encodeURIComponent(resolvedDraftId)}`,
      );
      onDraft?.(draft);
      return draft;
    },

    async save({ draftId } = {}) {
      let resolvedDraftId = draftIdOrCurrent(draftId);
      const session = currentSession();
      if (!session.authenticated || !session.csrfToken) authenticationRequired(session);
      const cached = cachedDraft(resolvedDraftId);
      if (cached?.saveInput) {
        const staged = await request("/api/itinerary-drafts", {
          body: cached.saveInput,
          csrfToken: session.csrfToken,
          method: "POST",
        });
        resolvedDraftId = staged.draftId;
        onDraft?.(staged, { saveInput: cached.saveInput });
      }
      const { operationId } = operations.begin(`save:${resolvedDraftId}`, undefined, "webmcp-save");
      const result = await request(
        `/api/itinerary-drafts/${encodeURIComponent(resolvedDraftId)}/save`,
        {
          body: { operationId },
          csrfToken: session.csrfToken,
          method: "POST",
        },
      );
      onDraft?.(result, { persist: false, saveInput: null });
      return result;
    },

    async updateReservationStatuses({ draftId, updates } = {}) {
      const resolvedDraftId = draftIdOrCurrent(draftId);
      const session = currentSession();
      if (!session.authenticated || !session.csrfToken) authenticationRequired(session);
      editableLocalDraft(resolvedDraftId);
      if (typeof updateCachedReservationStatuses !== "function") {
        operationFailure({
          code: "reservation_status_unavailable",
          message: "This Sendero page cannot update reservation status right now.",
          status: 503,
        });
      }
      const entry = updateCachedReservationStatuses(updates);
      return {
        draftId: entry?.view?.draftId || resolvedDraftId,
        status: "updated",
        updatedReservations: updates,
      };
    },

    async shareByLink({ draftId } = {}) {
      const resolvedDraftId = draftIdOrCurrent(draftId);
      const session = currentSession();
      if (!session.authenticated || !session.csrfToken) authenticationRequired(session);
      const trip = savedTrip(resolvedDraftId);
      const { operationId } = operations.begin(
        `share:${trip.webId}:public_link`,
        undefined,
        "webmcp-share",
      );
      const result = await request(`/api/trips/${encodeURIComponent(trip.webId)}/access`, {
        body: { generalAccess: "public_link", operationId },
        csrfToken: session.csrfToken,
        method: "PATCH",
      });
      if (!result?.shareUrl) {
        operationFailure({
          code: "share_link_unavailable",
          message: "Sendero enabled public access but could not return a shareable link.",
          status: 503,
        });
      }
      return result;
    },

    async inviteMember({ draftId, email, role } = {}) {
      const resolvedDraftId = draftIdOrCurrent(draftId);
      const session = currentSession();
      if (!session.authenticated || !session.csrfToken) authenticationRequired(session);
      const trip = savedTrip(resolvedDraftId);
      const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
      const { operationId } = operations.begin(
        `invite:${trip.webId}:${normalizedEmail}:${role}`,
        undefined,
        "webmcp-invite",
      );
      return request(`/api/trips/${encodeURIComponent(trip.webId)}/invitations`, {
        body: { email: normalizedEmail, operationId, role },
        csrfToken: session.csrfToken,
        method: "POST",
      });
    },

    async discard({ draftId } = {}) {
      const resolvedDraftId = draftIdOrCurrent(draftId);
      const cached = cachedDraft(resolvedDraftId);
      if (cached?.saveInput) {
        const result = { draftId: resolvedDraftId, status: "discarded" };
        onDraft?.(result, { clear: true });
        return result;
      }
      const session = currentSession();
      if (!session.authenticated || !session.csrfToken) authenticationRequired(session);
      const result = await request(
        `/api/itinerary-drafts/${encodeURIComponent(resolvedDraftId)}`,
        { csrfToken: session.csrfToken, method: "DELETE" },
      );
      onDraft?.(result, { clear: true });
      return result;
    },
  };
}
