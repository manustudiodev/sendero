const shareStatePresentation = {
  active: {
    eyebrow: "Enlace activo",
    title: "La vista pública está al día",
    detail: "Quien tenga el enlace puede ver la versión pública de solo lectura.",
  },
  expired: {
    eyebrow: "Enlace vencido",
    title: "Este enlace ya venció",
    detail: "Ya no permite abrir el viaje.",
  },
  not_published: {
    eyebrow: "Compartir viaje",
    title: "Todavía no hay un enlace público",
    detail: "El viaje sigue siendo privado.",
  },
  published: {
    eyebrow: "Enlace creado",
    title: "Tu viaje ya se puede compartir",
    detail: "Solo muestra la versión pública de solo lectura.",
  },
  revoked: {
    eyebrow: "Enlace revocado",
    title: "El viaje ya no es público",
    detail: "El enlace anterior dejó de funcionar.",
  },
  rotated: {
    eyebrow: "Enlace reemplazado",
    title: "Ya tienes un enlace nuevo",
    detail: "El enlace anterior dejó de funcionar.",
  },
  updated: {
    eyebrow: "Enlace actualizado",
    title: "La vista pública está al día",
    detail: "El mismo enlace ahora muestra la versión que acabas de publicar.",
  },
};

export function publicSharePresentation(output) {
  const state = output?.state || "not_published";
  if (["published", "rotated"].includes(state) && !output?.publicUrl) {
    return {
      eyebrow: "Enlace no disponible",
      title: "No pudimos mostrar el enlace",
      detail: "La operación terminó, pero no recibimos un enlace válido. Vuelve a intentar la solicitud desde la conversación.",
    };
  }
  if (state === "active" && output?.isStale) {
    return {
      eyebrow: "Enlace activo",
      title: "Hay cambios sin publicar",
      detail: `El enlace muestra la versión ${output.publishedVersion}; tu viaje ya está en la ${output.currentVersion}.`,
    };
  }
  return shareStatePresentation[state] || shareStatePresentation.not_published;
}

export function hasPublicShareResultActions(output) {
  return ["active", "published", "rotated", "updated"].includes(output?.state)
    && Boolean(output?.publicUrl);
}
