import { createHash } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { senderoEnvironmentIdentity } from "../config/environment.mjs";
import { AUTH_SCOPES, authorizeTool, toolSecuritySchemes } from "./auth.mjs";
import {
  ITINERARY_UI_URI,
  LEGACY_ITINERARY_UI_URI,
  LEGACY_ITINERARY_V3_UI_URI,
  LEGACY_ITINERARY_V4_UI_URI,
  LEGACY_ITINERARY_V5_UI_URI,
  LEGACY_ITINERARY_V6_UI_URI,
  LEGACY_ITINERARY_V7_UI_URI,
  LEGACY_ITINERARY_V8_UI_URI,
  LEGACY_ITINERARY_V9_UI_URI,
  LEGACY_ITINERARY_V10_UI_URI,
  LEGACY_ITINERARY_V11_UI_URI,
  LEGACY_ITINERARY_V12_UI_URI,
  LEGACY_ITINERARY_V13_UI_URI,
  LEGACY_PUBLIC_SHARE_UI_URI,
  LEGACY_PUBLIC_SHARE_V2_UI_URI,
  LEGACY_PUBLIC_SHARE_V3_UI_URI,
  LEGACY_PUBLIC_SHARE_V4_UI_URI,
  LEGACY_PUBLIC_SHARE_V5_UI_URI,
  LEGACY_PUBLIC_SHARE_V6_UI_URI,
  LEGACY_TRIP_INTAKE_UI_URI,
  LEGACY_TRIP_INTAKE_V3_UI_URI,
  LEGACY_TRIP_INTAKE_V4_UI_URI,
  LEGACY_TRIP_INTAKE_V5_UI_URI,
  LEGACY_TRIP_INTAKE_V6_UI_URI,
  LEGACY_TRIP_INTAKE_V7_UI_URI,
  LEGACY_TRIP_LIST_UI_URI,
  LEGACY_TRIP_LIST_V2_UI_URI,
  LEGACY_TRIP_LIST_V3_UI_URI,
  LEGACY_TRIP_LIST_V4_UI_URI,
  LEGACY_TRIP_LIST_V5_UI_URI,
  LEGACY_TRIP_LIST_V6_UI_URI,
  LEGACY_TRIP_REQUIREMENTS_UI_URI,
  LEGACY_TRIP_REQUIREMENTS_V2_UI_URI,
  LEGACY_TRIP_REQUIREMENTS_V3_UI_URI,
  LEGACY_TRIP_REQUIREMENTS_V4_UI_URI,
  LEGACY_TRIP_REQUIREMENTS_V5_UI_URI,
  LEGACY_TRIP_REQUIREMENTS_V6_UI_URI,
  LEGACY_TRIP_REQUIREMENTS_V7_UI_URI,
  LEGACY_TRIP_REQUIREMENTS_V8_UI_URI,
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
  isActivePublicShareConflict,
  publicShareExpiresAt,
  recoverPublicShareUrl,
} from "./public-sharing.mjs";
import {
  deriveInvitationToken,
  hashInvitationToken,
} from "./invitations.mjs";
import { canonicalLocale, DEFAULT_LOCALE, localeLanguage } from "../shared/locale.mjs";
import {
  BUDGET_CATEGORIES,
  itineraryBudgetSummary,
  normalizeBudgetPreference,
} from "../shared/itinerary-budget.mjs";

export {
  ITINERARY_UI_URI,
  LEGACY_ITINERARY_UI_URI,
  LEGACY_ITINERARY_V3_UI_URI,
  LEGACY_ITINERARY_V4_UI_URI,
  LEGACY_ITINERARY_V5_UI_URI,
  LEGACY_ITINERARY_V6_UI_URI,
  LEGACY_ITINERARY_V7_UI_URI,
  LEGACY_ITINERARY_V8_UI_URI,
  LEGACY_ITINERARY_V9_UI_URI,
  LEGACY_ITINERARY_V10_UI_URI,
  LEGACY_ITINERARY_V11_UI_URI,
  LEGACY_ITINERARY_V12_UI_URI,
  LEGACY_ITINERARY_V13_UI_URI,
  LEGACY_PUBLIC_SHARE_UI_URI,
  LEGACY_PUBLIC_SHARE_V2_UI_URI,
  LEGACY_PUBLIC_SHARE_V3_UI_URI,
  LEGACY_PUBLIC_SHARE_V4_UI_URI,
  LEGACY_PUBLIC_SHARE_V5_UI_URI,
  LEGACY_PUBLIC_SHARE_V6_UI_URI,
  LEGACY_TRIP_INTAKE_UI_URI,
  LEGACY_TRIP_INTAKE_V3_UI_URI,
  LEGACY_TRIP_INTAKE_V4_UI_URI,
  LEGACY_TRIP_INTAKE_V5_UI_URI,
  LEGACY_TRIP_INTAKE_V6_UI_URI,
  LEGACY_TRIP_INTAKE_V7_UI_URI,
  LEGACY_TRIP_LIST_UI_URI,
  LEGACY_TRIP_LIST_V2_UI_URI,
  LEGACY_TRIP_LIST_V3_UI_URI,
  LEGACY_TRIP_LIST_V4_UI_URI,
  LEGACY_TRIP_LIST_V5_UI_URI,
  LEGACY_TRIP_LIST_V6_UI_URI,
  LEGACY_TRIP_REQUIREMENTS_UI_URI,
  LEGACY_TRIP_REQUIREMENTS_V2_UI_URI,
  LEGACY_TRIP_REQUIREMENTS_V3_UI_URI,
  LEGACY_TRIP_REQUIREMENTS_V4_UI_URI,
  LEGACY_TRIP_REQUIREMENTS_V5_UI_URI,
  LEGACY_TRIP_REQUIREMENTS_V6_UI_URI,
  LEGACY_TRIP_REQUIREMENTS_V7_UI_URI,
  LEGACY_TRIP_REQUIREMENTS_V8_UI_URI,
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
const localeSchema = z
  .string()
  .trim()
  .min(2)
  .max(35)
  .regex(
    /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/,
    "Use a BCP 47 language tag such as es, es-AR, en, or en-GB",
  );

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

const currencyCode = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{3}$/, "Use a three-letter ISO 4217 currency code such as USD or EUR");
const budgetCategory = z.enum(BUDGET_CATEGORIES);
const legacyBudgetComfort = z.enum(["low", "medium", "high", "flexible"]);
const structuredBudgetSchema = z
  .object({
    amount: z.number().positive().describe("Target spending limit in the selected currency.").optional(),
    currency: currencyCode.describe("Currency used for the budget and every itinerary cost estimate.").optional(),
    scope: z
      .enum(["total", "per_person", "per_day"])
      .describe("Whether amount applies to the whole trip, each traveller, or each itinerary day.")
      .optional(),
    includes: z
      .array(budgetCategory)
      .min(1)
      .describe("Expense categories counted against the limit. Lodging and long-distance transport must be explicit.")
      .optional(),
    flexibility: z
      .enum(["strict", "target", "flexible"])
      .describe("Whether the amount is a hard cap, a target, or a flexible reference.")
      .optional(),
    comfort: legacyBudgetComfort
      .describe("Qualitative spending preference, retained when no monetary amount is known.")
      .optional(),
  })
  .superRefine((budget, context) => {
    if (budget.amount !== undefined && !budget.currency) {
      context.addIssue({ code: "custom", path: ["currency"], message: "A monetary budget requires a currency." });
    }
  });
const tripBudgetSchema = z
  .union([legacyBudgetComfort, structuredBudgetSchema])
  .describe("Qualitative or monetary trip budget. Monetary limits require explicit scope, currency, and inclusions.");

function validateTravellerProfile(travellers, context) {
  if (
    travellers.adults !== undefined
    && travellers.seniors !== undefined
    && travellers.seniors > travellers.adults
  ) {
    context.addIssue({
      code: "custom",
      path: ["seniors"],
      message: "Senior travellers are included in the adult count and cannot exceed it.",
    });
  }
  if (
    travellers.children !== undefined
    && travellers.childAges?.length > travellers.children
  ) {
    context.addIssue({
      code: "custom",
      path: ["childAges"],
      message: "Child ages cannot contain more entries than the child count.",
    });
  }
  if (
    travellers.seniors !== undefined
    && travellers.seniorAges?.length > travellers.seniors
  ) {
    context.addIssue({
      code: "custom",
      path: ["seniorAges"],
      message: "Senior ages cannot contain more entries than the senior count.",
    });
  }
}

const itineraryTravellersSchema = z
  .object({
    adults: z.number().int().positive(),
    children: z.number().int().nonnegative().default(0),
    childAges: z.array(z.number().int().min(0).max(17)).max(20).optional(),
    seniors: z.number().int().nonnegative().default(0),
    seniorAges: z.array(z.number().int().min(18).max(120)).max(20).optional(),
  })
  .superRefine(validateTravellerProfile);

const tripBriefTravellersSchema = z
  .object({
    adults: z.number().int().positive().describe("Number of adult travellers when stated.").optional(),
    children: z.number().int().nonnegative().describe("Number of child travellers; omit or use zero when there are none.").optional(),
    childAges: z.array(z.number().int().min(0).max(17)).max(20).describe("Known child ages; partial ages are allowed.").optional(),
    seniors: z.number().int().nonnegative().describe("Adults aged 55 or older who may need age-aware pacing; included in adults.").optional(),
    seniorAges: z.array(z.number().int().min(18).max(120)).max(20).describe("Known ages for travellers the user identifies as older adults; partial ages are allowed.").optional(),
  })
  .superRefine(validateTravellerProfile);

const dailyScheduleSchema = z
  .object({
    earliestStartTime: isoTime.describe("Preferred earliest activity start in local time.").optional(),
    latestEndTime: isoTime.describe("Preferred latest activity end in local time.").optional(),
    mealTimes: z
      .object({
        breakfast: isoTime.optional(),
        lunch: isoTime.optional(),
        dinner: isoTime.optional(),
      })
      .optional(),
  })
  .superRefine((schedule, context) => {
    if (
      schedule.earliestStartTime
      && schedule.latestEndTime
      && schedule.earliestStartTime >= schedule.latestEndTime
    ) {
      context.addIssue({
        code: "custom",
        path: ["latestEndTime"],
        message: "The preferred day end must be after the preferred day start.",
      });
    }
  });

const mobilityProfileSchema = z.object({
  walkingTolerance: z.enum(["low", "moderate", "high"]).optional(),
  maxWalkingMinutes: z.number().int().min(5).max(240).describe("Maximum preferred duration for one walking leg.").optional(),
  avoidStairs: z.boolean().optional(),
  wheelchairAccess: z.boolean().optional(),
  restFrequency: z.enum(["frequent", "regular", "minimal"]).optional(),
});

const activityAccessibilitySchema = z
  .object({
    status: z.enum(["verified", "reported", "unknown"]),
    wheelchairAccessible: z.boolean().optional(),
    stepFree: z.boolean().optional(),
    seatingAvailable: z.boolean().optional(),
    note: z.string().min(1).optional(),
    sourceUrl: httpUrl.optional(),
    checkedAt: checkedAt.optional(),
  })
  .superRefine((accessibility, context) => {
    if (accessibility.status === "verified" && !accessibility.sourceUrl) {
      context.addIssue({
        code: "custom",
        path: ["sourceUrl"],
        message: "Verified accessibility information requires an HTTP(S) source URL.",
      });
    }
  });

const costEstimateSchema = z
  .object({
    category: budgetCategory,
    status: z.enum(["free", "estimated", "verified", "unknown"]),
    currency: currencyCode.optional(),
    min: z.number().nonnegative().optional(),
    max: z.number().nonnegative().optional(),
    basis: z.enum(["party", "person"]).default("party"),
    sourceUrl: httpUrl.optional(),
    checkedAt: checkedAt.optional(),
    note: z.string().min(1).optional(),
  })
  .superRefine((cost, context) => {
    const priced = cost.status === "estimated" || cost.status === "verified";
    if (priced && (!cost.currency || cost.min === undefined || cost.max === undefined)) {
      context.addIssue({
        code: "custom",
        message: "Estimated or verified costs require currency, min, and max.",
      });
    }
    if (cost.min !== undefined && cost.max !== undefined && cost.max < cost.min) {
      context.addIssue({ code: "custom", path: ["max"], message: "Cost max must be greater than or equal to min." });
    }
    if (cost.status === "verified" && !cost.sourceUrl) {
      context.addIssue({ code: "custom", path: ["sourceUrl"], message: "A verified cost requires an HTTP(S) source URL." });
    }
    if ((cost.status === "free" || cost.status === "unknown") && (cost.min !== undefined || cost.max !== undefined)) {
      context.addIssue({ code: "custom", message: "Free or unknown costs must not include a monetary range." });
    }
  });

const additionalCostSchema = costEstimateSchema.and(z.object({
  id: z.string().min(1),
  label: z.string().min(1),
}));

const coordinateFields = {
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
};

function requireCoordinatePairs(location, context) {
  if ((location.lat === undefined) !== (location.lng === undefined)) {
    context.addIssue({
      code: "custom",
      message: "Location coordinates require both lat and lng.",
    });
  }
  if ((location.latitude === undefined) !== (location.longitude === undefined)) {
    context.addIssue({
      code: "custom",
      message: "Location coordinates require both latitude and longitude.",
    });
  }
}

const locationSchema = z
  .object({
    name: z.string().min(1),
    address: z.string().min(1),
    ...coordinateFields,
  })
  .superRefine(requireCoordinatePairs);

const lodgingSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1).optional(),
  area: z.string().min(1).optional(),
  status: z.enum(["confirmed", "area_only", "undecided"]).optional(),
});

