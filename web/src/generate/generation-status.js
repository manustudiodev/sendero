const ACTIVE_TOOL_STATES = Object.freeze({
  get_itinerary_planning_protocol: "generating",
  validate_and_stage_itinerary: "validating",
  save_staged_itinerary: "saving",
});

const COMPLETED_TOOL_STATES = Object.freeze({
  get_staged_itinerary: "draft_ready",
  update_itinerary_reservation_statuses: "draft_ready",
  validate_and_stage_itinerary: "draft_ready",
  save_staged_itinerary: "saved",
  share_saved_itinerary_by_link: "saved",
  invite_saved_itinerary_member: "saved",
  discard_staged_itinerary: "ready",
});

export const initialGenerationStatus = Object.freeze({ kind: "connecting" });

export function generationStatusFromEvent(current = initialGenerationStatus, event = {}) {
  switch (event.type) {
    case "webmcp_support_unavailable":
      return { kind: "unavailable" };
    case "webmcp_support_detected":
      return current.kind === "unavailable" ? { kind: "connecting" } : current;
    case "webmcp_tools_registered":
      return { kind: "ready" };
    case "webmcp_registration_failed":
      return { kind: "error", code: "registration_failed" };
    case "webmcp_tool_started":
      return { kind: ACTIVE_TOOL_STATES[event.toolName] || "working", toolName: event.toolName };
    case "webmcp_tool_succeeded":
      return COMPLETED_TOOL_STATES[event.toolName]
        ? { kind: COMPLETED_TOOL_STATES[event.toolName], toolName: event.toolName }
        : current;
    case "webmcp_tool_failed":
      return { kind: "error", code: event.code || "itinerary_generation_failed", toolName: event.toolName };
    default:
      return current;
  }
}

export function visibleGenerationStatus(status, promptCopied = false) {
  if (status?.kind === "ready" && promptCopied) return { kind: "waiting" };
  return status || initialGenerationStatus;
}
