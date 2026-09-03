import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { WebButton, WebPageFrame, WebState } from "../account/PageFrame.jsx";
import {
  loginUrl,
  normalizeSession,
  requestJson,
} from "../account/web-client.js";
import { ItineraryViewer } from "../itinerary/ItineraryViewer.jsx";
import { reservationEntryKey } from "../itinerary/presentation-utils.js";
import { hrefForLocale, useUiLocale } from "../i18n/LanguageSelector.jsx";
import { formatDate, t } from "../i18n/index.js";
import { createItineraryGenerationFacade } from "./generation-client.js";
import {
  ACTIVE_DRAFT_QUERY_KEY,
  activeDraftView,
  cacheActiveDraft,
  clearActiveDraft,
} from "./draft-cache.js";
import { DestinationCombobox } from "./DestinationCombobox.jsx";
import { isLodgingAreaSuggestion } from "./destination-client.js";
import { createItineraryHandoffPrompt } from "./handoff-prompt.js";
import {
  generationStatusFromEvent,
  initialGenerationStatus,
  visibleGenerationStatus,
} from "./generation-status.js";
import { registerItineraryGenerationTools } from "./webmcp.js";
import { webMcpIndicatorModel } from "./webmcp-ui.js";
import {
  BudgetFields,
  budgetDraftFromValue,
  budgetValueFromDraft,
} from "../budget/BudgetFields.jsx";
import {
  TripProfileFields,
  tripProfileDraftFromBrief,
  tripProfileValueFromDraft,
} from "../profile/TripProfileFields.jsx";

const generateStyles = `
.generate-flow { display: grid; gap: 22px; }
.generate-progress { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin: 0; padding: 0; list-style: none; }
.generate-progress li { min-width: 0; border: 1px solid var(--web-line); border-radius: 14px; background: color-mix(in srgb, var(--web-surface) 82%, transparent); color: var(--web-muted); }
.generate-progress li.is-active { border-color: var(--web-forest); background: var(--web-surface); color: var(--web-ink); }
.generate-progress li.is-complete { color: var(--web-forest); }
.generate-step-content { display: grid; width: 100%; min-width: 0; grid-template-columns: 32px minmax(0, 1fr); align-items: center; gap: 10px; border: 0; border-radius: inherit; padding: 10px 12px; background: transparent; color: inherit; font: inherit; text-align: left; }
button.generate-step-content { cursor: pointer; transition: background 140ms ease; }
button.generate-step-content:hover { background: color-mix(in srgb, var(--web-grass) 12%, transparent); }
.generate-step-number { display: grid; width: 32px; height: 32px; place-items: center; border-radius: 50%; background: var(--web-soft); font-size: 13px; font-weight: 760; }
.generate-progress li.is-active .generate-step-number, .generate-progress li.is-complete .generate-step-number { background: var(--web-grass); color: var(--web-forest); }
.generate-step-label { overflow: hidden; font-size: 14px; font-weight: 690; text-overflow: ellipsis; white-space: nowrap; }
.generate-card { width: 100%; min-width: 0; border: 1px solid var(--web-line); border-radius: 20px; padding: clamp(20px, 3vw, 34px); background: var(--web-surface); }
.generate-card h2 { margin: 0; font-size: clamp(22px, 3vw, 30px); letter-spacing: -.035em; }
.generate-card > p { margin: 8px 0 0; color: var(--web-muted); }
.generate-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 17px 18px; margin-top: 26px; }
.generate-field { display: grid; gap: 6px; }
.generate-field-wide, .generate-form > .profile-editor, .generate-form > .budget-editor, .generate-form-actions { grid-column: 1 / -1; }
.generate-form > .profile-editor, .generate-form > .budget-editor {
  --ink: var(--web-ink);
  --muted: var(--web-muted);
  --line: var(--web-line);
  --line-strong: var(--web-line);
  --soft: var(--web-soft);
  --surface: var(--web-surface);
  --surface-hover: var(--web-soft);
  --focus-border: var(--web-forest);
  --field-ring: color-mix(in srgb, var(--web-forest) 18%, transparent);
  --sendero-forest: var(--web-forest);
  color: var(--web-ink);
}
.generate-field > span, .generate-legend { font-size: 14px; font-weight: 690; }
.generate-field input, .generate-field select, .generate-field textarea { width: 100%; border: 1px solid var(--web-line); border-radius: 10px; padding: 10px 12px; background: var(--web-surface); color: var(--web-ink); }
.generate-field textarea { min-height: 84px; resize: vertical; font: inherit; }
.generate-destination-field > label { font-size: 14px; font-weight: 690; }
.generate-combobox { position: relative; }
.generate-combobox > input { padding-right: 42px; }
.generate-combobox > input[aria-invalid="true"]:not(:focus) { border-color: var(--web-line); }
.generate-combobox > input[aria-invalid="false"] { border-color: color-mix(in srgb, var(--web-forest) 68%, var(--web-line)); }
.generate-destination-check { position: absolute; top: 50%; right: 14px; color: var(--web-forest); font-weight: 800; transform: translateY(-50%); }
.generate-destination-panel { position: absolute; z-index: 20; top: calc(100% + 6px); right: 0; left: 0; overflow: hidden; border: 1px solid var(--web-line); border-radius: 12px; background: var(--web-surface); box-shadow: 0 16px 38px rgba(0, 56, 52, .16); }
.generate-destination-panel ul { margin: 0; padding: 6px; list-style: none; }
.generate-destination-panel li { display: grid; gap: 2px; border-radius: 8px; padding: 10px 11px; cursor: pointer; }
.generate-destination-panel li:hover, .generate-destination-panel li.is-active { background: var(--web-soft); }
.generate-destination-panel li strong { font-size: 14px; }
.generate-destination-panel li span { color: var(--web-muted); font-size: 13px; }
.generate-destination-message { margin: 0; padding: 14px 16px; color: var(--web-muted); font-size: 14px; }
.generate-destination-message.is-error { color: var(--web-danger); }
.generate-destination-attribution { margin: 0; border-top: 1px solid var(--web-line); padding: 6px 11px; color: var(--web-muted); font-size: 11px; font-weight: 680; text-align: right; }
.generate-destination-status { min-height: 18px; margin: 0; color: var(--web-muted); font-size: 12px; }
.generate-destination-status.is-error { color: var(--web-danger); }
.generate-row { display: grid; grid-template-columns: 1fr 1fr; grid-column: 1 / -1; gap: 18px; }
.generate-options { display: flex; flex-wrap: wrap; grid-column: 1 / -1; gap: 8px 12px; border: 0; margin: 0; padding: 0; }
.generate-option { display: inline-flex; align-items: center; gap: 6px; color: var(--web-muted); }
.generate-form > .generate-option { grid-column: 1 / -1; }
.generate-option input { width: 18px; height: 18px; accent-color: var(--web-forest); }
.generate-status { display: grid; gap: 12px; margin-bottom: 18px; }
.generate-notice { border-radius: 14px; padding: 13px 15px; background: var(--web-soft); color: var(--web-muted); }
.generate-notice strong { color: var(--web-ink); }
.generate-notice.is-ready { background: rgba(162, 212, 94, .2); }
.generate-notice.is-error { color: var(--web-danger); }
.generate-form-actions, .generate-handoff-actions, .generate-receipt-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.generate-receipt { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; border-bottom: 1px solid var(--web-line); padding-bottom: 20px; }
.generate-receipt p { margin: 6px 0 0; color: var(--web-muted); }
.generate-handoff { display: grid; gap: 24px; }
.generate-handoff-header { display: grid; max-width: 780px; gap: 8px; }
.generate-handoff-header p { margin: 0; color: var(--web-muted); }
.generate-automatic-note { max-width: 720px; margin: -8px 0 0; color: var(--web-muted); font-size: 14px; }
.generate-handoff-grid { display: grid; grid-template-columns: minmax(300px, .85fr) minmax(0, 1.15fr); gap: 20px; align-items: start; }
.generate-prompt { display: grid; gap: 10px; }
.generate-prompt label { font-size: 14px; font-weight: 720; }
.generate-prompt textarea { width: 100%; min-height: 390px; border: 1px solid var(--web-line); border-radius: 14px; padding: 16px; background: var(--web-soft); color: var(--web-ink); font: inherit; font-size: 14px; line-height: 1.62; resize: vertical; }
.generate-prompt textarea:focus { background: var(--web-surface); }
.generate-handoff-guide { display: grid; gap: 18px; border: 2px solid color-mix(in srgb, var(--web-forest) 72%, var(--web-line)); border-radius: 16px; padding: 22px; background: color-mix(in srgb, var(--web-grass) 12%, var(--web-surface)); }
.generate-handoff-guide h3 { margin: 0; font-size: 18px; }
.generate-handoff-guide p { margin: 6px 0 0; color: var(--web-muted); }
.generate-handoff-guide ol { margin: 0; padding-left: 21px; color: var(--web-muted); }
.generate-handoff-guide li + li { margin-top: 9px; }
.generate-browser-note { border-radius: 10px; padding: 10px 12px; background: var(--web-surface); color: var(--web-muted); font-size: 13px; }
.generate-copy-status { min-height: 21px; margin: 0; color: var(--web-muted); font-size: 13px; }
.generate-live-status { display: grid; grid-template-columns: 13px minmax(0, 1fr); align-items: start; gap: 11px; border: 1px solid var(--web-line); border-radius: 14px; padding: 14px 16px; background: var(--web-soft); }
.generate-live-status-dot { width: 11px; height: 11px; margin-top: 5px; border: 2px solid var(--web-forest); border-radius: 50%; background: transparent; }
.generate-live-status strong { display: block; }
.generate-live-status p { margin: 3px 0 0; color: var(--web-muted); font-size: 14px; }
.generate-live-status.is-ready, .generate-live-status.is-draft_ready, .generate-live-status.is-saved { background: color-mix(in srgb, var(--web-grass) 15%, var(--web-surface)); }
.generate-live-status.is-ready .generate-live-status-dot, .generate-live-status.is-draft_ready .generate-live-status-dot, .generate-live-status.is-saved .generate-live-status-dot { background: var(--web-grass); }
.generate-live-status.is-generating .generate-live-status-dot, .generate-live-status.is-validating .generate-live-status-dot, .generate-live-status.is-saving .generate-live-status-dot, .generate-live-status.is-working .generate-live-status-dot { border-color: var(--web-grass); animation: web-pulse 1.1s ease-in-out infinite alternate; background: var(--web-grass); }
.generate-live-status.is-unavailable, .generate-live-status.is-error { border-color: color-mix(in srgb, var(--web-danger) 45%, var(--web-line)); }
.generate-live-status.is-unavailable .generate-live-status-dot, .generate-live-status.is-error .generate-live-status-dot { border-color: var(--web-danger); }
.generate-webmcp { display: inline-flex; width: fit-content; max-width: 100%; min-height: 40px; align-items: center; gap: 9px; margin-top: 20px; border: 1px solid var(--web-line); border-radius: 999px; padding: 7px 11px; background: color-mix(in srgb, var(--web-surface) 88%, transparent); color: var(--web-ink); cursor: pointer; font: inherit; text-align: left; transition: border-color 140ms ease, background 140ms ease, transform 140ms ease; }
.generate-webmcp:hover { border-color: color-mix(in srgb, var(--web-forest) 38%, var(--web-line)); background: var(--web-surface); transform: translateY(-1px); }
.generate-webmcp-status-dot { width: 10px; height: 10px; border: 2px solid var(--web-forest); border-radius: 50%; }
.generate-webmcp.is-connected .generate-webmcp-status-dot { background: var(--web-grass); }
.generate-webmcp.is-checking .generate-webmcp-status-dot { background: var(--web-grass); animation: web-pulse 1.1s ease-in-out infinite alternate; }
.generate-webmcp.is-unavailable .generate-webmcp-status-dot, .generate-webmcp.is-error .generate-webmcp-status-dot { border-color: var(--web-danger); }
.generate-webmcp-copy { display: flex; min-width: 0; align-items: baseline; gap: 7px; }
.generate-webmcp-copy strong { color: var(--web-ink); font-size: 13px; }
.generate-webmcp-copy small { overflow: hidden; color: var(--web-muted); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.generate-webmcp-count { color: var(--web-forest); font-size: 12px; font-weight: 680; white-space: nowrap; }
.generate-webmcp-info { display: grid; width: 18px; height: 18px; place-items: center; border-radius: 50%; background: var(--web-soft); color: var(--web-forest); font-size: 11px; font-weight: 800; }
.generate-webmcp-modal { width: min(680px, calc(100% - 28px)); max-height: min(760px, calc(100dvh - 40px)); overflow: auto; border: 1px solid var(--web-line); border-radius: 18px; padding: 0; background: var(--web-surface); box-shadow: 0 24px 80px rgba(0, 36, 33, .24); color: var(--web-ink); }
.generate-webmcp-modal::backdrop { background: rgba(0, 31, 29, .46); backdrop-filter: blur(3px); }
.generate-webmcp-modal[open] { animation: webmcp-modal-in 180ms cubic-bezier(.16, 1, .3, 1); }
.generate-webmcp-modal-inner { padding: 22px; }
.generate-webmcp-modal-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }
.generate-webmcp-modal-header h2 { margin: 0; font-size: 22px; letter-spacing: -.025em; }
.generate-webmcp-modal-close { display: grid; width: 34px; height: 34px; flex: 0 0 auto; place-items: center; border: 1px solid var(--web-line); border-radius: 50%; background: var(--web-surface); color: var(--web-muted); cursor: pointer; font: inherit; font-size: 20px; line-height: 1; }
.generate-webmcp-modal-close:hover { border-color: var(--web-forest); color: var(--web-ink); }
.generate-webmcp-modal-detail { margin: 10px 0 20px; color: var(--web-muted); }
.generate-webmcp-modal h3 { margin: 0 0 10px; font-size: 14px; letter-spacing: 0; }
.generate-webmcp-tools { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
.generate-webmcp-tools li { display: grid; gap: 4px; border-radius: 10px; padding: 11px 12px; background: var(--web-soft); }
.generate-webmcp-tools code { overflow-wrap: anywhere; color: var(--web-forest); font-size: 12px; font-weight: 720; }
.generate-webmcp-tools span { color: var(--web-muted); font-size: 13px; }
@keyframes webmcp-modal-in { from { opacity: 0; transform: translateY(8px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
.generate-draft-actions { display: flex; flex-wrap: wrap; gap: 10px; margin: 16px 0; }
.generate-preview { min-width: 0; overflow: hidden; }
.generate-preview .itinerary-viewer { border-radius: 18px; }
@media (max-width: 860px) { .generate-handoff-grid { grid-template-columns: 1fr; } }
@media (max-width: 680px) {
  .generate-progress { grid-template-columns: 1fr; }
  .generate-step-label { white-space: normal; }
  .generate-form { grid-template-columns: 1fr; }
  .generate-form > *, .generate-field-wide, .generate-form > .profile-editor, .generate-form > .budget-editor, .generate-form-actions { grid-column: 1; }
  .generate-row { grid-template-columns: 1fr; grid-column: 1; }
  .generate-receipt { align-items: stretch; flex-direction: column; }
}
@media (max-width: 520px) { .generate-card { padding: 17px; } .generate-handoff-actions .web-button, .generate-form-actions .web-button { width: 100%; } }
@media (max-width: 520px) { .generate-webmcp-copy small, .generate-webmcp-count { display: none; } .generate-webmcp-modal-inner { padding: 18px; } }
@media (prefers-reduced-motion: reduce) { button.generate-step-content, .generate-webmcp, .generate-webmcp-modal[open], .generate-webmcp.is-checking .generate-webmcp-status-dot { animation: none; transition: none; } }
`;

