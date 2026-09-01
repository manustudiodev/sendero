import { z } from "zod";
import { canonicalLocale } from "../shared/locale.mjs";

const GOOGLE_PLACES_AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const GOOGLE_PLACES_DETAILS_URL = "https://places.googleapis.com/v1/places";
const ALLOWED_DESTINATION_TYPES = new Set(["country", "locality", "postal_town"]);
const ALLOWED_LODGING_AREA_TYPES = new Set([
  "administrative_area_level_2",
  "administrative_area_level_3",
  "locality",
  "neighborhood",
  "postal_town",
  "sublocality",
  "sublocality_level_1",
  "sublocality_level_2",
]);
const SEARCH_KINDS = ["destination", "lodging_area", "lodging_address"];
const MAX_SUGGESTIONS = 8;
const PLACE_CONTEXT_TTL_MS = 10 * 60 * 1000;
const PLACE_CONTEXT_CACHE_LIMIT = 100;
const sharedPlaceContextCache = new Map();

export const destinationSuggestionsRequestSchema = z.object({
  query: z.string().trim().min(3).max(120),
  locale: z.string().trim().min(2).max(35).optional(),
  kind: z.enum(SEARCH_KINDS).default("destination"),
  destinationPlaceId: z.string().trim().min(1).max(255).optional(),
  sessionToken: z.string().regex(/^[A-Za-z0-9_-]{16,36}$/),
}).strict().superRefine((value, context) => {
  if (value.kind !== "destination" && !value.destinationPlaceId) {
    context.addIssue({
      code: "custom",
      message: "A selected destination is required for lodging suggestions.",
      path: ["destinationPlaceId"],
    });
  }
});

export class DestinationSuggestionsError extends Error {
  constructor(code, message, status = 503, retryable = true) {
    super(message);
    this.name = "DestinationSuggestionsError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function hasAllowedType(types, kind) {
  if (kind === "lodging_address") return true;
  const allowedTypes = kind === "lodging_area"
    ? ALLOWED_LODGING_AREA_TYPES
    : ALLOWED_DESTINATION_TYPES;
  return types.some((type) => allowedTypes.has(type));
}

function normalizePrediction(value, kind) {
  const prediction = value?.placePrediction;
  const placeId = cleanText(prediction?.placeId);
  const label = cleanText(prediction?.text?.text);
  const types = Array.isArray(prediction?.types)
    ? prediction.types.filter((type) => typeof type === "string")
    : [];
  if (!placeId || !label || !hasAllowedType(types, kind)) {
    return null;
  }
  return {
    placeId,
    label,
    primaryText: cleanText(prediction?.structuredFormat?.mainText?.text) || label,
    secondaryText: cleanText(prediction?.structuredFormat?.secondaryText?.text),
  };
}

function validCoordinate(value, min, max) {
  return Number.isFinite(value) && value >= min && value <= max;
}

function normalizePlaceContext(payload) {
  const types = Array.isArray(payload?.types)
    ? payload.types.filter((type) => typeof type === "string")
    : [];
  if (!types.some((type) => ALLOWED_DESTINATION_TYPES.has(type))) {
    throw new DestinationSuggestionsError(
      "destination_search_failed",
      "Destination search is temporarily unavailable.",
    );
  }
  const countryCode = (Array.isArray(payload?.addressComponents) ? payload.addressComponents : [])
    .find((component) => Array.isArray(component?.types) && component.types.includes("country"))
    ?.shortText?.trim().toLowerCase();
  const latitude = payload?.location?.latitude;
  const longitude = payload?.location?.longitude;
  const low = payload?.viewport?.low;
  const high = payload?.viewport?.high;
  const rectangle = validCoordinate(low?.latitude, -90, 90)
    && validCoordinate(low?.longitude, -180, 180)
    && validCoordinate(high?.latitude, -90, 90)
    && validCoordinate(high?.longitude, -180, 180)
    && low.latitude <= high.latitude
    && low.longitude <= high.longitude
    ? {
        low: { latitude: low.latitude, longitude: low.longitude },
        high: { latitude: high.latitude, longitude: high.longitude },
      }
    : undefined;
  const location = validCoordinate(latitude, -90, 90) && validCoordinate(longitude, -180, 180)
    ? { latitude, longitude }
    : undefined;
  if (types.includes("country") && /^[a-z]{2}$/.test(countryCode || "")) {
    return { countryCode };
  }
  if (rectangle) return { rectangle };
  if (location) {
    return {
      location,
      ...(/^[a-z]{2}$/.test(countryCode || "") ? { countryCode } : {}),
    };
  }
  if (/^[a-z]{2}$/.test(countryCode || "")) return { countryCode };
  throw new DestinationSuggestionsError(
    "destination_search_failed",
    "Destination search is temporarily unavailable.",
  );
}

function cachedContext(cache, key, now) {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= now) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function cacheContext(cache, key, value, now) {
  if (cache.size >= PLACE_CONTEXT_CACHE_LIMIT && !cache.has(key)) {
    cache.delete(cache.keys().next().value);
  }
  cache.set(key, { expiresAt: now + PLACE_CONTEXT_TTL_MS, value });
}

async function requestJson(url, { fetchImpl, request }, errorCode = "destination_search_failed") {
  let response;
  try {
    response = await fetchImpl(url, request);
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new DestinationSuggestionsError(errorCode, "Destination search is temporarily unavailable.");
  }
  if (!response.ok) {
    throw new DestinationSuggestionsError(errorCode, "Destination search is temporarily unavailable.");
  }
  try {
    return await response.json();
  } catch {
    throw new DestinationSuggestionsError(errorCode, "Destination search is temporarily unavailable.");
  }
}

async function placeContext(destinationPlaceId, locale, {
  apiKey,
  fetchImpl,
  signal,
  contextCache,
  now,
}) {
  const currentTime = now();
  const cached = cachedContext(contextCache, destinationPlaceId, currentTime);
  if (cached) return cached;
  const url = new URL(`${GOOGLE_PLACES_DETAILS_URL}/${encodeURIComponent(destinationPlaceId)}`);
  url.searchParams.set("languageCode", locale);
  const payload = await requestJson(url.href, {
    fetchImpl,
    request: {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "id,types,location,viewport,addressComponents",
      },
      signal,
    },
  });
  const value = normalizePlaceContext(payload);
  cacheContext(contextCache, destinationPlaceId, value, currentTime);
  return value;
}

