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
  const message = `Listo: destino ${brief.destination}; del ${brief.startDate} al ${brief.endDate}; ${brief.travellers.adults} ${brief.travellers.adults === 1 ? "adulto" : "adultos"}; transporte: ${transportSummary(brief)}.${license} Continúa directamente con mi itinerario usando también las demás preferencias que ya definí; no vuelvas a pedirme estos datos.`;
  return {
    context: {
      content: [{ type: "text", text: `Sendero validó el brief completado: ${briefReceiptSummary(brief)}. Este brief sustituye el resultado anterior de campos faltantes para la misma interacción. No vuelvas a pedir esos datos; continúa con la planificación. Esta interacción no guardó ni reservó nada.` }],
      structuredContent: {
        sendero: {
          intent: "create_trip",
          stage: "brief_ready",
          ...(interactionId ? { interactionId } : {}),
          completedFields: fields,
          validation: { ready: true, criticalFields: [] },
          brief,
        },
      },
    },
    visibleMessage: message,
    fallbackMessage: message,
  };
}

export function tripIntakeContinuation(brief) {
  const lodging = brief.lodging.status === "confirmed"
    ? `Alojamiento: ${brief.lodging.address}.`
    : brief.lodging.status === "area_only"
      ? `Zona provisional: ${brief.lodging.area}.`
      : "Todavía no elegí alojamiento; usa una base provisional claramente indicada.";
  const interests = brief.interests.length ? ` Intereses: ${brief.interests.join(", ")}.` : "";
  const message = `Listo: quiero crear un viaje a ${brief.destination}, del ${brief.startDate} al ${brief.endDate}, para ${brief.travellers.adults} ${brief.travellers.adults === 1 ? "adulto" : "adultos"}${brief.travellers.children ? ` y ${brief.travellers.children} ${brief.travellers.children === 1 ? "niño" : "niños"}` : ""}. Nos moveremos en ${transportSummary(brief)}. ${lodging}${interests} Continúa directamente con mi itinerario y no vuelvas a pedirme estos datos.`;
  return {
    context: {
      content: [{ type: "text", text: `La persona completó el formulario guiado de Sendero para ${brief.destination}, del ${brief.startDate} al ${brief.endDate}. Esta interacción no guardó ni reservó nada.` }],
      structuredContent: {
        sendero: {
          intent: "create_trip",
          stage: "brief_ready",
          validation: { ready: true, criticalFields: [] },
          brief,
        },
      },
    },
    visibleMessage: message,
    fallbackMessage: message,
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
