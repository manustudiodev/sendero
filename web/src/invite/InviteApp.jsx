import { useEffect, useRef, useState } from "react";
import { endSenderoSession, WebButton, WebPageFrame, WebState } from "../account/PageFrame.jsx";
import { loginUrl, normalizeSession, operationId, requestJson } from "../account/web-client.js";
import {
  invitationWebId,
  formatInvitationExpiry,
  inviteTokenFromHash,
  normalizeInvitationInspection,
  urlWithoutFragment,
} from "./invitation.js";

const inviteStyles = `
.invite-card { width: min(680px, 100%); margin: 7vh auto 0; border: 1px solid var(--web-line); border-radius: 24px; padding: clamp(25px, 6vw, 48px); background: var(--web-surface); }
.invite-card h1 { margin: 0; font-size: clamp(30px, 6vw, 48px); letter-spacing: -.05em; line-height: 1.04; }
.invite-card > p { color: var(--web-muted); }
.invite-meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; margin-top: 24px; overflow: hidden; border: 1px solid var(--web-line); border-radius: 14px; background: var(--web-line); }
.invite-meta div { padding: 15px; background: var(--web-surface); }
.invite-meta dt { color: var(--web-muted); font-size: 14px; }
.invite-meta dd { margin: 3px 0 0; font-weight: 700; }
.invite-receipt { display: flex; gap: 14px; align-items: flex-start; margin-top: 24px; padding: 18px; border-radius: 14px; background: var(--web-soft); }
.invite-receipt-mark { display: grid; width: 34px; height: 34px; flex: 0 0 auto; place-items: center; border-radius: 50%; background: var(--web-grass); color: #003834; font-weight: 800; }
.invite-receipt h2, .invite-receipt p { margin: 0; }
.invite-receipt p { color: var(--web-muted); }
@media (max-width: 520px) { .invite-meta { grid-template-columns: 1fr; } }
`;

const ROLE_LABEL = { editor: "Colaborador", viewer: "Viewer" };

function invitationReturnTo(webId) {
  return webId ? `/invite/${encodeURIComponent(webId)}` : "/invite";
}

