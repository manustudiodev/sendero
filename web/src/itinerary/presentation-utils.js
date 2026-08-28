function normalizedText(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function escapedPattern(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sentenceCase(value, locale = "en") {
  return value ? `${value.charAt(0).toLocaleUpperCase(uiLocale(locale))}${value.slice(1)}` : value;
}

export function contextualItineraryTitle(title, destination, locale = "en") {
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
    if (contextual) return sentenceCase(contextual, locale);
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
    .toLowerCase();
}

export function reservationKind(entry) {
  const explicit = entry?.reservation?.kind;
  if (["reservation", "ticket"].includes(explicit)) return explicit;
  const text = searchableActivity(entry);
  return /\b(museo|museum|museu|concierto|concert|concerto|recital|festival|cine|cinema|teatro|theatre|exhibicion|exhibition|exposicao|atraccion|attraction|atracao|parque tematico|theme park|partido|match|jogo)\b/u.test(text)
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

export function reservationNavigationLabel(entry, locale = "en") {
  const presentation = reservationPresentation(entry, locale);
  const title = normalizedText(entry?.activity?.title) || t(locale, "viewer.reservationFallback");
  return t(locale, "viewer.openReservation", {
    requirement: presentation.requirementLabel.toLocaleLowerCase(uiLocale(locale)),
    title,
  });
}

export function reservationPresentation(entry, locale = "en") {
  const kind = reservationKind(entry);
  const requirement = reservationRequirement(entry);
  const rawStatus = entry?.reservation?.status || "pending";
  const status = rawStatus === "suggested" ? "pending" : rawStatus;
  const isTicket = kind === "ticket";
  const requirementLabel = t(locale, `viewer.${isTicket ? "ticket" : "reservation"}${
    requirement === "optional" ? "Optional" : requirement === "recommended" ? "Recommended" : "Required"
  }`);
  const statusLabel = status === "confirmed"
    ? t(locale, isTicket ? "viewer.ticketPurchased" : "viewer.reservationBooked")
    : status === "cancelled"
      ? t(locale, isTicket ? "viewer.ticketCancelled" : "viewer.reservationCancelled")
      : t(locale, isTicket ? "viewer.ticketPending" : "viewer.reservationPending");
  const nextAction = status === "confirmed"
    ? { label: t(locale, isTicket ? "viewer.ticketCancelAction" : "viewer.reservationCancelAction"), status: "cancelled" }
    : status === "cancelled"
      ? { label: t(locale, isTicket ? "viewer.ticketPendingAction" : "viewer.reservationPendingAction"), status: "pending" }
      : { label: t(locale, isTicket ? "viewer.ticketPurchasedAction" : "viewer.reservationBookedAction"), status: "confirmed" };

  return {
    deadlineLabel: t(locale, isTicket ? "viewer.ticketDeadline" : "viewer.reservationDeadline"),
    externalActionLabel: status === "confirmed"
      ? t(locale, isTicket ? "viewer.manageTickets" : "viewer.manageReservation")
      : t(locale, isTicket ? "viewer.buyTickets" : "viewer.book"),
    kind,
    nextAction,
    requirement,
    requirementLabel,
    status,
    statusLabel,
  };
}
import { t, uiLocale } from "../i18n/index.js";