const initialBrief = {
  locale: "es",
  destination: "",
  destinationAccepted: false,
  destinationPlaceId: "",
  startDate: "",
  endDate: "",
  travellers: { adults: 1, children: 0 },
  pace: "balanced",
  interests: [],
  interestsInput: "",
  transport: { modes: ["walk", "public_transit"], hasLicense: false, wantsCar: false },
  lodging: {
    area: "",
    areaPlaceId: "",
    address: "",
    addressPlaceId: "",
    accepted: false,
    status: "undecided",
  },
  budget: budgetDraftFromValue(),
  profile: tripProfileDraftFromBrief(),
  notes: "",
};

const DESTINATION_COPY = {
  en: {
    remaining: (count) => `Type ${count} more ${count === 1 ? "letter" : "letters"} to search.`,
    loading: "Searching cities and countries…",
    empty: "No matching city or country found.",
    error: "Destination search is unavailable. Try again in a moment.",
    choose: "Choose a city or country from the suggestions.",
    selected: "Destination selected.",
    selectionRequired: "Choose the destination from the suggested cities or countries.",
  },
  es: {
    remaining: (count) => `Escribe ${count} ${count === 1 ? "letra más" : "letras más"} para buscar.`,
    loading: "Buscando ciudades y países…",
    empty: "No encontramos una ciudad o país que coincida.",
    error: "La búsqueda de destinos no está disponible. Intenta de nuevo en un momento.",
    choose: "Elige una ciudad o país de las sugerencias.",
    selected: "Destino seleccionado.",
    selectionRequired: "Elige el destino entre las ciudades o países sugeridos.",
  },
  pt: {
    remaining: (count) => `Digite mais ${count} ${count === 1 ? "letra" : "letras"} para buscar.`,
    loading: "Buscando cidades e países…",
    empty: "Nenhuma cidade ou país correspondente foi encontrado.",
    error: "A busca de destinos não está disponível. Tente novamente em instantes.",
    choose: "Escolha uma cidade ou país nas sugestões.",
    selected: "Destino selecionado.",
    selectionRequired: "Escolha o destino entre as cidades ou países sugeridos.",
  },
  fr: {
    remaining: (count) => `Saisissez encore ${count} ${count === 1 ? "lettre" : "lettres"} pour lancer la recherche.`,
    loading: "Recherche de villes et de pays…",
    empty: "Aucune ville ni aucun pays ne correspond.",
    error: "La recherche de destinations est indisponible. Réessayez dans un instant.",
    choose: "Choisissez une ville ou un pays parmi les suggestions.",
    selected: "Destination sélectionnée.",
    selectionRequired: "Choisissez la destination parmi les villes ou pays suggérés.",
  },
  de: {
    remaining: (count) => `Noch ${count} ${count === 1 ? "Buchstabe" : "Buchstaben"} eingeben, um zu suchen.`,
    loading: "Städte und Länder werden gesucht…",
    empty: "Keine passende Stadt und kein passendes Land gefunden.",
    error: "Die Zielsuche ist derzeit nicht verfügbar. Versuche es gleich noch einmal.",
    choose: "Wähle eine Stadt oder ein Land aus den Vorschlägen aus.",
    selected: "Reiseziel ausgewählt.",
    selectionRequired: "Wähle das Reiseziel aus den vorgeschlagenen Städten oder Ländern aus.",
  },
};

const LODGING_SEARCH_COPY = {
  en: {
    loading: "Searching lodgings, addresses, and areas…",
    empty: "No matching lodging, address, or area found in this destination.",
    error: "Lodging search is unavailable. Try again in a moment.",
    choose: "Choose a lodging, address, or area from the suggestions.",
    selected: "Lodging address or area selected.",
    selectionRequired: "Choose the lodging address or area from the suggestions, or leave the field empty.",
    disabled: "Select a destination before searching for a lodging address or area.",
  },
  es: {
    loading: "Buscando alojamientos, direcciones y zonas…",
    empty: "No encontramos un alojamiento, dirección o zona que coincida dentro de este destino.",
    error: "La búsqueda de alojamiento no está disponible. Intenta de nuevo en un momento.",
    choose: "Elige un alojamiento, dirección o zona de las sugerencias.",
    selected: "Dirección o zona de alojamiento seleccionada.",
    selectionRequired: "Elige la dirección o zona de alojamiento de las sugerencias, o deja el campo vacío.",
    disabled: "Selecciona un destino antes de buscar una dirección o zona de alojamiento.",
  },
  pt: {
    loading: "Buscando hospedagens, endereços e áreas…",
    empty: "Nenhuma hospedagem, endereço ou área correspondente foi encontrada neste destino.",
    error: "A busca de hospedagem não está disponível. Tente novamente em instantes.",
    choose: "Escolha uma hospedagem, endereço ou área nas sugestões.",
    selected: "Endereço ou área de hospedagem selecionada.",
    selectionRequired: "Escolha o endereço ou a área de hospedagem nas sugestões, ou deixe o campo vazio.",
    disabled: "Selecione um destino antes de buscar um endereço ou área de hospedagem.",
  },
  fr: {
    loading: "Recherche d’hébergements, d’adresses et de zones…",
    empty: "Aucun hébergement, aucune adresse ni aucune zone ne correspond dans cette destination.",
    error: "La recherche d’hébergement est indisponible. Réessayez dans un instant.",
    choose: "Choisissez un hébergement, une adresse ou une zone parmi les suggestions.",
    selected: "Adresse ou zone d’hébergement sélectionnée.",
    selectionRequired: "Choisissez l’adresse ou la zone d’hébergement parmi les suggestions, ou laissez le champ vide.",
    disabled: "Sélectionnez une destination avant de rechercher une adresse ou une zone d’hébergement.",
  },
  de: {
    loading: "Unterkünfte, Adressen und Gegenden werden gesucht…",
    empty: "In diesem Reiseziel wurde keine passende Unterkunft, Adresse oder Gegend gefunden.",
    error: "Die Unterkunftssuche ist derzeit nicht verfügbar. Versuche es gleich noch einmal.",
    choose: "Wähle eine Unterkunft, Adresse oder Gegend aus den Vorschlägen aus.",
    selected: "Unterkunftsadresse oder -gegend ausgewählt.",
    selectionRequired: "Wähle die Unterkunftsadresse oder -gegend aus den Vorschlägen aus oder lasse das Feld leer.",
    disabled: "Wähle zuerst ein Reiseziel aus, bevor du nach einer Unterkunftsadresse oder -gegend suchst.",
  },
};

function lodgingSearchCopy(language) {
  const resolvedLanguage = LODGING_SEARCH_COPY[language] ? language : "es";
  return {
    remaining: DESTINATION_COPY[resolvedLanguage].remaining,
    ...LODGING_SEARCH_COPY[resolvedLanguage],
  };
}