export function InviteApp() {
  const [state, setState] = useState({ kind: "loading" });
  const actionStarted = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    const token = inviteTokenFromHash(window.location.hash);
    const webId = invitationWebId(window.location);
    window.history.replaceState(window.history.state, "", urlWithoutFragment(window.location));
    (async () => {
      try {
        const inspection = normalizeInvitationInspection(await requestJson("/api/invitations/inspect", {
          body: token ? { token, webId } : { webId },
          method: "POST",
          signal: controller.signal,
        }));
        let session = { authenticated: false };
        if (!["signed_out", "unavailable"].includes(inspection.state)) {
          session = normalizeSession(await requestJson("/api/session", { signal: controller.signal }));
          if (!session.authenticated) inspection.state = "signed_out";
        }
        setState({ inspection, kind: inspection.state, session });
      } catch (error) {
        if (error?.name !== "AbortError") setState({ error, kind: "error" });
      }
    })();
    return () => controller.abort();
  }, []);

  async function decide(decision) {
    if (actionStarted.current || state.kind !== "ready") return;
    actionStarted.current = true;
    setState((current) => ({ ...current, kind: "submitting" }));
    try {
      const result = await requestJson(`/api/invitations/${decision === "accepted" ? "accept" : "decline"}`, {
        body: { operationId: operationId(`invite-${decision}`) },
        csrfToken: state.session.csrfToken,
        method: "POST",
      });
      if (result.status !== decision) {
        setState((current) => ({ ...current, kind: "unavailable" }));
        return;
      }
      setState((current) => ({ ...current, kind: "receipt", receipt: { decision, webId: result.webId || current.inspection.invitation.webId } }));
    } catch (error) {
      if (error?.code === "invitation_unavailable" || error?.status === 409) {
        setState((current) => ({ ...current, kind: "unavailable" }));
        return;
      }
      actionStarted.current = false;
      setState((current) => ({ ...current, actionError: error, kind: "ready" }));
    }
  }

  async function changeAccount() {
    try {
      await endSenderoSession(state.session.csrfToken, {
        changeAccount: true,
        returnTo: invitationReturnTo(state.inspection.invitation.webId),
      });
    } catch {
      setState((current) => ({ ...current, accountError: true }));
    }
  }

  if (state.kind === "loading") return <WebState kind="loading" title="Preparando la invitación…" />;
  if (state.kind === "error") return <WebState detail="El enlace puede haber vencido o ya no estar disponible." kind="error" title="No pudimos abrir la invitación" />;
  if (state.kind === "signed_out") {
    const invitation = state.inspection.invitation;
    return <WebState action={<a className="web-button web-button-primary" href={loginUrl(state.session, invitationReturnTo(invitation.webId))}>Iniciar sesión</a>} detail="La invitación quedará guardada mientras inicias sesión." title={`Te invitaron a ${invitation.title}`} />;
  }
  if (state.kind === "email_unverified") {
    const invitation = state.inspection.invitation;
    return <WebState action={<a className="web-button web-button-primary" href={loginUrl(state.session, invitationReturnTo(invitation.webId), { reauthenticate: true })}>Ya verifiqué mi correo</a>} detail={`Verifica ${state.session.user?.email || "el correo de tu cuenta"} y vuelve a identificarte para continuar. La invitación quedará guardada durante este paso.`} session={state.session} title="Verifica tu correo para continuar" />;
  }
  if (state.kind === "email_mismatch") {
    const currentEmail = state.session.user?.email;
    return <WebState action={<><WebButton onClick={changeAccount} tone="primary">Usar otra cuenta</WebButton>{state.accountError ? <p className="web-inline-error" role="alert">No pudimos cambiar de cuenta. Intenta nuevamente.</p> : null}</>} detail={`${currentEmail ? `Ahora estás usando ${currentEmail}. ` : ""}Abre la invitación con la cuenta de correo que la recibió; no perderás el enlace al cambiar de cuenta.`} session={state.session} title="Esta invitación es para otra cuenta" />;
  }
  if (state.kind === "unavailable") return <WebState detail="Pide a la persona propietaria que te envíe una invitación nueva." kind="error" title="La invitación ya no está disponible" />;

  const invitation = state.inspection.invitation;
  const receipt = state.kind === "receipt" ? state.receipt : null;
  return (
    <WebPageFrame csrfToken={state.session.csrfToken} user={state.session.user}>
      <style>{inviteStyles}</style>
      <section className="invite-card">
        <p className="web-eyebrow">Invitación de Sendero</p>
        <h1>{invitation.title}</h1>
        <p>{invitation.inviterName ? `${invitation.inviterName} quiere compartir este viaje contigo.` : "Te invitaron a compartir este viaje."}</p>
        <dl className="invite-meta">
          <div><dt>Destino</dt><dd>{invitation.destination || "Por confirmar"}</dd></div>
          <div><dt>Acceso</dt><dd>{ROLE_LABEL[invitation.role]}</dd></div>
          <div><dt>Invitado por</dt><dd>{invitation.inviterName || "Propietario del viaje"}</dd></div>
          <div><dt>Válida hasta</dt><dd>{formatInvitationExpiry(invitation.expiresAt)}</dd></div>
        </dl>
        {receipt ? (
          <div aria-live="polite" className="invite-receipt" role="status">
            <span aria-hidden="true" className="invite-receipt-mark">✓</span>
            <div>
              <h2>{receipt.decision === "accepted" ? "Invitación aceptada" : "Invitación rechazada"}</h2>
              <p>{receipt.decision === "accepted" ? "Este viaje ya está en tu cuenta." : "No tendrás acceso a este viaje."}</p>
              {receipt.decision === "accepted" && receipt.webId ? <div className="web-actions"><a className="web-button web-button-primary" href={`/app/trips/${encodeURIComponent(receipt.webId)}`}>Abrir itinerario</a></div> : null}
            </div>
          </div>
        ) : (
          <>
            {state.actionError ? <p className="web-inline-error" role="alert">No pudimos guardar tu respuesta. Intenta nuevamente.</p> : null}
            <div className="web-actions">
              <WebButton disabled={state.kind === "submitting"} onClick={() => decide("accepted")} tone="primary">Aceptar invitación</WebButton>
              <WebButton disabled={state.kind === "submitting"} onClick={() => decide("declined")}>Rechazar</WebButton>
            </div>
          </>
        )}
      </section>
    </WebPageFrame>
  );
}