const tripBriefLodgingSchema = z.object({
  name: z.string().min(1).describe("Hotel, rental, or lodging name when known.").optional(),
  address: z.string().min(1).describe("Exact lodging address only when the user supplied it.").optional(),
  area: z.string().min(1).describe("Neighborhood or area where the user will stay, including a provisional base.").optional(),
  status: z
    .enum(["confirmed", "area_only", "undecided"])
    .describe("Whether lodging is confirmed, known only by area, or still undecided.")
    .optional(),
});

const reservationSchema = z.object({
  status: z.enum(["not_needed", "suggested", "pending", "confirmed", "cancelled"]),
  kind: z.enum(["reservation", "ticket"]).optional(),
  requirement: z.enum(["required", "recommended", "optional"]).optional(),
  url: httpUrl.optional(),
  deadline: z.string().optional(),
  note: z.string().optional(),
});

const activityGuideSchema = z.object({
  overview: z
    .string()
    .min(1)
    .max(1200)
    .describe(
      "Source-backed visitor context about the place: its history, cultural relevance, interesting facts, and what is worth noticing. Keep schedules and logistics in activity.description.",
    ),
  highlights: z.array(z.string().min(1).max(240)).max(4).optional(),
  sources: z
    .array(
      z.object({
        label: z.string().min(1),
        url: httpUrl,
        checkedAt: checkedAt.optional(),
      }),
    )
    .min(1)
    .max(4),
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
  guide: activityGuideSchema.optional(),
  accessibility: activityAccessibilitySchema
    .describe("Accessibility facts for this place when the traveller profile makes them relevant.")
    .optional(),
  cost: costEstimateSchema
    .describe("Estimated public price for this activity or meal. Use party basis for a group-specific quote.")
    .optional(),
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
  mapUrl: httpUrl.optional(),
  mapUrls: z.array(httpUrl).optional(),
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
      sourceUrl: httpUrl.optional(),
      checkedAt: z.string().optional(),
    })
    .optional(),
  fallback: z.string().optional(),
  activities: z.array(activitySchema),
  additionalCosts: z
    .array(additionalCostSchema)
    .describe("Costs not already represented by an activity, such as a transit pass or nightly lodging.")
    .optional(),
  route: routeSchema.optional(),
});

const ianaTimezone = z
  .string()
  .min(1)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value }).format(0);
      return true;
    } catch {
      return false;
    }
  }, "Use an IANA timezone such as America/Argentina/Buenos_Aires")
  .describe("IANA timezone for the trip destination, used to interpret every local itinerary time.");

export const itinerarySchema = z.object({
  id: z.string().optional(),
  locale: localeSchema.default(DEFAULT_LOCALE),
  title: z.string().min(1),
  destination: z.string().min(1),
  startDate: isoDate,
  endDate: isoDate,
  timezone: ianaTimezone.optional(),
  lodging: lodgingSchema.optional(),
  travellers: itineraryTravellersSchema
    .describe("Traveller counts used to expand per-person cost estimates.")
    .optional(),
  arrivalTime: isoTime.describe("Earliest usable local time on the first itinerary day.").optional(),
  departureTime: isoTime.describe("Latest usable local time on the final itinerary day.").optional(),
  dailySchedule: dailyScheduleSchema.optional(),
  mobility: mobilityProfileSchema.optional(),
  accessibilityNeeds: z.array(z.string().min(1)).optional(),
  budget: tripBudgetSchema
    .describe("Private spending constraint copied from the prepared brief. It is omitted from public shares.")
    .optional(),
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
        url: httpUrl,
        checkedAt: z.string().optional(),
      }),
    )
    .optional(),
});

const publicActivitySchema = z.object({
  publicId: z.string().min(1).optional(),
  startTime: isoTime,
  endTime: isoTime.optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  location: z
    .object({
      name: z.string().min(1),
      address: z.string().min(1).optional(),
      ...coordinateFields,
    })
    .superRefine(requireCoordinatePairs)
    .optional(),
  sourceUrl: httpUrl.optional(),
  guide: activityGuideSchema.optional(),
  booking: z
    .object({
      required: z.boolean(),
      confirmed: z.boolean(),
    })
    .optional(),
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
  locale: localeSchema.default(DEFAULT_LOCALE),
  title: z.string().min(1),
  destination: z.string().min(1),
  startDate: isoDate,
  endDate: isoDate,
  timezone: ianaTimezone.optional(),
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
          mapUrls: z.array(httpUrl).optional(),
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

export const tripBriefSchema = z.object({
  locale: localeSchema
    .describe(
      "BCP 47 locale inferred from the user's predominant language. Always provide it without asking the user; for example es, es-AR, en, en-GB, or pt-BR.",
    )
    .default(DEFAULT_LOCALE),
  destination: z
    .string()
    .describe("Trip destination as stated by the user, ideally city and country; for example, Santiago de Chile.")
    .optional(),
  destinationPlaceId: z
    .string()
    .min(1)
    .max(255)
    .describe("Canonical Google Maps place ID selected by the user for the destination.")
    .optional(),
  startDate: isoDate.describe("Arrival or first itinerary date in YYYY-MM-DD format when known.").optional(),
  endDate: isoDate.describe("Departure or final itinerary date in YYYY-MM-DD format when known.").optional(),
  lodging: tripBriefLodgingSchema.describe("Known or provisional lodging context; an exact address is not required.").optional(),
  travellers: tripBriefTravellersSchema
    .describe("Party size extracted from the request.")
    .optional(),
  arrivalTime: isoTime.describe("Known local arrival time; omit when it is not stated or does not constrain the day.").optional(),
  departureTime: isoTime.describe("Known local departure time; omit when it is not stated or does not constrain the day.").optional(),
  dailySchedule: dailyScheduleSchema.describe("Optional daily start, end, and meal-time preferences.").optional(),
  mobility: mobilityProfileSchema.describe("Optional walking, stairs, wheelchair, and rest constraints.").optional(),
  budget: tripBudgetSchema.optional(),
  pace: z.enum(["relaxed", "balanced", "intense"]).describe("Desired daily itinerary intensity.").optional(),
  interests: z.array(z.string()).describe("Travel interests already mentioned, in the user's own level of specificity.").optional(),
  mustDo: z.array(z.string()).describe("Places or experiences the user explicitly wants included.").optional(),
  avoid: z.array(z.string()).describe("Activities, styles, places, or constraints the user explicitly wants excluded.").optional(),
  dietaryNeeds: z.array(z.string()).optional(),
  accessibilityNeeds: z.array(z.string()).optional(),
  transport: z
    .object({
      modes: z.array(transportMode).describe("Allowed or preferred transport modes already stated by the user.").optional(),
      hasLicense: z.boolean().describe("Whether at least one traveller has a valid driving licence, only when relevant or stated.").optional(),
      wantsCar: z.boolean().describe("Whether the travellers want to use or rent a car.").optional(),
    })
    .describe("Mobility constraints and preferred transport for the trip.")
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
    .describe("Existing reservations, tickets, appointments, or other time-locked commitments.")
    .optional(),
  notes: z.string().describe("Any remaining travel context that does not fit another field.").optional(),
});

const tripCriticalFieldSchema = z.enum([
  "destination",
  "startDate",
  "endDate",
  "travellers.adults",
  "transport.modes",
]);

const tripCriticalFieldLabels = {
  en: {
    destination: "the destination",
    startDate: "the arrival date",
    endDate: "the return date",
    "travellers.adults": "the number of adults",
    "transport.modes": "how you want to get around",
  },
  es: {
    destination: "el destino",
    startDate: "la fecha de llegada",
    endDate: "la fecha de regreso",
    "travellers.adults": "la cantidad de adultos",
    "transport.modes": "cómo quieren moverse",
  },
  pt: {
    destination: "o destino",
    startDate: "a data de chegada",
    endDate: "a data de retorno",
    "travellers.adults": "a quantidade de adultos",
    "transport.modes": "como vocês querem se locomover",
  },
  fr: {
    destination: "la destination",
    startDate: "la date d’arrivée",
    endDate: "la date de retour",
    "travellers.adults": "le nombre d’adultes",
    "transport.modes": "le mode de déplacement souhaité",
  },
  de: {
    destination: "das Reiseziel",
    startDate: "das Anreisedatum",
    endDate: "das Rückreisedatum",
    "travellers.adults": "die Anzahl der Erwachsenen",
    "transport.modes": "die gewünschten Verkehrsmittel",
  },
};

function localizedToolCopy(locale, copy) {
  return copy[localeLanguage(locale)] || copy.en;
}

function humanList(values, locale = DEFAULT_LOCALE) {
  if (!values.length) return "";
  return new Intl.ListFormat(canonicalLocale(locale), {
    style: "long",
    type: "conjunction",
  }).format(values);
}

const validationSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
});

const collaboratorRoleSchema = z.enum(["owner", "editor", "viewer"]);
const tripListPurposeSchema = z.enum(["open", "adjust", "refresh"]);
const tripReferenceTextSchema = z.string().trim();
const tripSearchSelectorSchema = z
  .string()
  .trim()
  .describe(
    "Use latest_updated for the user's last, latest, or most recently saved trip. Natural-language equivalents are also accepted.",
  );
const tripSearchInputSchema = z
  .object({
    selector: tripSearchSelectorSchema.optional(),
    query: tripReferenceTextSchema.optional(),
    reference: tripReferenceTextSchema.optional(),
    startDate: isoDate.optional(),
    endDate: isoDate.optional(),
  })
  .strict();
const tripOpenInputSchema = z
  .object({
    tripId: tripReferenceTextSchema
      .describe("Opaque stable trip ID returned by Sendero; never invent this value.")
      .optional(),
    selector: tripSearchSelectorSchema.optional(),
    query: tripReferenceTextSchema.optional(),
    reference: tripReferenceTextSchema.optional(),
    startDate: isoDate.optional(),
    endDate: isoDate.optional(),
  })
  .strict();
const tripSummarySchema = z.object({
  id: z.string(),
  locale: localeSchema.default(DEFAULT_LOCALE),
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
  locale: localeSchema.default(DEFAULT_LOCALE),
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
const shareTripPubliclyInputSchema = z
  .object({
    tripId: tripReferenceTextSchema
      .describe("Opaque stable trip ID returned by Sendero; never invent this value.")
      .optional(),
    selector: z.enum(["latest_updated"]).optional(),
    query: tripReferenceTextSchema.optional(),
    reference: tripReferenceTextSchema.optional(),
    startDate: isoDate.optional(),
    endDate: isoDate.optional(),
    expiresInDays: z.number().int().min(1).max(365).optional(),
    operationId: publicShareOperationIdSchema.describe(
      "Create one operation ID for this explicit sharing request and reuse it unchanged on an exact retry.",
    ),
  })
  .strict();
const reservationOperationIdSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/, "Use only letters, numbers, dots, underscores, colons, and hyphens");
const tripWriteOperationIdSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/, "Use only letters, numbers, dots, underscores, colons, and hyphens");
const accessOperationIdSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/, "Use only letters, numbers, dots, underscores, colons, and hyphens");
const memberPermissionSchema = z.enum(["viewer", "collaborator"]);
const invitationLifecycleSchema = z.enum([
  "pending",
  "accepted",
  "declined",
  "expired",
  "revoked",
]);
const invitationDeliverySchema = z.enum([
  "queued",
  "processing",
  "retry_scheduled",
  "sent",
  "not_configured",
  "failed",
  "unknown",
]);
const invitationDeliveryReceiptSchema = z.object({
  purpose: z.enum(["invite", "resend"]),
  status: invitationDeliverySchema,
  attemptCount: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  provider: z.string().optional(),
  providerEvent: z.enum([
    "accepted",
    "delivered",
    "delayed",
    "bounced",
    "complained",
    "failed",
  ]).optional(),
  lastErrorCode: z.string().optional(),
  updatedAt: z.number().int(),
});
const accessOwnerSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  role: z.literal("owner"),
});
const accessMemberSchema = z.object({
  memberId: z.string().min(1),
  name: z.string().optional(),
  email: z.string().email().optional(),
  role: memberPermissionSchema,
  status: z.literal("active"),
  createdAt: z.number().int().optional(),
  updatedAt: z.number().int().optional(),
});
const accessInvitationSchema = z.object({
  invitationId: z.string().min(1),
  email: z.string().email(),
  role: memberPermissionSchema,
  status: invitationLifecycleSchema,
  expiresAt: z.number().int(),
  sentAt: z.number().int().optional(),
  delivery: invitationDeliveryReceiptSchema.optional(),
});
const publicShareStatusFields = {
  state: publicShareStateSchema,
  tripId: z.string().min(1),
  locale: localeSchema.optional(),
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
  publicUrl: url.optional(),
};

const {
  operationId: _publicShareOperationIdField,
  ...publicShareReceiptFields
} = publicShareStatusFields;
const {
  publicUrl: _publicShareUrlField,
  ...publicShareStatusOnlyFields
} = publicShareStatusFields;

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

const latestTripReferences = new Set([
  "latest",
  "latest updated",
  "latest trip",
  "last",
  "last saved",
  "last saved trip",
  "last trip",
  "most recent",
  "most recent trip",
  "most recently saved",
  "most recently saved trip",
  "newest trip",
  "ultimo",
  "ultimo guardado",
  "ultimo que guarde",
  "ultimo viaje",
  "ultimo viaje guardado",
  "mas reciente",
  "viaje mas reciente",
]);

