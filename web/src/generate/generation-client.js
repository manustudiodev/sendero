import {
  createStableOperationRegistry,
  requestJson,
} from "../account/web-client.js";

export function createItineraryGenerationFacade({
  csrfToken,
  getBrief,
  getCurrentDraftId,
  onDraft,
  request = requestJson,
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

  return {
    async getProtocol({ brief } = {}) {
      return request("/api/itinerary-planning/protocol", {
        body: { brief: currentBrief(brief) },
        method: "POST",
      });
    },

    async stage({ brief, itinerary, protocolHash, protocolVersion }) {
      const key = JSON.stringify({ brief: currentBrief(brief), itinerary, protocolHash, protocolVersion });
      const { operationId } = operations.begin(key, undefined, "webmcp-stage");
      const draft = await request("/api/itinerary-drafts", {
        body: {
          brief: currentBrief(brief),
          itinerary,
          operationId,
          protocolHash,
          protocolVersion,
        },
        csrfToken,
        method: "POST",
      });
      onDraft?.(draft);
      return draft;
    },

    async getDraft({ draftId } = {}) {
      const draft = await request(
        `/api/itinerary-drafts/${encodeURIComponent(draftIdOrCurrent(draftId))}`,
      );
      onDraft?.(draft);
      return draft;
    },

    async save({ draftId } = {}) {
      const resolvedDraftId = draftIdOrCurrent(draftId);
      const { operationId } = operations.begin(`save:${resolvedDraftId}`, undefined, "webmcp-save");
      const result = await request(
        `/api/itinerary-drafts/${encodeURIComponent(resolvedDraftId)}/save`,
        {
          body: { operationId },
          csrfToken,
          method: "POST",
        },
      );
      onDraft?.(result);
      return result;
    },

    async discard({ draftId } = {}) {
      const resolvedDraftId = draftIdOrCurrent(draftId);
      const result = await request(
        `/api/itinerary-drafts/${encodeURIComponent(resolvedDraftId)}`,
        { csrfToken, method: "DELETE" },
      );
      onDraft?.(result);
      return result;
    },
  };
}
