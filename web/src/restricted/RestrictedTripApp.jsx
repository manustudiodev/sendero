import { useCallback, useEffect, useRef, useState } from "react";
import { WebButton, WebPageFrame, WebState } from "../account/PageFrame.jsx";
import {
  createStableOperationRegistry,
  loginUrl,
  normalizeRestrictedTrip,
  normalizeSession,
  requestJson,
} from "../account/web-client.js";
import { localeLanguage, resolveContentLocale, setDocumentLocale } from "../i18n/index.js";
import { ItineraryViewer } from "../itinerary/ItineraryViewer.jsx";
import { reservationEntryKey } from "../itinerary/presentation-utils.js";
import { AccessPanel } from "./AccessPanel.jsx";

const restrictedStyles = `
.restricted-page { width: min(1500px, calc(100% - 28px)); }
.restricted-context { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin: -18px 0 18px; }
.restricted-context p { margin: 0; color: var(--web-muted); font-size: 14px; }
.restricted-context-actions { display: flex; align-items: center; justify-content: flex-end; gap: 10px; }
.restricted-chat-link { color: var(--web-forest); font-size: 14px; font-weight: 720; text-decoration: none; }
.restricted-chat-link:hover { text-decoration: underline; }
.restricted-viewer { overflow: hidden; border: 1px solid var(--web-line); border-radius: 24px; background: var(--web-surface); }
.restricted-viewer .itinerary-viewer {
  width: 100%;
  color-scheme: light;
  --ink: #1f1f1d;
  --muted: #787873;
  --subtle: #a3a39e;
  --line: #e9e9e6;
  --line-strong: #d8d8d4;
  --soft: #f7f7f5;
  --surface: #ffffff;
  --surface-hover: #fbfbfa;
  --on-strong: #ffffff;
  --strong-hover: #343431;
  --blue: var(--sendero-forest);
  --danger: #a33c35;
  --focus-border: #9a9a94;
  --focus-ring: rgba(47, 114, 196, .35);
  --field-ring: rgba(31, 31, 29, .05);
  --shadow: rgba(15, 15, 15, .1);
  --locked-bg: #f0f6d9;
  --locked-ink: #4d5e1c;
  --warning-bg: #fbf5df;
  --warning-ink: #6c5721;
  --danger-bg: #faecea;
  --public-muted: #62625d;
  background: var(--surface);
  color: var(--ink);
}
.restricted-update-error { margin: 12px 0; padding: 12px 14px; border-radius: 11px; background: #fff2ef; color: var(--web-danger); }
@media (prefers-color-scheme: dark) {
  .restricted-viewer .itinerary-viewer {
    color-scheme: dark;
    --ink: #f2f2ef;
    --muted: #aaa9a3;
    --subtle: #7f7f78;
    --line: #383834;
    --line-strong: #51514b;
    --soft: #292925;
    --surface: #20201e;
    --surface-hover: #2d2d29;
    --on-strong: #1b1b19;
    --strong-hover: #d8d8d3;
    --blue: var(--sendero-teal);
    --danger: #ff9c94;
    --focus-border: #85857e;
    --focus-ring: rgba(126, 181, 244, .45);
    --field-ring: rgba(255, 255, 255, .08);
    --shadow: rgba(0, 0, 0, .35);
    --locked-bg: #313b20;
    --locked-ink: #d9ef9c;
    --warning-bg: #3a321c;
    --warning-ink: #f2d681;
    --danger-bg: #412421;
    --public-muted: #b7b7b0;
  }
  .restricted-update-error { background: #382321; }
}
@media (max-width: 640px) { .restricted-page { width: min(100% - 14px, 1500px); } .restricted-context { align-items: flex-start; flex-direction: column; } .restricted-context-actions { width: 100%; justify-content: space-between; } .restricted-viewer { border-radius: 16px; } }
`;

