import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalLocale,
  DEFAULT_LOCALE,
  localeLanguage,
} from "../shared/locale.mjs";

test("canonicalizes BCP 47 locale tags and keeps their regional intent", () => {
  assert.equal(canonicalLocale("ES-ar"), "es-AR");
  assert.equal(canonicalLocale("en-gb"), "en-GB");
  assert.equal(canonicalLocale("pt-br"), "pt-BR");
});

test("legacy, empty, and invalid locale values fall back to English", () => {
  assert.equal(canonicalLocale(), DEFAULT_LOCALE);
  assert.equal(canonicalLocale(""), "en");
  assert.equal(canonicalLocale("es_AR"), "en");
  assert.equal(canonicalLocale("not a locale"), "en");
  assert.equal(canonicalLocale(42), "en");
});

test("extracts the language subtag from a canonical locale", () => {
  assert.equal(localeLanguage("es-AR"), "es");
  assert.equal(localeLanguage("en-US"), "en");
  assert.equal(localeLanguage("pt-BR"), "pt");
});
