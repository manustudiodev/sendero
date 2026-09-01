export const ITINERARY_GENERATION_TOOL_NAMES = Object.freeze([
  "get_itinerary_planning_protocol",
  "validate_and_stage_itinerary",
  "get_staged_itinerary",
  "save_staged_itinerary",
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
      description: "Load Sendero's current versioned instructions, prepared brief, and canonical JSON schema for generating a new itinerary. Use this before researching or constructing the itinerary. When this page-scoped tool is available for the open Sendero creation page, prefer this page workflow over remote Sendero planning tools so the page can show progress, review, and authoritative save state. Sendero returns instructions but does not call a model.",
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
      description: "Validate one complete generated itinerary against the current Sendero protocol and create a temporary draft in the open creation page. This is the authoritative review handoff for that page and should be preferred over a remote presentation tool when available. It does not save a canonical trip. Correct blocking errors before continuing and review all warnings.",
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
      description: "Read a validated temporary Sendero itinerary draft and its warnings. This does not save or modify the canonical trip library.",
      inputSchema: {
        type: "object",
        properties: { draftId: DRAFT_ID },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
      execute: (input) => facade.getDraft(input),
    }),
    definition({
      name: "save_staged_itinerary",
      description: "Explicitly save one validated temporary draft from the open creation page as an authoritative Sendero trip. Call only when the user asked to save. When this page-scoped tool is available, prefer it over remote Sendero save tools so the page and the current web account receive the same result. Report success only from the returned trip, webId, and version.",
      inputSchema: {
        type: "object",
        properties: { draftId: DRAFT_ID },
        additionalProperties: false,
      },
      annotations: { idempotentHint: true, openWorldHint: false },
      execute: (input) => facade.save(input),
    }),
    definition({
      name: "discard_staged_itinerary",
      description: "Discard the selected temporary Sendero draft and remove its itinerary content. This never deletes a saved trip.",
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
