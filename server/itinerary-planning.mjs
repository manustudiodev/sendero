import { createHash } from "node:crypto";
import { z } from "zod";
import {
  itinerarySchema,
  normalizeItinerary,
  normalizeItineraryCostInputs,
  prepareTripBrief,
  tripBriefSchema,
  validateItinerary,
} from "./server.mjs";
import {
  planningInstructions,
  planningProtocolVersion,
} from "./generated/planning-protocol.mjs";
import {
  itineraryBudgetSummary,
  normalizeBudgetPreference,
} from "../shared/itinerary-budget.mjs";

export const PLANNING_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_ITINERARY_BODY_BYTES = 512 * 1024;

const operationIdSchema = z.string().regex(/^[A-Za-z0-9._:-]{8,128}$/);
const protocolHashSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const planningProtocolRequestSchema = z.object({
  brief: tripBriefSchema.default({}),
}).strict();

export const stageItineraryRequestSchema = z.object({
  brief: tripBriefSchema,
  itinerary: itinerarySchema,
  operationId: operationIdSchema,
  protocolHash: protocolHashSchema,
  protocolVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
}).strict();

export const saveDraftRequestSchema = z.object({
  operationId: operationIdSchema,
}).strict();

const itineraryJsonSchema = z.toJSONSchema(itinerarySchema, {
  target: "draft-2020-12",
  unrepresentable: "any",
});

