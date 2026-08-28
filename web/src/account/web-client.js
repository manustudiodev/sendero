const ROLE_VALUES = new Set(["owner", "editor", "viewer"]);

function unwrapData(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  return payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
    ? payload.data
    : payload;
}

function stringValue(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function roleValue(value) {
  return ROLE_VALUES.has(value) ? value : "viewer";
}

export class WebApiError extends Error {
  constructor({ code = "temporarily_unavailable", message, retryable = false, status = 0 } = {}) {
    super(message || "No pudimos completar la solicitud.");
    this.name = "WebApiError";
    this.code = code;
    this.retryable = Boolean(retryable);
    this.status = status;
  }
}

export async function requestJson(path, {
  body,
  csrfToken,
  method = "GET",
  signal,
} = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (csrfToken) headers["X-CSRF-Token"] = csrfToken;

  const response = await fetch(path, {
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
    credentials: "same-origin",
    headers,
    method,
    referrerPolicy: "same-origin",
    signal,
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  if (response.ok) return unwrapData(payload);

  const failure = payload?.error && typeof payload.error === "object"
    ? payload.error
    : payload;
  throw new WebApiError({
    code: stringValue(failure?.code) || (response.status === 401 ? "unauthenticated" : "temporarily_unavailable"),
    message: stringValue(failure?.message),
    retryable: failure?.retryable ?? response.status >= 500,
    status: response.status,
  });
}

export function normalizeSession(payload) {
  const value = unwrapData(payload);
  if (value.authenticated === false || !value.user) {
    return {
      authenticated: false,
      loginUrl: stringValue(value.loginUrl),
    };
  }
  const user = value.user;
  return {
    authenticated: true,
    csrfToken: stringValue(value.csrfToken),
    expiresAt: stringValue(value.expiresAt),
    user: {
      id: stringValue(user.id || user.subject),
      email: stringValue(user.email),
      emailVerified: user.emailVerified === true,
      name: stringValue(user.name),
    },
  };
}

export function normalizeTripSummary(value) {
  if (!value || typeof value !== "object") return null;
  const webId = stringValue(value.webId);
  const title = stringValue(value.title);
  if (!webId || !title) return null;
  return {
    webId,
    title,
    destination: stringValue(value.destination),
    startDate: stringValue(value.startDate),
    endDate: stringValue(value.endDate),
    role: roleValue(value.role),
    updatedAt: stringValue(value.updatedAt),
  };
}

export function normalizeTrips(payload) {
  const value = unwrapData(payload);
  const trips = Array.isArray(value.trips) ? value.trips : [];
  return trips.map(normalizeTripSummary).filter(Boolean);
}

export function normalizeRestrictedTrip(payload) {
  const value = unwrapData(payload);
  const trip = value.trip && typeof value.trip === "object" ? value.trip : value;
  if (!trip.itinerary || typeof trip.itinerary !== "object") return null;
  const webId = stringValue(trip.webId);
  if (!webId) return null;
  const role = roleValue(trip.role);
  const hasExplicitPermissions = Boolean(
    trip.permissions
    && typeof trip.permissions === "object"
    && !Array.isArray(trip.permissions),
  );
  const permissions = hasExplicitPermissions
    ? trip.permissions
    : {};
  return {
    webId,
    role,
    version: Number.isInteger(trip.version) ? trip.version : Number(trip.version) || 0,
    updatedAt: stringValue(trip.updatedAt),
    itinerary: trip.itinerary,
    permissions: {
      editInSendero: hasExplicitPermissions
        ? permissions.editInSendero === true
        : role === "owner" || role === "editor",
      manageAccess: hasExplicitPermissions
        ? permissions.manageAccess === true
        : role === "owner",
      publish: hasExplicitPermissions
        ? permissions.publish === true
        : role === "owner",
      updateReservationStatus: hasExplicitPermissions
        ? permissions.updateReservationStatus === true
        : role === "owner" || role === "editor",
      view: hasExplicitPermissions ? permissions.view === true : true,
    },
  };
}

function normalizeAccessEntry(value, kind) {
  if (!value || typeof value !== "object") return null;
  const id = stringValue(value.id);
  if (!id) return null;
  const delivery = value.delivery && typeof value.delivery === "object"
    ? {
        attemptCount: Number.isInteger(value.delivery.attemptCount)
          ? value.delivery.attemptCount
          : 0,
        lastErrorCode: stringValue(value.delivery.lastErrorCode),
        maxAttempts: Number.isInteger(value.delivery.maxAttempts)
          ? value.delivery.maxAttempts
          : 0,
        providerEvent: stringValue(value.delivery.providerEvent),
        status: stringValue(value.delivery.status),
        updatedAt: Number.isFinite(value.delivery.updatedAt)
          ? value.delivery.updatedAt
          : 0,
      }
    : null;
  return {
    ...(delivery?.status ? { delivery } : {}),
    id,
    email: stringValue(value.email),
    expiresAt: stringValue(value.expiresAt),
    kind,
    name: stringValue(value.name),
    role: roleValue(value.role),
    status: stringValue(value.status)
      || (kind === "invitation"
        ? "pending"
        : kind === "legacy_invitation"
          ? "legacy_pending"
          : "accepted"),
  };
}

export function normalizeTripAccess(payload) {
  const value = unwrapData(payload);
  return {
    generalAccess: value.generalAccess?.mode === "public_link" ? "public_link" : "restricted",
    invitations: (Array.isArray(value.invitations) ? value.invitations : [])
      .map((entry) => normalizeAccessEntry(entry, "invitation"))
      .filter(Boolean),
    legacyInvitations: (Array.isArray(value.legacyInvitations) ? value.legacyInvitations : [])
      .map((entry) => normalizeAccessEntry(entry, "legacy_invitation"))
      .filter(Boolean),
    members: (Array.isArray(value.members) ? value.members : [])
      .map((entry) => normalizeAccessEntry(entry, "member"))
      .filter(Boolean),
    owner: value.owner && typeof value.owner === "object" ? {
      email: stringValue(value.owner.email),
      name: stringValue(value.owner.name),
    } : null,
  };
}

export function operationId(prefix = "web") {
  const random = globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `sendero-${prefix}:${random}`;
}

export function createStableOperationRegistry({ createId = operationId } = {}) {
  const entries = new Map();
  return {
    begin(key, expectedVersion, prefix = "web") {
      const existing = entries.get(key);
      if (existing) return existing;
      const next = { expectedVersion, operationId: createId(prefix) };
      entries.set(key, next);
      return next;
    },
    clear(key) {
      entries.delete(key);
    },
  };
}

export function safeReturnTo(value, fallback = "/app") {
  const candidate = stringValue(value);
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return fallback;
  }
  return candidate;
}

export function loginUrl(session, returnTo, { reauthenticate = false } = {}) {
  const safeDestination = safeReturnTo(returnTo);
  const fallbackParams = new URLSearchParams({ returnTo: safeDestination });
  if (reauthenticate) fallbackParams.set("reauth", "1");
  const fallback = `/auth/login?${fallbackParams.toString()}`;
  const candidate = stringValue(session?.loginUrl);
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return fallback;
  }
  try {
    const url = new URL(candidate, "https://sendero.invalid");
    url.searchParams.set("returnTo", safeDestination);
    if (reauthenticate) url.searchParams.set("reauth", "1");
    else url.searchParams.delete("reauth");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function readableTripDates(startDate, endDate, locale = "es") {
  if (!startDate || !endDate) return "Fechas por confirmar";
  try {
    const formatter = new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
    return `${formatter.format(new Date(`${startDate}T00:00:00Z`))} — ${formatter.format(new Date(`${endDate}T00:00:00Z`))}`;
  } catch {
    return `${startDate} — ${endDate}`;
  }
}
