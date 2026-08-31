import { useCallback, useEffect, useRef, useState } from "react";
import { WebButton, WebPageFrame, WebState } from "../account/PageFrame.jsx";
import {
  loginUrl,
  normalizeSession,
  requestJson,
} from "../account/web-client.js";
import { ItineraryViewer } from "../itinerary/ItineraryViewer.jsx";
import { hrefForLocale, useUiLocale } from "../i18n/LanguageSelector.jsx";
import { t } from "../i18n/index.js";
import { createItineraryGenerationFacade } from "./generation-client.js";
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
.generate-layout { display: grid; grid-template-columns: minmax(280px, 390px) minmax(0, 1fr); gap: 22px; align-items: start; }
.generate-card { border: 1px solid var(--web-line); border-radius: 20px; padding: 22px; background: var(--web-surface); }
.generate-card h2 { margin: 0; font-size: 21px; letter-spacing: -.025em; }
.generate-card > p { margin: 8px 0 0; color: var(--web-muted); }
.generate-form { display: grid; gap: 15px; margin-top: 22px; }
.generate-field { display: grid; gap: 6px; }
.generate-field > span, .generate-legend { font-size: 14px; font-weight: 690; }
.generate-field input, .generate-field select, .generate-field textarea { width: 100%; border: 1px solid var(--web-line); border-radius: 10px; padding: 10px 12px; background: var(--web-surface); color: var(--web-ink); }
.generate-field textarea { min-height: 84px; resize: vertical; font: inherit; }
.generate-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.generate-options { display: flex; flex-wrap: wrap; gap: 8px 12px; border: 0; margin: 0; padding: 0; }
.generate-option { display: inline-flex; align-items: center; gap: 6px; color: var(--web-muted); }
.generate-option input { width: 18px; height: 18px; accent-color: var(--web-forest); }
.generate-status { display: grid; gap: 12px; margin-bottom: 18px; }
.generate-notice { border-radius: 14px; padding: 13px 15px; background: var(--web-soft); color: var(--web-muted); }
.generate-notice strong { color: var(--web-ink); }
.generate-notice.is-ready { background: rgba(162, 212, 94, .2); }
.generate-notice.is-error { color: var(--web-danger); }
.generate-draft-actions { display: flex; flex-wrap: wrap; gap: 10px; margin: 16px 0; }
.generate-preview { min-width: 0; overflow: hidden; }
.generate-preview .itinerary-viewer { border-radius: 18px; }
.generate-empty { display: grid; min-height: 360px; align-content: center; justify-items: start; }
.generate-empty h2 { font-size: clamp(24px, 4vw, 36px); }
.generate-steps { margin: 18px 0 0; padding-left: 20px; color: var(--web-muted); }
.generate-steps li + li { margin-top: 8px; }
.generate-protocol { word-break: break-all; font-size: 12px; color: var(--web-muted); }
@media (max-width: 860px) { .generate-layout { grid-template-columns: 1fr; } }
@media (max-width: 520px) { .generate-row { grid-template-columns: 1fr; } .generate-card { padding: 17px; } }
`;

const initialBrief = {
  locale: "es",
  destination: "",
  startDate: "",
  endDate: "",
  travellers: { adults: 1, children: 0 },
  pace: "balanced",
  interests: [],
  transport: { modes: ["walk", "public_transit"], hasLicense: false, wantsCar: false },
  lodging: { area: "", address: "", status: "undecided" },
  budget: budgetDraftFromValue(),
  profile: tripProfileDraftFromBrief(),
  notes: "",
};

const COPY = {
  en: {
    destination: "Destination", destinationPlaceholder: "City and country", arrival: "Arrival", departure: "Departure",
    adults: "Adults", children: "Children", transport: "Transport", modes: { walk: "On foot", public_transit: "Public transport", taxi: "Taxi", car: "Car" },
    licence: "At least one person has a valid driving licence", lodgingArea: "Lodging area", lodgingAreaPlaceholder: "Neighbourhood or area; it can be provisional",
    address: "Confirmed address", optional: "Optional", pace: "Pace", paces: { relaxed: "Relaxed", balanced: "Balanced", intense: "Intense" },
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
    address: "Dirección confirmada", optional: "Opcional", pace: "Ritmo", paces: { relaxed: "Relajado", balanced: "Equilibrado", intense: "Intenso" },
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
    address: "Endereço confirmado", optional: "Opcional", pace: "Ritmo", paces: { relaxed: "Tranquilo", balanced: "Equilibrado", intense: "Intenso" },
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
    address: "Adresse confirmée", optional: "Facultatif", pace: "Rythme", paces: { relaxed: "Détendu", balanced: "Équilibré", intense: "Intense" },
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
    address: "Bestätigte Adresse", optional: "Optional", pace: "Tempo", paces: { relaxed: "Entspannt", balanced: "Ausgewogen", intense: "Intensiv" },
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
    ...(clean(brief.lodging?.address) ? { address: clean(brief.lodging.address) } : {}),
    status: clean(brief.lodging?.address) ? "confirmed" : "area_only",
  };
  return {
    locale: clean(brief.locale) || "es",
    ...(clean(brief.destination) ? { destination: clean(brief.destination) } : {}),
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

function BriefForm({ brief, busy, copy, onChange, onSubmit }) {
  const toggleMode = (mode) => {
    const modes = brief.transport.modes.includes(mode)
      ? brief.transport.modes.filter((value) => value !== mode)
      : [...brief.transport.modes, mode];
    onChange({ ...brief, transport: { ...brief.transport, modes } });
  };
  return (
    <form className="generate-form" onSubmit={onSubmit}>
      <label className="generate-field">
        <span>{copy.destination}</span>
        <input autoComplete="off" onChange={(event) => onChange({ ...brief, destination: event.target.value })} placeholder={copy.destinationPlaceholder} required value={brief.destination} />
      </label>
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
      <label className="generate-field"><span>{copy.lodgingArea}</span><input onChange={(event) => onChange({ ...brief, lodging: { ...brief.lodging, area: event.target.value } })} placeholder={copy.lodgingAreaPlaceholder} value={brief.lodging.area} /></label>
      <label className="generate-field"><span>{copy.address}</span><input onChange={(event) => onChange({ ...brief, lodging: { ...brief.lodging, address: event.target.value } })} placeholder={copy.optional} value={brief.lodging.address} /></label>
      <label className="generate-field"><span>{copy.pace}</span><select onChange={(event) => onChange({ ...brief, pace: event.target.value })} value={brief.pace}>{Object.entries(copy.paces).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <TripProfileFields adultsCount={brief.travellers.adults} childrenCount={brief.travellers.children} copy={copy.profile} onChange={(profile) => onChange({ ...brief, profile })} value={brief.profile} />
      <BudgetFields copy={copy.budget} onChange={(budget) => onChange({ ...brief, budget })} value={brief.budget} />
      <label className="generate-field"><span>{copy.interests}</span><textarea onChange={(event) => onChange({ ...brief, interests: event.target.value.split(",").map((value) => value.trim()) })} placeholder={copy.interestsPlaceholder} value={brief.interests.join(", ")} /></label>
      <label className="generate-field"><span>{copy.notes}</span><textarea onChange={(event) => onChange({ ...brief, notes: event.target.value })} placeholder={copy.notesPlaceholder} value={brief.notes} /></label>
      <WebButton disabled={busy || brief.transport.modes.length === 0} tone="primary" type="submit">{copy.prepare}</WebButton>
    </form>
  );
}

export function GenerateTripApp() {
  const { language, locale } = useUiLocale();
  const copy = { ...(COPY[language] || COPY.es), profile: profileCopy(locale) };
  const [page, setPage] = useState({ kind: "loading" });
  const [brief, setBrief] = useState(() => ({ ...initialBrief, locale }));
  const [draft, setDraft] = useState(null);
  const [protocol, setProtocol] = useState(null);
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

  async function prepare(event) {
    event.preventDefault();
    if (!facadeRef.current) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await facadeRef.current.getProtocol({ brief: compactBrief(brief) });
      setProtocol(result);
      setNotice(result.brief.ready
        ? { kind: "ready", text: copy.protocolReady }
        : { kind: "error", text: copy.criticalMissing(result.brief.criticalFields.join(", ")) });
    } catch (error) {
      setNotice({ kind: "error", text: error.message || copy.prepareError });
    } finally {
      setBusy(false);
    }
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
  return (
    <WebPageFrame csrfToken={page.session.csrfToken} user={page.session.user}>
      <style>{generateStyles}</style>
      <header className="web-heading">
        <p className="web-eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p>{copy.description}</p>
      </header>
      <div className="generate-status" aria-live="polite">
        <div className={`generate-notice ${webmcp === "available" ? "is-ready" : ""}`}>
          <strong>{webmcp === "available" ? copy.webmcpConnected : copy.webmcpBrowser}</strong>{" "}
          {webmcp === "available" ? copy.webmcpAvailable : copy.webmcpUnavailable}
        </div>
        {notice ? <div className={`generate-notice is-${notice.kind}`}>{notice.text}</div> : null}
      </div>
      <div className="generate-layout">
        <section className="generate-card">
          <h2>{copy.contextTitle}</h2>
          <p>{copy.contextDetail}</p>
          <BriefForm brief={brief} busy={busy} copy={copy} onChange={setBrief} onSubmit={prepare} />
          {protocol ? <p className="generate-protocol">{copy.protocol} {protocol.protocol.version} · {protocol.protocol.hash}</p> : null}
        </section>
        <section className="generate-card generate-preview">
          {itinerary ? (
            <>
              <h2>{draft.status === "saved" ? copy.savedTitle : copy.draftTitle}</h2>
              <p>{draft.status === "saved" ? copy.savedDetail : copy.draftDetail}</p>
              {draft.warnings?.length ? <ul className="generate-steps">{draft.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}
              <div className="generate-draft-actions">
                {draft.status === "valid" ? <WebButton disabled={busy} onClick={saveDraft} tone="primary">{copy.save}</WebButton> : null}
                {draft.status === "valid" ? <WebButton disabled={busy} onClick={discardDraft}>{copy.discard}</WebButton> : null}
                {savedTrip?.webId ? <a className="web-button web-button-primary" href={hrefForLocale(`/app/trips/${encodeURIComponent(savedTrip.webId)}`, locale)}>{copy.open}</a> : null}
              </div>
              <ItineraryViewer itinerary={itinerary} uiLocale={locale} variant="web" />
            </>
          ) : (
            <div className="generate-empty">
              <p className="web-eyebrow">{copy.conversation}</p>
              <h2>{copy.emptyPreviewTitle}</h2>
              <ol className="generate-steps">{copy.emptySteps.map((step) => <li key={step}>{step}</li>)}</ol>
              <div className="web-actions"><a className="web-button web-button-primary" href={chatGptUrl()} rel="noreferrer" target="_blank">{copy.openChatgpt} ↗</a><a className="web-button" href={hrefForLocale("/app", locale)}>{copy.viewTrips}</a></div>
            </div>
          )}
        </section>
      </div>
    </WebPageFrame>
  );
}
