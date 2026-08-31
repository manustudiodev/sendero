import assert from "node:assert/strict";
import test from "node:test";
import {
  itineraryBudgetSummary,
  normalizeBudgetPreference,
} from "../shared/itinerary-budget.mjs";

test("normalizes legacy comfort values without inventing a monetary limit", () => {
  assert.deepEqual(normalizeBudgetPreference("low"), {
    comfort: "low",
    scope: "total",
    flexibility: "target",
    includes: ["activities", "food", "local_transport"],
  });
  assert.equal(normalizeBudgetPreference({ amount: 900 }).amount, 900);
  assert.equal(normalizeBudgetPreference({ amount: 900 }).currency, undefined);
});

test("totals included party and per-person costs against a trip budget", () => {
  const summary = itineraryBudgetSummary({
    travellers: { adults: 2, children: 1 },
    budget: {
      amount: 180,
      currency: "EUR",
      scope: "total",
      flexibility: "target",
      includes: ["activities", "food", "local_transport"],
    },
    days: [{
      activities: [
        { cost: { category: "activities", status: "verified", currency: "EUR", min: 20, max: 20, basis: "person" } },
        { cost: { category: "food", status: "estimated", currency: "EUR", min: 45, max: 60, basis: "party" } },
      ],
      additionalCosts: [
        { category: "local_transport", status: "estimated", currency: "EUR", min: 15, max: 20, basis: "person" },
        { category: "lodging", status: "estimated", currency: "EUR", min: 500, max: 500, basis: "party" },
      ],
    }],
  });

  assert.equal(summary.estimatedMin, 150);
  assert.equal(summary.estimatedMax, 180);
  assert.equal(summary.limit, 180);
  assert.equal(summary.status, "near");
  assert.deepEqual(summary.missingCategories, []);
  assert.equal(summary.complete, true);
});

test("reports missing categories, unknown prices, and currency mismatches", () => {
  const summary = itineraryBudgetSummary({
    budget: {
      amount: 100,
      currency: "EUR",
      scope: "total",
      flexibility: "strict",
      includes: ["activities", "food", "local_transport"],
    },
    days: [{
      activities: [
        { cost: { category: "activities", status: "unknown" } },
        { cost: { category: "food", status: "estimated", currency: "USD", min: 20, max: 30, basis: "party" } },
      ],
    }],
  });

  assert.equal(summary.unknownItems, 1);
  assert.equal(summary.mismatchedCurrencyItems, 1);
  assert.deepEqual(summary.missingCategories, ["local_transport"]);
  assert.equal(summary.complete, false);
});
