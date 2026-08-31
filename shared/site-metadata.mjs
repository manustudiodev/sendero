import { uiLanguage } from "./ui-locale.mjs";

const METADATA = {
  en: {
    landing: { title: "Sendero · Plan through conversation", description: "Sendero turns a conversation into a real itinerary with local context, routes, bookings, and a view ready to share." },
    privacy: { title: "Privacy · Sendero", description: "How Sendero handles account, trip, and shared-link information." },
    terms: { title: "Terms · Sendero", description: "Sendero terms of use." },
    account: { title: "Your trips · Sendero", description: "View trips you own and trips shared with you in Sendero." },
    generate: { title: "Create a trip · Sendero", description: "Prepare, validate, and save an itinerary generated with ChatGPT and Sendero." },
    invite: { title: "Invitation · Sendero", description: "Review a private invitation to a Sendero trip." },
    restricted: { title: "Private itinerary · Sendero", description: "View a private itinerary shared with you in Sendero." },
    share: { title: "Shared trip · Sendero", description: "View a shared Sendero itinerary." },
  },
  es: {
    landing: { title: "Sendero · Planifica conversando", description: "Sendero convierte una conversación en un itinerario real, con contexto local, rutas, reservas y una vista lista para compartir." },
    privacy: { title: "Privacidad · Sendero", description: "Cómo Sendero trata la información de cuentas, viajes y enlaces compartidos." },
    terms: { title: "Términos · Sendero", description: "Condiciones de uso de Sendero." },
    account: { title: "Tus viajes · Sendero", description: "Consulta los viajes propios y compartidos contigo en Sendero." },
    generate: { title: "Crear un viaje · Sendero", description: "Prepara, valida y guarda un itinerario generado con ChatGPT y Sendero." },
    invite: { title: "Invitación · Sendero", description: "Revisa una invitación privada a un viaje de Sendero." },
    restricted: { title: "Itinerario privado · Sendero", description: "Consulta un itinerario privado compartido contigo en Sendero." },
    share: { title: "Viaje compartido · Sendero", description: "Consulta un itinerario compartido de Sendero." },
  },
  pt: {
    landing: { title: "Sendero · Planeje conversando", description: "O Sendero transforma uma conversa em um roteiro real, com contexto local, rotas, reservas e uma visualização pronta para compartilhar." },
    privacy: { title: "Privacidade · Sendero", description: "Como o Sendero trata informações de contas, viagens e links compartilhados." },
    terms: { title: "Termos · Sendero", description: "Termos de uso do Sendero." },
    account: { title: "Suas viagens · Sendero", description: "Veja suas viagens e as que foram compartilhadas com você no Sendero." },
    generate: { title: "Criar uma viagem · Sendero", description: "Prepare, valide e salve um roteiro gerado com o ChatGPT e o Sendero." },
    invite: { title: "Convite · Sendero", description: "Revise um convite privado para uma viagem do Sendero." },
    restricted: { title: "Roteiro privado · Sendero", description: "Veja um roteiro privado compartilhado com você no Sendero." },
    share: { title: "Viagem compartilhada · Sendero", description: "Veja um roteiro compartilhado do Sendero." },
  },
  fr: {
    landing: { title: "Sendero · Planifiez en conversant", description: "Sendero transforme une conversation en un véritable itinéraire, avec contexte local, trajets, réservations et une vue prête à partager." },
    privacy: { title: "Confidentialité · Sendero", description: "Comment Sendero traite les informations de compte, de voyage et de liens partagés." },
    terms: { title: "Conditions · Sendero", description: "Conditions d’utilisation de Sendero." },
    account: { title: "Vos voyages · Sendero", description: "Consultez vos voyages et ceux qui ont été partagés avec vous dans Sendero." },
    generate: { title: "Créer un voyage · Sendero", description: "Préparez, validez et enregistrez un itinéraire généré avec ChatGPT et Sendero." },
    invite: { title: "Invitation · Sendero", description: "Consultez une invitation privée à un voyage Sendero." },
    restricted: { title: "Itinéraire privé · Sendero", description: "Consultez un itinéraire privé partagé avec vous dans Sendero." },
    share: { title: "Voyage partagé · Sendero", description: "Consultez un itinéraire Sendero partagé." },
  },
  de: {
    landing: { title: "Sendero · Plane im Gespräch", description: "Sendero verwandelt eine Unterhaltung in einen echten Reiseplan mit lokalem Kontext, Routen, Buchungen und einer teilbaren Ansicht." },
    privacy: { title: "Datenschutz · Sendero", description: "Wie Sendero Konto-, Reise- und Linkinformationen verarbeitet." },
    terms: { title: "Nutzungsbedingungen · Sendero", description: "Nutzungsbedingungen für Sendero." },
    account: { title: "Deine Reisen · Sendero", description: "Sieh dir eigene und mit dir geteilte Reisen in Sendero an." },
    generate: { title: "Reise erstellen · Sendero", description: "Bereite einen mit ChatGPT und Sendero erstellten Reiseplan vor, prüfe und speichere ihn." },
    invite: { title: "Einladung · Sendero", description: "Prüfe eine private Einladung zu einer Sendero-Reise." },
    restricted: { title: "Privater Reiseplan · Sendero", description: "Sieh dir einen privat mit dir geteilten Reiseplan in Sendero an." },
    share: { title: "Geteilte Reise · Sendero", description: "Sieh dir einen geteilten Sendero-Reiseplan an." },
  },
};

export function pageMetadata(page, locale) {
  const language = uiLanguage(locale);
  return METADATA[language]?.[page] || METADATA.es[page];
}

export function localizedCanonicalPath(page, locale) {
  const language = uiLanguage(locale);
  if (page === "landing") return `/${language}`;
  if (page === "privacy" || page === "terms") return `/${language}/${page}`;
  return "";
}

export function landingStructuredData(locale) {
  const language = uiLanguage(locale);
  const copy = {
    en: {
      website: "Conversational travel planning with visual itineraries ready to share.",
      application: "Create and adjust trips through conversation, then share them as visual itineraries.",
    },
    es: {
      website: "Planificación de viajes conversacional con itinerarios visuales para compartir.",
      application: "Crea y ajusta viajes conversando; compártelos como itinerarios visuales.",
    },
    pt: {
      website: "Planejamento de viagens por conversa com roteiros visuais para compartilhar.",
      application: "Crie e ajuste viagens por conversa e compartilhe-as como roteiros visuais.",
    },
    fr: {
      website: "Planification de voyages par la conversation avec des itinéraires visuels prêts à partager.",
      application: "Créez et adaptez vos voyages en conversant, puis partagez-les sous forme d’itinéraires visuels.",
    },
    de: {
      website: "Reiseplanung im Gespräch mit visuellen Reiseplänen zum Teilen.",
      application: "Erstelle und passe Reisen im Gespräch an und teile sie anschließend als visuelle Reisepläne.",
    },
  }[language];
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", name: "Sendero", description: copy.website },
      { "@type": "SoftwareApplication", name: "Sendero", applicationCategory: "TravelApplication", operatingSystem: "Web, ChatGPT", description: copy.application },
    ],
  };
}
