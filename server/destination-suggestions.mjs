import { z } from "zod";
import { canonicalLocale } from "../shared/locale.mjs";

const GOOGLE_PLACES_AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const ALLOWED_DESTINATION_TYPES = new Set(["country", "locality", "postal_town"]);
const MAX_SUGGESTIONS = 8;

export const destinationSuggestionsRequestSchema = z.object({
  query: z.string().trim().min(3).max(120),
  locale: z.string().trim().min(2).max(35).optional(),
  sessionToken: z.string().regex(/^[A-Za-z0-9_-]{16,36}$/),
}).strict();

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

function normalizePrediction(value) {
  const prediction = value?.placePrediction;
  const placeId = cleanText(prediction?.placeId);
  const label = cleanText(prediction?.text?.text);
  const types = Array.isArray(prediction?.types)
    ? prediction.types.filter((type) => typeof type === "string")
    : [];
  if (!placeId || !label || !types.some((type) => ALLOWED_DESTINATION_TYPES.has(type))) {
    return null;
  }
  return {
    placeId,
    label,
    primaryText: cleanText(prediction?.structuredFormat?.mainText?.text) || label,
    secondaryText: cleanText(prediction?.structuredFormat?.secondaryText?.text),
  };
}

export async function destinationSuggestions(input, {
  apiKey = process.env.GOOGLE_PLACES_API_KEY,
  fetchImpl = globalThis.fetch,
  signal,
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

  let response;
  try {
    response = await fetchImpl(GOOGLE_PLACES_AUTOCOMPLETE_URL, {
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
      body: JSON.stringify({
        input: request.query,
        includeQueryPredictions: false,
        includedPrimaryTypes: ["(regions)"],
        languageCode: canonicalLocale(request.locale || "en"),
        sessionToken: request.sessionToken,
      }),
      signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new DestinationSuggestionsError(
      "destination_search_failed",
      "Destination search is temporarily unavailable.",
    );
  }

  if (!response.ok) {
    throw new DestinationSuggestionsError(
      "destination_search_failed",
      "Destination search is temporarily unavailable.",
    );
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new DestinationSuggestionsError(
      "destination_search_failed",
      "Destination search is temporarily unavailable.",
    );
  }

  const suggestions = [];
  const seen = new Set();
  for (const value of Array.isArray(payload?.suggestions) ? payload.suggestions : []) {
    const suggestion = normalizePrediction(value);
    if (!suggestion || seen.has(suggestion.placeId)) continue;
    seen.add(suggestion.placeId);
    suggestions.push(suggestion);
    if (suggestions.length >= MAX_SUGGESTIONS) break;
  }
  return { suggestions };
}
