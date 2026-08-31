import { useCallback, useEffect, useRef, useState } from "react";
import { WebButton } from "../account/PageFrame.jsx";
import { normalizeTripAccess, operationId, requestJson } from "../account/web-client.js";
import { formatDate, localeLanguage, resolveContentLocale } from "../i18n/index.js";

const accessStyles = `
.access-panel { margin-top: 34px; border-top: 1px solid var(--web-line); padding-top: 18px; }
.access-panel > summary { width: fit-content; cursor: pointer; color: var(--web-forest); font-weight: 720; }
.access-body { display: grid; gap: 22px; margin-top: 18px; }
.access-general { display: flex; align-items: center; justify-content: space-between; gap: 18px; border: 1px solid var(--web-line); border-radius: 14px; padding: 14px; background: var(--web-surface); }
.access-general strong, .access-general span { display: block; }
.access-general span { color: var(--web-muted); font-size: 14px; }
.access-general select { min-height: 40px; border: 1px solid var(--web-line); border-radius: 9px; padding: 6px 9px; background: var(--web-surface); color: var(--web-ink); }
.access-form { display: grid; grid-template-columns: minmax(180px, 1fr) auto auto; gap: 9px; }
.access-form input, .access-form select { min-height: 42px; border: 1px solid var(--web-line); border-radius: 11px; padding: 8px 11px; background: var(--web-surface); color: var(--web-ink); }
.access-list { display: grid; gap: 1px; overflow: hidden; border: 1px solid var(--web-line); border-radius: 14px; background: var(--web-line); }
.access-row { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 14px; background: var(--web-surface); }
.access-person { min-width: 0; }
.access-person strong, .access-person span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.access-person span { color: var(--web-muted); font-size: 14px; }
.access-row-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.access-row-actions select { min-height: 38px; border: 1px solid var(--web-line); border-radius: 9px; padding: 6px 9px; background: var(--web-surface); color: var(--web-ink); }
.access-subheading { margin: 0 0 9px; font-size: 15px; }
.access-section-copy { margin: -2px 0 10px; color: var(--web-muted); font-size: 14px; }
.access-legacy-list { border-color: var(--sendero-connect-600); background: var(--sendero-connect-600); }
.access-legacy-list .access-row { background: color-mix(in srgb, var(--web-surface) 92%, var(--sendero-connect-200)); }
.access-link-receipt { display: grid; gap: 9px; border-radius: 12px; padding: 13px; background: var(--web-soft); }
.access-link-receipt p { margin: 0; color: var(--web-muted); font-size: 14px; }
.access-link-value { display: flex; align-items: center; gap: 8px; }
.access-link-value input { min-width: 0; flex: 1; min-height: 40px; border: 1px solid var(--web-line); border-radius: 9px; padding: 7px 10px; background: var(--web-surface); color: var(--web-ink); }
.access-notice { margin: 0; border-radius: 11px; padding: 11px 13px; background: var(--web-soft); color: var(--web-muted); }
.access-confirmation { display: flex; align-items: center; justify-content: space-between; gap: 18px; border: 1px solid rgba(163, 60, 53, .28); border-radius: 14px; padding: 14px; background: rgba(163, 60, 53, .06); }
.access-confirmation h3, .access-confirmation p { margin: 0; }
.access-confirmation h3 { font-size: 15px; }
.access-confirmation p { margin-top: 3px; color: var(--web-muted); font-size: 14px; }
.access-invitation-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; margin-top: 4px; color: var(--web-muted); font-size: 14px; }
.access-invitation-meta .web-status-badge { min-height: 24px; padding: 2px 8px; }
.access-invitation-meta .is-expired { background: var(--web-soft); color: var(--web-danger); }
.access-invitation-meta .is-delivery-sent { background: var(--sendero-teal-200); color: var(--sendero-forest-800); }
.access-invitation-meta .is-delivery-failed,
.access-invitation-meta .is-delivery-not_configured { background: rgba(163, 60, 53, .10); color: var(--web-danger); }
.access-invitation-meta .is-delivery-retry_scheduled { background: var(--sendero-connect-200); color: var(--sendero-connect-900); }
@media (max-width: 620px) {
  .access-form { grid-template-columns: 1fr; }
  .access-general { align-items: flex-start; flex-direction: column; }
  .access-row { align-items: flex-start; flex-direction: column; }
  .access-row-actions { justify-content: flex-start; }
  .access-confirmation { align-items: flex-start; flex-direction: column; }
}
`;

