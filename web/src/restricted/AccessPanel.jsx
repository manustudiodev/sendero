import { useCallback, useEffect, useRef, useState } from "react";
import { WebButton } from "../account/PageFrame.jsx";
import { normalizeTripAccess, operationId, requestJson } from "../account/web-client.js";

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

const INVITATION_STATUS = {
  expired: "Vencida",
  pending: "Pendiente",
};

const DELIVERY_STATUS = {
  failed: "Falló el envío",
  not_configured: "Correo no configurado",
  processing: "Enviando",
  queued: "En cola",
  retry_scheduled: "Reintentando",
  sent: "Aceptada por correo",
};

const PROVIDER_EVENT = {
  bounced: "Correo rebotado",
  complained: "Marcada como spam",
  delayed: "Entrega demorada",
  delivered: "Entregada",
  failed: "Entrega fallida",
};

function deliveryLabel(delivery) {
  if (!delivery) return "";
  return PROVIDER_EVENT[delivery.providerEvent]
    || DELIVERY_STATUS[delivery.status]
    || "";
}

function deliveryNotice(delivery, email, resend = false) {
  const action = resend ? "La invitación renovada" : "La invitación";
  const status = typeof delivery === "string" ? delivery : delivery?.status;
  const providerEvent = typeof delivery === "object" ? delivery?.providerEvent : "";
  if (providerEvent === "delivered") {
    return `${action} para ${email} fue entregada.`;
  }
  if (status === "sent") {
    return `El servicio de correo aceptó ${action.toLowerCase()} para ${email}.`;
  }
  if (["queued", "processing", "retry_scheduled"].includes(status)) {
    return `${action} para ${email} quedó en cola de envío.`;
  }
  if (status === "not_configured") {
    return `${action} para ${email} quedó creada, pero el correo todavía no está configurado.`;
  }
  if (status === "failed") {
    return `${action} para ${email} quedó creada, pero el correo no pudo enviarse. Puedes reintentarlo.`;
  }
  return `${action} para ${email} quedó creada. Revisa su estado antes de reenviarla.`;
}

function legacyMigrationNotice(delivery, email) {
  const message = deliveryNotice(delivery, email);
  return `La invitación antigua se migró correctamente. ${message}`;
}

function readableExpiry(value, expired) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const formatted = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" }).format(date);
  return `${expired ? "Venció" : "Vence"} el ${formatted}`;
}