const COPY = {
  en: {
    destination: "Destination", destinationPlaceholder: "City and country", arrival: "Arrival", departure: "Departure",
    adults: "Adults", children: "Children", transport: "Transport", modes: { walk: "On foot", public_transit: "Public transport", taxi: "Taxi", car: "Car" },
    licence: "At least one person has a valid driving licence",
    address: "Lodging address or area", addressPlaceholder: "Lodging, address, neighbourhood, or area; optional", optional: "Optional", pace: "Pace", paces: { relaxed: "Relaxed", balanced: "Balanced", intense: "Intense" },
    interests: "Interests", interestsPlaceholder: "Architecture, local food, music…", notes: "Notes and constraints", notesPlaceholder: "Fixed plans, accessibility, things to avoid…",
    budget: {
      title: "Budget", description: "Set a spending style and, if useful, a monetary limit.", comfort: "Spending style", comforts: { flexible: "Flexible", low: "Economy", medium: "Mid-range", high: "Premium" },
      amount: "Limit", amountExample: "e.g.", optional: "Optional", currency: "Currency", currencyPlaceholder: "Choose a currency", scope: "Applied to", scopes: { total: "Whole trip", per_person: "Per person", per_day: "Per day" },
      flexibility: "How firm is it?", flexibilities: { strict: "Hard cap", target: "Target", flexible: "Reference" }, includes: "Counts toward the limit",
      categories: { activities: "Activities", food: "Food", local_transport: "Local transport", lodging: "Lodging", long_distance_transport: "Travel to destination" },
      note: "Lodging and travel to the destination count only when selected. Sendero uses price ranges, not false precision.",
    },
    prepare: "Prepare for ChatGPT", protocolReady: "The brief is complete. ChatGPT can now research and generate the itinerary with the current protocol.",
    criticalMissing: (fields) => `Critical details are missing: ${fields}.`, prepareError: "We couldn't prepare the trip.", saved: "The trip was saved in Sendero.",
    saveError: "We couldn't save the trip.", discarded: "The local draft was discarded.", discardError: "We couldn't discard the draft.",
    loading: "Preparing the planner…", signIn: "Sign in", signedOutDetail: "Your Sendero session protects the drafts and trips ChatGPT creates from this page.", signedOutTitle: "Sign in to plan",
    back: "Back to your trips", unavailableDetail: "This capability is not enabled in this environment yet. Open Sendero in the ChatGPT desktop app's integrated browser to use the WebMCP flow.", unavailableTitle: "Web generation unavailable",
    retry: "Try again", errorDetail: "No trip was changed or saved.", errorTitle: "We couldn't open the planner", eyebrow: "Conversational planning", title: "Create a trip",
    description: "Sendero provides the rules, validates the result, and saves it. ChatGPT researches and builds the itinerary in the active conversation.",
    draftReady: "Local draft ready", draftExpired: "This draft is no longer available.", save: "Save in Sendero", createAccountToSave: "Create an account to save and share", discard: "Discard draft", open: "Open saved trip",
    conversation: "Conversation + Sendero", emptyTitle: "Your itinerary will appear here", emptyDetail: "Complete the brief and ask ChatGPT to generate it. Sendero validates the result before it can be saved.",
    steps: ["Complete the trip essentials.", "Continue the research and generation in ChatGPT.", "Review and save the validated draft in Sendero."],
    webmcpConnected: "WebMCP connected.", webmcpBrowser: "Integrated browser mode.", webmcpAvailable: "ChatGPT can use the generation tools while this page remains open in its integrated browser.", webmcpUnavailable: "Open Sendero in the ChatGPT desktop app's integrated browser to enable the WebMCP generation flow.",
    contextTitle: "Trip context", contextDetail: "Complete the essentials. ChatGPT can enrich this brief with what you already discussed.", protocol: "Protocol",
    savedTitle: "Saved trip", draftTitle: "Validated draft", savedDetail: "This trip is now in your Sendero account and ready to share.", draftDetail: "This itinerary is ready to review. Save it when you want to add it to your trips and share it.", anonymousDraftDetail: "This itinerary stays in this browser until you discard or replace it. Create or sign in to an account to keep it across devices and share it.",
    emptyPreviewTitle: "Your itinerary will appear here after validation.", emptySteps: ["Prepare the brief.", "Ask ChatGPT to create the itinerary with Sendero.", "Review the draft and save it explicitly."],
    viewTrips: "View my trips",
    documentTitle: "Create a trip",
  },
  es: {
    destination: "Destino", destinationPlaceholder: "Ciudad y país", arrival: "Llegada", departure: "Salida",
    adults: "Adultos", children: "Niños", transport: "Transporte", modes: { walk: "A pie", public_transit: "Transporte público", taxi: "Taxi", car: "Auto" },
    licence: "Al menos una persona tiene licencia válida",
    address: "Dirección o zona de alojamiento", addressPlaceholder: "Alojamiento, dirección, barrio o zona; opcional", optional: "Opcional", pace: "Ritmo", paces: { relaxed: "Relajado", balanced: "Equilibrado", intense: "Intenso" },
    interests: "Intereses", interestsPlaceholder: "Arquitectura, comida local, música…", notes: "Notas y restricciones", notesPlaceholder: "Planes fijos, accesibilidad, cosas que evitar…",
    budget: {
      title: "Presupuesto", description: "Define el estilo de gasto y, si sirve, un límite monetario.", comfort: "Estilo de gasto", comforts: { flexible: "Flexible", low: "Económico", medium: "Medio", high: "Premium" },
      amount: "Límite", amountExample: "ej.", optional: "Opcional", currency: "Moneda", currencyPlaceholder: "Selecciona una moneda", scope: "Se aplica a", scopes: { total: "Todo el viaje", per_person: "Por persona", per_day: "Por día" },
      flexibility: "¿Qué tan firme es?", flexibilities: { strict: "Tope estricto", target: "Objetivo", flexible: "Referencia" }, includes: "Cuenta dentro del límite",
      categories: { activities: "Actividades", food: "Comidas", local_transport: "Transporte local", lodging: "Alojamiento", long_distance_transport: "Viaje al destino" },
      note: "Alojamiento y viaje al destino cuentan solo si los seleccionas. Sendero usa rangos, no falsa precisión.",
    },
    prepare: "Preparar para ChatGPT", protocolReady: "El brief está completo. ChatGPT ya puede investigar y generar el itinerario con el protocolo actual.",
    criticalMissing: (fields) => `Faltan datos críticos: ${fields}.`, prepareError: "No pudimos preparar el viaje.", saved: "El viaje quedó guardado en Sendero.",
    saveError: "No pudimos guardar el viaje.", discarded: "El borrador local fue descartado.", discardError: "No pudimos descartar el borrador.",
    loading: "Preparando el planificador…", signIn: "Ingresar", signedOutDetail: "Tu sesión de Sendero protege los borradores y viajes que ChatGPT cree desde esta página.", signedOutTitle: "Inicia sesión para planificar",
    back: "Volver a tus viajes", unavailableDetail: "Esta capacidad todavía no está activada en este ambiente. Abre Sendero en el navegador integrado de la app de escritorio de ChatGPT para usar el flujo WebMCP.", unavailableTitle: "Generación web no disponible",
    retry: "Intentar de nuevo", errorDetail: "No se modificó ni guardó ningún viaje.", errorTitle: "No pudimos abrir el planificador", eyebrow: "Planificación conversacional", title: "Crear un viaje",
    description: "Sendero aporta las reglas, valida el resultado y lo guarda. ChatGPT investiga y construye el itinerario en la conversación activa.",
    draftReady: "Borrador local listo", draftExpired: "Este borrador ya no está disponible.", save: "Guardar en Sendero", createAccountToSave: "Crear cuenta para guardar y compartir", discard: "Descartar borrador", open: "Abrir viaje guardado",
    conversation: "Conversación + Sendero", emptyTitle: "Tu itinerario aparecerá aquí", emptyDetail: "Completa el brief y pídele a ChatGPT que lo genere. Sendero valida el resultado antes de permitir guardarlo.",
    steps: ["Completa lo esencial del viaje.", "Continúa la investigación y generación en ChatGPT.", "Revisa y guarda el borrador validado en Sendero."],
    webmcpConnected: "WebMCP conectado.", webmcpBrowser: "Modo navegador integrado.", webmcpAvailable: "ChatGPT tiene disponibles las herramientas de generación mientras esta página permanezca abierta en su navegador integrado.", webmcpUnavailable: "Abre Sendero en el navegador integrado de la app de escritorio de ChatGPT para habilitar el flujo de generación WebMCP.",
    contextTitle: "Contexto del viaje", contextDetail: "Completa lo esencial. ChatGPT puede enriquecer este brief con lo que ya hablaron.", protocol: "Protocolo",
    savedTitle: "Viaje guardado", draftTitle: "Borrador validado", savedDetail: "Este viaje ya está en tu cuenta de Sendero y listo para compartir.", draftDetail: "Este itinerario está listo para revisar. Guárdalo cuando quieras agregarlo a tus viajes y compartirlo.", anonymousDraftDetail: "Este itinerario permanece en este navegador hasta que lo descartes o reemplaces. Crea una cuenta o inicia sesión para conservarlo entre dispositivos y compartirlo.",
    emptyPreviewTitle: "Tu itinerario aparecerá aquí después de validarse.", emptySteps: ["Prepara el brief.", "Pide a ChatGPT que cree el itinerario con Sendero.", "Revisa el borrador y guárdalo explícitamente."],
    viewTrips: "Ver mis viajes",
    documentTitle: "Crear un viaje",
  },
  pt: {
    destination: "Destino", destinationPlaceholder: "Cidade e país", arrival: "Chegada", departure: "Saída",
    adults: "Adultos", children: "Crianças", transport: "Transporte", modes: { walk: "A pé", public_transit: "Transporte público", taxi: "Táxi", car: "Carro" },
    licence: "Pelo menos uma pessoa tem carteira de motorista válida",
    address: "Endereço ou área de hospedagem", addressPlaceholder: "Hospedagem, endereço, bairro ou área; opcional", optional: "Opcional", pace: "Ritmo", paces: { relaxed: "Tranquilo", balanced: "Equilibrado", intense: "Intenso" },
    interests: "Interesses", interestsPlaceholder: "Arquitetura, comida local, música…", notes: "Observações e restrições", notesPlaceholder: "Planos fixos, acessibilidade, coisas a evitar…",
    budget: {
      title: "Orçamento", description: "Defina o estilo de gasto e, se for útil, um limite monetário.", comfort: "Estilo de gasto", comforts: { flexible: "Flexível", low: "Econômico", medium: "Médio", high: "Premium" },
      amount: "Limite", amountExample: "ex.", optional: "Opcional", currency: "Moeda", currencyPlaceholder: "Selecione uma moeda", scope: "Aplicado a", scopes: { total: "Viagem inteira", per_person: "Por pessoa", per_day: "Por dia" },
      flexibility: "Quão rígido é?", flexibilities: { strict: "Teto rígido", target: "Meta", flexible: "Referência" }, includes: "Conta no limite",
      categories: { activities: "Atividades", food: "Alimentação", local_transport: "Transporte local", lodging: "Hospedagem", long_distance_transport: "Viagem até o destino" },
      note: "Hospedagem e viagem até o destino contam somente quando selecionadas. O Sendero usa faixas, não falsa precisão.",
    },
    prepare: "Preparar para o ChatGPT", protocolReady: "O brief está completo. O ChatGPT já pode pesquisar e gerar o roteiro com o protocolo atual.",
    criticalMissing: (fields) => `Faltam dados críticos: ${fields}.`, prepareError: "Não foi possível preparar a viagem.", saved: "A viagem foi salva no Sendero.",
    saveError: "Não foi possível salvar a viagem.", discarded: "O rascunho local foi descartado.", discardError: "Não foi possível descartar o rascunho.",
    loading: "Preparando o planejador…", signIn: "Entrar", signedOutDetail: "Sua sessão do Sendero protege os rascunhos e viagens que o ChatGPT criar nesta página.", signedOutTitle: "Entre para planejar",
    back: "Voltar às suas viagens", unavailableDetail: "Esta capacidade ainda não está ativa neste ambiente. Abra o Sendero no navegador integrado do app ChatGPT para desktop para usar o fluxo WebMCP.", unavailableTitle: "Geração web indisponível",
    retry: "Tentar novamente", errorDetail: "Nenhuma viagem foi alterada ou salva.", errorTitle: "Não foi possível abrir o planejador", eyebrow: "Planejamento conversacional", title: "Criar uma viagem",
    description: "O Sendero fornece as regras, valida o resultado e o salva. O ChatGPT pesquisa e constrói o roteiro na conversa ativa.",
    draftReady: "Rascunho local pronto", draftExpired: "Este rascunho não está mais disponível.", save: "Salvar no Sendero", createAccountToSave: "Criar conta para salvar e compartilhar", discard: "Descartar rascunho", open: "Abrir viagem salva",
    conversation: "Conversa + Sendero", emptyTitle: "Seu roteiro aparecerá aqui", emptyDetail: "Complete o brief e peça ao ChatGPT para gerá-lo. O Sendero valida o resultado antes de permitir salvá-lo.",
    steps: ["Complete o essencial da viagem.", "Continue a pesquisa e geração no ChatGPT.", "Revise e salve o rascunho validado no Sendero."],
    webmcpConnected: "WebMCP conectado.", webmcpBrowser: "Modo de navegador integrado.", webmcpAvailable: "O ChatGPT pode usar as ferramentas de geração enquanto esta página permanecer aberta no navegador integrado.", webmcpUnavailable: "Abra o Sendero no navegador integrado do app ChatGPT para desktop para ativar o fluxo de geração WebMCP.",
    contextTitle: "Contexto da viagem", contextDetail: "Complete o essencial. O ChatGPT pode enriquecer este brief com o que vocês já conversaram.", protocol: "Protocolo",
    savedTitle: "Viagem salva", draftTitle: "Rascunho validado", savedDetail: "Esta viagem já está na sua conta do Sendero e pronta para compartilhar.", draftDetail: "Este roteiro está pronto para revisão. Salve-o quando quiser adicioná-lo às suas viagens e compartilhá-lo.", anonymousDraftDetail: "Este roteiro permanece neste navegador até ser descartado ou substituído. Crie uma conta ou entre para mantê-lo entre dispositivos e compartilhá-lo.",
    emptyPreviewTitle: "Seu roteiro aparecerá aqui depois de ser validado.", emptySteps: ["Prepare o brief.", "Peça ao ChatGPT para criar o roteiro com o Sendero.", "Revise o rascunho e salve-o explicitamente."],
    viewTrips: "Ver minhas viagens",
    documentTitle: "Criar uma viagem",
  },
  fr: {
    destination: "Destination", destinationPlaceholder: "Ville et pays", arrival: "Arrivée", departure: "Départ",
    adults: "Adultes", children: "Enfants", transport: "Transport", modes: { walk: "À pied", public_transit: "Transports en commun", taxi: "Taxi", car: "Voiture" },
    licence: "Au moins une personne possède un permis de conduire valide",
    address: "Adresse ou zone d’hébergement", addressPlaceholder: "Hébergement, adresse, quartier ou zone ; facultatif", optional: "Facultatif", pace: "Rythme", paces: { relaxed: "Détendu", balanced: "Équilibré", intense: "Intense" },
    interests: "Centres d’intérêt", interestsPlaceholder: "Architecture, cuisine locale, musique…", notes: "Notes et contraintes", notesPlaceholder: "Plans fixes, accessibilité, choses à éviter…",
    budget: {
      title: "Budget", description: "Définissez le niveau de dépenses et, si utile, une limite monétaire.", comfort: "Niveau de dépenses", comforts: { flexible: "Flexible", low: "Économique", medium: "Intermédiaire", high: "Premium" },
      amount: "Limite", amountExample: "p. ex.", optional: "Facultatif", currency: "Devise", currencyPlaceholder: "Choisissez une devise", scope: "S’applique à", scopes: { total: "Tout le voyage", per_person: "Par personne", per_day: "Par jour" },
      flexibility: "Quel degré de fermeté ?", flexibilities: { strict: "Plafond strict", target: "Objectif", flexible: "Référence" }, includes: "Pris en compte dans la limite",
      categories: { activities: "Activités", food: "Repas", local_transport: "Transports locaux", lodging: "Hébergement", long_distance_transport: "Trajet vers la destination" },
      note: "L’hébergement et le trajet vers la destination ne comptent que s’ils sont sélectionnés. Sendero utilise des fourchettes, sans fausse précision.",
    },
    prepare: "Préparer pour ChatGPT", protocolReady: "Le brief est complet. ChatGPT peut maintenant rechercher et générer l’itinéraire avec le protocole actuel.",
    criticalMissing: (fields) => `Informations essentielles manquantes : ${fields}.`, prepareError: "Impossible de préparer le voyage.", saved: "Le voyage a été enregistré dans Sendero.",
    saveError: "Impossible d’enregistrer le voyage.", discarded: "Le brouillon local a été supprimé.", discardError: "Impossible de supprimer le brouillon.",
    loading: "Préparation du planificateur…", signIn: "Se connecter", signedOutDetail: "Votre session Sendero protège les brouillons et voyages créés par ChatGPT depuis cette page.", signedOutTitle: "Connectez-vous pour planifier",
    back: "Retour à vos voyages", unavailableDetail: "Cette fonctionnalité n’est pas encore activée dans cet environnement. Ouvrez Sendero dans le navigateur intégré de l’application de bureau ChatGPT pour utiliser le parcours WebMCP.", unavailableTitle: "Génération web indisponible",
    retry: "Réessayer", errorDetail: "Aucun voyage n’a été modifié ni enregistré.", errorTitle: "Impossible d’ouvrir le planificateur", eyebrow: "Planification conversationnelle", title: "Créer un voyage",
    description: "Sendero fournit les règles, valide le résultat et l’enregistre. ChatGPT effectue les recherches et construit l’itinéraire dans la conversation active.",
    draftReady: "Brouillon local prêt", draftExpired: "Ce brouillon n’est plus disponible.", save: "Enregistrer dans Sendero", createAccountToSave: "Créer un compte pour enregistrer et partager", discard: "Supprimer le brouillon", open: "Ouvrir le voyage enregistré",
    conversation: "Conversation + Sendero", emptyTitle: "Votre itinéraire apparaîtra ici", emptyDetail: "Complétez le brief et demandez à ChatGPT de le générer. Sendero valide le résultat avant qu’il puisse être enregistré.",
    steps: ["Complétez l’essentiel du voyage.", "Poursuivez la recherche et la génération dans ChatGPT.", "Vérifiez et enregistrez le brouillon validé dans Sendero."],
    webmcpConnected: "WebMCP connecté.", webmcpBrowser: "Mode navigateur intégré.", webmcpAvailable: "ChatGPT peut utiliser les outils de génération tant que cette page reste ouverte dans son navigateur intégré.", webmcpUnavailable: "Ouvrez Sendero dans le navigateur intégré de l’application de bureau ChatGPT pour activer le parcours de génération WebMCP.",
    contextTitle: "Contexte du voyage", contextDetail: "Complétez l’essentiel. ChatGPT peut enrichir ce brief avec les éléments déjà abordés.", protocol: "Protocole",
    savedTitle: "Voyage enregistré", draftTitle: "Brouillon validé", savedDetail: "Ce voyage est maintenant dans votre compte Sendero et prêt à être partagé.", draftDetail: "Cet itinéraire est prêt à être vérifié. Enregistrez-le lorsque vous souhaitez l’ajouter à vos voyages et le partager.", anonymousDraftDetail: "Cet itinéraire reste dans ce navigateur jusqu’à ce que vous le supprimiez ou le remplaciez. Créez un compte ou connectez-vous pour le conserver sur plusieurs appareils et le partager.",
    emptyPreviewTitle: "Votre itinéraire apparaîtra ici après validation.", emptySteps: ["Préparez le brief.", "Demandez à ChatGPT de créer l’itinéraire avec Sendero.", "Vérifiez le brouillon et enregistrez-le explicitement."],
    viewTrips: "Voir mes voyages",
    documentTitle: "Créer un voyage",
  },
  de: {
    destination: "Reiseziel", destinationPlaceholder: "Stadt und Land", arrival: "Anreise", departure: "Abreise",
    adults: "Erwachsene", children: "Kinder", transport: "Verkehrsmittel", modes: { walk: "Zu Fuß", public_transit: "Öffentliche Verkehrsmittel", taxi: "Taxi", car: "Auto" },
    licence: "Mindestens eine Person besitzt einen gültigen Führerschein",
    address: "Unterkunftsadresse oder -gegend", addressPlaceholder: "Unterkunft, Adresse, Viertel oder Gegend; optional", optional: "Optional", pace: "Tempo", paces: { relaxed: "Entspannt", balanced: "Ausgewogen", intense: "Intensiv" },
    interests: "Interessen", interestsPlaceholder: "Architektur, lokale Küche, Musik…", notes: "Hinweise und Einschränkungen", notesPlaceholder: "Feste Pläne, Barrierefreiheit, zu vermeidende Dinge…",
    budget: {
      title: "Budget", description: "Lege den Ausgabenstil und bei Bedarf eine Geldgrenze fest.", comfort: "Ausgabenstil", comforts: { flexible: "Flexibel", low: "Günstig", medium: "Mittel", high: "Premium" },
      amount: "Grenze", amountExample: "z. B.", optional: "Optional", currency: "Währung", currencyPlaceholder: "Währung auswählen", scope: "Gilt für", scopes: { total: "Gesamte Reise", per_person: "Pro Person", per_day: "Pro Tag" },
      flexibility: "Wie verbindlich?", flexibilities: { strict: "Feste Obergrenze", target: "Ziel", flexible: "Richtwert" }, includes: "Wird auf die Grenze angerechnet",
      categories: { activities: "Aktivitäten", food: "Verpflegung", local_transport: "Nahverkehr", lodging: "Unterkunft", long_distance_transport: "Anreise zum Ziel" },
      note: "Unterkunft und Anreise zählen nur, wenn sie ausgewählt sind. Sendero arbeitet mit Spannen statt mit Scheingenauigkeit.",
    },
    prepare: "Für ChatGPT vorbereiten", protocolReady: "Die Angaben sind vollständig. ChatGPT kann den Reiseplan jetzt mit dem aktuellen Protokoll recherchieren und erstellen.",
    criticalMissing: (fields) => `Wesentliche Angaben fehlen: ${fields}.`, prepareError: "Die Reise konnte nicht vorbereitet werden.", saved: "Die Reise wurde in Sendero gespeichert.",
    saveError: "Die Reise konnte nicht gespeichert werden.", discarded: "Der lokale Entwurf wurde verworfen.", discardError: "Der Entwurf konnte nicht verworfen werden.",
    loading: "Planer wird vorbereitet…", signIn: "Anmelden", signedOutDetail: "Deine Sendero-Sitzung schützt die Entwürfe und Reisen, die ChatGPT von dieser Seite aus erstellt.", signedOutTitle: "Zum Planen anmelden",
    back: "Zurück zu deinen Reisen", unavailableDetail: "Diese Funktion ist in dieser Umgebung noch nicht aktiviert. Öffne Sendero im integrierten Browser der ChatGPT-Desktop-App, um den WebMCP-Ablauf zu verwenden.", unavailableTitle: "Web-Generierung nicht verfügbar",
    retry: "Erneut versuchen", errorDetail: "Es wurde keine Reise geändert oder gespeichert.", errorTitle: "Der Planer konnte nicht geöffnet werden", eyebrow: "Reiseplanung im Gespräch", title: "Reise erstellen",
    description: "Sendero stellt die Regeln bereit, prüft das Ergebnis und speichert es. ChatGPT recherchiert und erstellt den Reiseplan in der aktiven Unterhaltung.",
    draftReady: "Lokaler Entwurf bereit", draftExpired: "Dieser Entwurf ist nicht mehr verfügbar.", save: "In Sendero speichern", createAccountToSave: "Konto erstellen, um zu speichern und zu teilen", discard: "Entwurf verwerfen", open: "Gespeicherte Reise öffnen",
    conversation: "Unterhaltung + Sendero", emptyTitle: "Dein Reiseplan erscheint hier", emptyDetail: "Vervollständige die Angaben und bitte ChatGPT, ihn zu erstellen. Sendero prüft das Ergebnis, bevor es gespeichert werden kann.",
    steps: ["Vervollständige das Wichtigste zur Reise.", "Setze Recherche und Erstellung in ChatGPT fort.", "Prüfe den validierten Entwurf und speichere ihn in Sendero."],
    webmcpConnected: "WebMCP verbunden.", webmcpBrowser: "Integrierter Browsermodus.", webmcpAvailable: "ChatGPT kann die Generierungswerkzeuge verwenden, solange diese Seite im integrierten Browser geöffnet bleibt.", webmcpUnavailable: "Öffne Sendero im integrierten Browser der ChatGPT-Desktop-App, um den WebMCP-Generierungsablauf zu aktivieren.",
    contextTitle: "Reisekontext", contextDetail: "Vervollständige das Wichtigste. ChatGPT kann diese Angaben mit bereits Besprochenem ergänzen.", protocol: "Protokoll",
    savedTitle: "Gespeicherte Reise", draftTitle: "Validierter Entwurf", savedDetail: "Diese Reise ist jetzt in deinem Sendero-Konto und kann geteilt werden.", draftDetail: "Dieser Reiseplan kann jetzt geprüft werden. Speichere ihn, wenn du ihn zu deinen Reisen hinzufügen und teilen möchtest.", anonymousDraftDetail: "Dieser Reiseplan bleibt in diesem Browser, bis du ihn verwirfst oder ersetzt. Erstelle ein Konto oder melde dich an, um ihn geräteübergreifend zu behalten und zu teilen.",
    emptyPreviewTitle: "Dein Reiseplan erscheint hier nach der Validierung.", emptySteps: ["Bereite die Angaben vor.", "Bitte ChatGPT, den Reiseplan mit Sendero zu erstellen.", "Prüfe den Entwurf und speichere ihn ausdrücklich."],
    viewTrips: "Meine Reisen anzeigen",
    documentTitle: "Reise erstellen",
  },
};