function sortedJson(value) {
  if (Array.isArray(value)) return `[${value.map(sortedJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${sortedJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

const protocolHash = sha256(sortedJson({
  instructions: planningInstructions,
  itinerarySchema: itineraryJsonSchema,
  version: planningProtocolVersion,
}));

export class ItineraryPlanningError extends Error {
  constructor(code, message, status = 400, details) {
    super(message);
    this.name = "ItineraryPlanningError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function planningProtocol(briefInput = {}) {
  const brief = tripBriefSchema.parse(briefInput);
  const prepared = prepareTripBrief(brief);
  return {
    protocol: {
      version: planningProtocolVersion,
      hash: protocolHash,
      instructions: planningInstructions,
      itinerarySchema: itineraryJsonSchema,
    },
    brief: prepared,
  };
}

function assertProtocol({ protocolVersion, protocolHash: requestedHash }) {
  if (protocolVersion !== planningProtocolVersion || requestedHash !== protocolHash) {
    throw new ItineraryPlanningError(
      "planning_protocol_changed",
      "The Sendero planning protocol changed. Load it again before validating the itinerary.",
      409,
      { currentVersion: planningProtocolVersion, currentHash: protocolHash },
    );
  }
}

function comparableText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function assertBriefMatchesItinerary(brief, itinerary) {
  const mismatches = [];
  if (brief.destination) {
    const briefDestination = comparableText(brief.destination);
    const itineraryDestination = comparableText(itinerary.destination);
    if (
      !briefDestination ||
      !itineraryDestination ||
      (!briefDestination.includes(itineraryDestination) && !itineraryDestination.includes(briefDestination))
    ) {
      mismatches.push("destination");
    }
  }
  if (brief.startDate && brief.startDate !== itinerary.startDate) mismatches.push("startDate");
  if (brief.endDate && brief.endDate !== itinerary.endDate) mismatches.push("endDate");
  if (brief.locale && brief.locale !== itinerary.locale) mismatches.push("locale");
  if (sortedJson(brief.travellers) !== sortedJson(itinerary.travellers)) {
    mismatches.push("travellers");
  }
  if (brief.arrivalTime && brief.arrivalTime !== itinerary.arrivalTime) mismatches.push("arrivalTime");
  if (brief.departureTime && brief.departureTime !== itinerary.departureTime) mismatches.push("departureTime");
  if (brief.dailySchedule && sortedJson(brief.dailySchedule) !== sortedJson(itinerary.dailySchedule)) {
    mismatches.push("dailySchedule");
  }
  if (brief.mobility && sortedJson(brief.mobility) !== sortedJson(itinerary.mobility)) {
    mismatches.push("mobility");
  }
  if (
    brief.accessibilityNeeds?.length
    && sortedJson([...brief.accessibilityNeeds].sort())
      !== sortedJson([...(itinerary.accessibilityNeeds || [])].sort())
  ) {
    mismatches.push("accessibilityNeeds");
  }
  const briefBudget = normalizeBudgetPreference(brief.budget);
  const itineraryBudget = itinerary.budget
    ? normalizeBudgetPreference(itinerary.budget)
    : undefined;
  const budgetIsConstrained = Boolean(briefBudget.amount) || briefBudget.comfort !== "flexible";
  if (budgetIsConstrained && sortedJson(briefBudget) !== sortedJson(itineraryBudget)) {
    mismatches.push("budget");
  }
  if (
    (itinerary.transport.wantsCar || itinerary.transport.modes.includes("car")) &&
    (!brief.transport?.modes?.includes("car") || !brief.transport?.hasLicense)
  ) {
    mismatches.push("transport.modes");
  }
  if (brief.lodging?.address) {
    const briefAddress = comparableText(brief.lodging.address);
    const itineraryAddress = comparableText(itinerary.lodging?.address);
    if (briefAddress !== itineraryAddress) mismatches.push("lodging.address");
  }
  for (const fixedPlan of brief.fixedPlans || []) {
    const fixedTitle = comparableText(fixedPlan.title);
    const matchingActivity = itinerary.days
      .find(({ date }) => date === fixedPlan.date)
      ?.activities.find((activity) =>
        comparableText(activity.title) === fixedTitle &&
        (!fixedPlan.startTime || activity.startTime === fixedPlan.startTime) &&
        activity.locked === true,
      );
    if (!matchingActivity) {
      mismatches.push(`fixedPlans.${fixedPlan.date}.${fixedPlan.title}`);
    }
  }
  if (mismatches.length) {
    throw new ItineraryPlanningError(
      "itinerary_brief_mismatch",
      `The itinerary does not match the prepared brief: ${mismatches.join(", ")}.`,
      400,
      { fields: [...new Set(mismatches)] },
    );
  }
}

export function validatedDraft(input) {
  const normalizedInput = input && typeof input === "object" && !Array.isArray(input)
    ? { ...input, itinerary: normalizeItineraryCostInputs(input.itinerary) }
    : input;
  const parsed = stageItineraryRequestSchema.parse(normalizedInput);
  assertProtocol(parsed);
  const prepared = prepareTripBrief(parsed.brief);
  if (!prepared.ready) {
    throw new ItineraryPlanningError(
      "brief_incomplete",
      "Complete the critical trip details before validating an itinerary.",
      400,
      { criticalFields: prepared.criticalFields, warnings: prepared.warnings },
    );
  }

  const normalized = normalizeItinerary(parsed.itinerary);
  assertBriefMatchesItinerary(prepared.brief, normalized);
  const validation = validateItinerary(normalized, { contentCompleteness: "error" });
  if (!validation.valid) {
    throw new ItineraryPlanningError(
      "itinerary_invalid",
      "The itinerary has blocking validation errors.",
      400,
      { errors: validation.errors, warnings: validation.warnings },
    );
  }

  return {
    brief: prepared.brief,
    briefHash: sha256(sortedJson(prepared.brief)),
    itinerary: normalized,
    itineraryHash: sha256(sortedJson(normalized)),
    operationId: parsed.operationId,
    protocolHash,
    protocolVersion: planningProtocolVersion,
    warnings: validation.warnings,
  };
}

export function planningProtocolIdentity() {
  return { version: planningProtocolVersion, hash: protocolHash };
}

export function draftSummary(draft) {
  const itinerary = draft?.itinerary;
  const budget = itineraryBudgetSummary(itinerary);
  return {
    draftId: String(draft?.draftId || ""),
    status: draft?.status,
    expiresAt: draft?.expiresAt,
    protocolVersion: draft?.protocolVersion,
    warnings: Array.isArray(draft?.warnings) ? draft.warnings : [],
    ...(itinerary ? {
      itinerary,
      summary: {
        title: itinerary.title,
        destination: itinerary.destination,
        startDate: itinerary.startDate,
        endDate: itinerary.endDate,
        days: itinerary.days.length,
        ...(itinerary.travellers ? { travellers: itinerary.travellers } : {}),
        ...(itinerary.arrivalTime ? { arrivalTime: itinerary.arrivalTime } : {}),
        ...(itinerary.departureTime ? { departureTime: itinerary.departureTime } : {}),
        ...(itinerary.dailySchedule ? { dailySchedule: itinerary.dailySchedule } : {}),
        ...(itinerary.mobility ? { mobility: itinerary.mobility } : {}),
        ...(itinerary.accessibilityNeeds?.length ? { accessibilityNeeds: itinerary.accessibilityNeeds } : {}),
        ...(budget ? {
          budget: {
            currency: budget.currency,
            estimatedMin: budget.estimatedMin,
            estimatedMax: budget.estimatedMax,
            limit: budget.limit,
            status: budget.status,
            complete: budget.complete,
            unknownItems: budget.unknownItems,
            missingCategories: budget.missingCategories,
          },
        } : {}),
      },
    } : {}),
    ...(draft?.trip ? { trip: draft.trip } : {}),
  };
}