function isLatestTripReference(value) {
  if (!value) return false;
  const normalized = normalizeSearchText(value);
  if (!normalized) return false;
  const withoutLeadingDeterminer = normalized.replace(
    /^(?:el|la|mi|mis|the|my)\s+/,
    "",
  );
  const hasNegatedOpen =
    /\bno\b.{0,32}\b(?:abras?|abra|abrir|muestres?|muestre|mostrar|uses?|use|usar)\b/.test(
      normalized,
    ) ||
    /\b(?:do\s+not|don\s+t|dont|never)\b.{0,32}\b(?:open|show|use)\b/.test(
      normalized,
    );
  const hasNegatedRecencyReference =
    /\bno\s+(?:(?:el|la|mi|mis)\s+)?(?:ultimo|mas\s+reciente)\b/.test(normalized) ||
    /\b(?:not|never)\s+(?:(?:the|my)\s+)?(?:latest|last|most\s+recent|most\s+recently\s+saved|newest)\b/.test(
      normalized,
    );
  const hasNamedDestinationQualifier =
    /\b(?:ultimo|mas\s+reciente)\b(?:\s+(?:viaje|itinerario|guardado|que\s+guarde)){0,4}\s+(?:a|de|en|por)\s+(?!sendero\b)\w/.test(
      normalized,
    ) ||
    /\b(?:latest|last|most\s+recent|most\s+recently\s+saved|newest)\b(?:\s+(?:saved|trip|itinerary)){0,4}\s+(?:in|to|through|for)\s+(?!sendero\b)\w/.test(
      normalized,
    );
  const hasNamedTitleQualifier =
    /\b(?:ultimo|mas\s+reciente)\b(?:\s+(?:viaje|itinerario|guardado|que\s+guarde)){0,4}\s+(?:llamad[oa]|titulad[oa]|que\s+se\s+llama)\s+\w/.test(
      normalized,
    ) ||
    /\b(?:latest|last|most\s+recent|most\s+recently\s+saved|newest)\b(?:\s+(?:saved|trip|itinerary)){0,4}\s+(?:called|named|titled)\s+\w/.test(
      normalized,
    );
  if (
    hasNegatedOpen ||
    hasNegatedRecencyReference ||
    hasNamedDestinationQualifier ||
    hasNamedTitleQualifier
  ) {
    return false;
  }
  if (
    latestTripReferences.has(normalized) ||
    latestTripReferences.has(withoutLeadingDeterminer)
  ) {
    return true;
  }
  const hasPositiveSpanishRecencyIntent =
    /^(?:(?:por\s+favor)\s+)?(?:(?:(?:puedes|podrias|quiero|quisiera|necesito)\s+(?:que\s+)?(?:abrir|ver|mostrar|buscar|recuperar|cargar)\s+)|(?:(?:abre|abreme|abrir|muestra|muestrame|mostrar|ver|busca|buscar|recupera|recuperar|carga|cargar)\s+))(?:(?:el|la|mi|mis)\s+)?(?:(?:ultimo|mas\s+reciente)(?:\s+(?:viaje|itinerario|guardado|que\s+guarde)){0,4}|(?:viaje|itinerario)\s+(?:mas\s+reciente|ultimo)(?:\s+guardado)?)(?:\b|$)/.test(
      normalized,
    );
  const hasPositiveEnglishRecencyIntent =
    /^(?:please\s+)?(?:(?:(?:(?:can|could|would)\s+you|i\s+(?:want|need)\s+to)\s+(?:open|show|see|find|load)\s+)|(?:(?:open|show|find|load)(?:\s+me)?\s+))(?:(?:the|my)\s+)?(?:(?:latest|last|most\s+recent|most\s+recently\s+saved|newest)(?:\s+(?:saved|trip|itinerary)){0,4}|(?:trip|itinerary)\s+(?:latest|last|most\s+recent))(?:\b|$)/.test(
      normalized,
    );
  return hasPositiveSpanishRecencyIntent || hasPositiveEnglishRecencyIntent;
}

function canonicalTripReference({ tripId, selector, query, reference, startDate, endDate }) {
  if (tripId && !isLatestTripReference(tripId)) return { tripId };
  const namedQuery = query && !isLatestTripReference(query) ? query : undefined;
  const namedReference =
    reference && !isLatestTripReference(reference) ? reference : undefined;
  const naturalReference = namedQuery || namedReference;
  if (naturalReference) {
    return {
      query: naturalReference,
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
    };
  }
  if (
    isLatestTripReference(selector) ||
    isLatestTripReference(tripId) ||
    isLatestTripReference(query) ||
    isLatestTripReference(reference) ||
    (!selector && !query && !reference)
  ) {
    return { selector: "latest_updated" };
  }
  return {
    query: selector,
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
  };
}

function findTripMatches(trips, query, { startDate, endDate } = {}) {
  if (!query) return [];
  const terms = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return trips.filter((trip) => {
    const searchable = normalizeSearchText(`${trip.title} ${trip.destination}`);
    return (
      terms.every((term) => searchable.includes(term)) &&
      (!startDate || trip.startDate === startDate) &&
      (!endDate || trip.endDate === endDate)
    );
  });
}

function findLatestUpdatedTrip(trips) {
  return [...trips]
    .sort(
      (left, right) =>
        Number(right.updatedAt) - Number(left.updatedAt) || left.id.localeCompare(right.id),
    )
    .slice(0, 1);
}

function normalizeTripSummary(summary) {
  return {
    ...summary,
    locale: canonicalLocale(summary.locale),
  };
}

function validatedPresentation(itinerary, { reservationCompleteness } = {}) {
  const normalized = itinerarySchema.parse(normalizeItinerary(itinerary));
  const validation = validateItinerary(
    normalized,
    reservationCompleteness ? { reservationCompleteness } : undefined,
  );
  if (!validation.valid) {
    const prefix = localizedToolCopy(normalized.locale, {
      en: "Itinerary cannot be presented",
      es: "El itinerario no se puede presentar",
      pt: "O itinerário não pode ser apresentado",
    });
    throw new Error(`${prefix}: ${validation.errors.join(" ")}`);
  }
  return { itinerary: normalized, validation };
}

function isUnavailableTripError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /Trip (?:not found|access denied)/i.test(message) ||
    /(?:ArgumentValidationError|does not match validator|invalid (?:convex )?id)[\s\S]*tripId/i.test(
      message,
    )
  );
}

function googleTravelMode(mode) {
  if (mode === "walk") return "walking";
  if (mode === "bike") return "bicycling";
  if (mode === "public_transit" || mode === "train") return "transit";
  return "driving";
}

function withDestinationContext(value, destination) {
  const cleanValue = value?.trim();
  if (!cleanValue) return undefined;
  const destinationCity = destination.split(",")[0]?.trim();
  if (
    destinationCity &&
    normalizeSearchText(cleanValue).includes(normalizeSearchText(destinationCity))
  ) {
    return cleanValue;
  }
  return destination ? `${cleanValue}, ${destination}` : cleanValue;
}

function isProvisionalRouteStop(value, itinerary) {
  const normalized = normalizeSearchText(value);
  if (!normalized) return true;
  if (
    /\b(base provisional|provisional base|alojamiento provisional|provisional lodging|por decidir|undecided)\b/.test(
      normalized,
    )
  ) {
    return true;
  }
  const lodgingValues = [
    itinerary.lodging?.name,
    itinerary.lodging?.address,
    itinerary.lodging?.area,
  ]
    .filter(Boolean)
    .map(normalizeSearchText);
  return lodgingValues.some((lodgingValue) => lodgingValue === normalized);
}

function orderedActivityStops(itinerary, day) {
  const seen = new Set();
  const stops = [];
  for (const activity of [...day.activities].sort((left, right) =>
    left.startTime.localeCompare(right.startTime),
  )) {
    const raw = activity.location?.address || activity.location?.name;
    if (!raw || isProvisionalRouteStop(raw, itinerary)) continue;
    const stop = withDestinationContext(raw, itinerary.destination);
    const key = normalizeSearchText(stop);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    stops.push(stop);
  }
  return stops;
}

function confirmedLodgingAddress(itinerary) {
  if (itinerary.lodging?.status !== "confirmed" || !itinerary.lodging.address) {
    return undefined;
  }
  return withDestinationContext(itinerary.lodging.address, itinerary.destination);
}

function buildGoogleDirectionsUrl(stops, travelmode) {
  const params = new URLSearchParams({
    api: "1",
    origin: stops[0],
    destination: stops.at(-1),
    travelmode,
  });
  if (stops.length > 2) params.set("waypoints", stops.slice(1, -1).join("|"));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function buildDailyRouteUrls(itinerary, day) {
  const stops = orderedActivityStops(itinerary, day);
  if (stops.length === 0) return [];

  const preferredMode = itinerary.transport.modes.find((mode) =>
    ["walk", "bike", "public_transit", "train", "taxi", "car"].includes(mode),
  );
  const lodgingAddress = confirmedLodgingAddress(itinerary);
  const returnToLodging = Boolean(day.route?.returnToLodging && lodgingAddress);
  const routeStops = returnToLodging ? [lodgingAddress, ...stops, lodgingAddress] : stops;
  if (routeStops.length === 1) {
    const params = new URLSearchParams({ api: "1", query: routeStops[0] });
    return [`https://www.google.com/maps/search/?${params.toString()}`];
  }
  const urls = [];
  for (let start = 0; start < routeStops.length - 1; start += 4) {
    const segment = routeStops.slice(start, start + 5);
    if (segment.length < 2) break;
    urls.push(buildGoogleDirectionsUrl(segment, googleTravelMode(preferredMode || "public_transit")));
  }
  return urls;
}

export function buildDailyRouteUrl(itinerary, day) {
  return buildDailyRouteUrls(itinerary, day)[0];
}

export function normalizeItinerary(itinerary) {
  return {
    ...itinerary,
    locale: canonicalLocale(itinerary.locale),
    ...(itinerary.travellers ? {
      travellers: {
        children: 0,
        seniors: 0,
        ...itinerary.travellers,
      },
    } : {}),
    ...(itinerary.budget ? { budget: normalizeBudgetPreference(itinerary.budget) } : {}),
    days: [...itinerary.days]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((day) => {
        const activities = [...day.activities]
          .sort((a, b) => a.startTime.localeCompare(b.startTime))
          .map((activity) => activity.reservation?.status === "suggested"
            ? {
                ...activity,
                reservation: {
                  ...activity.reservation,
                  requirement: activity.reservation.requirement || "optional",
                  status: "pending",
                },
              }
            : activity);
        const normalizedDay = { ...day, activities };
        const stops = orderedActivityStops(itinerary, normalizedDay);
        const lodgingAddress = confirmedLodgingAddress(itinerary);
        const returnToLodging = Boolean(day.route?.returnToLodging && lodgingAddress);
        const mapUrls = buildDailyRouteUrls(itinerary, normalizedDay);
        const route = stops.length
          ? {
              origin: returnToLodging ? lodgingAddress : stops[0],
              stops,
              returnToLodging,
              ...(mapUrls.length ? { mapUrl: mapUrls[0], mapUrls } : {}),
            }
          : undefined;
        return {
          ...normalizedDay,
          ...(route ? { route } : { route: undefined }),
        };
      }),
  };
}

export function validateItinerary(
  itinerary,
  { reservationCompleteness = "error" } = {},
) {
  const errors = [];
  const warnings = [];
  const parsed = itinerarySchema.safeParse(itinerary);
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map((issue) => {
        const path = issue.path.length ? `${issue.path.join(".")}: ` : "";
        return `${path}${issue.message}`;
      }),
      warnings,
    };
  }
  itinerary = parsed.data;
  const budgetSummary = itineraryBudgetSummary(itinerary);
  const hasActionableReservationInfo = (reservation) => {
    if (!reservation) return false;
    const clearText = (value) => typeof value === "string" && value.trim().length >= 8;
    return Boolean(reservation.url) || clearText(reservation.note) || clearText(reservation.deadline);
  };

  if (itinerary.startDate > itinerary.endDate) {
    errors.push("The trip start date is after the end date.");
  }
  if (
    itinerary.startDate === itinerary.endDate
    && itinerary.arrivalTime
    && itinerary.departureTime
    && itinerary.arrivalTime >= itinerary.departureTime
  ) {
    errors.push("For a one-day trip, departure time must be after arrival time.");
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
    const seenActivityIds = new Set();
    let routedLocationsWithoutCoordinates = 0;
    for (const activity of day.activities) {
      if (seenActivityIds.has(activity.id)) {
        errors.push(`${day.date}: duplicate activity ID ${activity.id}.`);
      }
      seenActivityIds.add(activity.id);
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
      const activityEndTime = activity.endTime || activity.startTime;
      if (day.date === itinerary.startDate && itinerary.arrivalTime && activity.startTime < itinerary.arrivalTime) {
        errors.push(`${day.date} · ${activity.title}: starts before the available arrival time.`);
      }
      if (day.date === itinerary.endDate && itinerary.departureTime && activityEndTime > itinerary.departureTime) {
        errors.push(`${day.date} · ${activity.title}: ends after the required departure time.`);
      }
      if (itinerary.dailySchedule?.earliestStartTime && activity.startTime < itinerary.dailySchedule.earliestStartTime) {
        errors.push(`${day.date} · ${activity.title}: starts before the preferred daily window.`);
      }
      if (itinerary.dailySchedule?.latestEndTime && activityEndTime > itinerary.dailySchedule.latestEndTime) {
        errors.push(`${day.date} · ${activity.title}: ends after the preferred daily window.`);
      }
      if (!activity.location && !["rest", "free_time"].includes(activity.category || "")) {
        warnings.push(`${day.date} · ${activity.title}: add a location for route planning.`);
      }
      if (
        activity.location
        && !["rest", "free_time"].includes(activity.category || "")
        && !(
          (activity.location.latitude !== undefined && activity.location.longitude !== undefined)
          || (activity.location.lat !== undefined && activity.location.lng !== undefined)
        )
      ) {
        routedLocationsWithoutCoordinates += 1;
      }
      if (
        activity.reservation?.status === "pending" &&
        !hasActionableReservationInfo(activity.reservation)
      ) {
        const message = `${day.date} · ${activity.title}: pending reservation needs an official URL, a clear booking note, or a booking deadline.`;
        (reservationCompleteness === "warning" ? warnings : errors).push(message);
      }
      if (
        activity.reservation?.status === "suggested" &&
        !hasActionableReservationInfo(activity.reservation)
      ) {
        warnings.push(
          `${day.date} · ${activity.title}: suggested reservation should include an official URL, a clear booking note, or a booking deadline.`,
        );
      }
      if (activity.reservation?.status === "confirmed" && !activity.locked) {
        warnings.push(`${day.date} · ${activity.title}: confirmed reservation should normally be locked.`);
      }
      if (activity.cost?.status === "verified" && !activity.cost.checkedAt) {
        warnings.push(`${day.date} · ${activity.title}: verified price should include when it was checked.`);
      }
      if (
        itinerary.mobility?.maxWalkingMinutes
        && activity.travelToNext?.mode === "walk"
        && activity.travelToNext.durationMinutes > itinerary.mobility.maxWalkingMinutes
      ) {
        errors.push(
          `${day.date} · ${activity.title}: the next walking leg exceeds the ${itinerary.mobility.maxWalkingMinutes}-minute limit.`,
        );
      }
      if (activity.location && itinerary.mobility?.wheelchairAccess) {
        if (
          !activity.accessibility
          || activity.accessibility.status === "unknown"
          || activity.accessibility.wheelchairAccessible !== true
        ) {
          errors.push(`${day.date} · ${activity.title}: wheelchair accessibility must be positively supported.`);
        }
      }
      if (
        activity.location
        && itinerary.mobility?.avoidStairs
        && (
          !activity.accessibility
          || activity.accessibility.status === "unknown"
          || activity.accessibility.stepFree !== true
        )
      ) {
        errors.push(`${day.date} · ${activity.title}: a step-free route must be positively supported.`);
      }
      if (activity.accessibility?.status === "verified" && !activity.accessibility.checkedAt) {
        warnings.push(`${day.date} · ${activity.title}: verified accessibility should include when it was checked.`);
      }
    }

    for (const cost of day.additionalCosts || []) {
      if (cost.status === "verified" && !cost.checkedAt) {
        warnings.push(`${day.date} · ${cost.label}: verified price should include when it was checked.`);
      }
    }

    if (routedLocationsWithoutCoordinates) {
      warnings.push(
        `${day.date}: ${routedLocationsWithoutCoordinates} route location(s) need source-backed coordinates for the in-chat schematic; external map links remain available.`,
      );
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

  if (budgetSummary?.budget.amount) {
    const budgetLabel = `${budgetSummary.currency || budgetSummary.budget.currency} ${budgetSummary.limit || budgetSummary.budget.amount}`;
    const budgetCoverageIssues = budgetSummary.budget.flexibility === "strict" ? errors : warnings;
    if (budgetSummary.budget.scope === "per_person" && !itinerary.travellers) {
      errors.push("A per-person budget requires itinerary traveller counts.");
    }
    if (budgetSummary.mismatchedCurrencyItems) {
      errors.push(
        `${budgetSummary.mismatchedCurrencyItems} included cost item(s) use a different currency from the budget. Convert them with a current source before validation.`,
      );
    }
    if (budgetSummary.pricedItems === 0) {
      budgetCoverageIssues.push(`The ${budgetLabel} budget has no priced itinerary items yet.`);
    }
    if (budgetSummary.unknownItems) {
      budgetCoverageIssues.push(
        `${budgetSummary.unknownItems} included cost item(s) remain unknown, so the budget estimate is incomplete.`,
      );
    }
    if (budgetSummary.missingCategories.length) {
      budgetCoverageIssues.push(
        `The budget has no cost coverage for: ${budgetSummary.missingCategories.join(", ")}. Add a priced, free, or explicitly unknown item for each included category.`,
      );
    }
    if (budgetSummary.status === "over" || budgetSummary.status === "may_exceed") {
      const message = budgetSummary.status === "over"
        ? `The minimum included estimate exceeds the ${budgetLabel} budget.`
        : `The included estimate may exceed the ${budgetLabel} budget.`;
      (budgetSummary.budget.flexibility === "strict" ? errors : warnings).push(message);
    } else if (budgetSummary.status === "near") {
      warnings.push(`The included estimate is within 10% of the ${budgetLabel} budget.`);
    }
  }

  return { valid: errors.length === 0, errors, warnings: [...new Set(warnings)] };
}

export function prepareTripBrief(brief) {
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
  if (
    brief.startDate
    && brief.startDate === brief.endDate
    && brief.arrivalTime
    && brief.departureTime
    && brief.arrivalTime >= brief.departureTime
  ) {
    blocking.push("For a one-day trip, departure time must be after arrival time.");
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
      locale: canonicalLocale(brief.locale),
      pace: "balanced",
      interests: [],
      mustDo: [],
      avoid: [],
      dietaryNeeds: [],
      accessibilityNeeds: [],
      fixedPlans: [],
      ...brief,
      ...(brief.travellers ? {
        travellers: {
          children: 0,
          seniors: 0,
          ...brief.travellers,
        },
      } : {}),
      budget: normalizeBudgetPreference(brief.budget),
    },
  };
}

