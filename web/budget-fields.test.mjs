import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  currencyOptionLabel,
  formatLocalizedAmountInput,
  normalizeLocalizedAmountInput,
  supportedCurrencies,
} from "./src/budget/budget-format.js";

test("formats and parses budget amounts using the active locale", () => {
  assert.equal(formatLocalizedAmountInput("1234567.89", "en-US"), "1,234,567.89");
  assert.equal(formatLocalizedAmountInput("1234567.89", "es-ES"), "1.234.567,89");
  assert.equal(formatLocalizedAmountInput("1234567.89", "de-DE"), "1.234.567,89");
  assert.equal(formatLocalizedAmountInput("1200.", "es-ES"), "1.200,");

  assert.equal(normalizeLocalizedAmountInput("1,234,567.89", "en-US"), "1234567.89");
  assert.equal(normalizeLocalizedAmountInput("1.234.567,89", "es-ES"), "1234567.89");
  assert.equal(normalizeLocalizedAmountInput("1.234.567,89", "de-DE"), "1234567.89");

  for (const locale of ["en", "es", "pt", "fr", "de"]) {
    const displayed = formatLocalizedAmountInput("1234567.89", locale);
    assert.equal(normalizeLocalizedAmountInput(displayed, locale), "1234567.89");
  }
});

test("builds localized currency choices with a human name and symbol", () => {
  assert.ok(supportedCurrencies.includes("USD"));
  assert.ok(supportedCurrencies.includes("EUR"));

  for (const locale of ["en", "es", "pt", "fr", "de"]) {
    const label = currencyOptionLabel("EUR", locale);
    assert.notEqual(label, "EUR");
    assert.match(label, /\(.+\)$/u);
    assert.match(label, /€/u);
  }
});

test("renders budget amount as a localized mask and currency as a selector", async () => {
  const source = await readFile(new URL("./src/budget/BudgetFields.jsx", import.meta.url), "utf8");
  const sharedStyles = await readFile(new URL("./src/styles.css", import.meta.url), "utf8");
  const pageFrame = await readFile(new URL("./src/account/PageFrame.jsx", import.meta.url), "utf8");

  assert.match(source, /placeholder=\{`\$\{copy\.amountExample\}/u);
  assert.doesNotMatch(source, /placeholder="1200"/u);
  assert.match(source, /<select className=\{value\.currency/u);
  assert.match(source, /currencyOptionLabel\(currency, locale\)/u);
  assert.match(sharedStyles, /input::placeholder, textarea::placeholder/u);
  assert.match(pageFrame, /input::placeholder, textarea::placeholder/u);
});