function Confirmation({ busy, confirmation, onCancel, onConfirm }) {
  if (!confirmation) return null;
  return (
    <div aria-labelledby="access-confirmation-title" aria-modal="false" className="access-confirmation" role="alertdialog">
      <div>
        <h3 id="access-confirmation-title">{confirmation.title}</h3>
        <p>{confirmation.detail}</p>
      </div>
      <div className="access-row-actions">
        <WebButton disabled={busy} onClick={onCancel}>Cancelar</WebButton>
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

export function AccessPanel({ csrfToken, webId }) {
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
      setAccess(normalizeTripAccess(await requestJson(endpoint(webId, "/access"))));
    } catch {
      setError("No pudimos cargar las personas con acceso.");
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
      setError("No pudimos guardar ese cambio. Intenta nuevamente.");
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
      setError("No pudimos copiar el enlace. Selecciónalo y cópialo manualmente.");
    }
  }

  async function invite(event) {
    event.preventDefault();
    const nextEmail = email.trim();
    if (!nextEmail) return;
    const result = await mutate("/invitations", { body: { email: nextEmail, role } });
    if (result) {
      setEmail("");
      setNotice(deliveryNotice(result.delivery, nextEmail));
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
      setNotice(deliveryNotice(result.delivery, invitation.email, true));
    }
  }

  async function migrateLegacyInvitation(invitation) {
    const result = await mutate(
      `/legacy-invitations/${encodeURIComponent(invitation.id)}/migrate`,
    );
    if (result) {
      setNotice(legacyMigrationNotice(result.delivery, invitation.email));
    }
  }

  async function removeLegacyInvitation(invitation) {
    const result = await mutate(
      `/legacy-invitations/${encodeURIComponent(invitation.id)}`,
      { body: {}, method: "DELETE" },
    );
    if (result) {
      setNotice(`Eliminaste la invitación antigua de ${invitation.email}. Esa entrada no otorgaba acceso.`);
    }
  }

  return (
    <details className="access-panel">
      <style>{accessStyles}</style>
      <summary>Compartir y gestionar acceso</summary>
      <div className="access-body">
        <form className="access-form" onSubmit={invite}>
          <label className="web-sr-only" htmlFor="invite-email">Correo</label>
          <input autoComplete="email" id="invite-email" onChange={(event) => setEmail(event.target.value)} placeholder="persona@correo.com" type="email" value={email} />
          <label className="web-sr-only" htmlFor="invite-role">Permiso</label>
          <select id="invite-role" onChange={(event) => setRole(event.target.value)} value={role}>
            <option value="viewer">Viewer</option>
            <option value="editor">Colaborador</option>
          </select>
          <WebButton disabled={busy || !email.trim()} tone="primary" type="submit">Invitar</WebButton>
        </form>
        {error ? <p className="web-inline-error" role="alert">{error}</p> : null}
        {notice ? <p className="access-notice" role="status">{notice}</p> : null}
        <Confirmation busy={busy} confirmation={confirmation} onCancel={() => setConfirmation(null)} onConfirm={confirmDestructiveAction} />
        {!access && !error ? <p aria-live="polite">Cargando acceso…</p> : null}
        {access ? (
          <>
            <div className="access-general">
              <div><strong>Acceso general</strong><span>{access.generalAccess === "public_link" ? "Cualquier persona con el enlace puede ver" : "Solo personas invitadas"}</span></div>
              <select aria-label="Acceso general del itinerario" disabled={busy} onChange={(event) => {
                const generalAccess = event.target.value;
                if (generalAccess === "restricted" && access.generalAccess === "public_link") {
                  requestConfirmation({
                    action: () => mutate("/access", { body: { generalAccess }, method: "PATCH" }),
                    confirmLabel: "Restringir acceso",
                    detail: "El enlace público actual dejará de funcionar inmediatamente. Las personas invitadas conservarán su acceso.",
                    title: "¿Restringir este viaje?",
                  });
                } else mutate("/access", { body: { generalAccess }, method: "PATCH" });
              }} value={access.generalAccess}>
                <option value="restricted">Restringido</option>
                <option value="public_link">Público con enlace</option>
              </select>
            </div>
            {access.generalAccess === "public_link" && !generatedLink ? (
              <div className="access-link-receipt">
                <p>El enlace público está activo. Si ya no lo tienes, crea uno nuevo; el anterior dejará de funcionar.</p>
                <div className="web-actions">
                  <WebButton disabled={busy} onClick={() => requestConfirmation({
                    action: () => mutate("/access/public-link/rotate"),
                    confirmLabel: "Reemplazar enlace",
                    detail: "El enlace actual dejará de funcionar y tendrás que compartir el nuevo.",
                    title: "¿Crear un enlace público nuevo?",
                  })}>Crear enlace nuevo</WebButton>
                </div>
              </div>
            ) : null}
            {generatedLink ? (
              <div className="access-link-receipt" role="status">
                <p>{linkCopied ? "Enlace copiado." : "Enlace listo para compartir."}</p>
                <div className="access-link-value">
                  <input aria-label="Enlace para compartir" readOnly value={generatedLink} />
                  <WebButton onClick={copyGeneratedLink}>Copiar</WebButton>
                </div>
              </div>
            ) : null}
            <section>
              <h2 className="access-subheading">Personas con acceso</h2>
              <div className="access-list">
                {access.owner ? <div className="access-row"><div className="access-person"><strong>{access.owner.name || access.owner.email}</strong><span>{access.owner.email}</span></div><span className="web-role-badge">Propietario</span></div> : null}
                {access.members.map((member) => (
                  <div className="access-row" key={member.id}>
                    <div className="access-person"><strong>{member.name || member.email}</strong><span>{member.email}</span></div>
                    <div className="access-row-actions">
                      <select aria-label={`Permiso de ${member.email}`} disabled={busy} onChange={(event) => mutate(`/access/${encodeURIComponent(member.id)}`, { body: { role: event.target.value }, method: "PATCH" })} value={member.role}>
                        <option value="viewer">Viewer</option><option value="editor">Colaborador</option>
                      </select>
                      <WebButton className="web-button-danger" disabled={busy} onClick={() => requestConfirmation({
                        action: () => mutate(`/access/${encodeURIComponent(member.id)}`, { body: {}, method: "DELETE" }),
                        confirmLabel: "Quitar acceso",
                        detail: `${member.name || member.email} dejará de poder abrir este viaje.`,
                        title: `¿Quitar a ${member.name || member.email}?`,
                      })}>Quitar</WebButton>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            {access.invitations.length ? (
              <section>
                <h2 className="access-subheading">Invitaciones</h2>
                <div className="access-list">
                  {access.invitations.map((invitation) => (
                    <div className="access-row" key={invitation.id}>
                      <div className="access-person">
                        <strong>{invitation.email}</strong>
                        <div className="access-invitation-meta">
                          <span>{invitation.role === "editor" ? "Colaborador" : "Viewer"}</span>
                          <span className={`web-status-badge is-${invitation.status}`}>{INVITATION_STATUS[invitation.status] || "Pendiente"}</span>
                          {deliveryLabel(invitation.delivery) ? (
                            <span className={`web-status-badge is-delivery-${invitation.delivery.status}`}>
                              {deliveryLabel(invitation.delivery)}
                            </span>
                          ) : null}
                          {readableExpiry(invitation.expiresAt, invitation.status === "expired") ? <span>{readableExpiry(invitation.expiresAt, invitation.status === "expired")}</span> : null}
                        </div>
                      </div>
                      <div className="access-row-actions">
                        <WebButton disabled={busy} onClick={() => resendInvitation(invitation)}>{invitation.status === "expired" ? "Renovar" : "Reenviar"}</WebButton>
                        <WebButton className="web-button-danger" disabled={busy} onClick={() => requestConfirmation({
                          action: () => mutate(`/invitations/${encodeURIComponent(invitation.id)}`, { body: {}, method: "DELETE" }),
                          confirmLabel: "Revocar invitación",
                          detail: `${invitation.email} ya no podrá aceptar esta invitación.`,
                          title: `¿Revocar la invitación de ${invitation.email}?`,
                        })}>Revocar</WebButton>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
            {access.legacyInvitations.length ? (
              <section>
                <h2 className="access-subheading">Invitaciones antiguas</h2>
                <p className="access-section-copy">
                  Estos registros pendientes no otorgan acceso. Migra cada invitación que quieras conservar para enviar un enlace seguro, o elimínala.
                </p>
                <div className="access-list access-legacy-list">
                  {access.legacyInvitations.map((invitation) => (
                    <div className="access-row" key={invitation.id}>
                      <div className="access-person">
                        <strong>{invitation.email}</strong>
                        <div className="access-invitation-meta">
                          <span>{invitation.role === "editor" ? "Colaborador" : "Viewer"}</span>
                          <span className="web-status-badge">Sin acceso</span>
                        </div>
                      </div>
                      <div className="access-row-actions">
                        <WebButton aria-label={`Migrar y enviar la invitación de ${invitation.email}`} disabled={busy} onClick={() => requestConfirmation({
                          action: () => migrateLegacyInvitation(invitation),
                          confirmLabel: "Migrar y enviar",
                          danger: false,
                          detail: `${invitation.email} no tiene acceso actualmente. Sendero reemplazará este registro por una invitación segura y enviará el correo.`,
                          title: `¿Migrar la invitación de ${invitation.email}?`,
                        })}>Migrar y enviar</WebButton>
                        <WebButton aria-label={`Eliminar la invitación antigua de ${invitation.email}`} className="web-button-danger" disabled={busy} onClick={() => requestConfirmation({
                          action: () => removeLegacyInvitation(invitation),
                          confirmLabel: "Eliminar invitación",
                          detail: `Se eliminará el registro pendiente de ${invitation.email}. Esta persona no tiene acceso actualmente.`,
                          title: `¿Eliminar la invitación antigua de ${invitation.email}?`,
                        })}>Eliminar</WebButton>
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