const FLOW_COPY = {
  en: {
    description: "Tell us about the trip. Sendero prepares the handoff, ChatGPT creates the itinerary, and Sendero validates it before anything is saved.",
    progressLabel: "Itinerary creation progress",
    progress: ["Trip details", "Itinerary generation", "Review and save"],
    contextTitle: "Tell us about your trip",
    contextDetail: "Complete the essentials and add as much or as little optional detail as you want.",
    prepare: "Generate prompt",
    invalidDates: "The departure date must be the same as or later than the arrival date.",
    invalidDayTimes: "For a one-day trip, the departure time must be later than the arrival time.",
    licenceRequired: "Choose another transport option or confirm that at least one traveller has a valid driving licence.",
    receiptTitle: "Trip details ready",
    receiptDetail: ({ destination, startDate, endDate }) => `${destination} · ${startDate}–${endDate}`,
    editBrief: "Edit details",
    handoffEyebrow: "Step 2 · Itinerary generation",
    handoffTitle: "Your prompt is ready",
    handoffDetail: "This integrated flow runs in the ChatGPT desktop app's built-in browser. Keep Sendero open so ChatGPT can use this page's WebMCP tools.",
    automaticTitle: "Your itinerary is being generated",
    automaticDetail: "ChatGPT sent the trip details directly through this page's WebMCP workflow. Sendero will open the itinerary here as soon as validation finishes.",
    automaticNote: "You can keep reviewing this page while ChatGPT researches and builds the plan. No prompt needs to be copied.",
    promptLabel: "Prompt to paste in ChatGPT",
    copyPrompt: "Copy prompt",
    copied: "Prompt copied. Paste it into this ChatGPT conversation without closing Sendero.",
    copyError: "We couldn't copy it automatically. Select the prompt and copy it manually.",
    recommended: "Required",
    sideChatTitle: "Continue in ChatGPT's integrated browser",
    sideChatDetail: "Keep this Sendero page open in the ChatGPT desktop app. The active conversation can discover and use the WebMCP tools exposed by this page.",
    sideChatSteps: ["Keep this Sendero page open in ChatGPT's integrated browser.", "Copy the prompt on this page.", "Paste and send it in this ChatGPT conversation. Sendero will show progress and open the validated draft here."],
    browserNote: "The ChatGPT Chrome extension, ChatGPT web, and external browsers do not provide this integrated WebMCP flow.",
    waiting: "ChatGPT will create the itinerary with Sendero. Nothing is saved without your explicit approval.",
    generationStatus: {
      connecting: { title: "Connecting this page to ChatGPT", detail: "Sendero is checking whether this browser exposes its page tools." },
      ready: { title: "This page is ready", detail: "When ChatGPT starts with Sendero, progress and the validated draft will appear here automatically." },
      waiting: { title: "Waiting for ChatGPT", detail: "The prompt is copied. Send it in this ChatGPT conversation while keeping the integrated browser open." },
      generating: { title: "ChatGPT started the itinerary", detail: "Sendero received the start of the page workflow. Keep this page open while ChatGPT researches and builds the plan." },
      working: { title: "ChatGPT is working with Sendero", detail: "This page received an itinerary operation and will update when an authoritative result is available." },
      validating: { title: "Sendero is validating the itinerary", detail: "The completed plan is being checked before the review step becomes available." },
      saving: { title: "Sendero is saving the approved trip", detail: "Wait for the saved trip and its version to appear here." },
      draft_ready: { title: "Validated draft received", detail: "Sendero is opening the review step." },
      saved: { title: "Trip saved", detail: "The authoritative saved trip is now available in Sendero." },
      unavailable: { title: "Open Sendero in ChatGPT's integrated browser", detail: "This browser is not exposing Sendero's WebMCP tools. Chrome, the ChatGPT extension, and ChatGPT web cannot update this step or prove a save in this Sendero session." },
      error: { title: "The Sendero operation did not finish", detail: "No success is assumed. Retry from ChatGPT or keep the prompt and try again." },
    },
    previewEyebrow: "Step 3 · Review in Sendero",
  },
  es: {
    description: "Cuéntanos sobre el viaje. Sendero prepara el traspaso, ChatGPT crea el itinerario y Sendero lo valida antes de guardar nada.",
    progressLabel: "Progreso de creación del itinerario",
    progress: ["Datos del viaje", "Generación del itinerario", "Revisar y guardar"],
    contextTitle: "Cuéntanos sobre tu viaje",
    contextDetail: "Completa lo esencial y añade tantos detalles opcionales como quieras.",
    prepare: "Generar prompt",
    invalidDates: "La fecha de salida debe ser igual o posterior a la fecha de llegada.",
    invalidDayTimes: "En un viaje de un día, la hora de salida debe ser posterior a la hora de llegada.",
    licenceRequired: "Elige otro transporte o confirma que al menos una persona tiene una licencia de conducir válida.",
    receiptTitle: "Datos del viaje listos",
    receiptDetail: ({ destination, startDate, endDate }) => `${destination} · ${startDate}–${endDate}`,
    editBrief: "Editar datos",
    handoffEyebrow: "Paso 2 · Generación del itinerario",
    handoffTitle: "Tu prompt está listo",
    handoffDetail: "Este flujo integrado funciona en el navegador interno de la app de escritorio de ChatGPT. Mantén Sendero abierto para que ChatGPT use las herramientas WebMCP de esta página.",
    automaticTitle: "Estamos generando tu itinerario",
    automaticDetail: "ChatGPT envió los datos del viaje directamente mediante el flujo WebMCP de esta página. Sendero abrirá aquí el itinerario apenas termine de validarlo.",
    automaticNote: "Puedes seguir viendo esta página mientras ChatGPT investiga y arma el plan. No necesitas copiar ningún prompt.",
    promptLabel: "Prompt para pegar en ChatGPT",
    copyPrompt: "Copiar prompt",
    copied: "Prompt copiado. Pégalo en esta conversación de ChatGPT sin cerrar Sendero.",
    copyError: "No pudimos copiarlo automáticamente. Selecciona el prompt y cópialo manualmente.",
    recommended: "Requerido",
    sideChatTitle: "Continúa en el navegador integrado de ChatGPT",
    sideChatDetail: "Mantén esta página de Sendero abierta en la app de escritorio de ChatGPT. La conversación activa puede descubrir y usar las herramientas WebMCP expuestas por esta página.",
    sideChatSteps: ["Mantén esta página de Sendero abierta en el navegador integrado de ChatGPT.", "Copia el prompt de esta página.", "Pégalo y envíalo en esta conversación de ChatGPT. Sendero mostrará el progreso y abrirá aquí el borrador validado."],
    browserNote: "La extensión de ChatGPT para Chrome, ChatGPT web y los navegadores externos no ofrecen este flujo WebMCP integrado.",
    waiting: "ChatGPT creará el itinerario con Sendero. Nada se guarda sin tu aprobación explícita.",
    generationStatus: {
      connecting: { title: "Conectando esta página con ChatGPT", detail: "Sendero está comprobando si este navegador expone sus herramientas de página." },
      ready: { title: "Esta página está lista", detail: "Cuando ChatGPT empiece a trabajar con Sendero, el progreso y el borrador validado aparecerán aquí automáticamente." },
      waiting: { title: "Esperando a ChatGPT", detail: "El prompt está copiado. Envíalo en esta conversación de ChatGPT y mantén abierto el navegador integrado." },
      generating: { title: "ChatGPT empezó a crear el itinerario", detail: "Sendero recibió el inicio del flujo de la página. Mantenla abierta mientras ChatGPT investiga y arma el plan." },
      working: { title: "ChatGPT está trabajando con Sendero", detail: "Esta página recibió una operación del itinerario y se actualizará cuando exista un resultado autoritativo." },
      validating: { title: "Sendero está validando el itinerario", detail: "El plan completo se está comprobando antes de habilitar el paso de revisión." },
      saving: { title: "Sendero está guardando el viaje aprobado", detail: "Espera a que el viaje guardado y su versión aparezcan aquí." },
      draft_ready: { title: "Borrador validado recibido", detail: "Sendero está abriendo el paso de revisión." },
      saved: { title: "Viaje guardado", detail: "La versión autoritativa ya está disponible en Sendero." },
      unavailable: { title: "Abre Sendero en el navegador integrado de ChatGPT", detail: "Este navegador no expone las herramientas WebMCP de Sendero. Chrome, la extensión de ChatGPT y ChatGPT web no pueden actualizar este paso ni comprobar el guardado en esta sesión de Sendero." },
      error: { title: "La operación de Sendero no terminó", detail: "No asumimos que salió bien. Reintenta desde ChatGPT o conserva el prompt y vuelve a probar." },
    },
    previewEyebrow: "Paso 3 · Revisar en Sendero",
  },
  pt: {
    description: "Conte-nos sobre a viagem. O Sendero prepara a passagem, o ChatGPT cria o roteiro e o Sendero o valida antes de salvar qualquer coisa.",
    progressLabel: "Progresso da criação do roteiro",
    progress: ["Dados da viagem", "Geração do roteiro", "Revisar e salvar"],
    contextTitle: "Conte-nos sobre sua viagem",
    contextDetail: "Preencha o essencial e acrescente quantos detalhes opcionais quiser.",
    prepare: "Gerar prompt",
    invalidDates: "A data de partida deve ser igual ou posterior à data de chegada.",
    invalidDayTimes: "Em uma viagem de um dia, o horário de partida deve ser posterior ao de chegada.",
    licenceRequired: "Escolha outro transporte ou confirme que pelo menos uma pessoa tem carteira de motorista válida.",
    receiptTitle: "Dados da viagem prontos",
    receiptDetail: ({ destination, startDate, endDate }) => `${destination} · ${startDate}–${endDate}`,
    editBrief: "Editar dados",
    handoffEyebrow: "Etapa 2 · Geração do roteiro",
    handoffTitle: "Seu prompt está pronto",
    handoffDetail: "Este fluxo integrado funciona no navegador interno do app ChatGPT para desktop. Mantenha o Sendero aberto para que o ChatGPT use as ferramentas WebMCP desta página.",
    automaticTitle: "Seu roteiro está sendo gerado",
    automaticDetail: "O ChatGPT enviou os dados da viagem diretamente pelo fluxo WebMCP desta página. O Sendero abrirá o roteiro aqui assim que a validação terminar.",
    automaticNote: "Você pode continuar acompanhando esta página enquanto o ChatGPT pesquisa e monta o plano. Não é necessário copiar nenhum prompt.",
    promptLabel: "Prompt para colar no ChatGPT",
    copyPrompt: "Copiar prompt",
    copied: "Prompt copiado. Cole-o nesta conversa do ChatGPT sem fechar o Sendero.",
    copyError: "Não foi possível copiá-lo automaticamente. Selecione o prompt e copie-o manualmente.",
    recommended: "Obrigatório",
    sideChatTitle: "Continue no navegador integrado do ChatGPT",
    sideChatDetail: "Mantenha esta página do Sendero aberta no app ChatGPT para desktop. A conversa ativa pode descobrir e usar as ferramentas WebMCP expostas por esta página.",
    sideChatSteps: ["Mantenha esta página do Sendero aberta no navegador integrado do ChatGPT.", "Copie o prompt desta página.", "Cole e envie-o nesta conversa do ChatGPT. O Sendero mostrará o progresso e abrirá aqui o rascunho validado."],
    browserNote: "A extensão do ChatGPT para Chrome, o ChatGPT web e navegadores externos não oferecem este fluxo WebMCP integrado.",
    waiting: "O ChatGPT criará o roteiro com o Sendero. Nada é salvo sem sua aprovação explícita.",
    generationStatus: {
      connecting: { title: "Conectando esta página ao ChatGPT", detail: "O Sendero está verificando se este navegador disponibiliza suas ferramentas de página." },
      ready: { title: "Esta página está pronta", detail: "Quando o ChatGPT começar a trabalhar com o Sendero, o progresso e o rascunho validado aparecerão aqui automaticamente." },
      waiting: { title: "Aguardando o ChatGPT", detail: "O prompt foi copiado. Envie-o nesta conversa do ChatGPT e mantenha o navegador integrado aberto." },
      generating: { title: "O ChatGPT começou a criar o roteiro", detail: "O Sendero recebeu o início do fluxo da página. Mantenha-a aberta enquanto o ChatGPT pesquisa e monta o plano." },
      working: { title: "O ChatGPT está trabalhando com o Sendero", detail: "Esta página recebeu uma operação do roteiro e será atualizada quando houver um resultado autoritativo." },
      validating: { title: "O Sendero está validando o roteiro", detail: "O plano completo está sendo verificado antes de liberar a etapa de revisão." },
      saving: { title: "O Sendero está salvando a viagem aprovada", detail: "Aguarde até que a viagem salva e sua versão apareçam aqui." },
      draft_ready: { title: "Rascunho validado recebido", detail: "O Sendero está abrindo a etapa de revisão." },
      saved: { title: "Viagem salva", detail: "A versão autoritativa já está disponível no Sendero." },
      unavailable: { title: "Abra o Sendero no navegador integrado do ChatGPT", detail: "Este navegador não disponibiliza as ferramentas WebMCP do Sendero. Chrome, a extensão do ChatGPT e o ChatGPT web não podem atualizar esta etapa nem comprovar o salvamento nesta sessão do Sendero." },
      error: { title: "A operação do Sendero não terminou", detail: "Não presumimos sucesso. Tente novamente no ChatGPT ou mantenha o prompt e repita." },
    },
    previewEyebrow: "Etapa 3 · Revisar no Sendero",
  },
  fr: {
    description: "Parlez-nous du voyage. Sendero prépare le relais, ChatGPT crée l’itinéraire et Sendero le valide avant tout enregistrement.",
    progressLabel: "Progression de la création de l’itinéraire",
    progress: ["Détails du voyage", "Génération de l’itinéraire", "Vérifier et enregistrer"],
    contextTitle: "Parlez-nous de votre voyage",
    contextDetail: "Renseignez l’essentiel et ajoutez autant de détails facultatifs que vous le souhaitez.",
    prepare: "Générer le prompt",
    invalidDates: "La date de départ doit être identique ou postérieure à la date d’arrivée.",
    invalidDayTimes: "Pour un voyage d’une journée, l’heure de départ doit être postérieure à l’heure d’arrivée.",
    licenceRequired: "Choisissez un autre transport ou confirmez qu’au moins une personne possède un permis de conduire valide.",
    receiptTitle: "Détails du voyage prêts",
    receiptDetail: ({ destination, startDate, endDate }) => `${destination} · ${startDate}–${endDate}`,
    editBrief: "Modifier les détails",
    handoffEyebrow: "Étape 2 · Génération de l’itinéraire",
    handoffTitle: "Votre prompt est prêt",
    handoffDetail: "Ce parcours intégré fonctionne dans le navigateur interne de l’application de bureau ChatGPT. Gardez Sendero ouvert pour que ChatGPT utilise les outils WebMCP de cette page.",
    automaticTitle: "Votre itinéraire est en cours de génération",
    automaticDetail: "ChatGPT a transmis les détails du voyage directement via le parcours WebMCP de cette page. Sendero ouvrira l’itinéraire ici dès que la validation sera terminée.",
    automaticNote: "Vous pouvez continuer à consulter cette page pendant que ChatGPT effectue les recherches et construit le programme. Aucun prompt ne doit être copié.",
    promptLabel: "Prompt à coller dans ChatGPT",
    copyPrompt: "Copier le prompt",
    copied: "Prompt copié. Collez-le dans cette conversation ChatGPT sans fermer Sendero.",
    copyError: "Impossible de le copier automatiquement. Sélectionnez le prompt et copiez-le manuellement.",
    recommended: "Obligatoire",
    sideChatTitle: "Continuez dans le navigateur intégré de ChatGPT",
    sideChatDetail: "Gardez cette page Sendero ouverte dans l’application de bureau ChatGPT. La conversation active peut découvrir et utiliser les outils WebMCP exposés par cette page.",
    sideChatSteps: ["Gardez cette page Sendero ouverte dans le navigateur intégré de ChatGPT.", "Copiez le prompt de cette page.", "Collez-le et envoyez-le dans cette conversation ChatGPT. Sendero affichera la progression et ouvrira ici le brouillon validé."],
    browserNote: "L’extension ChatGPT pour Chrome, ChatGPT web et les navigateurs externes ne proposent pas ce parcours WebMCP intégré.",
    waiting: "ChatGPT créera l’itinéraire avec Sendero. Rien n’est enregistré sans votre approbation explicite.",
    generationStatus: {
      connecting: { title: "Connexion de cette page à ChatGPT", detail: "Sendero vérifie si ce navigateur expose ses outils de page." },
      ready: { title: "Cette page est prête", detail: "Lorsque ChatGPT commencera à travailler avec Sendero, la progression et le brouillon validé apparaîtront ici automatiquement." },
      waiting: { title: "En attente de ChatGPT", detail: "Le prompt est copié. Envoyez-le dans cette conversation ChatGPT et gardez le navigateur intégré ouvert." },
      generating: { title: "ChatGPT a commencé l’itinéraire", detail: "Sendero a reçu le début du parcours de la page. Gardez-la ouverte pendant la recherche et la création du plan." },
      working: { title: "ChatGPT travaille avec Sendero", detail: "Cette page a reçu une opération d’itinéraire et se mettra à jour lorsqu’un résultat de référence sera disponible." },
      validating: { title: "Sendero valide l’itinéraire", detail: "Le plan complet est vérifié avant d’ouvrir l’étape de révision." },
      saving: { title: "Sendero enregistre le voyage approuvé", detail: "Attendez que le voyage enregistré et sa version apparaissent ici." },
      draft_ready: { title: "Brouillon validé reçu", detail: "Sendero ouvre l’étape de révision." },
      saved: { title: "Voyage enregistré", detail: "La version de référence est maintenant disponible dans Sendero." },
      unavailable: { title: "Ouvrez Sendero dans le navigateur intégré de ChatGPT", detail: "Ce navigateur n’expose pas les outils WebMCP de Sendero. Chrome, l’extension ChatGPT et ChatGPT web ne peuvent pas actualiser cette étape ni confirmer un enregistrement dans cette session Sendero." },
      error: { title: "L’opération Sendero n’a pas abouti", detail: "Aucun succès n’est supposé. Réessayez depuis ChatGPT ou conservez le prompt et recommencez." },
    },
    previewEyebrow: "Étape 3 · Vérifier dans Sendero",
  },
  de: {
    description: "Erzähle uns von der Reise. Sendero bereitet die Übergabe vor, ChatGPT erstellt den Reiseplan und Sendero prüft ihn, bevor etwas gespeichert wird.",
    progressLabel: "Fortschritt der Reiseplanerstellung",
    progress: ["Reisedaten", "Reiseplan wird erstellt", "Prüfen und speichern"],
    contextTitle: "Erzähle uns von deiner Reise",
    contextDetail: "Vervollständige das Wesentliche und ergänze beliebig viele optionale Details.",
    prepare: "Prompt generieren",
    invalidDates: "Das Abreisedatum muss am oder nach dem Anreisedatum liegen.",
    invalidDayTimes: "Bei einer eintägigen Reise muss die Abreisezeit nach der Ankunftszeit liegen.",
    licenceRequired: "Wähle ein anderes Verkehrsmittel oder bestätige, dass mindestens eine Person einen gültigen Führerschein hat.",
    receiptTitle: "Reisedaten bereit",
    receiptDetail: ({ destination, startDate, endDate }) => `${destination} · ${startDate}–${endDate}`,
    editBrief: "Daten bearbeiten",
    handoffEyebrow: "Schritt 2 · Reiseplan wird erstellt",
    handoffTitle: "Dein Prompt ist bereit",
    handoffDetail: "Dieser integrierte Ablauf funktioniert im internen Browser der ChatGPT-Desktop-App. Lass Sendero geöffnet, damit ChatGPT die WebMCP-Werkzeuge dieser Seite verwenden kann.",
    automaticTitle: "Dein Reiseplan wird erstellt",
    automaticDetail: "ChatGPT hat die Reisedaten direkt über den WebMCP-Ablauf dieser Seite übermittelt. Sendero öffnet den Reiseplan hier, sobald die Prüfung abgeschlossen ist.",
    automaticNote: "Du kannst diese Seite weiter ansehen, während ChatGPT recherchiert und den Plan erstellt. Es muss kein Prompt kopiert werden.",
    promptLabel: "Prompt zum Einfügen in ChatGPT",
    copyPrompt: "Prompt kopieren",
    copied: "Prompt kopiert. Füge ihn in diese ChatGPT-Unterhaltung ein, ohne Sendero zu schließen.",
    copyError: "Der Prompt konnte nicht automatisch kopiert werden. Markiere ihn und kopiere ihn manuell.",
    recommended: "Erforderlich",
    sideChatTitle: "Im integrierten Browser von ChatGPT fortfahren",
    sideChatDetail: "Lass diese Sendero-Seite in der ChatGPT-Desktop-App geöffnet. Die aktive Unterhaltung kann die von dieser Seite bereitgestellten WebMCP-Werkzeuge erkennen und verwenden.",
    sideChatSteps: ["Lass diese Sendero-Seite im integrierten Browser von ChatGPT geöffnet.", "Kopiere den Prompt auf dieser Seite.", "Füge ihn in diese ChatGPT-Unterhaltung ein und sende ihn. Sendero zeigt den Fortschritt und öffnet hier den validierten Entwurf."],
    browserNote: "Die ChatGPT-Erweiterung für Chrome, ChatGPT Web und externe Browser bieten diesen integrierten WebMCP-Ablauf nicht.",
    waiting: "ChatGPT erstellt den Reiseplan mit Sendero. Ohne deine ausdrückliche Zustimmung wird nichts gespeichert.",
    generationStatus: {
      connecting: { title: "Diese Seite wird mit ChatGPT verbunden", detail: "Sendero prüft, ob dieser Browser seine Seitentools bereitstellt." },
      ready: { title: "Diese Seite ist bereit", detail: "Sobald ChatGPT mit Sendero beginnt, erscheinen Fortschritt und validierter Entwurf automatisch hier." },
      waiting: { title: "Warten auf ChatGPT", detail: "Der Prompt wurde kopiert. Sende ihn in dieser ChatGPT-Unterhaltung und lass den integrierten Browser geöffnet." },
      generating: { title: "ChatGPT hat mit dem Reiseplan begonnen", detail: "Sendero hat den Start des Seitenablaufs empfangen. Lass die Seite während Recherche und Planung geöffnet." },
      working: { title: "ChatGPT arbeitet mit Sendero", detail: "Diese Seite hat einen Reisevorgang empfangen und wird bei einem maßgeblichen Ergebnis aktualisiert." },
      validating: { title: "Sendero prüft den Reiseplan", detail: "Der vollständige Plan wird geprüft, bevor der Überprüfungsschritt verfügbar wird." },
      saving: { title: "Sendero speichert die bestätigte Reise", detail: "Warte, bis die gespeicherte Reise und ihre Version hier erscheinen." },
      draft_ready: { title: "Validierter Entwurf empfangen", detail: "Sendero öffnet den Überprüfungsschritt." },
      saved: { title: "Reise gespeichert", detail: "Die maßgebliche Version ist jetzt in Sendero verfügbar." },
      unavailable: { title: "Öffne Sendero im integrierten Browser von ChatGPT", detail: "Dieser Browser stellt Senderos WebMCP-Werkzeuge nicht bereit. Chrome, die ChatGPT-Erweiterung und ChatGPT Web können diesen Schritt nicht aktualisieren oder einen Speichervorgang in dieser Sendero-Sitzung bestätigen." },
      error: { title: "Der Sendero-Vorgang wurde nicht abgeschlossen", detail: "Wir nehmen keinen Erfolg an. Versuche es in ChatGPT erneut oder behalte den Prompt und wiederhole den Vorgang." },
    },
    previewEyebrow: "Schritt 3 · In Sendero prüfen",
  },
};