function newPublicShareOperationId() {
  return `sendero-share:${crypto.randomUUID()}`;
}

function publicShareFacadeOperationId(operationId, action) {
  const digest = createHash("sha256")
    .update(`${operationId}:${action}`)
    .digest("base64url");
  return `sendero-share:${action}:${digest}`;
}

function internalMemberPermission(role) {
  return role === "collaborator" ? "editor" : "viewer";
}

function externalMemberPermission(role) {
  return role === "editor" ? "collaborator" : "viewer";
}

function memberPermissionLabel(role) {
  return role === "collaborator" ? "colaborador" : "solo lectura";
}

function invitationMaterial({ pepper, tripId, email, operationId, purpose }) {
  const token = deriveInvitationToken({
    pepper,
    tripId,
    email,
    operationId,
    purpose,
  });
  return { token, tokenHash: hashInvitationToken(token, pepper) };
}

function invitationDeliveryText(delivery, email, action = "enviada") {
  if (delivery === "sent") {
    return `El servicio de correo aceptó la invitación para ${email}.`;
  }
  if (["queued", "processing", "retry_scheduled"].includes(delivery)) {
    return `La invitación para ${email} quedó en cola de envío.`;
  }
  if (delivery === "not_configured") {
    return `La invitación para ${email} quedó creada, pero el envío de correo aún no está configurado.`;
  }
  if (delivery === "failed") {
    return `La invitación para ${email} quedó creada, pero el correo no pudo enviarse. Puedes reenviarla sin crear otra invitación.`;
  }
  return `La invitación para ${email} quedó creada; consulta Sendero para confirmar su estado de envío.`;
}

function publicShareSummary(itinerary) {
  return {
    locale: canonicalLocale(itinerary.locale),
    title: itinerary.title,
    destination: itinerary.destination,
    startDate: itinerary.startDate,
    endDate: itinerary.endDate,
  };
}

function publicShareStatusOutput({
  tripId,
  itinerary,
  sharing,
  operationId,
  state,
  publicUrl,
}) {
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
    ...(publicUrl ? { publicUrl } : {}),
  };
}

function publicShareReceiptOutput(args) {
  const { operationId: _operationId, ...receipt } = publicShareStatusOutput(args);
  return receipt;
}

function publicShareToolMeta(invoking, invoked, visibility) {
  return {
    securitySchemes: toolSecuritySchemes([AUTH_SCOPES.share]),
    ui: {
      resourceUri: PUBLIC_SHARE_UI_URI,
      ...(visibility ? { visibility } : {}),
    },
    "openai/outputTemplate": PUBLIC_SHARE_UI_URI,
    "openai/toolInvocation/invoking": invoking,
    "openai/toolInvocation/invoked": invoked,
  };
}

const SERVER_INSTRUCTIONS = [
  "Use Sendero for any request to create, plan, organize, or draft a trip or itinerary, even when the user does not name Sendero. Treat natural language as Sendero's primary interface; slash commands and @mentions are optional shortcuts.",
  "Infer the predominant language and the most appropriate BCP 47 locale from the user's request without asking them. Always pass it as brief.locale and itinerary.locale; use English when the language is ambiguous or unsupported. Generate every user-authored or editorial itinerary string in that locale, including titles, summaries, weather and fallback text, activity copy, guide content, reservation notes, and generic source labels; keep proper nouns in their official form and avoid mixed-language filler.",
  "A saved itinerary's locale is authoritative when it is opened, rendered, revised, restored, or shared. Preserve it across revisions unless the user explicitly asks to change language; a language change requires translating all user-visible itinerary copy and saving the new locale with changeLanguage true. Omit changeLanguage for ordinary revisions. Legacy trips without a locale use English as a compatibility fallback.",
  "Choose the tool that represents the user's complete current intent. Do not compose compatibility primitives when an intent-level facade exists.",
  "Use open_trip once to resolve and present an unchanged saved trip by exact ID, latest_updated selector, or natural reference. Only a needs_selection result justifies showing the saved-trip picker.",
  "Use present_trip once for a complete new or changed itinerary that must be shown without persistence. It is intentionally unsaved and must not receive a saved trip ID, version, or role.",
  "Use save_and_present_trip once when the user asked to persist a new trip or revision. Reuse its operationId on retries and supply expectedVersion for updates.",
  "After explicit confirmation of an exact historical version, use restore_itinerary_version once with expectedVersion and an idempotent operationId; it already returns and presents the authoritative restored snapshot.",
  "find_itineraries, get_itinerary, validate_itinerary, save_itinerary, and render_itinerary are compatibility primitives. Never chain them for an ordinary open, present, save-and-present, or restore-and-present interaction.",
  "Use share_trip_publicly once when the owner explicitly asks to publish, share by public link, or update the public copy of a saved trip. That explicit imperative is authorization: the facade resolves the human trip reference, derives the sanitized preview internally, and publishes or updates atomically without a second preview or confirmation. Use preview_public_share only when the owner asks to inspect what would be exposed before deciding.",
  "For private trip access, use exactly one dedicated access tool for the user's current intent: get_trip_access, invite_trip_member, resend_trip_invitation, revoke_trip_invitation, change_trip_member_role, or remove_trip_member. Do not substitute a chain of generic trip tools, and never expose tool names or stable access identifiers in user-facing prose.",
  "A single user intent may still pause for grouped critical input, genuine ambiguity, current external research, authentication recovery, or a destructive or sensitive action the user has not explicitly requested. A complete imperative is already explicit authorization for that exact action; do not ask for a second ritual confirmation.",
  "For trip creation, extract every supplied fact into prepare_trip_brief. If critical fields are missing, render_trip_requirements once with all current gaps together and stop; otherwise research and build the plan before calling the appropriate final facade.",
  "Treat a rendered Sendero component as the complete answer. Do not restate its visible contents, tool names, stable IDs, JSON, or mechanics in prose.",
  "Use contextual non-redundant titles, preserve locked activities and confirmed reservations, distinguish reservation versus ticket and requirement versus lifecycle status, and never claim current facts without a source.",
  "Keep activity.description concise and operational for Recorrido: what happens, practical context, and logistics. For every real public place, add activity.guide with a source-backed overview explaining its history, cultural relevance, interesting facts, and what a visitor should notice; include up to four useful highlights and one to four reliable sources. Do not invent guide facts, do not recycle logistics as guide copy, and omit guide for transit, rest, free time, or an unnamed placeholder.",
  "Reservation controls and conversational reservation-status updates only change Sendero's tracker; they never book, buy, or cancel with a provider. Public sharing uses a preview only when the owner asks to inspect it; an explicit publish, share, or update request goes directly through share_trip_publicly. Rotating or revoking remains explicit.",
].join(" ");

