import assert from "node:assert/strict";
import test from "node:test";
import {
  SharedTripCompanionError,
  buildSharedTripProjection,
  createSharedTripFacade,
  decorateSharedItinerary,
  siteToolErrorResult,
} from "./src/share/shared-trip-companion.js";

function sharedTrip({ timezone = "America/Argentina/Buenos_Aires" } = {}) {
  return {
    sourceVersion: 7,
    generation: 2,
    publishedAt: Date.parse("2027-08-01T12:00:00Z"),
    updatedAt: Date.parse("2027-08-02T12:00:00Z"),
    itinerary: {
      schemaVersion: 1,
      locale: "es-AR",
      title: "Buenos Aires entre amigos",
      destination: "Buenos Aires, Argentina",
      startDate: "2027-08-13",
      endDate: "2027-08-14",
      ...(timezone ? { timezone } : {}),
      days: [
        {
          date: "2027-08-13",
          title: "Museos y cafés",
          area: "Palermo",
          activities: [
            {
              startTime: "09:00",
              endTime: "10:00",
              title: "Desayuno",
              category: "meal",
              location: { name: "Café público", address: "Calle Pública 1" },
            },
            {
              startTime: "10:45",
              endTime: "11:15",
              title: "Paseo corto",
              category: "activity",
              location: { name: "Plaza pública" },
            },
            {
              startTime: "11:30",
              endTime: "13:00",
              title: "MALBA",
              category: "museum",
              booking: { required: true, confirmed: false },
              location: {
                name: "MALBA",
                address: "Av. Figueroa Alcorta 3415",
                latitude: -34.5768,
                longitude: -58.4034,
              },
            },
          ],
        },
        {
          date: "2027-08-14",
          title: "Día libre",
          area: "San Telmo",
          activities: [],
        },
      ],
    },
  };
}

test("builds one agent-ready projection with public IDs and version metadata", () => {
  const share = sharedTrip();
  const projection = buildSharedTripProjection(share);
  assert.deepEqual(projection.trip, {
    publicId: "current-shared-trip",
    title: "Buenos Aires entre amigos",
    destinationLabel: "Buenos Aires, Argentina",
    timezone: "America/Argentina/Buenos_Aires",
    startDate: "2027-08-13",
    endDate: "2027-08-14",
    publicVersion: "7.2",
    updatedAt: "2027-08-02T12:00:00.000Z",
  });
  assert.deepEqual(
    projection.days[0].items.map((item) => item.publicItemId),
    [
      "2027-08-13:activity:1",
      "2027-08-13:activity:2",
      "2027-08-13:activity:3",
    ],
  );
  assert.deepEqual(projection.days[0].items[2].booking, { required: true, confirmed: false });
  assert.equal(projection.capabilities.canonicalWriteAccess, false);
});

test("decorates a legacy publication without mutating its canonical itinerary", () => {
  const share = sharedTrip();
  const before = structuredClone(share.itinerary);
  const decorated = decorateSharedItinerary(share.itinerary);
  assert.equal(decorated.days[0].activities[0].publicId, "2027-08-13:activity:1");
  assert.deepEqual(share.itinerary, before);
});

test("reads context and a day without enabling canonical writes", () => {
  const facade = createSharedTripFacade(sharedTrip());
  const context = facade.getContext();
  assert.equal(context.trip.publicVersion, "7.2");
  assert.deepEqual(context.permissions, {
    view: true,
    changeLocalView: true,
    modifyCanonicalTrip: false,
  });
  const day = facade.getDay("2027-08-13");
  assert.equal(day.items.length, 3);
  assert.deepEqual(day.warnings, []);
});