function profileCopy(locale) {
  return {
    title: t(locale, "profile.title"), optional: t(locale, "profile.optional"), description: t(locale, "profile.description"),
    tripTimes: t(locale, "profile.tripTimes"), arrivalTime: t(locale, "profile.arrivalTime"), departureTime: t(locale, "profile.departureTime"),
    party: t(locale, "profile.party"), childAges: t(locale, "profile.childAges"), seniors: t(locale, "profile.seniors"), seniorAges: t(locale, "profile.seniorAges"), agesPlaceholder: t(locale, "profile.agesPlaceholder"), seniorAgesPlaceholder: t(locale, "profile.seniorAgesPlaceholder"), seniorsHint: t(locale, "profile.seniorsHint"),
    dailySchedule: t(locale, "profile.dailySchedule"), earliestStart: t(locale, "profile.earliestStart"), latestEnd: t(locale, "profile.latestEnd"), breakfast: t(locale, "profile.breakfast"), lunch: t(locale, "profile.lunch"), dinner: t(locale, "profile.dinner"),
    mobility: t(locale, "profile.mobility"), walkingTolerance: t(locale, "profile.walkingTolerance"),
    walkingOptions: Object.fromEntries(["none", "low", "moderate", "high"].map((value) => [value, t(locale, `profile.walking.${value}`)])),
    maxWalkingMinutes: t(locale, "profile.maxWalkingMinutes"), minutesPlaceholder: t(locale, "profile.minutesPlaceholder"), restFrequency: t(locale, "profile.restFrequency"),
    restOptions: Object.fromEntries(["none", "frequent", "regular", "minimal"].map((value) => [value, t(locale, `profile.rest.${value}`)])),
    avoidStairs: t(locale, "profile.avoidStairs"), wheelchairAccess: t(locale, "profile.wheelchairAccess"), accessibilityNeeds: t(locale, "profile.accessibilityNeeds"), accessibilityPlaceholder: t(locale, "profile.accessibilityPlaceholder"), note: t(locale, "profile.note"),
  };
}

