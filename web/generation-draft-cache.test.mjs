import assert from "node:assert/strict";
import test from "node:test";
import {
  ACTIVE_DRAFT_QUERY_KEY,
  activeDraftView,
  cacheActiveDraft,
  clearActiveDraft,
  hydrateActiveDraft,
  readActiveDraftCache,
  updateActiveDraftReservationStatus,
} from "./src/generate/draft-cache.js";

function fixture() {
  const values = new Map();
  const queries = new Map();
  return {
    storage: {
      getItem(key) { return values.get(key) ?? null; },
      removeItem(key) { values.delete(key); },
      setItem(key, value) { values.set(key, value); },
    },
    queryClient: {
      getQueryData(key) { return queries.get(JSON.stringify(key)); },
      setQueryData(key, value) { queries.set(JSON.stringify(key), value); },
    },
    values,
  };
}

test("persists a validated anonymous draft across browser sessions and the OAuth round trip", () => {
  const { queryClient, storage } = fixture();
  const entry = {
    view: {
      draftId: "browser_12345678901234567890123456789012",
      status: "valid",
      itinerary: { title: "Valencia a pie" },
    },
    saveInput: { operationId: "sendero-stage:test" },
  };
  cacheActiveDraft(queryClient, entry, { storage });
  assert.deepEqual(readActiveDraftCache({ storage, now: Date.UTC(2037, 3, 10) }), entry);

  const restoredClient = fixture().queryClient;
  hydrateActiveDraft(restoredClient, { storage, now: Date.UTC(2027, 3, 10) });
  assert.deepEqual(restoredClient.getQueryData(ACTIVE_DRAFT_QUERY_KEY), entry);
  assert.deepEqual(activeDraftView(entry), entry.view);
});

test("keeps browser drafts without a time limit and removes terminal or expired server drafts", () => {
  const { queryClient, storage, values } = fixture();
  cacheActiveDraft(queryClient, {
    view: {
      draftId: "browser_12345678901234567890123456789012",
      status: "valid",
      expiresAt: 10,
    },
    saveInput: { operationId: "sendero-stage:test" },
  }, { storage });
  assert.equal(readActiveDraftCache({ storage, now: 11 })?.view.draftId, "browser_12345678901234567890123456789012");

  cacheActiveDraft(queryClient, {
    view: {
      draftId: "draft_1234567890123456",
      status: "valid",
      expiresAt: 10,
    },
    saveInput: { operationId: "sendero-stage:test" },
  }, { storage });
  assert.equal(readActiveDraftCache({ storage, now: 11 }), null);
  assert.equal(values.size, 0);

  cacheActiveDraft(queryClient, {
    view: { draftId: "draft_1234567890123456", status: "saved" },
    saveInput: null,
  }, { persist: false, storage });
  assert.equal(values.size, 0);
  assert.equal(queryClient.getQueryData(ACTIVE_DRAFT_QUERY_KEY).view.status, "saved");

  clearActiveDraft(queryClient, { storage });
  assert.equal(queryClient.getQueryData(ACTIVE_DRAFT_QUERY_KEY), null);
});

test("updates reservation status in both the local preview and its eventual save payload", () => {
  const { queryClient, storage } = fixture();
  cacheActiveDraft(queryClient, {
    view: {
      draftId: "browser_12345678901234567890123456789012",
      status: "valid",
      itinerary: {
        days: [{
          date: "2027-04-10",
          activities: [{ id: "alcazar", reservation: { status: "pending" } }],
        }],
      },
    },
    saveInput: {
      itinerary: {
        days: [{
          date: "2027-04-10",
          activities: [{ id: "alcazar", reservation: { status: "pending" } }],
        }],
      },
    },
  }, { storage });

  updateActiveDraftReservationStatus(queryClient, {
    activityId: "alcazar",
    dayDate: "2027-04-10",
    status: "confirmed",
  }, { storage });

  const cached = queryClient.getQueryData(ACTIVE_DRAFT_QUERY_KEY);
  assert.equal(cached.view.itinerary.days[0].activities[0].reservation.status, "confirmed");
  assert.equal(cached.saveInput.itinerary.days[0].activities[0].reservation.status, "confirmed");
  assert.equal(readActiveDraftCache({ storage }).view.itinerary.days[0].activities[0].reservation.status, "confirmed");
});