const COPY = {
  en: {
    roles: { editor: "Collaborator", owner: "Owner", viewer: "Viewer" },
    conflict: "The itinerary changed somewhere else. We loaded the latest version; review the status before trying again.",
    reservationError: "We couldn't update this booking. Try again.",
    loading: "Opening the itinerary…",
    signIn: "Sign in",
    signedOutDetail: "This itinerary is available only to invited people.",
    signedOutTitle: "Sign in to view it",
    forbiddenDetail: "Ask the owner to invite the email address you use for your Sendero account.",
    forbiddenTitle: "You don't have access to this trip",
    back: "Back to my trips",
    notFoundDetail: "It may have been deleted or the link may be incorrect.",
    notFoundTitle: "We couldn't find this trip",
    retry: "Try again",
    errorDetail: "Your data is still saved; try again.",
    errorTitle: "We couldn't open the itinerary",
    restricted: "Restricted access",
    continue: "Continue this trip in ChatGPT ↗",
  },
  es: {
    roles: { editor: "Colaborador", owner: "Propietario", viewer: "Viewer" },
    conflict: "El itinerario cambió en otro lugar. Ya cargamos la versión más reciente; revisa el estado antes de intentar otra vez.",
    reservationError: "No pudimos actualizar esta reserva. Intenta nuevamente.",
    loading: "Abriendo el itinerario…",
    signIn: "Iniciar sesión",
    signedOutDetail: "Este itinerario está disponible solo para personas invitadas.",
    signedOutTitle: "Inicia sesión para verlo",
    forbiddenDetail: "Pide a la persona propietaria que te invite con el correo de tu cuenta de Sendero.",
    forbiddenTitle: "No tienes acceso a este viaje",
    back: "Volver a mis viajes",
    notFoundDetail: "Puede haber sido eliminado o el enlace no es correcto.",
    notFoundTitle: "No encontramos este viaje",
    retry: "Intentar de nuevo",
    errorDetail: "Tus datos siguen guardados; vuelve a intentarlo.",
    errorTitle: "No pudimos abrir el itinerario",
    restricted: "Acceso restringido",
    continue: "Continuar este viaje en ChatGPT ↗",
  },
  pt: {
    roles: { editor: "Colaborador", owner: "Proprietário", viewer: "Visualizador" },
    conflict: "O roteiro mudou em outro lugar. Carregamos a versão mais recente; revise o status antes de tentar novamente.",
    reservationError: "Não foi possível atualizar esta reserva. Tente novamente.",
    loading: "Abrindo o roteiro…",
    signIn: "Entrar",
    signedOutDetail: "Este roteiro está disponível apenas para pessoas convidadas.",
    signedOutTitle: "Entre para visualizá-lo",
    forbiddenDetail: "Peça ao proprietário para convidar o e-mail da sua conta do Sendero.",
    forbiddenTitle: "Você não tem acesso a esta viagem",
    back: "Voltar às minhas viagens",
    notFoundDetail: "A viagem pode ter sido excluída ou o link pode estar incorreto.",
    notFoundTitle: "Não encontramos esta viagem",
    retry: "Tentar novamente",
    errorDetail: "Seus dados continuam salvos; tente novamente.",
    errorTitle: "Não foi possível abrir o roteiro",
    restricted: "Acesso restrito",
    continue: "Continuar esta viagem no ChatGPT ↗",
  },
};

function copyFor(locale) {
  return COPY[localeLanguage(locale)] || COPY.en;
}

