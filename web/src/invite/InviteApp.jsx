import { useEffect, useRef, useState } from "react";
import { endSenderoSession, WebButton, WebPageFrame, WebState } from "../account/PageFrame.jsx";
import { loginUrl, normalizeSession, operationId, requestJson } from "../account/web-client.js";
import { localeLanguage, resolveContentLocale, setDocumentLocale } from "../i18n/index.js";
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

const COPY = {
  en: {
    roles: { editor: "Collaborator", viewer: "Viewer" },
    loading: "Preparing the invitation…",
    errorDetail: "The link may have expired or may no longer be available.",
    errorTitle: "We couldn't open the invitation",
    signIn: "Sign in",
    signedOutDetail: "The invitation will remain available while you sign in.",
    invitedTo: (title) => `You've been invited to ${title}`,
    verified: "I've verified my email",
    verifyDetail: (email) => `Verify ${email || "your account email"} and sign in again to continue. The invitation will remain available during this step.`,
    verifyTitle: "Verify your email to continue",
    otherAccount: "Use another account",
    switchError: "We couldn't switch accounts. Try again.",
    mismatchDetail: (email) => `${email ? `You're currently using ${email}. ` : ""}Open the invitation with the email account that received it; you won't lose the link when switching accounts.`,
    mismatchTitle: "This invitation is for another account",
    unavailableDetail: "Ask the owner to send you a new invitation.",
    unavailableTitle: "The invitation is no longer available",
    eyebrow: "Sendero invitation",
    inviterDetail: (name) => name ? `${name} wants to share this trip with you.` : "You've been invited to share this trip.",
    destination: "Destination",
    pending: "To be confirmed",
    access: "Access",
    invitedBy: "Invited by",
    owner: "Trip owner",
    validUntil: "Valid until",
    accepted: "Invitation accepted",
    declined: "Invitation declined",
    acceptedDetail: "This trip is now in your account.",
    declinedDetail: "You won't have access to this trip.",
    open: "Open itinerary",
    actionError: "We couldn't save your response. Try again.",
    accept: "Accept invitation",
    decline: "Decline",
  },
  es: {
    roles: { editor: "Colaborador", viewer: "Viewer" },
    loading: "Preparando la invitación…", errorDetail: "El enlace puede haber vencido o ya no estar disponible.", errorTitle: "No pudimos abrir la invitación", signIn: "Iniciar sesión", signedOutDetail: "La invitación quedará guardada mientras inicias sesión.", invitedTo: (title) => `Te invitaron a ${title}`, verified: "Ya verifiqué mi correo", verifyDetail: (email) => `Verifica ${email || "el correo de tu cuenta"} y vuelve a identificarte para continuar. La invitación quedará guardada durante este paso.`, verifyTitle: "Verifica tu correo para continuar", otherAccount: "Usar otra cuenta", switchError: "No pudimos cambiar de cuenta. Intenta nuevamente.", mismatchDetail: (email) => `${email ? `Ahora estás usando ${email}. ` : ""}Abre la invitación con la cuenta de correo que la recibió; no perderás el enlace al cambiar de cuenta.`, mismatchTitle: "Esta invitación es para otra cuenta", unavailableDetail: "Pide a la persona propietaria que te envíe una invitación nueva.", unavailableTitle: "La invitación ya no está disponible", eyebrow: "Invitación de Sendero", inviterDetail: (name) => name ? `${name} quiere compartir este viaje contigo.` : "Te invitaron a compartir este viaje.", destination: "Destino", pending: "Por confirmar", access: "Acceso", invitedBy: "Invitado por", owner: "Propietario del viaje", validUntil: "Válida hasta", accepted: "Invitación aceptada", declined: "Invitación rechazada", acceptedDetail: "Este viaje ya está en tu cuenta.", declinedDetail: "No tendrás acceso a este viaje.", open: "Abrir itinerario", actionError: "No pudimos guardar tu respuesta. Intenta nuevamente.", accept: "Aceptar invitación", decline: "Rechazar",
  },
  pt: {
    roles: { editor: "Colaborador", viewer: "Visualizador" },
    loading: "Preparando o convite…", errorDetail: "O link pode ter expirado ou não estar mais disponível.", errorTitle: "Não foi possível abrir o convite", signIn: "Entrar", signedOutDetail: "O convite continuará disponível enquanto você entra.", invitedTo: (title) => `Você foi convidado para ${title}`, verified: "Já verifiquei meu e-mail", verifyDetail: (email) => `Verifique ${email || "o e-mail da sua conta"} e entre novamente para continuar. O convite continuará disponível durante esta etapa.`, verifyTitle: "Verifique seu e-mail para continuar", otherAccount: "Usar outra conta", switchError: "Não foi possível trocar de conta. Tente novamente.", mismatchDetail: (email) => `${email ? `Você está usando ${email}. ` : ""}Abra o convite com a conta de e-mail que o recebeu; você não perderá o link ao trocar de conta.`, mismatchTitle: "Este convite é para outra conta", unavailableDetail: "Peça ao proprietário para enviar um novo convite.", unavailableTitle: "O convite não está mais disponível", eyebrow: "Convite do Sendero", inviterDetail: (name) => name ? `${name} quer compartilhar esta viagem com você.` : "Você foi convidado para compartilhar esta viagem.", destination: "Destino", pending: "A confirmar", access: "Acesso", invitedBy: "Convidado por", owner: "Proprietário da viagem", validUntil: "Válido até", accepted: "Convite aceito", declined: "Convite recusado", acceptedDetail: "Esta viagem agora está na sua conta.", declinedDetail: "Você não terá acesso a esta viagem.", open: "Abrir roteiro", actionError: "Não foi possível salvar sua resposta. Tente novamente.", accept: "Aceitar convite", decline: "Recusar",
  },
};

function copyFor(locale) {
  return COPY[localeLanguage(locale)] || COPY.en;
}

function invitationReturnTo(webId) {
  return webId ? `/invite/${encodeURIComponent(webId)}` : "/invite";
}

export function InviteApp() {
  const [state, setState] = useState({ kind: "loading" });
  const actionStarted = useRef(false);
  const locale = resolveContentLocale(state.inspection?.invitation?.locale);
  const copy = copyFor(locale);

  useEffect(() => { setDocumentLocale(locale); }, [locale]);

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

  if (state.kind === "loading") return <WebState kind="loading" title={copy.loading} />;
  if (state.kind === "error") return <WebState detail={copy.errorDetail} kind="error" title={copy.errorTitle} />;
  if (state.kind === "signed_out") {
    const invitation = state.inspection.invitation;
    return <WebState action={<a className="web-button web-button-primary" href={loginUrl(state.session, invitationReturnTo(invitation.webId))}>{copy.signIn}</a>} detail={copy.signedOutDetail} title={copy.invitedTo(invitation.title)} />;
  }
  if (state.kind === "email_unverified") {
    const invitation = state.inspection.invitation;
    return <WebState action={<a className="web-button web-button-primary" href={loginUrl(state.session, invitationReturnTo(invitation.webId), { reauthenticate: true })}>{copy.verified}</a>} detail={copy.verifyDetail(state.session.user?.email)} session={state.session} title={copy.verifyTitle} />;
  }
  if (state.kind === "email_mismatch") {
    const currentEmail = state.session.user?.email;
    return <WebState action={<><WebButton onClick={changeAccount} tone="primary">{copy.otherAccount}</WebButton>{state.accountError ? <p className="web-inline-error" role="alert">{copy.switchError}</p> : null}</>} detail={copy.mismatchDetail(currentEmail)} session={state.session} title={copy.mismatchTitle} />;
  }
  if (state.kind === "unavailable") return <WebState detail={copy.unavailableDetail} kind="error" title={copy.unavailableTitle} />;

  const invitation = state.inspection.invitation;
  const receipt = state.kind === "receipt" ? state.receipt : null;
  return (
    <WebPageFrame csrfToken={state.session.csrfToken} user={state.session.user}>
      <style>{inviteStyles}</style>
      <section className="invite-card">
        <p className="web-eyebrow">{copy.eyebrow}</p>
        <h1>{invitation.title}</h1>
        <p>{copy.inviterDetail(invitation.inviterName)}</p>
        <dl className="invite-meta">
          <div><dt>{copy.destination}</dt><dd>{invitation.destination || copy.pending}</dd></div>
          <div><dt>{copy.access}</dt><dd>{copy.roles[invitation.role]}</dd></div>
          <div><dt>{copy.invitedBy}</dt><dd>{invitation.inviterName || copy.owner}</dd></div>
          <div><dt>{copy.validUntil}</dt><dd>{formatInvitationExpiry(invitation.expiresAt, locale)}</dd></div>
        </dl>
        {receipt ? (
          <div aria-live="polite" className="invite-receipt" role="status">
            <span aria-hidden="true" className="invite-receipt-mark">✓</span>
            <div>
              <h2>{receipt.decision === "accepted" ? copy.accepted : copy.declined}</h2>
              <p>{receipt.decision === "accepted" ? copy.acceptedDetail : copy.declinedDetail}</p>
              {receipt.decision === "accepted" && receipt.webId ? <div className="web-actions"><a className="web-button web-button-primary" href={`/app/trips/${encodeURIComponent(receipt.webId)}`}>{copy.open}</a></div> : null}
            </div>
          </div>
        ) : (
          <>
            {state.actionError ? <p className="web-inline-error" role="alert">{copy.actionError}</p> : null}
            <div className="web-actions">
              <WebButton disabled={state.kind === "submitting"} onClick={() => decide("accepted")} tone="primary">{copy.accept}</WebButton>
              <WebButton disabled={state.kind === "submitting"} onClick={() => decide("declined")}>{copy.decline}</WebButton>
            </div>
          </>
        )}
      </section>
    </WebPageFrame>
  );
}
