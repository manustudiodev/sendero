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
  assert.match(continuation.visibleMessage, /2027-08-13/);
  assert.match(continuation.visibleMessage, /2027-08-26/);
  assert.match(continuation.visibleMessage, /3 adultos/);
  assert.match(continuation.visibleMessage, /a pie, transporte público, taxi o app/);
  assert.match(continuation.visibleMessage, /no vuelvas a pedirme estos datos/);
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
  assert.match(continuation.visibleMessage, /2027-08-13/);
  assert.match(continuation.visibleMessage, /3 adultos/);
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