export function restrictedWebId(locationLike = globalThis.location) {
  const fromMeta = globalThis.document?.querySelector('meta[name="sendero-trip-web-id"]')?.content?.trim();
  if (fromMeta) return fromMeta;
  const match = locationLike?.pathname?.match(/^\/app\/trips\/([^/?#]+)/);
  try { return match ? decodeURIComponent(match[1]) : ""; } catch { return ""; }
}

function externalUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch { return ""; }
}

function configuredChatgptUrl() {
  const url = externalUrl(document.querySelector('meta[name="sendero-chatgpt-url"]')?.content || "");
  if (!url) return "";
  const parsed = new URL(url);
  return parsed.hostname === "chatgpt.com" && parsed.pathname === "/" && !parsed.search && !parsed.hash
    ? ""
    : url;
}

export function RestrictedTripApp({ initialWebId = "" }) {
  const webId = initialWebId || restrictedWebId();
  const [state, setState] = useState({ kind: "loading" });
  const latestStateRef = useRef(state);
  const [activeView, setActiveView] = useState("list");
  const [selectedCalendarDate, setSelectedCalendarDate] = useState("");
  const [selectedCalendarMonth, setSelectedCalendarMonth] = useState("");
  const [selectedReservationKey, setSelectedReservationKey] = useState("");
  const [selectedRouteDate, setSelectedRouteDate] = useState("");
  const [updateError, setUpdateError] = useState("");
  const reservationQueue = useRef(Promise.resolve());
  const reservationOperations = useRef(createStableOperationRegistry());
  const locale = resolveContentLocale(state.kind === "ready" ? state.trip.itinerary.locale : undefined);
  const copy = copyFor(locale);

  const commitState = useCallback((next) => {
    latestStateRef.current = next;
    setState(next);
  }, []);

  const loadTrip = useCallback(async ({ preserveSession } = {}) => {
    if (!webId) { commitState({ kind: "not_found" }); return; }
    try {
      let session = preserveSession || null;
      if (!session) {
        session = normalizeSession(await requestJson("/api/session"));
        if (!session.authenticated) { commitState({ kind: "signed_out", session }); return; }
      }
      const trip = normalizeRestrictedTrip(await requestJson(`/api/trips/${encodeURIComponent(webId)}`));
      if (!trip) throw new Error("invalid_trip");
      commitState({ kind: "ready", session, trip });
    } catch (error) {
      if (error?.status === 401) commitState({ kind: "signed_out", session: { authenticated: false } });
      else if (error?.status === 403) commitState({ kind: "forbidden" });
      else if (error?.status === 404) commitState({ kind: "not_found" });
      else commitState({ error, kind: "error" });
    }
  }, [commitState, webId]);

  useEffect(() => { loadTrip(); }, [loadTrip]);
  useEffect(() => { setDocumentLocale(locale); }, [locale]);

  function openReservation(target) {
    setSelectedReservationKey(target ? reservationEntryKey(target.dayDate, target.activityId) : "");
    setActiveView("reservations");
  }

  function updateReservation({ activityId, dayDate, status }) {
    setUpdateError("");
    const operation = async () => {
      const current = latestStateRef.current;
      if (current.kind !== "ready") throw new Error("trip_not_ready");
      const operationKey = [webId, current.trip.version, dayDate, activityId, status].join(":");
      const reservationOperation = reservationOperations.current.begin(
        operationKey,
        current.trip.version,
        "reservation",
      );
      try {
        const result = await requestJson(`/api/trips/${encodeURIComponent(webId)}/reservations/status`, {
          body: {
            activityId,
            dayDate,
            expectedVersion: reservationOperation.expectedVersion,
            operationId: reservationOperation.operationId,
            status,
          },
          csrfToken: current.session.csrfToken,
          method: "PATCH",
        });
        const trip = normalizeRestrictedTrip(result);
        if (!trip) throw new Error("invalid_trip");
        reservationOperations.current.clear(operationKey);
        commitState({ ...current, trip });
        return trip;
      } catch (error) {
        if (error?.status === 409) {
          reservationOperations.current.clear(operationKey);
          await loadTrip({ preserveSession: current.session });
          setUpdateError(copy.conflict);
        } else setUpdateError(copy.reservationError);
        throw error;
      }
    };
    const queued = reservationQueue.current.then(operation, operation);
    reservationQueue.current = queued.catch(() => {});
    return queued;
  }

  if (state.kind === "loading") return <WebState kind="loading" title={copy.loading} />;
  if (state.kind === "signed_out") return <WebState action={<a className="web-button web-button-primary" href={loginUrl(state.session, `/app/trips/${encodeURIComponent(webId)}`)}>{copy.signIn}</a>} detail={copy.signedOutDetail} title={copy.signedOutTitle} />;
  if (state.kind === "forbidden") return <WebState detail={copy.forbiddenDetail} title={copy.forbiddenTitle} />;
  if (state.kind === "not_found") return <WebState action={<a className="web-button" href="/app">{copy.back}</a>} detail={copy.notFoundDetail} kind="error" title={copy.notFoundTitle} />;
  if (state.kind === "error") return <WebState action={<WebButton onClick={() => loadTrip()}>{copy.retry}</WebButton>} detail={copy.errorDetail} kind="error" title={copy.errorTitle} />;

  const { session, trip } = state;
  const chatgptUrl = configuredChatgptUrl();
  return (
    <WebPageFrame className="restricted-page" csrfToken={session.csrfToken} user={session.user}>
      <style>{restrictedStyles}</style>
      <div className="restricted-context">
        <p>{copy.restricted}</p>
        <div className="restricted-context-actions">
          {trip.permissions.editInSendero && chatgptUrl ? <a className="restricted-chat-link" href={chatgptUrl} rel="noreferrer" target="_blank">{copy.continue}</a> : null}
          <span className="web-role-badge">{copy.roles[trip.role]}</span>
        </div>
      </div>
      {updateError ? <p className="restricted-update-error" role="alert">{updateError}</p> : null}
      <div className="restricted-viewer">
        <ItineraryViewer
          activeView={activeView}
          itinerary={trip.itinerary}
          onCalendarDayChange={setSelectedCalendarDate}
          onCalendarMonthChange={setSelectedCalendarMonth}
          onOpenExternal={(url) => { const safe = externalUrl(url); if (safe) window.open(safe, "_blank", "noopener,noreferrer"); }}
          onReservationOpen={openReservation}
          onReservationStatusChange={updateReservation}
          onRouteDayChange={setSelectedRouteDate}
          onViewChange={(view) => { setActiveView(view); if (view !== "reservations") setSelectedReservationKey(""); }}
          reservationWritable={trip.permissions.updateReservationStatus}
          selectedCalendarDate={selectedCalendarDate}
          selectedCalendarMonth={selectedCalendarMonth}
          selectedReservationKey={selectedReservationKey}
          selectedRouteDate={selectedRouteDate}
          variant="restricted"
        />
      </div>
      {trip.permissions.manageAccess ? <AccessPanel csrfToken={session.csrfToken} locale={locale} webId={trip.webId} /> : null}
    </WebPageFrame>
  );
}
