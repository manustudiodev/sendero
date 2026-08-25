export const criticalFields = [
  "destination",
  "startDate",
  "endDate",
  "travellers.adults",
  "transport.modes",
];

export function requestedFields(output) {
  const values = output?.fields || output?.criticalMissing || output?.missing || [];
  const requested = new Set(Array.isArray(values) ? values : []);
  return criticalFields.filter((field) => requested.has(field));
}

export function draftFromBrief(brief = {}) {
  return {
    destination: brief.destination || "",
    startDate: brief.startDate || "",
    endDate: brief.endDate || "",
    adults: brief.travellers?.adults ?? "",
    transportModes: Array.isArray(brief.transport?.modes) ? brief.transport.modes : [],
    hasLicense: Boolean(brief.transport?.hasLicense),
  };
}

export function mergeBrief(brief = {}, draft) {
  return {
    ...brief,
    destination: draft.destination.trim(),
    startDate: draft.startDate,
    endDate: draft.endDate,
    travellers: {
      ...(brief.travellers || {}),
      adults: Number(draft.adults),
    },
    transport: {
      ...(brief.transport || {}),
      modes: draft.transportModes,
      wantsCar: draft.transportModes.includes("car"),
      hasLicense: draft.transportModes.includes("car") ? Boolean(draft.hasLicense) : false,
    },
  };
}

export function initialRequirementsStatus(saved = {}) {
  if (saved.continuation?.phase === "sent") {
    return { state: "success", message: "Listo. Sendero continúa en la conversación." };
  }
  if (["dispatching", "uncertain", "delivery_failed"].includes(saved.continuation?.phase)) {
    return {
      state: "error",
      message: "No pudimos confirmar la entrega. Si el chat no continúa, dímelo con tus palabras.",
    };
  }
  if (saved.status?.state === "loading") {
    return { state: "error", message: "La validación quedó pendiente. Puedes intentarlo otra vez." };
  }
  return saved.status || { state: "idle", message: "" };
}
