const PROMPT_COPY = Object.freeze({
  en: {
    intro: "Create a complete travel itinerary with Sendero using the trip details below.",
    tools: "Use the connected Sendero plugin and start creating the itinerary immediately. Do not describe which tools or integration you will use, and do not narrate your process.",
    research: "Verify current opening hours, closures, transport, prices, weather, events, and reservation requirements with reliable sources. Do not invent missing preferences or operational facts.",
    review: "Show me the complete itinerary in Sendero, including any warnings and assumptions. Do not save it until I explicitly approve it.",
    brief: "Trip details",
    locale: "Itinerary language",
    language: "English",
    destination: "Destination",
    dates: "Travel dates",
    travellers: "Travellers",
    adult: ["adult", "adults"], children: ["child", "children"], seniors: ["senior", "seniors"],
    childAges: "Children's ages", seniorAges: "Seniors' ages",
    tripTimes: "Arrival and departure times", arrival: "arrival", departure: "departure",
    dailySchedule: "Preferred daily schedule", earliest: "start no earlier than", latest: "finish no later than",
    meals: "preferred meal times", breakfast: "breakfast", lunch: "lunch", dinner: "dinner",
    pace: "Pace", interests: "Interests", transport: "Transport",
    lodging: "Lodging", lodgingArea: "preferred area", lodgingAddress: "confirmed address",
    mobility: "Mobility", accessibility: "Accessibility needs", budget: "Budget", includes: "includes", notes: "Additional notes",
    amountNotSet: "no fixed amount",
    hasLicense: "a traveller has a valid driving licence",
    joins: { to: "to" },
    values: {
      pace: { relaxed: "relaxed", balanced: "balanced", intense: "intense" },
      transport: { walk: "walking", public_transit: "public transport", taxi: "taxi", car: "car" },
      comfort: { flexible: "flexible comfort", low: "budget", medium: "mid-range", high: "premium" },
      scope: { total: "for the whole trip", per_person: "per person", per_day: "per day" },
      flexibility: { strict: "strict limit", target: "target", flexible: "flexible" },
      categories: { activities: "activities", food: "food", local_transport: "local transport", lodging: "lodging", long_distance_transport: "long-distance transport" },
      walking: { low: "little walking", moderate: "moderate walking", high: "comfortable with longer walks" },
      rest: { frequent: "frequent rests", regular: "regular rests", minimal: "minimal rests" },
      avoidStairs: "avoid stairs", wheelchair: "wheelchair-accessible routes",
    },
  },
  es: {
    intro: "Crea un itinerario de viaje completo con Sendero usando los datos que aparecen abajo.",
    tools: "Utiliza el plugin conectado de Sendero y empieza a crear el itinerario directamente. No describas qué herramientas o integración vas a usar ni narres tu proceso.",
    research: "Verifica horarios, cierres, transporte, precios, clima, eventos y requisitos de reserva actuales con fuentes confiables. No inventes preferencias faltantes ni datos operativos.",
    review: "Muéstrame el itinerario completo en Sendero, junto con sus advertencias y supuestos. No lo guardes hasta que yo lo apruebe explícitamente.",
    brief: "Datos del viaje",
    locale: "Idioma del itinerario",
    language: "Español",
    destination: "Destino",
    dates: "Fechas del viaje",
    travellers: "Viajeros",
    adult: ["adulto", "adultos"], children: ["niño", "niños"], seniors: ["adulto mayor", "adultos mayores"],
    childAges: "Edades de los niños", seniorAges: "Edades de los adultos mayores",
    tripTimes: "Horarios de llegada y salida", arrival: "llegada", departure: "salida",
    dailySchedule: "Horario diario preferido", earliest: "comenzar no antes de las", latest: "terminar no después de las",
    meals: "horarios de comida", breakfast: "desayuno", lunch: "almuerzo", dinner: "cena",
    pace: "Ritmo", interests: "Intereses", transport: "Transporte",
    lodging: "Alojamiento", lodgingArea: "zona preferida", lodgingAddress: "dirección confirmada",
    mobility: "Movilidad", accessibility: "Necesidades de accesibilidad", budget: "Presupuesto", includes: "incluye", notes: "Notas adicionales",
    amountNotSet: "sin monto fijo",
    hasLicense: "una persona tiene licencia de conducir válida",
    joins: { to: "al" },
    values: {
      pace: { relaxed: "relajado", balanced: "equilibrado", intense: "intenso" },
      transport: { walk: "a pie", public_transit: "transporte público", taxi: "taxi", car: "auto" },
      comfort: { flexible: "comodidad flexible", low: "económico", medium: "gama media", high: "premium" },
      scope: { total: "para todo el viaje", per_person: "por persona", per_day: "por día" },
      flexibility: { strict: "límite estricto", target: "objetivo", flexible: "flexible" },
      categories: { activities: "actividades", food: "comidas", local_transport: "transporte local", lodging: "alojamiento", long_distance_transport: "transporte de larga distancia" },
      walking: { low: "poca caminata", moderate: "caminata moderada", high: "caminatas largas sin problema" },
      rest: { frequent: "descansos frecuentes", regular: "descansos regulares", minimal: "pocos descansos" },
      avoidStairs: "evitar escaleras", wheelchair: "rutas accesibles en silla de ruedas",
    },
  },
  pt: {
    intro: "Crie um roteiro de viagem completo com o Sendero usando os dados abaixo.",
    tools: "Use o plugin conectado do Sendero e comece a criar o roteiro diretamente. Não descreva quais ferramentas ou integração usará nem narre o processo.",
    research: "Verifique horários, fechamentos, transporte, preços, clima, eventos e requisitos de reserva atuais com fontes confiáveis. Não invente preferências ausentes nem informações operacionais.",
    review: "Mostre o roteiro completo no Sendero, incluindo avisos e pressupostos. Não o salve até que eu aprove explicitamente.",
    brief: "Dados da viagem",
    locale: "Idioma do roteiro", language: "Português", destination: "Destino", dates: "Datas da viagem", travellers: "Viajantes",
    adult: ["adulto", "adultos"], children: ["criança", "crianças"], seniors: ["idoso", "idosos"],
    childAges: "Idades das crianças", seniorAges: "Idades dos idosos",
    tripTimes: "Horários de chegada e partida", arrival: "chegada", departure: "partida",
    dailySchedule: "Horário diário preferido", earliest: "começar não antes das", latest: "terminar até",
    meals: "horários das refeições", breakfast: "café da manhã", lunch: "almoço", dinner: "jantar",
    pace: "Ritmo", interests: "Interesses", transport: "Transporte", lodging: "Hospedagem", lodgingArea: "área preferida", lodgingAddress: "endereço confirmado",
    mobility: "Mobilidade", accessibility: "Necessidades de acessibilidade", budget: "Orçamento", includes: "inclui", notes: "Observações adicionais",
    amountNotSet: "sem valor fixo", hasLicense: "uma pessoa tem carteira de motorista válida", joins: { to: "a" },
    values: {
      pace: { relaxed: "tranquilo", balanced: "equilibrado", intense: "intenso" },
      transport: { walk: "a pé", public_transit: "transporte público", taxi: "táxi", car: "carro" },
      comfort: { flexible: "conforto flexível", low: "econômico", medium: "intermediário", high: "premium" },
      scope: { total: "para toda a viagem", per_person: "por pessoa", per_day: "por dia" },
      flexibility: { strict: "limite rígido", target: "meta", flexible: "flexível" },
      categories: { activities: "atividades", food: "alimentação", local_transport: "transporte local", lodging: "hospedagem", long_distance_transport: "transporte de longa distância" },
      walking: { low: "pouca caminhada", moderate: "caminhada moderada", high: "caminhadas longas sem problema" },
      rest: { frequent: "pausas frequentes", regular: "pausas regulares", minimal: "poucas pausas" },
      avoidStairs: "evitar escadas", wheelchair: "rotas acessíveis para cadeira de rodas",
    },
  },
  fr: {
    intro: "Créez un itinéraire de voyage complet avec Sendero à partir des informations ci-dessous.",
    tools: "Utilisez le plugin Sendero connecté et commencez directement la création de l’itinéraire. Ne décrivez pas les outils ou l’intégration utilisés et ne racontez pas votre processus.",
    research: "Vérifiez les horaires, fermetures, transports, prix, météo, événements et conditions de réservation actuels à l’aide de sources fiables. N’inventez ni préférences manquantes ni informations pratiques.",
    review: "Présentez-moi l’itinéraire complet dans Sendero, avec ses avertissements et hypothèses. Ne l’enregistrez pas avant mon approbation explicite.",
    brief: "Informations sur le voyage",
    locale: "Langue de l’itinéraire", language: "Français", destination: "Destination", dates: "Dates du voyage", travellers: "Voyageurs",
    adult: ["adulte", "adultes"], children: ["enfant", "enfants"], seniors: ["senior", "seniors"],
    childAges: "Âge des enfants", seniorAges: "Âge des seniors",
    tripTimes: "Heures d’arrivée et de départ", arrival: "arrivée", departure: "départ",
    dailySchedule: "Horaires quotidiens souhaités", earliest: "commencer au plus tôt à", latest: "terminer au plus tard à",
    meals: "heures des repas", breakfast: "petit-déjeuner", lunch: "déjeuner", dinner: "dîner",
    pace: "Rythme", interests: "Centres d’intérêt", transport: "Transport", lodging: "Hébergement", lodgingArea: "quartier souhaité", lodgingAddress: "adresse confirmée",
    mobility: "Mobilité", accessibility: "Besoins d’accessibilité", budget: "Budget", includes: "comprend", notes: "Notes supplémentaires",
    amountNotSet: "sans montant fixe", hasLicense: "une personne possède un permis de conduire valide", joins: { to: "au" },
    values: {
      pace: { relaxed: "détendu", balanced: "équilibré", intense: "intense" },
      transport: { walk: "à pied", public_transit: "transports en commun", taxi: "taxi", car: "voiture" },
      comfort: { flexible: "confort flexible", low: "économique", medium: "milieu de gamme", high: "premium" },
      scope: { total: "pour tout le voyage", per_person: "par personne", per_day: "par jour" },
      flexibility: { strict: "limite stricte", target: "objectif", flexible: "flexible" },
      categories: { activities: "activités", food: "repas", local_transport: "transport local", lodging: "hébergement", long_distance_transport: "transport longue distance" },
      walking: { low: "peu de marche", moderate: "marche modérée", high: "à l’aise avec de longues marches" },
      rest: { frequent: "pauses fréquentes", regular: "pauses régulières", minimal: "peu de pauses" },
      avoidStairs: "éviter les escaliers", wheelchair: "itinéraires accessibles en fauteuil roulant",
    },
  },
  de: {
    intro: "Erstelle mit Sendero anhand der folgenden Angaben einen vollständigen Reiseplan.",
    tools: "Verwende das verbundene Sendero-Plugin und beginne direkt mit der Erstellung. Beschreibe weder die verwendeten Tools oder die Integration noch deinen Arbeitsprozess.",
    research: "Prüfe aktuelle Öffnungszeiten, Schließungen, Verkehr, Preise, Wetter, Veranstaltungen und Reservierungsbedingungen anhand zuverlässiger Quellen. Erfinde weder fehlende Präferenzen noch praktische Angaben.",
    review: "Zeige mir den vollständigen Reiseplan in Sendero, einschließlich Warnungen und Annahmen. Speichere ihn erst nach meiner ausdrücklichen Zustimmung.",
    brief: "Reiseangaben",
    locale: "Sprache des Reiseplans", language: "Deutsch", destination: "Reiseziel", dates: "Reisedaten", travellers: "Reisende",
    adult: ["Erwachsener", "Erwachsene"], children: ["Kind", "Kinder"], seniors: ["Senior", "Senioren"],
    childAges: "Alter der Kinder", seniorAges: "Alter der Senioren",
    tripTimes: "Ankunfts- und Abreisezeit", arrival: "Ankunft", departure: "Abreise",
    dailySchedule: "Gewünschter Tagesablauf", earliest: "frühestens beginnen um", latest: "spätestens enden um",
    meals: "Essenszeiten", breakfast: "Frühstück", lunch: "Mittagessen", dinner: "Abendessen",
    pace: "Tempo", interests: "Interessen", transport: "Verkehrsmittel", lodging: "Unterkunft", lodgingArea: "bevorzugtes Viertel", lodgingAddress: "bestätigte Adresse",
    mobility: "Mobilität", accessibility: "Barrierefreiheitsbedarf", budget: "Budget", includes: "enthält", notes: "Zusätzliche Hinweise",
    amountNotSet: "ohne festen Betrag", hasLicense: "eine Person besitzt einen gültigen Führerschein", joins: { to: "bis" },
    values: {
      pace: { relaxed: "entspannt", balanced: "ausgewogen", intense: "intensiv" },
      transport: { walk: "zu Fuß", public_transit: "öffentliche Verkehrsmittel", taxi: "Taxi", car: "Auto" },
      comfort: { flexible: "flexibler Komfort", low: "günstig", medium: "mittleres Preisniveau", high: "Premium" },
      scope: { total: "für die gesamte Reise", per_person: "pro Person", per_day: "pro Tag" },
      flexibility: { strict: "striktes Limit", target: "Zielwert", flexible: "flexibel" },
      categories: { activities: "Aktivitäten", food: "Verpflegung", local_transport: "Nahverkehr", lodging: "Unterkunft", long_distance_transport: "Fernverkehr" },
      walking: { low: "wenig zu Fuß", moderate: "mäßige Gehstrecken", high: "längere Gehstrecken sind in Ordnung" },
      rest: { frequent: "häufige Pausen", regular: "regelmäßige Pausen", minimal: "wenige Pausen" },
      avoidStairs: "Treppen vermeiden", wheelchair: "rollstuhlgerechte Wege",
    },
  },
});