const COPY = {
  en: {
    invitationStatus: { expired: "Expired", pending: "Pending" },
    deliveryStatus: { failed: "Delivery failed", not_configured: "Email not configured", processing: "Sending", queued: "Queued", retry_scheduled: "Retrying", sent: "Accepted by email provider" },
    providerEvent: { bounced: "Email bounced", complained: "Marked as spam", delayed: "Delivery delayed", delivered: "Delivered", failed: "Delivery failed" },
    invitation: "The invitation",
    renewedInvitation: "The renewed invitation",
    delivered: (action, email) => `${action} for ${email} was delivered.`,
    acceptedByProvider: (action, email) => `The email service accepted ${action.toLowerCase()} for ${email}.`,
    queued: (action, email) => `${action} for ${email} was queued for delivery.`,
    notConfigured: (action, email) => `${action} for ${email} was created, but email is not configured yet.`,
    failed: (action, email) => `${action} for ${email} was created, but the email could not be sent. You can retry it.`,
    created: (action, email) => `${action} for ${email} was created. Check its status before resending it.`,
    migrated: "The legacy invitation was migrated successfully.",
    expires: "Expires",
    expired: "Expired",
    cancel: "Cancel",
    loadError: "We couldn't load the people with access.",
    saveError: "We couldn't save that change. Try again.",
    copyError: "We couldn't copy the link. Select it and copy it manually.",
    removedLegacy: (email) => `You removed the legacy invitation for ${email}. That entry did not grant access.`,
    summary: "Share and manage access",
    email: "Email",
    permission: "Permission",
    viewer: "Viewer",
    collaborator: "Collaborator",
    invite: "Invite",
    loading: "Loading access…",
    generalAccess: "General access",
    publicDetail: "Anyone with the link can view",
    restrictedDetail: "Invited people only",
    generalAria: "General itinerary access",
    restrictConfirm: "Restrict access",
    restrictDetail: "The current public link will stop working immediately. Invited people will keep their access.",
    restrictTitle: "Restrict this trip?",
    restricted: "Restricted",
    publicLink: "Public with link",
    legacyLink: "This link is still active, but it was created with an older version of Sendero and cannot be shown again. Replace it only if you need to share a new URL.",
    replaceLink: "Replace link",
    replaceDetail: "The current link will stop working and you will need to share the new one.",
    replaceTitle: "Create a new public link?",
    createLink: "Create new link",
    linkCopied: "Link copied.",
    linkReady: "Link ready to share.",
    linkAria: "Share link",
    copy: "Copy",
    people: "People with access",
    owner: "Owner",
    permissionOf: (email) => `Permission for ${email}`,
    removeAccess: "Remove access",
    removeDetail: (name) => `${name} will no longer be able to open this trip.`,
    removeTitle: (name) => `Remove ${name}?`,
    remove: "Remove",
    invitations: "Invitations",
    renew: "Renew",
    resend: "Resend",
    revokeInvitation: "Revoke invitation",
    revokeDetail: (email) => `${email} will no longer be able to accept this invitation.`,
    revokeTitle: (email) => `Revoke the invitation for ${email}?`,
    revoke: "Revoke",
    legacyInvitations: "Legacy invitations",
    legacyDetail: "These pending records do not grant access. Migrate each invitation you want to keep to send a secure link, or remove it.",
    noAccess: "No access",
    migrateAria: (email) => `Migrate and send the invitation for ${email}`,
    migrate: "Migrate and send",
    migrateDetail: (email) => `${email} does not currently have access. Sendero will replace this record with a secure invitation and send the email.`,
    migrateTitle: (email) => `Migrate the invitation for ${email}?`,
    deleteAria: (email) => `Delete the legacy invitation for ${email}`,
    deleteInvitation: "Delete invitation",
    deleteDetail: (email) => `The pending record for ${email} will be deleted. This person does not currently have access.`,
    deleteTitle: (email) => `Delete the legacy invitation for ${email}?`,
    delete: "Delete",
  },
  es: {
    invitationStatus: { expired: "Vencida", pending: "Pendiente" },
    deliveryStatus: { failed: "Falló el envío", not_configured: "Correo no configurado", processing: "Enviando", queued: "En cola", retry_scheduled: "Reintentando", sent: "Aceptada por correo" },
    providerEvent: { bounced: "Correo rebotado", complained: "Marcada como spam", delayed: "Entrega demorada", delivered: "Entregada", failed: "Entrega fallida" },
    invitation: "La invitación", renewedInvitation: "La invitación renovada",
    delivered: (action, email) => `${action} para ${email} fue entregada.`, acceptedByProvider: (action, email) => `El servicio de correo aceptó ${action.toLowerCase()} para ${email}.`, queued: (action, email) => `${action} para ${email} quedó en cola de envío.`, notConfigured: (action, email) => `${action} para ${email} quedó creada, pero el correo todavía no está configurado.`, failed: (action, email) => `${action} para ${email} quedó creada, pero el correo no pudo enviarse. Puedes reintentarlo.`, created: (action, email) => `${action} para ${email} quedó creada. Revisa su estado antes de reenviarla.`, migrated: "La invitación antigua se migró correctamente.",
    expires: "Vence", expired: "Venció", cancel: "Cancelar", loadError: "No pudimos cargar las personas con acceso.", saveError: "No pudimos guardar ese cambio. Intenta nuevamente.", copyError: "No pudimos copiar el enlace. Selecciónalo y cópialo manualmente.", removedLegacy: (email) => `Eliminaste la invitación antigua de ${email}. Esa entrada no otorgaba acceso.`,
    summary: "Compartir y gestionar acceso", email: "Correo", permission: "Permiso", viewer: "Lector", collaborator: "Colaborador", invite: "Invitar", loading: "Cargando acceso…", generalAccess: "Acceso general", publicDetail: "Cualquier persona con el enlace puede ver", restrictedDetail: "Solo personas invitadas", generalAria: "Acceso general del itinerario", restrictConfirm: "Restringir acceso", restrictDetail: "El enlace público actual dejará de funcionar inmediatamente. Las personas invitadas conservarán su acceso.", restrictTitle: "¿Restringir este viaje?", restricted: "Restringido", publicLink: "Público con enlace", legacyLink: "Este enlace sigue activo, pero fue creado con una versión antigua de Sendero y no podemos volver a mostrarlo. Sólo reemplázalo si necesitas compartir una URL nueva.", replaceLink: "Reemplazar enlace", replaceDetail: "El enlace actual dejará de funcionar y tendrás que compartir el nuevo.", replaceTitle: "¿Crear un enlace público nuevo?", createLink: "Crear enlace nuevo", linkCopied: "Enlace copiado.", linkReady: "Enlace listo para compartir.", linkAria: "Enlace para compartir", copy: "Copiar", people: "Personas con acceso", owner: "Propietario", permissionOf: (email) => `Permiso de ${email}`, removeAccess: "Quitar acceso", removeDetail: (name) => `${name} dejará de poder abrir este viaje.`, removeTitle: (name) => `¿Quitar a ${name}?`, remove: "Quitar", invitations: "Invitaciones", renew: "Renovar", resend: "Reenviar", revokeInvitation: "Revocar invitación", revokeDetail: (email) => `${email} ya no podrá aceptar esta invitación.`, revokeTitle: (email) => `¿Revocar la invitación de ${email}?`, revoke: "Revocar", legacyInvitations: "Invitaciones antiguas", legacyDetail: "Estos registros pendientes no otorgan acceso. Migra cada invitación que quieras conservar para enviar un enlace seguro, o elimínala.", noAccess: "Sin acceso", migrateAria: (email) => `Migrar y enviar la invitación de ${email}`, migrate: "Migrar y enviar", migrateDetail: (email) => `${email} no tiene acceso actualmente. Sendero reemplazará este registro por una invitación segura y enviará el correo.`, migrateTitle: (email) => `¿Migrar la invitación de ${email}?`, deleteAria: (email) => `Eliminar la invitación antigua de ${email}`, deleteInvitation: "Eliminar invitación", deleteDetail: (email) => `Se eliminará el registro pendiente de ${email}. Esta persona no tiene acceso actualmente.`, deleteTitle: (email) => `¿Eliminar la invitación antigua de ${email}?`, delete: "Eliminar",
  },
  pt: {
    invitationStatus: { expired: "Expirado", pending: "Pendente" },
    deliveryStatus: { failed: "Falha no envio", not_configured: "E-mail não configurado", processing: "Enviando", queued: "Na fila", retry_scheduled: "Tentando novamente", sent: "Aceito pelo serviço de e-mail" },
    providerEvent: { bounced: "E-mail devolvido", complained: "Marcado como spam", delayed: "Entrega atrasada", delivered: "Entregue", failed: "Falha na entrega" },
    invitation: "O convite", renewedInvitation: "O convite renovado",
    delivered: (action, email) => `${action} para ${email} foi entregue.`, acceptedByProvider: (action, email) => `O serviço de e-mail aceitou ${action.toLowerCase()} para ${email}.`, queued: (action, email) => `${action} para ${email} entrou na fila de envio.`, notConfigured: (action, email) => `${action} para ${email} foi criado, mas o e-mail ainda não está configurado.`, failed: (action, email) => `${action} para ${email} foi criado, mas o e-mail não pôde ser enviado. Você pode tentar novamente.`, created: (action, email) => `${action} para ${email} foi criado. Verifique o status antes de reenviá-lo.`, migrated: "O convite antigo foi migrado com sucesso.",
    expires: "Expira", expired: "Expirou", cancel: "Cancelar", loadError: "Não foi possível carregar as pessoas com acesso.", saveError: "Não foi possível salvar essa alteração. Tente novamente.", copyError: "Não foi possível copiar o link. Selecione-o e copie manualmente.", removedLegacy: (email) => `Você removeu o convite antigo de ${email}. Essa entrada não concedia acesso.`,
    summary: "Compartilhar e gerenciar acesso", email: "E-mail", permission: "Permissão", viewer: "Visualizador", collaborator: "Colaborador", invite: "Convidar", loading: "Carregando acesso…", generalAccess: "Acesso geral", publicDetail: "Qualquer pessoa com o link pode visualizar", restrictedDetail: "Somente pessoas convidadas", generalAria: "Acesso geral ao roteiro", restrictConfirm: "Restringir acesso", restrictDetail: "O link público atual deixará de funcionar imediatamente. As pessoas convidadas manterão o acesso.", restrictTitle: "Restringir esta viagem?", restricted: "Restrito", publicLink: "Público com link", legacyLink: "Este link continua ativo, mas foi criado com uma versão antiga do Sendero e não pode ser exibido novamente. Substitua-o somente se precisar compartilhar uma nova URL.", replaceLink: "Substituir link", replaceDetail: "O link atual deixará de funcionar e você precisará compartilhar o novo.", replaceTitle: "Criar um novo link público?", createLink: "Criar novo link", linkCopied: "Link copiado.", linkReady: "Link pronto para compartilhar.", linkAria: "Link para compartilhar", copy: "Copiar", people: "Pessoas com acesso", owner: "Proprietário", permissionOf: (email) => `Permissão de ${email}`, removeAccess: "Remover acesso", removeDetail: (name) => `${name} não poderá mais abrir esta viagem.`, removeTitle: (name) => `Remover ${name}?`, remove: "Remover", invitations: "Convites", renew: "Renovar", resend: "Reenviar", revokeInvitation: "Revogar convite", revokeDetail: (email) => `${email} não poderá mais aceitar este convite.`, revokeTitle: (email) => `Revogar o convite de ${email}?`, revoke: "Revogar", legacyInvitations: "Convites antigos", legacyDetail: "Estes registros pendentes não concedem acesso. Migre cada convite que deseja manter para enviar um link seguro, ou remova-o.", noAccess: "Sem acesso", migrateAria: (email) => `Migrar e enviar o convite de ${email}`, migrate: "Migrar e enviar", migrateDetail: (email) => `${email} não tem acesso atualmente. O Sendero substituirá este registro por um convite seguro e enviará o e-mail.`, migrateTitle: (email) => `Migrar o convite de ${email}?`, deleteAria: (email) => `Excluir o convite antigo de ${email}`, deleteInvitation: "Excluir convite", deleteDetail: (email) => `O registro pendente de ${email} será excluído. Esta pessoa não tem acesso atualmente.`, deleteTitle: (email) => `Excluir o convite antigo de ${email}?`, delete: "Excluir",
  },
  fr: {
    invitationStatus: { expired: "Expirée", pending: "En attente" },
    deliveryStatus: { failed: "Échec de l’envoi", not_configured: "E-mail non configuré", processing: "Envoi en cours", queued: "En attente d’envoi", retry_scheduled: "Nouvelle tentative", sent: "Acceptée par le service e-mail" },
    providerEvent: { bounced: "E-mail rejeté", complained: "Signalé comme indésirable", delayed: "Livraison retardée", delivered: "Livrée", failed: "Échec de la livraison" },
    invitation: "L’invitation", renewedInvitation: "L’invitation renouvelée",
    delivered: (action, email) => `${action} pour ${email} a été livrée.`, acceptedByProvider: (action, email) => `Le service e-mail a accepté ${action.toLowerCase()} pour ${email}.`, queued: (action, email) => `${action} pour ${email} a été mise en attente d’envoi.`, notConfigured: (action, email) => `${action} pour ${email} a été créée, mais l’e-mail n’est pas encore configuré.`, failed: (action, email) => `${action} pour ${email} a été créée, mais l’e-mail n’a pas pu être envoyé. Vous pouvez réessayer.`, created: (action, email) => `${action} pour ${email} a été créée. Vérifiez son statut avant de la renvoyer.`, migrated: "L’ancienne invitation a bien été migrée.",
    expires: "Expire le", expired: "Expirée", cancel: "Annuler", loadError: "Impossible de charger les personnes ayant accès.", saveError: "Impossible d’enregistrer cette modification. Réessayez.", copyError: "Impossible de copier le lien. Sélectionnez-le et copiez-le manuellement.", removedLegacy: (email) => `Vous avez supprimé l’ancienne invitation de ${email}. Cette entrée n’accordait aucun accès.`,
    summary: "Partager et gérer les accès", email: "E-mail", permission: "Autorisation", viewer: "Lecteur", collaborator: "Collaborateur", invite: "Inviter", loading: "Chargement des accès…", generalAccess: "Accès général", publicDetail: "Toute personne disposant du lien peut consulter", restrictedDetail: "Personnes invitées uniquement", generalAria: "Accès général à l’itinéraire", restrictConfirm: "Restreindre l’accès", restrictDetail: "Le lien public actuel cessera immédiatement de fonctionner. Les personnes invitées conserveront leur accès.", restrictTitle: "Restreindre ce voyage ?", restricted: "Restreint", publicLink: "Public avec le lien", legacyLink: "Ce lien est toujours actif, mais il a été créé avec une ancienne version de Sendero et ne peut plus être affiché. Remplacez-le uniquement si vous devez partager une nouvelle URL.", replaceLink: "Remplacer le lien", replaceDetail: "Le lien actuel cessera de fonctionner et vous devrez partager le nouveau.", replaceTitle: "Créer un nouveau lien public ?", createLink: "Créer un nouveau lien", linkCopied: "Lien copié.", linkReady: "Lien prêt à être partagé.", linkAria: "Lien de partage", copy: "Copier", people: "Personnes ayant accès", owner: "Propriétaire", permissionOf: (email) => `Autorisation de ${email}`, removeAccess: "Retirer l’accès", removeDetail: (name) => `${name} ne pourra plus ouvrir ce voyage.`, removeTitle: (name) => `Retirer ${name} ?`, remove: "Retirer", invitations: "Invitations", renew: "Renouveler", resend: "Renvoyer", revokeInvitation: "Révoquer l’invitation", revokeDetail: (email) => `${email} ne pourra plus accepter cette invitation.`, revokeTitle: (email) => `Révoquer l’invitation de ${email} ?`, revoke: "Révoquer", legacyInvitations: "Anciennes invitations", legacyDetail: "Ces entrées en attente n’accordent aucun accès. Migrez chaque invitation à conserver pour envoyer un lien sécurisé, ou supprimez-la.", noAccess: "Aucun accès", migrateAria: (email) => `Migrer et envoyer l’invitation de ${email}`, migrate: "Migrer et envoyer", migrateDetail: (email) => `${email} n’a actuellement aucun accès. Sendero remplacera cette entrée par une invitation sécurisée et enverra l’e-mail.`, migrateTitle: (email) => `Migrer l’invitation de ${email} ?`, deleteAria: (email) => `Supprimer l’ancienne invitation de ${email}`, deleteInvitation: "Supprimer l’invitation", deleteDetail: (email) => `L’entrée en attente de ${email} sera supprimée. Cette personne n’a actuellement aucun accès.`, deleteTitle: (email) => `Supprimer l’ancienne invitation de ${email} ?`, delete: "Supprimer",
  },
  de: {
    invitationStatus: { expired: "Abgelaufen", pending: "Ausstehend" },
    deliveryStatus: { failed: "Versand fehlgeschlagen", not_configured: "E-Mail nicht konfiguriert", processing: "Wird gesendet", queued: "In Warteschlange", retry_scheduled: "Erneuter Versuch", sent: "Vom E-Mail-Dienst angenommen" },
    providerEvent: { bounced: "E-Mail zurückgewiesen", complained: "Als Spam markiert", delayed: "Zustellung verzögert", delivered: "Zugestellt", failed: "Zustellung fehlgeschlagen" },
    invitation: "Die Einladung", renewedInvitation: "Die erneuerte Einladung",
    delivered: (action, email) => `${action} für ${email} wurde zugestellt.`, acceptedByProvider: (action, email) => `Der E-Mail-Dienst hat ${action.toLowerCase()} für ${email} angenommen.`, queued: (action, email) => `${action} für ${email} wurde zum Versand eingereiht.`, notConfigured: (action, email) => `${action} für ${email} wurde erstellt, aber E-Mail ist noch nicht konfiguriert.`, failed: (action, email) => `${action} für ${email} wurde erstellt, aber die E-Mail konnte nicht gesendet werden. Du kannst es erneut versuchen.`, created: (action, email) => `${action} für ${email} wurde erstellt. Prüfe den Status vor dem erneuten Senden.`, migrated: "Die alte Einladung wurde erfolgreich migriert.",
    expires: "Läuft ab", expired: "Abgelaufen", cancel: "Abbrechen", loadError: "Die Personen mit Zugriff konnten nicht geladen werden.", saveError: "Diese Änderung konnte nicht gespeichert werden. Versuche es erneut.", copyError: "Der Link konnte nicht kopiert werden. Markiere und kopiere ihn manuell.", removedLegacy: (email) => `Du hast die alte Einladung für ${email} entfernt. Dieser Eintrag gewährte keinen Zugriff.`,
    summary: "Teilen und Zugriff verwalten", email: "E-Mail", permission: "Berechtigung", viewer: "Leser", collaborator: "Mitwirkender", invite: "Einladen", loading: "Zugriff wird geladen…", generalAccess: "Allgemeiner Zugriff", publicDetail: "Alle mit dem Link können die Reise ansehen", restrictedDetail: "Nur eingeladene Personen", generalAria: "Allgemeiner Reiseplanzugriff", restrictConfirm: "Zugriff einschränken", restrictDetail: "Der aktuelle öffentliche Link funktioniert sofort nicht mehr. Eingeladene Personen behalten ihren Zugriff.", restrictTitle: "Diese Reise einschränken?", restricted: "Eingeschränkt", publicLink: "Öffentlich mit Link", legacyLink: "Dieser Link ist noch aktiv, wurde aber mit einer älteren Sendero-Version erstellt und kann nicht erneut angezeigt werden. Ersetze ihn nur, wenn du eine neue URL teilen musst.", replaceLink: "Link ersetzen", replaceDetail: "Der aktuelle Link funktioniert anschließend nicht mehr und du musst den neuen teilen.", replaceTitle: "Neuen öffentlichen Link erstellen?", createLink: "Neuen Link erstellen", linkCopied: "Link kopiert.", linkReady: "Link kann geteilt werden.", linkAria: "Link zum Teilen", copy: "Kopieren", people: "Personen mit Zugriff", owner: "Eigentümer", permissionOf: (email) => `Berechtigung für ${email}`, removeAccess: "Zugriff entfernen", removeDetail: (name) => `${name} kann diese Reise danach nicht mehr öffnen.`, removeTitle: (name) => `${name} entfernen?`, remove: "Entfernen", invitations: "Einladungen", renew: "Erneuern", resend: "Erneut senden", revokeInvitation: "Einladung widerrufen", revokeDetail: (email) => `${email} kann diese Einladung danach nicht mehr annehmen.`, revokeTitle: (email) => `Einladung für ${email} widerrufen?`, revoke: "Widerrufen", legacyInvitations: "Alte Einladungen", legacyDetail: "Diese ausstehenden Einträge gewähren keinen Zugriff. Migriere jede Einladung, die du behalten möchtest, um einen sicheren Link zu senden, oder entferne sie.", noAccess: "Kein Zugriff", migrateAria: (email) => `Einladung für ${email} migrieren und senden`, migrate: "Migrieren und senden", migrateDetail: (email) => `${email} hat derzeit keinen Zugriff. Sendero ersetzt diesen Eintrag durch eine sichere Einladung und sendet die E-Mail.`, migrateTitle: (email) => `Einladung für ${email} migrieren?`, deleteAria: (email) => `Alte Einladung für ${email} löschen`, deleteInvitation: "Einladung löschen", deleteDetail: (email) => `Der ausstehende Eintrag für ${email} wird gelöscht. Diese Person hat derzeit keinen Zugriff.`, deleteTitle: (email) => `Alte Einladung für ${email} löschen?`, delete: "Löschen",
  },
};

