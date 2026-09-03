import assert from "node:assert/strict";
import test from "node:test";
import {
  contextualItineraryTitle,
  hasReservationManagement,
  reservationEntryKey,
  reservationNavigationLabel,
  reservationPresentation,
} from "./src/itinerary/presentation-utils.js";

test("removes a redundant destination prefix while preserving the contextual title", () => {
  assert.equal(
    contextualItineraryTitle("Ciudad de México — local, diseño y música", "Ciudad de México, México"),
    "Local, diseño y música",
  );
  assert.equal(
    contextualItineraryTitle("Mercados, diseño y música", "Ciudad de México, México"),
    "Mercados, diseño y música",
  );
  assert.equal(
    contextualItineraryTitle("Buenos Aires entre clásicos y barrios", "Buenos Aires, Argentina"),
    "Entre clásicos y barrios",
  );
});

test("separates booking requirement from lifecycle status", () => {
  const view = reservationPresentation({
    activity: { category: "restaurant", title: "Cena de Nochebuena" },
    reservation: { requirement: "optional", status: "confirmed" },
  });
  assert.equal(view.requirementLabel, "Optional reservation");
  assert.equal(view.statusLabel, "Booked");
  assert.deepEqual(view.nextAction, { label: "I haven't reserved yet", status: "pending" });
});

test("uses ticket language for museums and concerts", () => {
  const pending = reservationPresentation({
    activity: { category: "museum", title: "Museo Nacional" },
    reservation: { status: "pending" },
  });
  assert.equal(pending.kind, "ticket");
  assert.equal(pending.requirementLabel, "Ticket required");
  assert.equal(pending.statusLabel, "To purchase");
  assert.deepEqual(pending.nextAction, { label: "I've purchased", status: "confirmed" });

  const purchased = reservationPresentation({
    activity: { category: "museum", title: "Museo Nacional" },
    reservation: { status: "confirmed" },
  });
  assert.deepEqual(purchased.nextAction, { label: "I haven't purchased yet", status: "pending" });

  const cancelled = reservationPresentation({
    activity: { category: "music", title: "Concierto en vivo" },
    reservation: { kind: "ticket", status: "cancelled" },
  });
  assert.deepEqual(cancelled.nextAction, { label: "I've purchased", status: "confirmed" });
});

test("uses the same reservation eligibility for itinerary links and the reservations view", () => {
  for (const status of ["suggested", "pending", "confirmed", "cancelled"]) {
    assert.equal(hasReservationManagement({ reservation: { status } }), true);
  }
  assert.equal(hasReservationManagement({ reservation: { status: "not_needed" } }), false);
  assert.equal(hasReservationManagement({}), false);
});

test("builds a stable reservation target from the day and activity", () => {
  assert.equal(reservationEntryKey("2026-08-13", "tortoni"), "2026-08-13:tortoni");
  assert.equal(reservationEntryKey("", "tortoni"), "");
  assert.equal(reservationEntryKey("2026-08-13", ""), "");
});

test("reservation navigation labels distinguish tickets and reservations", () => {
  assert.equal(
    reservationNavigationLabel({
      activity: { title: "Café Tortoni" },
      reservation: { kind: "reservation", requirement: "optional", status: "pending" },
    }),
    "Open in Reservations: optional reservation for Café Tortoni",
  );
  assert.equal(
    reservationNavigationLabel({
      activity: { title: "Teatro Colón" },
      reservation: { kind: "ticket", requirement: "required", status: "pending" },
    }),
    "Open in Reservations: ticket required for Teatro Colón",
  );
});

test("localizes reservation presentation and navigation without changing proper names", () => {
  const entry = {
    activity: { category: "museum", title: "Museo Nacional de Antropología" },
    reservation: { kind: "ticket", requirement: "recommended", status: "pending" },
  };
  const english = reservationPresentation(entry, "en-US");
  assert.equal(english.requirementLabel, "Recommended ticket");
  assert.equal(english.statusLabel, "To purchase");
  assert.deepEqual(english.nextAction, { label: "I've purchased", status: "confirmed" });
  assert.equal(
    reservationNavigationLabel(entry, "en-US"),
    "Open in Reservations: recommended ticket for Museo Nacional de Antropología",
  );

  const portuguese = reservationPresentation(entry, "pt-BR");
  assert.equal(portuguese.requirementLabel, "Ingresso recomendado");
  assert.equal(portuguese.statusLabel, "A comprar");
  assert.deepEqual(portuguese.nextAction, { label: "Já comprei", status: "confirmed" });
});
