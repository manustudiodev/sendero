import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AUTH_SCOPES, authorizeTool, toolSecuritySchemes } from "./auth.mjs";
import {
  ITINERARY_UI_URI,
  LEGACY_ITINERARY_UI_URI,
  LEGACY_ITINERARY_V3_UI_URI,
  LEGACY_PUBLIC_SHARE_UI_URI,
  LEGACY_PUBLIC_SHARE_V2_UI_URI,
  LEGACY_TRIP_INTAKE_UI_URI,
  LEGACY_TRIP_INTAKE_V3_UI_URI,
  LEGACY_TRIP_LIST_UI_URI,
  LEGACY_TRIP_LIST_V2_UI_URI,
  LEGACY_TRIP_REQUIREMENTS_UI_URI,
  LEGACY_TRIP_REQUIREMENTS_V2_UI_URI,
  LEGACY_TRIP_REQUIREMENTS_V3_UI_URI,
  LEGACY_TRIP_REQUIREMENTS_V4_UI_URI,
  PUBLIC_SHARE_UI_URI,
  TRIP_INTAKE_UI_URI,
  TRIP_LIST_UI_URI,
  TRIP_REQUIREMENTS_UI_URI,
  itineraryResource,
  publicShareResource,
  tripIntakeResource,
  tripListResource,
  tripRequirementsResource,
} from "./ui/resources.mjs";
import {
  buildPublicShareUrl,
  DEFAULT_PUBLIC_SHARE_DAYS,
  derivePublicShareToken,
  hashPublicShareToken,
  publicShareExpiresAt,
} from "./public-sharing.mjs";

export {
  ITINERARY_UI_URI,
  LEGACY_ITINERARY_UI_URI,
  LEGACY_ITINERARY_V3_UI_URI,
  LEGACY_PUBLIC_SHARE_UI_URI,
  LEGACY_PUBLIC_SHARE_V2_UI_URI,
  LEGACY_TRIP_INTAKE_UI_URI,
  LEGACY_TRIP_INTAKE_V3_UI_URI,
  LEGACY_TRIP_LIST_UI_URI,
  LEGACY_TRIP_LIST_V2_UI_URI,
  LEGACY_TRIP_REQUIREMENTS_UI_URI,
  LEGACY_TRIP_REQUIREMENTS_V2_UI_URI,
  LEGACY_TRIP_REQUIREMENTS_V3_UI_URI,
  LEGACY_TRIP_REQUIREMENTS_V4_UI_URI,
  PUBLIC_SHARE_UI_URI,
  TRIP_INTAKE_UI_URI,
  TRIP_LIST_UI_URI,
  TRIP_REQUIREMENTS_UI_URI,
} from "./ui/resources.mjs";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const isoTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");
const checkedAt = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/,
    "Use an ISO date or UTC timestamp",
  )
  .refine((value) => !Number.isNaN(Date.parse(value)), "Use a valid date");