function copyFor(locale) {
  return COPY[localeLanguage(resolveContentLocale(locale))] || COPY.en;
}

function deliveryLabel(delivery, copy) {
  if (!delivery) return "";
  return copy.providerEvent[delivery.providerEvent]
    || copy.deliveryStatus[delivery.status]
    || "";
}

function deliveryNotice(delivery, email, copy, resend = false) {
  const action = resend ? copy.renewedInvitation : copy.invitation;
  const status = typeof delivery === "string" ? delivery : delivery?.status;
  const providerEvent = typeof delivery === "object" ? delivery?.providerEvent : "";
  if (providerEvent === "delivered") {
    return copy.delivered(action, email);
  }
  if (status === "sent") {
    return copy.acceptedByProvider(action, email);
  }
  if (["queued", "processing", "retry_scheduled"].includes(status)) {
    return copy.queued(action, email);
  }
  if (status === "not_configured") {
    return copy.notConfigured(action, email);
  }
  if (status === "failed") {
    return copy.failed(action, email);
  }
  return copy.created(action, email);
}

function legacyMigrationNotice(delivery, email, copy) {
  const message = deliveryNotice(delivery, email, copy);
  return `${copy.migrated} ${message}`;
}

function readableExpiry(value, expired, locale, copy) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const formatted = formatDate(locale, date, { day: "numeric", month: "short", year: "numeric" });
  return `${expired ? copy.expired : copy.expires} ${formatted}`;
}

