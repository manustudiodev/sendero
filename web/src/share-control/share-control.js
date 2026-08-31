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
  fr: {
    active: { eyebrow: "Lien actif", title: "La vue publique est à jour", detail: "Toute personne disposant du lien peut consulter la version publique en lecture seule." },
    expired: { eyebrow: "Lien expiré", title: "Ce lien a expiré", detail: "Il ne permet plus d’ouvrir le voyage." },
    not_published: { eyebrow: "Partager le voyage", title: "Il n’y a pas encore de lien public", detail: "Le voyage reste privé." },
    published: { eyebrow: "Lien créé", title: "Votre voyage est prêt à être partagé", detail: "Il n’affiche que la version publique en lecture seule." },
    revoked: { eyebrow: "Lien révoqué", title: "Le voyage n’est plus public", detail: "Le lien précédent ne fonctionne plus." },
    rotated: { eyebrow: "Lien remplacé", title: "Vous disposez maintenant d’un nouveau lien", detail: "Le lien précédent ne fonctionne plus." },
    updated: { eyebrow: "Lien actualisé", title: "La vue publique est à jour", detail: "Le même lien affiche maintenant la version que vous venez de publier." },
  },
  de: {
    active: { eyebrow: "Aktiver Link", title: "Die öffentliche Ansicht ist aktuell", detail: "Alle mit dem Link können die öffentliche schreibgeschützte Version ansehen." },
    expired: { eyebrow: "Abgelaufener Link", title: "Dieser Link ist abgelaufen", detail: "Die Reise kann damit nicht mehr geöffnet werden." },
    not_published: { eyebrow: "Reise teilen", title: "Es gibt noch keinen öffentlichen Link", detail: "Die Reise bleibt privat." },
    published: { eyebrow: "Link erstellt", title: "Deine Reise kann geteilt werden", detail: "Er zeigt nur die öffentliche schreibgeschützte Version." },
    revoked: { eyebrow: "Link widerrufen", title: "Die Reise ist nicht mehr öffentlich", detail: "Der vorherige Link funktioniert nicht mehr." },
    rotated: { eyebrow: "Link ersetzt", title: "Du hast jetzt einen neuen Link", detail: "Der vorherige Link funktioniert nicht mehr." },
    updated: { eyebrow: "Link aktualisiert", title: "Die öffentliche Ansicht ist aktuell", detail: "Derselbe Link zeigt jetzt die gerade veröffentlichte Version." },
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
      fr: { eyebrow: "Lien indisponible", title: "Impossible d’afficher le lien", detail: "L’opération est terminée, mais nous n’avons pas reçu de lien valide. Recommencez la demande dans la conversation." },
      de: { eyebrow: "Link nicht verfügbar", title: "Der Link konnte nicht angezeigt werden", detail: "Der Vorgang ist abgeschlossen, aber wir haben keinen gültigen Link erhalten. Wiederhole die Anfrage in der Unterhaltung." },
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
      fr: { eyebrow: "Lien actif", title: "Des modifications ne sont pas publiées", detail: `Le lien affiche la version ${output.publishedVersion} ; votre voyage est déjà en version ${output.currentVersion}.` },
      de: { eyebrow: "Aktiver Link", title: "Es gibt unveröffentlichte Änderungen", detail: `Der Link zeigt Version ${output.publishedVersion}; deine Reise ist bereits auf Version ${output.currentVersion}.` },
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
