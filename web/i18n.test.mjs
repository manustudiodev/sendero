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
import {
  acceptedLocales,
  localizedHref,
  resolveUiLocale,
} from "../shared/ui-locale.mjs";

test("keeps ES, EN, PT, FR, and DE catalogs in parity", () => {
  assert.equal(assertCatalogParity(), true);
  assert.equal(t(undefined, "intake.create"), "Create itinerary");
  assert.equal(t("fr-FR", "intake.create"), "Créer l’itinéraire");
  assert.equal(t("de-DE", "intake.create"), "Reiseplan erstellen");
  assert.equal(t("es", "intake.create"), "Crear itinerario");
  assert.equal(t("en-US", "intake.create"), "Create itinerary");
  assert.equal(t("pt-BR", "intake.create"), "Criar roteiro");
});

test("resolves explicit content locale and keeps legacy or unsupported content in English", () => {
  assert.equal(resolveContentLocale("en-GB"), "en-GB");
  assert.equal(resolveContentLocale("pt-BR"), "pt-BR");
  assert.equal(resolveContentLocale(undefined), "en");
  assert.equal(resolveContentLocale("fr-FR"), "fr-FR");
  assert.equal(resolveContentLocale("de-DE"), "de-DE");
  assert.equal(resolveContentLocale("it-IT"), "en");
  assert.equal(uiLocale(undefined, "en-US"), "en-US");
});

test("formats dates and weekday order for the resolved UI locale", () => {
  assert.match(formatDate("en-US", "2027-08-24", { month: "long", day: "numeric" }), /August/);
  assert.match(formatDate("pt-BR", "2027-08-24", { month: "long", day: "numeric" }), /agosto/);
  assert.match(formatDate("fr-FR", "2027-08-24", { month: "long", day: "numeric" }), /août/);
  assert.match(formatDate("de-DE", "2027-08-24", { month: "long", day: "numeric" }), /August/);
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

test("resolves the UI locale from explicit navigation, preference, and browser languages", () => {
  assert.equal(resolveUiLocale({ pathname: "/pt/privacy", cookie: "sendero_locale=en" }), "pt");
  assert.equal(resolveUiLocale({ pathname: "/app", search: "?lang=en", cookie: "sendero_locale=pt" }), "en");
  assert.equal(resolveUiLocale({ pathname: "/app", cookie: "sendero_locale=pt" }), "pt");
  assert.equal(resolveUiLocale({ pathname: "/app", navigatorLanguages: ["fr-FR", "en-GB"] }), "fr-FR");
  assert.equal(resolveUiLocale({ pathname: "/app", acceptLanguage: "fr;q=1, pt-BR;q=.8, en;q=.6" }), "fr");
  assert.equal(resolveUiLocale({ pathname: "/app", acceptLanguage: "de-DE" }), "de-DE");
  assert.equal(resolveUiLocale({ pathname: "/app", acceptLanguage: "it-IT" }), "es");
  assert.deepEqual(acceptedLocales("en;q=.5, pt-BR;q=.9, es;q=0"), ["pt-BR", "en"]);
});

test("builds localized site and application links without losing share fragments", () => {
  assert.equal(localizedHref("/privacy", "en"), "/en/privacy");
  assert.equal(localizedHref("/es/terms", "pt-BR"), "/pt/terms");
  assert.equal(localizedHref("/pt/terms", "fr-FR"), "/fr/terms");
  assert.equal(localizedHref("/privacy", "de-DE"), "/de/privacy");
  assert.equal(localizedHref("/app?tab=shared", "pt"), "/app?tab=shared&lang=pt");
  assert.equal(localizedHref("/share#public-token", "en"), "/share?lang=en#public-token");
});
