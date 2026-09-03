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
