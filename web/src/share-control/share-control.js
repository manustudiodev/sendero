import { localeLanguage, resolveContentLocale } from "../i18n/index.js";

const PRESENTATION = {
  es: { active: {
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
  } },
  en: {
    active: { eyebrow: "Active link", title: "The public view is up to date", detail: "Anyone with the link can view the public read-only version." },
    expired: { eyebrow: "Expired link", title: "This link has expired", detail: "It can no longer open the trip." },
    not_published: { eyebrow: "Share trip", title: "There is no public link yet", detail: "The trip remains private." },
    published: { eyebrow: "Link created", title: "Your trip is ready to share", detail: "It only shows the public read-only version." },
    revoked: { eyebrow: "Link revoked", title: "The trip is no longer public", detail: "The previous link no longer works." },
    rotated: { eyebrow: "Link replaced", title: "You now have a new link", detail: "The previous link no longer works." },
    updated: { eyebrow: "Link updated", title: "The public view is up to date", detail: "The same link now shows the version you just published." },
  },
  pt: {
    active: { eyebrow: "Link ativo", title: "A visualização pública está atualizada", detail: "Qualquer pessoa com o link pode ver a versão pública somente para leitura." },
    expired: { eyebrow: "Link expirado", title: "Este link expirou", detail: "Ele não permite mais abrir a viagem." },
    not_published: { eyebrow: "Compartilhar viagem", title: "Ainda não há um link público", detail: "A viagem continua privada." },
    published: { eyebrow: "Link criado", title: "Sua viagem já pode ser compartilhada", detail: "Ele mostra apenas a versão pública somente para leitura." },
    revoked: { eyebrow: "Link revogado", title: "A viagem não é mais pública", detail: "O link anterior deixou de funcionar." },
    rotated: { eyebrow: "Link substituído", title: "Agora você tem um novo link", detail: "O link anterior deixou de funcionar." },
    updated: { eyebrow: "Link atualizado", title: "A visualização pública está atualizada", detail: "O mesmo link agora mostra a versão que você acabou de publicar." },
  },
};

export function publicSharePresentation(output, locale = "en") {
  const language = localeLanguage(resolveContentLocale(locale));
  const shareStatePresentation = PRESENTATION[language] || PRESENTATION.en;
  const state = output?.state || "not_published";
  if (["published", "rotated"].includes(state) && !output?.publicUrl) {
    const missing = {
      en: { eyebrow: "Link unavailable", title: "We couldn't show the link", detail: "The operation finished, but we did not receive a valid link. Try the request again from the conversation." },
      es: { eyebrow: "Enlace no disponible", title: "No pudimos mostrar el enlace", detail: "La operación terminó, pero no recibimos un enlace válido. Vuelve a intentar la solicitud desde la conversación." },
      pt: { eyebrow: "Link indisponível", title: "Não foi possível mostrar o link", detail: "A operação terminou, mas não recebemos um link válido. Tente a solicitação novamente na conversa." },
    }[language];
    return {
      ...missing,
    };
  }
  if (state === "active" && output?.isStale) {
    const stale = {
      en: { eyebrow: "Active link", title: "There are unpublished changes", detail: `The link shows version ${output.publishedVersion}; your trip is now on version ${output.currentVersion}.` },
      es: { eyebrow: "Enlace activo", title: "Hay cambios sin publicar", detail: `El enlace muestra la versión ${output.publishedVersion}; tu viaje ya está en la ${output.currentVersion}.` },
      pt: { eyebrow: "Link ativo", title: "Há alterações não publicadas", detail: `O link mostra a versão ${output.publishedVersion}; sua viagem já está na versão ${output.currentVersion}.` },
    }[language];
    return {
      ...stale,
    };
  }
  return shareStatePresentation[state] || shareStatePresentation.not_published;
}

export function hasPublicShareResultActions(output) {
  return ["active", "published", "rotated", "updated"].includes(output?.state)
    && Boolean(output?.publicUrl);
}
