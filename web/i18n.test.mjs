import assert from "node:assert/strict";
import test from "node:test";
import {
  assertCatalogParity,
  formatDate,
  resolveContentLocale,
  setDocumentLocale,
  t,
  uiLocale,
  weekdayLabels,
} from "./src/i18n/index.js";

test("keeps ES, EN, and PT catalogs in parity", () => {
  assert.equal(assertCatalogParity(), true);
  assert.equal(t(undefined, "intake.create"), "Create itinerary");
  assert.equal(t("fr-FR", "intake.create"), "Create itinerary");
  assert.equal(t("es", "intake.create"), "Crear itinerario");
  assert.equal(t("en-US", "intake.create"), "Create itinerary");
  assert.equal(t("pt-BR", "intake.create"), "Criar roteiro");
});

test("resolves explicit content locale and keeps legacy or unsupported content in English", () => {
  assert.equal(resolveContentLocale("en-GB"), "en-GB");
  assert.equal(resolveContentLocale("pt-BR"), "pt-BR");
  assert.equal(resolveContentLocale(undefined), "en");
  assert.equal(resolveContentLocale("fr-FR"), "en");
  assert.equal(uiLocale(undefined, "en-US"), "en-US");
});

test("formats dates and weekday order for the resolved UI locale", () => {
  assert.match(formatDate("en-US", "2027-08-24", { month: "long", day: "numeric" }), /August/);
  assert.match(formatDate("pt-BR", "2027-08-24", { month: "long", day: "numeric" }), /agosto/);
  assert.equal(weekdayLabels("en-US")[0].short, "Su");
  assert.equal(weekdayLabels("es")[0].short, "Lu");
});

test("synchronizes the runtime document language", () => {
  const previousDocument = globalThis.document;
  globalThis.document = { documentElement: { lang: "" } };
  try {
    assert.equal(setDocumentLocale("pt-BR"), "pt-BR");
    assert.equal(globalThis.document.documentElement.lang, "pt-BR");
  } finally {
    globalThis.document = previousDocument;
  }
});
