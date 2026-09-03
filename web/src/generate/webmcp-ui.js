import { ITINERARY_GENERATION_TOOL_NAMES } from "./webmcp.js";

const COPY = Object.freeze({
  en: {
    close: "Close",
    commands: "Available commands",
    count: (value) => `${value} commands`,
    detail: "These are the page tools ChatGPT can use while Sendero remains open in its integrated browser.",
    dialogTitle: "WebMCP commands",
    states: {
      checking: "Checking this browser",
      connected: "Connected and available",
      unavailable: "Unavailable in this browser",
      error: "Connection could not be completed",
    },
    tools: {
      get_itinerary_planning_protocol: "Loads the current planning rules, completed brief, and itinerary schema.",
      validate_and_stage_itinerary: "Validates the complete itinerary and places a review draft in this browser.",
      get_staged_itinerary: "Reads the validated local draft and its warnings without changing it.",
      save_staged_itinerary: "Saves the approved draft to your Sendero account.",
      discard_staged_itinerary: "Removes the local draft without deleting any saved trip.",
    },
  },
  es: {
    close: "Cerrar",
    commands: "Comandos disponibles",
    count: (value) => `${value} comandos`,
    detail: "Estas son las herramientas que ChatGPT puede usar mientras Sendero permanezca abierto en su navegador integrado.",
    dialogTitle: "Comandos WebMCP",
    states: {
      checking: "Comprobando este navegador",
      connected: "Conectado y disponible",
      unavailable: "No disponible en este navegador",
      error: "No se pudo completar la conexión",
    },
    tools: {
      get_itinerary_planning_protocol: "Carga las reglas actuales, los datos del viaje y el esquema del itinerario.",
      validate_and_stage_itinerary: "Valida el itinerario completo y deja un borrador para revisar en este navegador.",
      get_staged_itinerary: "Consulta el borrador local validado y sus advertencias sin modificarlo.",
      save_staged_itinerary: "Guarda el borrador aprobado en tu cuenta de Sendero.",
      discard_staged_itinerary: "Descarta el borrador local sin eliminar ningún viaje guardado.",
    },
  },
  pt: {
    close: "Fechar",
    commands: "Comandos disponíveis",
    count: (value) => `${value} comandos`,
    detail: "Estas são as ferramentas que o ChatGPT pode usar enquanto o Sendero permanecer aberto no navegador integrado.",
    dialogTitle: "Comandos WebMCP",
    states: {
      checking: "Verificando este navegador",
      connected: "Conectado e disponível",
      unavailable: "Indisponível neste navegador",
      error: "Não foi possível concluir a conexão",
    },
    tools: {
      get_itinerary_planning_protocol: "Carrega as regras atuais, os dados da viagem e o esquema do roteiro.",
      validate_and_stage_itinerary: "Valida o roteiro completo e cria um rascunho para revisão neste navegador.",
      get_staged_itinerary: "Consulta o rascunho local validado e seus avisos sem alterá-lo.",
      save_staged_itinerary: "Salva o rascunho aprovado na sua conta do Sendero.",
      discard_staged_itinerary: "Descarta o rascunho local sem excluir nenhuma viagem salva.",
    },
  },
  fr: {
    close: "Fermer",
    commands: "Commandes disponibles",
    count: (value) => `${value} commandes`,
    detail: "Voici les outils que ChatGPT peut utiliser tant que Sendero reste ouvert dans son navigateur intégré.",
    dialogTitle: "Commandes WebMCP",
    states: {
      checking: "Vérification de ce navigateur",
      connected: "Connecté et disponible",
      unavailable: "Indisponible dans ce navigateur",
      error: "La connexion n’a pas pu aboutir",
    },
    tools: {
      get_itinerary_planning_protocol: "Charge les règles actuelles, les données du voyage et le schéma de l’itinéraire.",
      validate_and_stage_itinerary: "Valide l’itinéraire complet et crée un brouillon à vérifier dans ce navigateur.",
      get_staged_itinerary: "Consulte le brouillon local validé et ses avertissements sans le modifier.",
      save_staged_itinerary: "Enregistre le brouillon approuvé dans votre compte Sendero.",
      discard_staged_itinerary: "Supprime le brouillon local sans effacer de voyage enregistré.",
    },
  },
  de: {
    close: "Schließen",
    commands: "Verfügbare Befehle",
    count: (value) => `${value} Befehle`,
    detail: "Diese Werkzeuge kann ChatGPT verwenden, solange Sendero im integrierten Browser geöffnet bleibt.",
    dialogTitle: "WebMCP-Befehle",
    states: {
      checking: "Dieser Browser wird geprüft",
      connected: "Verbunden und verfügbar",
      unavailable: "In diesem Browser nicht verfügbar",
      error: "Verbindung konnte nicht hergestellt werden",
    },
    tools: {
      get_itinerary_planning_protocol: "Lädt die aktuellen Regeln, Reisedaten und das Schema des Reiseplans.",
      validate_and_stage_itinerary: "Prüft den vollständigen Reiseplan und legt in diesem Browser einen Entwurf zur Kontrolle an.",
      get_staged_itinerary: "Liest den geprüften lokalen Entwurf und seine Hinweise, ohne ihn zu verändern.",
      save_staged_itinerary: "Speichert den bestätigten Entwurf in deinem Sendero-Konto.",
      discard_staged_itinerary: "Verwirft den lokalen Entwurf, ohne eine gespeicherte Reise zu löschen.",
    },
  },
});

function indicatorState(status = {}) {
  if (status.kind === "connecting") return "checking";
  if (status.kind === "unavailable") return "unavailable";
  if (status.kind === "error" && status.code === "registration_failed") return "error";
  return "connected";
}

export function webMcpIndicatorModel(language = "es", status = {}) {
  const copy = COPY[language] || COPY.es;
  const state = indicatorState(status);
  const tools = ITINERARY_GENERATION_TOOL_NAMES.map((name) => ({
    name,
    description: copy.tools[name],
  }));
  return {
    close: copy.close,
    commands: copy.commands,
    count: copy.count(tools.length),
    detail: copy.detail,
    dialogTitle: copy.dialogTitle,
    label: "WebMCP",
    state,
    status: copy.states[state],
    tools,
  };
}
