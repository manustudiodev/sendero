export const ITINERARY_GENERATION_TOOL_NAMES = Object.freeze([
  "get_itinerary_planning_protocol",
  "validate_and_stage_itinerary",
  "get_staged_itinerary",
  "update_itinerary_reservation_statuses",
  "save_staged_itinerary",
  "share_saved_itinerary_by_link",
  "invite_saved_itinerary_member",
  "discard_staged_itinerary",
]);

const BRIEF_SCHEMA = Object.freeze({
  type: "object",
  description: "Known trip brief. Omit it to use the fields currently entered on the Sendero page.",
  additionalProperties: true,
});

const DRAFT_ID = Object.freeze({
  type: "string",
  minLength: 16,
  maxLength: 128,
  description: "A draftId returned by validate_and_stage_itinerary. Omit it to use the draft currently open on the page.",
});

const RESERVATION_STATUS_UPDATES = Object.freeze({
  type: "array",
  minItems: 1,
  maxItems: 100,
  description: "One or more exact reservation or ticket entries to update. Use confirmed for 'already booked/bought' and pending for 'not booked/bought yet'.",
  items: {
    type: "object",
    properties: {
      activityId: {
        type: "string",
        minLength: 1,
        maxLength: 160,
        description: "The exact activity ID in the staged itinerary.",
      },
      dayDate: {
        type: "string",
        pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        description: "The activity date in YYYY-MM-DD format.",
      },
      status: {
        type: "string",
        enum: ["pending", "confirmed"],
        description: "confirmed means the user says it is already booked or bought; pending means it is not booked or bought yet.",
      },
    },
    required: ["activityId", "dayDate", "status"],
    additionalProperties: false,
  },
});

function safeToolFailure(error) {
  return {
    ok: false,
    error: {
      code: typeof error?.code === "string" ? error.code : "itinerary_generation_failed",
      message: typeof error?.message === "string"
        ? error.message
        : "Sendero could not complete the itinerary operation.",
      retryable: error?.retryable === true,
      ...(error?.details && typeof error.details === "object" ? { details: error.details } : {}),
    },
  };
}

function executeSafely(action, report, toolName) {
  return async (input = {}) => {
    const startedAt = globalThis.performance?.now?.() ?? Date.now();
    report?.({ type: "webmcp_tool_started", toolName });
    try {
      const result = await action(input);
      report?.({
        type: "webmcp_tool_succeeded",
        toolName,
        durationMs: Math.max(0, Math.round((globalThis.performance?.now?.() ?? Date.now()) - startedAt)),
      });
      return { ok: true, ...result };
    } catch (error) {
      const result = safeToolFailure(error);
      report?.({ type: "webmcp_tool_failed", toolName, code: result.error.code });
      return result;
    }
  };
}

