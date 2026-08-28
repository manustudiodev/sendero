function valueString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function inviteTokenFromHash(hash = "") {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);
  const token = valueString(params.get("token") || params.get("invite"));
  return /^[A-Za-z0-9._~-]{24,2048}$/.test(token) ? token : "";
}

export function urlWithoutFragment(locationLike) {
  return `${locationLike?.pathname || "/invite"}${locationLike?.search || ""}`;
}

export function invitationWebId(locationLike = globalThis.location) {
  const match = locationLike?.pathname?.match(/^\/invite\/([^/?#]+)/);
  try {
    return match ? decodeURIComponent(match[1]) : "";
  } catch {
    return "";
  }
}

export function formatInvitationExpiry(expiresAt, locale = "es") {
  if (!valueString(expiresAt)) return "Sin fecha disponible";
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return "Sin fecha disponible";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function normalizeInvitationInspection(payload) {
  const value = payload?.data && typeof payload.data === "object" ? payload.data : payload || {};
  const supportedStates = new Set(["ready", "signed_out", "email_mismatch", "email_unverified", "unavailable"]);
  const state = supportedStates.has(value.state) ? value.state : "unavailable";
  const invitation = value.invitation && typeof value.invitation === "object" ? value.invitation : {};
  return {
    state,
    invitation: {
      destination: valueString(invitation.destination),
      expiresAt: valueString(invitation.expiresAt),
      invitedEmail: valueString(invitation.invitedEmail),
      inviterName: valueString(invitation.inviterName),
      role: invitation.role === "editor" ? "editor" : "viewer",
      title: valueString(invitation.title) || "Viaje compartido",
      webId: valueString(invitation.webId),
    },
  };
}
