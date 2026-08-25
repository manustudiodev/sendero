const transportLabels = {
  walk: "a pie",
  public_transit: "transporte público",
  taxi: "taxi o app",
  bike: "bicicleta",
  car: "auto",
};

function transportSummary(brief) {
  return (brief.transport?.modes || []).map((mode) => transportLabels[mode] || mode).join(", ");
}

function dateLabel(value) {
  if (!value) return "fecha pendiente";
  try {
    return new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
      .format(new Date(`${value}T00:00:00Z`));
  } catch {
    return value;
  }
}

export function briefReceiptSummary(brief) {
  const travellers = Number(brief.travellers?.adults || 0);
  return `${brief.destination} · ${dateLabel(brief.startDate)} — ${dateLabel(brief.endDate)} · ${travellers} ${travellers === 1 ? "adulto" : "adultos"} · ${transportSummary(brief)}`;
}

export function tripRequirementsContinuation({ brief, fields, interactionId }) {
  const license = brief.transport?.modes?.includes("car")
    ? ` ${brief.transport.hasLicense ? "Hay" : "No hay"} una persona con licencia válida.`
    : "";
  return {
    context: {
      content: [{ type: "text", text: `La persona completó los datos críticos de su viaje en Sendero: ${briefReceiptSummary(brief)}. Esta interacción no guardó ni reservó nada.` }],
      structuredContent: {
        sendero: {
          intent: "create_trip",
          ...(interactionId ? { interactionId } : {}),
          collectedFields: fields,
          brief,
        },
      },
    },
    visibleMessage: "Ya completé los datos que faltaban. Continúa con mi itinerario.",
    fallbackMessage: `Ya completé los datos que faltaban: destino ${brief.destination}; del ${brief.startDate} al ${brief.endDate}; ${brief.travellers.adults} ${brief.travellers.adults === 1 ? "adulto" : "adultos"}; transporte: ${transportSummary(brief)}.${license} Continúa con mi itinerario.`,
  };
}

export function tripIntakeContinuation(brief) {
  const lodging = brief.lodging.status === "confirmed"
    ? `Alojamiento: ${brief.lodging.address}.`
    : brief.lodging.status === "area_only"
      ? `Zona provisional: ${brief.lodging.area}.`
      : "Todavía no elegí alojamiento; usa una base provisional claramente indicada.";
  const interests = brief.interests.length ? ` Intereses: ${brief.interests.join(", ")}.` : "";
  return {
    context: {
      content: [{ type: "text", text: `La persona completó el formulario guiado de Sendero para ${brief.destination}, del ${brief.startDate} al ${brief.endDate}. Esta interacción no guardó ni reservó nada.` }],
      structuredContent: { sendero: { intent: "create_trip", brief } },
    },
    visibleMessage: "Ya completé los datos del viaje. Continúa con mi itinerario.",
    fallbackMessage: `Quiero crear un viaje a ${brief.destination}, del ${brief.startDate} al ${brief.endDate}, para ${brief.travellers.adults} ${brief.travellers.adults === 1 ? "adulto" : "adultos"}${brief.travellers.children ? ` y ${brief.travellers.children} ${brief.travellers.children === 1 ? "niño" : "niños"}` : ""}. Nos moveremos en ${transportSummary(brief)}. ${lodging}${interests} Continúa con mi itinerario.`,
  };
}

export function tripSelectionContinuation({ trip, purpose }) {
  const purposeCopy = purpose === "adjust"
    ? { verb: "ajustarlo", visible: "Ya elegí el viaje que quiero ajustar. Pregúntame de forma conversacional qué quiero cambiar y conserva las actividades fijas y reservas confirmadas." }
    : purpose === "refresh"
      ? { verb: "actualizarlo", visible: "Ya elegí el viaje que quiero actualizar. Continúa revisando clima, eventos, cierres, transporte y reservas vigentes." }
      : { verb: "abrirlo", visible: "Ya elegí el viaje que quiero abrir. Muéstrame su versión actual." };
  return {
    context: {
      content: [{ type: "text", text: `La persona eligió “${trip.title}” en Sendero para ${purposeCopy.verb}.` }],
      structuredContent: { sendero: { intent: purpose, tripId: trip.id, tripTitle: trip.title } },
    },
    visibleMessage: purposeCopy.visible,
  };
}
