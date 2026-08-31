export const BUDGET_CATEGORIES = Object.freeze([
  "activities",
  "food",
  "local_transport",
  "lodging",
  "long_distance_transport",
  "other",
]);

export const DEFAULT_BUDGET_CATEGORIES = Object.freeze([
  "activities",
  "food",
  "local_transport",
]);

const LEGACY_COMFORTS = new Set(["low", "medium", "high", "flexible"]);
const SCOPES = new Set(["total", "per_person", "per_day"]);
const FLEXIBILITIES = new Set(["strict", "target", "flexible"]);
const CATEGORY_SET = new Set(BUDGET_CATEGORIES);

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function normalizedCurrency(value) {
  const currency = typeof value === "string" ? value.trim().toUpperCase() : "";
  return /^[A-Z]{3}$/.test(currency) ? currency : undefined;
}

function uniqueCategories(values) {
  const categories = Array.isArray(values)
    ? values.filter((value) => CATEGORY_SET.has(value))
    : [];
  return [...new Set(categories)];
}

export function normalizeBudgetPreference(value) {
  const source = typeof value === "string" ? { comfort: value } : value || {};
  const amount = positiveNumber(source.amount);
  const currency = normalizedCurrency(source.currency);
  const comfort = LEGACY_COMFORTS.has(source.comfort) ? source.comfort : "flexible";
  const scope = SCOPES.has(source.scope) ? source.scope : "total";
  const flexibility = FLEXIBILITIES.has(source.flexibility)
    ? source.flexibility
    : amount
      ? "target"
      : comfort === "flexible"
        ? "flexible"
        : "target";
  const requestedCategories = uniqueCategories(source.includes);
  const includes = requestedCategories.length
    ? requestedCategories
    : [...DEFAULT_BUDGET_CATEGORIES];

  return {
    comfort,
    scope,
    flexibility,
    includes,
    ...(amount ? { amount } : {}),
    ...(currency ? { currency } : {}),
  };
}

function tripPartySize(itinerary) {
  const adults = Number(itinerary?.travellers?.adults || 0);
  const children = Number(itinerary?.travellers?.children || 0);
  const size = adults + children;
  return Number.isFinite(size) && size > 0 ? size : undefined;
}

function includedCostEntries(itinerary, categories) {
  return (itinerary?.days || []).flatMap((day) => [
    ...(day.activities || []).flatMap((activity) => activity.cost ? [activity.cost] : []),
    ...(day.additionalCosts || []),
  ]).filter((cost) => categories.has(cost?.category));
}

function totalBudgetLimit(budget, itinerary) {
  if (!budget.amount) return undefined;
  if (budget.scope === "per_day") return budget.amount * (itinerary?.days?.length || 0);
  if (budget.scope === "per_person") {
    const partySize = tripPartySize(itinerary);
    return partySize ? budget.amount * partySize : undefined;
  }
  return budget.amount;
}

export function itineraryBudgetSummary(itinerary) {
  if (!itinerary?.budget) return null;
  const budget = normalizeBudgetPreference(itinerary.budget);
  const includedCategories = new Set(budget.includes);
  const costs = includedCostEntries(itinerary, includedCategories);
  const coveredCategories = [...new Set(costs.map((cost) => cost.category))];
  const missingCategories = budget.includes.filter(
    (category) => !coveredCategories.includes(category),
  );
  const knownCurrencies = new Set(
    costs.map((cost) => normalizedCurrency(cost.currency)).filter(Boolean),
  );
  const currency = budget.currency || (knownCurrencies.size === 1 ? [...knownCurrencies][0] : undefined);
  let estimatedMin = 0;
  let estimatedMax = 0;
  let pricedItems = 0;
  let unknownItems = 0;
  let mismatchedCurrencyItems = 0;

  for (const cost of costs) {
    if (cost.status === "free") {
      pricedItems += 1;
      continue;
    }
    if (cost.status === "unknown") {
      unknownItems += 1;
      continue;
    }
    const costCurrency = normalizedCurrency(cost.currency);
    if (!currency || costCurrency !== currency) {
      mismatchedCurrencyItems += 1;
      continue;
    }
    const multiplier = cost.basis === "person" ? tripPartySize(itinerary) : 1;
    if (!multiplier || !Number.isFinite(cost.min) || !Number.isFinite(cost.max)) {
      unknownItems += 1;
      continue;
    }
    estimatedMin += cost.min * multiplier;
    estimatedMax += cost.max * multiplier;
    pricedItems += 1;
  }

  const limit = totalBudgetLimit(budget, itinerary);
  let status = "unbounded";
  if (limit && pricedItems === 0) status = "unknown";
  else if (limit && estimatedMin > limit) status = "over";
  else if (limit && estimatedMax > limit) status = "may_exceed";
  else if (limit && estimatedMax >= limit * 0.9) status = "near";
  else if (limit) status = "within";

  return {
    budget,
    currency,
    estimatedMin,
    estimatedMax,
    limit,
    status,
    pricedItems,
    unknownItems,
    mismatchedCurrencyItems,
    coveredCategories,
    missingCategories,
    complete:
      unknownItems === 0
      && mismatchedCurrencyItems === 0
      && missingCategories.length === 0,
  };
}

export function formatMoneyRange(locale, currency, minimum, maximum) {
  if (!currency || !Number.isFinite(minimum) || !Number.isFinite(maximum)) return "";
  try {
    const formatter = new Intl.NumberFormat(locale || "en", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    });
    return minimum === maximum
      ? formatter.format(minimum)
      : `${formatter.format(minimum)}–${formatter.format(maximum)}`;
  } catch {
    return minimum === maximum
      ? `${currency} ${minimum}`
      : `${currency} ${minimum}–${maximum}`;
  }
}
