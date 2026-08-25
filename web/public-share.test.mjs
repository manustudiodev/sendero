import assert from "node:assert/strict";
import test from "node:test";
import {
  activeShareAction,
  previewShareAction,
  shareConversationContext,
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
  assert.deepEqual(publicShareFromPayload(active, 20), active.share);
  assert.equal(publicShareFromPayload(active, 30), null);
  assert.equal(publicShareFromPayload({ share: { itinerary: { title: "Incomplete" } } }, 20), null);
  assert.equal(publicShareFromPayload({}, 20), null);
});

test("routes public-share component choices once with the complete private context", () => {
  const output = {
    state: "preview",
    action: "update",
    itinerary,
    tripId: "trip_private_123",
    operationId: "sendero-share:operation-123",
    expectedVersion: 4,
    expiresInDays: 30,
    proposedExpiresAt: 1_800_000_000_000,
  };
  assert.deepEqual(previewShareAction(output), {
    disabled: false,
    intent: "update_public_share",
    label: "Actualizar publicación",
  });
  assert.equal(previewShareAction({ ...output, itinerary: undefined }).disabled, true);
  assert.deepEqual(activeShareAction({ isStale: true }), {
    intent: "preview_public_share",
    label: "Revisar cambios",
  });
  assert.deepEqual(activeShareAction({ isStale: false }), {
    intent: "rotate_public_share",
    label: "Reemplazar enlace",
  });
  assert.deepEqual(
    shareConversationContext(output, "update_public_share", itinerary.title),
    {
      intent: "update_public_share",
      tripId: "trip_private_123",
      operationId: "sendero-share:operation-123",
      expectedVersion: 4,
      proposedExpiresAt: 1_800_000_000_000,
      tripTitle: itinerary.title,
    },
  );
});
