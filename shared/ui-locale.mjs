export const DEFAULT_UI_LOCALE = "es";
export const SUPPORTED_UI_LANGUAGES = Object.freeze(["es", "en", "pt", "fr", "de"]);
export const UI_LOCALE_COOKIE = "sendero_locale";

const SITE_PATH_PATTERN = /^\/(?:es|en|pt|fr|de)(?=\/|$)/i;

export function canonicalSupportedUiLocale(value) {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!candidate) return "";
  try {
    const canonical = Intl.getCanonicalLocales(candidate)[0] || "";
    return SUPPORTED_UI_LANGUAGES.includes(canonical.split("-")[0].toLowerCase())
      ? canonical
      : "";
  } catch {
    return "";
  }
}

export function uiLanguage(value, fallback = DEFAULT_UI_LOCALE) {
  return (canonicalSupportedUiLocale(value) || canonicalSupportedUiLocale(fallback) || DEFAULT_UI_LOCALE)
    .split("-")[0]
    .toLowerCase();
}

export function siteLocaleFromPath(pathname) {
  const match = String(pathname || "").match(/^\/(es|en|pt|fr|de)(?:\/|$)/i);
  return match ? match[1].toLowerCase() : "";
}

export function queryLocale(search) {
  try {
    return new URLSearchParams(String(search || "")).get("lang") || "";
  } catch {
    return "";
  }
}

export function cookieLocale(cookieHeader) {
  const pairs = String(cookieHeader || "").split(";");
  for (const pair of pairs) {
    const separator = pair.indexOf("=");
    if (separator < 0) continue;
    if (pair.slice(0, separator).trim() !== UI_LOCALE_COOKIE) continue;
    try {
      return decodeURIComponent(pair.slice(separator + 1).trim());
    } catch {
      return "";
    }
  }
  return "";
}

export function acceptedLocales(header) {
  return String(header || "")
    .split(",")
    .map((entry, index) => {
      const [locale, ...parameters] = entry.trim().split(";");
      const qualityValue = parameters
        .map((parameter) => parameter.trim().match(/^q=((?:0?\.\d+)|0|1(?:\.0+)?)$/i))
        .find(Boolean)?.[1];
      return {
        index,
        locale,
        quality: qualityValue === undefined ? 1 : Number(qualityValue),
      };
    })
    .filter(({ locale, quality }) => locale && locale !== "*" && quality > 0)
    .sort((left, right) => right.quality - left.quality || left.index - right.index)
    .map(({ locale }) => locale);
}

export function resolveUiLocale({
  acceptLanguage = "",
  cookie = "",
  documentLocale = "",
  navigatorLanguages = [],
  pathname = "",
  search = "",
} = {}) {
  const candidates = [
    siteLocaleFromPath(pathname),
    queryLocale(search),
    cookieLocale(cookie),
    ...(Array.isArray(navigatorLanguages) ? navigatorLanguages : []),
    ...acceptedLocales(acceptLanguage),
    documentLocale,
  ];
  return candidates.map(canonicalSupportedUiLocale).find(Boolean) || DEFAULT_UI_LOCALE;
}

export function localizedSitePath(pathname, locale) {
  const language = uiLanguage(locale);
  const value = String(pathname || "/") || "/";
  if (SITE_PATH_PATTERN.test(value)) return value.replace(SITE_PATH_PATTERN, `/${language}`);
  if (value === "/") return `/${language}`;
  if (value === "/privacy" || value === "/terms") return `/${language}${value}`;
  return value;
}

export function localizedHref(href, locale, origin = "https://sendero.invalid") {
  const language = uiLanguage(locale);
  const url = new URL(href, origin);
  const isSitePage = url.pathname === "/"
    || url.pathname === "/privacy"
    || url.pathname === "/terms"
    || /^\/(?:es|en|pt|fr|de)(?:\/|$)/i.test(url.pathname);
  if (isSitePage) {
    url.pathname = localizedSitePath(url.pathname, language);
    url.searchParams.delete("lang");
  } else {
    url.searchParams.set("lang", language);
  }
  return url.origin === origin ? `${url.pathname}${url.search}${url.hash}` : url.href;
}