export function itineraryGenerationToolDefinitions(facade, { report } = {}) {
  const definition = (tool) => ({
    ...tool,
    execute: executeSafely(tool.execute, report, tool.name),
  });
  return [
    definition({
      name: "get_itinerary_planning_protocol",
      description: "Load Sendero's current versioned instructions, prepared brief, and canonical JSON schema for generating a new itinerary. Use this before researching or constructing the itinerary. Pass the facts already supplied in the conversation through brief; the page will reflect those facts and move to the automatic generation step when the brief is ready, without requiring form entry or prompt copying. When this page-scoped tool is available for the open Sendero creation page, prefer this page workflow over remote Sendero planning tools so the page can show progress, review, and authoritative save state. Sendero returns instructions but does not call a model.",
      inputSchema: {
        type: "object",
        properties: { brief: BRIEF_SCHEMA },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
      execute: (input) => facade.getProtocol(input),
    }),
    definition({
      name: "validate_and_stage_itinerary",
      description: "Validate one complete generated itinerary against the current Sendero protocol and place a local draft in this browser's persistent Sendero cache. This works without a Sendero account and is the authoritative review handoff for the open page. It does not save a canonical trip. Correct blocking errors before continuing and review all warnings.",
      inputSchema: {
        type: "object",
        properties: {
          brief: BRIEF_SCHEMA,
          itinerary: {
            type: "object",
            description: "The complete itinerary object matching itinerarySchema returned by get_itinerary_planning_protocol.",
            additionalProperties: true,
          },
          protocolHash: { type: "string", pattern: "^[a-f0-9]{64}$" },
          protocolVersion: { type: "string", pattern: "^\\d+\\.\\d+\\.\\d+$" },
        },
        required: ["itinerary", "protocolHash", "protocolVersion"],
        additionalProperties: false,
      },
      annotations: { idempotentHint: true, openWorldHint: false },
      execute: (input) => facade.stage(input),
    }),
    definition({
      name: "get_staged_itinerary",
      description: "Read the validated local Sendero itinerary draft currently cached by the open page and its warnings. This does not require an account and does not save or modify the canonical trip library.",
      inputSchema: {
        type: "object",
        properties: { draftId: DRAFT_ID },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
      execute: (input) => facade.getDraft(input),
    }),
    definition({
      name: "update_itinerary_reservation_statuses",
      description: "Update the purchase or booking tracker for one specific reservation/ticket or for a list of specific entries in the validated local Sendero draft. This requires an authenticated Sendero account; when signed out, preserve the draft and let the page offer sign-in instead of changing status. Use confirmed only when the user says they already booked or bought it; use pending when they say they have not. All requested entries are validated before the browser draft changes. This tracker never books, buys, contacts, or cancels with a provider. Use this page tool before saving; saved trips are edited from their private Sendero page.",
      inputSchema: {
        type: "object",
        properties: {
          draftId: DRAFT_ID,
          updates: RESERVATION_STATUS_UPDATES,
        },
        required: ["updates"],
        additionalProperties: false,
      },
      annotations: { idempotentHint: true, openWorldHint: false },
      execute: (input) => facade.updateReservationStatuses(input),
    }),
    definition({
      name: "save_staged_itinerary",
      description: "Explicitly save one validated local draft from the open creation page as an authoritative Sendero trip. This requires a Sendero account; when signed out, preserve the browser draft and let the page offer sign-in or account creation. Call only when the user asked to save. Report success only from the returned trip, webId, and version.",
      inputSchema: {
        type: "object",
        properties: { draftId: DRAFT_ID },
        additionalProperties: false,
      },
      annotations: { idempotentHint: true, openWorldHint: false },
      execute: (input) => facade.save(input),
    }),
    definition({
      name: "share_saved_itinerary_by_link",
      description: "Enable public read-only access for the saved Sendero itinerary currently selected on this page and return its shareable URL. Anyone with the link can view it but cannot collaborate or modify it. This requires an authenticated Sendero account, an already saved itinerary, owner permission, and an explicit user request to make it public. Report success only from the returned shareUrl.",
      inputSchema: {
        type: "object",
        properties: { draftId: DRAFT_ID },
        additionalProperties: false,
      },
      annotations: { idempotentHint: true, openWorldHint: false },
      execute: (input) => facade.shareByLink(input),
    }),
    definition({
      name: "invite_saved_itinerary_member",
      description: "Invite one person by email to the saved Sendero itinerary currently selected on this page. viewer grants read-only private access; editor grants collaboration access. Sendero sends the invitation, so call this only after the user explicitly asks to invite that exact email with that role. This requires an authenticated account, an already saved itinerary, and owner permission. Report success only from the returned invitation status and delivery receipt.",
      inputSchema: {
        type: "object",
        properties: {
          draftId: DRAFT_ID,
          email: {
            type: "string",
            format: "email",
            maxLength: 254,
            description: "Email address of the person to invite.",
          },
          role: {
            type: "string",
            enum: ["viewer", "editor"],
            description: "viewer can only view; editor can collaborate on the itinerary.",
          },
        },
        required: ["email", "role"],
        additionalProperties: false,
      },
      annotations: { idempotentHint: true, openWorldHint: true },
      execute: (input) => facade.inviteMember(input),
    }),
    definition({
      name: "discard_staged_itinerary",
      description: "Discard the selected local Sendero browser draft and remove its itinerary content. This works without an account and never deletes a saved trip.",
      inputSchema: {
        type: "object",
        properties: { draftId: DRAFT_ID },
        additionalProperties: false,
      },
      annotations: { destructiveHint: true, openWorldHint: false },
      execute: (input) => facade.discard(input),
    }),
  ];
}

export async function registerItineraryGenerationTools(documentRef, facade, { signal, report } = {}) {
  const modelContext = documentRef?.modelContext;
  if (typeof modelContext?.registerTool !== "function") {
    report?.({ type: "webmcp_support_unavailable" });
    return false;
  }
  report?.({ type: "webmcp_support_detected" });
  const definitions = itineraryGenerationToolDefinitions(facade, { report });
  await Promise.all(definitions.map((tool) => modelContext.registerTool(tool, { signal })));
  report?.({ type: "webmcp_tools_registered", count: definitions.length });
  return true;
}
