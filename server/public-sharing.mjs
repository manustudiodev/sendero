import { createHash, createHmac, randomBytes } from "node:crypto";

export const PUBLIC_SHARE_TOKEN_BYTES = 32;
export const PUBLIC_SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const PUBLIC_SHARE_HASH_DOMAIN = "sendero-share:v1:";
export const PUBLIC_SHARE_DERIVATION_DOMAIN = "sendero-share-token:v1";
export const DEFAULT_PUBLIC_SHARE_DAYS = 30;
export const MIN_PUBLIC_SHARE_DAYS = 1;
export const MAX_PUBLIC_SHARE_DAYS = 365;

export function generatePublicShareToken() {
  return randomBytes(PUBLIC_SHARE_TOKEN_BYTES).toString("base64url");
}

export function derivePublicShareToken({ secret, purpose, tripId, operationId }) {
  if (typeof secret !== "string" || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("SENDERO_SHARE_SECRET must contain at least 32 bytes.");
  }
  if (purpose !== "publish" && purpose !== "rotate") {
    throw new Error("Public share token purpose must be publish or rotate.");
  }
  if (typeof tripId !== "string" || tripId.length < 1 || tripId.length > 128) {
    throw new Error("A valid trip ID is required to derive a public share token.");
  }
  if (
    typeof operationId !== "string" ||
    !/^[A-Za-z0-9._:-]{8,128}$/.test(operationId)
  ) {
    throw new Error("A valid operation ID is required to derive a public share token.");
  }

  const message = JSON.stringify([
    PUBLIC_SHARE_DERIVATION_DOMAIN,
    purpose,
    tripId,
    operationId,
  ]);
  return createHmac("sha256", secret).update(message, "utf8").digest("base64url");
}

export function isValidPublicShareToken(token) {
  return typeof token === "string" && PUBLIC_SHARE_TOKEN_PATTERN.test(token);
}

export function validatePublicShareToken(token) {
  if (!isValidPublicShareToken(token)) {
    throw new Error("Invalid Sendero public share token.");
  }
  return token;
}

export function hashPublicShareToken(token) {
  return createHash("sha256")
    .update(`${PUBLIC_SHARE_HASH_DOMAIN}${validatePublicShareToken(token)}`, "utf8")
    .digest("base64url");
}

export function publicShareExpiresAt(days = DEFAULT_PUBLIC_SHARE_DAYS, now = Date.now()) {
  if (!Number.isInteger(days) || days < MIN_PUBLIC_SHARE_DAYS || days > MAX_PUBLIC_SHARE_DAYS) {
    throw new Error(
      `Public share expiration must be between ${MIN_PUBLIC_SHARE_DAYS} and ${MAX_PUBLIC_SHARE_DAYS} days.`,
    );
  }
  return now + days * 24 * 60 * 60 * 1000;
}

export function buildPublicShareUrl({ baseUrl, token }) {
  const validatedToken = validatePublicShareToken(token);
  let url;
  try {
    url = new URL("/share", baseUrl);
  } catch {
    throw new Error("PUBLIC_WEB_URL must be an absolute URL.");
  }
  const localHttp =
    url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if (url.protocol !== "https:" && !localHttp) {
    throw new Error("PUBLIC_WEB_URL must use HTTPS outside local development.");
  }
  if (url.username || url.password) {
    throw new Error("PUBLIC_WEB_URL must not include credentials.");
  }
  url.hash = validatedToken;
  return url.toString();
}