function compactBrief(brief) {
  const clean = (value) => typeof value === "string" ? value.trim() : value;
  const { travellers: profileTravellers, ...profileFields } = tripProfileValueFromDraft(brief.profile);
  const lodging = {
    ...(clean(brief.lodging?.area) ? { area: clean(brief.lodging.area) } : {}),
    ...(clean(brief.lodging?.area) && clean(brief.lodging?.areaPlaceId)
      ? { areaPlaceId: clean(brief.lodging.areaPlaceId) }
      : {}),
    ...(clean(brief.lodging?.address) ? { address: clean(brief.lodging.address) } : {}),
    ...(clean(brief.lodging?.address) && clean(brief.lodging?.addressPlaceId)
      ? { addressPlaceId: clean(brief.lodging.addressPlaceId) }
      : {}),
    status: clean(brief.lodging?.address) ? "confirmed" : "area_only",
  };
  return {
    locale: clean(brief.locale) || "es",
    ...(clean(brief.destination) ? { destination: clean(brief.destination) } : {}),
    ...(clean(brief.destination) && clean(brief.destinationPlaceId)
      ? { destinationPlaceId: clean(brief.destinationPlaceId) }
      : {}),
    ...(clean(brief.startDate) ? { startDate: clean(brief.startDate) } : {}),
    ...(clean(brief.endDate) ? { endDate: clean(brief.endDate) } : {}),
    travellers: {
      adults: Number(brief.travellers?.adults) || 1,
      children: Math.max(0, Number(brief.travellers?.children) || 0),
      ...profileTravellers,
    },
    ...profileFields,
    pace: brief.pace,
    interests: brief.interests.filter(Boolean),
    transport: {
      modes: brief.transport.modes,
      hasLicense: brief.transport.hasLicense,
      wantsCar: brief.transport.modes.includes("car"),
    },
    budget: budgetValueFromDraft(brief.budget),
    ...(Object.keys(lodging).length > 1 ? { lodging } : {}),
    ...(clean(brief.notes) ? { notes: clean(brief.notes) } : {}),
  };
}

function editableBriefFromPrepared(value = {}) {
  const interests = Array.isArray(value.interests) ? value.interests : [];
  const lodging = value.lodging || {};
  return {
    ...initialBrief,
    ...value,
    destinationAccepted: Boolean(value.destination && !value.destinationPlaceId),
    travellers: {
      adults: value.travellers?.adults || 1,
      children: value.travellers?.children || 0,
    },
    transport: {
      modes: Array.isArray(value.transport?.modes) ? value.transport.modes : [],
      hasLicense: value.transport?.hasLicense === true,
      wantsCar: value.transport?.wantsCar === true,
    },
    lodging: {
      ...initialBrief.lodging,
      ...lodging,
      accepted: Boolean(
        (lodging.address && !lodging.addressPlaceId)
        || (lodging.area && !lodging.areaPlaceId),
      ),
    },
    interests,
    interestsInput: interests.join(", "),
    budget: budgetDraftFromValue(value.budget),
    profile: tripProfileDraftFromBrief(value),
    notes: value.notes || "",
  };
}