test("applies a deterministic guest arrival preview only to local view state", () => {
  const share = sharedTrip();
  const before = structuredClone(share);
  const states = [];
  const facade = createSharedTripFacade(share, {
    now: () => Date.parse("2027-08-03T10:00:00Z"),
    onStateChange: (state) => states.push(state),
  });
  const preview = facade.previewGuestArrival({
    date: "2027-08-13",
    arrivalLocalTime: "10:30",
    readyAfterMinutes: 30,
    originLabel: "Aeroparque",
  });
  assert.equal(preview.availableFrom, "2027-08-13T11:00:00");
  assert.equal(preview.originLabel, "Aeroparque");
  assert.deepEqual(preview.missedItemIds, ["2027-08-13:activity:1"]);
  assert.deepEqual(preview.unreachableItemIds, ["2027-08-13:activity:2"]);
  assert.deepEqual(preview.reachableItemIds, ["2027-08-13:activity:3"]);
  assert.equal(preview.earliestJoinableItem.publicItemId, "2027-08-13:activity:3");
  assert.equal(preview.confidence, "schedule_only");
  assert.equal(preview.canonicalTripChanged, false);
  assert.deepEqual(share, before);
  assert.equal(states.at(-1).activeView, "routes");
  assert.equal(states.at(-1).meetingPointItemId, "2027-08-13:activity:3");
});

test("represents readiness after midnight without inventing a same-day time", () => {
  const facade = createSharedTripFacade(sharedTrip());
  const preview = facade.previewGuestArrival({
    date: "2027-08-13",
    arrivalLocalTime: "23:30",
    readyAfterMinutes: 120,
  });
  assert.equal(preview.availableFrom, "2027-08-14T01:30:00");
  assert.equal(preview.earliestJoinableItem, undefined);
});

test("keeps empty days and clear idempotent", () => {
  const facade = createSharedTripFacade(sharedTrip());
  const preview = facade.previewGuestArrival({
    date: "2027-08-14",
    arrivalLocalTime: "12:00",
    readyAfterMinutes: 0,
  });
  assert.deepEqual(preview.reachableItemIds, []);
  assert.equal(preview.earliestJoinableItem, undefined);
  assert.equal(facade.clearGuestPreview().canonicalTripChanged, false);
  assert.equal(facade.clearGuestPreview().canonicalTripChanged, false);
  assert.equal(facade.getViewState().guestPreview, null);
});

test("rejects invalid dates, items, times, delays, and missing timezone without changing state", () => {
  const facade = createSharedTripFacade(sharedTrip());
  const initial = facade.getViewState();
  assert.throws(() => facade.getDay("2027-08-20"), { code: "DATE_OUTSIDE_TRIP" });
  assert.throws(() => facade.focusItem("#private-selector"), { code: "ITEM_NOT_FOUND" });
  assert.throws(() => facade.previewGuestArrival({
    date: "2027-08-13",
    arrivalLocalTime: "25:00",
    readyAfterMinutes: 30,
  }), { code: "INVALID_LOCAL_TIME" });
  assert.throws(() => facade.previewGuestArrival({
    date: "2027-08-13",
    arrivalLocalTime: "10:00",
    readyAfterMinutes: 721,
  }), { code: "INVALID_READY_AFTER_MINUTES" });
  assert.deepEqual(facade.getViewState(), initial);

  const legacy = createSharedTripFacade(sharedTrip({ timezone: "" }));
  assert.equal(legacy.getProjection().capabilities.guestArrivalPreview, false);
  assert.throws(() => legacy.previewGuestArrival({
    date: "2027-08-13",
    arrivalLocalTime: "10:00",
    readyAfterMinutes: 30,
  }), { code: "TIMEZONE_UNAVAILABLE" });
});

test("returns compact site-tool errors without stacks or source data", () => {
  const error = new SharedTripCompanionError("ITEM_NOT_FOUND", "That item is not public.");
  const result = siteToolErrorResult(error, "7.2");
  assert.deepEqual(result, {
    ok: false,
    error: {
      code: "ITEM_NOT_FOUND",
      message: "That item is not public.",
      retryable: false,
      currentPublicVersion: "7.2",
    },
  });
  assert.equal("stack" in result.error, false);
});
