export const ACTIVE_DRAFT_QUERY_KEY = Object.freeze([
  "sendero",
  "itinerary-generation",
  "active-draft",
]);

const STORAGE_KEY = "sendero:itinerary-generation:active-draft:v1";

function browserStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function validEntry(value, now = Date.now()) {
  const draft = value?.view;
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) return null;
  if (typeof draft.draftId !== "string" || !draft.draftId.trim()) return null;
  if (draft.status === "expired" || draft.status === "discarded") return null;
  const isBrowserDraft = draft.draftId.startsWith("browser_");
  if (
    !isBrowserDraft &&
    Number.isFinite(Number(draft.expiresAt)) &&
    Number(draft.expiresAt) <= now
  ) return null;
  return {
    view: draft,
    saveInput: value.saveInput && typeof value.saveInput === "object"
      ? value.saveInput
      : null,
  };
}

export function readActiveDraftCache({ storage = browserStorage(), now = Date.now() } = {}) {
  if (!storage) return null;
  try {
    const entry = validEntry(JSON.parse(storage.getItem(STORAGE_KEY) || "null"), now);
    if (!entry) storage.removeItem(STORAGE_KEY);
    return entry;
  } catch {
    try { storage.removeItem(STORAGE_KEY); } catch {}
    return null;
  }
}

export function cacheActiveDraft(queryClient, entry, {
  persist = Boolean(entry?.saveInput),
  storage = browserStorage(),
} = {}) {
  const normalized = validEntry(entry);
  queryClient.setQueryData(ACTIVE_DRAFT_QUERY_KEY, normalized);
  if (!storage) return normalized;
  try {
    if (persist && normalized) storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    else storage.removeItem(STORAGE_KEY);
  } catch {}
  return normalized;
}

export function clearActiveDraft(queryClient, { storage = browserStorage() } = {}) {
  queryClient.setQueryData(ACTIVE_DRAFT_QUERY_KEY, null);
  try { storage?.removeItem(STORAGE_KEY); } catch {}
}

export function hydrateActiveDraft(queryClient, options) {
  const entry = readActiveDraftCache(options);
  queryClient.setQueryData(ACTIVE_DRAFT_QUERY_KEY, entry);
  return entry;
}

export function activeDraftView(entry) {
  return validEntry(entry)?.view || null;
}

const RESERVATION_STATUSES = new Set(["pending", "confirmed"]);

function draftCacheError(code, details) {
  const error = new Error(code);
  error.code = code;
  if (details) error.details = details;
  return error;
}

function reservationUpdateKey({ activityId, dayDate }) {
  return `${dayDate}\u0000${activityId}`;
}

function normalizedReservationUpdates(updates) {
  if (!Array.isArray(updates) || updates.length === 0) {
    throw draftCacheError("reservation_updates_required");
  }
  const byTarget = new Map();
  for (const update of updates) {
    const activityId = typeof update?.activityId === "string" ? update.activityId.trim() : "";
    const dayDate = typeof update?.dayDate === "string" ? update.dayDate.trim() : "";
    const status = update?.status;
    if (!activityId || !/^\d{4}-\d{2}-\d{2}$/.test(dayDate) || !RESERVATION_STATUSES.has(status)) {
      throw draftCacheError("reservation_update_invalid");
    }
    const normalized = { activityId, dayDate, status };
    const key = reservationUpdateKey(normalized);
    if (byTarget.has(key)) throw draftCacheError("duplicate_reservation_update");
    byTarget.set(key, normalized);
  }
  return byTarget;
}

function itineraryWithReservationStatuses(itinerary, updates) {
  const remaining = normalizedReservationUpdates(updates);
  const days = (itinerary?.days || []).map((day) => {
    const activities = (day.activities || []).map((activity) => {
      const key = reservationUpdateKey({ activityId: activity.id, dayDate: day.date });
      const update = remaining.get(key);
      if (!update || !activity.reservation) return activity;
      remaining.delete(key);
      return {
        ...activity,
        reservation: { ...activity.reservation, status: update.status },
      };
    });
    return { ...day, activities };
  });
  if (remaining.size) {
    const missing = [...remaining.values()].map(({ activityId, dayDate }) => ({ activityId, dayDate }));
    throw draftCacheError("reservation_not_found", { missing });
  }
  return { ...itinerary, days };
}

export function updateActiveDraftReservationStatuses(queryClient, updates, {
  storage = browserStorage(),
} = {}) {
  const entry = validEntry(queryClient.getQueryData(ACTIVE_DRAFT_QUERY_KEY));
  if (!entry) throw draftCacheError("draft_not_found");
  const itinerary = entry.view.itinerary || entry.view.trip?.itinerary;
  if (!itinerary) throw draftCacheError("itinerary_not_found");
  const nextItinerary = itineraryWithReservationStatuses(itinerary, updates);
  const view = entry.view.itinerary
    ? { ...entry.view, itinerary: nextItinerary }
    : { ...entry.view, trip: { ...entry.view.trip, itinerary: nextItinerary } };
  const saveInput = entry.saveInput?.itinerary
    ? { ...entry.saveInput, itinerary: nextItinerary }
    : entry.saveInput;
  return cacheActiveDraft(queryClient, { view, saveInput }, {
    persist: Boolean(saveInput),
    storage,
  });
}

export function updateActiveDraftReservationStatus(queryClient, update, options) {
  return updateActiveDraftReservationStatuses(queryClient, [update], options);
}