function BriefForm({ brief, busy, copy, csrfToken, locale, onChange, onSubmit }) {
  const toggleMode = (mode) => {
    const modes = brief.transport.modes.includes(mode)
      ? brief.transport.modes.filter((value) => value !== mode)
      : [...brief.transport.modes, mode];
    onChange({ ...brief, transport: { ...brief.transport, modes } });
  };
  return (
    <form className="generate-form" onSubmit={onSubmit}>
      <DestinationCombobox
        accepted={brief.destinationAccepted}
        copy={copy.destinationSearch}
        csrfToken={csrfToken}
        kind="destination"
        label={copy.destination}
        locale={locale}
        name="destination-search"
        onChange={({ label, placeId }) => {
          const resetLodging = Boolean(
            brief.destinationPlaceId && brief.destinationPlaceId !== placeId,
          );
          onChange({
            ...brief,
            destination: label,
            destinationAccepted: false,
            destinationPlaceId: placeId,
            ...(resetLodging ? {
              lodging: {
                area: "",
                areaPlaceId: "",
                address: "",
                addressPlaceId: "",
                accepted: false,
                status: "undecided",
              },
            } : {}),
          });
        }}
        placeholder={copy.destinationPlaceholder}
        required
        value={{ label: brief.destination, placeId: brief.destinationPlaceId }}
        wide
      />
      <div className="generate-row">
        <label className="generate-field"><span>{copy.arrival}</span><input onChange={(event) => onChange({ ...brief, startDate: event.target.value })} required type="date" value={brief.startDate} /></label>
        <label className="generate-field"><span>{copy.departure}</span><input onChange={(event) => onChange({ ...brief, endDate: event.target.value })} required type="date" value={brief.endDate} /></label>
      </div>
      <div className="generate-row">
        <label className="generate-field"><span>{copy.adults}</span><input min="1" onChange={(event) => onChange({ ...brief, travellers: { ...brief.travellers, adults: event.target.value } })} type="number" value={brief.travellers.adults} /></label>
        <label className="generate-field"><span>{copy.children}</span><input min="0" onChange={(event) => onChange({ ...brief, travellers: { ...brief.travellers, children: event.target.value } })} type="number" value={brief.travellers.children} /></label>
      </div>
      <fieldset className="generate-options">
        <legend className="generate-legend">{copy.transport}</legend>
        {Object.entries(copy.modes).map(([mode, label]) => (
          <label className="generate-option" key={mode}><input checked={brief.transport.modes.includes(mode)} onChange={() => toggleMode(mode)} type="checkbox" />{label}</label>
        ))}
      </fieldset>
      {brief.transport.modes.includes("car") ? <label className="generate-option"><input checked={brief.transport.hasLicense} onChange={(event) => onChange({ ...brief, transport: { ...brief.transport, hasLicense: event.target.checked } })} type="checkbox" />{copy.licence}</label> : null}
      <DestinationCombobox
        accepted={brief.lodging.accepted}
        copy={copy.lodgingAddressSearch}
        csrfToken={csrfToken}
        destinationPlaceId={brief.destinationPlaceId}
        disabled={!brief.destinationPlaceId}
        kind="lodging_address"
        label={copy.address}
        locale={locale}
        name="lodging-address-search"
        onChange={({ label, placeId, types }) => {
          const isArea = Boolean(placeId) && isLodgingAreaSuggestion(types);
          onChange({
            ...brief,
            lodging: isArea
              ? { area: label, areaPlaceId: placeId, address: "", addressPlaceId: "", accepted: false, status: "area_only" }
              : { area: "", areaPlaceId: "", address: label, addressPlaceId: placeId, accepted: false, status: placeId ? "confirmed" : "undecided" },
          });
        }}
        placeholder={copy.addressPlaceholder}
        value={{
          label: brief.lodging.address || brief.lodging.area,
          placeId: brief.lodging.addressPlaceId || brief.lodging.areaPlaceId,
        }}
        wide
      />
      <label className="generate-field"><span>{copy.pace}</span><select onChange={(event) => onChange({ ...brief, pace: event.target.value })} value={brief.pace}>{Object.entries(copy.paces).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <TripProfileFields adultsCount={brief.travellers.adults} childrenCount={brief.travellers.children} copy={copy.profile} onChange={(profile) => onChange({ ...brief, profile })} value={brief.profile} />
      <BudgetFields copy={copy.budget} locale={locale} onChange={(budget) => onChange({ ...brief, budget })} value={brief.budget} />
      <label className="generate-field"><span>{copy.interests}</span><textarea onChange={(event) => {
        const interestsInput = event.target.value;
        onChange({
          ...brief,
          interests: interestsInput.split(",").map((value) => value.trim()).filter(Boolean),
          interestsInput,
        });
      }} placeholder={copy.interestsPlaceholder} value={brief.interestsInput ?? brief.interests.join(", ")} /></label>
      <label className="generate-field"><span>{copy.notes}</span><textarea onChange={(event) => onChange({ ...brief, notes: event.target.value })} placeholder={copy.notesPlaceholder} value={brief.notes} /></label>
      <div className="generate-form-actions">
        <WebButton disabled={busy || brief.transport.modes.length === 0} tone="primary" type="submit">{copy.prepare}</WebButton>
      </div>
    </form>
  );
}

function briefIssue(brief, copy) {
  if (!brief.destination || (!brief.destinationPlaceId && !brief.destinationAccepted)) {
    return copy.destinationSearch.selectionRequired;
  }
  if (brief.lodging?.area?.trim() && !brief.lodging?.areaPlaceId && !brief.lodging?.accepted) {
    return copy.lodgingAreaSearch.selectionRequired;
  }
  if (brief.lodging?.address?.trim() && !brief.lodging?.addressPlaceId && !brief.lodging?.accepted) {
    return copy.lodgingAddressSearch.selectionRequired;
  }
  if (brief.startDate && brief.endDate && brief.startDate > brief.endDate) {
    return copy.invalidDates;
  }
  if (
    brief.startDate
    && brief.startDate === brief.endDate
    && brief.profile?.arrivalTime
    && brief.profile?.departureTime
    && brief.profile.arrivalTime >= brief.profile.departureTime
  ) {
    return copy.invalidDayTimes;
  }
  if (brief.transport.modes.includes("car") && !brief.transport.hasLicense) {
    return copy.licenceRequired;
  }
  return "";
}

async function copyText(value) {
  if (typeof globalThis.navigator?.clipboard?.writeText === "function") {
    await globalThis.navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand?.("copy") === true;
  textarea.remove();
  if (!copied) throw new Error("clipboard_unavailable");
}

function currentGenerateReturnTo(locale) {
  const url = new URL(globalThis.location.href);
  url.searchParams.set("lang", locale);
  return `${url.pathname}${url.search}`;
}

function GenerationProgress({ activeStep, copy, onReturnToBrief }) {
  return (
    <ol aria-label={copy.progressLabel} className="generate-progress">
      {copy.progress.map((label, index) => {
        const step = index + 1;
        const state = step < activeStep ? "is-complete" : step === activeStep ? "is-active" : "";
        const content = (
          <>
            <span aria-hidden="true" className="generate-step-number">{step < activeStep ? "✓" : step}</span>
            <span className="generate-step-label">{label}</span>
          </>
        );
        return (
          <li aria-current={step === activeStep ? "step" : undefined} className={state} key={label}>
            {step === 1 && activeStep > 1 ? (
              <button className="generate-step-content" onClick={onReturnToBrief} type="button">{content}</button>
            ) : (
              <div className="generate-step-content">{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function GenerationLiveStatus({ copy, promptCopied, status }) {
  const visible = visibleGenerationStatus(status, promptCopied);
  const content = copy.generationStatus[visible.kind] || copy.generationStatus.error;
  const busy = ["connecting", "generating", "working", "validating", "saving"].includes(visible.kind);
  return (
    <div
      aria-busy={busy ? "true" : undefined}
      aria-live="polite"
      className={`generate-live-status is-${visible.kind}`}
      role="status"
    >
      <span aria-hidden="true" className="generate-live-status-dot" />
      <div>
        <strong>{content.title}</strong>
        <p>{content.detail}</p>
      </div>
    </div>
  );
}

function WebMcpIndicator({ language, status }) {
  const model = webMcpIndicatorModel(language, status);
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);
  function closeDialog() {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else {
      dialog.removeAttribute("open");
      triggerRef.current?.focus();
    }
  }
  function openDialog() {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }
  return (
    <>
      <button
        aria-controls="generate-webmcp-dialog"
        aria-haspopup="dialog"
        aria-label={`${model.label}: ${model.status}. ${model.count}`}
        className={`generate-webmcp is-${model.state}`}
        data-webmcp-indicator
        onClick={openDialog}
        ref={triggerRef}
        type="button"
      >
        <span aria-hidden="true" className="generate-webmcp-status-dot" />
        <span className="generate-webmcp-copy">
          <strong>{model.label}</strong>
          <small aria-live="polite" role="status">{model.status}</small>
        </span>
        <span className="generate-webmcp-count">{model.count}</span>
        <span aria-hidden="true" className="generate-webmcp-info">i</span>
      </button>
      <dialog
        aria-labelledby="generate-webmcp-dialog-title"
        className="generate-webmcp-modal"
        id="generate-webmcp-dialog"
        onClick={(event) => { if (event.target === event.currentTarget) closeDialog(); }}
        onClose={() => triggerRef.current?.focus()}
        ref={dialogRef}
      >
        <div className="generate-webmcp-modal-inner">
          <div className="generate-webmcp-modal-header">
            <h2 id="generate-webmcp-dialog-title">{model.dialogTitle}</h2>
            <button aria-label={model.close} className="generate-webmcp-modal-close" onClick={closeDialog} type="button">×</button>
          </div>
          <p className="generate-webmcp-modal-detail">{model.detail}</p>
          <h3>{model.commands}</h3>
          <ul className="generate-webmcp-tools">
            {model.tools.map((tool) => (
              <li key={tool.name}>
                <code>{tool.name}</code>
                <span>{tool.description}</span>
              </li>
            ))}
          </ul>
        </div>
      </dialog>
    </>
  );
}

function HandoffPanel({
  brief,
  copy,
  copyState,
  generationStatus,
  locale,
  mode,
  onCopy,
  onEdit,
  prompt,
}) {
  const startDate = formatDate(locale, brief.startDate, { dateStyle: "medium" });
  const endDate = formatDate(locale, brief.endDate, { dateStyle: "medium" });
  const automatic = mode === "automatic";
  return (
    <section aria-labelledby="generate-handoff-title" className="generate-card generate-handoff" id="generate-handoff-panel" tabIndex={-1}>
      <div className="generate-receipt">
        <div>
          <strong>{copy.receiptTitle}</strong>
          <p>{copy.receiptDetail({ destination: brief.destination, startDate, endDate })}</p>
        </div>
        <div className="generate-receipt-actions">
          <WebButton onClick={onEdit}>{copy.editBrief}</WebButton>
        </div>
      </div>
      <div className="generate-handoff-header">
        <p className="web-eyebrow">{copy.handoffEyebrow}</p>
        <h2 id="generate-handoff-title">{automatic ? copy.automaticTitle : copy.handoffTitle}</h2>
        <p>{automatic ? copy.automaticDetail : copy.handoffDetail}</p>
      </div>
      <GenerationLiveStatus copy={copy} promptCopied={!automatic && copyState === "copied"} status={generationStatus} />
      {automatic ? <p className="generate-automatic-note">{copy.automaticNote}</p> : (
        <div className="generate-handoff-grid">
          <aside className="generate-handoff-guide">
            <div>
              <p className="web-eyebrow">{copy.recommended}</p>
              <h3>{copy.sideChatTitle}</h3>
              <p>{copy.sideChatDetail}</p>
            </div>
            <ol>{copy.sideChatSteps.map((step) => <li key={step}>{step}</li>)}</ol>
            <p className="generate-browser-note">{copy.browserNote}</p>
            <p>{copy.waiting}</p>
          </aside>
          <div className="generate-prompt">
            <label htmlFor="sendero-handoff-prompt">{copy.promptLabel}</label>
            <textarea id="sendero-handoff-prompt" readOnly value={prompt} />
            <div className="generate-handoff-actions">
              <WebButton onClick={onCopy} tone="primary">{copy.copyPrompt}</WebButton>
            </div>
            <p aria-live="polite" className="generate-copy-status" role="status">
              {copyState === "copied" ? copy.copied : copyState === "error" ? copy.copyError : ""}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

export function GenerateTripApp() {
  const queryClient = useQueryClient();
  const { language, locale } = useUiLocale();
  const copy = {
    ...(COPY[language] || COPY.es),
    ...(FLOW_COPY[language] || FLOW_COPY.es),
    destinationSearch: DESTINATION_COPY[language] || DESTINATION_COPY.es,
    lodgingAddressSearch: lodgingSearchCopy(language),
    profile: profileCopy(locale),
  };
  const [page, setPage] = useState({ kind: "loading" });
  const [brief, setBrief] = useState(() => ({ ...initialBrief, locale }));
  const { data: draftEntry = null } = useQuery({
    gcTime: Infinity,
    initialData: () => queryClient.getQueryData(ACTIVE_DRAFT_QUERY_KEY) || null,
    queryFn: async () => queryClient.getQueryData(ACTIVE_DRAFT_QUERY_KEY) || null,
    queryKey: ACTIVE_DRAFT_QUERY_KEY,
    staleTime: Infinity,
  });
  const draft = activeDraftView(draftEntry);
  const [preparedBrief, setPreparedBrief] = useState(null);
  const [activeStep, setActiveStep] = useState(() => draft?.itinerary || draft?.trip?.itinerary ? 3 : 1);
  const [generationMode, setGenerationMode] = useState("manual");
  const [copyState, setCopyState] = useState("idle");
  const [generationStatus, setGenerationStatus] = useState(initialGenerationStatus);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [previewView, setPreviewView] = useState("list");
  const [selectedCalendarDate, setSelectedCalendarDate] = useState("");
  const [selectedCalendarMonth, setSelectedCalendarMonth] = useState("");
  const [selectedReservationKey, setSelectedReservationKey] = useState("");
  const [selectedRouteDate, setSelectedRouteDate] = useState("");
  const briefRef = useRef(brief);
  const draftRef = useRef(draft);
  const pageRef = useRef(page);
  const facadeRef = useRef(null);
  briefRef.current = brief;
  draftRef.current = draft;
  pageRef.current = page;

  const reportGeneration = useCallback((event) => {
    setGenerationStatus((current) => generationStatusFromEvent(current, event));
  }, []);

  const applyDraft = useCallback((value, options = {}) => {
    const existing = queryClient.getQueryData(ACTIVE_DRAFT_QUERY_KEY);
    const saveInput = options.saveInput === undefined
      ? existing?.saveInput || null
      : options.saveInput;
    if (options.clear || value?.status === "discarded") {
      clearActiveDraft(queryClient);
      setPreparedBrief(null);
      setGenerationMode("manual");
      setActiveStep(1);
    } else if (value) {
      cacheActiveDraft(queryClient, { view: value, saveInput }, {
        persist: options.persist ?? Boolean(saveInput),
      });
      if (saveInput?.brief) {
        const editableBrief = editableBriefFromPrepared(saveInput.brief);
        briefRef.current = editableBrief;
        setBrief(editableBrief);
      }
      if (value.itinerary || value.trip?.itinerary) setActiveStep(3);
    }
    const draftId = value?.draftId;
    if (draftId && value.status !== "discarded") {
      const url = new URL(globalThis.location.href);
      url.searchParams.set("draft", draftId);
      globalThis.history.replaceState({}, "", url);
    } else if (value?.status === "discarded") {
      const url = new URL(globalThis.location.href);
      url.searchParams.delete("draft");
      globalThis.history.replaceState({}, "", url);
    }
  }, [queryClient]);

  const load = useCallback(async (signal) => {
    setPage({ kind: "loading" });
    try {
      const session = normalizeSession(await requestJson("/api/session", { signal }));
      const capabilities = await requestJson("/api/itinerary-planning/capabilities", { signal });
      if (!capabilities.enabled) return setPage({ kind: "unavailable", session });
      setPage({ kind: "ready", session, capabilities });
      const draftId = new URL(globalThis.location.href).searchParams.get("draft");
      const cached = queryClient.getQueryData(ACTIVE_DRAFT_QUERY_KEY);
      if (draftId && cached?.view?.draftId === draftId) {
        applyDraft(cached.view, { saveInput: cached.saveInput });
      } else if (draftId && session.authenticated) {
        const existing = await requestJson(`/api/itinerary-drafts/${encodeURIComponent(draftId)}`, { signal });
        applyDraft(existing);
      }
    } catch (error) {
      if (error?.name !== "AbortError") setPage({ kind: "error", error });
    }
  }, [applyDraft, queryClient]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);
  useEffect(() => { document.title = `${copy.documentTitle} · Sendero`; }, [copy.documentTitle]);
  useEffect(() => {
    setBrief((current) => current.locale === locale ? current : { ...current, locale });
    setPreparedBrief((current) => current && current.locale !== locale
      ? { ...current, locale }
      : current);
    setCopyState("idle");
  }, [locale]);
  useEffect(() => {
    if (!(draft?.itinerary || draft?.trip?.itinerary)) return;
    requestAnimationFrame(() => document.getElementById("generate-preview-title")?.focus());
  }, [draft]);
  useEffect(() => {
    setPreviewView("list");
    setSelectedCalendarDate("");
    setSelectedCalendarMonth("");
    setSelectedReservationKey("");
    setSelectedRouteDate("");
  }, [draft?.draftId]);

  useEffect(() => {
    if (page.kind !== "ready") return undefined;
    const controller = new AbortController();
    let attempting = false;
    let registered = false;
    let retryTimer;
    const facade = createItineraryGenerationFacade({
      getBrief: () => compactBrief(briefRef.current),
      getCachedDraft: () => queryClient.getQueryData(ACTIVE_DRAFT_QUERY_KEY),
      getCurrentDraftId: () => draftRef.current?.draftId,
      getSession: () => pageRef.current?.session,
      onBriefPrepared: (prepared) => {
        const editableBrief = editableBriefFromPrepared(prepared.brief);
        briefRef.current = editableBrief;
        setBrief(editableBrief);
        setCopyState("idle");
        setNotice(null);
        if (prepared.ready) {
          setPreparedBrief(prepared.brief);
          setGenerationMode("automatic");
          setActiveStep(2);
          requestAnimationFrame(() => document.getElementById("generate-handoff-panel")?.focus());
        } else {
          setPreparedBrief(null);
          setGenerationMode("manual");
          setActiveStep(1);
        }
      },
      onDraft: applyDraft,
    });
    facadeRef.current = facade;
    const register = async () => {
      if (attempting || registered || controller.signal.aborted) return;
      attempting = true;
      try {
        registered = await registerItineraryGenerationTools(document, facade, {
          report: reportGeneration,
          signal: controller.signal,
        });
      } catch {
        registered = true;
        reportGeneration({ type: "webmcp_registration_failed" });
      } finally {
        attempting = false;
        if (!registered && !controller.signal.aborted) {
          retryTimer = globalThis.setTimeout(register, 2000);
        }
      }
    };
    const registerWhenVisible = () => {
      if (document.visibilityState !== "hidden") register();
    };
    register();
    globalThis.addEventListener?.("focus", registerWhenVisible);
    document.addEventListener?.("visibilitychange", registerWhenVisible);
    return () => {
      facadeRef.current = null;
      globalThis.clearTimeout(retryTimer);
      globalThis.removeEventListener?.("focus", registerWhenVisible);
      document.removeEventListener?.("visibilitychange", registerWhenVisible);
      controller.abort();
    };
  }, [applyDraft, page.kind, queryClient, reportGeneration]);

  function prepare(event) {
    event.preventDefault();
    setNotice(null);
    const issue = briefIssue(brief, copy);
    if (issue) {
      setNotice({ kind: "error", text: issue });
      return;
    }
    setPreparedBrief(compactBrief(brief));
    setGenerationMode("manual");
    setActiveStep(2);
    setCopyState("idle");
    requestAnimationFrame(() => document.getElementById("generate-handoff-panel")?.focus());
  }

  async function copyPrompt() {
    if (!preparedBrief) return;
    try {
      await copyText(createItineraryHandoffPrompt(preparedBrief, language));
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  function editBrief() {
    setPreparedBrief(null);
    setGenerationMode("manual");
    setActiveStep(1);
    setCopyState("idle");
    setNotice(null);
    requestAnimationFrame(() => document.getElementById("generate-context-title")?.focus());
  }

  function openPreviewReservation(target) {
    setSelectedReservationKey(target
      ? reservationEntryKey(target.dayDate, target.activityId)
      : "");
    setPreviewView("reservations");
  }

  async function saveDraft() {
    setBusy(true);
    setNotice(null);
    try {
      const result = await facadeRef.current.save({ draftId: draft.draftId });
      applyDraft(result);
      setNotice({ kind: "ready", text: copy.saved });
    } catch (error) {
      setNotice({ kind: "error", text: error.message || copy.saveError });
    } finally {
      setBusy(false);
    }
  }

  async function discardDraft() {
    setBusy(true);
    try {
      const result = await facadeRef.current.discard({ draftId: draft.draftId });
      applyDraft(result);
      setGenerationStatus({ kind: "ready" });
      setNotice({ kind: "ready", text: copy.discarded });
    } catch (error) {
      setNotice({ kind: "error", text: error.message || copy.discardError });
    } finally {
      setBusy(false);
    }
  }

  if (page.kind === "loading") return <WebState kind="loading" title={copy.loading} />;
  if (page.kind === "unavailable") return <WebState action={<a className="web-button" href={hrefForLocale("/app", locale)}>{copy.back}</a>} detail={copy.unavailableDetail} session={page.session} title={copy.unavailableTitle} />;
  if (page.kind === "error") return <WebState action={<WebButton onClick={() => load()}>{copy.retry}</WebButton>} detail={copy.errorDetail} kind="error" title={copy.errorTitle} />;

  const itinerary = draft?.itinerary || draft?.trip?.itinerary;
  const savedTrip = draft?.status === "saved" ? draft.trip : null;
  const handoffPrompt = preparedBrief
    ? createItineraryHandoffPrompt(preparedBrief, language)
    : "";
  const topbarAction = page.session.authenticated
    ? <a className="web-topbar-link" href={hrefForLocale("/app", locale)}>{copy.viewTrips}</a>
    : <a className="web-topbar-link" href={loginUrl(page.session, currentGenerateReturnTo(locale))}>{copy.signIn}</a>;
  return (
    <WebPageFrame csrfToken={page.session.csrfToken} topbarAction={topbarAction} user={page.session.user}>
      <style>{generateStyles}</style>
      <header className="web-heading">
        <p className="web-eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p>{copy.description}</p>
        <WebMcpIndicator language={language} status={generationStatus} />
      </header>
      <div className="generate-flow">
        <GenerationProgress activeStep={activeStep} copy={copy} onReturnToBrief={editBrief} />
        {notice ? (
          <div aria-live="assertive" className={`generate-notice is-${notice.kind}`} role="alert">{notice.text}</div>
        ) : null}
        {activeStep === 1 ? (
          <section aria-labelledby="generate-context-title" className="generate-card">
            <h2 id="generate-context-title" tabIndex={-1}>{copy.contextTitle}</h2>
            <p>{copy.contextDetail}</p>
            <BriefForm brief={brief} busy={busy} copy={copy} csrfToken={page.session.csrfToken} locale={locale} onChange={setBrief} onSubmit={prepare} />
          </section>
        ) : null}
        {activeStep === 2 ? (
          <HandoffPanel
            brief={preparedBrief}
            copy={copy}
            copyState={copyState}
            generationStatus={generationStatus}
            locale={locale}
            mode={generationMode}
            onCopy={copyPrompt}
            onEdit={editBrief}
            prompt={handoffPrompt}
          />
        ) : null}
        {activeStep === 3 ? (
          <section aria-labelledby="generate-preview-title" className="generate-card generate-preview">
            <p className="web-eyebrow" id="generate-preview-title" tabIndex={-1}>{copy.previewEyebrow}</p>
            <ItineraryViewer
              activeView={previewView}
              headerActions={(
                <div className="generate-draft-actions">
                  {draft.status === "valid" && page.session.authenticated ? <WebButton disabled={busy} onClick={saveDraft} tone="primary">{copy.save}</WebButton> : null}
                  {draft.status === "valid" && !page.session.authenticated ? <a className="web-button web-button-primary" href={loginUrl(page.session, currentGenerateReturnTo(locale))}>{copy.createAccountToSave}</a> : null}
                  {draft.status === "valid" ? <WebButton disabled={busy} onClick={discardDraft}>{copy.discard}</WebButton> : null}
                  {savedTrip?.webId ? <a className="web-button web-button-primary" href={hrefForLocale(`/app/trips/${encodeURIComponent(savedTrip.webId)}`, locale)}>{copy.open}</a> : null}
                </div>
              )}
              headerDetail={draft.status === "saved"
                ? copy.savedDetail
                : page.session.authenticated
                  ? copy.draftDetail
                  : copy.anonymousDraftDetail}
              itinerary={itinerary}
              onCalendarDayChange={setSelectedCalendarDate}
              onCalendarMonthChange={setSelectedCalendarMonth}
              onReservationOpen={openPreviewReservation}
              onRouteDayChange={setSelectedRouteDate}
              onViewChange={(view) => {
                setPreviewView(view);
                if (view !== "reservations") setSelectedReservationKey("");
              }}
              selectedCalendarDate={selectedCalendarDate}
              selectedCalendarMonth={selectedCalendarMonth}
              selectedReservationKey={selectedReservationKey}
              selectedRouteDate={selectedRouteDate}
              uiLocale={locale}
              variant="web"
            />
          </section>
        ) : null}
      </div>
    </WebPageFrame>
  );
}
