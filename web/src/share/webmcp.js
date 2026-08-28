import { siteToolErrorResult } from "./shared-trip-companion.js";

export const SHARED_TRIP_TOOL_NAMES = Object.freeze([
  "get_shared_trip_context",
  "get_day_itinerary",
  "preview_guest_arrival",
  "show_day_on_map",
  "focus_itinerary_item",
  "clear_guest_preview",
]);

const EMPTY_INPUT_SCHEMA = Object.freeze({
  type: "object",
  properties: {},
  additionalProperties: false,
});

const DATE_INPUT_SCHEMA = Object.freeze({
  type: "object",
  properties: {
    date: {
      type: "string",
      pattern: "^\\d{4}-\\d{2}-\\d{2}$",
      description: "A date from the currently open trip in YYYY-MM-DD format.",
    },
  },
  required: ["date"],
  additionalProperties: false,
});

function executeSafely(facade, action, report, toolName) {
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
      return result;
    } catch (error) {
      const result = siteToolErrorResult(error, facade.getProjection().trip.publicVersion);
      report?.({ type: "webmcp_tool_failed", toolName, code: result.error.code });
      return result;
    }
  };
}

export function sharedTripToolDefinitions(facade, { report } = {}) {
  const definition = (tool) => ({
    ...tool,
    execute: executeSafely(facade, tool.execute, report, tool.name),
  });
  return [
    definition({
      name: "get_shared_trip_context",
      description: "Read the public dates, timezone, available days, publication version, and viewer permissions for the Sendero trip currently open. This does not modify the trip or the page.",
      inputSchema: EMPTY_INPUT_SCHEMA,
      annotations: { readOnlyHint: true },
      execute: () => facade.getContext(),
    }),
    definition({
      name: "get_day_itinerary",
      description: "Read the ordered public itinerary for one date in the Sendero trip currently open, including public locations and booking requirements. This does not modify the trip or the page.",
      inputSchema: DATE_INPUT_SCHEMA,
      annotations: { readOnlyHint: true },
      execute: ({ date }) => facade.getDay(date),
    }),
    definition({
      name: "preview_guest_arrival",
      description: "Preview how a guest's arrival affects the currently open trip. This changes only the temporary view on this page, highlights a possible meeting item from the published schedule, and never modifies the shared itinerary.",
      inputSchema: {
        type: "object",
        properties: {
          date: {
            type: "string",
            pattern: "^\\d{4}-\\d{2}-\\d{2}$",
            description: "Arrival date from the currently open trip in YYYY-MM-DD format.",
          },
          arrivalLocalTime: {
            type: "string",
            pattern: "^([01]\\d|2[0-3]):[0-5]\\d$",
            description: "Guest arrival time in the trip's declared timezone, in HH:mm format.",
          },
          readyAfterMinutes: {
            type: "integer",
            minimum: 0,
            maximum: 720,
            description: "Minutes after arrival before the guest can join the group, including the guest's own transfer estimate.",
          },
          originLabel: {
            type: "string",
            maxLength: 120,
            description: "Optional public label for the guest's starting point. It is displayed as context and does not trigger routing.",
          },
        },
        required: ["date", "arrivalLocalTime", "readyAfterMinutes"],
        additionalProperties: false,
      },
      execute: (input) => facade.previewGuestArrival(input),
    }),
    definition({
      name: "show_day_on_map",
      description: "Show one date from the currently open Sendero trip in the page's route and map view. This changes only local page state and never modifies the shared itinerary.",
      inputSchema: DATE_INPUT_SCHEMA,
      execute: ({ date }) => facade.showDayOnMap(date),
    }),
    definition({
      name: "focus_itinerary_item",
      description: "Focus one public itinerary item from the Sendero trip currently open and show its day and location on the page. This changes only local page state and never modifies the shared itinerary.",
      inputSchema: {
        type: "object",
        properties: {
          publicItemId: {
            type: "string",
            minLength: 1,
            maxLength: 160,
            description: "A public item ID returned by get_day_itinerary.",
          },
        },
        required: ["publicItemId"],
        additionalProperties: false,
      },
      execute: ({ publicItemId }) => facade.focusItem(publicItemId),
    }),
    definition({
      name: "clear_guest_preview",
      description: "Clear the temporary guest-arrival overlay and item focus from the currently open Sendero page. This does not modify the shared itinerary.",
      inputSchema: EMPTY_INPUT_SCHEMA,
      execute: () => facade.clearGuestPreview(),
    }),
  ];
}

export async function registerSharedTripTools(documentRef, facade, { signal, report } = {}) {
  const modelContext = documentRef?.modelContext;
  if (typeof modelContext?.registerTool !== "function") {
    report?.({ type: "webmcp_support_unavailable" });
    return false;
  }
  report?.({ type: "webmcp_support_detected" });
  const definitions = sharedTripToolDefinitions(facade, { report });
  await Promise.all(definitions.map((tool) => modelContext.registerTool(tool, { signal })));
  report?.({ type: "webmcp_tools_registered", count: definitions.length });
  return true;
}
