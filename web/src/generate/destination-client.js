import { requestJson } from "../account/web-client.js";

export const DESTINATION_QUERY_MIN_LENGTH = 3;

const LODGING_AREA_TYPES = new Set([
  "administrative_area_level_2",
  "administrative_area_level_3",
  "locality",
  "neighborhood",
  "postal_town",
  "sublocality",
  "sublocality_level_1",
  "sublocality_level_2",
]);

export function normalizedDestinationQuery(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export function destinationQueryReady(value) {
  return normalizedDestinationQuery(value).length >= DESTINATION_QUERY_MIN_LENGTH;
}

export function isLodgingAreaSuggestion(types) {
  return Array.isArray(types) && types.some((type) => LODGING_AREA_TYPES.has(type));
}

export function normalizeDestinationSuggestions(payload) {
  const suggestions = Array.isArray(payload?.suggestions) ? payload.suggestions : [];
  const seen = new Set();
  return suggestions.flatMap((value) => {
    const placeId = typeof value?.placeId === "string" ? value.placeId.trim() : "";
    const label = typeof value?.label === "string" ? value.label.trim() : "";
    if (!placeId || !label || seen.has(placeId)) return [];
    seen.add(placeId);
    const types = Array.isArray(value.types)
      ? [...new Set(value.types.filter((type) => typeof type === "string" && type.trim()).map((type) => type.trim()))]
      : [];
    return [{
      placeId,
      label,
      primaryText: typeof value.primaryText === "string" && value.primaryText.trim()
        ? value.primaryText.trim()
        : label,
      secondaryText: typeof value.secondaryText === "string" ? value.secondaryText.trim() : "",
      ...(types.length ? { types } : {}),
    }];
  }).slice(0, 8);
}

export async function requestDestinationSuggestions({
  csrfToken,
  destinationPlaceId,
  kind = "destination",
  locale,
  query,
  request = requestJson,
  sessionToken,
  signal,
}) {
  const normalizedQuery = normalizedDestinationQuery(query);
  if (!destinationQueryReady(normalizedQuery)) return [];
  const payload = await request("/api/destination-suggestions", {
    body: {
      ...(destinationPlaceId ? { destinationPlaceId } : {}),
      kind,
      locale,
      query: normalizedQuery,
      sessionToken,
    },
    csrfToken,
    method: "POST",
    signal,
  });
  return normalizeDestinationSuggestions(payload);
}
