import assert from "node:assert/strict";
import test from "node:test";
import {
  generationStatusFromEvent,
  initialGenerationStatus,
  visibleGenerationStatus,
} from "./src/generate/generation-status.js";

test("maps authoritative page-tool events to visible itinerary progress", () => {
  let status = initialGenerationStatus;
  status = generationStatusFromEvent(status, { type: "webmcp_tools_registered" });
  assert.deepEqual(visibleGenerationStatus(status, true), { kind: "waiting" });

  status = generationStatusFromEvent(status, {
    type: "webmcp_tool_started",
    toolName: "get_itinerary_planning_protocol",
  });
  assert.equal(status.kind, "generating");

  status = generationStatusFromEvent(status, {
    type: "webmcp_tool_started",
    toolName: "validate_and_stage_itinerary",
  });
  assert.equal(status.kind, "validating");

  status = generationStatusFromEvent(status, {
    type: "webmcp_tool_succeeded",
    toolName: "validate_and_stage_itinerary",
  });
  assert.equal(status.kind, "draft_ready");

  status = generationStatusFromEvent(status, {
    type: "webmcp_tool_started",
    toolName: "save_staged_itinerary",
  });
  assert.equal(status.kind, "saving");

  status = generationStatusFromEvent(status, {
    type: "webmcp_tool_succeeded",
    toolName: "save_staged_itinerary",
  });
  assert.equal(status.kind, "saved");

  status = generationStatusFromEvent(status, {
    type: "webmcp_tool_started",
    toolName: "share_saved_itinerary_by_link",
  });
  assert.equal(status.kind, "working");
  status = generationStatusFromEvent(status, {
    type: "webmcp_tool_succeeded",
    toolName: "share_saved_itinerary_by_link",
  });
  assert.equal(status.kind, "saved");

  status = generationStatusFromEvent(status, {
    type: "webmcp_tool_succeeded",
    toolName: "update_itinerary_reservation_statuses",
  });
  assert.equal(status.kind, "draft_ready");
});

test("does not imply success when page tools are absent or fail", () => {
  assert.deepEqual(
    generationStatusFromEvent(initialGenerationStatus, { type: "webmcp_support_unavailable" }),
    { kind: "unavailable" },
  );
  assert.deepEqual(
    generationStatusFromEvent({ kind: "generating" }, {
      type: "webmcp_tool_failed",
      toolName: "validate_and_stage_itinerary",
      code: "itinerary_invalid",
    }),
    { kind: "error", toolName: "validate_and_stage_itinerary", code: "itinerary_invalid" },
  );
});