const url = z.string().url();
const httpUrl = url.refine((value) => /^https?:\/\//i.test(value), "Use an HTTP(S) URL");

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
  sourceUrl: httpUrl.optional(),
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

const publicActivitySchema = z.object({
  startTime: isoTime,
  endTime: isoTime.optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  location: z
    .object({
      name: z.string().min(1),
      address: z.string().min(1).optional(),
    })
    .optional(),
  sourceUrl: httpUrl.optional(),
  travelToNext: z
    .object({
      mode: transportMode,
      durationMinutes: z.number().int().nonnegative(),
      summary: z.string().optional(),
    })
    .optional(),
});

export const publicItinerarySchema = z.object({
  schemaVersion: z.literal(1),
  title: z.string().min(1),
  destination: z.string().min(1),
  startDate: isoDate,
  endDate: isoDate,
  baseArea: z.string().min(1).optional(),
  transport: z.object({ modes: z.array(transportMode).min(1) }),
  days: z.array(
    z.object({
      date: isoDate,
      title: z.string().min(1),
      area: z.string().min(1),
      summary: z.string().optional(),
      weather: z
        .object({
          status: z.enum(["forecast", "seasonal", "unknown"]),
          summary: z.string().min(1),
          sourceUrl: httpUrl.optional(),
          checkedAt: checkedAt.optional(),
        })
        .optional(),
      fallback: z.string().optional(),
      activities: z.array(publicActivitySchema),
      route: z
        .object({
          origin: z.string().min(1),
          stops: z.array(z.string().min(1)),
          returnToLodging: z.boolean(),
          mapUrl: httpUrl,
        })
        .optional(),
    }),
  ),
  sources: z
    .array(
      z.object({
        label: z.string().min(1),
        url: httpUrl,
        checkedAt: checkedAt.optional(),
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
      adults: z.number().int().positive().optional(),
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
      modes: z.array(transportMode).optional(),
      hasLicense: z.boolean().optional(),
      wantsCar: z.boolean().optional(),
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

const tripCriticalFieldSchema = z.enum([
  "destination",
  "startDate",
  "endDate",
  "travellers.adults",
  "transport.modes",
]);

const tripCriticalFieldLabels = {
  destination: "el destino",
  startDate: "la fecha de llegada",
  endDate: "la fecha de regreso",
  "travellers.adults": "la cantidad de adultos",
  "transport.modes": "cómo quieren moverse",
};

function humanList(values) {
  if (values.length < 2) return values[0] || "";
  return `${values.slice(0, -1).join(", ")} y ${values.at(-1)}`;
}

const validationSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
});

const collaboratorRoleSchema = z.enum(["owner", "editor", "viewer"]);
const tripListPurposeSchema = z.enum(["open", "adjust", "refresh"]);
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
const publicShareStateSchema = z.enum([
  "preview",
  "published",
  "updated",
  "rotated",
  "active",
  "not_published",
  "expired",
  "revoked",
]);
const publicShareActionSchema = z.enum(["publish", "update"]);
const publicShareSummarySchema = z.object({
  title: z.string().min(1),
  destination: z.string().min(1),
  startDate: isoDate,
  endDate: isoDate,
});
const publicShareOperationIdSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/, "Use only letters, numbers, dots, underscores, colons, and hyphens");
const publicShareStatusFields = {
  state: publicShareStateSchema,
  tripId: z.string().min(1),
  title: z.string().min(1).optional(),
  destination: z.string().min(1).optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  operationId: publicShareOperationIdSchema,
  currentVersion: z.number().int().positive(),
  publishedVersion: z.number().int().positive().optional(),
  isStale: z.boolean(),
  publishedAt: z.number().optional(),
  updatedAt: z.number().optional(),
  expiresAt: z.number().optional(),
};

function minutes(time) {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}

function dateInRange(date, start, end) {
  return date >= start && date <= end;
}

function normalizeSearchText(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findTripMatches(trips, query) {
  const terms = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return trips.filter((trip) => {
    const searchable = normalizeSearchText(`${trip.title} ${trip.destination}`);
    return terms.every((term) => searchable.includes(term));
  });
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
  const criticalFields = [];
  const warnings = [];
  const assumptions = [];
  const blocking = [];
  const requireField = (field) => {
    missing.push(field);
    criticalFields.push(field);
  };
  if (!brief.destination) requireField("destination");
  if (!brief.startDate) requireField("startDate");
  if (!brief.endDate) requireField("endDate");
  if (!brief.travellers?.adults) requireField("travellers.adults");
  if (!brief.transport?.modes?.length) requireField("transport.modes");
  if (
    (brief.transport?.wantsCar || brief.transport?.modes?.includes("car")) &&
    !brief.transport?.hasLicense
  ) {
    blocking.push("A car was requested but no valid driving license is available.");
    criticalFields.push("transport.modes");
  }
  if (brief.startDate && brief.endDate && brief.startDate > brief.endDate) {
    blocking.push("The start date is after the end date.");
    criticalFields.push("startDate", "endDate");
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
    criticalFields: [...new Set(criticalFields)],
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

function newPublicShareOperationId() {
  return `sendero-share:${crypto.randomUUID()}`;
}

function publicShareSummary(itinerary) {
  return {
    title: itinerary.title,
    destination: itinerary.destination,
    startDate: itinerary.startDate,
    endDate: itinerary.endDate,
  };
}

function publicShareStatusOutput({ tripId, itinerary, sharing, operationId, state }) {
  const summary = itinerary
    ? publicShareSummary(itinerary)
    : sharing.summary
      ? publicShareSummarySchema.parse(sharing.summary)
      : undefined;
  return {
    state: state || sharing.status,
    tripId,
    ...(summary || {}),
    operationId,
    currentVersion: sharing.currentVersion,
    ...(sharing.publishedVersion !== undefined
      ? { publishedVersion: sharing.publishedVersion }
      : {}),
    isStale: sharing.isStale,
    ...(sharing.publishedAt !== undefined ? { publishedAt: sharing.publishedAt } : {}),
    ...(sharing.updatedAt !== undefined ? { updatedAt: sharing.updatedAt } : {}),
    ...(sharing.expiresAt !== undefined ? { expiresAt: sharing.expiresAt } : {}),
  };
}

function publicShareToolMeta(invoking, invoked) {
  return {
    securitySchemes: toolSecuritySchemes([AUTH_SCOPES.share]),
    ui: { resourceUri: PUBLIC_SHARE_UI_URI },
    "openai/outputTemplate": PUBLIC_SHARE_UI_URI,
    "openai/toolInvocation/invoking": invoking,
    "openai/toolInvocation/invoked": invoked,
  };
}

export function createTripPlannerServer({
  persistence,
  auth,
  widgetOrigin,
  publicWebUrl = "http://localhost:8788",
  publicShareSecret,
} = {}) {
  function storage() {
    if (!persistence) {
      throw new Error("Sendero storage is unavailable in this environment.");
    }
    return persistence;
  }

  const server = new McpServer(
    { name: "sendero", version: "0.4.4" },
    {
      instructions:
        "Treat natural language as Sendero's primary interface and infer the user's intent from the conversation; slash commands are optional shortcuts. For every successful tool that renders a Sendero component, treat the component as the complete user-facing answer. End the turn without assistant prose when the component already contains the full result. If text is strictly necessary, write at most one short sentence only for a blocker, safety-critical caveat, required citation, or next action that the component does not show. Never restate component labels, values, choices, itinerary items, known trip facts, or tool mechanics. For a clear request to create a trip, extract every supplied fact into a brief and call prepare_trip_brief without opening a launcher or the full intake form. If the brief has criticalFields, call render_trip_requirements once with the normalized brief as the final action of the turn so every currently known critical gap is requested together in one component; never ask those fields one at a time in text and emit no assistant prose after the component. When a Sendero component continues with sendero.stage brief_ready, its validated brief replaces the earlier missing-fields result for the same interactionId: continue planning from that brief and never ask for or render those fields again unless a fresh prepare_trip_brief call on that exact brief still returns criticalFields. Ask later only for information whose relevance genuinely depends on a new answer. If the brief is ready, continue directly with research and planning. Use render_trip_intake mode new only when the user explicitly asks for the guided form or uses the New trip shortcut, and mode menu only when intent is genuinely ambiguous or they ask what Sendero can do. When the user names a specific saved trip, use find_itineraries and continue directly if there is one match; otherwise show saved trips through list_itineraries as clickable cards with the matching purpose. Never repeat trip lists in plain text, tell the user to type a phrase, or expose tool names, stable IDs, or JSON. After a component selection, continue from the exact selected trip ID. If the complete current itinerary is already in context, continue from that snapshot without reloading it; if only its ID is known, call get_itinerary without listing trips again. The latest explicit intent selects open, adjust, or refresh even when an earlier component used another purpose. Treat a consumed component as the chosen path and do not reopen its alternatives unless the user changes intent. If authentication expires, preserve the pending intent and trip ID, describe the action as reconnecting Sendero, and resume once after reconnection. Use validate_itinerary before saving or presenting and render_itinerary once with the final snapshot. Preserve locked activities and confirmed reservations during changes. Never claim a forecast, event, schedule, route, or reservation is confirmed without a current source. Distinguish an email collaborator invitation from a public read-only link. For a public link, only the owner may continue: preview the complete sanitized projection first and require the user's explicit confirmation before publishing or updating it. Reuse the preview's exact proposed expiration when publishing; never recalculate it. Before rotating or revoking, check the current public-link status to obtain a fresh operation context unless the current component already supplied one. The publication is a frozen version and does not change when the private itinerary changes. Updating, rotating, and revoking are explicit actions; rotating invalidates the old link. Never claim that a public link exposes lodging details, reservation notes, collaborators, or version history, and never expose its token hash, internal IDs, or operation IDs in visible prose.",
    },
  );

  server.registerResource("itinerary-ui", ITINERARY_UI_URI, {}, async () =>
    itineraryResource(widgetOrigin),
  );
  server.registerResource("itinerary-ui-v2", LEGACY_ITINERARY_UI_URI, {}, async () =>
    itineraryResource(widgetOrigin, LEGACY_ITINERARY_UI_URI),
  );
  server.registerResource("itinerary-ui-v3", LEGACY_ITINERARY_V3_UI_URI, {}, async () =>
    itineraryResource(widgetOrigin, LEGACY_ITINERARY_V3_UI_URI),
  );
  server.registerResource("trip-intake-ui", TRIP_INTAKE_UI_URI, {}, async () =>
    tripIntakeResource(widgetOrigin),
  );
  server.registerResource("trip-intake-ui-v2", LEGACY_TRIP_INTAKE_UI_URI, {}, async () =>
    tripIntakeResource(widgetOrigin, LEGACY_TRIP_INTAKE_UI_URI),
  );
  server.registerResource("trip-intake-ui-v3", LEGACY_TRIP_INTAKE_V3_UI_URI, {}, async () =>
    tripIntakeResource(widgetOrigin, LEGACY_TRIP_INTAKE_V3_UI_URI),
  );
  server.registerResource("trip-list-ui", TRIP_LIST_UI_URI, {}, async () =>
    tripListResource(widgetOrigin),
  );
  server.registerResource("trip-list-ui-v1", LEGACY_TRIP_LIST_UI_URI, {}, async () =>
    tripListResource(widgetOrigin, LEGACY_TRIP_LIST_UI_URI),
  );
  server.registerResource("trip-list-ui-v2", LEGACY_TRIP_LIST_V2_UI_URI, {}, async () =>
    tripListResource(widgetOrigin, LEGACY_TRIP_LIST_V2_UI_URI),
  );
  server.registerResource("trip-requirements-ui", TRIP_REQUIREMENTS_UI_URI, {}, async () =>
    tripRequirementsResource(widgetOrigin),
  );
  server.registerResource("trip-requirements-ui-v1", LEGACY_TRIP_REQUIREMENTS_UI_URI, {}, async () =>
    tripRequirementsResource(widgetOrigin, LEGACY_TRIP_REQUIREMENTS_UI_URI),
  );
  server.registerResource("trip-requirements-ui-v2", LEGACY_TRIP_REQUIREMENTS_V2_UI_URI, {}, async () =>
    tripRequirementsResource(widgetOrigin, LEGACY_TRIP_REQUIREMENTS_V2_UI_URI),
  );
  server.registerResource("trip-requirements-ui-v3", LEGACY_TRIP_REQUIREMENTS_V3_UI_URI, {}, async () =>
    tripRequirementsResource(widgetOrigin, LEGACY_TRIP_REQUIREMENTS_V3_UI_URI),
  );
  server.registerResource("trip-requirements-ui-v4", LEGACY_TRIP_REQUIREMENTS_V4_UI_URI, {}, async () =>
    tripRequirementsResource(widgetOrigin, LEGACY_TRIP_REQUIREMENTS_V4_UI_URI),
  );
  server.registerResource("public-share-ui", PUBLIC_SHARE_UI_URI, {}, async () =>
    publicShareResource(widgetOrigin),
  );
  server.registerResource("public-share-ui-v1", LEGACY_PUBLIC_SHARE_UI_URI, {}, async () =>
    publicShareResource(widgetOrigin, LEGACY_PUBLIC_SHARE_UI_URI),
  );
  server.registerResource("public-share-ui-v2", LEGACY_PUBLIC_SHARE_V2_UI_URI, {}, async () =>
    publicShareResource(widgetOrigin, LEGACY_PUBLIC_SHARE_V2_UI_URI),
  );

  server.registerTool(
    "prepare_trip_brief",
    {
      title: "Prepare trip brief",
      description:
        "Normalize the user's travel requirements and identify critical missing details before researching or scheduling the trip. A requirements component also calls this tool after submission; when it returns ready with no criticalFields, continue from that validated brief and do not request those fields again.",
      inputSchema: { brief: tripBriefSchema },
      outputSchema: {
        ready: z.boolean(),
        missing: z.array(z.string()),
        criticalFields: z.array(tripCriticalFieldSchema),
        warnings: z.array(z.string()),
        assumptions: z.array(z.string()),
        brief: tripBriefSchema,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: {
        securitySchemes: toolSecuritySchemes(),
        ui: { visibility: ["model", "app"] },
        "openai/widgetAccessible": true,
      },
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
              : `Para continuar faltan ${humanList(result.criticalFields.map((field) => tripCriticalFieldLabels[field]))}. Solicita todos estos datos juntos en una sola interacción.`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "render_trip_requirements",
    {
      title: "Complete essential trip details",
      description:
        "Render one compact component containing every critical field that is currently missing or invalid. Call this after prepare_trip_brief with its normalized brief as the final action of the turn. The component is the complete question: do not ask for the same details separately and emit no assistant prose after it. Do not call when the brief is ready or after the same interaction has returned a validated sendero.stage brief_ready continuation.",
      inputSchema: {
        brief: tripBriefSchema,
        interactionId: z.string().min(1).optional(),
      },
      outputSchema: {
        interactionId: z.string().min(1),
        brief: tripBriefSchema,
        fields: z.array(tripCriticalFieldSchema),
        warnings: z.array(z.string()),
        ready: z.boolean(),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: {
        securitySchemes: toolSecuritySchemes(),
        ui: { resourceUri: TRIP_REQUIREMENTS_UI_URI },
        "openai/outputTemplate": TRIP_REQUIREMENTS_UI_URI,
        "openai/toolInvocation/invoking": "Preparando lo esencial…",
        "openai/toolInvocation/invoked": "Listo para completar.",
      },
    },
    async ({ brief, interactionId }) => {
      const prepared = prepareTripBrief(brief);
      const id = interactionId || `trip-requirements-${crypto.randomUUID()}`;
      return {
        structuredContent: {
          interactionId: id,
          brief: prepared.brief,
          fields: prepared.criticalFields,
          warnings: prepared.warnings,
          ready: prepared.ready,
        },
        content: [
          {
            type: "text",
            text: prepared.ready
              ? "Sendero ya tiene los datos esenciales."
              : "Completa los datos esenciales directamente en Sendero.",
          },
        ],
      };
    },
  );

  server.registerTool(
    "render_trip_intake",
    {
      title: "Start a Sendero trip",
      description:
        "Render Sendero's optional guided intake. Use mode new only when the user asks for a guided form or invokes the New trip shortcut; ordinary natural-language creation should extract known details, prepare the brief, and request only grouped critical gaps. Use mode menu only when the user asks for Sendero's options or their intent is genuinely ambiguous. Do not restate form fields in plain text after rendering.",
      inputSchema: {
        brief: tripBriefSchema.optional(),
        mode: z.enum(["new", "menu"]).optional(),
      },
      outputSchema: {
        brief: tripBriefSchema,
        mode: z.enum(["new", "menu"]),
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
    async ({ brief = {}, mode = "new" }) => ({
      structuredContent: {
        brief,
        mode,
        actions: mode === "menu" ? ["new", "open", "adjust", "refresh"] : [],
      },
      content: [
        {
          type: "text",
          text: "Sendero está listo para continuar.",
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
        "Render the final, already validated itinerary as an interactive list, calendar, and daily route view. Always call validate_itinerary first. The component is the complete answer; do not summarize its visible contents afterward.",
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
            text: "Tu itinerario está listo en Sendero.",
          },
        ],
      };
    },
  );

  server.registerTool(
    "find_itineraries",
    {
      title: "Find a saved itinerary",
      description:
        "Search saved Sendero trips when the user naturally names a specific trip or destination. If exactly one match is returned, continue directly from its stable ID without showing a picker. If the reference remains ambiguous, render clickable cards instead. Never expose the stable ID to the user.",
      inputSchema: { query: z.string().min(1) },
      outputSchema: { trips: z.array(tripSummarySchema) },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: { securitySchemes: toolSecuritySchemes([AUTH_SCOPES.read]) },
    },
    async ({ query }) => {
      const denied = authorizeTool(auth, [AUTH_SCOPES.read]);
      if (denied) return denied;
      const trips = await storage().list();
      const matches = findTripMatches(trips, query);
      return {
        structuredContent: { trips: matches },
        content: [
          {
            type: "text",
            text:
              matches.length === 1
                ? "One saved trip matches the user's reference. Continue with it directly."
                : matches.length > 1
                  ? "Several saved trips match. Let the user choose from clickable cards."
                  : "No saved trip matches that reference.",
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
        "Render the authenticated user's active Sendero trips as clickable cards, including trips shared as editor or viewer. Set purpose to match the requested next step. The component is the complete answer: do not reproduce results as a text list, suggest a typed command, ask the user to type a trip name, or add prose after it; wait for the component selection.",
      inputSchema: { purpose: tripListPurposeSchema.optional() },
      outputSchema: { trips: z.array(tripSummarySchema), purpose: tripListPurposeSchema },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: {
        securitySchemes: toolSecuritySchemes([AUTH_SCOPES.read]),
        ui: { resourceUri: TRIP_LIST_UI_URI },
        "openai/outputTemplate": TRIP_LIST_UI_URI,
        "openai/toolInvocation/invoking": "Loading saved trips…",
        "openai/toolInvocation/invoked": "Saved trips ready.",
      },
    },
    async ({ purpose = "open" }) => {
      const denied = authorizeTool(auth, [AUTH_SCOPES.read]);
      if (denied) return denied;
      const trips = await storage().list();
      return {
        structuredContent: { trips, purpose },
        content: [
          {
            type: "text",
            text: trips.length ? "Elige un viaje en Sendero." : "Todavía no hay viajes guardados.",
          },
        ],
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
      title: "Invite a trip collaborator",
      description:
        "Invite a specific person by email to collaborate on a saved trip as an editor or viewer. This is not the public read-only link. Only the trip owner can manage access.",
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
                ? `${email} ya puede colaborar en el viaje con permiso ${role}.`
                : `La invitación para ${email} quedó pendiente con permiso ${role}.`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "preview_public_share",
    {
      title: "Preview a public trip",
      description:
        "Show the owner the exact sanitized, version-specific itinerary that a public read-only link would expose. Always use this before first publication or before updating an existing publication, then wait for explicit confirmation in the component. The component is the complete answer; do not summarize the preview afterward.",
      inputSchema: {
        tripId: z.string().min(1),
        expiresInDays: z.number().int().min(1).max(365).optional(),
      },
      outputSchema: {
        ...publicShareStatusFields,
        state: z.literal("preview"),
        action: publicShareActionSchema,
        itinerary: publicItinerarySchema,
        expectedVersion: z.number().int().positive(),
        expiresInDays: z.number().int().min(1).max(365),
        proposedExpiresAt: z.number().int().positive(),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: publicShareToolMeta("Preparing the public preview…", "Public preview ready."),
    },
    async ({ tripId, expiresInDays = DEFAULT_PUBLIC_SHARE_DAYS }) => {
      const denied = authorizeTool(auth, [AUTH_SCOPES.share]);
      if (denied) return denied;
      const preview = await storage().publicPreview(tripId);
      const itinerary = publicItinerarySchema.parse(preview.itinerary);
      const action = preview.sharing.status === "active" ? "update" : "publish";
      const operationId = newPublicShareOperationId();
      const proposedExpiresAt = publicShareExpiresAt(expiresInDays);
      return {
        structuredContent: {
          ...publicShareStatusOutput({
            tripId,
            itinerary,
            sharing: preview.sharing,
            operationId,
            state: "preview",
          }),
          action,
          itinerary,
          expectedVersion: preview.version,
          expiresInDays,
          proposedExpiresAt,
        },
        content: [
          {
            type: "text",
            text: "Revisa y confirma la vista pública en Sendero.",
          },
        ],
      };
    },
  );

  server.registerTool(
    "get_public_share_status",
    {
      title: "Check public link",
      description:
        "Show the owner whether a trip has an active, stale, expired, revoked, or not-yet-created public read-only publication.",
      inputSchema: { tripId: z.string().min(1) },
      outputSchema: publicShareStatusFields,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: publicShareToolMeta("Checking the public link…", "Public link status ready."),
    },
    async ({ tripId }) => {
      const denied = authorizeTool(auth, [AUTH_SCOPES.share]);
      if (denied) return denied;
      const sharing = await storage().publicStatus(tripId);
      const operationId = newPublicShareOperationId();
      const output = publicShareStatusOutput({
        tripId,
        sharing,
        operationId,
      });
      const descriptions = {
        active: output.isStale
          ? "El enlace sigue activo, pero el viaje privado tiene cambios que todavía no se publicaron."
          : "El enlace público está activo y muestra la versión publicada más reciente.",
        expired: "El enlace público venció y ya no abre el viaje.",
        revoked: "El enlace público fue revocado y ya no abre el viaje.",
        not_published: "Este viaje todavía no tiene un enlace público.",
      };
      return {
        structuredContent: output,
        content: [{ type: "text", text: descriptions[output.state] }],
      };
    },
  );

  server.registerTool(
    "publish_public_share",
    {
      title: "Create a public trip link",
      description:
        "After the owner confirms the exact preview, publish that trip version as a frozen, sanitized, read-only page. Recreates expired or revoked publications with a new link.",
      inputSchema: {
        tripId: z.string().min(1),
        expectedVersion: z.number().int().positive(),
        proposedExpiresAt: z.number().int().positive(),
        operationId: publicShareOperationIdSchema,
      },
      outputSchema: {
        ...publicShareStatusFields,
        state: z.literal("published"),
        publicUrl: url,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
      _meta: publicShareToolMeta("Creating the public link…", "Public link created."),
    },
    async ({ tripId, expectedVersion, proposedExpiresAt, operationId }) => {
      const denied = authorizeTool(auth, [AUTH_SCOPES.share]);
      if (denied) return denied;
      const token = derivePublicShareToken({
        secret: publicShareSecret,
        purpose: "publish",
        tripId,
        operationId,
      });
      const result = await storage().publishPublic({
        tripId,
        expectedVersion,
        tokenHash: hashPublicShareToken(token),
        expiresAt: proposedExpiresAt,
        operationId,
      });
      const publicUrl = buildPublicShareUrl({ baseUrl: publicWebUrl, token });
      const output = {
        ...publicShareStatusOutput({
          tripId,
          sharing: result,
          operationId,
          state: "published",
        }),
        publicUrl,
      };
      return {
        structuredContent: output,
        content: [
          {
            type: "text",
            text: `El enlace público de solo lectura ya está listo: ${publicUrl}`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "update_public_share",
    {
      title: "Update a public trip",
      description:
        "After the owner confirms the exact preview, replace an active public snapshot with the current private trip version while preserving the same link.",
      inputSchema: {
        tripId: z.string().min(1),
        expectedVersion: z.number().int().positive(),
        operationId: publicShareOperationIdSchema,
      },
      outputSchema: {
        ...publicShareStatusFields,
        state: z.literal("updated"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
      _meta: publicShareToolMeta("Updating the public trip…", "Public trip updated."),
    },
    async ({ tripId, expectedVersion, operationId }) => {
      const denied = authorizeTool(auth, [AUTH_SCOPES.share]);
      if (denied) return denied;
      const result = await storage().updatePublic({ tripId, expectedVersion, operationId });
      const output = publicShareStatusOutput({
        tripId,
        sharing: result,
        operationId,
        state: "updated",
      });
      return {
        structuredContent: output,
        content: [
          {
            type: "text",
            text: "La vista pública ahora refleja la versión que acabas de revisar. El enlace sigue siendo el mismo.",
          },
        ],
      };
    },
  );

  server.registerTool(
    "rotate_public_share",
    {
      title: "Replace a public trip link",
      description:
        "Create a new URL for an active public publication and immediately invalidate the previous URL. Use only after the owner explicitly asks to replace the link, with the fresh operation ID returned by the latest public-link status.",
      inputSchema: {
        tripId: z.string().min(1),
        operationId: publicShareOperationIdSchema,
      },
      outputSchema: {
        ...publicShareStatusFields,
        state: z.literal("rotated"),
        publicUrl: url,
      },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
      _meta: publicShareToolMeta("Replacing the public link…", "Public link replaced."),
    },
    async ({ tripId, operationId }) => {
      const denied = authorizeTool(auth, [AUTH_SCOPES.share]);
      if (denied) return denied;
      const token = derivePublicShareToken({
        secret: publicShareSecret,
        purpose: "rotate",
        tripId,
        operationId,
      });
      const result = await storage().rotatePublic({
        tripId,
        tokenHash: hashPublicShareToken(token),
        operationId,
      });
      const publicUrl = buildPublicShareUrl({ baseUrl: publicWebUrl, token });
      const output = {
        ...publicShareStatusOutput({
          tripId,
          sharing: result,
          operationId,
          state: "rotated",
        }),
        publicUrl,
      };
      return {
        structuredContent: output,
        content: [
          {
            type: "text",
            text: `El enlace anterior dejó de funcionar. Este es el nuevo enlace público: ${publicUrl}`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "revoke_public_share",
    {
      title: "Revoke a public trip link",
      description:
        "Immediately make the current public trip URL unavailable. Use only after the owner explicitly asks to revoke it, with the fresh operation ID returned by the latest public-link status.",
      inputSchema: {
        tripId: z.string().min(1),
        operationId: publicShareOperationIdSchema,
      },
      outputSchema: {
        ...publicShareStatusFields,
        state: z.union([z.literal("revoked"), z.literal("not_published")]),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
      _meta: publicShareToolMeta("Revoking the public link…", "Public link revoked."),
    },
    async ({ tripId, operationId }) => {
      const denied = authorizeTool(auth, [AUTH_SCOPES.share]);
      if (denied) return denied;
      const result = await storage().revokePublic({ tripId, operationId });
      const state = result.status === "not_published" ? "not_published" : "revoked";
      const output = publicShareStatusOutput({
        tripId,
        sharing: result,
        operationId,
        state,
      });
      return {
        structuredContent: output,
        content: [
          {
            type: "text",
            text:
              state === "revoked"
                ? "El enlace público fue revocado y ya no permite abrir el viaje."
                : "Este viaje no tenía un enlace público activo.",
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
