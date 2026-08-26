import assert from "node:assert/strict";
import test from "node:test";
import {
  contextualItineraryTitle,
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