function localizedDate(value, language) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return String(value || "");
  return new Intl.DateTimeFormat(language, { dateStyle: "long", timeZone: "UTC" })
    .format(new Date(`${value}T00:00:00Z`));
}

function joined(values, language) {
  const filtered = values.filter(Boolean);
  if (!filtered.length) return "";
  return new Intl.ListFormat(language, { style: "long", type: "conjunction" }).format(filtered);
}

function mapped(copy, group, value) {
  return copy.values[group]?.[value] || value || "";
}

function countLabel(count, labels) {
  return `${count} ${Number(count) === 1 ? labels[0] : labels[1]}`;
}

function formatItineraryBrief(brief, language, copy) {
  const lines = [`- ${copy.locale}: ${copy.language}`];
  if (brief.destination) lines.push(`- ${copy.destination}: ${brief.destination}`);
  if (brief.startDate || brief.endDate) {
    lines.push(`- ${copy.dates}: ${localizedDate(brief.startDate, language)} ${copy.joins.to} ${localizedDate(brief.endDate, language)}`);
  }

  const travellers = brief.travellers || {};
  const party = [
    countLabel(Number(travellers.adults) || 1, copy.adult),
    Number(travellers.children) > 0 ? countLabel(travellers.children, copy.children) : "",
    Number(travellers.seniors) > 0 ? countLabel(travellers.seniors, copy.seniors) : "",
  ];
  lines.push(`- ${copy.travellers}: ${joined(party, language)}`);
  if (travellers.childAges?.length) lines.push(`  - ${copy.childAges}: ${travellers.childAges.join(", ")}`);
  if (travellers.seniorAges?.length) lines.push(`  - ${copy.seniorAges}: ${travellers.seniorAges.join(", ")}`);

  const tripTimes = [
    brief.arrivalTime ? `${copy.arrival} ${brief.arrivalTime}` : "",
    brief.departureTime ? `${copy.departure} ${brief.departureTime}` : "",
  ];
  if (tripTimes.some(Boolean)) lines.push(`- ${copy.tripTimes}: ${joined(tripTimes, language)}`);

  const schedule = brief.dailySchedule || {};
  const scheduleParts = [
    schedule.earliestStartTime ? `${copy.earliest} ${schedule.earliestStartTime}` : "",
    schedule.latestEndTime ? `${copy.latest} ${schedule.latestEndTime}` : "",
  ];
  const mealTimes = schedule.mealTimes || {};
  const meals = [
    mealTimes.breakfast ? `${copy.breakfast} ${mealTimes.breakfast}` : "",
    mealTimes.lunch ? `${copy.lunch} ${mealTimes.lunch}` : "",
    mealTimes.dinner ? `${copy.dinner} ${mealTimes.dinner}` : "",
  ];
  if (meals.some(Boolean)) scheduleParts.push(`${copy.meals}: ${joined(meals, language)}`);
  if (scheduleParts.some(Boolean)) lines.push(`- ${copy.dailySchedule}: ${joined(scheduleParts, language)}`);

  if (brief.pace) lines.push(`- ${copy.pace}: ${mapped(copy, "pace", brief.pace)}`);
  if (brief.interests?.length) lines.push(`- ${copy.interests}: ${joined(brief.interests, language)}`);

  const transportModes = (brief.transport?.modes || []).map((value) => mapped(copy, "transport", value));
  if (brief.transport?.hasLicense && brief.transport?.modes?.includes("car")) transportModes.push(copy.hasLicense);
  if (transportModes.length) lines.push(`- ${copy.transport}: ${joined(transportModes, language)}`);

  if (brief.lodging?.area || brief.lodging?.address) {
    const lodging = [
      brief.lodging.area ? `${copy.lodgingArea}: ${brief.lodging.area}` : "",
      brief.lodging.address ? `${copy.lodgingAddress}: ${brief.lodging.address}` : "",
    ];
    lines.push(`- ${copy.lodging}: ${joined(lodging, language)}`);
  }

  const mobility = brief.mobility || {};
  const mobilityParts = [
    mobility.walkingTolerance ? mapped(copy, "walking", mobility.walkingTolerance) : "",
    mobility.maxWalkingMinutes ? `${mobility.maxWalkingMinutes} min` : "",
    mobility.restFrequency ? mapped(copy, "rest", mobility.restFrequency) : "",
    mobility.avoidStairs ? copy.values.avoidStairs : "",
    mobility.wheelchairAccess ? copy.values.wheelchair : "",
  ];
  if (mobilityParts.some(Boolean)) lines.push(`- ${copy.mobility}: ${joined(mobilityParts, language)}`);
  if (brief.accessibilityNeeds?.length) lines.push(`- ${copy.accessibility}: ${joined(brief.accessibilityNeeds, language)}`);

  const budget = brief.budget || {};
  const budgetParts = [
    budget.amount ? `${budget.currency || ""} ${budget.amount}`.trim() : copy.amountNotSet,
    mapped(copy, "comfort", budget.comfort),
    mapped(copy, "scope", budget.scope),
    mapped(copy, "flexibility", budget.flexibility),
    ...(budget.includes?.length
      ? [`${copy.includes} ${joined(budget.includes.map((value) => mapped(copy, "categories", value)), language)}`]
      : []),
  ];
  lines.push(`- ${copy.budget}: ${budgetParts.filter(Boolean).join("; ")}`);
  if (brief.notes) lines.push(`- ${copy.notes}: ${brief.notes}`);
  return lines.join("\n");
}

export function createItineraryHandoffPrompt(brief, language = "en") {
  const resolvedLanguage = PROMPT_COPY[language] ? language : "en";
  const copy = PROMPT_COPY[resolvedLanguage];
  return [
    copy.intro,
    copy.tools,
    copy.research,
    copy.review,
    `${copy.brief}:\n${formatItineraryBrief(brief || {}, resolvedLanguage, copy)}`,
  ].join("\n\n");
}
