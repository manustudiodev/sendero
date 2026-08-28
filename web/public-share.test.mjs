import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  hasPublicShareResultActions,
  publicSharePresentation,
} from "./src/share-control/share-control.js";
import { normalizePublicShareToken, publicShareFromPayload } from "./src/share/public-share.js";

const validToken = "A".repeat(43);
const itinerary = {
  title: "Buenos Aires entre clásicos y barrios",
  destination: "Buenos Aires",
  startDate: "2026-08-13",
  endDate: "2026-08-15",
  days: [],
};

test("accepts only a 43-character base64url public share token", () => {
  assert.equal(normalizePublicShareToken(`#${validToken}`), validToken);
  assert.equal(normalizePublicShareToken("A".repeat(42)), "");
  assert.equal(normalizePublicShareToken("A".repeat(44)), "");
  assert.equal(normalizePublicShareToken(`${"A".repeat(42)}+`), "");
  assert.equal(normalizePublicShareToken(`${"A".repeat(42)}/`), "");
});

test("accepts the exact public share response and rejects expired or malformed data", () => {
  const active = { share: { itinerary, publishedAt: 10, expiresAt: 30 } };
  assert.deepEqual(publicShareFromPayload(active, 20), {
    ...active.share,
    itinerary: { ...itinerary, locale: "en" },
  });
  assert.equal(publicShareFromPayload(active, 30), null);
  assert.equal(publicShareFromPayload({ share: { itinerary: { title: "Incomplete" } } }, 20), null);
  assert.equal(publicShareFromPayload({}, 20), null);
});

test("keeps public-share states presentational and exposes link actions only for results", () => {
  assert.deepEqual(publicSharePresentation({
    state: "active",
    isStale: true,
    publishedVersion: 3,
    currentVersion: 4,
  }), {
    eyebrow: "Active link",
    title: "There are unpublished changes",
    detail: "The link shows version 3; your trip is now on version 4.",
  });
  assert.deepEqual(publicSharePresentation({ state: "published" }), {
    eyebrow: "Link unavailable",
    title: "We couldn't show the link",
    detail: "The operation finished, but we did not receive a valid link. Try the request again from the conversation.",
  });
  assert.equal(hasPublicShareResultActions({ state: "preview", publicUrl: "https://example.com" }), false);
  assert.equal(hasPublicShareResultActions({ state: "active", publicUrl: "https://example.com" }), true);
  assert.equal(hasPublicShareResultActions({ state: "published" }), false);
  assert.equal(hasPublicShareResultActions({ state: "published", publicUrl: "https://example.com" }), true);
  assert.equal(hasPublicShareResultActions({ state: "rotated", publicUrl: "https://example.com" }), true);
});

test("keeps the inline share facade free of conversational launchers", async () => {
  const source = await readFile(new URL("./src/share-control/PublicShareControlApp.jsx", import.meta.url), "utf8");
  for (const forbidden of [
    "sendFollowUpMessage",
    "updateModelContext",
    "Revisar y compartir",
    "Crear enlace público",
    "Actualizar publicación",
    "Revisar cambios",
    "Reemplazar enlace",
    ">Revocar<",
  ]) {
    assert.equal(source.includes(forbidden), false, `unexpected conversational launcher: ${forbidden}`);
  }
  assert.equal(source.includes("Copiar enlace"), true);
  assert.equal(source.includes("Abrir"), true);
});