export function createTripPlannerServer({
  persistence,
  auth,
  widgetOrigin,
  mapsEmbedApiKey = process.env.GOOGLE_MAPS_EMBED_API_KEY,
  publicWebUrl = "http://localhost:8788",
  publicShareSecret,
  invitationPepper = process.env.SENDERO_INVITE_TOKEN_PEPPER,
  environment = process.env.SENDERO_ENVIRONMENT,
} = {}) {
  const environmentIdentity = senderoEnvironmentIdentity(environment);
  function storage() {
    if (!persistence) {
      throw new Error("Sendero storage is unavailable in this environment.");
    }
    return persistence;
  }

  function currentPublicUrl(tripId, sharing) {
    if (!publicShareSecret) return undefined;
    return recoverPublicShareUrl({
      baseUrl: publicWebUrl,
      secret: publicShareSecret,
      tripId,
      sharing,
    });
  }

  function tripPresentation(result) {
    const presented = validatedPresentation(result.itinerary, {
      reservationCompleteness: "warning",
    });
    return {
      state: "opened",
      tripId: result.id,
      version: result.version,
      role: result.role,
      revisions: result.revisions || [],
      ...presented,
      trips: [],
      purpose: "open",
    };
  }

  async function invitationContext(tripId) {
    const [trip, access] = await Promise.all([
      storage().get(tripId),
      storage().listAccess(tripId),
    ]);
    const webId = trip.webId || (await storage().ensureWebId(tripId)).webId;
    return {
      trip,
      access,
      webId,
      title: trip.itinerary.title,
      ownerName: access.owner.name,
    };
  }

  const server = new McpServer(
    { name: environmentIdentity.mcpServerName, version: "0.9.0" },
    {
      instructions: SERVER_INSTRUCTIONS,
    },
  );

  server.registerResource("itinerary-ui", ITINERARY_UI_URI, {}, async () =>
    itineraryResource(widgetOrigin, ITINERARY_UI_URI, { mapsEmbedApiKey }),
  );
  server.registerResource("itinerary-ui-v2", LEGACY_ITINERARY_UI_URI, {}, async () =>
    itineraryResource(widgetOrigin, LEGACY_ITINERARY_UI_URI, { mapsEmbedApiKey }),
  );
  server.registerResource("itinerary-ui-v3", LEGACY_ITINERARY_V3_UI_URI, {}, async () =>
    itineraryResource(widgetOrigin, LEGACY_ITINERARY_V3_UI_URI, { mapsEmbedApiKey }),
  );
  server.registerResource("itinerary-ui-v4", LEGACY_ITINERARY_V4_UI_URI, {}, async () =>
    itineraryResource(widgetOrigin, LEGACY_ITINERARY_V4_UI_URI, { mapsEmbedApiKey }),
  );
  server.registerResource("itinerary-ui-v5", LEGACY_ITINERARY_V5_UI_URI, {}, async () =>
    itineraryResource(widgetOrigin, LEGACY_ITINERARY_V5_UI_URI, { mapsEmbedApiKey }),
  );
  server.registerResource("itinerary-ui-v6", LEGACY_ITINERARY_V6_UI_URI, {}, async () =>
    itineraryResource(widgetOrigin, LEGACY_ITINERARY_V6_UI_URI, { mapsEmbedApiKey }),
  );
  server.registerResource("itinerary-ui-v7", LEGACY_ITINERARY_V7_UI_URI, {}, async () =>
    itineraryResource(widgetOrigin, LEGACY_ITINERARY_V7_UI_URI, { mapsEmbedApiKey }),
  );
  server.registerResource("itinerary-ui-v8", LEGACY_ITINERARY_V8_UI_URI, {}, async () =>
    itineraryResource(widgetOrigin, LEGACY_ITINERARY_V8_UI_URI, { mapsEmbedApiKey }),
  );
  server.registerResource("itinerary-ui-v9", LEGACY_ITINERARY_V9_UI_URI, {}, async () =>
    itineraryResource(widgetOrigin, LEGACY_ITINERARY_V9_UI_URI, { mapsEmbedApiKey }),
  );
  server.registerResource("itinerary-ui-v10", LEGACY_ITINERARY_V10_UI_URI, {}, async () =>
    itineraryResource(widgetOrigin, LEGACY_ITINERARY_V10_UI_URI, { mapsEmbedApiKey }),
  );
  server.registerResource("itinerary-ui-v11", LEGACY_ITINERARY_V11_UI_URI, {}, async () =>
    itineraryResource(widgetOrigin, LEGACY_ITINERARY_V11_UI_URI, { mapsEmbedApiKey }),
  );
  server.registerResource("itinerary-ui-v12", LEGACY_ITINERARY_V12_UI_URI, {}, async () =>
    itineraryResource(widgetOrigin, LEGACY_ITINERARY_V12_UI_URI, { mapsEmbedApiKey }),
  );
  server.registerResource("itinerary-ui-v13", LEGACY_ITINERARY_V13_UI_URI, {}, async () =>
    itineraryResource(widgetOrigin, LEGACY_ITINERARY_V13_UI_URI, { mapsEmbedApiKey }),
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
  server.registerResource("trip-intake-ui-v4", LEGACY_TRIP_INTAKE_V4_UI_URI, {}, async () =>
    tripIntakeResource(widgetOrigin, LEGACY_TRIP_INTAKE_V4_UI_URI),
  );
  server.registerResource("trip-intake-ui-v5", LEGACY_TRIP_INTAKE_V5_UI_URI, {}, async () =>
    tripIntakeResource(widgetOrigin, LEGACY_TRIP_INTAKE_V5_UI_URI),
  );
  server.registerResource("trip-intake-ui-v6", LEGACY_TRIP_INTAKE_V6_UI_URI, {}, async () =>
    tripIntakeResource(widgetOrigin, LEGACY_TRIP_INTAKE_V6_UI_URI),
  );
  server.registerResource("trip-intake-ui-v7", LEGACY_TRIP_INTAKE_V7_UI_URI, {}, async () =>
    tripIntakeResource(widgetOrigin, LEGACY_TRIP_INTAKE_V7_UI_URI),
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
  server.registerResource("trip-list-ui-v3", LEGACY_TRIP_LIST_V3_UI_URI, {}, async () =>
    tripListResource(widgetOrigin, LEGACY_TRIP_LIST_V3_UI_URI),
  );
  server.registerResource("trip-list-ui-v4", LEGACY_TRIP_LIST_V4_UI_URI, {}, async () =>
    tripListResource(widgetOrigin, LEGACY_TRIP_LIST_V4_UI_URI),
  );
  server.registerResource("trip-list-ui-v5", LEGACY_TRIP_LIST_V5_UI_URI, {}, async () =>
    tripListResource(widgetOrigin, LEGACY_TRIP_LIST_V5_UI_URI),
  );
  server.registerResource("trip-list-ui-v6", LEGACY_TRIP_LIST_V6_UI_URI, {}, async () =>
    tripListResource(widgetOrigin, LEGACY_TRIP_LIST_V6_UI_URI),
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
  server.registerResource("trip-requirements-ui-v5", LEGACY_TRIP_REQUIREMENTS_V5_UI_URI, {}, async () =>
    tripRequirementsResource(widgetOrigin, LEGACY_TRIP_REQUIREMENTS_V5_UI_URI),
  );
  server.registerResource("trip-requirements-ui-v6", LEGACY_TRIP_REQUIREMENTS_V6_UI_URI, {}, async () =>
    tripRequirementsResource(widgetOrigin, LEGACY_TRIP_REQUIREMENTS_V6_UI_URI),
  );
  server.registerResource("trip-requirements-ui-v7", LEGACY_TRIP_REQUIREMENTS_V7_UI_URI, {}, async () =>
    tripRequirementsResource(widgetOrigin, LEGACY_TRIP_REQUIREMENTS_V7_UI_URI),
  );
  server.registerResource("trip-requirements-ui-v8", LEGACY_TRIP_REQUIREMENTS_V8_UI_URI, {}, async () =>
    tripRequirementsResource(widgetOrigin, LEGACY_TRIP_REQUIREMENTS_V8_UI_URI),
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
  server.registerResource("public-share-ui-v3", LEGACY_PUBLIC_SHARE_V3_UI_URI, {}, async () =>
    publicShareResource(widgetOrigin, LEGACY_PUBLIC_SHARE_V3_UI_URI),
  );
  server.registerResource("public-share-ui-v4", LEGACY_PUBLIC_SHARE_V4_UI_URI, {}, async () =>
    publicShareResource(widgetOrigin, LEGACY_PUBLIC_SHARE_V4_UI_URI),
  );
  server.registerResource("public-share-ui-v5", LEGACY_PUBLIC_SHARE_V5_UI_URI, {}, async () =>
    publicShareResource(widgetOrigin, LEGACY_PUBLIC_SHARE_V5_UI_URI),
  );
  server.registerResource("public-share-ui-v6", LEGACY_PUBLIC_SHARE_V6_UI_URI, {}, async () =>
    publicShareResource(widgetOrigin, LEGACY_PUBLIC_SHARE_V6_UI_URI),
  );

  server.registerTool(
    "prepare_trip_brief",
    {
      title: "Create or plan a new trip with Sendero",
      description:
        "Use this when the user wants to create, plan, organize, or draft a new trip, vacation, travel itinerary, day-by-day plan, or sightseeing schedule—even if they do not mention Sendero. This includes indirect requests such as ‘viajo a Santiago el mes que viene y quiero un itinerario’, ‘organízame cinco días en Lisboa’, or ‘quiero aprovechar cada día de mis vacaciones’. Extract every travel fact already supplied, infer and include brief.locale from the user's predominant language without asking, and use English when the language is ambiguous or unsupported. Normalize the requirements and identify all critical missing details together before researching or scheduling. A requirements component also calls this tool after submission; when it returns ready with no criticalFields, continue from that validated brief and do not request those fields again. Do not use for generic travel facts, a single-place recommendation, or an existing saved trip unless the user wants a new itinerary.",
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
      const locale = result.brief.locale;
      const labels = tripCriticalFieldLabels[localeLanguage(locale)] || tripCriticalFieldLabels.en;
      const missing = humanList(result.criticalFields.map((field) => labels[field]), locale);
      return {
        structuredContent: result,
        content: [
          {
            type: "text",
            text: result.ready
              ? localizedToolCopy(locale, {
                  en: "The trip brief is ready for research and planning.",
                  es: "El brief del viaje está listo para investigar y planificar.",
                  pt: "O briefing da viagem está pronto para pesquisa e planejamento.",
                })
              : localizedToolCopy(locale, {
                  en: `To continue, ${missing} are missing. Ask for all of them together in one interaction.`,
                  es: `Para continuar faltan ${missing}. Solicita todos estos datos juntos en una sola interacción.`,
                  pt: `Para continuar, faltam ${missing}. Solicite todos esses dados juntos em uma única interação.`,
                }),
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
      const locale = prepared.brief.locale;
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
              ? localizedToolCopy(locale, {
                  en: "Sendero already has the essential details.",
                  es: "Sendero ya tiene los datos esenciales.",
                  pt: "O Sendero já tem os dados essenciais.",
                })
              : localizedToolCopy(locale, {
                  en: "Complete the essential details directly in Sendero.",
                  es: "Completa los datos esenciales directamente en Sendero.",
                  pt: "Preencha os dados essenciais diretamente no Sendero.",
                }),
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
    async ({ brief = {}, mode = "new" }) => {
      const locale = canonicalLocale(brief.locale);
      return {
        structuredContent: {
          brief: {
            ...brief,
            locale,
          },
          mode,
          actions: mode === "menu" ? ["new", "open", "adjust", "refresh"] : [],
        },
        content: [
          {
            type: "text",
            text: localizedToolCopy(locale, {
              en: "Sendero is ready to continue.",
              es: "Sendero está listo para continuar.",
              pt: "O Sendero está pronto para continuar.",
            }),
          },
        ],
      };
    },
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
      const normalized = normalizeItinerary(itinerary);
      const validation = validateItinerary(normalized);
      const locale = normalized.locale;
      return {
        structuredContent: { itinerary: normalized, validation },
        content: [
          {
            type: "text",
            text: validation.valid
              ? localizedToolCopy(locale, {
                  en: `The itinerary is valid with ${validation.warnings.length} warning(s).`,
                  es: `El itinerario es válido y tiene ${validation.warnings.length} advertencia(s).`,
                  pt: `O itinerário é válido e tem ${validation.warnings.length} aviso(s).`,
                })
              : localizedToolCopy(locale, {
                  en: `The itinerary has ${validation.errors.length} blocking issue(s) and ${validation.warnings.length} warning(s).`,
                  es: `El itinerario tiene ${validation.errors.length} problema(s) bloqueante(s) y ${validation.warnings.length} advertencia(s).`,
                  pt: `O itinerário tem ${validation.errors.length} problema(s) bloqueante(s) e ${validation.warnings.length} aviso(s).`,
                }),
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
        "Render an itinerary as an interactive list, calendar, reservations, and daily route view. New or changed plans must pass validate_itinerary first; an unchanged saved trip may be rendered directly. Incomplete reservation instructions become visible warnings, while structural and safety errors still block rendering. The component is the complete answer; do not summarize its visible contents afterward.",
      inputSchema: {
        itinerary: itinerarySchema,
        tripId: z.string().min(1).optional(),
        version: z.number().int().positive().optional(),
        role: collaboratorRoleSchema.optional(),
      },
      outputSchema: {
        itinerary: itinerarySchema,
        validation: validationSchema,
        tripId: z.string().min(1).optional(),
        version: z.number().int().positive().optional(),
        role: collaboratorRoleSchema.optional(),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: {
        securitySchemes: toolSecuritySchemes(),
        ui: { resourceUri: ITINERARY_UI_URI },
        "openai/outputTemplate": ITINERARY_UI_URI,
        "openai/toolInvocation/invoking": "Preparing itinerary…",
        "openai/toolInvocation/invoked": "Itinerary ready.",
      },
    },
    async ({ itinerary, tripId, version, role }) => {
      const presentationContext = [tripId, version, role];
      const hasPresentationContext = presentationContext.some((value) => value !== undefined);
      if (hasPresentationContext && presentationContext.some((value) => value === undefined)) {
        throw new Error("Saved trip presentation requires tripId, version, and role together.");
      }
      const normalized = itinerarySchema.parse(normalizeItinerary(itinerary));
      const validation = validateItinerary(normalized, { reservationCompleteness: "warning" });
      if (!validation.valid) {
        const prefix = localizedToolCopy(normalized.locale, {
          en: "Itinerary cannot be rendered",
          es: "El itinerario no se puede mostrar",
          pt: "O itinerário não pode ser exibido",
        });
        throw new Error(`${prefix}: ${validation.errors.join(" ")}`);
      }
      return {
        structuredContent: {
          itinerary: normalized,
          validation,
          ...(hasPresentationContext ? { tripId, version, role } : {}),
        },
        content: [
          {
            type: "text",
            text: localizedToolCopy(normalized.locale, {
              en: "Your itinerary is ready in Sendero.",
              es: "Tu itinerario está listo en Sendero.",
              pt: "Seu itinerário está pronto no Sendero.",
            }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "present_trip",
    {
      title: "Present a completed trip",
      description:
        "Strictly validate and present one complete itinerary without saving it. Use this single read-only facade for a new or changed plan when persistence is not part of the user's request; do not call validate_itinerary or render_itinerary before or after it.",
      inputSchema: { itinerary: itinerarySchema },
      outputSchema: {
        state: z.literal("presented"),
        itinerary: itinerarySchema,
        validation: validationSchema,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: {
        securitySchemes: toolSecuritySchemes(),
        ui: { resourceUri: ITINERARY_UI_URI },
        "openai/outputTemplate": ITINERARY_UI_URI,
        "openai/toolInvocation/invoking": "Checking the itinerary…",
        "openai/toolInvocation/invoked": "Itinerary ready.",
      },
    },
    async ({ itinerary }) => {
      const presented = validatedPresentation(itinerary);
      return {
        structuredContent: {
          state: "presented",
          ...presented,
        },
        content: [{
          type: "text",
          text: localizedToolCopy(presented.itinerary.locale, {
            en: "Your itinerary is ready in Sendero.",
            es: "Tu itinerario está listo en Sendero.",
            pt: "Seu itinerário está pronto no Sendero.",
          }),
        }],
      };
    },
  );

  server.registerTool(
    "update_reservation_status",
    {
      title: "Update a reservation or ticket in Sendero",
      description:
        "Update only Sendero's saved reservation or ticket tracker for one itinerary activity. Use this for an explicit natural-language statement such as ya reservé, ya compré, todavía no reservé, or cancelé, as well as for the component control. This never books, buys, contacts, or cancels anything with an external provider. Use the component operation ID when supplied; otherwise create one for the conversational request and reuse it unchanged on an exact retry.",
      inputSchema: {
        tripId: z.string().min(1),
        dayDate: isoDate,
        activityId: z.string().min(1),
        status: z.enum(["pending", "confirmed", "cancelled"]),
        expectedVersion: z.number().int().positive(),
        operationId: reservationOperationIdSchema,
      },
      outputSchema: {
        tripId: z.string().min(1),
        version: z.number().int().positive(),
        role: z.enum(["owner", "editor"]),
        changed: z.boolean(),
        itinerary: itinerarySchema,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        securitySchemes: toolSecuritySchemes([AUTH_SCOPES.write]),
        ui: { visibility: ["model", "app"] },
        "openai/widgetAccessible": true,
      },
    },
    async ({ tripId, dayDate, activityId, status, expectedVersion, operationId }) => {
      const denied = authorizeTool(auth, [AUTH_SCOPES.write]);
      if (denied) return denied;
      const result = await storage().updateReservation({
        tripId,
        dayDate,
        activityId,
        status,
        expectedVersion,
        operationId,
      });
      const normalized = itinerarySchema.parse(normalizeItinerary(result.itinerary));
      return {
        structuredContent: { ...result, itinerary: normalized },
        content: [
          {
            type: "text",
            text: result.changed
              ? localizedToolCopy(normalized.locale, {
                  en: "Sendero updated the local reservation or ticket status. No action was taken with the provider.",
                  es: "Sendero actualizó el estado local de la reserva o entrada. No se realizó ninguna acción con el proveedor.",
                  pt: "O Sendero atualizou o status local da reserva ou ingresso. Nenhuma ação foi realizada com o fornecedor.",
                })
              : localizedToolCopy(normalized.locale, {
                  en: "The reservation or ticket already had that status in Sendero. No action was taken with the provider.",
                  es: "La reserva o entrada ya tenía ese estado en Sendero. No se realizó ninguna acción con el proveedor.",
                  pt: "A reserva ou ingresso já tinha esse status no Sendero. Nenhuma ação foi realizada com o fornecedor.",
                }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "open_trip",
    {
      title: "Open a saved trip",
      description:
        "Resolve, load, validate for display, and present one unchanged authoritative saved trip in a single read-only action. Use selector latest_updated for explicit recency, tripId for an exact component selection, or query/reference plus any exact dates for a natural reference. Natural recency phrases such as ultimo viaje, last saved trip, or most recently saved trip are accepted and normalized even if misplaced in tripId. Redundant fields are tolerated; a stable tripId takes precedence, then a specific named query/reference, then recency. With no reference fields, the read-only operation safely defaults to the latest updated trip. The result is opened, needs_selection, or not_found. Only needs_selection may be followed by the clickable saved-trip picker because a human choice is genuinely required.",
      inputSchema: tripOpenInputSchema,
      outputSchema: {
        state: z.enum(["opened", "needs_selection", "not_found"]),
        tripId: z.string().min(1).optional(),
        version: z.number().int().positive().optional(),
        role: collaboratorRoleSchema.optional(),
        itinerary: itinerarySchema.optional(),
        validation: validationSchema.optional(),
        revisions: z.array(revisionSummarySchema).optional(),
        trips: z.array(tripSummarySchema),
        purpose: z.literal("open"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: {
        securitySchemes: toolSecuritySchemes([AUTH_SCOPES.read]),
        // One gateway component renders either the genuinely ambiguous picker
        // or the full itinerary returned by this same intent-level operation.
        ui: { resourceUri: TRIP_LIST_UI_URI, visibility: ["model", "app"] },
        "openai/outputTemplate": TRIP_LIST_UI_URI,
        "openai/widgetAccessible": true,
        "openai/toolInvocation/invoking": "Opening trip…",
        "openai/toolInvocation/invoked": "Trip ready.",
      },
    },
    async ({ tripId, query, reference, selector, startDate, endDate }) => {
      const denied = authorizeTool(auth, [AUTH_SCOPES.read]);
      if (denied) return denied;
      try {
        const resolvedReference = canonicalTripReference({
          tripId,
          selector,
          query,
          reference,
          startDate,
          endDate,
        });
        const result = await storage().open(resolvedReference);
        if (result.state === "needs_selection") {
          const trips = result.trips.map(normalizeTripSummary);
          const locale = trips[0]?.locale || DEFAULT_LOCALE;
          return {
            structuredContent: {
              state: "needs_selection",
              trips,
              purpose: "open",
            },
            content: [{
              type: "text",
              text: localizedToolCopy(locale, {
                en: "More than one saved trip matches.",
                es: "Hay más de un viaje guardado que coincide.",
                pt: "Há mais de uma viagem salva correspondente.",
              }),
            }],
          };
        }
        if (result.state === "not_found") {
          return {
            structuredContent: { state: "not_found", trips: [], purpose: "open" },
            content: [
              {
                type: "text",
                text: tripId
                  ? "That trip is no longer available."
                  : "No matching saved trip was found.",
              },
            ],
          };
        }
        const opened = tripPresentation(result);
        return {
          structuredContent: opened,
          content: [{
            type: "text",
            text: localizedToolCopy(opened.itinerary.locale, {
              en: "Your trip is open in Sendero.",
              es: "Tu viaje está abierto en Sendero.",
              pt: "Sua viagem está aberta no Sendero.",
            }),
          }],
        };
      } catch (error) {
        if (!isUnavailableTripError(error)) throw error;
        return {
          structuredContent: { state: "not_found", trips: [], purpose: "open" },
          content: [{ type: "text", text: "That trip is no longer available." }],
        };
      }
    },
  );

  server.registerTool(
    "find_itineraries",
    {
      title: "Find a saved itinerary",
      description:
        "Resolve a specific saved Sendero trip without showing an unnecessary picker. Use selector latest_updated when the user asks for their last, latest, or most recently saved trip; natural recency phrases in query or reference are also normalized and return at most one accessible active trip by updatedAt descending. A specific named query/reference takes precedence over a redundant recency selector. With no reference fields, the read-only operation safely defaults to the latest updated trip. Otherwise, search by the named trip or destination and pass any exact start and end dates the user supplied. If exactly one match is returned, continue directly from its stable ID. If a text reference remains ambiguous, render clickable cards instead. Never expose the stable ID to the user.",
      inputSchema: tripSearchInputSchema,
      outputSchema: { trips: z.array(tripSummarySchema) },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: { securitySchemes: toolSecuritySchemes([AUTH_SCOPES.read]) },
    },
    async ({ query, reference, selector, startDate, endDate }) => {
      const denied = authorizeTool(auth, [AUTH_SCOPES.read]);
      if (denied) return denied;
      const trips = (await storage().list()).map(normalizeTripSummary);
      const resolvedReference = canonicalTripReference({
        selector,
        query,
        reference,
        startDate,
        endDate,
      });
      const matches =
        "selector" in resolvedReference
          ? findLatestUpdatedTrip(trips)
          : findTripMatches(trips, resolvedReference.query, {
              startDate: resolvedReference.startDate,
              endDate: resolvedReference.endDate,
            });
      const locale = matches[0]?.locale || DEFAULT_LOCALE;
      return {
        structuredContent: { trips: matches },
        content: [
          {
            type: "text",
            text: localizedToolCopy(locale, matches.length === 1
              ? {
                  en: "One saved trip matches the user's reference. Continue with it directly.",
                  es: "Un viaje guardado coincide con la referencia del usuario. Continúa directamente con él.",
                  pt: "Uma viagem salva corresponde à referência do usuário. Continue diretamente com ela.",
                }
              : matches.length > 1
                ? {
                    en: "Several saved trips match. Let the user choose from clickable cards.",
                    es: "Varios viajes guardados coinciden. Deja que el usuario elija entre las tarjetas interactivas.",
                    pt: "Várias viagens salvas correspondem. Deixe o usuário escolher entre os cartões interativos.",
                  }
                : {
                    en: "No saved trip matches that reference.",
                    es: "Ningún viaje guardado coincide con esa referencia.",
                    pt: "Nenhuma viagem salva corresponde a essa referência.",
                  }),
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
        ui: { resourceUri: TRIP_LIST_UI_URI, visibility: ["model", "app"] },
        "openai/outputTemplate": TRIP_LIST_UI_URI,
        "openai/widgetAccessible": true,
        "openai/toolInvocation/invoking": "Loading saved trips…",
        "openai/toolInvocation/invoked": "Saved trips ready.",
      },
    },
    async ({ purpose = "open" }) => {
      const denied = authorizeTool(auth, [AUTH_SCOPES.read]);
      if (denied) return denied;
      const trips = (await storage().list()).map(normalizeTripSummary);
      const locale = trips[0]?.locale || DEFAULT_LOCALE;
      return {
        structuredContent: { trips, purpose },
        content: [
          {
            type: "text",
            text: localizedToolCopy(locale, trips.length
              ? {
                  en: "Choose a trip in Sendero.",
                  es: "Elige un viaje en Sendero.",
                  pt: "Escolha uma viagem no Sendero.",
                }
              : {
                  en: "There are no saved trips yet.",
                  es: "Todavía no hay viajes guardados.",
                  pt: "Ainda não há viagens salvas.",
                }),
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
      _meta: {
        securitySchemes: toolSecuritySchemes([AUTH_SCOPES.read]),
        ui: { visibility: ["model", "app"] },
        "openai/widgetAccessible": true,
      },
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
            text: localizedToolCopy(itinerary.locale, {
              en: `Opened ${itinerary.title}, version ${result.version}.`,
              es: `Se abrió ${itinerary.title}, versión ${result.version}.`,
              pt: `${itinerary.title}, versão ${result.version}, foi aberta.`,
            }),
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
        "Compatibility primitive that creates a saved Sendero trip or adds a concurrency-safe version to an existing trip. Validate the full itinerary first, reuse operationId on retries, and supply expectedVersion for updates. Prefer save_and_present_trip for ordinary user-facing completion.",
      inputSchema: {
        tripId: z.string().min(1).optional(),
        itinerary: itinerarySchema,
        reason: z.string().min(1).optional(),
        expectedVersion: z.number().int().positive().optional(),
        changeLanguage: z
          .boolean()
          .optional()
          .describe(
            "Set true only when the user explicitly asked to translate the complete saved itinerary into itinerary.locale. Ordinary updates must omit it so the saved locale remains authoritative.",
          ),
        operationId: tripWriteOperationIdSchema,
      },
      outputSchema: {
        tripId: z.string(),
        version: z.number().int().positive(),
        role: z.enum(["owner", "editor"]),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: { securitySchemes: toolSecuritySchemes([AUTH_SCOPES.write]) },
    },
    async ({ tripId, itinerary, reason, expectedVersion, changeLanguage = false, operationId }) => {
      const denied = authorizeTool(auth, [AUTH_SCOPES.write]);
      if (denied) return denied;
      const normalized = normalizeItinerary(itinerary);
      const validation = validateItinerary(normalized);
      if (!validation.valid) {
        const prefix = localizedToolCopy(normalized.locale, {
          en: "Itinerary cannot be saved",
          es: "El itinerario no se puede guardar",
          pt: "O itinerário não pode ser salvo",
        });
        throw new Error(`${prefix}: ${validation.errors.join(" ")}`);
      }
      if (tripId && expectedVersion === undefined) {
        throw new Error(localizedToolCopy(normalized.locale, {
          en: "The current trip version is required when updating a saved trip.",
          es: "La versión actual del viaje es obligatoria al actualizar un viaje guardado.",
          pt: "A versão atual da viagem é obrigatória ao atualizar uma viagem salva.",
        }));
      }
      const result = await storage().save({
        tripId,
        itinerary: normalized,
        reason,
        expectedVersion,
        changeLanguage,
        operationId,
      });
      return {
        structuredContent: {
          tripId: result.tripId,
          version: result.version,
          role: result.role,
        },
        content: [
          {
            type: "text",
            text: localizedToolCopy(normalized.locale, tripId
              ? {
                  en: `Saved version ${result.version} successfully.`,
                  es: `La versión ${result.version} se guardó correctamente.`,
                  pt: `A versão ${result.version} foi salva com sucesso.`,
                }
              : {
                  en: `Created the trip successfully as version ${result.version}.`,
                  es: `El viaje se creó correctamente como versión ${result.version}.`,
                  pt: `A viagem foi criada com sucesso como versão ${result.version}.`,
                }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "save_and_present_trip",
    {
      title: "Save and present a completed trip",
      description:
        "Strictly validate, persist, and present the authoritative saved itinerary snapshot in one action. Use this facade when the user asked to save a new trip or revision; do not call validate_itinerary, save_itinerary, get_itinerary, or render_itinerary before or after it. Reuse the same operationId for retries. Updating an existing trip also requires its authoritative expectedVersion.",
      inputSchema: {
        tripId: z.string().min(1).optional(),
        itinerary: itinerarySchema,
        reason: z.string().min(1).optional(),
        expectedVersion: z.number().int().positive().optional(),
        changeLanguage: z
          .boolean()
          .optional()
          .describe(
            "Set true only when the user explicitly asked to translate the complete saved itinerary into itinerary.locale. Ordinary updates must omit it so the saved locale remains authoritative.",
          ),
        operationId: tripWriteOperationIdSchema,
      },
      outputSchema: {
        state: z.literal("saved"),
        tripId: z.string().min(1),
        version: z.number().int().positive(),
        savedVersion: z.number().int().positive(),
        role: collaboratorRoleSchema,
        itinerary: itinerarySchema,
        validation: validationSchema,
        replayed: z.boolean(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        securitySchemes: toolSecuritySchemes([AUTH_SCOPES.write]),
        ui: { resourceUri: ITINERARY_UI_URI },
        "openai/outputTemplate": ITINERARY_UI_URI,
        "openai/toolInvocation/invoking": "Saving itinerary…",
        "openai/toolInvocation/invoked": "Itinerary saved.",
      },
    },
    async ({ tripId, itinerary, reason, expectedVersion, changeLanguage = false, operationId }) => {
      const denied = authorizeTool(auth, [AUTH_SCOPES.write]);
      if (denied) return denied;
      const locale = canonicalLocale(itinerary.locale);
      if (tripId && expectedVersion === undefined) {
        throw new Error(localizedToolCopy(locale, {
          en: "The current trip version is required when updating a saved trip.",
          es: "La versión actual del viaje es obligatoria al actualizar un viaje guardado.",
          pt: "A versão atual da viagem é obrigatória ao atualizar uma viagem salva.",
        }));
      }
      if (!tripId && expectedVersion !== undefined) {
        throw new Error(localizedToolCopy(locale, {
          en: "A current trip version is only valid when updating a saved trip.",
          es: "La versión actual del viaje solo es válida al actualizar un viaje guardado.",
          pt: "A versão atual da viagem só é válida ao atualizar uma viagem salva.",
        }));
      }
      const prepared = validatedPresentation(itinerary);
      const result = await storage().save({
        tripId,
        itinerary: prepared.itinerary,
        reason,
        expectedVersion,
        changeLanguage,
        operationId,
      });
      const authoritative = validatedPresentation(result.itinerary, {
        reservationCompleteness: "warning",
      });
      return {
        structuredContent: {
          state: "saved",
          tripId: result.tripId,
          version: result.version,
          savedVersion: result.savedVersion,
          role: result.role,
          ...authoritative,
          replayed: result.replayed,
        },
        content: [{
          type: "text",
          text: localizedToolCopy(authoritative.itinerary.locale, {
            en: "Your trip was saved and is open in Sendero.",
            es: "Tu viaje quedó guardado y abierto en Sendero.",
            pt: "Sua viagem foi salva e está aberta no Sendero.",
          }),
        }],
      };
    },
  );

  server.registerTool(
    "get_trip_access",
    {
      title: "Review private trip access",
      description:
        "Return the owner, active members, and invitation states for one saved trip. Use this single read-only operation when the owner asks who can see or edit a trip. It is not the public-link status.",
      inputSchema: { tripId: z.string().min(1) },
      outputSchema: {
        owner: accessOwnerSchema,
        members: z.array(accessMemberSchema),
        invitations: z.array(accessInvitationSchema),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: { securitySchemes: toolSecuritySchemes([AUTH_SCOPES.share]) },
    },
    async ({ tripId }) => {
      const denied = authorizeTool(auth, [AUTH_SCOPES.share]);
      if (denied) return denied;
      const access = await storage().listAccess(tripId);
      const members = access.collaborators.map((member) => ({
        memberId: member.id,
        ...(member.name ? { name: member.name } : {}),
        ...(member.email ? { email: member.email } : {}),
        role: externalMemberPermission(member.role),
        status: "active",
        ...(member.createdAt !== undefined ? { createdAt: member.createdAt } : {}),
        ...(member.updatedAt !== undefined ? { updatedAt: member.updatedAt } : {}),
      }));
      const invitations = access.invitations.map((invitation) => ({
        invitationId: invitation.id,
        email: invitation.email,
        role: externalMemberPermission(invitation.role),
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        ...(invitation.sentAt !== undefined ? { sentAt: invitation.sentAt } : {}),
        ...(invitation.delivery ? { delivery: invitation.delivery } : {}),
      }));
      const activeInvitations = invitations.filter(
        (invitation) => invitation.status === "pending",
      ).length;
      return {
        structuredContent: {
          owner: {
            ...(access.owner.name ? { name: access.owner.name } : {}),
            ...(access.owner.email ? { email: access.owner.email } : {}),
            role: "owner",
          },
          members,
          invitations,
        },
        content: [
          {
            type: "text",
            text: `Este viaje tiene ${members.length} persona${members.length === 1 ? "" : "s"} con acceso y ${activeInvitations} invitación${activeInvitations === 1 ? "" : "es"} pendiente${activeInvitations === 1 ? "" : "s"}.`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "invite_trip_member",
    {
      title: "Invite someone to a private trip",
      description:
        "Create and queue one private-trip invitation as viewer or collaborator. Use this single operation only after the owner has specified the person, permission, and trip. Reuse operationId for an exact retry. This does not create a public link.",
      inputSchema: {
        tripId: z.string().min(1),
        email: z.string().email(),
        role: memberPermissionSchema,
        operationId: accessOperationIdSchema,
      },
      outputSchema: {
        invitationId: z.string().min(1),
        email: z.string().email(),
        role: memberPermissionSchema,
        status: z.literal("pending"),
        delivery: invitationDeliverySchema,
        changed: z.boolean(),
        replayed: z.boolean(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      _meta: { securitySchemes: toolSecuritySchemes([AUTH_SCOPES.share]) },
    },
    async ({ tripId, email, role, operationId }) => {
      const denied = authorizeTool(auth, [AUTH_SCOPES.share]);
      if (denied) return denied;
      const { tokenHash } = invitationMaterial({
        pepper: invitationPepper,
        tripId,
        email,
        operationId,
        purpose: "invite",
      });
      const result = await storage().invite({
        tripId,
        email,
        role: internalMemberPermission(role),
        tokenHash,
        operationId,
      });
      const delivery = result.delivery?.status || "unknown";
      return {
        structuredContent: {
          invitationId: result.invitationId,
          email,
          role,
          status: "pending",
          delivery,
          changed: result.changed,
          replayed: result.replayed,
        },
        content: [
          {
            type: "text",
            text: `${invitationDeliveryText(delivery, email)} El permiso es ${memberPermissionLabel(role)}.`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "resend_trip_invitation",
    {
      title: "Resend a private trip invitation",
      description:
        "Rotate the invitation token and resend one existing pending or expired private-trip invitation. Use this single operation for an explicit resend request and reuse operationId only for an exact retry.",
      inputSchema: {
        tripId: z.string().min(1),
        invitationId: z.string().min(1),
        operationId: accessOperationIdSchema,
      },
      outputSchema: {
        invitationId: z.string().min(1),
        email: z.string().email(),
        role: memberPermissionSchema,
        status: z.literal("pending"),
        expiresAt: z.number().int(),
        sentAt: z.number().int(),
        delivery: invitationDeliverySchema,
        changed: z.boolean(),
        replayed: z.boolean(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      _meta: { securitySchemes: toolSecuritySchemes([AUTH_SCOPES.share]) },
    },
    async ({ tripId, invitationId, operationId }) => {
      const denied = authorizeTool(auth, [AUTH_SCOPES.share]);
      if (denied) return denied;
      const context = await invitationContext(tripId);
      const target = context.access.invitations.find(
        (invitation) => invitation.id === invitationId,
      );
      if (!target) throw new Error("No encontramos esa invitación en este viaje.");
      const role = externalMemberPermission(target.role);
      const { tokenHash } = invitationMaterial({
        pepper: invitationPepper,
        tripId,
        email: target.email,
        operationId,
        purpose: "resend",
      });
      const result = await storage().resendInvitation({
        tripId,
        invitationId,
        tokenHash,
        operationId,
      });
      const delivery = result.delivery?.status || "unknown";
      return {
        structuredContent: {
          invitationId: result.invitationId,
          email: target.email,
          role,
          status: "pending",
          expiresAt: result.expiresAt,
          sentAt: result.sentAt,
          delivery,
          changed: result.changed,
          replayed: result.replayed,
        },
        content: [
          {
            type: "text",
            text: invitationDeliveryText(delivery, target.email, "reenviada"),
          },
        ],
      };
    },
  );

  server.registerTool(
    "revoke_trip_invitation",
    {
      title: "Revoke a private trip invitation",
      description:
        "Revoke one unaccepted private-trip invitation so its link can no longer grant access. Use remove_trip_member instead for someone who already accepted. Reuse operationId for an exact retry.",
      inputSchema: {
        tripId: z.string().min(1),
        invitationId: z.string().min(1),
        operationId: accessOperationIdSchema,
      },
      outputSchema: {
        invitationId: z.string().min(1),
        role: memberPermissionSchema,
        status: z.literal("revoked"),
        changed: z.boolean(),
        replayed: z.boolean(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: { securitySchemes: toolSecuritySchemes([AUTH_SCOPES.share]) },
    },
    async ({ tripId, invitationId, operationId }) => {
      const denied = authorizeTool(auth, [AUTH_SCOPES.share]);
      if (denied) return denied;
      const result = await storage().revokeInvitation({ tripId, invitationId, operationId });
      return {
        structuredContent: {
          invitationId: result.invitationId,
          role: externalMemberPermission(result.role),
          status: "revoked",
          changed: result.changed,
          replayed: result.replayed,
        },
        content: [{ type: "text", text: "La invitación quedó revocada." }],
      };
    },
  );

  server.registerTool(
    "change_trip_member_role",
    {
      title: "Change a private trip permission",
      description:
        "Change one accepted trip member between viewer and collaborator. Use this single operation only after the owner has specified the new permission. Reuse operationId for an exact retry.",
      inputSchema: {
        tripId: z.string().min(1),
        memberId: z.string().min(1),
        role: memberPermissionSchema,
        operationId: accessOperationIdSchema,
      },
      outputSchema: {
        memberId: z.string().min(1),
        role: memberPermissionSchema,
        status: z.literal("active"),
        changed: z.boolean(),
        replayed: z.boolean(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: { securitySchemes: toolSecuritySchemes([AUTH_SCOPES.share]) },
    },
    async ({ tripId, memberId, role, operationId }) => {
      const denied = authorizeTool(auth, [AUTH_SCOPES.share]);
      if (denied) return denied;
      const result = await storage().changeRole({
        tripId,
        collaboratorId: memberId,
        role: internalMemberPermission(role),
        operationId,
      });
      return {
        structuredContent: {
          memberId: result.collaboratorId,
          role,
          status: "active",
          changed: result.changed,
          replayed: result.replayed,
        },
        content: [
          {
            type: "text",
            text: result.changed
              ? `El permiso quedó actualizado a ${memberPermissionLabel(role)}.`
              : `Esa persona ya tenía permiso de ${memberPermissionLabel(role)}.`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "remove_trip_member",
    {
      title: "Remove someone from a private trip",
      description:
        "Remove one accepted member from a private trip and revoke their access. Use this single operation only after the owner explicitly asks to remove that person. Reuse operationId for an exact retry.",
      inputSchema: {
        tripId: z.string().min(1),
        memberId: z.string().min(1),
        operationId: accessOperationIdSchema,
      },
      outputSchema: {
        memberId: z.string().min(1),
        role: memberPermissionSchema,
        status: z.literal("removed"),
        changed: z.boolean(),
        replayed: z.boolean(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: { securitySchemes: toolSecuritySchemes([AUTH_SCOPES.share]) },
    },
    async ({ tripId, memberId, operationId }) => {
      const denied = authorizeTool(auth, [AUTH_SCOPES.share]);
      if (denied) return denied;
      const result = await storage().removeCollaborator({
        tripId,
        collaboratorId: memberId,
        operationId,
      });
      return {
        structuredContent: {
          memberId: result.collaboratorId,
          role: externalMemberPermission(result.role),
          status: "removed",
          changed: result.changed,
          replayed: result.replayed,
        },
        content: [
          {
            type: "text",
            text: result.changed
              ? "Esa persona ya no tiene acceso al viaje."
              : "Esa persona ya no tenía acceso al viaje.",
          },
        ],
      };
    },
  );

  server.registerTool(
    "share_trip_publicly",
    {
      title: "Share a trip publicly",
      description:
        "Publish a saved trip through one secure read-only Sendero link, or update its existing public copy while preserving the link. Use this single action when the owner explicitly asks to publish, share by public link, or update the public version. Accepts an exact ID, latest or last-saved wording, a trip name or destination, and optional exact dates. It resolves the reference and derives the sanitized public snapshot internally. The user's explicit imperative is authorization: do not preview first and do not ask for a second confirmation. Reuse operationId unchanged on an exact retry.",
      inputSchema: shareTripPubliclyInputSchema,
      outputSchema: {
        ...publicShareReceiptFields,
        state: z.union([
          z.literal("published"),
          z.literal("updated"),
          z.literal("active"),
        ]),
        publicUrl: url.optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      _meta: publicShareToolMeta(
        "Publishing the public trip…",
        "Public trip ready.",
        ["model", "app"],
      ),
    },
    async ({
      tripId,
      query,
      reference,
      selector,
      startDate,
      endDate,
      expiresInDays = DEFAULT_PUBLIC_SHARE_DAYS,
      operationId,
    }) => {
      const denied = authorizeTool(auth, [AUTH_SCOPES.share]);
      if (denied) return denied;

      const resolved = await storage().open(
        canonicalTripReference({
          tripId,
          selector,
          query,
          reference,
          startDate,
          endDate,
        }),
      );
      if (resolved.state === "needs_selection") {
        const locale = resolved.trips?.map(normalizeTripSummary)[0]?.locale || DEFAULT_LOCALE;
        throw new Error(
          localizedToolCopy(locale, {
            en: "Several saved trips match that reference. Ask the owner which trip they mean before publishing.",
            es: "Varios viajes guardados coinciden con esa referencia. Pregunta al propietario cuál quiere publicar.",
            pt: "Várias viagens salvas correspondem a essa referência. Pergunte ao proprietário qual delas deseja publicar.",
          }),
        );
      }
      if (resolved.state === "not_found") {
        throw new Error("No saved trip matches that reference.");
      }

      const preview = await storage().publicPreview(resolved.id);
      const itinerary = publicItinerarySchema.parse(preview.itinerary);
      if (preview.sharing.status === "active") {
        const result = preview.sharing.isStale
          ? await storage().updatePublic({
              tripId: resolved.id,
              expectedVersion: preview.version,
              operationId: publicShareFacadeOperationId(operationId, "update"),
            })
          : preview.sharing;
        const publicUrl = currentPublicUrl(resolved.id, result);
        const state = preview.sharing.isStale ? "updated" : "active";
        const output = publicShareReceiptOutput({
          tripId: resolved.id,
          itinerary,
          sharing: result,
          operationId,
          state,
          publicUrl,
        });
        return {
          structuredContent: output,
          content: [{
            type: "text",
            text: publicUrl
              ? localizedToolCopy(itinerary.locale, {
                  en: `The public read-only link remains the same: ${publicUrl}`,
                  es: `El enlace público de solo lectura sigue siendo el mismo: ${publicUrl}`,
                  pt: `O link público somente para leitura continua o mesmo: ${publicUrl}`,
                })
              : localizedToolCopy(itinerary.locale, {
                  en: "The public link is still active, but it belongs to an older generation that Sendero cannot display again. Replace it only if the owner explicitly asks for a new link.",
                  es: "El enlace público sigue activo, pero pertenece a una generación antigua que Sendero no puede volver a mostrar. Reemplázalo solo si el propietario pide expresamente un enlace nuevo.",
                  pt: "O link público continua ativo, mas pertence a uma geração antiga que o Sendero não consegue exibir novamente. Substitua-o apenas se o proprietário pedir explicitamente um novo link.",
                }),
          }],
        };
      }

      const publishOperationId = publicShareFacadeOperationId(operationId, "publish");
      const token = derivePublicShareToken({
        secret: publicShareSecret,
        purpose: "publish",
        tripId: resolved.id,
        operationId: publishOperationId,
      });

      let publishConflict;
      try {
        const result = await storage().publishPublic({
          tripId: resolved.id,
          expectedVersion: preview.version,
          tokenHash: hashPublicShareToken(token),
          expiresAt: publicShareExpiresAt(expiresInDays),
          operationId: publishOperationId,
        });
        const publicUrl = buildPublicShareUrl({ baseUrl: publicWebUrl, token });
        const output = {
          ...publicShareReceiptOutput({
            tripId: resolved.id,
            itinerary,
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
              text: localizedToolCopy(itinerary.locale, {
                en: `The public read-only link is ready: ${publicUrl}`,
                es: `El enlace público de solo lectura ya está listo: ${publicUrl}`,
                pt: `O link público somente para leitura está pronto: ${publicUrl}`,
              }),
            },
          ],
        };
      } catch (error) {
        if (!isActivePublicShareConflict(error)) throw error;
        publishConflict = error;
      }

      const winner = await storage().publicStatus(resolved.id);
      if (winner.status !== "active") throw publishConflict;

      let result = winner;
      let receiptItinerary;
      let state = "active";
      if (winner.isStale) {
        const freshPreview = await storage().publicPreview(resolved.id);
        if (freshPreview.sharing.status !== "active") throw publishConflict;
        receiptItinerary = publicItinerarySchema.parse(freshPreview.itinerary);
        if (freshPreview.sharing.isStale) {
          result = await storage().updatePublic({
            tripId: resolved.id,
            expectedVersion: freshPreview.version,
            operationId: publicShareFacadeOperationId(operationId, "update"),
          });
          state = "updated";
        } else {
          result = freshPreview.sharing;
        }
      }
      const publicUrl = currentPublicUrl(resolved.id, result);
      const output = publicShareReceiptOutput({
        tripId: resolved.id,
        itinerary: receiptItinerary,
        sharing: result,
        operationId,
        state,
        publicUrl,
      });
      return {
        structuredContent: output,
        content: [
          {
            type: "text",
            text: publicUrl
              ? state === "updated"
                ? localizedToolCopy(receiptItinerary?.locale || itinerary.locale, {
                    en: `The public view now reflects the current trip version and keeps this link: ${publicUrl}`,
                    es: `La vista pública ya refleja la versión actual del viaje y conserva este enlace: ${publicUrl}`,
                    pt: `A visualização pública agora reflete a versão atual da viagem e mantém este link: ${publicUrl}`,
                  })
                : localizedToolCopy(receiptItinerary?.locale || itinerary.locale, {
                    en: `The public read-only link remains the same: ${publicUrl}`,
                    es: `El enlace público de solo lectura sigue siendo el mismo: ${publicUrl}`,
                    pt: `O link público somente para leitura continua o mesmo: ${publicUrl}`,
                  })
              : localizedToolCopy(receiptItinerary?.locale || itinerary.locale, {
                  en: "The public view now reflects the current trip version, but Sendero cannot display this older link generation again. Replace it only if the owner explicitly asks.",
                  es: "La vista pública ya refleja la versión actual del viaje, pero Sendero no puede volver a mostrar esta generación antigua del enlace. Reemplázalo solo si el propietario lo pide expresamente.",
                  pt: "A visualização pública agora reflete a versão atual da viagem, mas o Sendero não consegue exibir novamente esta geração antiga do link. Substitua-o apenas se o proprietário pedir explicitamente.",
                }),
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
        "Show the owner the exact sanitized, version-specific itinerary that a public read-only link would expose, without publishing or updating anything. Use only when the owner explicitly asks to inspect the public preview before deciding. For an explicit publish, share, or update request, use share_trip_publicly directly instead.",
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
            text: localizedToolCopy(itinerary.locale, {
              en: "Review the public preview in Sendero.",
              es: "Revisa la vista pública en Sendero.",
              pt: "Revise a prévia pública no Sendero.",
            }),
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
      outputSchema: publicShareStatusOnlyFields,
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
      const descriptions = localizedToolCopy(output.locale, {
        en: {
          active: output.isStale
            ? "The link is still active, but the private trip has changes that have not been published yet."
            : "The public link is active and shows the latest published version.",
          expired: "The public link expired and no longer opens the trip.",
          revoked: "The public link was revoked and no longer opens the trip.",
          not_published: "This trip does not have a public link yet.",
        },
        es: {
          active: output.isStale
            ? "El enlace sigue activo, pero el viaje privado tiene cambios que todavía no se publicaron."
            : "El enlace público está activo y muestra la versión publicada más reciente.",
          expired: "El enlace público venció y ya no abre el viaje.",
          revoked: "El enlace público fue revocado y ya no abre el viaje.",
          not_published: "Este viaje todavía no tiene un enlace público.",
        },
        pt: {
          active: output.isStale
            ? "O link continua ativo, mas a viagem privada tem alterações que ainda não foram publicadas."
            : "O link público está ativo e mostra a versão publicada mais recente.",
          expired: "O link público expirou e não abre mais a viagem.",
          revoked: "O link público foi revogado e não abre mais a viagem.",
          not_published: "Esta viagem ainda não tem um link público.",
        },
      });
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
        "Compatibility primitive that publishes an exact previously prepared public-share payload. Prefer share_trip_publicly for an owner's explicit natural-language request.",
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
      _meta: publicShareToolMeta(
        "Creating the public link…",
        "Public link created.",
        ["app"],
      ),
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
            text: localizedToolCopy(output.locale, {
              en: `The public read-only link is ready: ${publicUrl}`,
              es: `El enlace público de solo lectura ya está listo: ${publicUrl}`,
              pt: `O link público somente para leitura está pronto: ${publicUrl}`,
            }),
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
        "Compatibility primitive that updates an exact previously prepared public-share payload while preserving its link. Prefer share_trip_publicly for an owner's explicit natural-language request.",
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
      _meta: publicShareToolMeta(
        "Updating the public trip…",
        "Public trip updated.",
        ["app"],
      ),
    },
    async ({ tripId, expectedVersion, operationId }) => {
      const denied = authorizeTool(auth, [AUTH_SCOPES.share]);
      if (denied) return denied;
      const result = await storage().updatePublic({ tripId, expectedVersion, operationId });
      const publicUrl = currentPublicUrl(tripId, result);
      const output = publicShareStatusOutput({
        tripId,
        sharing: result,
        operationId,
        state: "updated",
        publicUrl,
      });
      return {
        structuredContent: output,
        content: [
          {
            type: "text",
            text: publicUrl
              ? localizedToolCopy(output.locale, {
                  en: `The public view now reflects the version you just reviewed and keeps this link: ${publicUrl}`,
                  es: `La vista pública ahora refleja la versión que acabas de revisar y conserva este enlace: ${publicUrl}`,
                  pt: `A visualização pública agora reflete a versão que você acabou de revisar e mantém este link: ${publicUrl}`,
                })
              : localizedToolCopy(output.locale, {
                  en: "The public view now reflects the version you just reviewed. The link remains active, but this older generation cannot be displayed again.",
                  es: "La vista pública ahora refleja la versión que acabas de revisar. El enlace sigue activo, pero esta generación antigua no se puede volver a mostrar.",
                  pt: "A visualização pública agora reflete a versão que você acabou de revisar. O link continua ativo, mas esta geração antiga não pode ser exibida novamente.",
                }),
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
            text: localizedToolCopy(output.locale, {
              en: `The previous link no longer works. This is the new public link: ${publicUrl}`,
              es: `El enlace anterior dejó de funcionar. Este es el nuevo enlace público: ${publicUrl}`,
              pt: `O link anterior não funciona mais. Este é o novo link público: ${publicUrl}`,
            }),
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
                ? localizedToolCopy(output.locale, {
                    en: "The public link was revoked and no longer opens the trip.",
                    es: "El enlace público fue revocado y ya no permite abrir el viaje.",
                    pt: "O link público foi revogado e não abre mais a viagem.",
                  })
                : localizedToolCopy(output.locale, {
                    en: "This trip did not have an active public link.",
                    es: "Este viaje no tenía un enlace público activo.",
                    pt: "Esta viagem não tinha um link público ativo.",
                  }),
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
        "Restore a previous itinerary snapshot as a new version and present the authoritative restored snapshot in the same action. Do not follow it with get_itinerary or render_itinerary. Supply expectedVersion to prevent overwriting a newer edit and reuse operationId for retries.",
      inputSchema: {
        tripId: z.string().min(1),
        version: z.number().int().positive(),
        expectedVersion: z.number().int().positive(),
        operationId: tripWriteOperationIdSchema,
      },
      outputSchema: {
        state: z.literal("restored"),
        tripId: z.string(),
        version: z.number().int().positive(),
        restoredVersion: z.number().int().positive(),
        restoredFrom: z.number().int().positive(),
        role: collaboratorRoleSchema,
        itinerary: itinerarySchema,
        validation: validationSchema,
        replayed: z.boolean(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        securitySchemes: toolSecuritySchemes([AUTH_SCOPES.write]),
        ui: { resourceUri: ITINERARY_UI_URI },
        "openai/outputTemplate": ITINERARY_UI_URI,
        "openai/toolInvocation/invoking": "Restoring itinerary…",
        "openai/toolInvocation/invoked": "Itinerary restored.",
      },
    },
    async ({ tripId, version, expectedVersion, operationId }) => {
      const denied = authorizeTool(auth, [AUTH_SCOPES.write]);
      if (denied) return denied;
      const candidate = await storage().getRevision({ tripId, version });
      validatedPresentation(candidate.itinerary, {
        reservationCompleteness: "warning",
      });
      const result = await storage().restore({
        tripId,
        version,
        expectedVersion,
        operationId,
      });
      const authoritative = validatedPresentation(result.itinerary, {
        reservationCompleteness: "warning",
      });
      return {
        structuredContent: {
          state: "restored",
          tripId: result.tripId,
          version: result.version,
          restoredVersion: result.restoredVersion,
          restoredFrom: result.restoredFrom,
          role: result.role,
          ...authoritative,
          replayed: result.replayed,
        },
        content: [
          {
            type: "text",
            text: localizedToolCopy(authoritative.itinerary.locale, {
              en: "The restored version is open in Sendero.",
              es: "La versión restaurada está abierta en Sendero.",
              pt: "A versão restaurada está aberta no Sendero.",
            }),
          },
        ],
      };
    },
  );

  return server;
}
