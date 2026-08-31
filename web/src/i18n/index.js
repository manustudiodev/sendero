import en from "./catalogs/en.js";
import es from "./catalogs/es.js";
import pt from "./catalogs/pt.js";
import fr from "./catalogs/fr.js";
import de from "./catalogs/de.js";

export const DEFAULT_LOCALE = "en";

const catalogs = { en, es, pt, fr, de };
const localePattern = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

function canonicalLocale(value) {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!candidate || !localePattern.test(candidate)) return "";
  try {
    return Intl.getCanonicalLocales(candidate)[0] || "";
  } catch {
    return "";
  }
}

export function localeLanguage(value) {
  return canonicalLocale(value).split("-")[0].toLowerCase();
}

function supportedLocale(value) {
  const canonical = canonicalLocale(value);
  return canonical && catalogs[localeLanguage(canonical)] ? canonical : "";
}

export function resolveContentLocale(value) {
  return supportedLocale(value) || DEFAULT_LOCALE;
}

export function uiLocale(value, fallback = DEFAULT_LOCALE) {
  return supportedLocale(value) || supportedLocale(fallback) || DEFAULT_LOCALE;
}

export function t(locale, key, values = {}) {
  const language = localeLanguage(uiLocale(locale));
  const entry = catalogs[language]?.[key] ?? catalogs.en[key];
  if (typeof entry === "function") return entry(values);
  return entry ?? key;
}

function parsedDate(value) {
  if (!value) return null;
  const date = value instanceof Date
    ? value
    : /^\d{4}-\d{2}-\d{2}$/.test(String(value))
      ? new Date(`${value}T00:00:00Z`)
      : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(locale, value, options = {}) {
  const date = parsedDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat(uiLocale(locale), {
    timeZone: "UTC",
    ...options,
  }).format(date);
}

export function formatList(locale, values, options = {}) {
  return new Intl.ListFormat(uiLocale(locale), options).format((values || []).filter(Boolean));
}

export function setDocumentLocale(locale) {
  const resolved = uiLocale(locale);
  if (globalThis.document?.documentElement) globalThis.document.documentElement.lang = resolved;
  return resolved;
}

export function localeWeekStartsOnMonday(locale) {
  const resolved = uiLocale(locale);
  try {
    const firstDay = new Intl.Locale(resolved).weekInfo?.firstDay;
    if (Number.isInteger(firstDay)) return firstDay === 1;
  } catch {
    // Use the target-language fallback below.
  }
  return !(localeLanguage(resolved) === "en" && /(?:^|-)US(?:-|$)/i.test(resolved));
}

export function weekdayLabels(locale) {
  const order = localeWeekStartsOnMonday(locale)
    ? ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    : ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return order.map((day) => ({
    short: t(locale, `weekday.${day}.short`),
    long: t(locale, `weekday.${day}.long`),
  }));
}

export function assertCatalogParity() {
  const baseline = Object.keys(en).sort();
  for (const [language, catalog] of Object.entries(catalogs)) {
    const keys = Object.keys(catalog).sort();
    if (keys.length !== baseline.length || keys.some((key, index) => key !== baseline[index])) {
      throw new Error(`i18n catalog ${language} does not match the English baseline`);
    }
  }
  return true;
}
