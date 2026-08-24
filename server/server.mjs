import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AUTH_SCOPES, authorizeTool, toolSecuritySchemes } from "./auth.mjs";
import {
  ITINERARY_UI_URI,
  TRIP_INTAKE_UI_URI,
  itineraryResource,
  tripIntakeResource,
} from "./ui/resources.mjs";

export { ITINERARY_UI_URI, TRIP_INTAKE_UI_URI } from "./ui/resources.mjs";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const isoTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");
const url = z.string().url();

const transportMode = z.enum([
  "walk",
  "bike",
  "public_transit",
  "taxi",
  "car",
  "train",
  "boat",
  "other",
]);

const locationSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
});

const lodgingSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1).optional(),
  area: z.string().min(1).optional(),
  status: z.enum(["confirmed", "area_only", "undecided"]).optional(),
});

const tripBriefLodgingSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  area: z.string().min(1).optional(),
  status: z.enum(["confirmed", "area_only", "undecided"]).optional(),
});

const reservationSchema = z.object({
  status: z.enum(["not_needed", "suggested", "pending", "confirmed"]),
  url: url.optional(),
  deadline: z.string().optional(),
  note: z.string().optional(),
});

const activitySchema = z.object({
  id: z.string().min(1),
  startTime: isoTime,
  endTime: isoTime.optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  locked: z.boolean().optional(),
  location: locationSchema.optional(),
  sourceUrl: url.optional(),
  reservation: reservationSchema.optional(),
  travelToNext: z
    .object({
      mode: transportMode,
      durationMinutes: z.number().int().nonnegative(),
      summary: z.string().optional(),
    })
    .optional(),
});

const routeSchema = z.object({
  origin: z.string().min(1),
  stops: z.array(z.string().min(1)),
  returnToLodging: z.boolean(),
  totalMinutes: z.number().int().nonnegative().optional(),
  mapUrl: url.optional(),
});

const daySchema = z.object({
  date: isoDate,
  title: z.string().min(1),
  area: z.string().min(1),
  summary: z.string().optional(),
  weather: z
    .object({
      status: z.enum(["forecast", "seasonal", "unknown"]),
      summary: z.string().min(1),
      sourceUrl: url.optional(),
      checkedAt: z.string().optional(),
    })
    .optional(),
  fallback: z.string().optional(),
  activities: z.array(activitySchema),
  route: routeSchema.optional(),
});

export const itinerarySchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  destination: z.string().min(1),
  startDate: isoDate,
  endDate: isoDate,
  lodging: lodgingSchema.optional(),
  transport: z.object({
    modes: z.array(transportMode).min(1),
    hasLicense: z.boolean(),
    wantsCar: z.boolean(),
  }),
  days: z.array(daySchema).min(1),
  sources: z
    .array(
      z.object({
        label: z.string().min(1),
        url,
        checkedAt: z.string().optional(),
      }),
    )
    .optional(),
});

const tripBriefSchema = z.object({
  destination: z.string().optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  lodging: tripBriefLodgingSchema.optional(),
  travellers: z
    .object({
      adults: z.number().int().positive(),
      children: z.number().int().nonnegative().optional(),
    })
    .optional(),
  budget: z.enum(["low", "medium", "high", "flexible"]).optional(),
  pace: z.enum(["relaxed", "balanced", "intense"]).optional(),
  interests: z.array(z.string()).optional(),
  mustDo: z.array(z.string()).optional(),
  avoid: z.array(z.string()).optional(),
  dietaryNeeds: z.array(z.string()).optional(),
  accessibilityNeeds: z.array(z.string()).optional(),
  transport: z
    .object({
      modes: z.array(transportMode),
      hasLicense: z.boolean(),
      wantsCar: z.boolean(),
    })
    .optional(),
  fixedPlans: z
    .array(
      z.object({
        date: isoDate,
        startTime: isoTime.optional(),
        endTime: isoTime.optional(),
        title: z.string().min(1),
        reservationStatus: z.enum(["pending", "confirmed"]).optional(),
      }),
    )
    .optional(),
  notes: z.string().optional(),
});

const validationSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
});

