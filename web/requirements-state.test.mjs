import assert from "node:assert/strict";
import test from "node:test";
import {
  draftFromBrief,
  initialRequirementsStatus,
  mergeBrief,
  requestedFields,
} from "./src/requirements/state.js";

const baseBrief = {
  locale: "pt-BR",
  destination: "",
  travellers: { children: 1 },
  lodging: { status: "area_only", area: "Roma Norte" },
  interests: ["mercados", "arquitectura"],
  fixedPlans: [{ date: "2026-12-05", title: "Concierto", startTime: "20:00" }],
  notes: "Evitar tours masivos",
  transport: {},
};

test("merges requirements into the durable base brief without losing prior context", () => {
  const draft = {
    destination: "Ciudad de México",
    startDate: "2026-12-01",
    endDate: "2026-12-09",
    adults: "2",
    transportModes: ["walk", "public_transit", "taxi"],
    hasLicense: false,
  };

  const merged = mergeBrief(baseBrief, draft);

  assert.equal(merged.destination, "Ciudad de México");
  assert.equal(merged.locale, "pt-BR");
  assert.deepEqual(merged.travellers, { children: 1, adults: 2 });
  assert.deepEqual(merged.lodging, baseBrief.lodging);
  assert.deepEqual(merged.interests, baseBrief.interests);
  assert.deepEqual(merged.fixedPlans, baseBrief.fixedPlans);
  assert.equal(merged.notes, baseBrief.notes);
  assert.deepEqual(merged.transport, {
    modes: ["walk", "public_transit", "taxi"],
    wantsCar: false,
    hasLicense: false,
  });
});

test("restores requested fields and their editable projection from a normalized brief", () => {
  const normalized = mergeBrief(baseBrief, {
    destination: "Ciudad de México",
    startDate: "2026-12-01",
    endDate: "",
    adults: "2",
    transportModes: ["public_transit"],
    hasLicense: false,
  });

  assert.deepEqual(requestedFields({ fields: ["endDate", "destination", "unknown"] }), ["destination", "endDate"]);
  assert.deepEqual(draftFromBrief(normalized), {
    destination: "Ciudad de México",
    startDate: "2026-12-01",
    endDate: "",
    adults: 2,
    transportModes: ["public_transit"],
    hasLicense: false,
  });
});

test("does not resend or claim success for an ambiguous dispatch after remount", () => {
  assert.deepEqual(initialRequirementsStatus({ continuation: { phase: "sent" } }), {
    state: "success",
    message: "Done. Sendero is continuing in the conversation.",
  });

  for (const phase of ["dispatching", "uncertain", "delivery_failed"]) {
    const status = initialRequirementsStatus({ continuation: { phase } });
    assert.equal(status.state, "error");
    assert.match(status.message, /We could not confirm delivery/);
  }
});

test("localizes restored requirements delivery state from the brief locale", () => {
  assert.deepEqual(initialRequirementsStatus({
    baseBrief: { locale: "en-US" },
    continuation: { phase: "sent" },
  }), {
    state: "success",
    message: "Done. Sendero is continuing in the conversation.",
  });
  assert.match(initialRequirementsStatus({
    baseBrief: { locale: "pt-BR" },
    continuation: { phase: "uncertain" },
  }).message, /Não foi possível confirmar/);
});
