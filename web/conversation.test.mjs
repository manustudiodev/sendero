import assert from "node:assert/strict";
import test from "node:test";
import {
  tripIntakeContinuation,
  tripRequirementsContinuation,
  tripSelectionContinuation,
} from "./src/conversation.js";

const forbiddenVisibleMechanics = /tripId|interactionId|prepare_|render_|list_|get_|\{\s*"|structuredContent|JSON/i;

const brief = {
  destination: "Buenos Aires, Argentina",
  startDate: "2027-08-13",
  endDate: "2027-08-26",
  lodging: { status: "undecided", name: "Alojamiento por definir" },
  travellers: { adults: 3, children: 0 },
  interests: ["arquitectura", "música en vivo"],
  transport: {
    modes: ["walk", "public_transit", "taxi"],
    wantsCar: false,
    hasLicense: false,
  },
};

test("keeps grouped requirements mechanics out of the visible continuation", () => {
  const continuation = tripRequirementsContinuation({
    brief,
    fields: ["destination", "startDate", "endDate", "travellers.adults", "transport.modes"],
    interactionId: "interaction-secret",
  });

  assert.doesNotMatch(continuation.visibleMessage, forbiddenVisibleMechanics);
  assert.doesNotMatch(continuation.fallbackMessage, forbiddenVisibleMechanics);
  assert.equal(continuation.visibleMessage, continuation.fallbackMessage);
  assert.match(continuation.visibleMessage, /Buenos Aires, Argentina/);
  assert.match(continuation.visibleMessage, /Aug 13, 2027/);
  assert.match(continuation.visibleMessage, /Aug 26, 2027/);
  assert.match(continuation.visibleMessage, /3 adults/);
  assert.match(continuation.visibleMessage, /on foot, public transport, and taxi or ride app/);
  assert.match(continuation.visibleMessage, /do not ask me for these details again/);
  assert.equal(continuation.context.structuredContent.sendero.stage, "brief_ready");
  assert.equal(continuation.context.structuredContent.sendero.interactionId, "interaction-secret");
  assert.deepEqual(
    continuation.context.structuredContent.sendero.completedFields,
    ["destination", "startDate", "endDate", "travellers.adults", "transport.modes"],
  );
  assert.deepEqual(
    continuation.context.structuredContent.sendero.validation,
    { ready: true, criticalFields: [] },
  );
  assert.deepEqual(continuation.context.structuredContent.sendero.brief, brief);
});

test("keeps guided intake data natural while preserving the complete brief privately", () => {
  const continuation = tripIntakeContinuation(brief);

  assert.doesNotMatch(continuation.visibleMessage, forbiddenVisibleMechanics);
  assert.doesNotMatch(continuation.fallbackMessage, forbiddenVisibleMechanics);
  assert.equal(continuation.visibleMessage, continuation.fallbackMessage);
  assert.match(continuation.visibleMessage, /Buenos Aires, Argentina/);
  assert.match(continuation.visibleMessage, /Aug 13, 2027/);
  assert.match(continuation.visibleMessage, /3 adults/);
  assert.equal(continuation.context.structuredContent.sendero.stage, "brief_ready");
  assert.deepEqual(
    continuation.context.structuredContent.sendero.validation,
    { ready: true, criticalFields: [] },
  );
  assert.deepEqual(continuation.context.structuredContent.sendero.brief, brief);
});

test("keeps stable trip identity in context and preserves each selection intent", () => {
  for (const purpose of ["open", "adjust", "refresh"]) {
    const continuation = tripSelectionContinuation({
      purpose,
      trip: {
        id: `trip-${purpose}`,
        title: "Sevilla histórica",
      },
    });

    assert.equal(continuation.context.structuredContent.sendero.intent, purpose);
    assert.equal(continuation.context.structuredContent.sendero.tripId, `trip-${purpose}`);
    assert.doesNotMatch(continuation.visibleMessage, forbiddenVisibleMechanics);
    assert.doesNotMatch(continuation.visibleMessage, /trip-(?:open|adjust|refresh)/);
  }
});

test("does not confuse saved trips that share the same title", () => {
  const first = tripSelectionContinuation({
    purpose: "open",
    trip: { id: "trip-one", title: "Escapada de verano" },
  });
  const second = tripSelectionContinuation({
    purpose: "open",
    trip: { id: "trip-two", title: "Escapada de verano" },
  });

  assert.equal(first.visibleMessage, second.visibleMessage);
  assert.notEqual(
    first.context.structuredContent.sendero.tripId,
    second.context.structuredContent.sendero.tripId,
  );
});

test("uses the brief locale for English and Portuguese continuations", () => {
  const english = tripIntakeContinuation({ ...brief, locale: "en-US" });
  assert.match(english.visibleMessage, /I want to create a trip/);
  assert.match(english.visibleMessage, /Aug 13, 2027/);
  assert.match(english.visibleMessage, /3 adults/);
  assert.doesNotMatch(english.visibleMessage, /Listo|adultos|ago 2027/);

  const portuguese = tripRequirementsContinuation({
    brief: { ...brief, locale: "pt-BR" },
    fields: ["startDate", "endDate"],
  });
  assert.match(portuguese.visibleMessage, /Pronto: destino/);
  assert.match(portuguese.visibleMessage, /13 de ago\. de 2027/);
  assert.match(portuguese.visibleMessage, /transporte público e táxi ou aplicativo/);
  assert.doesNotMatch(portuguese.visibleMessage, /Continúa|no vuelvas/);
});

test("keeps legacy briefs in English and localizes saved-trip selection from trip locale", () => {
  assert.match(tripIntakeContinuation(brief).visibleMessage, /^Done:/);
  assert.match(tripSelectionContinuation({
    purpose: "open",
    trip: { id: "trip-en", title: "London", locale: "en-GB" },
  }).visibleMessage, /^I chose the trip/);
  assert.match(tripSelectionContinuation({
    purpose: "open",
    trip: { id: "trip-pt", title: "Lisboa", locale: "pt-BR" },
  }).visibleMessage, /^Escolhi a viagem/);
});
