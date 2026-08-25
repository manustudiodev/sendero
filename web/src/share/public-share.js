export const PUBLIC_SHARE_TOKEN_LENGTH = 43;

export function normalizePublicShareToken(value) {
  let token;
  try {
    token = decodeURIComponent(String(value || "").replace(/^#/, "")).trim();
  } catch {
    return "";
  }
  return new RegExp(`^[A-Za-z0-9_-]{${PUBLIC_SHARE_TOKEN_LENGTH}}$`).test(token) ? token : "";
}

function validItinerary(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof value.title === "string" &&
    typeof value.destination === "string" &&
    typeof value.startDate === "string" &&
    typeof value.endDate === "string" &&
    Array.isArray(value.days),
  );
}

export function publicShareFromPayload(payload, now = Date.now()) {
  const share = payload?.share;
  if (!share || !validItinerary(share.itinerary)) return null;
  if (share.expiresAt && Number(share.expiresAt) <= now) return null;
  return share;
}
