function normalizedText(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function escapedPattern(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sentenceCase(value) {
  return value ? `${value.charAt(0).toLocaleUpperCase("es")}${value.slice(1)}` : value;
}

export function contextualItineraryTitle(title, destination) {
  const original = normalizedText(title);
  const destinationName = normalizedText(destination);
  if (!original || !destinationName) return original;

  const city = normalizedText(destinationName.split(",")[0]);
  const candidates = [...new Set([destinationName, city].filter(Boolean))]
    .sort((left, right) => right.length - left.length);
  for (const candidate of candidates) {
    const prefix = new RegExp(`^${escapedPattern(candidate)}(?:\\s*(?:[—–-]|:|·)\\s*|\\s+)`, "iu");
    if (!prefix.test(original)) continue;
    const contextual = normalizedText(original.replace(prefix, ""));
    if (contextual) return sentenceCase(contextual);
  }
  return original;
}

function searchableActivity(entry) {
  return normalizedText([
    entry?.activity?.category,
    entry?.activity?.title,
    entry?.activity?.description,
  ].filter(Boolean).join(" "))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");
}

export function reservationKind(entry) {
  const explicit = entry?.reservation?.kind;
  if (["reservation", "ticket"].includes(explicit)) return explicit;
  const text = searchableActivity(entry);
  return /\b(museo|museum|concierto|concert|recital|festival|cine|cinema|teatro|theatre|exhibicion|exhibition|atraccion|attraction|parque tematico|theme park|partido|match)\b/u.test(text)
    ? "ticket"
    : "reservation";
}

export function reservationRequirement(entry) {
  const explicit = entry?.reservation?.requirement;
  if (["required", "recommended", "optional"].includes(explicit)) return explicit;
  return entry?.reservation?.status === "suggested" ? "optional" : "required";
}

export function hasReservationManagement(activity) {
  const status = activity?.reservation?.status;
  return Boolean(status && status !== "not_needed");
}

export function reservationEntryKey(dayDate, activityId) {
  const date = normalizedText(dayDate);
  const id = normalizedText(activityId);
  return date && id ? `${date}:${id}` : "";
}

export function reservationNavigationLabel(entry) {
  const presentation = reservationPresentation(entry);
  const title = normalizedText(entry?.activity?.title) || "esta actividad";
  return `Abrir en Reservas: ${presentation.requirementLabel.toLocaleLowerCase("es")} para ${title}`;
}

export function reservationPresentation(entry) {
  const kind = reservationKind(entry);
  const requirement = reservationRequirement(entry);
  const rawStatus = entry?.reservation?.status || "pending";
  const status = rawStatus === "suggested" ? "pending" : rawStatus;
  const isTicket = kind === "ticket";
  const requirementLabel = requirement === "optional"
    ? `${isTicket ? "Boleto" : "Reserva"} opcional`
    : requirement === "recommended"
      ? `${isTicket ? "Boleto" : "Reserva"} recomendad${isTicket ? "o" : "a"}`
      : `Requiere ${isTicket ? "boleto" : "reserva"}`;
  const statusLabel = status === "confirmed"
    ? (isTicket ? "Comprado" : "Reservada")
    : status === "cancelled"
      ? (isTicket ? "Cancelado" : "Cancelada")
      : (isTicket ? "Por comprar" : "Por reservar");
  const nextAction = status === "confirmed"
    ? { label: isTicket ? "Boleto cancelado" : "Reserva cancelada", status: "cancelled" }
    : status === "cancelled"
      ? { label: isTicket ? "Aún no compré" : "Aún no reservé", status: "pending" }
      : { label: isTicket ? "Ya compré" : "Ya reservé", status: "confirmed" };

  return {
    deadlineLabel: isTicket ? "Comprar antes de" : "Reservar antes de",
    externalActionLabel: status === "confirmed"
      ? (isTicket ? "Gestionar boletos" : "Gestionar reserva")
      : (isTicket ? "Comprar boletos" : "Reservar"),
    kind,
    nextAction,
    requirement,
    requirementLabel,
    status,
    statusLabel,
  };
}
