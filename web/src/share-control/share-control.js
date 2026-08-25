export function previewShareAction(output) {
  const update = output?.action === "update";
  return {
    disabled: !output?.itinerary,
    intent: update ? "update_public_share" : "publish_public_share",
    label: update ? "Actualizar publicación" : "Crear enlace público",
  };
}

export function activeShareAction(output) {
  return output?.isStale
    ? { intent: "preview_public_share", label: "Revisar cambios" }
    : { intent: "rotate_public_share", label: "Reemplazar enlace" };
}

export function shareConversationContext(output, intent, tripTitle) {
  return {
    intent,
    ...(output?.operationId ? { operationId: output.operationId } : {}),
    ...(output?.tripId ? { tripId: output.tripId } : {}),
    ...(output?.expectedVersion ? { expectedVersion: output.expectedVersion } : {}),
    ...(output?.proposedExpiresAt
      ? { proposedExpiresAt: output.proposedExpiresAt }
      : {}),
    tripTitle,
  };
}
