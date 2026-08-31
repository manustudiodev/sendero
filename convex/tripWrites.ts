import type { MutationCtx } from "./_generated/server";
import { canonicalLocale, DEFAULT_LOCALE } from "../shared/locale.mjs";

export function normalizeSnapshotLocale(
  snapshot: unknown,
  fallback = DEFAULT_LOCALE,
): Record<string, any> & { locale: string } {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    throw new Error("Invalid itinerary snapshot");
  }
  const itinerary = snapshot as Record<string, any>;
  return {
    ...itinerary,
    locale: canonicalLocale(itinerary.locale, fallback) as string,
  };
}

export function itineraryMetadata(snapshot: unknown) {
  const itinerary = normalizeSnapshotLocale(snapshot);
  for (const field of ["title", "destination", "startDate", "endDate"] as const) {
    if (typeof itinerary[field] !== "string" || itinerary[field].length === 0) {
      throw new Error(`Invalid itinerary ${field}`);
    }
  }
  return {
    locale: itinerary.locale as string,
    title: itinerary.title as string,
    destination: itinerary.destination as string,
    startDate: itinerary.startDate as string,
    endDate: itinerary.endDate as string,
  };
}

export function requireOperationId(operationId: string, label: string) {
  if (
    operationId.length < 8 ||
    operationId.length > 128 ||
    !/^[A-Za-z0-9._:-]+$/.test(operationId)
  ) {
    throw new Error(`Invalid ${label} operation ID`);
  }
}

export function requestFingerprint(value: unknown) {
  const serialized = JSON.stringify(value);
  let high = 0x9e3779b9;
  let low = 0x85ebca6b;
  for (let index = 0; index < serialized.length; index += 1) {
    const code = serialized.charCodeAt(index);
    high = Math.imul(high ^ code, 0x5bd1e995);
    low = Math.imul(low ^ code, 0x27d4eb2d);
  }
  high = Math.imul(high ^ (high >>> 16), 0x85ebca6b) ^ Math.imul(low ^ (low >>> 13), 0xc2b2ae35);
  low = Math.imul(low ^ (low >>> 16), 0x85ebca6b) ^ Math.imul(high ^ (high >>> 13), 0xc2b2ae35);
  return `${serialized.length}:${(high >>> 0).toString(16).padStart(8, "0")}${(low >>> 0).toString(16).padStart(8, "0")}`;
}

export async function allocateWebId(ctx: MutationCtx) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const webId = crypto.randomUUID().replace(/-/g, "");
    const existing = await ctx.db
      .query("trips")
      .withIndex("by_web_id", (q) => q.eq("webId", webId))
      .unique();
    if (!existing) return webId;
  }
  throw new Error("Unable to allocate a unique trip web ID");
}
