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
  travellers: { adults: 2, children: 0, seniors: 0 },
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
      description: "Recorre a tu ritmo la plaza del Ayuntamiento y las calles peatonales cercanas antes de continuar el día.",
      location: {
        name: "Plaça de l'Ajuntament",
        address: "Plaça de l'Ajuntament, Ciutat Vella, Valencia",
      },
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
  const result = planningProtocol({
    ...brief,
    lodging: {
      area: "Ciutat Vella, Valencia, España",
      areaPlaceId: "area-place-1",
      address: "Hotel Valencia, Carrer de la Pau, Valencia, España",
      addressPlaceId: "address-place-1",
      status: "confirmed",
    },
  });
  assert.equal(result.brief.ready, true);
  assert.equal(result.protocol.version, "1.7.0");
  assert.match(result.protocol.hash, /^[a-f0-9]{64}$/);
  assert.match(result.protocol.instructions, /validate_and_stage_itinerary/);
  assert.match(result.protocol.instructions, /first-time visitor/);
  assert.match(result.protocol.instructions, /never a research,\s+decision, or preparation task/);
  assert.match(result.protocol.instructions, /future procession, festival, fair/);
  assert.match(result.protocol.instructions, /balanced days 2–3/);
  assert.match(result.protocol.instructions, /composition targets, not filler quotas/);
  assert.equal(result.protocol.itinerarySchema.type, "object");
  assert.ok(result.protocol.itinerarySchema.required.includes("days"));
  assert.equal(result.brief.brief.lodging.areaPlaceId, "area-place-1");
  assert.equal(result.brief.brief.lodging.addressPlaceId, "address-place-1");
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

test("keeps a constrained budget and per-person traveller count aligned with the brief", () => {
  const constrainedBudget = {
    amount: 90,
    currency: "EUR",
    scope: "per_person",
    flexibility: "target",
    comfort: "medium",
    includes: ["activities"],
  };
  const matching = validatedDraft(stageInput({
    brief: { ...brief, budget: constrainedBudget },
    itinerary: {
      ...itinerary,
      travellers: brief.travellers,
      budget: constrainedBudget,
      days: [{
        ...itinerary.days[0],
        activities: [{
          ...itinerary.days[0].activities[0],
          cost: {
            category: "activities",
            status: "free",
          },
        }],
      }],
    },
  }));
  assert.equal(matching.itinerary.budget.amount, 90);

  assert.throws(
    () => validatedDraft(stageInput({
      brief: { ...brief, budget: constrainedBudget },
      itinerary: {
        ...itinerary,
        travellers: { adults: 1, children: 0 },
        budget: constrainedBudget,
      },
    })),
    (error) => error instanceof ItineraryPlanningError
      && error.code === "itinerary_brief_mismatch"
      && error.details.fields.includes("travellers"),
  );
});

test("carries every supplied optional traveller and schedule constraint into the itinerary", () => {
  const profile = {
    travellers: {
      adults: 2,
      children: 1,
      childAges: [8],
      seniors: 1,
      seniorAges: [67],
    },
    arrivalTime: "09:00",
    departureTime: "17:00",
    dailySchedule: {
      earliestStartTime: "09:00",
      latestEndTime: "18:00",
      mealTimes: { lunch: "13:00" },
    },
    mobility: {
      walkingTolerance: "low",
      maxWalkingMinutes: 20,
      avoidStairs: true,
      wheelchairAccess: true,
      restFrequency: "frequent",
    },
    accessibilityNeeds: ["Asientos durante esperas largas"],
  };
  const accessibleItinerary = {
    ...itinerary,
    ...profile,
    days: itinerary.days.map((day) => ({
      ...day,
      activities: day.activities.map((activity) => ({
        ...activity,
        accessibility: {
          status: "verified",
          wheelchairAccessible: true,
          stepFree: true,
          seatingAvailable: true,
          sourceUrl: "https://www.visitvalencia.com/",
          checkedAt: "2026-09-03",
        },
      })),
    })),
  };
  const matching = validatedDraft(stageInput({
    brief: { ...brief, ...profile },
    itinerary: accessibleItinerary,
  }));
  assert.deepEqual(matching.itinerary.mobility, profile.mobility);

  assert.throws(
    () => validatedDraft(stageInput({
      brief: { ...brief, ...profile },
      itinerary: { ...itinerary, ...profile, departureTime: undefined },
    })),
    (error) => error instanceof ItineraryPlanningError
      && error.code === "itinerary_brief_mismatch"
      && error.details.fields.includes("departureTime"),
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
