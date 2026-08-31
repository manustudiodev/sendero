import {
  DEFAULT_UI_LOCALE,
  localizedHref,
  resolveUiLocale,
  UI_LOCALE_COOKIE,
  uiLanguage,
} from "../../../shared/ui-locale.mjs";

export function initialUiLocale({
  documentLike = globalThis.document,
  locationLike = globalThis.location,
  navigatorLike = globalThis.navigator,
} = {}) {
  return resolveUiLocale({
    cookie: documentLike?.cookie || "",
    documentLocale: documentLike?.documentElement?.lang || "",
    navigatorLanguages: navigatorLike?.languages?.length
      ? Array.from(navigatorLike.languages)
      : navigatorLike?.language
        ? [navigatorLike.language]
        : [],
    pathname: locationLike?.pathname || "",
    search: locationLike?.search || "",
  });
}

export function persistUiLocale(locale, documentLike = globalThis.document) {
  const language = uiLanguage(locale, DEFAULT_UI_LOCALE);
  if (!documentLike) return language;
  const secure = globalThis.location?.protocol === "https:" ? "; Secure" : "";
  documentLike.cookie = `${UI_LOCALE_COOKIE}=${encodeURIComponent(language)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  return language;
}

export function currentLocalizedHref(locale, locationLike = globalThis.location) {
  if (!locationLike) return localizedHref("/", locale);
  return localizedHref(
    `${locationLike.pathname || "/"}${locationLike.search || ""}${locationLike.hash || ""}`,
    locale,
    locationLike.origin || "https://sendero.invalid",
  );
}
