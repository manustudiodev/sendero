import { useCallback, useEffect, useRef, useState } from "react";
import { WebButton, WebPageFrame, WebState } from "../account/PageFrame.jsx";
import {
  loginUrl,
  normalizeSession,
  requestJson,
} from "../account/web-client.js";
import { ItineraryViewer } from "../itinerary/ItineraryViewer.jsx";
import { hrefForLocale, useUiLocale } from "../i18n/LanguageSelector.jsx";
import { formatDate, t } from "../i18n/index.js";
import { createItineraryGenerationFacade } from "./generation-client.js";
import { DestinationCombobox } from "./DestinationCombobox.jsx";
import {
  CHATGPT_SITE_TOOLS_GUIDE_URL,
  createItineraryHandoffPrompt,
} from "./handoff-prompt.js";
import { registerItineraryGenerationTools } from "./webmcp.js";
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
.generate-progress li { display: grid; min-width: 0; grid-template-columns: 32px minmax(0, 1fr); align-items: center; gap: 10px; border: 1px solid var(--web-line); border-radius: 14px; padding: 10px 12px; background: color-mix(in srgb, var(--web-surface) 82%, transparent); color: var(--web-muted); }
.generate-progress li.is-active { border-color: var(--web-forest); background: var(--web-surface); color: var(--web-ink); }
.generate-progress li.is-complete { color: var(--web-forest); }
.generate-step-number { display: grid; width: 32px; height: 32px; place-items: center; border-radius: 50%; background: var(--web-soft); font-size: 13px; font-weight: 760; }
.generate-progress li.is-active .generate-step-number, .generate-progress li.is-complete .generate-step-number { background: var(--web-grass); color: var(--web-forest); }
.generate-step-label { overflow: hidden; font-size: 14px; font-weight: 690; text-overflow: ellipsis; white-space: nowrap; }
.generate-card { width: 100%; min-width: 0; border: 1px solid var(--web-line); border-radius: 20px; padding: clamp(20px, 3vw, 34px); background: var(--web-surface); }
.generate-card h2 { margin: 0; font-size: clamp(22px, 3vw, 30px); letter-spacing: -.035em; }
.generate-card > p { margin: 8px 0 0; color: var(--web-muted); }
.generate-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 17px 18px; margin-top: 26px; }
.generate-field { display: grid; gap: 6px; }
.generate-field-wide, .generate-form > .profile-editor, .generate-form > .budget-editor, .generate-form-actions { grid-column: 1 / -1; }
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
.generate-connection { display: flex; align-items: flex-start; gap: 10px; border-radius: 14px; padding: 13px 15px; background: var(--web-soft); color: var(--web-muted); }
.generate-connection.is-ready { background: rgba(162, 212, 94, .2); color: var(--web-ink); }
.generate-connection-dot { width: 9px; height: 9px; flex: 0 0 auto; margin-top: 6px; border-radius: 50%; background: var(--web-muted); }
.generate-connection.is-ready .generate-connection-dot { background: var(--web-forest); }
.generate-handoff-grid { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(280px, .8fr); gap: 20px; align-items: start; }
.generate-prompt { display: grid; gap: 10px; }
.generate-prompt label { font-size: 14px; font-weight: 720; }
.generate-prompt textarea { width: 100%; min-height: 330px; border: 1px solid var(--web-line); border-radius: 14px; padding: 15px; background: var(--web-soft); color: var(--web-ink); font: 13px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; resize: vertical; }
.generate-prompt textarea:focus { background: var(--web-surface); }
.generate-handoff-guide { display: grid; gap: 18px; border: 1px solid var(--web-line); border-radius: 16px; padding: 20px; }
.generate-handoff-guide h3 { margin: 0; font-size: 18px; }
.generate-handoff-guide p { margin: 6px 0 0; color: var(--web-muted); }
.generate-handoff-guide ol { margin: 0; padding-left: 21px; color: var(--web-muted); }
.generate-handoff-guide li + li { margin-top: 9px; }
.generate-secondary-path { border-top: 1px solid var(--web-line); padding-top: 18px; }
.generate-secondary-path a:not(.web-button), .generate-extension-link { color: var(--web-forest); font-weight: 680; }
.generate-copy-status { min-height: 21px; margin: 0; color: var(--web-muted); font-size: 13px; }
.generate-draft-actions { display: flex; flex-wrap: wrap; gap: 10px; margin: 16px 0; }
.generate-preview { min-width: 0; overflow: hidden; }
.generate-preview .itinerary-viewer { border-radius: 18px; }
.generate-steps { margin: 18px 0 0; padding-left: 20px; color: var(--web-muted); }
.generate-steps li + li { margin-top: 8px; }
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
`;

const initialBrief = {
  locale: "es",
  destination: "",
  destinationPlaceId: "",
  startDate: "",
  endDate: "",
  travellers: { adults: 1, children: 0 },
  pace: "balanced",
  interests: [],
  transport: { modes: ["walk", "public_transit"], hasLicense: false, wantsCar: false },
  lodging: {
    area: "",
    areaPlaceId: "",
    address: "",
    addressPlaceId: "",
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
    area: {
      loading: "Searching neighbourhoods and areas…",
      empty: "No matching neighbourhood or area found in this destination.",
      error: "Lodging area search is unavailable. Try again in a moment.",
      choose: "Choose a neighbourhood or area from the suggestions.",
      selected: "Lodging area selected.",
      selectionRequired: "Choose the lodging area from the suggestions or leave the field empty.",
      disabled: "Select a destination before searching for a lodging area.",
    },
    address: {
      loading: "Searching lodgings and addresses…",
      empty: "No matching lodging or address found in this destination.",
      error: "Lodging address search is unavailable. Try again in a moment.",
      choose: "Choose a lodging or address from the suggestions.",
      selected: "Lodging address selected.",
      selectionRequired: "Choose the confirmed lodging or address from the suggestions, or leave the field empty.",
      disabled: "Select a destination before searching for a lodging address.",
    },
  },
  es: {
    area: {
      loading: "Buscando barrios y zonas…",
      empty: "No encontramos un barrio o zona que coincida dentro de este destino.",
      error: "La búsqueda de zonas de alojamiento no está disponible. Intenta de nuevo en un momento.",
      choose: "Elige un barrio o zona de las sugerencias.",
      selected: "Zona de alojamiento seleccionada.",
      selectionRequired: "Elige la zona de alojamiento de las sugerencias o deja el campo vacío.",
      disabled: "Selecciona un destino antes de buscar una zona de alojamiento.",
    },
    address: {
      loading: "Buscando alojamientos y direcciones…",
      empty: "No encontramos un alojamiento o dirección que coincida dentro de este destino.",
      error: "La búsqueda de direcciones de alojamiento no está disponible. Intenta de nuevo en un momento.",
      choose: "Elige un alojamiento o dirección de las sugerencias.",
      selected: "Dirección de alojamiento seleccionada.",
      selectionRequired: "Elige el alojamiento o la dirección confirmada de las sugerencias, o deja el campo vacío.",
      disabled: "Selecciona un destino antes de buscar una dirección de alojamiento.",
    },
  },
  pt: {
    area: {
      loading: "Buscando bairros e áreas…",
      empty: "Nenhum bairro ou área correspondente foi encontrado neste destino.",
      error: "A busca de áreas de hospedagem não está disponível. Tente novamente em instantes.",
      choose: "Escolha um bairro ou uma área nas sugestões.",
      selected: "Área de hospedagem selecionada.",
      selectionRequired: "Escolha a área de hospedagem nas sugestões ou deixe o campo vazio.",
      disabled: "Selecione um destino antes de buscar uma área de hospedagem.",
    },
    address: {
      loading: "Buscando hospedagens e endereços…",
      empty: "Nenhuma hospedagem ou endereço correspondente foi encontrado neste destino.",
      error: "A busca de endereços de hospedagem não está disponível. Tente novamente em instantes.",
      choose: "Escolha uma hospedagem ou endereço nas sugestões.",
      selected: "Endereço da hospedagem selecionado.",
      selectionRequired: "Escolha a hospedagem ou o endereço confirmado nas sugestões, ou deixe o campo vazio.",
      disabled: "Selecione um destino antes de buscar um endereço de hospedagem.",
    },
  },
  fr: {
    area: {
      loading: "Recherche de quartiers et de zones…",
      empty: "Aucun quartier ni aucune zone ne correspond dans cette destination.",
      error: "La recherche de zones d’hébergement est indisponible. Réessayez dans un instant.",
      choose: "Choisissez un quartier ou une zone parmi les suggestions.",
      selected: "Zone d’hébergement sélectionnée.",
      selectionRequired: "Choisissez la zone d’hébergement parmi les suggestions ou laissez le champ vide.",
      disabled: "Sélectionnez une destination avant de rechercher une zone d’hébergement.",
    },
    address: {
      loading: "Recherche d’hébergements et d’adresses…",
      empty: "Aucun hébergement ni aucune adresse ne correspond dans cette destination.",
      error: "La recherche d’adresses d’hébergement est indisponible. Réessayez dans un instant.",
      choose: "Choisissez un hébergement ou une adresse parmi les suggestions.",
      selected: "Adresse d’hébergement sélectionnée.",
      selectionRequired: "Choisissez l’hébergement ou l’adresse confirmée parmi les suggestions, ou laissez le champ vide.",
      disabled: "Sélectionnez une destination avant de rechercher une adresse d’hébergement.",
    },
  },
  de: {
    area: {
      loading: "Viertel und Gegenden werden gesucht…",
      empty: "In diesem Reiseziel wurde kein passendes Viertel und keine passende Gegend gefunden.",
      error: "Die Suche nach Unterkunftsgegenden ist derzeit nicht verfügbar. Versuche es gleich noch einmal.",
      choose: "Wähle ein Viertel oder eine Gegend aus den Vorschlägen aus.",
      selected: "Unterkunftsgegend ausgewählt.",
      selectionRequired: "Wähle die Unterkunftsgegend aus den Vorschlägen aus oder lasse das Feld leer.",
      disabled: "Wähle zuerst ein Reiseziel aus, bevor du nach einer Unterkunftsgegend suchst.",
    },
    address: {
      loading: "Unterkünfte und Adressen werden gesucht…",
      empty: "In diesem Reiseziel wurde keine passende Unterkunft und keine passende Adresse gefunden.",
      error: "Die Suche nach Unterkunftsadressen ist derzeit nicht verfügbar. Versuche es gleich noch einmal.",
      choose: "Wähle eine Unterkunft oder Adresse aus den Vorschlägen aus.",
      selected: "Unterkunftsadresse ausgewählt.",
      selectionRequired: "Wähle die bestätigte Unterkunft oder Adresse aus den Vorschlägen aus oder lasse das Feld leer.",
      disabled: "Wähle zuerst ein Reiseziel aus, bevor du nach einer Unterkunftsadresse suchst.",
    },
  },
};

function lodgingSearchCopy(language, kind) {
  const resolvedLanguage = LODGING_SEARCH_COPY[language] ? language : "es";
  return {
    remaining: DESTINATION_COPY[resolvedLanguage].remaining,
    ...LODGING_SEARCH_COPY[resolvedLanguage][kind],
  };
}

const COPY = {
  en: {
    destination: "Destination", destinationPlaceholder: "City and country", arrival: "Arrival", departure: "Departure",
    adults: "Adults", children: "Children", transport: "Transport", modes: { walk: "On foot", public_transit: "Public transport", taxi: "Taxi", car: "Car" },
    licence: "At least one person has a valid driving licence", lodgingArea: "Lodging area", lodgingAreaPlaceholder: "Neighbourhood or area; it can be provisional",
    address: "Confirmed address", addressPlaceholder: "Lodging or exact address; optional", optional: "Optional", pace: "Pace", paces: { relaxed: "Relaxed", balanced: "Balanced", intense: "Intense" },
    interests: "Interests", interestsPlaceholder: "Architecture, local food, music…", notes: "Notes and constraints", notesPlaceholder: "Fixed plans, accessibility, things to avoid…",
    budget: {
      title: "Budget", description: "Set a spending style and, if useful, a monetary limit.", comfort: "Spending style", comforts: { flexible: "Flexible", low: "Economy", medium: "Mid-range", high: "Premium" },
      amount: "Limit", optional: "Optional", currency: "Currency", scope: "Applied to", scopes: { total: "Whole trip", per_person: "Per person", per_day: "Per day" },
      flexibility: "How firm is it?", flexibilities: { strict: "Hard cap", target: "Target", flexible: "Reference" }, includes: "Counts toward the limit",
      categories: { activities: "Activities", food: "Food", local_transport: "Local transport", lodging: "Lodging", long_distance_transport: "Travel to destination" },
      note: "Lodging and travel to the destination count only when selected. Sendero uses price ranges, not false precision.",
    },
    prepare: "Prepare for ChatGPT", protocolReady: "The brief is complete. ChatGPT can now research and generate the itinerary with the current protocol.",
    criticalMissing: (fields) => `Critical details are missing: ${fields}.`, prepareError: "We couldn't prepare the trip.", saved: "The trip was saved in Sendero.",
    saveError: "We couldn't save the trip.", discarded: "The temporary draft was discarded.", discardError: "We couldn't discard the draft.",
    loading: "Preparing the planner…", signIn: "Sign in", signedOutDetail: "Your Sendero session protects the drafts and trips ChatGPT creates from this page.", signedOutTitle: "Sign in to plan",
    back: "Back to your trips", unavailableDetail: "This capability is not enabled in this environment yet. The Sendero plugin remains available in ChatGPT.", unavailableTitle: "Web generation unavailable",
    retry: "Try again", errorDetail: "No trip was changed or saved.", errorTitle: "We couldn't open the planner", eyebrow: "Conversational planning", title: "Create a trip",
    description: "Sendero provides the rules, validates the result, and saves it. ChatGPT researches and builds the itinerary in the active conversation.",
    draftReady: "Temporary draft ready", draftExpired: "This draft is no longer available.", save: "Save in Sendero", discard: "Discard draft", open: "Open saved trip",
    conversation: "Conversation + Sendero", emptyTitle: "Your itinerary will appear here", emptyDetail: "Complete the brief and ask ChatGPT to generate it. Sendero validates the result before it can be saved.",
    steps: ["Complete the trip essentials.", "Continue the research and generation in ChatGPT.", "Review and save the validated draft in Sendero."],
    webmcpConnected: "WebMCP connected.", webmcpBrowser: "Browser mode.", webmcpAvailable: "ChatGPT can use the generation tools while this page remains open.", webmcpUnavailable: "You can prepare the brief here and open ChatGPT; automatic generation from this page requires a WebMCP-compatible client.",
    contextTitle: "Trip context", contextDetail: "Complete the essentials. ChatGPT can enrich this brief with what you already discussed.", protocol: "Protocol",
    savedTitle: "Saved trip", draftTitle: "Validated draft", savedDetail: "This is the authoritative Sendero version.", draftDetail: "It is not part of your trips yet. Review the warnings before saving it.",
    emptyPreviewTitle: "Your itinerary will appear here after validation.", emptySteps: ["Prepare the brief.", "Ask ChatGPT to create the itinerary with Sendero.", "Review the draft and save it explicitly."],
    openChatgpt: "Open ChatGPT", viewTrips: "View my trips",
    documentTitle: "Create a trip",
  },
  es: {
    destination: "Destino", destinationPlaceholder: "Ciudad y país", arrival: "Llegada", departure: "Salida",
    adults: "Adultos", children: "Niños", transport: "Transporte", modes: { walk: "A pie", public_transit: "Transporte público", taxi: "Taxi", car: "Auto" },
    licence: "Al menos una persona tiene licencia válida", lodgingArea: "Zona de alojamiento", lodgingAreaPlaceholder: "Barrio o zona; puede ser provisional",
    address: "Dirección confirmada", addressPlaceholder: "Alojamiento o dirección exacta; opcional", optional: "Opcional", pace: "Ritmo", paces: { relaxed: "Relajado", balanced: "Equilibrado", intense: "Intenso" },
    interests: "Intereses", interestsPlaceholder: "Arquitectura, comida local, música…", notes: "Notas y restricciones", notesPlaceholder: "Planes fijos, accesibilidad, cosas que evitar…",
    budget: {
      title: "Presupuesto", description: "Define el estilo de gasto y, si sirve, un límite monetario.", comfort: "Estilo de gasto", comforts: { flexible: "Flexible", low: "Económico", medium: "Medio", high: "Premium" },
      amount: "Límite", optional: "Opcional", currency: "Moneda", scope: "Se aplica a", scopes: { total: "Todo el viaje", per_person: "Por persona", per_day: "Por día" },
      flexibility: "¿Qué tan firme es?", flexibilities: { strict: "Tope estricto", target: "Objetivo", flexible: "Referencia" }, includes: "Cuenta dentro del límite",
      categories: { activities: "Actividades", food: "Comidas", local_transport: "Transporte local", lodging: "Alojamiento", long_distance_transport: "Viaje al destino" },
      note: "Alojamiento y viaje al destino cuentan solo si los seleccionas. Sendero usa rangos, no falsa precisión.",
    },
    prepare: "Preparar para ChatGPT", protocolReady: "El brief está completo. ChatGPT ya puede investigar y generar el itinerario con el protocolo actual.",
    criticalMissing: (fields) => `Faltan datos críticos: ${fields}.`, prepareError: "No pudimos preparar el viaje.", saved: "El viaje quedó guardado en Sendero.",
    saveError: "No pudimos guardar el viaje.", discarded: "El borrador temporal fue descartado.", discardError: "No pudimos descartar el borrador.",
    loading: "Preparando el planificador…", signIn: "Iniciar sesión", signedOutDetail: "Tu sesión de Sendero protege los borradores y viajes que ChatGPT cree desde esta página.", signedOutTitle: "Inicia sesión para planificar",
    back: "Volver a tus viajes", unavailableDetail: "Esta capacidad todavía no está activada en este ambiente. El plugin de Sendero continúa disponible en ChatGPT.", unavailableTitle: "Generación web no disponible",
    retry: "Intentar de nuevo", errorDetail: "No se modificó ni guardó ningún viaje.", errorTitle: "No pudimos abrir el planificador", eyebrow: "Planificación conversacional", title: "Crear un viaje",
    description: "Sendero aporta las reglas, valida el resultado y lo guarda. ChatGPT investiga y construye el itinerario en la conversación activa.",
    draftReady: "Borrador temporal listo", draftExpired: "Este borrador ya no está disponible.", save: "Guardar en Sendero", discard: "Descartar borrador", open: "Abrir viaje guardado",
    conversation: "Conversación + Sendero", emptyTitle: "Tu itinerario aparecerá aquí", emptyDetail: "Completa el brief y pídele a ChatGPT que lo genere. Sendero valida el resultado antes de permitir guardarlo.",
    steps: ["Completa lo esencial del viaje.", "Continúa la investigación y generación en ChatGPT.", "Revisa y guarda el borrador validado en Sendero."],
    webmcpConnected: "WebMCP conectado.", webmcpBrowser: "Modo navegador.", webmcpAvailable: "ChatGPT tiene disponibles las herramientas de generación mientras esta página permanezca abierta.", webmcpUnavailable: "Puedes preparar el brief aquí y abrir ChatGPT; la generación automática desde la página requiere un cliente compatible con WebMCP.",
    contextTitle: "Contexto del viaje", contextDetail: "Completa lo esencial. ChatGPT puede enriquecer este brief con lo que ya hablaron.", protocol: "Protocolo",
    savedTitle: "Viaje guardado", draftTitle: "Borrador validado", savedDetail: "Esta es la versión autoritativa de Sendero.", draftDetail: "Todavía no forma parte de tus viajes. Revisa las advertencias antes de guardarlo.",
    emptyPreviewTitle: "Tu itinerario aparecerá aquí después de validarse.", emptySteps: ["Prepara el brief.", "Pide a ChatGPT que cree el itinerario con Sendero.", "Revisa el borrador y guárdalo explícitamente."],
    openChatgpt: "Abrir ChatGPT", viewTrips: "Ver mis viajes",
    documentTitle: "Crear un viaje",
  },
  pt: {
    destination: "Destino", destinationPlaceholder: "Cidade e país", arrival: "Chegada", departure: "Saída",
    adults: "Adultos", children: "Crianças", transport: "Transporte", modes: { walk: "A pé", public_transit: "Transporte público", taxi: "Táxi", car: "Carro" },
    licence: "Pelo menos uma pessoa tem carteira de motorista válida", lodgingArea: "Área de hospedagem", lodgingAreaPlaceholder: "Bairro ou área; pode ser provisório",
    address: "Endereço confirmado", addressPlaceholder: "Hospedagem ou endereço exato; opcional", optional: "Opcional", pace: "Ritmo", paces: { relaxed: "Tranquilo", balanced: "Equilibrado", intense: "Intenso" },
    interests: "Interesses", interestsPlaceholder: "Arquitetura, comida local, música…", notes: "Observações e restrições", notesPlaceholder: "Planos fixos, acessibilidade, coisas a evitar…",
    budget: {
      title: "Orçamento", description: "Defina o estilo de gasto e, se for útil, um limite monetário.", comfort: "Estilo de gasto", comforts: { flexible: "Flexível", low: "Econômico", medium: "Médio", high: "Premium" },
      amount: "Limite", optional: "Opcional", currency: "Moeda", scope: "Aplicado a", scopes: { total: "Viagem inteira", per_person: "Por pessoa", per_day: "Por dia" },
      flexibility: "Quão rígido é?", flexibilities: { strict: "Teto rígido", target: "Meta", flexible: "Referência" }, includes: "Conta no limite",
      categories: { activities: "Atividades", food: "Alimentação", local_transport: "Transporte local", lodging: "Hospedagem", long_distance_transport: "Viagem até o destino" },
      note: "Hospedagem e viagem até o destino contam somente quando selecionadas. O Sendero usa faixas, não falsa precisão.",
    },
    prepare: "Preparar para o ChatGPT", protocolReady: "O brief está completo. O ChatGPT já pode pesquisar e gerar o roteiro com o protocolo atual.",
    criticalMissing: (fields) => `Faltam dados críticos: ${fields}.`, prepareError: "Não foi possível preparar a viagem.", saved: "A viagem foi salva no Sendero.",
    saveError: "Não foi possível salvar a viagem.", discarded: "O rascunho temporário foi descartado.", discardError: "Não foi possível descartar o rascunho.",
    loading: "Preparando o planejador…", signIn: "Entrar", signedOutDetail: "Sua sessão do Sendero protege os rascunhos e viagens que o ChatGPT criar nesta página.", signedOutTitle: "Entre para planejar",
    back: "Voltar às suas viagens", unavailableDetail: "Esta capacidade ainda não está ativa neste ambiente. O plugin do Sendero continua disponível no ChatGPT.", unavailableTitle: "Geração web indisponível",
    retry: "Tentar novamente", errorDetail: "Nenhuma viagem foi alterada ou salva.", errorTitle: "Não foi possível abrir o planejador", eyebrow: "Planejamento conversacional", title: "Criar uma viagem",
    description: "O Sendero fornece as regras, valida o resultado e o salva. O ChatGPT pesquisa e constrói o roteiro na conversa ativa.",
    draftReady: "Rascunho temporário pronto", draftExpired: "Este rascunho não está mais disponível.", save: "Salvar no Sendero", discard: "Descartar rascunho", open: "Abrir viagem salva",
    conversation: "Conversa + Sendero", emptyTitle: "Seu roteiro aparecerá aqui", emptyDetail: "Complete o brief e peça ao ChatGPT para gerá-lo. O Sendero valida o resultado antes de permitir salvá-lo.",
    steps: ["Complete o essencial da viagem.", "Continue a pesquisa e geração no ChatGPT.", "Revise e salve o rascunho validado no Sendero."],
    webmcpConnected: "WebMCP conectado.", webmcpBrowser: "Modo navegador.", webmcpAvailable: "O ChatGPT pode usar as ferramentas de geração enquanto esta página permanecer aberta.", webmcpUnavailable: "Você pode preparar o brief aqui e abrir o ChatGPT; a geração automática nesta página exige um cliente compatível com WebMCP.",
    contextTitle: "Contexto da viagem", contextDetail: "Complete o essencial. O ChatGPT pode enriquecer este brief com o que vocês já conversaram.", protocol: "Protocolo",
    savedTitle: "Viagem salva", draftTitle: "Rascunho validado", savedDetail: "Esta é a versão oficial do Sendero.", draftDetail: "Ainda não faz parte das suas viagens. Revise os avisos antes de salvá-lo.",
    emptyPreviewTitle: "Seu roteiro aparecerá aqui depois de ser validado.", emptySteps: ["Prepare o brief.", "Peça ao ChatGPT para criar o roteiro com o Sendero.", "Revise o rascunho e salve-o explicitamente."],
    openChatgpt: "Abrir ChatGPT", viewTrips: "Ver minhas viagens",
    documentTitle: "Criar uma viagem",
  },
  fr: {
    destination: "Destination", destinationPlaceholder: "Ville et pays", arrival: "Arrivée", departure: "Départ",
    adults: "Adultes", children: "Enfants", transport: "Transport", modes: { walk: "À pied", public_transit: "Transports en commun", taxi: "Taxi", car: "Voiture" },
    licence: "Au moins une personne possède un permis de conduire valide", lodgingArea: "Zone d’hébergement", lodgingAreaPlaceholder: "Quartier ou zone ; cela peut être provisoire",
    address: "Adresse confirmée", addressPlaceholder: "Hébergement ou adresse exacte ; facultatif", optional: "Facultatif", pace: "Rythme", paces: { relaxed: "Détendu", balanced: "Équilibré", intense: "Intense" },
    interests: "Centres d’intérêt", interestsPlaceholder: "Architecture, cuisine locale, musique…", notes: "Notes et contraintes", notesPlaceholder: "Plans fixes, accessibilité, choses à éviter…",
    budget: {
      title: "Budget", description: "Définissez le niveau de dépenses et, si utile, une limite monétaire.", comfort: "Niveau de dépenses", comforts: { flexible: "Flexible", low: "Économique", medium: "Intermédiaire", high: "Premium" },
      amount: "Limite", optional: "Facultatif", currency: "Devise", scope: "S’applique à", scopes: { total: "Tout le voyage", per_person: "Par personne", per_day: "Par jour" },
      flexibility: "Quel degré de fermeté ?", flexibilities: { strict: "Plafond strict", target: "Objectif", flexible: "Référence" }, includes: "Pris en compte dans la limite",
      categories: { activities: "Activités", food: "Repas", local_transport: "Transports locaux", lodging: "Hébergement", long_distance_transport: "Trajet vers la destination" },
      note: "L’hébergement et le trajet vers la destination ne comptent que s’ils sont sélectionnés. Sendero utilise des fourchettes, sans fausse précision.",
    },
    prepare: "Préparer pour ChatGPT", protocolReady: "Le brief est complet. ChatGPT peut maintenant rechercher et générer l’itinéraire avec le protocole actuel.",
    criticalMissing: (fields) => `Informations essentielles manquantes : ${fields}.`, prepareError: "Impossible de préparer le voyage.", saved: "Le voyage a été enregistré dans Sendero.",
    saveError: "Impossible d’enregistrer le voyage.", discarded: "Le brouillon temporaire a été supprimé.", discardError: "Impossible de supprimer le brouillon.",
    loading: "Préparation du planificateur…", signIn: "Se connecter", signedOutDetail: "Votre session Sendero protège les brouillons et voyages créés par ChatGPT depuis cette page.", signedOutTitle: "Connectez-vous pour planifier",
    back: "Retour à vos voyages", unavailableDetail: "Cette fonctionnalité n’est pas encore activée dans cet environnement. Le plugin Sendero reste disponible dans ChatGPT.", unavailableTitle: "Génération web indisponible",
    retry: "Réessayer", errorDetail: "Aucun voyage n’a été modifié ni enregistré.", errorTitle: "Impossible d’ouvrir le planificateur", eyebrow: "Planification conversationnelle", title: "Créer un voyage",
    description: "Sendero fournit les règles, valide le résultat et l’enregistre. ChatGPT effectue les recherches et construit l’itinéraire dans la conversation active.",
    draftReady: "Brouillon temporaire prêt", draftExpired: "Ce brouillon n’est plus disponible.", save: "Enregistrer dans Sendero", discard: "Supprimer le brouillon", open: "Ouvrir le voyage enregistré",
    conversation: "Conversation + Sendero", emptyTitle: "Votre itinéraire apparaîtra ici", emptyDetail: "Complétez le brief et demandez à ChatGPT de le générer. Sendero valide le résultat avant qu’il puisse être enregistré.",
    steps: ["Complétez l’essentiel du voyage.", "Poursuivez la recherche et la génération dans ChatGPT.", "Vérifiez et enregistrez le brouillon validé dans Sendero."],
    webmcpConnected: "WebMCP connecté.", webmcpBrowser: "Mode navigateur.", webmcpAvailable: "ChatGPT peut utiliser les outils de génération tant que cette page reste ouverte.", webmcpUnavailable: "Vous pouvez préparer le brief ici et ouvrir ChatGPT ; la génération automatique depuis cette page nécessite un client compatible avec WebMCP.",
    contextTitle: "Contexte du voyage", contextDetail: "Complétez l’essentiel. ChatGPT peut enrichir ce brief avec les éléments déjà abordés.", protocol: "Protocole",
    savedTitle: "Voyage enregistré", draftTitle: "Brouillon validé", savedDetail: "Il s’agit de la version de référence dans Sendero.", draftDetail: "Il ne fait pas encore partie de vos voyages. Vérifiez les avertissements avant de l’enregistrer.",
    emptyPreviewTitle: "Votre itinéraire apparaîtra ici après validation.", emptySteps: ["Préparez le brief.", "Demandez à ChatGPT de créer l’itinéraire avec Sendero.", "Vérifiez le brouillon et enregistrez-le explicitement."],
    openChatgpt: "Ouvrir ChatGPT", viewTrips: "Voir mes voyages",
    documentTitle: "Créer un voyage",
  },
  de: {
    destination: "Reiseziel", destinationPlaceholder: "Stadt und Land", arrival: "Anreise", departure: "Abreise",
    adults: "Erwachsene", children: "Kinder", transport: "Verkehrsmittel", modes: { walk: "Zu Fuß", public_transit: "Öffentliche Verkehrsmittel", taxi: "Taxi", car: "Auto" },
    licence: "Mindestens eine Person besitzt einen gültigen Führerschein", lodgingArea: "Unterkunftsgegend", lodgingAreaPlaceholder: "Viertel oder Gegend; kann vorläufig sein",
    address: "Bestätigte Adresse", addressPlaceholder: "Unterkunft oder genaue Adresse; optional", optional: "Optional", pace: "Tempo", paces: { relaxed: "Entspannt", balanced: "Ausgewogen", intense: "Intensiv" },
    interests: "Interessen", interestsPlaceholder: "Architektur, lokale Küche, Musik…", notes: "Hinweise und Einschränkungen", notesPlaceholder: "Feste Pläne, Barrierefreiheit, zu vermeidende Dinge…",
    budget: {
      title: "Budget", description: "Lege den Ausgabenstil und bei Bedarf eine Geldgrenze fest.", comfort: "Ausgabenstil", comforts: { flexible: "Flexibel", low: "Günstig", medium: "Mittel", high: "Premium" },
      amount: "Grenze", optional: "Optional", currency: "Währung", scope: "Gilt für", scopes: { total: "Gesamte Reise", per_person: "Pro Person", per_day: "Pro Tag" },
      flexibility: "Wie verbindlich?", flexibilities: { strict: "Feste Obergrenze", target: "Ziel", flexible: "Richtwert" }, includes: "Wird auf die Grenze angerechnet",
      categories: { activities: "Aktivitäten", food: "Verpflegung", local_transport: "Nahverkehr", lodging: "Unterkunft", long_distance_transport: "Anreise zum Ziel" },
      note: "Unterkunft und Anreise zählen nur, wenn sie ausgewählt sind. Sendero arbeitet mit Spannen statt mit Scheingenauigkeit.",
    },
    prepare: "Für ChatGPT vorbereiten", protocolReady: "Die Angaben sind vollständig. ChatGPT kann den Reiseplan jetzt mit dem aktuellen Protokoll recherchieren und erstellen.",
    criticalMissing: (fields) => `Wesentliche Angaben fehlen: ${fields}.`, prepareError: "Die Reise konnte nicht vorbereitet werden.", saved: "Die Reise wurde in Sendero gespeichert.",
    saveError: "Die Reise konnte nicht gespeichert werden.", discarded: "Der temporäre Entwurf wurde verworfen.", discardError: "Der Entwurf konnte nicht verworfen werden.",
    loading: "Planer wird vorbereitet…", signIn: "Anmelden", signedOutDetail: "Deine Sendero-Sitzung schützt die Entwürfe und Reisen, die ChatGPT von dieser Seite aus erstellt.", signedOutTitle: "Zum Planen anmelden",
    back: "Zurück zu deinen Reisen", unavailableDetail: "Diese Funktion ist in dieser Umgebung noch nicht aktiviert. Das Sendero-Plugin bleibt in ChatGPT verfügbar.", unavailableTitle: "Web-Generierung nicht verfügbar",
    retry: "Erneut versuchen", errorDetail: "Es wurde keine Reise geändert oder gespeichert.", errorTitle: "Der Planer konnte nicht geöffnet werden", eyebrow: "Reiseplanung im Gespräch", title: "Reise erstellen",
    description: "Sendero stellt die Regeln bereit, prüft das Ergebnis und speichert es. ChatGPT recherchiert und erstellt den Reiseplan in der aktiven Unterhaltung.",
    draftReady: "Temporärer Entwurf bereit", draftExpired: "Dieser Entwurf ist nicht mehr verfügbar.", save: "In Sendero speichern", discard: "Entwurf verwerfen", open: "Gespeicherte Reise öffnen",
    conversation: "Unterhaltung + Sendero", emptyTitle: "Dein Reiseplan erscheint hier", emptyDetail: "Vervollständige die Angaben und bitte ChatGPT, ihn zu erstellen. Sendero prüft das Ergebnis, bevor es gespeichert werden kann.",
    steps: ["Vervollständige das Wichtigste zur Reise.", "Setze Recherche und Erstellung in ChatGPT fort.", "Prüfe den validierten Entwurf und speichere ihn in Sendero."],
    webmcpConnected: "WebMCP verbunden.", webmcpBrowser: "Browsermodus.", webmcpAvailable: "ChatGPT kann die Generierungswerkzeuge verwenden, solange diese Seite geöffnet bleibt.", webmcpUnavailable: "Du kannst die Angaben hier vorbereiten und ChatGPT öffnen; die automatische Generierung von dieser Seite benötigt einen WebMCP-kompatiblen Client.",
    contextTitle: "Reisekontext", contextDetail: "Vervollständige das Wichtigste. ChatGPT kann diese Angaben mit bereits Besprochenem ergänzen.", protocol: "Protokoll",
    savedTitle: "Gespeicherte Reise", draftTitle: "Validierter Entwurf", savedDetail: "Dies ist die maßgebliche Sendero-Version.", draftDetail: "Der Entwurf gehört noch nicht zu deinen Reisen. Prüfe vor dem Speichern die Warnungen.",
    emptyPreviewTitle: "Dein Reiseplan erscheint hier nach der Validierung.", emptySteps: ["Bereite die Angaben vor.", "Bitte ChatGPT, den Reiseplan mit Sendero zu erstellen.", "Prüfe den Entwurf und speichere ihn ausdrücklich."],
    openChatgpt: "ChatGPT öffnen", viewTrips: "Meine Reisen anzeigen",
    documentTitle: "Reise erstellen",
  },
};

const FLOW_COPY = {
  en: {
    description: "Tell us about the trip. Sendero prepares the handoff, ChatGPT creates the itinerary, and Sendero validates it before anything is saved.",
    progressLabel: "Itinerary creation progress",
    progress: ["Trip details", "Continue in ChatGPT", "Review and save"],
    contextTitle: "Tell us about your trip",
    contextDetail: "Complete the essentials and add as much or as little optional detail as you want.",
    prepare: "Create ChatGPT prompt",
    invalidDates: "The departure date must be the same as or later than the arrival date.",
    invalidDayTimes: "For a one-day trip, the departure time must be later than the arrival time.",
    licenceRequired: "Choose another transport option or confirm that at least one traveller has a valid driving licence.",
    receiptTitle: "Trip details ready",
    receiptDetail: ({ destination, startDate, endDate }) => `${destination} · ${startDate}–${endDate}`,
    editBrief: "Edit details",
    handoffEyebrow: "Step 2 · Continue in ChatGPT",
    handoffTitle: "Your prompt is ready",
    handoffDetail: "No itinerary has been generated or validated yet. Copy this prompt and send it to ChatGPT to continue.",
    promptLabel: "Prompt to paste in ChatGPT",
    copyPrompt: "Copy prompt",
    copied: "Prompt copied. Now paste it into ChatGPT.",
    copyError: "We couldn't copy it automatically. Select the prompt and copy it manually.",
    connected: "Sendero site tools are available in this browser. Keep this page open so ChatGPT can return the validated draft here.",
    notConnected: "Sendero site tools are not available in this browser. For the integrated flow, open Sendero in the ChatGPT desktop app's built-in browser; otherwise use the prompt with the connected Sendero plugin.",
    recommended: "Integrated flow",
    sideChatTitle: "Continue in the ChatGPT desktop app",
    sideChatDetail: "Open Sendero in ChatGPT's built-in browser so ChatGPT can discover the site's tools and return the validated draft here.",
    sideChatSteps: ["Copy the prompt on this page.", "From the ChatGPT desktop toolbar, open the built-in browser, visit this Sendero page, and sign in.", "Paste and send the prompt in your conversation. Keep the Sendero page open while ChatGPT creates and validates the itinerary."],
    extensionGuide: "Learn how ChatGPT site tools work",
    alternativeTitle: "Or use ChatGPT web or Chrome",
    alternativeDetail: "Open ChatGPT in another tab or with the Chrome extension or sidebar, paste the same prompt, and use the connected Sendero plugin. Site tools are not available in Chrome.",
    waiting: "After ChatGPT returns a validated draft, Sendero will show the preview as step 3. Nothing is saved without your approval.",
    previewEyebrow: "Step 3 · Review in Sendero",
  },
  es: {
    description: "Cuéntanos sobre el viaje. Sendero prepara el traspaso, ChatGPT crea el itinerario y Sendero lo valida antes de guardar nada.",
    progressLabel: "Progreso de creación del itinerario",
    progress: ["Datos del viaje", "Continuar en ChatGPT", "Revisar y guardar"],
    contextTitle: "Cuéntanos sobre tu viaje",
    contextDetail: "Completa lo esencial y añade tantos detalles opcionales como quieras.",
    prepare: "Crear prompt para ChatGPT",
    invalidDates: "La fecha de salida debe ser igual o posterior a la fecha de llegada.",
    invalidDayTimes: "En un viaje de un día, la hora de salida debe ser posterior a la hora de llegada.",
    licenceRequired: "Elige otro transporte o confirma que al menos una persona tiene una licencia de conducir válida.",
    receiptTitle: "Datos del viaje listos",
    receiptDetail: ({ destination, startDate, endDate }) => `${destination} · ${startDate}–${endDate}`,
    editBrief: "Editar datos",
    handoffEyebrow: "Paso 2 · Continuar en ChatGPT",
    handoffTitle: "Tu prompt está listo",
    handoffDetail: "Todavía no se generó ni validó ningún itinerario. Copia este prompt y envíalo a ChatGPT para continuar.",
    promptLabel: "Prompt para pegar en ChatGPT",
    copyPrompt: "Copiar prompt",
    copied: "Prompt copiado. Ahora pégalo en ChatGPT.",
    copyError: "No pudimos copiarlo automáticamente. Selecciona el prompt y cópialo manualmente.",
    connected: "Las herramientas de Sendero están disponibles en este navegador. Mantén esta página abierta para que ChatGPT pueda devolver aquí el borrador validado.",
    notConnected: "Las herramientas de sitio de Sendero no están disponibles en este navegador. Para el flujo integrado, abre Sendero en el navegador incorporado de la app de escritorio de ChatGPT; si no, usa el prompt con el plugin conectado de Sendero.",
    recommended: "Flujo integrado",
    sideChatTitle: "Continúa en la app de escritorio de ChatGPT",
    sideChatDetail: "Abre Sendero en el navegador incorporado de ChatGPT para que pueda descubrir las herramientas del sitio y devolver aquí el borrador validado.",
    sideChatSteps: ["Copia el prompt de esta página.", "Desde la barra de la app de escritorio de ChatGPT, abre el navegador incorporado, visita esta página de Sendero e inicia sesión.", "Pega y envía el prompt en tu conversación. Mantén abierta la página de Sendero mientras ChatGPT crea y valida el itinerario."],
    extensionGuide: "Cómo funcionan las herramientas de sitio de ChatGPT",
    alternativeTitle: "O usa ChatGPT web o Chrome",
    alternativeDetail: "Abre ChatGPT en otra pestaña o con la extensión o barra lateral de Chrome, pega el mismo prompt y utiliza el plugin conectado de Sendero. Las herramientas de sitio no están disponibles en Chrome.",
    waiting: "Cuando ChatGPT devuelva un borrador validado, Sendero mostrará el preview como paso 3. Nada se guarda sin tu aprobación.",
    previewEyebrow: "Paso 3 · Revisar en Sendero",
  },
  pt: {
    description: "Conte-nos sobre a viagem. O Sendero prepara a passagem, o ChatGPT cria o roteiro e o Sendero o valida antes de salvar qualquer coisa.",
    progressLabel: "Progresso da criação do roteiro",
    progress: ["Dados da viagem", "Continuar no ChatGPT", "Revisar e salvar"],
    contextTitle: "Conte-nos sobre sua viagem",
    contextDetail: "Preencha o essencial e acrescente quantos detalhes opcionais quiser.",
    prepare: "Criar prompt para o ChatGPT",
    invalidDates: "A data de partida deve ser igual ou posterior à data de chegada.",
    invalidDayTimes: "Em uma viagem de um dia, o horário de partida deve ser posterior ao de chegada.",
    licenceRequired: "Escolha outro transporte ou confirme que pelo menos uma pessoa tem carteira de motorista válida.",
    receiptTitle: "Dados da viagem prontos",
    receiptDetail: ({ destination, startDate, endDate }) => `${destination} · ${startDate}–${endDate}`,
    editBrief: "Editar dados",
    handoffEyebrow: "Etapa 2 · Continuar no ChatGPT",
    handoffTitle: "Seu prompt está pronto",
    handoffDetail: "Nenhum roteiro foi gerado ou validado ainda. Copie este prompt e envie-o ao ChatGPT para continuar.",
    promptLabel: "Prompt para colar no ChatGPT",
    copyPrompt: "Copiar prompt",
    copied: "Prompt copiado. Agora cole-o no ChatGPT.",
    copyError: "Não foi possível copiá-lo automaticamente. Selecione o prompt e copie-o manualmente.",
    connected: "As ferramentas do Sendero estão disponíveis neste navegador. Mantenha esta página aberta para que o ChatGPT possa devolver o rascunho validado aqui.",
    notConnected: "As ferramentas de site do Sendero não estão disponíveis neste navegador. Para o fluxo integrado, abra o Sendero no navegador incorporado do app para desktop do ChatGPT; caso contrário, use o prompt com o plugin conectado do Sendero.",
    recommended: "Fluxo integrado",
    sideChatTitle: "Continue no app para desktop do ChatGPT",
    sideChatDetail: "Abra o Sendero no navegador incorporado do ChatGPT para que ele descubra as ferramentas do site e devolva aqui o rascunho validado.",
    sideChatSteps: ["Copie o prompt desta página.", "Na barra do app para desktop do ChatGPT, abra o navegador incorporado, visite esta página do Sendero e entre na sua conta.", "Cole e envie o prompt na conversa. Mantenha a página do Sendero aberta enquanto o ChatGPT cria e valida o roteiro."],
    extensionGuide: "Como funcionam as ferramentas de site do ChatGPT",
    alternativeTitle: "Ou use o ChatGPT web ou Chrome",
    alternativeDetail: "Abra o ChatGPT em outra aba ou com a extensão ou barra lateral do Chrome, cole o mesmo prompt e use o plugin conectado do Sendero. As ferramentas de site não estão disponíveis no Chrome.",
    waiting: "Quando o ChatGPT devolver um rascunho validado, o Sendero mostrará a prévia como etapa 3. Nada é salvo sem sua aprovação.",
    previewEyebrow: "Etapa 3 · Revisar no Sendero",
  },
  fr: {
    description: "Parlez-nous du voyage. Sendero prépare le relais, ChatGPT crée l’itinéraire et Sendero le valide avant tout enregistrement.",
    progressLabel: "Progression de la création de l’itinéraire",
    progress: ["Détails du voyage", "Continuer dans ChatGPT", "Vérifier et enregistrer"],
    contextTitle: "Parlez-nous de votre voyage",
    contextDetail: "Renseignez l’essentiel et ajoutez autant de détails facultatifs que vous le souhaitez.",
    prepare: "Créer le prompt pour ChatGPT",
    invalidDates: "La date de départ doit être identique ou postérieure à la date d’arrivée.",
    invalidDayTimes: "Pour un voyage d’une journée, l’heure de départ doit être postérieure à l’heure d’arrivée.",
    licenceRequired: "Choisissez un autre transport ou confirmez qu’au moins une personne possède un permis de conduire valide.",
    receiptTitle: "Détails du voyage prêts",
    receiptDetail: ({ destination, startDate, endDate }) => `${destination} · ${startDate}–${endDate}`,
    editBrief: "Modifier les détails",
    handoffEyebrow: "Étape 2 · Continuer dans ChatGPT",
    handoffTitle: "Votre prompt est prêt",
    handoffDetail: "Aucun itinéraire n’a encore été généré ni validé. Copiez ce prompt et envoyez-le à ChatGPT pour continuer.",
    promptLabel: "Prompt à coller dans ChatGPT",
    copyPrompt: "Copier le prompt",
    copied: "Prompt copié. Collez-le maintenant dans ChatGPT.",
    copyError: "Impossible de le copier automatiquement. Sélectionnez le prompt et copiez-le manuellement.",
    connected: "Les outils Sendero sont disponibles dans ce navigateur. Gardez cette page ouverte afin que ChatGPT puisse y renvoyer le brouillon validé.",
    notConnected: "Les outils de site Sendero ne sont pas disponibles dans ce navigateur. Pour le parcours intégré, ouvrez Sendero dans le navigateur intégré de l’application de bureau ChatGPT ; sinon, utilisez le prompt avec le plugin Sendero connecté.",
    recommended: "Parcours intégré",
    sideChatTitle: "Continuez dans l’application de bureau ChatGPT",
    sideChatDetail: "Ouvrez Sendero dans le navigateur intégré de ChatGPT afin qu’il découvre les outils du site et renvoie ici le brouillon validé.",
    sideChatSteps: ["Copiez le prompt de cette page.", "Dans la barre de l’application de bureau ChatGPT, ouvrez le navigateur intégré, consultez cette page Sendero et connectez-vous.", "Collez et envoyez le prompt dans votre conversation. Gardez la page Sendero ouverte pendant la création et la validation de l’itinéraire."],
    extensionGuide: "Comprendre les outils de site ChatGPT",
    alternativeTitle: "Ou utilisez ChatGPT web ou Chrome",
    alternativeDetail: "Ouvrez ChatGPT dans un autre onglet ou avec l’extension ou la barre latérale Chrome, collez le même prompt et utilisez le plugin Sendero connecté. Les outils de site ne sont pas disponibles dans Chrome.",
    waiting: "Lorsque ChatGPT renverra un brouillon validé, Sendero affichera l’aperçu à l’étape 3. Rien n’est enregistré sans votre accord.",
    previewEyebrow: "Étape 3 · Vérifier dans Sendero",
  },
  de: {
    description: "Erzähle uns von der Reise. Sendero bereitet die Übergabe vor, ChatGPT erstellt den Reiseplan und Sendero prüft ihn, bevor etwas gespeichert wird.",
    progressLabel: "Fortschritt der Reiseplanerstellung",
    progress: ["Reisedaten", "In ChatGPT fortfahren", "Prüfen und speichern"],
    contextTitle: "Erzähle uns von deiner Reise",
    contextDetail: "Vervollständige das Wesentliche und ergänze beliebig viele optionale Details.",
    prepare: "Prompt für ChatGPT erstellen",
    invalidDates: "Das Abreisedatum muss am oder nach dem Anreisedatum liegen.",
    invalidDayTimes: "Bei einer eintägigen Reise muss die Abreisezeit nach der Ankunftszeit liegen.",
    licenceRequired: "Wähle ein anderes Verkehrsmittel oder bestätige, dass mindestens eine Person einen gültigen Führerschein hat.",
    receiptTitle: "Reisedaten bereit",
    receiptDetail: ({ destination, startDate, endDate }) => `${destination} · ${startDate}–${endDate}`,
    editBrief: "Daten bearbeiten",
    handoffEyebrow: "Schritt 2 · In ChatGPT fortfahren",
    handoffTitle: "Dein Prompt ist bereit",
    handoffDetail: "Es wurde noch kein Reiseplan erstellt oder validiert. Kopiere diesen Prompt und sende ihn an ChatGPT, um fortzufahren.",
    promptLabel: "Prompt zum Einfügen in ChatGPT",
    copyPrompt: "Prompt kopieren",
    copied: "Prompt kopiert. Füge ihn jetzt in ChatGPT ein.",
    copyError: "Der Prompt konnte nicht automatisch kopiert werden. Markiere ihn und kopiere ihn manuell.",
    connected: "Die Sendero-Tools sind in diesem Browser verfügbar. Lass diese Seite geöffnet, damit ChatGPT den validierten Entwurf hier zurückgeben kann.",
    notConnected: "Die Sendero-Website-Tools sind in diesem Browser nicht verfügbar. Öffne Sendero für den integrierten Ablauf im eingebauten Browser der ChatGPT-Desktop-App; andernfalls verwende den Prompt mit dem verbundenen Sendero-Plugin.",
    recommended: "Integrierter Ablauf",
    sideChatTitle: "In der ChatGPT-Desktop-App fortfahren",
    sideChatDetail: "Öffne Sendero im eingebauten Browser von ChatGPT, damit die Website-Tools erkannt werden und der validierte Entwurf hierher zurückkehrt.",
    sideChatSteps: ["Kopiere den Prompt auf dieser Seite.", "Öffne über die Leiste der ChatGPT-Desktop-App den eingebauten Browser, rufe diese Sendero-Seite auf und melde dich an.", "Füge den Prompt in deine Unterhaltung ein und sende ihn. Lass die Sendero-Seite geöffnet, während ChatGPT den Reiseplan erstellt und validiert."],
    extensionGuide: "So funktionieren Website-Tools in ChatGPT",
    alternativeTitle: "Oder ChatGPT Web beziehungsweise Chrome verwenden",
    alternativeDetail: "Öffne ChatGPT in einem anderen Tab oder mit der Chrome-Erweiterung beziehungsweise Seitenleiste, füge denselben Prompt ein und verwende das verbundene Sendero-Plugin. Website-Tools sind in Chrome nicht verfügbar.",
    waiting: "Sobald ChatGPT einen validierten Entwurf zurückgibt, zeigt Sendero die Vorschau als Schritt 3. Ohne deine Zustimmung wird nichts gespeichert.",
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

function chatGptUrl() {
  return document.querySelector('meta[name="sendero-chatgpt-url"]')?.content || "https://chatgpt.com/";
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
            destinationPlaceId: placeId,
            ...(resetLodging ? {
              lodging: {
                area: "",
                areaPlaceId: "",
                address: "",
                addressPlaceId: "",
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
        copy={copy.lodgingAreaSearch}
        csrfToken={csrfToken}
        destinationPlaceId={brief.destinationPlaceId}
        disabled={!brief.destinationPlaceId}
        kind="lodging_area"
        label={copy.lodgingArea}
        locale={locale}
        name="lodging-area-search"
        onChange={({ label, placeId }) => onChange({
          ...brief,
          lodging: { ...brief.lodging, area: label, areaPlaceId: placeId },
        })}
        placeholder={copy.lodgingAreaPlaceholder}
        value={{ label: brief.lodging.area, placeId: brief.lodging.areaPlaceId }}
      />
      <DestinationCombobox
        copy={copy.lodgingAddressSearch}
        csrfToken={csrfToken}
        destinationPlaceId={brief.destinationPlaceId}
        disabled={!brief.destinationPlaceId}
        kind="lodging_address"
        label={copy.address}
        locale={locale}
        name="lodging-address-search"
        onChange={({ label, placeId }) => onChange({
          ...brief,
          lodging: { ...brief.lodging, address: label, addressPlaceId: placeId },
        })}
        placeholder={copy.addressPlaceholder}
        value={{ label: brief.lodging.address, placeId: brief.lodging.addressPlaceId }}
      />
      <label className="generate-field"><span>{copy.pace}</span><select onChange={(event) => onChange({ ...brief, pace: event.target.value })} value={brief.pace}>{Object.entries(copy.paces).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <TripProfileFields adultsCount={brief.travellers.adults} childrenCount={brief.travellers.children} copy={copy.profile} onChange={(profile) => onChange({ ...brief, profile })} value={brief.profile} />
      <BudgetFields copy={copy.budget} onChange={(budget) => onChange({ ...brief, budget })} value={brief.budget} />
      <label className="generate-field"><span>{copy.interests}</span><textarea onChange={(event) => onChange({ ...brief, interests: event.target.value.split(",").map((value) => value.trim()) })} placeholder={copy.interestsPlaceholder} value={brief.interests.join(", ")} /></label>
      <label className="generate-field"><span>{copy.notes}</span><textarea onChange={(event) => onChange({ ...brief, notes: event.target.value })} placeholder={copy.notesPlaceholder} value={brief.notes} /></label>
      <div className="generate-form-actions">
        <WebButton disabled={busy || brief.transport.modes.length === 0} tone="primary" type="submit">{copy.prepare}</WebButton>
      </div>
    </form>
  );
}

function briefIssue(brief, copy) {
  if (!brief.destination || !brief.destinationPlaceId) {
    return copy.destinationSearch.selectionRequired;
  }
  if (brief.lodging?.area?.trim() && !brief.lodging?.areaPlaceId) {
    return copy.lodgingAreaSearch.selectionRequired;
  }
  if (brief.lodging?.address?.trim() && !brief.lodging?.addressPlaceId) {
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

function GenerationProgress({ activeStep, copy }) {
  return (
    <ol aria-label={copy.progressLabel} className="generate-progress">
      {copy.progress.map((label, index) => {
        const step = index + 1;
        const state = step < activeStep ? "is-complete" : step === activeStep ? "is-active" : "";
        return (
          <li aria-current={step === activeStep ? "step" : undefined} className={state} key={label}>
            <span aria-hidden="true" className="generate-step-number">{step < activeStep ? "✓" : step}</span>
            <span className="generate-step-label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function HandoffPanel({
  brief,
  copy,
  copyState,
  locale,
  onCopy,
  onEdit,
  prompt,
  webmcp,
}) {
  const startDate = formatDate(locale, brief.startDate, { dateStyle: "medium" });
  const endDate = formatDate(locale, brief.endDate, { dateStyle: "medium" });
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
        <h2 id="generate-handoff-title">{copy.handoffTitle}</h2>
        <p>{copy.handoffDetail}</p>
      </div>
      <div className={`generate-connection ${webmcp === "available" ? "is-ready" : ""}`}>
        <span aria-hidden="true" className="generate-connection-dot" />
        <span>{webmcp === "available" ? copy.connected : copy.notConnected}</span>
      </div>
      <div className="generate-handoff-grid">
        <div className="generate-prompt">
          <label htmlFor="sendero-handoff-prompt">{copy.promptLabel}</label>
          <textarea id="sendero-handoff-prompt" readOnly value={prompt} />
          <div className="generate-handoff-actions">
            <WebButton onClick={onCopy} tone="primary">{copy.copyPrompt}</WebButton>
            <a className="web-button" href={chatGptUrl()} rel="noreferrer" target="_blank">{copy.openChatgpt} ↗</a>
          </div>
          <p aria-live="polite" className="generate-copy-status" role="status">
            {copyState === "copied" ? copy.copied : copyState === "error" ? copy.copyError : ""}
          </p>
        </div>
        <aside className="generate-handoff-guide">
          <div>
            <p className="web-eyebrow">{copy.recommended}</p>
            <h3>{copy.sideChatTitle}</h3>
            <p>{copy.sideChatDetail}</p>
          </div>
          <ol>{copy.sideChatSteps.map((step) => <li key={step}>{step}</li>)}</ol>
          <a className="generate-extension-link" href={CHATGPT_SITE_TOOLS_GUIDE_URL} rel="noreferrer" target="_blank">{copy.extensionGuide} ↗</a>
          <div className="generate-secondary-path">
            <h3>{copy.alternativeTitle}</h3>
            <p>{copy.alternativeDetail}</p>
          </div>
          <p>{copy.waiting}</p>
        </aside>
      </div>
    </section>
  );
}

export function GenerateTripApp() {
  const { language, locale } = useUiLocale();
  const copy = {
    ...(COPY[language] || COPY.es),
    ...(FLOW_COPY[language] || FLOW_COPY.es),
    destinationSearch: DESTINATION_COPY[language] || DESTINATION_COPY.es,
    lodgingAreaSearch: lodgingSearchCopy(language, "area"),
    lodgingAddressSearch: lodgingSearchCopy(language, "address"),
    profile: profileCopy(locale),
  };
  const [page, setPage] = useState({ kind: "loading" });
  const [brief, setBrief] = useState(() => ({ ...initialBrief, locale }));
  const [draft, setDraft] = useState(null);
  const [preparedBrief, setPreparedBrief] = useState(null);
  const [copyState, setCopyState] = useState("idle");
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [webmcp, setWebmcp] = useState("checking");
  const briefRef = useRef(brief);
  const draftRef = useRef(draft);
  const facadeRef = useRef(null);
  briefRef.current = brief;
  draftRef.current = draft;

  const applyDraft = useCallback((value) => {
    setDraft(value);
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
  }, []);

  const load = useCallback(async (signal) => {
    setPage({ kind: "loading" });
    try {
      const session = normalizeSession(await requestJson("/api/session", { signal }));
      if (!session.authenticated) return setPage({ kind: "signed_out", session });
      const capabilities = await requestJson("/api/itinerary-planning/capabilities", { signal });
      if (!capabilities.enabled) return setPage({ kind: "unavailable", session });
      setPage({ kind: "ready", session, capabilities });
      const draftId = new URL(globalThis.location.href).searchParams.get("draft");
      if (draftId) {
        const existing = await requestJson(`/api/itinerary-drafts/${encodeURIComponent(draftId)}`, { signal });
        applyDraft(existing);
      }
    } catch (error) {
      if (error?.name !== "AbortError") setPage({ kind: "error", error });
    }
  }, [applyDraft]);

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
    if (page.kind !== "ready") return undefined;
    const controller = new AbortController();
    const facade = createItineraryGenerationFacade({
      csrfToken: page.session.csrfToken,
      getBrief: () => compactBrief(briefRef.current),
      getCurrentDraftId: () => draftRef.current?.draftId,
      onDraft: applyDraft,
    });
    facadeRef.current = facade;
    registerItineraryGenerationTools(document, facade, {
      signal: controller.signal,
      report(event) {
        if (event.type === "webmcp_support_detected") setWebmcp("available");
        if (event.type === "webmcp_support_unavailable") setWebmcp("unavailable");
      },
    }).catch(() => setWebmcp("error"));
    return () => {
      facadeRef.current = null;
      controller.abort();
    };
  }, [applyDraft, page]);

  function prepare(event) {
    event.preventDefault();
    setNotice(null);
    const issue = briefIssue(brief, copy);
    if (issue) {
      setNotice({ kind: "error", text: issue });
      return;
    }
    setPreparedBrief(compactBrief(brief));
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
    setCopyState("idle");
    setNotice(null);
    requestAnimationFrame(() => document.getElementById("generate-context-title")?.focus());
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
      setNotice({ kind: "ready", text: copy.discarded });
    } catch (error) {
      setNotice({ kind: "error", text: error.message || copy.discardError });
    } finally {
      setBusy(false);
    }
  }

  if (page.kind === "loading") return <WebState kind="loading" title={copy.loading} />;
  if (page.kind === "signed_out") return <WebState action={<a className="web-button web-button-primary" href={loginUrl(page.session, hrefForLocale("/app/new", locale))}>{copy.signIn}</a>} detail={copy.signedOutDetail} title={copy.signedOutTitle} />;
  if (page.kind === "unavailable") return <WebState action={<a className="web-button" href={hrefForLocale("/app", locale)}>{copy.back}</a>} detail={copy.unavailableDetail} session={page.session} title={copy.unavailableTitle} />;
  if (page.kind === "error") return <WebState action={<WebButton onClick={() => load()}>{copy.retry}</WebButton>} detail={copy.errorDetail} kind="error" title={copy.errorTitle} />;

  const itinerary = draft?.itinerary || draft?.trip?.itinerary;
  const savedTrip = draft?.status === "saved" ? draft.trip : null;
  const handoffPrompt = preparedBrief
    ? createItineraryHandoffPrompt(preparedBrief, language)
    : "";
  const activeStep = itinerary ? 3 : preparedBrief ? 2 : 1;
  return (
    <WebPageFrame csrfToken={page.session.csrfToken} user={page.session.user}>
      <style>{generateStyles}</style>
      <header className="web-heading">
        <p className="web-eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p>{copy.description}</p>
      </header>
      <div className="generate-flow">
        <GenerationProgress activeStep={activeStep} copy={copy} />
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
            locale={locale}
            onCopy={copyPrompt}
            onEdit={editBrief}
            prompt={handoffPrompt}
            webmcp={webmcp}
          />
        ) : null}
        {activeStep === 3 ? (
          <section aria-labelledby="generate-preview-title" className="generate-card generate-preview">
            <p className="web-eyebrow">{copy.previewEyebrow}</p>
            <h2 id="generate-preview-title" tabIndex={-1}>{draft.status === "saved" ? copy.savedTitle : copy.draftTitle}</h2>
            <p>{draft.status === "saved" ? copy.savedDetail : copy.draftDetail}</p>
            {draft.warnings?.length ? <ul className="generate-steps">{draft.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}
            <div className="generate-draft-actions">
              {draft.status === "valid" ? <WebButton disabled={busy} onClick={saveDraft} tone="primary">{copy.save}</WebButton> : null}
              {draft.status === "valid" ? <WebButton disabled={busy} onClick={discardDraft}>{copy.discard}</WebButton> : null}
              {savedTrip?.webId ? <a className="web-button web-button-primary" href={hrefForLocale(`/app/trips/${encodeURIComponent(savedTrip.webId)}`, locale)}>{copy.open}</a> : null}
            </div>
            <ItineraryViewer itinerary={itinerary} uiLocale={locale} variant="web" />
          </section>
        ) : null}
      </div>
    </WebPageFrame>
  );
}
