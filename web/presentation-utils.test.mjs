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
  assert.equal(view.requirementLabel, "Reserva opcional");
  assert.equal(view.statusLabel, "Reservada");
  assert.deepEqual(view.nextAction, { label: "Reserva cancelada", status: "cancelled" });
});

test("uses ticket language for museums and concerts", () => {
  const pending = reservationPresentation({
    activity: { category: "museum", title: "Museo Nacional" },
    reservation: { status: "pending" },
  });
  assert.equal(pending.kind, "ticket");
  assert.equal(pending.requirementLabel, "Requiere boleto");
  assert.equal(pending.statusLabel, "Por comprar");
  assert.deepEqual(pending.nextAction, { label: "Ya compré", status: "confirmed" });

  const cancelled = reservationPresentation({
    activity: { category: "music", title: "Concierto en vivo" },
    reservation: { kind: "ticket", status: "cancelled" },
  });
  assert.deepEqual(cancelled.nextAction, { label: "Aún no compré", status: "pending" });
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
    "Abrir en Reservas: reserva opcional para Café Tortoni",
  );
  assert.equal(
    reservationNavigationLabel({
      activity: { title: "Teatro Colón" },
      reservation: { kind: "ticket", requirement: "required", status: "pending" },
    }),
    "Abrir en Reservas: requiere boleto para Teatro Colón",
  );
});
