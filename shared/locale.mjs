export const DEFAULT_LOCALE = "en";

const LOCALE_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

export function canonicalLocale(value, fallback = DEFAULT_LOCALE) {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!candidate || !LOCALE_PATTERN.test(candidate)) return fallback;
  try {
    return Intl.getCanonicalLocales(candidate)[0] || fallback;
  } catch {
    return fallback;
  }
}

export function localeLanguage(value, fallback = DEFAULT_LOCALE) {
  return canonicalLocale(value, fallback).split("-")[0].toLowerCase();
}
