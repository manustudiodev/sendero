import assert from "node:assert/strict";
import test from "node:test";
import {
  ItineraryPlanningError,
  planningProtocol,
  planningProtocolIdentity,
  validatedDraft,
} from "./itinerary-planning.mjs";

const brief = {
  locale: "es",
  destination: "Valencia, España",
  startDate: "2027-04-10",
  endDate: "2027-04-10",
  travellers: { adults: 2, children: 0 },
  pace: "balanced",
  transport: { modes: ["walk", "public_transit"], hasLicense: false, wantsCar: false },
};

const itinerary = {
  locale: "es",
  title: "Un día entre huerta y ciudad",
  destination: "Valencia, España",
  startDate: "2027-04-10",
  endDate: "2027-04-10",
  transport: { modes: ["walk", "public_transit"], hasLicense: false, wantsCar: false },
  days: [{
    date: "2027-04-10",
    title: "Centro histórico",
    area: "Ciutat Vella",
    activities: [{
      id: "paseo-centro",
      startTime: "10:00",
      endTime: "11:30",
      title: "Paseo por el centro",
      category: "free_time",
    }],
  }],
};

function stageInput(overrides = {}) {
  const identity = planningProtocolIdentity();
  return {
    brief,
    itinerary,
    operationId: "sendero-stage:test-1",
    protocolHash: identity.hash,
    protocolVersion: identity.version,
    ...overrides,
  };
}

test("returns one versioned protocol with the canonical schema and a prepared brief", () => {
  const result = planningProtocol(brief);
  assert.equal(result.brief.ready, true);
  assert.equal(result.protocol.version, "1.0.0");
  assert.match(result.protocol.hash, /^[a-f0-9]{64}$/);
  assert.match(result.protocol.instructions, /validate_and_stage_itinerary/);
  assert.equal(result.protocol.itinerarySchema.type, "object");
  assert.ok(result.protocol.itinerarySchema.required.includes("days"));
});

test("normalizes and accepts a complete itinerary while retaining warnings", () => {
  const result = validatedDraft(stageInput());
  assert.equal(result.itinerary.days[0].activities[0].id, "paseo-centro");
  assert.match(result.briefHash, /^[a-f0-9]{64}$/);
  assert.match(result.itineraryHash, /^[a-f0-9]{64}$/);
  assert.ok(result.warnings.some((warning) => warning.includes("provisional base")));
});

test("allows a destination to be made more specific without weakening operational constraints", () => {
  const result = validatedDraft(stageInput({
    brief: { ...brief, destination: "Valencia" },
  }));
  assert.equal(result.itinerary.destination, "Valencia, España");

  assert.throws(
    () => validatedDraft(stageInput({
      brief: { ...brief, lodging: { address: "Carrer de la Pau 1", status: "confirmed" } },
    })),
    (error) => error instanceof ItineraryPlanningError
      && error.code === "itinerary_brief_mismatch"
      && error.details.fields.includes("lodging.address"),
  );
});

test("rejects stale protocols, incomplete briefs, and brief drift before persistence", () => {
  assert.throws(
    () => validatedDraft(stageInput({ protocolVersion: "0.9.0" })),
    (error) => error instanceof ItineraryPlanningError && error.code === "planning_protocol_changed",
  );
  assert.throws(
    () => validatedDraft(stageInput({ brief: { locale: "es" } })),
    (error) => error instanceof ItineraryPlanningError && error.code === "brief_incomplete",
  );
  assert.throws(
    () => validatedDraft(stageInput({ itinerary: { ...itinerary, endDate: "2027-04-11" } })),
    (error) => error instanceof ItineraryPlanningError && error.code === "itinerary_brief_mismatch",
  );
});
