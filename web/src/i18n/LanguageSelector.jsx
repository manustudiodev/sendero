import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  SUPPORTED_UI_LANGUAGES,
  localizedHref,
  siteLocaleFromPath,
  uiLanguage,
} from "../../../shared/ui-locale.mjs";
import { setDocumentLocale } from "./index.js";
import { currentLocalizedHref, initialUiLocale, persistUiLocale } from "./browser-locale.js";

const LABELS = {
  en: { aria: "Language", names: { en: "English", es: "Spanish", pt: "Portuguese", fr: "French", de: "German" } },
  es: { aria: "Idioma", names: { en: "Inglés", es: "Español", pt: "Portugués", fr: "Francés", de: "Alemán" } },
  pt: { aria: "Idioma", names: { en: "Inglês", es: "Espanhol", pt: "Português", fr: "Francês", de: "Alemão" } },
  fr: { aria: "Langue", names: { en: "Anglais", es: "Espagnol", pt: "Portugais", fr: "Français", de: "Allemand" } },
  de: { aria: "Sprache", names: { en: "Englisch", es: "Spanisch", pt: "Portugiesisch", fr: "Französisch", de: "Deutsch" } },
};

const UiLocaleContext = createContext(null);

function useUiLocaleState() {
  const [locale, setLocale] = useState(() => initialUiLocale());
  const language = uiLanguage(locale);

  useEffect(() => {
    setDocumentLocale(locale);
  }, [locale]);

  const selectLocale = useCallback((nextLocale) => {
    const nextLanguage = persistUiLocale(nextLocale);
    const nextHref = currentLocalizedHref(nextLanguage);
    const currentPath = `${globalThis.location?.pathname || "/"}${globalThis.location?.search || ""}${globalThis.location?.hash || ""}`;
    const nextUrl = new URL(nextHref, globalThis.location?.origin || "https://sendero.invalid");
    const isLocalizedSiteNavigation = /^\/(?:es|en|pt|fr|de)(?:\/|$)/.test(nextUrl.pathname)
      && nextUrl.pathname !== globalThis.location?.pathname;
    if (isLocalizedSiteNavigation) {
      globalThis.location.assign(nextHref);
      return;
    }
    if (nextHref !== currentPath) globalThis.history?.replaceState({}, "", nextHref);
    setLocale(nextLanguage);
    globalThis.dispatchEvent?.(new CustomEvent("sendero:locale", { detail: { locale: nextLanguage } }));
  }, []);

  return useMemo(() => ({ language, locale, selectLocale }), [language, locale, selectLocale]);
}

export function UiLocaleProvider({ children }) {
  const value = useUiLocaleState();

  useEffect(() => {
    if (siteLocaleFromPath(globalThis.location?.pathname)) persistUiLocale(value.locale);
  }, [value.locale]);

  return <UiLocaleContext.Provider value={value}>{children}</UiLocaleContext.Provider>;
}

export function useUiLocale() {
  const context = useContext(UiLocaleContext);
  if (!context) throw new Error("useUiLocale must be used within UiLocaleProvider");
  return context;
}

export function LanguageSelector({ className = "", locale, onChange }) {
  const language = uiLanguage(locale);
  const copy = LABELS[language] || LABELS.es;
  return (
    <label className={`language-selector ${className}`.trim()}>
      <span className="visually-hidden web-sr-only">{copy.aria}</span>
      <select aria-label={copy.aria} onChange={(event) => onChange(event.target.value)} value={language}>
        {SUPPORTED_UI_LANGUAGES.map((option) => (
          <option key={option} value={option}>{copy.names[option]}</option>
        ))}
      </select>
    </label>
  );
}

export function hrefForLocale(href, locale) {
  return localizedHref(href, locale, globalThis.location?.origin || "https://sendero.invalid");
}
