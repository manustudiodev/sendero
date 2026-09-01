const PROMPT_COPY = Object.freeze({
  en: {
    intro: "Create a complete travel itinerary with Sendero using the brief below.",
    tools: "First, check whether the open Sendero page provides site tools. If available, call get_itinerary_planning_protocol, follow the returned protocol, and submit the finished itinerary with validate_and_stage_itinerary. If those site tools are unavailable, use the connected Sendero plugin instead.",
    research: "Research current facts such as opening hours, closures, transport, prices, weather, events, and reservation requirements using reliable sources. Do not invent missing preferences or operational facts.",
    review: "Return the itinerary to Sendero for validation and show me the validated draft with its warnings and assumptions. Do not save it until I explicitly approve it.",
    brief: "Trip brief (JSON)",
  },
  es: {
    intro: "Crea un itinerario de viaje completo con Sendero usando el brief que aparece abajo.",
    tools: "Primero, comprueba si la página abierta de Sendero ofrece herramientas del sitio. Si están disponibles, llama a get_itinerary_planning_protocol, sigue el protocolo recibido y envía el itinerario terminado con validate_and_stage_itinerary. Si esas herramientas no están disponibles, utiliza el plugin conectado de Sendero.",
    research: "Investiga datos actuales como horarios, cierres, transporte, precios, clima, eventos y requisitos de reserva usando fuentes confiables. No inventes preferencias faltantes ni datos operativos.",
    review: "Devuelve el itinerario a Sendero para validarlo y muéstrame el borrador validado con sus advertencias y supuestos. No lo guardes hasta que yo lo apruebe explícitamente.",
    brief: "Brief del viaje (JSON)",
  },
  pt: {
    intro: "Crie um roteiro de viagem completo com o Sendero usando o brief abaixo.",
    tools: "Primeiro, verifique se a página aberta do Sendero oferece ferramentas do site. Se estiverem disponíveis, chame get_itinerary_planning_protocol, siga o protocolo retornado e envie o roteiro concluído com validate_and_stage_itinerary. Se essas ferramentas não estiverem disponíveis, use o plugin conectado do Sendero.",
    research: "Pesquise informações atuais, como horários, fechamentos, transporte, preços, clima, eventos e requisitos de reserva, usando fontes confiáveis. Não invente preferências ausentes nem informações operacionais.",
    review: "Envie o roteiro ao Sendero para validação e mostre o rascunho validado com seus avisos e pressupostos. Não o salve até que eu aprove explicitamente.",
    brief: "Brief da viagem (JSON)",
  },
  fr: {
    intro: "Créez un itinéraire de voyage complet avec Sendero à partir du brief ci-dessous.",
    tools: "Commencez par vérifier si la page Sendero ouverte propose des outils de site. S’ils sont disponibles, appelez get_itinerary_planning_protocol, suivez le protocole reçu et envoyez l’itinéraire terminé avec validate_and_stage_itinerary. Si ces outils ne sont pas disponibles, utilisez le plugin Sendero connecté.",
    research: "Vérifiez les informations actuelles, notamment les horaires, fermetures, transports, prix, météo, événements et conditions de réservation, à l’aide de sources fiables. N’inventez ni préférences manquantes ni informations pratiques.",
    review: "Renvoyez l’itinéraire à Sendero pour validation et présentez-moi le brouillon validé avec ses avertissements et hypothèses. Ne l’enregistrez pas avant mon approbation explicite.",
    brief: "Brief du voyage (JSON)",
  },
  de: {
    intro: "Erstelle mit Sendero anhand der folgenden Angaben einen vollständigen Reiseplan.",
    tools: "Prüfe zuerst, ob die geöffnete Sendero-Seite Website-Tools bereitstellt. Falls ja, rufe get_itinerary_planning_protocol auf, befolge das zurückgegebene Protokoll und übermittle den fertigen Reiseplan mit validate_and_stage_itinerary. Falls diese Tools nicht verfügbar sind, verwende stattdessen das verbundene Sendero-Plugin.",
    research: "Prüfe aktuelle Fakten wie Öffnungszeiten, Schließungen, Verkehr, Preise, Wetter, Veranstaltungen und Reservierungsbedingungen anhand zuverlässiger Quellen. Erfinde weder fehlende Präferenzen noch praktische Angaben.",
    review: "Gib den Reiseplan zur Validierung an Sendero zurück und zeige mir den validierten Entwurf mit Warnungen und Annahmen. Speichere ihn erst nach meiner ausdrücklichen Zustimmung.",
    brief: "Reiseangaben (JSON)",
  },
});

export const CHATGPT_SITE_TOOLS_GUIDE_URL = "https://help.openai.com/en/articles/20001423-using-site-tools-in-the-chatgpt-desktop-app";

export function createItineraryHandoffPrompt(brief, language = "en") {
  const copy = PROMPT_COPY[language] || PROMPT_COPY.en;
  return [
    copy.intro,
    copy.tools,
    copy.research,
    copy.review,
    `${copy.brief}:\n${JSON.stringify(brief || {}, null, 2)}`,
  ].join("\n\n");
}