const collaboratorRoleSchema = z.enum(["owner", "editor", "viewer"]);
const tripSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  destination: z.string(),
  startDate: isoDate,
  endDate: isoDate,
  currentVersion: z.number().int().positive(),
  role: collaboratorRoleSchema,
  updatedAt: z.number(),
});
const revisionSummarySchema = z.object({
  version: z.number().int().positive(),
  reason: z.string().optional(),
  createdAt: z.number(),
});

function minutes(time) {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}

function dateInRange(date, start, end) {
  return date >= start && date <= end;
}

function googleTravelMode(mode) {
  if (mode === "walk") return "walking";
  if (mode === "bike") return "bicycling";
  if (mode === "public_transit" || mode === "train") return "transit";
  return "driving";
}

export function buildDailyRouteUrl(itinerary, day) {
  const lodgingAddress =
    itinerary.lodging?.address || itinerary.lodging?.area || itinerary.lodging?.name;
  const route = day.route;
  const origin = route?.origin || lodgingAddress;
  const activityStops = day.activities
    .map((activity) => activity.location?.address || activity.location?.name)
    .filter(Boolean);
  const stops = route?.stops?.length ? route.stops : activityStops;

  if (!origin || stops.length === 0) return undefined;

  const returnToLodging = route?.returnToLodging ?? true;
  const destination = returnToLodging && lodgingAddress ? lodgingAddress : stops.at(-1);
  const waypoints = returnToLodging ? stops : stops.slice(0, -1);
  const preferredMode = itinerary.transport.modes.find((mode) =>
    ["walk", "bike", "public_transit", "train", "taxi", "car"].includes(mode),
  );
  const params = new URLSearchParams({
    api: "1",
    origin,
    destination,
    travelmode: googleTravelMode(preferredMode || "public_transit"),
  });
  if (waypoints.length) params.set("waypoints", waypoints.join("|"));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function normalizeItinerary(itinerary) {
  return {
    ...itinerary,
    days: [...itinerary.days]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((day) => ({
        ...day,
        activities: [...day.activities].sort((a, b) => a.startTime.localeCompare(b.startTime)),
        route: {
          origin:
            day.route?.origin ||
            itinerary.lodging?.address ||
            itinerary.lodging?.area ||
            itinerary.lodging?.name ||
            itinerary.destination,
          stops:
            day.route?.stops?.length
              ? day.route.stops
              : day.activities
                  .map((activity) => activity.location?.address || activity.location?.name)
                  .filter(Boolean),
          returnToLodging: day.route?.returnToLodging ?? true,
          ...(day.route?.totalMinutes !== undefined
            ? { totalMinutes: day.route.totalMinutes }
            : {}),
          ...(day.route?.mapUrl || buildDailyRouteUrl(itinerary, day)
            ? { mapUrl: day.route?.mapUrl || buildDailyRouteUrl(itinerary, day) }
            : {}),
        },
      })),
  };
}

export function validateItinerary(itinerary) {
  const errors = [];
  const warnings = [];

  if (itinerary.startDate > itinerary.endDate) {
    errors.push("The trip start date is after the end date.");
  }
  if (
    (itinerary.transport.wantsCar || itinerary.transport.modes.includes("car")) &&
    !itinerary.transport.hasLicense
  ) {
    errors.push("The plan includes a car even though no valid driving license is available.");
  }
  if (!itinerary.lodging?.address) {
    warnings.push(
      itinerary.lodging?.area
        ? `Daily routes use ${itinerary.lodging.area} as a provisional base until an exact address is available.`
        : "Daily routes use a provisional base until the lodging is chosen.",
    );
  }

  const seenDates = new Set();
  let previousDate = "";
  for (const day of itinerary.days) {
    if (!dateInRange(day.date, itinerary.startDate, itinerary.endDate)) {
      errors.push(`${day.date}: day falls outside the trip dates.`);
    }
    if (seenDates.has(day.date)) errors.push(`${day.date}: duplicate itinerary day.`);
    seenDates.add(day.date);
    if (previousDate && day.date < previousDate) {
      warnings.push("Itinerary days are not in chronological order.");
    }
    previousDate = day.date;

    const intervals = [];
    for (const activity of day.activities) {
      if (activity.endTime && minutes(activity.endTime) <= minutes(activity.startTime)) {
        errors.push(`${day.date} · ${activity.title}: end time must be after start time.`);
      }
      if (activity.endTime) {
        intervals.push({
          title: activity.title,
          start: minutes(activity.startTime),
          end: minutes(activity.endTime),
        });
      }
      if (!activity.location && !["rest", "free_time"].includes(activity.category || "")) {
        warnings.push(`${day.date} · ${activity.title}: add a location for route planning.`);
      }
      if (
        ["suggested", "pending"].includes(activity.reservation?.status || "") &&
        !activity.reservation?.url
      ) {
        warnings.push(`${day.date} · ${activity.title}: reservation needs an official URL.`);
      }
      if (activity.reservation?.status === "confirmed" && !activity.locked) {
        warnings.push(`${day.date} · ${activity.title}: confirmed reservation should normally be locked.`);
      }
    }

    intervals.sort((a, b) => a.start - b.start);
    for (let index = 1; index < intervals.length; index += 1) {
      if (intervals[index].start < intervals[index - 1].end) {
        errors.push(
          `${day.date}: ${intervals[index - 1].title} overlaps ${intervals[index].title}.`,
        );
      }
    }

    if (day.weather && day.weather.status !== "unknown" && !day.weather.sourceUrl) {
      warnings.push(`${day.date}: weather information has no source URL.`);
    }
    if (!day.fallback && day.weather?.summary) {
      warnings.push(`${day.date}: add a weather or capacity fallback.`);
    }
  }

  return { valid: errors.length === 0, errors, warnings: [...new Set(warnings)] };
}

function prepareTripBrief(brief) {
  const missing = [];
  const warnings = [];
  const assumptions = [];
  const blocking = [];
  if (!brief.destination) missing.push("destination");
  if (!brief.startDate) missing.push("startDate");
  if (!brief.endDate) missing.push("endDate");
  if (!brief.travellers?.adults) missing.push("travellers.adults");
  if (!brief.transport?.modes?.length) missing.push("transport.modes");
  if (brief.transport?.wantsCar && !brief.transport.hasLicense) {
    blocking.push("A car was requested but no valid driving license is available.");
  }
  if (brief.startDate && brief.endDate && brief.startDate > brief.endDate) {
    blocking.push("The start date is after the end date.");
  }
  if (!brief.lodging?.address) {
    if (brief.lodging?.area) {
      assumptions.push(`Use ${brief.lodging.area} as the provisional daily origin.`);
    } else {
      assumptions.push(
        "Use a clearly labeled central provisional base until the lodging is chosen.",
      );
    }
  }
  warnings.push(...blocking);

  return {
    ready: missing.length === 0 && blocking.length === 0,
    missing,
    warnings,
    assumptions,
    brief: {
      budget: "flexible",
      pace: "balanced",
      interests: [],
      mustDo: [],
      avoid: [],
      dietaryNeeds: [],
      accessibilityNeeds: [],
      fixedPlans: [],
      ...brief,
    },
  };
}

export function createTripPlannerServer({ persistence, auth, widgetOrigin } = {}) {
  function storage() {
    if (!persistence) {
      throw new Error("Sendero storage is unavailable in this environment.");
    }
    return persistence;
  }

  const server = new McpServer(
    { name: "sendero", version: "0.2.0" },
    {
      instructions:
        "Use render_trip_intake when critical trip details are missing and the host supports UI. Use prepare_trip_brief before planning, validate_itinerary before saving or presenting, and render_itinerary once with the final snapshot. Use the saved-trip tools when the user asks to keep, reopen, share, or restore a plan. Preserve locked activities and confirmed reservations during changes. Never claim a forecast, event, schedule, route, or reservation is confirmed without a current source.",
    },
  );

  server.registerResource("itinerary-ui", ITINERARY_UI_URI, {}, async () =>
    itineraryResource(widgetOrigin),
  );
  server.registerResource("trip-intake-ui", TRIP_INTAKE_UI_URI, {}, async () =>
    tripIntakeResource(widgetOrigin),
  );

  server.registerTool(
    "prepare_trip_brief",
    {
      title: "Prepare trip brief",
      description:
        "Normalize the user's travel requirements and identify critical missing details before researching or scheduling the trip.",
      inputSchema: { brief: tripBriefSchema },
      outputSchema: {
        ready: z.boolean(),
        missing: z.array(z.string()),
        warnings: z.array(z.string()),
        assumptions: z.array(z.string()),
        brief: tripBriefSchema,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: { securitySchemes: toolSecuritySchemes() },
    },
    async ({ brief }) => {
      const result = prepareTripBrief(brief);
      return {
        structuredContent: result,
        content: [
          {
            type: "text",
            text: result.ready
              ? "The trip brief is ready for research and planning."
              : `The trip brief still needs: ${[...result.missing, ...result.warnings].join(", ")}.`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "render_trip_intake",
    {
      title: "Open Sendero trip planner",
      description:
        "Render Sendero's interactive launcher and trip-intake form. Use this instead of asking several trip setup questions in plain text when the user is starting a trip or critical brief details are missing.",
      inputSchema: { brief: tripBriefSchema.optional() },
      outputSchema: {
        brief: tripBriefSchema,
        actions: z.array(z.enum(["new", "open", "adjust", "refresh"])),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: {
        securitySchemes: toolSecuritySchemes(),
        ui: { resourceUri: TRIP_INTAKE_UI_URI },
        "openai/outputTemplate": TRIP_INTAKE_UI_URI,
        "openai/toolInvocation/invoking": "Opening Sendero…",
        "openai/toolInvocation/invoked": "Sendero is ready.",
      },
    },
    async ({ brief = {} }) => ({
      structuredContent: {
        brief,
        actions: ["new", "open", "adjust", "refresh"],
      },
      content: [
        {
          type: "text",
          text: "Sendero's trip form is ready. The user can provide dates, travellers, lodging status, transport, pace, and interests in the component.",
        },
      ],
    }),
  );

  server.registerTool(
    "validate_itinerary",
    {
      title: "Validate itinerary",
      description:
        "Check a complete itinerary for date, transport, overlap, reservation, sourcing, location, and route problems before showing it.",
      inputSchema: { itinerary: itinerarySchema },
      outputSchema: { itinerary: itinerarySchema, validation: validationSchema },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: { securitySchemes: toolSecuritySchemes() },
    },
    async ({ itinerary }) => {
      const validation = validateItinerary(itinerary);
      const normalized = normalizeItinerary(itinerary);
      return {
        structuredContent: { itinerary: normalized, validation },
        content: [
          {
            type: "text",
            text: validation.valid
              ? `Itinerary is valid with ${validation.warnings.length} warning(s).`
              : `Itinerary has ${validation.errors.length} blocking issue(s) and ${validation.warnings.length} warning(s).`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "render_itinerary",
    {
      title: "Render itinerary",
      description:
        "Render the final, already validated itinerary as an interactive list, calendar, and daily route view. Always call validate_itinerary first.",
      inputSchema: { itinerary: itinerarySchema },
      outputSchema: { itinerary: itinerarySchema, validation: validationSchema },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: {
        securitySchemes: toolSecuritySchemes(),
        ui: { resourceUri: ITINERARY_UI_URI },
        "openai/outputTemplate": ITINERARY_UI_URI,
        "openai/toolInvocation/invoking": "Preparing itinerary…",
        "openai/toolInvocation/invoked": "Itinerary ready.",
      },
    },
    async ({ itinerary }) => {
      const normalized = normalizeItinerary(itinerary);
      const validation = validateItinerary(normalized);
      return {
        structuredContent: { itinerary: normalized, validation },
        content: [
          {
            type: "text",
            text: `Showing ${normalized.days.length} itinerary day(s) for ${normalized.destination}.`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "list_itineraries",
    {
      title: "List saved itineraries",
      description:
        "List the authenticated user's active Sendero trips, including trips shared as editor or viewer.",
      inputSchema: {},
      outputSchema: { trips: z.array(tripSummarySchema) },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: { securitySchemes: toolSecuritySchemes([AUTH_SCOPES.read]) },
    },
    async () => {
      const denied = authorizeTool(auth, [AUTH_SCOPES.read]);
      if (denied) return denied;
      const trips = await storage().list();
      return {
        structuredContent: { trips },
        content: [{ type: "text", text: `Found ${trips.length} saved trip(s).` }],
      };
    },
  );

  server.registerTool(
    "get_itinerary",
    {
      title: "Open saved itinerary",
      description:
        "Load one saved itinerary and its version history after checking the authenticated user's access.",
      inputSchema: { tripId: z.string().min(1) },
      outputSchema: {
        id: z.string(),
        role: collaboratorRoleSchema,
        version: z.number().int().positive(),
        itinerary: itinerarySchema,
        revisions: z.array(revisionSummarySchema),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: { securitySchemes: toolSecuritySchemes([AUTH_SCOPES.read]) },
    },
    async ({ tripId }) => {
      const denied = authorizeTool(auth, [AUTH_SCOPES.read]);
      if (denied) return denied;
      const result = await storage().get(tripId);
      const itinerary = normalizeItinerary(itinerarySchema.parse(result.itinerary));
      return {
        structuredContent: { ...result, itinerary },
        content: [
          {
            type: "text",
            text: `Opened ${itinerary.title}, version ${result.version}, with ${result.role} access.`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "save_itinerary",
    {
      title: "Save itinerary",
      description:
        "Create a saved Sendero trip or add a new version to an existing trip. Validate the full itinerary first.",
      inputSchema: {
        tripId: z.string().min(1).optional(),
        itinerary: itinerarySchema,
        reason: z.string().min(1).optional(),
      },
      outputSchema: {
        tripId: z.string(),
        version: z.number().int().positive(),
        role: z.enum(["owner", "editor"]),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      _meta: { securitySchemes: toolSecuritySchemes([AUTH_SCOPES.write]) },
    },
    async ({ tripId, itinerary, reason }) => {
      const denied = authorizeTool(auth, [AUTH_SCOPES.write]);
      if (denied) return denied;
      const normalized = normalizeItinerary(itinerary);
      const validation = validateItinerary(normalized);
      if (!validation.valid) {
        throw new Error(`Itinerary cannot be saved: ${validation.errors.join(" ")}`);
      }
      const result = await storage().save({ tripId, itinerary: normalized, reason });
      return {
        structuredContent: result,
        content: [
          {
            type: "text",
            text: `${tripId ? "Saved a new version" : "Created the trip"} successfully as version ${result.version}.`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "share_itinerary",
    {
      title: "Share itinerary",
      description:
        "Invite a friend to a saved trip as an editor or viewer. Only the trip owner can manage access.",
      inputSchema: {
        tripId: z.string().min(1),
        email: z.string().email(),
        role: z.enum(["editor", "viewer"]),
      },
      outputSchema: {
        collaboratorId: z.string(),
        role: z.enum(["editor", "viewer"]),
        status: z.enum(["pending", "accepted"]),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      _meta: { securitySchemes: toolSecuritySchemes([AUTH_SCOPES.share]) },
    },
    async ({ tripId, email, role }) => {
      const denied = authorizeTool(auth, [AUTH_SCOPES.share]);
      if (denied) return denied;
      const result = await storage().share({ tripId, email, role });
      return {
        structuredContent: result,
        content: [
          {
            type: "text",
            text:
              result.status === "accepted"
                ? `${email} can now access this trip as ${role}.`
                : `${email} has a pending ${role} invitation.`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "restore_itinerary_version",
    {
      title: "Restore itinerary version",
      description:
        "Restore a previous itinerary snapshot as a new version, preserving the complete history.",
      inputSchema: {
        tripId: z.string().min(1),
        version: z.number().int().positive(),
      },
      outputSchema: {
        tripId: z.string(),
        version: z.number().int().positive(),
        restoredFrom: z.number().int().positive(),
        role: z.enum(["owner", "editor"]),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      _meta: { securitySchemes: toolSecuritySchemes([AUTH_SCOPES.write]) },
    },
    async ({ tripId, version }) => {
      const denied = authorizeTool(auth, [AUTH_SCOPES.write]);
      if (denied) return denied;
      const result = await storage().restore({ tripId, version });
      return {
        structuredContent: result,
        content: [
          {
            type: "text",
            text: `Restored version ${version} as the new version ${result.version}.`,
          },
        ],
      };
    },
  );

  return server;
}