function geographicConstraint(context) {
  if (context.rectangle) {
    return { locationRestriction: { rectangle: context.rectangle } };
  }
  if (context.location) {
    return {
      ...(context.countryCode ? { includedRegionCodes: [context.countryCode] } : {}),
      locationBias: {
        circle: {
          center: context.location,
          radius: 50_000,
        },
      },
    };
  }
  return { includedRegionCodes: [context.countryCode] };
}

export async function destinationSuggestions(input, {
  apiKey = process.env.GOOGLE_PLACES_API_KEY,
  fetchImpl = globalThis.fetch,
  signal,
  contextCache = sharedPlaceContextCache,
  now = () => Date.now(),
} = {}) {
  const request = destinationSuggestionsRequestSchema.parse(input);
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    throw new DestinationSuggestionsError(
      "destination_search_unavailable",
      "Destination search is not configured in this Sendero environment.",
    );
  }
  if (typeof fetchImpl !== "function") {
    throw new DestinationSuggestionsError(
      "destination_search_unavailable",
      "Destination search is temporarily unavailable.",
    );
  }

  const locale = canonicalLocale(request.locale || "en");
  const context = request.kind === "destination"
    ? undefined
    : await placeContext(request.destinationPlaceId, locale, {
        apiKey: apiKey.trim(),
        contextCache,
        fetchImpl,
        now,
        signal,
      });
  const body = {
    input: request.query,
    includeQueryPredictions: false,
    ...(request.kind === "lodging_address" ? {} : { includedPrimaryTypes: ["(regions)"] }),
    ...(context ? geographicConstraint(context) : {}),
    languageCode: locale,
    sessionToken: request.sessionToken,
  };
  const payload = await requestJson(GOOGLE_PLACES_AUTOCOMPLETE_URL, {
    fetchImpl,
    request: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey.trim(),
        "X-Goog-FieldMask": [
          "suggestions.placePrediction.placeId",
          "suggestions.placePrediction.text.text",
          "suggestions.placePrediction.structuredFormat.mainText.text",
          "suggestions.placePrediction.structuredFormat.secondaryText.text",
          "suggestions.placePrediction.types",
        ].join(","),
      },
      body: JSON.stringify(body),
      signal,
    },
  });

  const suggestions = [];
  const seen = new Set();
  for (const value of Array.isArray(payload?.suggestions) ? payload.suggestions : []) {
    const suggestion = normalizePrediction(value, request.kind);
    if (!suggestion || seen.has(suggestion.placeId)) continue;
    seen.add(suggestion.placeId);
    suggestions.push(suggestion);
    if (suggestions.length >= MAX_SUGGESTIONS) break;
  }
  return { suggestions };
}