function Confirmation({ busy, cancelLabel, confirmation, onCancel, onConfirm }) {
  if (!confirmation) return null;
  return (
    <div aria-labelledby="access-confirmation-title" aria-modal="false" className="access-confirmation" role="alertdialog">
      <div>
        <h3 id="access-confirmation-title">{confirmation.title}</h3>
        <p>{confirmation.detail}</p>
      </div>
      <div className="access-row-actions">
        <WebButton disabled={busy} onClick={onCancel}>{cancelLabel}</WebButton>
        <WebButton
          className={confirmation.danger === false ? "" : "web-button-danger"}
          disabled={busy}
          onClick={onConfirm}
          tone={confirmation.danger === false ? "primary" : "secondary"}
        >{confirmation.confirmLabel}</WebButton>
      </div>
    </div>
  );
}

function endpoint(webId, suffix = "") {
  return `/api/trips/${encodeURIComponent(webId)}${suffix}`;
}

export function AccessPanel({ csrfToken, locale = "en", webId }) {
  const copy = copyFor(locale);
  const [access, setAccess] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [notice, setNotice] = useState("");
  const [role, setRole] = useState("viewer");
  const firstLoad = useRef(true);
  const pendingOperations = useRef(new Map());

  const load = useCallback(async () => {
    setError("");
    try {
      const nextAccess = normalizeTripAccess(await requestJson(endpoint(webId, "/access")));
      setAccess(nextAccess);
      if (nextAccess.shareUrl) {
        setGeneratedLink(nextAccess.shareUrl);
      } else if (nextAccess.generalAccess === "restricted" || !nextAccess.linkRecoverable) {
        setGeneratedLink("");
      }
    } catch {
      setError(copy.loadError);
    }
  }, [webId]);

  useEffect(() => {
    if (!firstLoad.current) return;
    firstLoad.current = false;
    load();
  }, [load]);

  async function mutate(path, { body, method = "POST" } = {}) {
    if (busy) return;
    setBusy(true);
    setError("");
    const operationKey = `${method}:${path}:${JSON.stringify(body || {})}`;
    const stableOperationId = pendingOperations.current.get(operationKey)
      || operationId("sharing");
    pendingOperations.current.set(operationKey, stableOperationId);
    try {
      const result = await requestJson(endpoint(webId, path), {
        body: { ...(body || {}), operationId: stableOperationId },
        csrfToken,
        method,
      });
      pendingOperations.current.delete(operationKey);
      if (result.shareUrl || result.inviteUrl) {
        setGeneratedLink(result.shareUrl || result.inviteUrl);
        setLinkCopied(false);
      }
      if (result.generalAccess?.mode === "restricted") setGeneratedLink("");
      await load();
      setConfirmation(null);
      return result;
    } catch {
      setError(copy.saveError);
    } finally {
      setBusy(false);
    }
  }

  async function copyGeneratedLink() {
    if (!generatedLink) return;
    try {
      await navigator.clipboard.writeText(generatedLink);
      setLinkCopied(true);
    } catch {
      setError(copy.copyError);
    }
  }

  async function invite(event) {
    event.preventDefault();
    const nextEmail = email.trim();
    if (!nextEmail) return;
    const result = await mutate("/invitations", { body: { email: nextEmail, role } });
    if (result) {
      setEmail("");
      setNotice(deliveryNotice(result.delivery, nextEmail, copy));
    }
  }

  function requestConfirmation(next) {
    if (!busy) setConfirmation(next);
  }

  async function confirmDestructiveAction() {
    const action = confirmation?.action;
    if (!action) return;
    await action();
  }

  async function resendInvitation(invitation) {
    const result = await mutate(`/invitations/${encodeURIComponent(invitation.id)}/resend`);
    if (result) {
      setNotice(deliveryNotice(result.delivery, invitation.email, copy, true));
    }
  }

  async function migrateLegacyInvitation(invitation) {
    const result = await mutate(
      `/legacy-invitations/${encodeURIComponent(invitation.id)}/migrate`,
    );
    if (result) {
      setNotice(legacyMigrationNotice(result.delivery, invitation.email, copy));
    }
  }

  async function removeLegacyInvitation(invitation) {
    const result = await mutate(
      `/legacy-invitations/${encodeURIComponent(invitation.id)}`,
      { body: {}, method: "DELETE" },
    );
    if (result) {
      setNotice(copy.removedLegacy(invitation.email));
    }
  }

  return (
    <details className="access-panel">
      <style>{accessStyles}</style>
      <summary>{copy.summary}</summary>
      <div className="access-body">
        <form className="access-form" onSubmit={invite}>
          <label className="web-sr-only" htmlFor="invite-email">{copy.email}</label>
          <input autoComplete="email" id="invite-email" onChange={(event) => setEmail(event.target.value)} placeholder="persona@correo.com" type="email" value={email} />
          <label className="web-sr-only" htmlFor="invite-role">{copy.permission}</label>
          <select id="invite-role" onChange={(event) => setRole(event.target.value)} value={role}>
            <option value="viewer">{copy.viewer}</option>
            <option value="editor">{copy.collaborator}</option>
          </select>
          <WebButton disabled={busy || !email.trim()} tone="primary" type="submit">{copy.invite}</WebButton>
        </form>
        {error ? <p className="web-inline-error" role="alert">{error}</p> : null}
        {notice ? <p className="access-notice" role="status">{notice}</p> : null}
        <Confirmation busy={busy} cancelLabel={copy.cancel} confirmation={confirmation} onCancel={() => setConfirmation(null)} onConfirm={confirmDestructiveAction} />
        {!access && !error ? <p aria-live="polite">{copy.loading}</p> : null}
        {access ? (
          <>
            <div className="access-general">
              <div><strong>{copy.generalAccess}</strong><span>{access.generalAccess === "public_link" ? copy.publicDetail : copy.restrictedDetail}</span></div>
              <select aria-label={copy.generalAria} disabled={busy} onChange={(event) => {
                const generalAccess = event.target.value;
                if (generalAccess === "restricted" && access.generalAccess === "public_link") {
                  requestConfirmation({
                    action: () => mutate("/access", { body: { generalAccess }, method: "PATCH" }),
                    confirmLabel: copy.restrictConfirm,
                    detail: copy.restrictDetail,
                    title: copy.restrictTitle,
                  });
                } else mutate("/access", { body: { generalAccess }, method: "PATCH" });
              }} value={access.generalAccess}>
                <option value="restricted">{copy.restricted}</option>
                <option value="public_link">{copy.publicLink}</option>
              </select>
            </div>
            {access.generalAccess === "public_link" && !generatedLink ? (
              <div className="access-link-receipt">
                <p>{copy.legacyLink}</p>
                <div className="web-actions">
                  <WebButton disabled={busy} onClick={() => requestConfirmation({
                    action: () => mutate("/access/public-link/rotate"),
                    confirmLabel: copy.replaceLink,
                    detail: copy.replaceDetail,
                    title: copy.replaceTitle,
                  })}>{copy.createLink}</WebButton>
                </div>
              </div>
            ) : null}
            {generatedLink ? (
              <div className="access-link-receipt" role="status">
                <p>{linkCopied ? copy.linkCopied : copy.linkReady}</p>
                <div className="access-link-value">
                  <input aria-label={copy.linkAria} readOnly value={generatedLink} />
                  <WebButton onClick={copyGeneratedLink}>{copy.copy}</WebButton>
                </div>
              </div>
            ) : null}
            <section>
              <h2 className="access-subheading">{copy.people}</h2>
              <div className="access-list">
                {access.owner ? <div className="access-row"><div className="access-person"><strong>{access.owner.name || access.owner.email}</strong><span>{access.owner.email}</span></div><span className="web-role-badge">{copy.owner}</span></div> : null}
                {access.members.map((member) => (
                  <div className="access-row" key={member.id}>
                    <div className="access-person"><strong>{member.name || member.email}</strong><span>{member.email}</span></div>
                    <div className="access-row-actions">
                      <select aria-label={copy.permissionOf(member.email)} disabled={busy} onChange={(event) => mutate(`/access/${encodeURIComponent(member.id)}`, { body: { role: event.target.value }, method: "PATCH" })} value={member.role}>
                        <option value="viewer">{copy.viewer}</option><option value="editor">{copy.collaborator}</option>
                      </select>
                      <WebButton className="web-button-danger" disabled={busy} onClick={() => requestConfirmation({
                        action: () => mutate(`/access/${encodeURIComponent(member.id)}`, { body: {}, method: "DELETE" }),
                        confirmLabel: copy.removeAccess,
                        detail: copy.removeDetail(member.name || member.email),
                        title: copy.removeTitle(member.name || member.email),
                      })}>{copy.remove}</WebButton>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            {access.invitations.length ? (
              <section>
                <h2 className="access-subheading">{copy.invitations}</h2>
                <div className="access-list">
                  {access.invitations.map((invitation) => (
                    <div className="access-row" key={invitation.id}>
                      <div className="access-person">
                        <strong>{invitation.email}</strong>
                        <div className="access-invitation-meta">
                          <span>{invitation.role === "editor" ? copy.collaborator : copy.viewer}</span>
                          <span className={`web-status-badge is-${invitation.status}`}>{copy.invitationStatus[invitation.status] || copy.invitationStatus.pending}</span>
                          {deliveryLabel(invitation.delivery, copy) ? (
                            <span className={`web-status-badge is-delivery-${invitation.delivery.status}`}>
                              {deliveryLabel(invitation.delivery, copy)}
                            </span>
                          ) : null}
                          {readableExpiry(invitation.expiresAt, invitation.status === "expired", locale, copy) ? <span>{readableExpiry(invitation.expiresAt, invitation.status === "expired", locale, copy)}</span> : null}
                        </div>
                      </div>
                      <div className="access-row-actions">
                        <WebButton disabled={busy} onClick={() => resendInvitation(invitation)}>{invitation.status === "expired" ? copy.renew : copy.resend}</WebButton>
                        <WebButton className="web-button-danger" disabled={busy} onClick={() => requestConfirmation({
                          action: () => mutate(`/invitations/${encodeURIComponent(invitation.id)}`, { body: {}, method: "DELETE" }),
                          confirmLabel: copy.revokeInvitation,
                          detail: copy.revokeDetail(invitation.email),
                          title: copy.revokeTitle(invitation.email),
                        })}>{copy.revoke}</WebButton>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
            {access.legacyInvitations.length ? (
              <section>
                <h2 className="access-subheading">{copy.legacyInvitations}</h2>
                <p className="access-section-copy">
                  {copy.legacyDetail}
                </p>
                <div className="access-list access-legacy-list">
                  {access.legacyInvitations.map((invitation) => (
                    <div className="access-row" key={invitation.id}>
                      <div className="access-person">
                        <strong>{invitation.email}</strong>
                        <div className="access-invitation-meta">
                          <span>{invitation.role === "editor" ? copy.collaborator : copy.viewer}</span>
                          <span className="web-status-badge">{copy.noAccess}</span>
                        </div>
                      </div>
                      <div className="access-row-actions">
                        <WebButton aria-label={copy.migrateAria(invitation.email)} disabled={busy} onClick={() => requestConfirmation({
                          action: () => migrateLegacyInvitation(invitation),
                          confirmLabel: copy.migrate,
                          danger: false,
                          detail: copy.migrateDetail(invitation.email),
                          title: copy.migrateTitle(invitation.email),
                        })}>{copy.migrate}</WebButton>
                        <WebButton aria-label={copy.deleteAria(invitation.email)} className="web-button-danger" disabled={busy} onClick={() => requestConfirmation({
                          action: () => removeLegacyInvitation(invitation),
                          confirmLabel: copy.deleteInvitation,
                          detail: copy.deleteDetail(invitation.email),
                          title: copy.deleteTitle(invitation.email),
                        })}>{copy.delete}</WebButton>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </details>
  );
}
